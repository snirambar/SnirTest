import { describe, expect, it } from 'vitest';
import { parseWebhookPayload } from '../src/webhook/parse.js';
import type { InboundMessage, StatusUpdate } from '../src/whatsapp/types.js';

const RECEIVED_AT = '2026-08-31T12:00:00.000Z';

/** Builds a payload in the shape Meta actually posts. */
function payload(value: Record<string, unknown>): unknown {
    return {
        object: 'whatsapp_business_account',
        entry: [{ id: 'WABA_ID', changes: [{ field: 'messages', value }] }]
    };
}

const METADATA = { display_phone_number: '15550009999', phone_number_id: '1234567890' };

describe('parseWebhookPayload — inbound messages', () => {
    it('extracts a text message with sender attribution', () => {
        const events = parseWebhookPayload(
            payload({
                messaging_product: 'whatsapp',
                metadata: METADATA,
                contacts: [{ profile: { name: 'Ada Lovelace' }, wa_id: '15550101234' }],
                messages: [
                    {
                        from: '15550101234',
                        id: 'wamid.ABC',
                        timestamp: '1756641600',
                        type: 'text',
                        text: { body: 'Hello there' }
                    }
                ]
            }),
            RECEIVED_AT
        );

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual<InboundMessage>({
            kind: 'message',
            id: 'wamid.ABC',
            from: '15550101234',
            to: '15550009999',
            senderName: 'Ada Lovelace',
            type: 'text',
            text: 'Hello there',
            mediaId: undefined,
            replyToId: undefined,
            timestamp: 1756641600,
            receivedAt: RECEIVED_AT
        });
    });

    it('extracts the media ID and caption from a media message', () => {
        const events = parseWebhookPayload(
            payload({
                metadata: METADATA,
                messages: [
                    {
                        from: '15550101234',
                        id: 'wamid.IMG',
                        timestamp: '1756641600',
                        type: 'image',
                        image: { id: 'media-777', mime_type: 'image/jpeg', caption: 'a photo' }
                    }
                ]
            }),
            RECEIVED_AT
        );

        const message = events[0] as InboundMessage;
        expect(message.type).toBe('image');
        expect(message.mediaId).toBe('media-777');
        expect(message.text).toBe('a photo');
    });

    it('records the quoted message ID on a reply', () => {
        const events = parseWebhookPayload(
            payload({
                metadata: METADATA,
                messages: [
                    {
                        from: '15550101234',
                        id: 'wamid.REPLY',
                        timestamp: '1756641600',
                        type: 'text',
                        text: { body: 'yes' },
                        context: { from: '15550009999', id: 'wamid.ORIGINAL', message_id: 'wamid.ORIGINAL' }
                    }
                ]
            }),
            RECEIVED_AT
        );

        expect((events[0] as InboundMessage).replyToId).toBe('wamid.ORIGINAL');
    });

    it('reads the label from an interactive button reply', () => {
        const events = parseWebhookPayload(
            payload({
                metadata: METADATA,
                messages: [
                    {
                        from: '15550101234',
                        id: 'wamid.INT',
                        timestamp: '1756641600',
                        type: 'interactive',
                        interactive: { type: 'button_reply', button_reply: { id: 'yes', title: 'Confirm' } }
                    }
                ]
            }),
            RECEIVED_AT
        );

        expect((events[0] as InboundMessage).text).toBe('Confirm');
    });

    it('reads the label from a quick-reply button message', () => {
        const events = parseWebhookPayload(
            payload({
                metadata: METADATA,
                messages: [
                    {
                        from: '15550101234',
                        id: 'wamid.BTN',
                        timestamp: '1756641600',
                        type: 'button',
                        button: { payload: 'STOP', text: 'Unsubscribe' }
                    }
                ]
            }),
            RECEIVED_AT
        );

        expect((events[0] as InboundMessage).text).toBe('Unsubscribe');
    });

    it('flattens messages across multiple entries and changes', () => {
        const events = parseWebhookPayload(
            {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        changes: [
                            { value: { metadata: METADATA, messages: [{ from: '1', id: 'a', type: 'text' }] } },
                            { value: { metadata: METADATA, messages: [{ from: '2', id: 'b', type: 'text' }] } }
                        ]
                    },
                    {
                        changes: [{ value: { metadata: METADATA, messages: [{ from: '3', id: 'c', type: 'text' }] } }]
                    }
                ]
            },
            RECEIVED_AT
        );

        expect(events.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    });
});

describe('parseWebhookPayload — delivery statuses', () => {
    it('extracts a status update', () => {
        const events = parseWebhookPayload(
            payload({
                metadata: METADATA,
                statuses: [
                    { id: 'wamid.SENT', status: 'delivered', timestamp: '1756641600', recipient_id: '15550101234' }
                ]
            }),
            RECEIVED_AT
        );

        expect(events[0]).toEqual<StatusUpdate>({
            kind: 'status',
            id: 'wamid.SENT',
            status: 'delivered',
            recipient: '15550101234',
            timestamp: 1756641600,
            receivedAt: RECEIVED_AT,
            error: undefined
        });
    });

    it('surfaces the reason on a failed status', () => {
        const events = parseWebhookPayload(
            payload({
                metadata: METADATA,
                statuses: [
                    {
                        id: 'wamid.FAILED',
                        status: 'failed',
                        timestamp: '1756641600',
                        recipient_id: '15550101234',
                        errors: [
                            { code: 131047, title: 'Re-engagement message', error_data: { details: 'More than 24 hours' } }
                        ]
                    }
                ]
            }),
            RECEIVED_AT
        );

        expect((events[0] as StatusUpdate).error).toBe('More than 24 hours (code 131047)');
    });

    it('returns messages and statuses from the same change', () => {
        const events = parseWebhookPayload(
            payload({
                metadata: METADATA,
                messages: [{ from: '15550101234', id: 'wamid.IN', type: 'text', text: { body: 'hi' } }],
                statuses: [{ id: 'wamid.OUT', status: 'read' }]
            }),
            RECEIVED_AT
        );

        expect(events.map((e) => e.kind)).toEqual(['message', 'status']);
    });
});

describe('parseWebhookPayload — malformed input', () => {
    // Meta retries any non-2xx, so a payload we do not understand must never
    // throw; it is skipped instead.
    it.each([
        ['null', null],
        ['a string', 'not a payload'],
        ['an empty object', {}],
        ['entry that is not an array', { entry: 'nope' }],
        ['a change with no value', { entry: [{ changes: [{}] }] }],
        ['a status-only change with no messages', payload({ metadata: METADATA })]
    ])('returns no events for %s without throwing', (_label, input) => {
        expect(() => parseWebhookPayload(input, RECEIVED_AT)).not.toThrow();
        expect(parseWebhookPayload(input, RECEIVED_AT)).toEqual([]);
    });

    it('skips a message missing its id or sender', () => {
        const events = parseWebhookPayload(
            payload({
                metadata: METADATA,
                messages: [{ id: 'no-sender', type: 'text' }, { from: '155', type: 'text' }]
            }),
            RECEIVED_AT
        );

        expect(events).toEqual([]);
    });

    it('falls back to the receive time when Meta sends no timestamp', () => {
        const events = parseWebhookPayload(
            payload({ metadata: METADATA, messages: [{ from: '155', id: 'x', type: 'text' }] }),
            RECEIVED_AT
        );

        expect((events[0] as InboundMessage).timestamp).toBe(Math.floor(Date.parse(RECEIVED_AT) / 1000));
    });

    it('handles an unknown message type without losing the event', () => {
        const events = parseWebhookPayload(
            payload({
                metadata: METADATA,
                messages: [{ from: '155', id: 'x', type: 'some_future_type', some_future_type: {} }]
            }),
            RECEIVED_AT
        );

        expect(events).toHaveLength(1);
        expect((events[0] as InboundMessage).type).toBe('some_future_type');
    });
});
