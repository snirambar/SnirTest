import { describe, expect, it } from 'vitest';
import { Inbox } from '../src/inbox.js';
import type { InboundMessage, StatusUpdate } from '../src/whatsapp/types.js';

function message(overrides: Partial<InboundMessage> = {}): InboundMessage {
    return {
        kind: 'message',
        id: 'wamid.1',
        from: '15550101234',
        to: '15550009999',
        senderName: 'Ada',
        type: 'text',
        text: 'hello',
        mediaId: undefined,
        replyToId: undefined,
        timestamp: 1756641600,
        receivedAt: '2026-08-31T12:00:00.000Z',
        ...overrides
    };
}

function status(overrides: Partial<StatusUpdate> = {}): StatusUpdate {
    return {
        kind: 'status',
        id: 'wamid.out',
        status: 'delivered',
        recipient: '15550101234',
        timestamp: 1756641600,
        receivedAt: '2026-08-31T12:00:00.000Z',
        error: undefined,
        ...overrides
    };
}

describe('Inbox capacity', () => {
    it('rejects a nonsensical capacity', () => {
        expect(() => new Inbox(0)).toThrow(/positive integer/);
        expect(() => new Inbox(-1)).toThrow(/positive integer/);
        expect(() => new Inbox(1.5)).toThrow(/positive integer/);
    });

    it('evicts the oldest events once full', () => {
        const inbox = new Inbox(3);
        for (const id of ['a', 'b', 'c', 'd', 'e']) inbox.add(message({ id }));

        expect(inbox.size).toBe(3);
        // Newest first, and the two oldest are gone.
        expect(inbox.query().map((e) => e.id)).toEqual(['e', 'd', 'c']);
    });

    it('counts evictions so callers can report the gap', () => {
        const inbox = new Inbox(2);
        expect(inbox.dropped).toBe(0);

        for (const id of ['a', 'b', 'c', 'd']) inbox.add(message({ id }));

        expect(inbox.dropped).toBe(2);
    });
});

describe('Inbox.query', () => {
    it('returns newest first', () => {
        const inbox = new Inbox(10);
        inbox.addAll([message({ id: 'first' }), message({ id: 'second' }), message({ id: 'third' })]);

        expect(inbox.query().map((e) => e.id)).toEqual(['third', 'second', 'first']);
    });

    it('returns only messages by default, hiding delivery receipts', () => {
        const inbox = new Inbox(10);
        inbox.addAll([message({ id: 'm' }), status({ id: 's' })]);

        expect(inbox.query().map((e) => e.id)).toEqual(['m']);
    });

    it('returns only statuses when asked', () => {
        const inbox = new Inbox(10);
        inbox.addAll([message({ id: 'm' }), status({ id: 's' })]);

        expect(inbox.query({ kind: 'status' }).map((e) => e.id)).toEqual(['s']);
    });

    it('returns both kinds for "all"', () => {
        const inbox = new Inbox(10);
        inbox.addAll([message({ id: 'm' }), status({ id: 's' })]);

        expect(inbox.query({ kind: 'all' })).toHaveLength(2);
    });

    it('filters messages by sender', () => {
        const inbox = new Inbox(10);
        inbox.addAll([
            message({ id: 'a', from: '15550101234' }),
            message({ id: 'b', from: '15559999999' })
        ]);

        expect(inbox.query({ from: '15550101234' }).map((e) => e.id)).toEqual(['a']);
    });

    it('filters statuses by their recipient, the counterparty in that direction', () => {
        const inbox = new Inbox(10);
        inbox.addAll([
            status({ id: 'a', recipient: '15550101234' }),
            status({ id: 'b', recipient: '15559999999' })
        ]);

        expect(inbox.query({ kind: 'status', from: '15559999999' }).map((e) => e.id)).toEqual(['b']);
    });

    it('filters by receive time, inclusive of the boundary', () => {
        const inbox = new Inbox(10);
        inbox.addAll([
            message({ id: 'old', receivedAt: '2026-08-31T10:00:00.000Z' }),
            message({ id: 'boundary', receivedAt: '2026-08-31T12:00:00.000Z' }),
            message({ id: 'new', receivedAt: '2026-08-31T14:00:00.000Z' })
        ]);

        expect(inbox.query({ since: '2026-08-31T12:00:00.000Z' }).map((e) => e.id)).toEqual(['new', 'boundary']);
    });

    it('rejects an unparseable since value rather than silently returning everything', () => {
        const inbox = new Inbox(10);
        inbox.add(message());

        expect(() => inbox.query({ since: 'last tuesday' })).toThrow(/ISO-8601/);
    });

    it('caps results at the limit, keeping the newest', () => {
        const inbox = new Inbox(10);
        for (const id of ['a', 'b', 'c', 'd']) inbox.add(message({ id }));

        expect(inbox.query({ limit: 2 }).map((e) => e.id)).toEqual(['d', 'c']);
    });

    it('combines filters', () => {
        const inbox = new Inbox(10);
        inbox.addAll([
            message({ id: 'a', from: '111111111', receivedAt: '2026-08-31T10:00:00.000Z' }),
            message({ id: 'b', from: '222222222', receivedAt: '2026-08-31T14:00:00.000Z' }),
            message({ id: 'c', from: '111111111', receivedAt: '2026-08-31T14:00:00.000Z' })
        ]);

        expect(inbox.query({ from: '111111111', since: '2026-08-31T12:00:00.000Z' }).map((e) => e.id)).toEqual(['c']);
    });

    it('returns an empty list when nothing matches', () => {
        const inbox = new Inbox(10);
        inbox.add(message({ from: '111111111' }));

        expect(inbox.query({ from: '999999999' })).toEqual([]);
    });
});

describe('Inbox.clear', () => {
    it('drops all events and resets the eviction count', () => {
        const inbox = new Inbox(2);
        for (const id of ['a', 'b', 'c']) inbox.add(message({ id }));

        inbox.clear();

        expect(inbox.size).toBe(0);
        expect(inbox.dropped).toBe(0);
        expect(inbox.query()).toEqual([]);
    });
});
