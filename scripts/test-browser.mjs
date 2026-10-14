import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const defaultURL = "http://127.0.0.1:4321";

export async function stopChild(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit").then(() => true);
    const kill = (signal) => {
        try {
            if (process.platform === "win32") child.kill(signal);
            else process.kill(-child.pid, signal);
        } catch (error) {
            if (error.code !== "ESRCH") throw error;
        }
    };
    kill("SIGTERM");
    if (await Promise.race([exited, delay(5000, false, { ref: false })])) return;
    kill("SIGKILL");
    if (!(await Promise.race([exited, delay(5000, false, { ref: false })]))) throw new Error("Child process did not terminate");
}

async function waitForServer(url, timeoutMs, server) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (server && (server.exitCode !== null || server.signalCode !== null)) throw new Error("Browser test server exited before becoming ready");
        try {
            const response = await fetch(new URL("/posts", url), { signal: AbortSignal.timeout(Math.min(1000, deadline - Date.now())) });
            await response.body?.cancel();
            if (response.ok) return;
        } catch {
            // Startup is not ready yet; retry only until the deadline.
        }
        await delay(Math.min(250, Math.max(0, deadline - Date.now())));
    }
    throw new Error(`Timed out waiting for browser test server at ${url} after ${timeoutMs}ms`);
}

async function assertPortAvailable() {
    const reservation = createServer();
    try {
        reservation.listen(4321, "127.0.0.1");
        await once(reservation, "listening");
    } catch (error) {
        if (error.code === "EADDRINUSE") throw new Error("Port 4321 is already in use. Set BASE_URL explicitly to reuse that server.");
        throw error;
    } finally {
        if (reservation.listening) await new Promise((resolveClose) => reservation.close(resolveClose));
    }
}

async function main() {
    const url = new URL(process.env.BASE_URL || defaultURL);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("BASE_URL must use HTTP or HTTPS");
    const timeoutMs = Number(process.env.BROWSER_SERVER_TIMEOUT || 45000);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("BROWSER_SERVER_TIMEOUT must be a positive number of milliseconds");
    const files = process.argv.slice(2);
    if (!files.length) {
        files.push(
            ...(await readdir(resolve(root, "tests")))
                .filter((file) => /^home03.*\.test\.mjs$/.test(file))
                .sort()
                .map((file) => `tests/${file}`),
        );
    }
    if (!files.length) throw new Error("No browser test files found");
    let server;
    let tests;
    const onSignal = async (signal) => {
        await stopChild(tests);
        await stopChild(server);
        process.exit(signal === "SIGINT" ? 130 : 143);
    };
    const onInterrupt = () => {
        void onSignal("SIGINT");
    };
    const onTerminate = () => {
        void onSignal("SIGTERM");
    };
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onTerminate);
    try {
        if (!process.env.BASE_URL) {
            await assertPortAvailable();
            // strictPort prevents Astro silently selecting another port after the availability check.
            server = spawn(process.execPath, [resolve(root, "scripts/test-browser-server.mjs")], {
                cwd: root,
                detached: process.platform !== "win32",
                stdio: "inherit",
            });
        }
        await waitForServer(url, timeoutMs, server);
        tests = spawn(process.execPath, ["--test", "--test-concurrency=1", "--test-timeout=60000", ...files], {
            cwd: root,
            env: { ...process.env, BASE_URL: url.href.replace(/\/$/, "") },
            detached: process.platform !== "win32",
            stdio: "inherit",
        });
        const [code] = await once(tests, "exit");
        process.exitCode = code ?? 1;
    } finally {
        process.off("SIGINT", onInterrupt);
        process.off("SIGTERM", onTerminate);
        await stopChild(tests);
        await stopChild(server);
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
