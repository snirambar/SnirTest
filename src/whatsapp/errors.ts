import type { GraphErrorBody } from './types.js';

/**
 * An error returned by the Graph API, carrying Meta's own codes.
 *
 * The message is written for whoever reads the tool result — usually a model
 * deciding what to do next — so it says what to do, not just what broke.
 */
export class WhatsAppApiError extends Error {
    readonly status: number;
    readonly code: number | undefined;
    readonly subcode: number | undefined;
    readonly fbtraceId: string | undefined;

    constructor(status: number, body: GraphErrorBody | undefined) {
        super(buildMessage(status, body));
        this.name = 'WhatsAppApiError';
        this.status = status;
        this.code = body?.code;
        this.subcode = body?.error_subcode;
        this.fbtraceId = body?.fbtrace_id;
    }
}

/**
 * Guidance for the Meta error codes that are actually actionable.
 *
 * 131047 is the one that matters most in practice: WhatsApp only permits
 * free-form messages within 24 hours of the user's last message. Outside that
 * window a plain-text send fails and an approved template is the only way
 * through. Without this hint the failure looks like a generic API error and
 * invites pointless retries of the same doomed call.
 */
const GUIDANCE: Record<number, string> = {
    131047:
        'Outside the 24-hour customer service window. WhatsApp only allows free-form messages within 24 hours of the recipient\'s last message. Use whatsapp_send_template with an approved template instead.',
    131026:
        'Message undeliverable. The number may not be a registered WhatsApp user, or it cannot receive messages from this business.',
    131051: 'Unsupported message type for this endpoint.',
    132000: 'Template parameter count does not match the approved template definition.',
    132001: 'Template does not exist in this WhatsApp Business Account, or the language code does not match.',
    132005: 'Translated template content is too long for one or more parameters.',
    132007: 'Template content violates WhatsApp policy and was rejected.',
    131056: 'Too many messages sent to this number in a short period. Slow down and retry later.',
    130429: 'Rate limit reached for this phone number. Retry after a short delay.',
    133010: 'Phone number is not registered with the Cloud API.',
    100: 'Invalid parameter. Check the phone number ID, recipient format, and request fields.',
    190: 'Access token is invalid or expired. Generate a new token and update WHATSAPP_ACCESS_TOKEN.',
    10: 'Permission denied. The token is missing the whatsapp_business_messaging permission.',
    200: 'Permission denied. The token lacks access to this WhatsApp Business Account.',
    368: 'The account is temporarily blocked for policy violations.'
};

function buildMessage(status: number, body: GraphErrorBody | undefined): string {
    const parts: string[] = [];
    const code = body?.code;

    parts.push(`WhatsApp Cloud API request failed (HTTP ${status}`);
    parts.push(code === undefined ? ').' : `, code ${code}).`);

    const detail = body?.error_data?.details ?? body?.message;
    if (detail) parts.push(` ${detail}`);

    const guidance = code === undefined ? undefined : GUIDANCE[code];
    if (guidance) {
        parts.push(` ${guidance}`);
    } else if (status === 401 || status === 403) {
        // Auth failures without a recognized code are almost always the token.
        parts.push(' Check that WHATSAPP_ACCESS_TOKEN is valid and has the whatsapp_business_messaging permission.');
    }

    if (body?.fbtrace_id) parts.push(` (fbtrace_id: ${body.fbtrace_id})`);

    return parts.join('');
}
