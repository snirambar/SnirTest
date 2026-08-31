import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ENTRY = fileURLToPath(new URL('../dist/index.js', import.meta.url));

const ENV = {
    ...process.env,
    WHATSAPP_ACCESS_TOKEN: 'lifecycle-test-token',
    WHATSAPP_PHONE_NUMBER_ID: '1234567890',
    WHATSAPP_APP_SECRET: 'lifecycle-app-secret',
    WHATSAPP_VERIFY_TOKEN: 'lifecycle-verify-token',
    // Port 0 still starts a real listener holding the event loop open, which
    // is exactly the condition that used to prevent exit — but on an
    // ephemeral port, so parallel runs cannot collide.
    WHATSAPP_WEBHOOK_PORT: '0'
};

/** Runs the built server and resolves with how it terminated. */
function runServer(
    onReady: (child: ReturnType<typeof spawn>) => void,
    timeoutMs = 15_000
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [ENTRY], { env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
        let stderr = '';

        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`Server did not exit within ${timeoutMs}ms. stderr:\n${stderr}`));
        }, timeoutMs);

        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
            // Act only once the listener is actually up, so the test exercises
            // shutdown with the event loop held open.
            if (stderr.includes('WhatsApp MCP server ready')) onReady(child);
        });

        child.on('exit', (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, stderr });
        });
        child.on('error', reject);
    });
}

const hasBuild = existsSync(ENTRY);

describe.skipIf(!hasBuild)('server lifecycle', () => {
    // Regression guard: MCP clients shut a server down by closing stdin. The
    // webhook listener keeps the event loop alive by itself, so without an
    // explicit stdin handler the process outlived its client and kept holding
    // the webhook port.
    it('exits when stdin closes', async () => {
        const result = await runServer((child) => child.stdin?.end());

        expect(result.code).toBe(0);
        expect(result.stderr).toContain('stdin closed, shutting down');
    });

    it('exits on SIGTERM', async () => {
        const result = await runServer((child) => child.kill('SIGTERM'));

        expect(result.code).toBe(0);
        expect(result.stderr).toContain('Received SIGTERM');
    });

    it('logs nothing to stdout, which carries only JSON-RPC frames', async () => {
        const stdout = await new Promise<string>((resolve, reject) => {
            const child = spawn(process.execPath, [ENTRY], { env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
            let out = '';
            let err = '';

            child.stdout.on('data', (chunk: Buffer) => {
                out += chunk.toString();
            });
            child.stderr.on('data', (chunk: Buffer) => {
                err += chunk.toString();
                if (err.includes('WhatsApp MCP server ready')) child.stdin?.end();
            });
            child.on('exit', () => resolve(out));
            child.on('error', reject);
            setTimeout(() => {
                child.kill('SIGKILL');
                reject(new Error('timed out'));
            }, 15_000);
        });

        // Startup emits several log lines; none of them may reach stdout.
        expect(stdout).toBe('');
    });
});

describe.skipIf(!hasBuild)('startup validation', () => {
    it('exits non-zero with a readable message when config is missing', async () => {
        const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
            const child = spawn(process.execPath, [ENTRY], {
                env: { ...process.env, WHATSAPP_ACCESS_TOKEN: undefined, WHATSAPP_PHONE_NUMBER_ID: undefined },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stderr = '';
            child.stderr.on('data', (chunk: Buffer) => {
                stderr += chunk.toString();
            });
            child.on('exit', (code) => resolve({ code, stderr }));
            child.on('error', reject);
            setTimeout(() => {
                child.kill('SIGKILL');
                reject(new Error('timed out'));
            }, 15_000);
        });

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('WHATSAPP_ACCESS_TOKEN');
    });
});
