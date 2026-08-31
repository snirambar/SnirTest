import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Inbox } from '../src/inbox.js';
import { computeSignature } from '../src/webhook/signature.js';
import { startWebhookServer, type WebhookServer } from '../src/webhook/server.js';
import { makeConfig } from './helpers.js';

const APP_SECRET = 'test-app-secret';
const VERIFY_TOKEN = 'test-verify-token';

/**
 * Drives the listener over a real socket on an ephemeral port, so the raw-body
 * reading and header handling are exercised as they are in production rather
 * than through a mocked request object.
 */
let server: WebhookServer;
let inbox: Inbox;
let base: string;

const webhookConfig = { ...makeConfig().webhook, port: 0, appSecret: APP_SECRET, verifyToken: VERIFY_TOKEN };

beforeEach(async () => {
    inbox = new Inbox(50);
    server = await startWebhookServer(webhookConfig, inbox);
    base = `http://127.0.0.1:${server.port}`;
});

afterEach(async () => {
    await server.close();
});

const SAMPLE = {
    object: 'whatsapp_business_account',
    entry: [
        {
            id: 'WABA',
            changes: [
                {
                    field: 'messages',
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: { display_phone_number: '15550009999', phone_number_id: '1234567890' },
                        contacts: [{ profile: { name: 'Ada' }, wa_id: '15550101234' }],
                        messages: [
                            {
                                from: '15550101234',
                                id: 'wamid.LIVE',
                                timestamp: '1756641600',
                                type: 'text',
                                text: { body: 'over the wire' }
                            }
                        ]
                    }
                }
            ]
        }
    ]
};

function post(body: string, signature: string | undefined, path = '/webhook'): Promise<Response> {
    return fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(signature !== undefined ? { 'X-Hub-Signature-256': signature } : {})
        },
        body
    });
}

function signed(body: string, secret = APP_SECRET): string {
    return computeSignature(Buffer.from(body, 'utf8'), secret);
}

describe('verification handshake', () => {
    it('echoes the challenge when the token matches', async () => {
        const response = await fetch(
            `${base}/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=CHALLENGE_123`
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('CHALLENGE_123');
    });

    it('rejects a wrong verify token', async () => {
        const response = await fetch(
            `${base}/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=CHALLENGE_123`
        );

        expect(response.status).toBe(403);
    });

    it('rejects a handshake with no challenge', async () => {
        const response = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}`);

        expect(response.status).toBe(403);
    });

    it('rejects a mode other than subscribe', async () => {
        const response = await fetch(
            `${base}/webhook?hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=C`
        );

        expect(response.status).toBe(403);
    });
});

describe('receiving payloads', () => {
    it('accepts a correctly signed payload and stores the message', async () => {
        const body = JSON.stringify(SAMPLE);
        const response = await post(body, signed(body));

        expect(response.status).toBe(200);

        const stored = inbox.query();
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({ id: 'wamid.LIVE', from: '15550101234', text: 'over the wire' });
    });

    it('rejects an unsigned payload and stores nothing', async () => {
        const body = JSON.stringify(SAMPLE);
        const response = await post(body, undefined);

        expect(response.status).toBe(401);
        expect(inbox.size).toBe(0);
    });

    it('rejects a payload signed with the wrong secret', async () => {
        const body = JSON.stringify(SAMPLE);
        const response = await post(body, signed(body, 'attacker-secret'));

        expect(response.status).toBe(401);
        expect(inbox.size).toBe(0);
    });

    it('rejects a payload modified in transit', async () => {
        const original = JSON.stringify(SAMPLE);
        const signature = signed(original);
        const tampered = original.replace('over the wire', 'tampered text');

        const response = await post(tampered, signature);

        expect(response.status).toBe(401);
        expect(inbox.size).toBe(0);
    });

    it('acknowledges a verified payload it cannot parse, so Meta stops retrying', async () => {
        // A 200 here is deliberate: retrying malformed JSON would never help.
        const body = 'this is not json';
        const response = await post(body, signed(body));

        expect(response.status).toBe(200);
        expect(inbox.size).toBe(0);
    });

    it('accepts a payload whose byte form differs from a re-serialization', async () => {
        // Whitespace makes these bytes distinct from JSON.stringify output;
        // verification must still succeed because it signs what was sent.
        const body = '{"object":"whatsapp_business_account",   "entry":  []}';
        const response = await post(body, signed(body));

        expect(response.status).toBe(200);
    });

    it('handles a non-ASCII body byte-for-byte', async () => {
        const payload = structuredClone(SAMPLE);
        payload.entry[0]!.changes[0]!.value.messages[0]!.text.body = 'שלום 👋';
        const body = JSON.stringify(payload);

        const response = await post(body, signed(body));

        expect(response.status).toBe(200);
        expect(inbox.query()[0]).toMatchObject({ text: 'שלום 👋' });
    });
});

describe('routing', () => {
    it('serves an unauthenticated health check', async () => {
        const response = await fetch(`${base}/health`);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ status: 'ok', inboxSize: 0 });
    });

    it('404s an unknown path', async () => {
        expect((await fetch(`${base}/nope`)).status).toBe(404);
    });

    it('405s an unsupported method with an Allow header', async () => {
        const response = await fetch(`${base}/webhook`, { method: 'DELETE' });

        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toBe('GET, POST');
    });
});

describe('startup failures', () => {
    it('explains a port collision instead of surfacing EADDRINUSE', async () => {
        await expect(startWebhookServer({ ...webhookConfig, port: server.port }, new Inbox(10))).rejects.toThrow(
            /already in use/
        );
    });
});
