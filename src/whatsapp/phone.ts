/**
 * Recipient normalization.
 *
 * The Cloud API expects a phone number in E.164 *digits only* — no leading
 * `+`, no spaces, dashes, parentheses or dots. Meta rejects anything else, so
 * every recipient passes through here exactly once, in the client, rather than
 * relying on each tool to format correctly.
 */

/** Loosest plausible E.164 bounds: a country code plus 4-14 subscriber digits. */
const MIN_DIGITS = 5;
const MAX_DIGITS = 15;

export class InvalidPhoneNumberError extends Error {
    constructor(input: string, reason: string) {
        super(`Invalid recipient phone number ${JSON.stringify(input)}: ${reason}`);
        this.name = 'InvalidPhoneNumberError';
    }
}

/**
 * Strips formatting and validates a phone number, returning E.164 digits.
 *
 * Accepts the shapes people actually paste — `+1 (555) 010-1234`,
 * `+15550101234`, `15550101234` — and rejects anything that could not be a
 * real number rather than letting Meta return an opaque error later.
 */
export function normalizePhoneNumber(input: string): string {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        throw new InvalidPhoneNumberError(input, 'value is empty');
    }

    // A leading "+" is the only non-digit with meaning, and it is dropped.
    const body = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
    const digits = body.replace(/[\s().-]/g, '');

    if (!/^\d+$/.test(digits)) {
        throw new InvalidPhoneNumberError(
            input,
            'expected digits only, optionally with a leading "+" and spaces, dashes, dots or parentheses'
        );
    }
    if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
        throw new InvalidPhoneNumberError(
            input,
            `expected ${MIN_DIGITS}-${MAX_DIGITS} digits including the country code, got ${digits.length}`
        );
    }
    // A number written for domestic dialling ("0501234567") is missing its
    // country code; sending it would silently reach the wrong person.
    if (digits.startsWith('0')) {
        throw new InvalidPhoneNumberError(
            input,
            'number starts with 0, which suggests a national trunk prefix. Use full international format including the country code'
        );
    }

    return digits;
}
