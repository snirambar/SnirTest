import { describe, expect, it } from 'vitest';
import { RecipientNotAllowedError, WhatsAppClient } from '../src/whatsapp/client.js';
import { WhatsAppApiError } from '../src/whatsapp/errors.js';
import { makeConfig, stubFetch } from './helpers.js';

const OK_SEND = { body: { messages: [{ id: 'wamid.OK' }] } };

describe('WhatsAppClient.sendText', () => {
    it('posts to the versioned messages endpoint for the configured phone number', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig({ graphApiVersion: 'v22.0', phoneNumberId: '999' }), fetch);

        await client.sendText({ to: '+15550101234', body: 'hi' });

        expect(calls[0]?.url).toBe('https://graph.facebook.com/v22.0/999/messages');
        expect(calls[0]?.init?.method).toBe('POST');
    });

    it('sends the bearer token and JSON content type', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.sendText({ to: '+15550101234', body: 'hi' });

        const headers = calls[0]?.init?.headers as Record<string, string>;
        expect(headers['Authorization']).toBe('Bearer test-access-token');
        expect(headers['Content-Type']).toBe('application/json');
    });

    it('builds the documented text payload with a normalized recipient', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.sendText({ to: '+1 (555) 010-1234', body: 'hello there' });

        expect(calls[0]?.body).toEqual({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '15550101234',
            type: 'text',
            text: { body: 'hello there', preview_url: false }
        });
    });

    it('defaults preview_url to false and honours it when set', async () => {
        const { fetch, calls } = stubFetch([OK_SEND, OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.sendText({ to: '15550101234', body: 'a' });
        await client.sendText({ to: '15550101234', body: 'b', previewUrl: true });

        expect((calls[0]?.body?.['text'] as Record<string, unknown>)['preview_url']).toBe(false);
        expect((calls[1]?.body?.['text'] as Record<string, unknown>)['preview_url']).toBe(true);
    });

    it('adds a context object when replying to a message', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.sendText({ to: '15550101234', body: 'reply', replyToMessageId: 'wamid.ORIGINAL' });

        expect(calls[0]?.body?.['context']).toEqual({ message_id: 'wamid.ORIGINAL' });
    });

    it('omits the context object when not replying', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.sendText({ to: '15550101234', body: 'plain' });

        expect(calls[0]?.body).not.toHaveProperty('context');
    });

    it('returns the assigned message ID', async () => {
        const { fetch } = stubFetch([{ body: { messages: [{ id: 'wamid.ASSIGNED' }] } }]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await expect(client.sendText({ to: '15550101234', body: 'hi' })).resolves.toEqual({
            messageId: 'wamid.ASSIGNED',
            to: '15550101234'
        });
    });

    it('fails clearly when the API returns no message ID', async () => {
        const { fetch } = stubFetch([{ body: { messages: [] } }]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await expect(client.sendText({ to: '15550101234', body: 'hi' })).rejects.toThrow(/no message ID/);
    });
});

describe('WhatsAppClient.sendTemplate', () => {
    it('builds the template payload', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.sendTemplate({ to: '15550101234', templateName: 'hello_world', languageCode: 'en_US' });

        expect(calls[0]?.body).toEqual({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '15550101234',
            type: 'template',
            template: { name: 'hello_world', language: { code: 'en_US' } }
        });
    });

    it('includes components when provided and omits the key when empty', async () => {
        const { fetch, calls } = stubFetch([OK_SEND, OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);
        const components = [{ type: 'body', parameters: [{ type: 'text', text: 'Ada' }] }];

        await client.sendTemplate({ to: '15550101234', templateName: 't', languageCode: 'en', components });
        await client.sendTemplate({ to: '15550101234', templateName: 't', languageCode: 'en', components: [] });

        expect((calls[0]?.body?.['template'] as Record<string, unknown>)['components']).toEqual(components);
        expect(calls[1]?.body?.['template']).not.toHaveProperty('components');
    });
});

describe('WhatsAppClient.sendMedia', () => {
    it('nests the media object under a key named for the media type', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.sendMedia({
            to: '15550101234',
            mediaType: 'image',
            source: { link: 'https://example.com/a.png' },
            caption: 'a picture'
        });

        expect(calls[0]?.body).toEqual({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '15550101234',
            type: 'image',
            image: { link: 'https://example.com/a.png', caption: 'a picture' }
        });
    });

    it('sends media by uploaded ID', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.sendMedia({ to: '15550101234', mediaType: 'video', source: { id: 'media-123' } });

        expect(calls[0]?.body?.['video']).toEqual({ id: 'media-123' });
    });

    it('attaches a filename to documents', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.sendMedia({
            to: '15550101234',
            mediaType: 'document',
            source: { link: 'https://example.com/a.pdf' },
            filename: 'report.pdf'
        });

        expect((calls[0]?.body?.['document'] as Record<string, unknown>)['filename']).toBe('report.pdf');
    });

    it('refuses a filename on non-documents rather than dropping it silently', async () => {
        const { fetch } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await expect(
            client.sendMedia({
                to: '15550101234',
                mediaType: 'image',
                source: { link: 'https://example.com/a.png' },
                filename: 'nope.png'
            })
        ).rejects.toThrow(/only to document messages/);
    });

    it.each(['audio', 'sticker'] as const)('refuses a caption on %s, which WhatsApp would ignore', async (type) => {
        const { fetch } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await expect(
            client.sendMedia({ to: '15550101234', mediaType: type, source: { id: 'm' }, caption: 'x' })
        ).rejects.toThrow(/does not support captions/);
    });
});

describe('WhatsAppClient.markAsRead', () => {
    it('posts the read status payload', async () => {
        const { fetch, calls } = stubFetch([{ body: { success: true } }]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await client.markAsRead('wamid.INBOUND');

        expect(calls[0]?.body).toEqual({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: 'wamid.INBOUND'
        });
    });
});

describe('WhatsAppClient.getMediaUrl', () => {
    it('GETs the media node and returns the download URL with metadata', async () => {
        const { fetch, calls } = stubFetch([
            { body: { url: 'https://lookaside.fbsbx.com/x', mime_type: 'image/jpeg', file_size: 2048 } }
        ]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        const media = await client.getMediaUrl('media-abc');

        expect(calls[0]?.url).toBe('https://graph.facebook.com/v21.0/media-abc');
        expect(calls[0]?.init?.method).toBe('GET');
        expect(media).toEqual({ url: 'https://lookaside.fbsbx.com/x', mimeType: 'image/jpeg', fileSize: 2048 });
    });

    it('fails clearly when no URL comes back', async () => {
        const { fetch } = stubFetch([{ body: {} }]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await expect(client.getMediaUrl('media-abc')).rejects.toThrow(/No download URL/);
    });
});

describe('recipient allowlist', () => {
    it('permits any recipient when unset', async () => {
        const { fetch } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig({ allowedRecipients: undefined }), fetch);

        await expect(client.sendText({ to: '15559999999', body: 'hi' })).resolves.toBeDefined();
    });

    it('permits a listed recipient', async () => {
        const { fetch } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig({ allowedRecipients: ['15550101234'] }), fetch);

        await expect(client.sendText({ to: '+1 555 010 1234', body: 'hi' })).resolves.toBeDefined();
    });

    it('refuses an unlisted recipient without calling the API', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const client = new WhatsAppClient(makeConfig({ allowedRecipients: ['15550101234'] }), fetch);

        await expect(client.sendText({ to: '15559999999', body: 'hi' })).rejects.toThrow(RecipientNotAllowedError);
        expect(calls).toHaveLength(0);
    });

    it('guards templates and media too, not just text', async () => {
        const { fetch, calls } = stubFetch([OK_SEND]);
        const config = makeConfig({ allowedRecipients: ['15550101234'] });
        const client = new WhatsAppClient(config, fetch);

        await expect(
            client.sendTemplate({ to: '15559999999', templateName: 't', languageCode: 'en' })
        ).rejects.toThrow(RecipientNotAllowedError);
        await expect(
            client.sendMedia({ to: '15559999999', mediaType: 'image', source: { id: 'm' } })
        ).rejects.toThrow(RecipientNotAllowedError);
        expect(calls).toHaveLength(0);
    });
});

describe('error handling', () => {
    it('maps error 131047 to the 24-hour window guidance', async () => {
        const { fetch } = stubFetch([
            {
                status: 400,
                body: {
                    error: {
                        message: 'Message failed to send',
                        code: 131047,
                        error_data: { details: 'Message failed to send because more than 24 hours have passed.' },
                        fbtrace_id: 'trace-1'
                    }
                }
            }
        ]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        const error = await client.sendText({ to: '15550101234', body: 'hi' }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(WhatsAppApiError);
        const message = (error as Error).message;
        expect(message).toContain('24 hours have passed');
        expect(message).toContain('whatsapp_send_template');
        expect(message).toContain('trace-1');
        expect((error as WhatsAppApiError).code).toBe(131047);
    });

    it('maps an expired token to token-replacement guidance', async () => {
        const { fetch } = stubFetch([
            { status: 401, body: { error: { message: 'Invalid OAuth access token', code: 190 } } }
        ]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await expect(client.sendText({ to: '15550101234', body: 'hi' })).rejects.toThrow(
            /WHATSAPP_ACCESS_TOKEN/
        );
    });

    it('falls back to auth guidance for an unrecognized 403', async () => {
        const { fetch } = stubFetch([{ status: 403, body: { error: { message: 'Forbidden', code: 99999 } } }]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await expect(client.sendText({ to: '15550101234', body: 'hi' })).rejects.toThrow(
            /whatsapp_business_messaging/
        );
    });

    it('never leaks the access token in an error message', async () => {
        const { fetch } = stubFetch([{ status: 401, body: { error: { message: 'bad token', code: 190 } } }]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        const error = await client.sendText({ to: '15550101234', body: 'hi' }).catch((e: unknown) => e);

        expect((error as Error).message).not.toContain('test-access-token');
    });

    it('distinguishes a transport failure from an API rejection', async () => {
        const { fetch } = stubFetch([new TypeError('fetch failed')]);
        const client = new WhatsAppClient(makeConfig(), fetch);

        await expect(client.sendText({ to: '15550101234', body: 'hi' })).rejects.toThrow(
            /Could not reach the WhatsApp Cloud API/
        );
    });
});
