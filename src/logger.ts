/**
 * Logging for a stdio MCP server.
 *
 * stdout is the JSON-RPC channel. Anything written there that is not a
 * protocol frame corrupts the stream and breaks the connection in ways that
 * are hard to diagnose from the client side, so every log line goes to
 * stderr. This module exists so that no call site has to remember that.
 */

/** Values that must never reach a log line, populated at config load. */
const secrets = new Set<string>();

/**
 * Registers a secret so it is masked wherever it appears in log output.
 * Short values are ignored: masking a 3-character string would redact
 * unrelated text all over the place.
 */
export function registerSecret(value: string | undefined): void {
    if (value && value.length >= 8) {
        secrets.add(value);
    }
}

/** Replaces every registered secret in a string with a fixed placeholder. */
export function redact(text: string): string {
    let out = text;
    for (const secret of secrets) {
        out = out.split(secret).join('[REDACTED]');
    }
    return out;
}

function format(level: string, message: string, detail?: unknown): string {
    const parts = [`[${new Date().toISOString()}] ${level} ${message}`];
    if (detail !== undefined) {
        parts.push(typeof detail === 'string' ? detail : safeStringify(detail));
    }
    return redact(parts.join(' '));
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
}

function write(line: string): void {
    process.stderr.write(`${line}\n`);
}

export const logger = {
    info(message: string, detail?: unknown): void {
        write(format('INFO', message, detail));
    },
    warn(message: string, detail?: unknown): void {
        write(format('WARN', message, detail));
    },
    error(message: string, detail?: unknown): void {
        write(format('ERROR', message, detail));
    }
};

/** Test seam: clears registered secrets between cases. */
export function resetSecrets(): void {
    secrets.clear();
}
