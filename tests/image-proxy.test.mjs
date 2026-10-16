import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/pages/api/image-proxy.ts";

const source = "https://cdn4.telegram-cdn.org/image.jpg";
const jpeg = Uint8Array.from([255, 216, 255, 224, 0, 2, 255, 217]);
const invoke = (url = source) => GET({ request: new Request(`https://example.test/api/image-proxy?url=${encodeURIComponent(url)}`) });
const image = (body = jpeg, type = "image/jpeg", headers = {}) => new Response(body, { headers: { "content-type": type, ...headers } });

test("proxy preserves valid raster bytes, cache policy and CORS, with nosniff", async (t) => {
    t.mock.method(globalThis, "fetch", async () => image());
    const response = await invoke();
    assert.equal(response.status, 200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), jpeg);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
});

for (const type of ["text/html", "image/svg+xml", "application/octet-stream", ""]) {
    test(`proxy rejects unsupported upstream type ${type || "missing"}`, async (t) => {
        t.mock.method(globalThis, "fetch", async () => image("<svg onload='example()'></svg>", type));
        const response = await invoke();
        assert.equal(response.status, 415);
        assert.equal(response.headers.get("cache-control"), "no-store");
    });
}

test("proxy rejects HTML/SVG disguised as a raster image and truncated signatures", async (t) => {
    for (const body of ["<html>example</html>", "<svg></svg>", new Uint8Array([255, 216])]) {
        t.mock.method(globalThis, "fetch", async () => image(body));
        assert.equal((await invoke()).status, 415);
    }
});

test("proxy validates each redirect before requesting its destination", async (t) => {
    const calls = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
        calls.push(String(url));
        if (calls.length === 1) return new Response(null, { status: 302, headers: { location: "https://unapproved.example/image.jpg" } });
        assert.equal(options.redirect, "manual");
        return image();
    });
    assert.equal((await invoke()).status, 403);
    assert.deepEqual(calls, [source]);
});

test("proxy follows allowed relative/CDN redirects and caps loops", async (t) => {
    const urls = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
        assert.equal(options.redirect, "manual");
        urls.push(String(url));
        if (urls.length === 1) return new Response(null, { status: 302, headers: { location: "/moved.jpg" } });
        if (urls.length === 2) return new Response(null, { status: 307, headers: { location: "https://cdn5.telegram-cdn.org/final.jpg" } });
        return image();
    });
    assert.equal((await invoke()).status, 200);
    assert.equal(urls[1], "https://cdn4.telegram-cdn.org/moved.jpg");
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 302, headers: { location: source } }));
    assert.equal((await invoke()).status, 502);
});

test("proxy rejects unsafe initial URLs and redirect variants without broadening hosts", async (t) => {
    t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Must not fetch");
    });
    for (const url of [
        "http://cdn4.telegram-cdn.org/a",
        "https://cdn4.telegram-cdn.org.evil.test/a",
        "https://evil.test/a",
        "https://user:password@t.me/a",
        "https://t.me:444/a",
    ])
        assert.equal((await invoke(url)).status, 403, url);
    for (const location of ["http://t.me/a", "https://t.me.evil.test/a", "https://user:pw@t.me/a", "https://t.me:444/a"]) {
        t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 302, headers: { location } }));
        assert.equal((await invoke()).status, 403, location);
    }
});

test("proxy bounds declared and streamed size and cancels oversized upstream bodies", async (t) => {
    t.mock.method(globalThis, "fetch", async () => image(jpeg, "image/jpeg", { "content-length": String(10 * 1024 * 1024 + 1) }));
    assert.equal((await invoke()).status, 413);
    let cancelled = false;
    let chunks = 0;
    t.mock.method(globalThis, "fetch", async () =>
        image(
            new ReadableStream({
                pull(controller) {
                    chunks++;
                    controller.enqueue(new Uint8Array(1024 * 1024));
                },
                cancel() {
                    cancelled = true;
                },
            }),
        ),
    );
    assert.equal((await invoke()).status, 413);
    assert.ok(cancelled);
    assert.ok(chunks <= 12);
});

test("proxy uses one deadline across redirects and body transfer", { timeout: 1000 }, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    t.mock.method(globalThis, "fetch", async () => new Promise(() => {}));
    const pending = invoke();
    t.mock.timers.tick(10_001);
    const response = await pending;
    assert.equal(response.status, 504);
    assert.equal(response.headers.get("cache-control"), "no-store");
});

test("proxy preserves upstream errors without long caching and handles network failure", async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response("upstream", { status: 404 }));
    const missing = await invoke();
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    t.mock.method(globalThis, "fetch", async () => {
        throw new Error("offline fixture");
    });
    assert.equal((await invoke()).status, 502);
});

test("proxy accepts the existing passive raster formats with exact bytes", async (t) => {
    const { default: sharp } = await import("sharp");
    for (const format of ["jpeg", "png", "gif", "webp", "avif"]) {
        const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#abcdef" } })
            .toFormat(format)
            .toBuffer();
        t.mock.method(globalThis, "fetch", async () => image(bytes, `image/${format}`));
        const response = await invoke();
        assert.equal(response.status, 200, format);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    }
});

test("proxy deadline cancels a stalled body after a permitted redirect", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let cancelled = false;
    let calls = 0;
    const stream = new ReadableStream({
        cancel() {
            cancelled = true;
        },
    });
    t.mock.method(globalThis, "fetch", async () => {
        if (++calls === 1) return new Response(null, { status: 302, headers: { location: "/next.jpg" } });
        return image(stream);
    });
    const pending = invoke();
    // Let both fetches settle so the body reader owns the stream before expiry.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    t.mock.timers.tick(10_001);
    assert.equal((await pending).status, 504);
    assert.ok(cancelled);
});
