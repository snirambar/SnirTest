import type { Config } from '../src/config.js';
import type { FetchLike } from '../src/whatsapp/client.js';

/** Builds a config without touching the environment. */
export function makeConfig(overrides: Partial<Config> = {}): Config {
    return {
        accessToken: 'test-access-token',
        phoneNumberId: '1234567890',
        graphApiVersion: 'v21.0',
        allowedRecipients: undefined,
        inboxSize: 100,
        webhook: {
            enabled: true,
            port: 3000,
            host: '127.0.0.1',
            path: '/webhook',
            appSecret: 'test-app-secret',
            verifyToken: 'test-verify-token'
        },
        ...overrides
    };
}

export interface RecordedCall {
    url: string;
    init: RequestInit | undefined;
    /** Parsed JSON request body, when one was sent. */
    body: Record<string, unknown> | undefined;
}

export interface StubFetch {
    fetch: FetchLike;
    calls: RecordedCall[];
}

/** A fetch stub that records requests and replies with canned responses. */
export function stubFetch(
    responses: Array<{ status?: number; body: unknown } | Error> = [{ body: { messages: [{ id: 'wamid.TEST' }] } }]
): StubFetch {
    const calls: RecordedCall[] = [];
    let index = 0;

    const fetchImpl: FetchLike = async (url, init) => {
        let parsedBody: Record<string, unknown> | undefined;
        if (typeof init?.body === 'string') {
            parsedBody = JSON.parse(init.body) as Record<string, unknown>;
        }
        calls.push({ url, init, body: parsedBody });

        const next = responses[Math.min(index, responses.length - 1)];
        index += 1;
        if (next instanceof Error) throw next;

        const status = next?.status ?? 200;
        return new Response(JSON.stringify(next?.body ?? {}), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    };

    return { fetch: fetchImpl, calls };
}
