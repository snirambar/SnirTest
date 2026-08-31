#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { Inbox } from './inbox.js';
import { logger } from './logger.js';
import { registerTools } from './tools/index.js';
import { startWebhookServer, type WebhookServer } from './webhook/server.js';
import { WhatsAppClient } from './whatsapp/client.js';

const SERVER_NAME = 'whatsapp';
const SERVER_VERSION = '0.1.0';

async function main(): Promise<void> {
    const config = loadConfig();
    const inbox = new Inbox(config.inboxSize);
    const client = new WhatsAppClient(config);

    let webhook: WebhookServer | undefined;
    if (config.webhook.enabled) {
        webhook = await startWebhookServer(config.webhook, inbox);
    } else {
        logger.info('Webhook listener disabled (WHATSAPP_WEBHOOK_PORT=0); running in send-only mode');
    }

    if (config.allowedRecipients) {
        logger.info(`Recipient allowlist active: ${config.allowedRecipients.join(', ')}`);
    }

    const handle = serveStdio(() => {
        // The factory may be called more than once (the SDK pins one instance
        // per connection era), so the server is built here while the client,
        // inbox and webhook listener are shared across instances.
        const server = new McpServer(
            { name: SERVER_NAME, version: SERVER_VERSION },
            { capabilities: { tools: {} } }
        );
        registerTools(server, { client, inbox, config });
        return server;
    });

    logger.info(`WhatsApp MCP server ready (Graph API ${config.graphApiVersion})`);

    let shuttingDown = false;
    const shutdown = (reason: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        void (async () => {
            logger.info(`${reason}, shutting down`);
            try {
                await handle.close();
                await webhook?.close();
            } catch (error) {
                logger.error('Error during shutdown', error instanceof Error ? error.message : String(error));
            }
            process.exit(0);
        })();
    };

    process.on('SIGINT', () => shutdown('Received SIGINT'));
    process.on('SIGTERM', () => shutdown('Received SIGTERM'));

    // An MCP client shuts its server down by closing stdin. The webhook
    // listener keeps the event loop alive on its own, so without this the
    // process would outlive the client that spawned it — orphans would pile up
    // still holding the webhook port, and the next start would fail with
    // EADDRINUSE.
    process.stdin.on('end', () => shutdown('stdin closed'));
    process.stdin.on('close', () => shutdown('stdin closed'));
}

main().catch((error: unknown) => {
    // Startup failures are almost always configuration; make them readable
    // rather than dumping a stack trace into the client's log.
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
