import { z } from 'zod';
import { registerSecret } from './logger.js';
import { normalizePhoneNumber } from './whatsapp/phone.js';

/**
 * Graph API version used when `WHATSAPP_GRAPH_API_VERSION` is unset.
 *
 * Meta ships a new Graph API version every few months and retires old ones on
 * a rolling ~2 year schedule, so this default WILL go stale. It is overridable
 * by env var precisely so that version drift never requires a code change or a
 * release — check Meta's Graph API changelog and set the variable if the
 * default has aged out.
 */
export const DEFAULT_GRAPH_API_VERSION = 'v21.0';

const DEFAULT_WEBHOOK_PORT = 3000;
const DEFAULT_INBOX_SIZE = 500;

/** Parses a comma-separated recipient allowlist into normalized numbers. */
function parseAllowlist(raw: string | undefined): string[] | undefined {
    if (raw === undefined) return undefined;
    const entries = raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    // An explicitly empty value is a configuration mistake worth catching: it
    // reads as "allow nothing", which would silently block every send.
    if (entries.length === 0) {
        throw new Error(
            'WHATSAPP_ALLOWED_RECIPIENTS is set but empty. Unset it to allow all recipients, or list at least one number.'
        );
    }
    return entries.map((entry) => normalizePhoneNumber(entry));
}

const numericString = (name: string, fallback: number, max: number) =>
    z
        .string()
        .optional()
        .transform((value) => (value === undefined || value === '' ? fallback : Number(value)))
        .refine((value) => Number.isInteger(value) && value >= 0 && value <= max, {
            message: `${name} must be an integer between 0 and ${max}`
        });

const envSchema = z.object({
    WHATSAPP_ACCESS_TOKEN: z.string().min(1, 'WHATSAPP_ACCESS_TOKEN is required'),
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1, 'WHATSAPP_PHONE_NUMBER_ID is required'),
    WHATSAPP_APP_SECRET: z.string().min(1).optional(),
    WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
    WHATSAPP_GRAPH_API_VERSION: z
        .string()
        .regex(/^v\d+\.\d+$/, 'WHATSAPP_GRAPH_API_VERSION must look like "v21.0"')
        .optional(),
    WHATSAPP_WEBHOOK_PORT: numericString('WHATSAPP_WEBHOOK_PORT', DEFAULT_WEBHOOK_PORT, 65535),
    WHATSAPP_WEBHOOK_HOST: z.string().min(1).optional(),
    WHATSAPP_WEBHOOK_PATH: z.string().startsWith('/').optional(),
    WHATSAPP_ALLOWED_RECIPIENTS: z.string().optional(),
    WHATSAPP_INBOX_SIZE: numericString('WHATSAPP_INBOX_SIZE', DEFAULT_INBOX_SIZE, 100_000)
});

export interface WebhookConfig {
    /** Listener is disabled when the port is 0; inbound tools then explain why. */
    readonly enabled: boolean;
    readonly port: number;
    readonly host: string;
    readonly path: string;
    readonly appSecret: string | undefined;
    readonly verifyToken: string | undefined;
}

export interface Config {
    readonly accessToken: string;
    readonly phoneNumberId: string;
    readonly graphApiVersion: string;
    readonly allowedRecipients: readonly string[] | undefined;
    readonly inboxSize: number;
    readonly webhook: WebhookConfig;
}

/**
 * Reads and validates configuration from the environment.
 *
 * Fails loudly and immediately rather than letting a missing variable surface
 * later as an opaque 401 from Meta mid-tool-call.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const parsed = envSchema.safeParse(env);
    if (!parsed.success) {
        const details = parsed.error.issues
            .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('\n');
        throw new Error(`Invalid WhatsApp connector configuration:\n${details}`);
    }

    const value = parsed.data;
    const port = value.WHATSAPP_WEBHOOK_PORT;
    const webhookEnabled = port !== 0;

    // The webhook cannot be operated safely without both of these: no app
    // secret means no signature check, and no verify token means Meta's
    // subscription handshake can never succeed.
    if (webhookEnabled) {
        const missing: string[] = [];
        if (!value.WHATSAPP_APP_SECRET) missing.push('WHATSAPP_APP_SECRET');
        if (!value.WHATSAPP_VERIFY_TOKEN) missing.push('WHATSAPP_VERIFY_TOKEN');
        if (missing.length > 0) {
            throw new Error(
                `Invalid WhatsApp connector configuration:\n` +
                    missing.map((name) => `  - ${name} is required to receive webhooks`).join('\n') +
                    `\nSet them, or set WHATSAPP_WEBHOOK_PORT=0 to run in send-only mode.`
            );
        }
    }

    registerSecret(value.WHATSAPP_ACCESS_TOKEN);
    registerSecret(value.WHATSAPP_APP_SECRET);
    registerSecret(value.WHATSAPP_VERIFY_TOKEN);

    return {
        accessToken: value.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: value.WHATSAPP_PHONE_NUMBER_ID,
        graphApiVersion: value.WHATSAPP_GRAPH_API_VERSION ?? DEFAULT_GRAPH_API_VERSION,
        allowedRecipients: parseAllowlist(value.WHATSAPP_ALLOWED_RECIPIENTS),
        inboxSize: value.WHATSAPP_INBOX_SIZE,
        webhook: {
            enabled: webhookEnabled,
            port,
            host: value.WHATSAPP_WEBHOOK_HOST ?? '127.0.0.1',
            path: value.WHATSAPP_WEBHOOK_PATH ?? '/webhook',
            appSecret: value.WHATSAPP_APP_SECRET,
            verifyToken: value.WHATSAPP_VERIFY_TOKEN
        }
    };
}
