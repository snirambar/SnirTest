import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { computeSignature, verifySignature } from '../src/webhook/signature.js';

const SECRET = 'test-app-secret-value';
const BODY = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }), 'utf8');

function sign(body: Buffer, secret = SECRET): string {
    return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('computeSignature', () => {
    it('matches an independently computed HMAC-SHA256 digest', () => {
        expect(computeSignature(BODY, SECRET)).toBe(sign(BODY));
    });

    it('produces the sha256= prefixed hex form Meta sends', () => {
        expect(computeSignature(BODY, SECRET)).toMatch(/^sha256=[0-9a-f]{64}$/);
    });
});

describe('verifySignature', () => {
    it('accepts a correctly signed body', () => {
        expect(verifySignature(BODY, sign(BODY), SECRET)).toBe(true);
    });

    it('rejects a body modified after signing', () => {
        const signature = sign(BODY);
        const tampered = Buffer.from(JSON.stringify({ object: 'evil', entry: [] }), 'utf8');
        expect(verifySignature(tampered, signature, SECRET)).toBe(false);
    });

    it('rejects a signature made with a different secret', () => {
        expect(verifySignature(BODY, sign(BODY, 'wrong-secret-value'), SECRET)).toBe(false);
    });

    it('rejects a missing header', () => {
        expect(verifySignature(BODY, undefined, SECRET)).toBe(false);
    });

    it('rejects a header without the sha256= prefix', () => {
        expect(verifySignature(BODY, sign(BODY).replace('sha256=', ''), SECRET)).toBe(false);
    });

    it('rejects a sha1 style header', () => {
        expect(verifySignature(BODY, 'sha1=abcdef', SECRET)).toBe(false);
    });

    it('rejects an array-valued header', () => {
        // Node exposes repeated headers as arrays; that is never valid here.
        expect(verifySignature(BODY, [sign(BODY), sign(BODY)], SECRET)).toBe(false);
    });

    it('rejects a truncated signature without throwing on length mismatch', () => {
        expect(() => verifySignature(BODY, sign(BODY).slice(0, 20), SECRET)).not.toThrow();
        expect(verifySignature(BODY, sign(BODY).slice(0, 20), SECRET)).toBe(false);
    });

    it('verifies against the exact bytes received, not a re-serialization', () => {
        // The guard against the classic bug: Meta signs the bytes on the wire.
        // Parsing and re-stringifying this payload reorders nothing but does
        // drop the whitespace, producing a different digest. Verification must
        // use the original buffer.
        const wireBytes = Buffer.from('{"object":"whatsapp_business_account",  "entry":[]}', 'utf8');
        const signature = sign(wireBytes);

        expect(verifySignature(wireBytes, signature, SECRET)).toBe(true);

        const reserialized = Buffer.from(JSON.stringify(JSON.parse(wireBytes.toString('utf8'))), 'utf8');
        expect(reserialized.equals(wireBytes)).toBe(false);
        expect(verifySignature(reserialized, signature, SECRET)).toBe(false);
    });

    it('verifies bodies containing non-ASCII characters byte-for-byte', () => {
        const body = Buffer.from(JSON.stringify({ text: 'שלום 👋 café' }), 'utf8');
        expect(verifySignature(body, sign(body), SECRET)).toBe(true);
    });
});
