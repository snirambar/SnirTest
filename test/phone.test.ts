import { describe, expect, it } from 'vitest';
import { InvalidPhoneNumberError, normalizePhoneNumber } from '../src/whatsapp/phone.js';

describe('normalizePhoneNumber', () => {
    it.each([
        ['+15550101234', '15550101234'],
        ['15550101234', '15550101234'],
        ['+1 (555) 010-1234', '15550101234'],
        ['+1.555.010.1234', '15550101234'],
        ['  +15550101234  ', '15550101234'],
        ['+972 50 123 4567', '972501234567']
    ])('normalizes %s to %s', (input, expected) => {
        expect(normalizePhoneNumber(input)).toBe(expected);
    });

    it('rejects an empty value', () => {
        expect(() => normalizePhoneNumber('   ')).toThrow(InvalidPhoneNumberError);
    });

    it('rejects letters', () => {
        expect(() => normalizePhoneNumber('+1555CALLNOW')).toThrow(/digits only/);
    });

    it('rejects a number that is too short to be routable', () => {
        expect(() => normalizePhoneNumber('+123')).toThrow(/digits including the country code/);
    });

    it('rejects a number longer than E.164 permits', () => {
        expect(() => normalizePhoneNumber('+1234567890123456')).toThrow(/digits including the country code/);
    });

    it('rejects a national trunk prefix, which would reach the wrong person', () => {
        expect(() => normalizePhoneNumber('0501234567')).toThrow(/national trunk prefix/);
    });

    it('names the offending input in the error message', () => {
        expect(() => normalizePhoneNumber('nope')).toThrow(/"nope"/);
    });
});
