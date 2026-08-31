import type { Config } from '../config.js';
import { WhatsAppApiError } from './errors.js';
import { normalizePhoneNumber } from './phone.js';
import type { GraphErrorBody, MediaSource, MediaType, SendResult, TemplateComponent } from './types.js';

const GRAPH_HOST = 'https://graph.facebook.com';

/** Raised when a send targets a number outside a configured allowlist. */
export class RecipientNotAllowedError extends Error {
    constructor(to: string, allowed: readonly string[]) {
        super(
            `Recipient ${to} is not in WHATSAPP_ALLOWED_RECIPIENTS (${allowed.join(', ')}). ` +
                'This allowlist is a safety guard against sending to the wrong number; ' +
                'update the environment variable to permit this recipient.'
        );
        this.name = 'RecipientNotAllowedError';
    }
}

/** Injected in tests so no case ever reaches the network. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SendTextOptions {
    readonly to: string;
    readonly body: string;
    readonly previewUrl?: boolean;
    readonly replyToMessageId?: string;
}

export interface SendTemplateOptions {
    readonly to: string;
    readonly templateName: string;
    readonly languageCode: string;
    readonly components?: readonly TemplateComponent[];
}

export interface SendMediaOptions {
    readonly to: string;
    readonly mediaType: MediaType;
    readonly source: MediaSource;
    readonly caption?: string;
    readonly filename?: string;
}

export class WhatsAppClient {
    private readonly config: Config;
    private readonly fetchImpl: FetchLike;

    constructor(config: Config, fetchImpl: FetchLike = fetch) {
        this.config = config;
        this.fetchImpl = fetchImpl;
    }

    /**
     * Normalizes a recipient and enforces the allowlist.
     *
     * Every outbound path routes through here, which is what makes the
     * allowlist a real guard rather than a convention each tool must honour.
     */
    private resolveRecipient(to: string): string {
        const normalized = normalizePhoneNumber(to);
        const allowed = this.config.allowedRecipients;
        if (allowed && !allowed.includes(normalized)) {
            throw new RecipientNotAllowedError(normalized, allowed);
        }
        return normalized;
    }

    private get messagesUrl(): string {
        return `${GRAPH_HOST}/${this.config.graphApiVersion}/${this.config.phoneNumberId}/messages`;
    }

    private async request<T>(url: string, init: RequestInit): Promise<T> {
        let response: Response;
        try {
            response = await this.fetchImpl(url, {
                ...init,
                headers: {
                    Authorization: `Bearer ${this.config.accessToken}`,
                    ...(init.headers as Record<string, string> | undefined)
                }
            });
        } catch (cause) {
            // Surface transport failures distinctly from API rejections; the
            // remedy (check connectivity) is entirely different.
            throw new Error(
                `Could not reach the WhatsApp Cloud API: ${cause instanceof Error ? cause.message : String(cause)}`,
                { cause }
            );
        }

        const raw = await response.text();
        let parsed: unknown;
        try {
            parsed = raw.length > 0 ? JSON.parse(raw) : {};
        } catch {
            if (!response.ok) throw new WhatsAppApiError(response.status, undefined);
            throw new Error(`WhatsApp Cloud API returned a non-JSON response (HTTP ${response.status}).`);
        }

        if (!response.ok) {
            const body = (parsed as { error?: GraphErrorBody } | null)?.error;
            throw new WhatsAppApiError(response.status, body);
        }
        return parsed as T;
    }

    private async postMessage(payload: Record<string, unknown>, to: string): Promise<SendResult> {
        const data = await this.request<{ messages?: Array<{ id?: string }> }>(this.messagesUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload })
        });
        const messageId = data.messages?.[0]?.id;
        if (!messageId) {
            throw new Error('WhatsApp Cloud API accepted the request but returned no message ID.');
        }
        return { messageId, to };
    }

    /** Sends a free-form text message. Only valid inside the 24-hour window. */
    async sendText(options: SendTextOptions): Promise<SendResult> {
        const to = this.resolveRecipient(options.to);
        const payload: Record<string, unknown> = {
            to,
            type: 'text',
            text: { body: options.body, preview_url: options.previewUrl ?? false }
        };
        if (options.replyToMessageId) {
            payload['context'] = { message_id: options.replyToMessageId };
        }
        return this.postMessage(payload, to);
    }

    /** Sends a pre-approved template. The only way to open a conversation. */
    async sendTemplate(options: SendTemplateOptions): Promise<SendResult> {
        const to = this.resolveRecipient(options.to);
        const template: Record<string, unknown> = {
            name: options.templateName,
            language: { code: options.languageCode }
        };
        if (options.components && options.components.length > 0) {
            template['components'] = options.components;
        }
        return this.postMessage({ to, type: 'template', template }, to);
    }

    /** Sends media by public link or previously uploaded media ID. */
    async sendMedia(options: SendMediaOptions): Promise<SendResult> {
        const to = this.resolveRecipient(options.to);
        const media: Record<string, unknown> = { ...options.source };

        // Meta ignores captions on audio and stickers; sending one anyway is a
        // silent no-op, so refuse it rather than let the caption vanish.
        if (options.caption !== undefined) {
            if (options.mediaType === 'audio' || options.mediaType === 'sticker') {
                throw new Error(`WhatsApp does not support captions on ${options.mediaType} messages.`);
            }
            media['caption'] = options.caption;
        }
        if (options.filename !== undefined) {
            if (options.mediaType !== 'document') {
                throw new Error('The filename option applies only to document messages.');
            }
            media['filename'] = options.filename;
        }

        return this.postMessage({ to, type: options.mediaType, [options.mediaType]: media }, to);
    }

    /** Marks an inbound message as read (the blue ticks on the sender's phone). */
    async markAsRead(messageId: string): Promise<void> {
        await this.request<unknown>(this.messagesUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId })
        });
    }

    /**
     * Resolves a media ID to a temporary download URL.
     *
     * The URL is short-lived and itself requires the bearer token, so it is not
     * something that can be handed to an unauthenticated client.
     */
    async getMediaUrl(mediaId: string): Promise<{ url: string; mimeType?: string; fileSize?: number }> {
        const data = await this.request<{ url?: string; mime_type?: string; file_size?: number }>(
            `${GRAPH_HOST}/${this.config.graphApiVersion}/${encodeURIComponent(mediaId)}`,
            { method: 'GET' }
        );
        if (!data.url) {
            throw new Error(`No download URL returned for media ID ${mediaId}.`);
        }
        return {
            url: data.url,
            ...(data.mime_type !== undefined ? { mimeType: data.mime_type } : {}),
            ...(data.file_size !== undefined ? { fileSize: data.file_size } : {})
        };
    }
}
