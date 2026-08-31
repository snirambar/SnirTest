import type { InboundMessage, InboxEvent, StatusUpdate } from './whatsapp/types.js';

export interface InboxQuery {
    /** Only events involving this number (E.164 digits). */
    readonly from?: string;
    /** Only events received at or after this ISO-8601 instant. */
    readonly since?: string;
    /** Newest-first cap on returned events. */
    readonly limit?: number;
    /** Which event kinds to include. Defaults to messages only. */
    readonly kind?: 'message' | 'status' | 'all';
}

/**
 * A bounded, in-memory store of inbound webhook events.
 *
 * Deliberately not persistent: this pass keeps everything in one process, so
 * the buffer is lost when the MCP client stops the server. Capacity is capped
 * so a busy number cannot grow the process without bound. This class is the
 * seam a SQLite-backed store would replace.
 */
export class Inbox {
    private readonly events: InboxEvent[] = [];
    private readonly capacity: number;
    private droppedCount = 0;

    constructor(capacity: number) {
        if (!Number.isInteger(capacity) || capacity < 1) {
            throw new Error(`Inbox capacity must be a positive integer, got ${capacity}`);
        }
        this.capacity = capacity;
    }

    /** Appends an event, evicting the oldest once at capacity. */
    add(event: InboxEvent): void {
        this.events.push(event);
        while (this.events.length > this.capacity) {
            this.events.shift();
            this.droppedCount += 1;
        }
    }

    addAll(events: readonly InboxEvent[]): void {
        for (const event of events) this.add(event);
    }

    /** Number of events evicted for capacity, so callers can report gaps. */
    get dropped(): number {
        return this.droppedCount;
    }

    get size(): number {
        return this.events.length;
    }

    /** Returns matching events, newest first. */
    query(options: InboxQuery = {}): InboxEvent[] {
        const kind = options.kind ?? 'message';
        const sinceMs = options.since === undefined ? undefined : Date.parse(options.since);
        if (sinceMs !== undefined && Number.isNaN(sinceMs)) {
            throw new Error(`Invalid "since" timestamp: ${options.since}. Expected an ISO-8601 instant.`);
        }

        const matches = this.events.filter((event) => {
            if (kind !== 'all' && event.kind !== kind) return false;
            if (sinceMs !== undefined && Date.parse(event.receivedAt) < sinceMs) return false;
            if (options.from !== undefined) {
                const counterparty = event.kind === 'message' ? event.from : event.recipient;
                if (counterparty !== options.from) return false;
            }
            return true;
        });

        matches.reverse();
        return options.limit === undefined ? matches : matches.slice(0, options.limit);
    }

    clear(): void {
        this.events.length = 0;
        this.droppedCount = 0;
    }
}

export type { InboundMessage, InboxEvent, StatusUpdate };
