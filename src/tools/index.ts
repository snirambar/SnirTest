import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import type { Inbox } from '../inbox.js';
import type { WhatsAppClient } from '../whatsapp/client.js';
import type { MediaSource, MediaType } from '../whatsapp/types.js';

export interface ToolContext {
    readonly client: WhatsAppClient;
    readonly inbox: Inbox;
    readonly config: Config;
}

/** A tool result carrying text content. */
type ToolResult = {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
};

function ok(text: string): ToolResult {
    return { content: [{ type: 'text', text }] };
}

function fail(text: string): ToolResult {
    return { content: [{ type: 'text', text }], isError: true };
}

/**
 * Runs a tool body, turning any throw into a tool error rather than a
 * transport-level failure.
 *
 * A thrown exception would surface to the model as a protocol error with no
 * useful detail; the messages built in `errors.ts` are the whole point of the
 * error mapping, so they need to reach the caller intact.
 */
async function guard(run: () => Promise<ToolResult>): Promise<ToolResult> {
    try {
        return await run();
    } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
    }
}

const phoneField = z
    .string()
    .describe('Recipient phone number in international format, e.g. "+15550101234" or "15550101234".');

export function registerTools(server: McpServer, ctx: ToolContext): void {
    registerSendTools(server, ctx);
    registerInboxTools(server, ctx);
    registerMediaTools(server, ctx);
}

function registerSendTools(server: McpServer, { client }: ToolContext): void {
    server.registerTool(
        'whatsapp_send_text',
        {
            title: 'Send WhatsApp text message',
            description:
                'Send a free-form text message to a WhatsApp user. ' +
                'IMPORTANT: WhatsApp only permits free-form messages within 24 hours of the recipient\'s most recent message ' +
                '(the "customer service window"). Outside that window this fails with error 131047 and you must use ' +
                'whatsapp_send_template with a pre-approved template instead.',
            inputSchema: z.object({
                to: phoneField,
                body: z.string().min(1).max(4096).describe('Message text. WhatsApp caps this at 4096 characters.'),
                preview_url: z
                    .boolean()
                    .optional()
                    .describe('Render a link preview for the first URL in the body. Defaults to false.'),
                reply_to_message_id: z
                    .string()
                    .optional()
                    .describe('ID of a message to quote-reply to, as returned by whatsapp_list_messages.')
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
        },
        async (args) =>
            guard(async () => {
                const result = await client.sendText({
                    to: args.to,
                    body: args.body,
                    ...(args.preview_url !== undefined ? { previewUrl: args.preview_url } : {}),
                    ...(args.reply_to_message_id !== undefined
                        ? { replyToMessageId: args.reply_to_message_id }
                        : {})
                });
                return ok(`Message sent to ${result.to}. Message ID: ${result.messageId}`);
            })
    );

    server.registerTool(
        'whatsapp_send_template',
        {
            title: 'Send WhatsApp template message',
            description:
                'Send a pre-approved message template. This is the only way to message a user outside the 24-hour ' +
                'customer service window, and the only way to start a new conversation. The template must already be ' +
                'approved in the WhatsApp Business Account; this tool cannot create one.',
            inputSchema: z.object({
                to: phoneField,
                template_name: z.string().min(1).describe('Exact name of the approved template.'),
                language_code: z
                    .string()
                    .min(2)
                    .describe('Template language code, e.g. "en_US" or "he". Must match the approved template.'),
                components: z
                    .array(
                        z.object({
                            type: z.string().describe('"header", "body", or "button".'),
                            sub_type: z.string().optional(),
                            index: z.string().optional(),
                            parameters: z.array(z.record(z.string(), z.unknown())).optional()
                        })
                    )
                    .optional()
                    .describe('Variable substitutions. Omit for templates with no variables.')
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
        },
        async (args) =>
            guard(async () => {
                const result = await client.sendTemplate({
                    to: args.to,
                    templateName: args.template_name,
                    languageCode: args.language_code,
                    ...(args.components !== undefined ? { components: args.components } : {})
                });
                return ok(
                    `Template "${args.template_name}" sent to ${result.to}. Message ID: ${result.messageId}`
                );
            })
    );

    server.registerTool(
        'whatsapp_send_media',
        {
            title: 'Send WhatsApp media message',
            description:
                'Send an image, document, audio, video, or sticker, either by public HTTPS URL or by a media ID ' +
                'already uploaded to WhatsApp. Subject to the same 24-hour window rule as text messages.',
            inputSchema: z.object({
                to: phoneField,
                media_type: z
                    .enum(['image', 'document', 'audio', 'video', 'sticker'])
                    .describe('Kind of media being sent.'),
                link: z
                    .string()
                    .url()
                    .optional()
                    .describe('Publicly reachable HTTPS URL. Provide exactly one of link or media_id.'),
                media_id: z
                    .string()
                    .optional()
                    .describe('ID of media already uploaded to WhatsApp. Provide exactly one of link or media_id.'),
                caption: z
                    .string()
                    .max(1024)
                    .optional()
                    .describe('Caption text. Not supported for audio or sticker.'),
                filename: z.string().optional().describe('Display filename. Documents only.')
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
        },
        async (args) =>
            guard(async () => {
                if ((args.link === undefined) === (args.media_id === undefined)) {
                    return fail('Provide exactly one of "link" or "media_id".');
                }
                const source: MediaSource =
                    args.link !== undefined ? { link: args.link } : { id: args.media_id as string };

                const result = await client.sendMedia({
                    to: args.to,
                    mediaType: args.media_type as MediaType,
                    source,
                    ...(args.caption !== undefined ? { caption: args.caption } : {}),
                    ...(args.filename !== undefined ? { filename: args.filename } : {})
                });
                return ok(`${args.media_type} sent to ${result.to}. Message ID: ${result.messageId}`);
            })
    );

    server.registerTool(
        'whatsapp_mark_read',
        {
            title: 'Mark WhatsApp message as read',
            description:
                'Mark a received message as read, showing blue ticks to the sender. Use the message ID from ' +
                'whatsapp_list_messages.',
            inputSchema: z.object({
                message_id: z.string().min(1).describe('Inbound message ID, e.g. "wamid.HBgL...".')
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
        },
        async (args) =>
            guard(async () => {
                await client.markAsRead(args.message_id);
                return ok(`Message ${args.message_id} marked as read.`);
            })
    );
}

function registerInboxTools(server: McpServer, { inbox, config }: ToolContext): void {
    server.registerTool(
        'whatsapp_list_messages',
        {
            title: 'List received WhatsApp messages',
            description:
                'List messages received by this server via webhook, newest first. ' +
                'Note: messages are held in memory only for as long as this server process runs, and are only ' +
                'captured while it is running — this is not a full conversation history from WhatsApp.',
            inputSchema: z.object({
                from: z.string().optional().describe('Only messages from this phone number.'),
                since: z
                    .string()
                    .optional()
                    .describe('Only events received at or after this ISO-8601 timestamp.'),
                limit: z.number().int().min(1).max(500).optional().describe('Maximum events to return. Default 50.'),
                include: z
                    .enum(['message', 'status', 'all'])
                    .optional()
                    .describe('"message" (default) for inbound messages, "status" for delivery receipts, or "all".')
            }),
            annotations: { readOnlyHint: true, openWorldHint: false }
        },
        async (args) =>
            guard(async () => {
                // Without this, an empty result is indistinguishable from
                // "nobody messaged you" when the listener was never started.
                if (!config.webhook.enabled) {
                    return fail(
                        'The webhook listener is disabled (WHATSAPP_WEBHOOK_PORT=0), so no messages are being received. ' +
                            'Set a port and register the callback URL in the Meta App dashboard to receive messages.'
                    );
                }

                const events = inbox.query({
                    ...(args.from !== undefined ? { from: args.from } : {}),
                    ...(args.since !== undefined ? { since: args.since } : {}),
                    limit: args.limit ?? 50,
                    kind: args.include ?? 'message'
                });

                if (events.length === 0) {
                    return ok(
                        `No matching events. The listener is running and has received ${inbox.size} event(s) in total this session.`
                    );
                }

                const notes =
                    inbox.dropped > 0
                        ? `\n\nNote: ${inbox.dropped} older event(s) were evicted from the in-memory buffer (capacity ${config.inboxSize}).`
                        : '';

                return ok(`${events.length} event(s):\n\n${JSON.stringify(events, null, 2)}${notes}`);
            })
    );
}

function registerMediaTools(server: McpServer, { client }: ToolContext): void {
    server.registerTool(
        'whatsapp_get_media_url',
        {
            title: 'Resolve WhatsApp media ID to a download URL',
            description:
                'Resolve the media ID from a received media message into a temporary download URL. ' +
                'The URL is short-lived and requires the WhatsApp access token as a bearer credential to download.',
            inputSchema: z.object({
                media_id: z.string().min(1).describe('Media ID from a received message.')
            }),
            annotations: { readOnlyHint: true, openWorldHint: true }
        },
        async (args) =>
            guard(async () => {
                const media = await client.getMediaUrl(args.media_id);
                const details = [
                    `URL: ${media.url}`,
                    media.mimeType ? `MIME type: ${media.mimeType}` : undefined,
                    media.fileSize !== undefined ? `Size: ${media.fileSize} bytes` : undefined,
                    'This URL expires shortly and requires an "Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>" header.'
                ].filter((line): line is string => line !== undefined);
                return ok(details.join('\n'));
            })
    );
}
