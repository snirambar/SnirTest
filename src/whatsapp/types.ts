/** Media kinds the Cloud API accepts as a message type. */
export type MediaType = 'image' | 'document' | 'audio' | 'video' | 'sticker';

/** A media reference is either a publicly reachable link or an uploaded media ID. */
export type MediaSource = { readonly link: string } | { readonly id: string };

/** Successful send response: Meta echoes the recipient and assigns a message ID. */
export interface SendResult {
    readonly messageId: string;
    readonly to: string;
}

/** Shape of the `error` object Meta returns on a failed Graph API call. */
export interface GraphErrorBody {
    readonly message?: string;
    readonly type?: string;
    readonly code?: number;
    readonly error_subcode?: number;
    readonly error_data?: { readonly details?: string };
    readonly fbtrace_id?: string;
}

/**
 * A template component, passed through to the API as-is.
 *
 * Optional fields explicitly admit `undefined` because these objects arrive
 * from zod-parsed tool input, where an omitted key is present as `undefined`.
 */
export interface TemplateComponent {
    readonly type: string;
    readonly sub_type?: string | undefined;
    readonly index?: string | undefined;
    readonly parameters?: readonly unknown[] | undefined;
}

/** An inbound message, normalized from a webhook payload. */
export interface InboundMessage {
    readonly kind: 'message';
    /** Meta's message ID (`wamid...`), used for mark-as-read and replies. */
    readonly id: string;
    /** Sender in E.164 digits. */
    readonly from: string;
    /** Business phone number that received it. */
    readonly to: string | undefined;
    /** Sender's WhatsApp profile name, when the payload includes it. */
    readonly senderName: string | undefined;
    /** Message type as reported by Meta: `text`, `image`, `audio`, ... */
    readonly type: string;
    /** Text body for text messages, or the caption for captioned media. */
    readonly text: string | undefined;
    /** Media ID for media messages, resolvable via `whatsapp_get_media_url`. */
    readonly mediaId: string | undefined;
    /** ID of the message this one replies to, when it is a reply. */
    readonly replyToId: string | undefined;
    /** Unix seconds, as sent by Meta. */
    readonly timestamp: number;
    /** When this server received it — reliable even if Meta's clock is skewed. */
    readonly receivedAt: string;
}

/** A delivery-status update for a message this server sent. */
export interface StatusUpdate {
    readonly kind: 'status';
    readonly id: string;
    readonly status: string;
    readonly recipient: string | undefined;
    readonly timestamp: number;
    readonly receivedAt: string;
    /** Populated when the status is `failed`. */
    readonly error: string | undefined;
}

export type InboxEvent = InboundMessage | StatusUpdate;
