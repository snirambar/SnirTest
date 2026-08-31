import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRAPH_API_VERSION, loadConfig } from '../src/config.js';
import { redact, resetSecrets } from '../src/logger.js';

/** A minimal environment that passes validation. */
const BASE = {
    WHATSAPP_ACCESS_TOKEN: 'token-value-long-enough',
    WHATSAPP_PHONE_NUMBER_ID: '1234567890',
    WHATSAPP_APP_SECRET: 'app-secret-value',
    WHATSAPP_VERIFY_TOKEN: 'verify-token-value'
} satisfies NodeJS.ProcessEnv;

beforeEach(() => {
    resetSecrets();
});

describe('required variables', () => {
    it('accepts a complete environment', () => {
        const config = loadConfig({ ...BASE });

        expect(config.accessToken).toBe('token-value-long-enough');
        expect(config.phoneNumberId).toBe('1234567890');
        expect(config.webhook.enabled).toBe(true);
    });

    it.each(['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'] as const)(
        'names %s in the error when it is missing',
        (variable) => {
            const env = { ...BASE };
            delete (env as Record<string, unknown>)[variable];

            expect(() => loadConfig(env)).toThrow(new RegExp(variable));
        }
    );

    it.each(['WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'] as const)(
        'requires %s when the webhook listener is enabled',
        (variable) => {
            const env = { ...BASE };
            delete (env as Record<string, unknown>)[variable];

            expect(() => loadConfig(env)).toThrow(new RegExp(`${variable} is required to receive webhooks`));
        }
    );

    it('points at send-only mode as the way out of that requirement', () => {
        const env = { ...BASE };
        delete (env as Record<string, unknown>)['WHATSAPP_APP_SECRET'];

        expect(() => loadConfig(env)).toThrow(/WHATSAPP_WEBHOOK_PORT=0/);
    });

    it('allows webhook credentials to be absent in send-only mode', () => {
        const config = loadConfig({
            WHATSAPP_ACCESS_TOKEN: BASE.WHATSAPP_ACCESS_TOKEN,
            WHATSAPP_PHONE_NUMBER_ID: BASE.WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_WEBHOOK_PORT: '0'
        });

        expect(config.webhook.enabled).toBe(false);
        expect(config.webhook.port).toBe(0);
    });
});

describe('defaults', () => {
    it('applies documented defaults', () => {
        const config = loadConfig({ ...BASE });

        expect(config.graphApiVersion).toBe(DEFAULT_GRAPH_API_VERSION);
        expect(config.webhook.port).toBe(3000);
        expect(config.webhook.host).toBe('127.0.0.1');
        expect(config.webhook.path).toBe('/webhook');
        expect(config.inboxSize).toBe(500);
        expect(config.allowedRecipients).toBeUndefined();
    });

    it('binds to loopback rather than all interfaces by default', () => {
        // The listener is meant to sit behind a tunnel, not face the internet.
        expect(loadConfig({ ...BASE }).webhook.host).toBe('127.0.0.1');
    });
});

describe('overrides', () => {
    it('accepts a Graph API version override', () => {
        expect(loadConfig({ ...BASE, WHATSAPP_GRAPH_API_VERSION: 'v23.0' }).graphApiVersion).toBe('v23.0');
    });

    it('rejects a malformed Graph API version', () => {
        expect(() => loadConfig({ ...BASE, WHATSAPP_GRAPH_API_VERSION: '23' })).toThrow(/must look like/);
    });

    it('accepts a custom port, host and path', () => {
        const config = loadConfig({
            ...BASE,
            WHATSAPP_WEBHOOK_PORT: '8080',
            WHATSAPP_WEBHOOK_HOST: '0.0.0.0',
            WHATSAPP_WEBHOOK_PATH: '/hooks/whatsapp'
        });

        expect(config.webhook).toMatchObject({ port: 8080, host: '0.0.0.0', path: '/hooks/whatsapp' });
    });

    it('rejects a path that is not rooted', () => {
        expect(() => loadConfig({ ...BASE, WHATSAPP_WEBHOOK_PATH: 'webhook' })).toThrow();
    });

    it.each(['70000', 'abc', '-1', '3.5'])('rejects the invalid port %s', (port) => {
        expect(() => loadConfig({ ...BASE, WHATSAPP_WEBHOOK_PORT: port })).toThrow(/WHATSAPP_WEBHOOK_PORT/);
    });

    it('accepts a custom inbox size', () => {
        expect(loadConfig({ ...BASE, WHATSAPP_INBOX_SIZE: '25' }).inboxSize).toBe(25);
    });
});

describe('recipient allowlist', () => {
    it('is undefined when unset, meaning any recipient is permitted', () => {
        expect(loadConfig({ ...BASE }).allowedRecipients).toBeUndefined();
    });

    it('normalizes every entry so formatting differences do not defeat the guard', () => {
        const config = loadConfig({
            ...BASE,
            WHATSAPP_ALLOWED_RECIPIENTS: '+1 (555) 010-1234, +972501234567'
        });

        expect(config.allowedRecipients).toEqual(['15550101234', '972501234567']);
    });

    it('rejects an entry that is not a valid number', () => {
        expect(() => loadConfig({ ...BASE, WHATSAPP_ALLOWED_RECIPIENTS: 'not-a-number' })).toThrow(
            /Invalid recipient phone number/
        );
    });

    it('rejects an empty allowlist, which would silently block every send', () => {
        expect(() => loadConfig({ ...BASE, WHATSAPP_ALLOWED_RECIPIENTS: '  ,  ' })).toThrow(/set but empty/);
    });
});

describe('secret registration', () => {
    it('registers credentials so they are masked in log output', () => {
        loadConfig({ ...BASE });

        expect(redact('token is token-value-long-enough here')).toBe('token is [REDACTED] here');
        expect(redact('secret is app-secret-value here')).toBe('secret is [REDACTED] here');
        expect(redact('verify is verify-token-value here')).toBe('verify is [REDACTED] here');
    });

    it('leaves unrelated text untouched', () => {
        loadConfig({ ...BASE });

        expect(redact('the phone number id is 1234567890')).toBe('the phone number id is 1234567890');
    });
});
