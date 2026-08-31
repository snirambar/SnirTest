# CLAUDE.md - AI Assistant Guidelines for SnirTest

This file provides guidance for AI assistants (like Claude) working with this repository.

## Repository Overview

**Repository:** SnirTest
**Owner:** snirambar
**Status:** Active — hosts the WhatsApp MCP connector

A TypeScript MCP server that exposes the Meta WhatsApp Cloud API as tools: sending text, template and media messages, and receiving inbound messages via an embedded webhook listener. See `README.md` for setup and usage.

## Project Structure

```
SnirTest/
├── src/
│   ├── index.ts          # Entry point: config, webhook listener, stdio transport
│   ├── config.ts         # Environment parsing and validation
│   ├── logger.ts         # stderr-only logging with secret redaction
│   ├── inbox.ts          # Bounded in-memory event buffer
│   ├── whatsapp/         # Cloud API client, phone normalization, error mapping
│   ├── webhook/          # HTTP listener, signature verification, payload parsing
│   └── tools/            # MCP tool registrations
├── test/                 # Vitest suite, mirrors src/
├── README.md             # Setup, configuration, and usage
├── .env.example          # Documented environment variables
└── CLAUDE.md             # AI assistant guidelines (this file)
```

## Development Workflow

### Branch Strategy

- **Main branch:** Protected, requires pull requests
- **Feature branches:** Use descriptive names with prefixes:
  - `feature/` - New features
  - `fix/` - Bug fixes
  - `docs/` - Documentation updates
  - `refactor/` - Code refactoring
  - `claude/` - AI-assisted development branches

### Git Conventions

1. **Commit messages:** Use clear, descriptive messages
   - Start with a verb (Add, Fix, Update, Remove, Refactor)
   - Keep the first line under 72 characters
   - Add details in the body if needed

2. **Pull requests:**
   - Provide a clear description of changes
   - Reference any related issues
   - Ensure all tests pass before requesting review

## Code Style Guidelines

- TypeScript, ESM, Node 20+. Four-space indentation, single quotes, semicolons.
- `strict` is on, along with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Build an optional property conditionally (`...(x !== undefined ? { x } : {})`) rather than assigning `undefined` to it.
- Write self-documenting code with meaningful names. Reserve comments for explaining *why* — a non-obvious constraint, a trap being avoided — not what the code does.
- No runtime dependencies beyond the MCP SDK and zod. Use built-in `fetch` and `node:http` rather than adding an HTTP client or web framework.

### Two invariants that will silently break things

- **Never write to stdout.** It is the JSON-RPC channel; a stray `console.log` corrupts the protocol. Use `logger` from `src/logger.ts`, which writes to stderr and masks registered secrets.
- **Verify webhook signatures over raw bytes.** `src/webhook/signature.ts` takes a `Buffer` and must be handed the exact bytes received. Computing the HMAC over a re-serialized object fails whenever key order or whitespace differs from what Meta sent.

## Testing

Vitest, in `test/`, mirroring `src/`. Run with `npm test` (builds first) or `npm run check` (typecheck plus tests).

- `fetch` is stubbed via the helpers in `test/helpers.ts`. No test may reach the network.
- The webhook and lifecycle suites spawn real sockets and processes on ephemeral ports; keep them free of hardcoded ports so parallel runs cannot collide.
- When fixing a bug, add the regression test first — see `test/lifecycle.test.ts`, which guards the stdin-close shutdown path.

## Build & Run

```bash
npm install
npm run build      # tsc -> dist/
npm run check      # typecheck + tests
npm run dev        # tsc --watch
```

Running the server directly needs configuration in the environment; see `.env.example` and the README. `WHATSAPP_WEBHOOK_PORT=0` starts it in send-only mode, which is the quickest way to exercise it without a tunnel.

## AI Assistant Instructions

When working with this repository, AI assistants should:

### Do

- Read existing code before making modifications
- Follow established patterns and conventions in the codebase
- Write clean, maintainable code
- Make focused, atomic commits
- Update documentation when making significant changes
- Run tests before committing (when available)
- Ask for clarification when requirements are ambiguous

### Don't

- Over-engineer solutions beyond what's requested
- Add unnecessary dependencies
- Make changes unrelated to the current task
- Skip reading files before editing them
- Commit sensitive information (API keys, credentials, etc.)
- Force push to shared branches
- Create files unnecessarily when editing existing ones works

### Security Considerations

- Never commit secrets, API keys, or credentials
- Validate and sanitize user inputs
- Be aware of OWASP top 10 vulnerabilities
- Use parameterized queries for database operations
- Escape output appropriately to prevent XSS

## Common Tasks

### Adding a New Feature

1. Create a feature branch from main
2. Implement the feature with tests
3. Update relevant documentation
4. Create a pull request with clear description

### Fixing a Bug

1. Identify and understand the root cause
2. Create a fix branch
3. Write a test that reproduces the bug
4. Implement the fix
5. Verify all tests pass
6. Create a pull request

## Environment Setup

Node.js 20 or later, then `npm install`. All configuration comes from environment variables — copy `.env.example` to `.env` and fill it in. `.env` is gitignored; never commit real credentials.

Receiving messages additionally requires a Meta Business account, a Meta App with the WhatsApp product, and a public HTTPS URL (a `cloudflared` or `ngrok` tunnel in development). The README covers registering the callback URL.

## Dependencies

Runtime:

- `@modelcontextprotocol/server` (v2) — MCP server and stdio transport
- `zod` (v4) — tool input schemas and environment validation

Development: `typescript`, `vitest`, `@types/node`.

Keep this list short. Prefer Node built-ins over new packages.

## Additional Resources

- [WhatsApp Cloud API docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Graph API changelog](https://developers.facebook.com/docs/graph-api/changelog) — check here when the default API version ages out
- [Model Context Protocol](https://modelcontextprotocol.io)

---

*Last updated: 2026-08-31*
