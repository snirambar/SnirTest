import { createHmac, timingSafeEqual } from 'node:crypto';

const HEADER = 'x-hub-signature-256';
const PREFIX = 'sha256=';

export const SIGNATURE_HEADER = HEADER;

/**
 * Computes the `X-Hub-Signature-256` value Meta sends for a payload.
 *
 * Takes the **raw bytes**, never a parsed object. Re-serializing a parsed
 * payload produces different bytes whenever key order, unicode escaping or
 * whitespace differ from what Meta actually sent, and the HMAC then never
 * matches. This is the single most common way this integration breaks, so the
 * signature is computed over a Buffer and nothing else.
 */
export function computeSignature(rawBody: Buffer, appSecret: string): string {
    return PREFIX + createHmac('sha256', appSecret).update(rawBody).digest('hex');
}

/**
 * Verifies a webhook signature header against the raw request body.
 *
 * Comparison is constant-time, so a caller cannot learn the expected digest by
 * timing repeated requests.
 */
export function verifySignature(
    rawBody: Buffer,
    signatureHeader: string | string[] | undefined,
    appSecret: string
): boolean {
    if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith(PREFIX)) {
        return false;
    }

    const expected = Buffer.from(computeSignature(rawBody, appSecret), 'utf8');
    const received = Buffer.from(signatureHeader, 'utf8');

    // timingSafeEqual throws on a length mismatch, which would itself leak
    // length via the error path — check first and return the same false.
    if (expected.length !== received.length) {
        return false;
    }
    return timingSafeEqual(expected, received);
}
