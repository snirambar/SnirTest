import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { WebhookConfig } from '../config.js';
import type { Inbox } from '../inbox.js';
import { logger } from '../logger.js';
import { parseWebhookPayload } from './parse.js';
import { SIGNATURE_HEADER, verifySignature } from './signature.js';

/** Meta rejects webhook payloads larger than this; refuse them before buffering. */
const MAX_BODY_BYTES = 1024 * 1024;

export interface WebhookServer {
    readonly port: number;
    close(): Promise<void>;
}

/**
 * Reads the full request body as raw bytes.
 *
 * Signature verification needs the exact bytes Meta signed, so the body is
 * never parsed before it has been buffered and verified.
 */
function readRawBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;

        req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error(`Webhook body exceeded ${MAX_BODY_BYTES} bytes`));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function send(res: ServerResponse, status: number, body: string, contentType = 'text/plain'): void {
    res.writeHead(status, { 'Content-Type': contentType });
    res.end(body);
}

/**
 * Handles Meta's subscription handshake.
 *
 * Meta calls this once when the callback URL is saved in the App dashboard and
 * expects the challenge echoed verbatim as plain text.
 */
function handleVerification(url: URL, res: ServerResponse, verifyToken: string): void {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === verifyToken && challenge !== null) {
        logger.info('Webhook verification handshake succeeded');
        send(res, 200, challenge);
        return;
    }

    logger.warn('Webhook verification handshake rejected', { mode, hasChallenge: challenge !== null });
    send(res, 403, 'Forbidden');
}

async function handlePayload(
    req: IncomingMessage,
    res: ServerResponse,
    appSecret: string,
    inbox: Inbox
): Promise<void> {
    let rawBody: Buffer;
    try {
        rawBody = await readRawBody(req);
    } catch (error) {
        logger.warn('Rejected webhook body', error instanceof Error ? error.message : String(error));
        send(res, 413, 'Payload Too Large');
        return;
    }

    if (!verifySignature(rawBody, req.headers[SIGNATURE_HEADER], appSecret)) {
        // Do not say which part failed; an attacker probing the endpoint
        // should learn nothing beyond "rejected".
        logger.warn('Rejected webhook with an invalid signature');
        send(res, 401, 'Invalid signature');
        return;
    }

    // Acknowledge before doing any work. Meta retries on any non-2xx, and a
    // parsing problem on our side is not something a retry would fix.
    send(res, 200, 'EVENT_RECEIVED');

    try {
        const events = parseWebhookPayload(JSON.parse(rawBody.toString('utf8')));
        if (events.length > 0) {
            inbox.addAll(events);
            logger.info(`Received ${events.length} webhook event(s)`);
        }
    } catch (error) {
        logger.error('Failed to parse a verified webhook payload', error instanceof Error ? error.message : String(error));
    }
}

/** Builds the request handler, exported so tests can drive it without a socket. */
export function createWebhookHandler(config: WebhookConfig, inbox: Inbox) {
    return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

        // A liveness probe that needs no credentials, useful behind a tunnel.
        if (req.method === 'GET' && url.pathname === '/health') {
            send(res, 200, JSON.stringify({ status: 'ok', inboxSize: inbox.size }), 'application/json');
            return;
        }

        if (url.pathname !== config.path) {
            send(res, 404, 'Not Found');
            return;
        }

        if (req.method === 'GET') {
            handleVerification(url, res, config.verifyToken ?? '');
            return;
        }

        if (req.method === 'POST') {
            await handlePayload(req, res, config.appSecret ?? '', inbox);
            return;
        }

        res.writeHead(405, { Allow: 'GET, POST' });
        res.end('Method Not Allowed');
    };
}

/**
 * Starts the webhook listener.
 *
 * Binds to loopback by default: the listener is meant to sit behind a tunnel
 * or reverse proxy that terminates TLS, not to face the internet directly.
 */
export function startWebhookServer(config: WebhookConfig, inbox: Inbox): Promise<WebhookServer> {
    const handler = createWebhookHandler(config, inbox);

    const server: Server = createServer((req, res) => {
        handler(req, res).catch((error: unknown) => {
            logger.error('Unhandled webhook error', error instanceof Error ? error.message : String(error));
            if (!res.headersSent) send(res, 500, 'Internal Server Error');
        });
    });

    return new Promise((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException) => {
            reject(
                error.code === 'EADDRINUSE'
                    ? new Error(
                          `Webhook port ${config.port} is already in use. Set WHATSAPP_WEBHOOK_PORT to a free port, or 0 to disable the listener.`
                      )
                    : error
            );
        };

        server.once('error', onError);
        server.listen(config.port, config.host, () => {
            server.removeListener('error', onError);
            const address = server.address();
            const port = typeof address === 'object' && address !== null ? address.port : config.port;
            logger.info(`Webhook listener ready on http://${config.host}:${port}${config.path}`);
            resolve({
                port,
                close: () =>
                    new Promise<void>((res, rej) => {
                        server.close((err) => (err ? rej(err) : res()));
                    })
            });
        });
    });
}
