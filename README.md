# WhatsApp MCP Connector

An [MCP](https://modelcontextprotocol.io) server that gives Claude a two-way WhatsApp channel over the official [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api). It sends text, template and media messages, and receives inbound messages through an embedded webhook listener.

## Requirements

- Node.js 20 or later
- A Meta Business account with a WhatsApp Business phone number
- A Meta App with the WhatsApp product added

## Install

```bash
npm install
npm run build
```

## Configure

Copy `.env.example` to `.env` and fill it in. Everything is supplied through environment variables; nothing secret is read from or written to disk by the server.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | yes | — | Access token with the `whatsapp_business_messaging` permission |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | — | Numeric ID of the sending number (not the number itself) |
| `WHATSAPP_APP_SECRET` | to receive | — | Verifies the HMAC signature on inbound webhooks |
| `WHATSAPP_VERIFY_TOKEN` | to receive | — | A string you choose; must match the Meta dashboard |
| `WHATSAPP_GRAPH_API_VERSION` | no | `v21.0` | Graph API version |
| `WHATSAPP_WEBHOOK_PORT` | no | `3000` | Listener port; `0` disables receiving |
| `WHATSAPP_WEBHOOK_HOST` | no | `127.0.0.1` | Interface to bind |
| `WHATSAPP_WEBHOOK_PATH` | no | `/webhook` | Path the listener serves |
| `WHATSAPP_ALLOWED_RECIPIENTS` | no | — | Comma-separated allowlist; sends elsewhere are refused |
| `WHATSAPP_INBOX_SIZE` | no | `500` | In-memory event capacity |

Configuration is validated at startup, so a missing or malformed value fails immediately with a message naming the variable rather than surfacing later as an opaque API error.

> **The default Graph API version will age out.** Meta ships new versions regularly and retires old ones. `WHATSAPP_GRAPH_API_VERSION` exists so that requires a config change, not a release — check [Meta's changelog](https://developers.facebook.com/docs/graph-api/changelog) if calls start failing.

### Use the allowlist while developing

Set `WHATSAPP_ALLOWED_RECIPIENTS` to your own number before pointing this at a live business number. It is enforced inside the API client, so every tool is covered, and a wrong number in a tool call is refused locally instead of reaching a real person.

## Connect it to Claude

Add the server to your MCP client config — `claude_desktop_config.json` for Claude Desktop, or `.mcp.json` for Claude Code:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/absolute/path/to/SnirTest/dist/index.js"],
      "env": {
        "WHATSAPP_ACCESS_TOKEN": "your-token",
        "WHATSAPP_PHONE_NUMBER_ID": "your-phone-number-id",
        "WHATSAPP_APP_SECRET": "your-app-secret",
        "WHATSAPP_VERIFY_TOKEN": "your-verify-token",
        "WHATSAPP_ALLOWED_RECIPIENTS": "+15550101234"
      }
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `whatsapp_send_text` | Send a free-form text message (subject to the 24-hour window, below) |
| `whatsapp_send_template` | Send a pre-approved template — the only way to start a conversation |
| `whatsapp_send_media` | Send an image, document, audio, video or sticker by URL or media ID |
| `whatsapp_mark_read` | Mark a received message as read |
| `whatsapp_list_messages` | List received messages and delivery statuses, newest first |
| `whatsapp_get_media_url` | Resolve a media ID to a temporary download URL |

### The 24-hour customer service window

WhatsApp only permits free-form messages within 24 hours of the recipient's most recent message. Outside that window a text send fails with error `131047`, and an approved template is the only way through. The connector detects this specific error and says so in the tool result, so the model can switch to `whatsapp_send_template` rather than retrying a call that cannot succeed.

## Receiving messages

Inbound messages arrive as webhooks, which means Meta needs a public HTTPS URL to POST to. The listener binds to loopback and expects something in front of it.

**1. Expose the port.** In development, use a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
# or: ngrok http 3000
```

**2. Register the callback.** In the Meta App dashboard, under **WhatsApp → Configuration → Webhook**, set:

- **Callback URL** — `https://your-tunnel-domain/webhook`
- **Verify token** — the same value as `WHATSAPP_VERIFY_TOKEN`

Meta immediately calls the URL to verify it; the server echoes the challenge and the dashboard confirms. Then subscribe to the **`messages`** field.

**3. Read them.** Inbound messages become available through `whatsapp_list_messages`.

### Two limitations worth knowing

Both follow from keeping everything in one process, and both are fixable by moving the inbox to a persistent store:

- **Messages are only captured while the server is running.** An MCP client starts and stops the server with the session, and the listener only runs in between. This is not a full conversation history from WhatsApp.
- **The buffer is in memory.** It holds `WHATSAPP_INBOX_SIZE` events, evicts oldest-first beyond that, and is lost on restart.

If you need durable history, replace the `Inbox` class in `src/inbox.ts` with a SQLite-backed implementation — it is the only module that would change, and a separate long-running webhook process could then write to the same store.

## Security

- **Every inbound webhook is signature-verified.** The HMAC-SHA256 is computed over the raw request bytes, before any JSON parsing, and compared in constant time. Unsigned or mis-signed requests get a `401` and are never stored.
- **Credentials never reach the logs.** The token, app secret and verify token are registered with the logger at startup and masked wherever they would appear.
- **All logging goes to stderr.** stdout is the JSON-RPC channel; a stray write there corrupts the protocol.
- **Bind loopback, terminate TLS upstream.** The default host is `127.0.0.1`. If you set `WHATSAPP_WEBHOOK_HOST=0.0.0.0`, put a TLS-terminating proxy in front of it.

## Development

```bash
npm run typecheck   # type-check sources and tests
npm test            # build, then run the suite
npm run check       # both
npm run dev         # tsc --watch
```

The suite covers signature verification (including a case that fails if the HMAC is ever computed over a re-serialized body), the verification handshake, request building for every message type, phone normalization, allowlist enforcement, Meta error mapping, inbox eviction and filtering, config validation, and process lifecycle. `fetch` is stubbed throughout — no test reaches the network.

### Testing the webhook without Meta

Sign a payload with your own app secret and post it to the listener:

```bash
BODY='{"object":"whatsapp_business_account","entry":[{"changes":[{"field":"messages","value":{"metadata":{"display_phone_number":"15550009999"},"contacts":[{"profile":{"name":"Ada"},"wa_id":"15550101234"}],"messages":[{"from":"15550101234","id":"wamid.TEST","timestamp":"1756641600","type":"text","text":{"body":"hello"}}]}}]}]}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | awk '{print $NF}')"

curl -i -X POST http://localhost:3000/webhook \
  -H 'Content-Type: application/json' \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$BODY"
```

Expect `200`. Corrupt the signature and expect `401`. `GET /health` reports the listener state and how many events are buffered.

## Project layout

```
src/
  index.ts            entry point: config, webhook listener, stdio transport
  config.ts           env parsing and validation
  logger.ts           stderr-only logging with secret redaction
  inbox.ts            bounded in-memory event buffer
  whatsapp/
    client.ts         Cloud API client; enforces the allowlist
    phone.ts          E.164 normalization
    errors.ts         Meta error code to actionable message
    types.ts          message and event types
  webhook/
    server.ts         HTTP listener: verification handshake and receive
    signature.ts      HMAC-SHA256 verification over raw bytes
    parse.ts          webhook payload to normalized events
  tools/index.ts      MCP tool registrations
```
