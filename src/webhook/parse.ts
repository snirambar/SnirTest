import type { InboundMessage, InboxEvent, StatusUpdate } from '../whatsapp/types.js';

/**
 * Flattens a WhatsApp webhook payload into normalized events.
 *
 * Meta nests everything as `entry[].changes[].value`, and a single POST may
 * carry several entries, several changes, and both inbound messages and
 * delivery statuses. Unknown shapes are skipped rather than thrown on: a
 * webhook body we do not recognize must never take the listener down, because
 * Meta retries anything that is not a 2xx.
 */
export function parseWebhookPayload(payload: unknown, receivedAt: string = new Date().toISOString()): InboxEvent[] {
    const events: InboxEvent[] = [];
    const entries = asArray(readProp(payload, 'entry'));

    for (const entry of entries) {
        for (const change of asArray(readProp(entry, 'changes'))) {
            const value = readProp(change, 'value');
            if (!isRecord(value)) continue;

            const businessNumber = readDisplayPhoneNumber(value);
            const contactNames = readContactNames(value);

            for (const raw of asArray(value['messages'])) {
                const message = parseMessage(raw, businessNumber, contactNames, receivedAt);
                if (message) events.push(message);
            }
            for (const raw of asArray(value['statuses'])) {
                const status = parseStatus(raw, receivedAt);
                if (status) events.push(status);
            }
        }
    }

    return events;
}

function parseMessage(
    raw: unknown,
    businessNumber: string | undefined,
    contactNames: Map<string, string>,
    receivedAt: string
): InboundMessage | undefined {
    if (!isRecord(raw)) return undefined;
    const id = asString(raw['id']);
    const from = asString(raw['from']);
    if (!id || !from) return undefined;

    const type = asString(raw['type']) ?? 'unknown';
    const body = isRecord(raw[type]) ? (raw[type] as Record<string, unknown>) : undefined;

    return {
        kind: 'message',
        id,
        from,
        to: businessNumber,
        senderName: contactNames.get(from),
        type,
        text: readText(type, raw, body),
        mediaId: body ? asString(body['id']) : undefined,
        replyToId: isRecord(raw['context']) ? asString(raw['context']['message_id']) : undefined,
        timestamp: asNumber(raw['timestamp']) ?? Math.floor(Date.parse(receivedAt) / 1000),
        receivedAt
    };
}

/** Text lives under `text.body` for text messages and `caption` for media. */
function readText(type: string, raw: Record<string, unknown>, body: Record<string, unknown> | undefined): string | undefined {
    if (type === 'text') return isRecord(raw['text']) ? asString(raw['text']['body']) : undefined;
    if (type === 'button') return isRecord(raw['button']) ? asString(raw['button']['text']) : undefined;
    if (type === 'interactive') return readInteractiveTitle(raw['interactive']);
    return body ? asString(body['caption']) : undefined;
}

/** An interactive reply carries its label under the reply object's `title`. */
function readInteractiveTitle(interactive: unknown): string | undefined {
    if (!isRecord(interactive)) return undefined;
    for (const key of ['button_reply', 'list_reply']) {
        const reply = interactive[key];
        if (isRecord(reply)) return asString(reply['title']);
    }
    return undefined;
}

function parseStatus(raw: unknown, receivedAt: string): StatusUpdate | undefined {
    if (!isRecord(raw)) return undefined;
    const id = asString(raw['id']);
    const status = asString(raw['status']);
    if (!id || !status) return undefined;

    return {
        kind: 'status',
        id,
        status,
        recipient: asString(raw['recipient_id']),
        timestamp: asNumber(raw['timestamp']) ?? Math.floor(Date.parse(receivedAt) / 1000),
        receivedAt,
        error: readStatusError(raw['errors'])
    };
}

function readStatusError(errors: unknown): string | undefined {
    const first = asArray(errors)[0];
    if (!isRecord(first)) return undefined;
    const detail = isRecord(first['error_data']) ? asString(first['error_data']['details']) : undefined;
    const message = detail ?? asString(first['title']) ?? asString(first['message']);
    const code = asNumber(first['code']);
    if (!message) return code === undefined ? undefined : `Error code ${code}`;
    return code === undefined ? message : `${message} (code ${code})`;
}

function readDisplayPhoneNumber(value: Record<string, unknown>): string | undefined {
    const metadata = value['metadata'];
    return isRecord(metadata) ? asString(metadata['display_phone_number']) : undefined;
}

/** Maps sender wa_id to profile name so messages can be attributed. */
function readContactNames(value: Record<string, unknown>): Map<string, string> {
    const names = new Map<string, string>();
    for (const contact of asArray(value['contacts'])) {
        if (!isRecord(contact)) continue;
        const waId = asString(contact['wa_id']);
        const profile = contact['profile'];
        const name = isRecord(profile) ? asString(profile['name']) : undefined;
        if (waId && name) names.set(waId, name);
    }
    return names;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readProp(value: unknown, key: string): unknown {
    return isRecord(value) ? value[key] : undefined;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Meta sends timestamps as numeric strings. */
function asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
    return undefined;
}
