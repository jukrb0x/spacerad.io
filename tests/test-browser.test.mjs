import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const runner = new URL("../scripts/test-browser.mjs", import.meta.url);

async function run(env, files = []) {
    const childEnv = { ...process.env, ...env };
    delete childEnv.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, [runner.pathname, ...files], { env: childEnv });
    let output = "";
    child.stdout.on("data", (chunk) => {
        output += chunk;
    });
    child.stderr.on("data", (chunk) => {
        output += chunk;
    });
    const [code] = await once(child, "exit");
    return { code, output };
}

test("browser runner reports an unavailable supplied server within its readiness deadline", { timeout: 5000 }, async () => {
    const reservation = createServer();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const address = reservation.address();
    await new Promise((resolve) => reservation.close(resolve));
    const { code, output } = await run({ BASE_URL: `http://127.0.0.1:${address.port}`, BROWSER_SERVER_TIMEOUT: "500" });
    assert.equal(code, 1);
    assert.match(output, /Timed out waiting for browser test server/);
});

test("browser runner reuses the supplied server, passes its URL and preserves test failure status", { timeout: 10000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), "spacerad-test-runner-"));
    const server = createServer((_request, response) => {
        response.end("ready");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    const fixture = join(directory, "fixture.test.mjs");
    try {
        await writeFile(
            fixture,
            'import assert from "node:assert/strict"; import { test } from "node:test"; test("configured server", () => assert.equal(process.env.BASE_URL, process.env.EXPECTED_BASE_URL));',
        );
        const passing = await run({ BASE_URL: baseURL, EXPECTED_BASE_URL: baseURL }, [fixture]);
        assert.equal(passing.code, 0, passing.output);
        const failing = await run({ BASE_URL: baseURL, EXPECTED_BASE_URL: "wrong" }, [fixture]);
        assert.equal(failing.code, 1, failing.output);
        assert.match(failing.output, /configured server/);
        assert.equal((await fetch(baseURL)).status, 200, "runner must not stop a supplied server");
    } finally {
        await new Promise((resolve) => server.close(resolve));
        await rm(directory, { recursive: true, force: true });
    }
});

test("owned server teardown terminates its child process", { timeout: 7000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), "spacerad-test-cleanup-"));
    const fixture = join(directory, "cleanup.mjs");
    try {
        await writeFile(
            fixture,
            `
            import assert from "node:assert/strict";
            import { spawn } from "node:child_process";
            import { stopChild } from ${JSON.stringify(runner.href)};
            const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: process.platform !== "win32", stdio: "ignore" });
            await stopChild(child);
            assert.ok(child.signalCode !== null || child.exitCode !== null);
        `,
        );
        const child = spawn(process.execPath, [fixture]);
        let output = "";
        child.stderr.on("data", (chunk) => {
            output += chunk;
        });
        const [code] = await once(child, "exit");
        assert.equal(code, 0, output);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
