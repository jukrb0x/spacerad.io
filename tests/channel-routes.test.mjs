import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { channelCacheKey, createChannelDataCache } from "../src/utils/channel-cache.ts";

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const empty = { title: "Radio", description: "", avatar: "", posts: [] };
function astro(path) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8").split("---")[1];
    return new AsyncFunction(
        "Astro",
        "getCachedTelegramChannel",
        stripTypeScriptTypes(source.replace(/^import .*;\n/gm, "").replace("export const prerender", "const prerender")),
    );
}
function context(cursor) {
    return { params: { cursor }, response: { headers: new Headers(), status: 200 } };
}
const homepage = astro("../src/pages/api/latest-channel.astro");
const channelPage = astro("../src/pages/channel/[...cursor].astro");

test("actual homepage and Channel routes use the shared data cache with their own budgets", async () => {
    for (const [render, cursor, expectedOptions, budget] of [
        [homepage, undefined, {}, 300],
        [channelPage, undefined, {}, 60],
        [channelPage, "after-42", { after: "42" }, 60],
        [channelPage, "before-42", { before: "42" }, 300],
    ]) {
        const ctx = context(cursor);
        const calls = [];
        await render(ctx, async (...args) => {
            calls.push(args);
            return empty;
        });
        assert.deepEqual(calls, [["SpaceRad_io", expectedOptions, budget]]);
        assert.equal(ctx.response.headers.get("cache-control"), "no-cache");
        assert.equal(ctx.response.status, 200);
    }
});

test("actual routes return uncached 503 errors, preserving the existing UI path", async (t) => {
    t.mock.method(console, "error", () => {});
    for (const render of [homepage, channelPage]) {
        const ctx = context();
        await render(ctx, async () => {
            throw new Error("unavailable");
        });
        assert.equal(ctx.response.status, 503);
        assert.equal(ctx.response.headers.get("cache-control"), "no-store");
    }
});

test("homepage data is reused by Channel but revalidated on navigation after 60 seconds", async () => {
    let time = 0;
    let requests = 0;
    const read = createChannelDataCache({
        now: () => time,
        cache: () => undefined,
        load: async () => {
            requests++;
            return empty;
        },
    });
    const get = (name, options, budget) => read(channelCacheKey(name, options), budget);
    await homepage(context(), get);
    await channelPage(context(), get);
    assert.equal(requests, 1);
    time = 60_000;
    await homepage(context(), get);
    assert.equal(requests, 1);
    await channelPage(context(), get);
    assert.equal(requests, 2);
});

test("actual RSS endpoint uses 300 seconds and does not cache a failed empty-feed response", async (t) => {
    t.mock.method(console, "error", () => {});
    const source = readFileSync(new URL("../src/pages/channel-rss.xml.js", import.meta.url), "utf8")
        .replace(/^import .*;\n/gm, "")
        .replace("export const prerender", "const prerender")
        .replace("export async function GET", "async function GET");
    for (const fail of [false, true]) {
        const calls = [];
        const get = new Function("rss", "cheerio", "sanitizeHtml", "SITE_TITLE", "getCachedTelegramChannel", `${source}\nreturn GET;`)(
            async () => ({ body: "<rss/>" }),
            {},
            {},
            "Radio",
            async (...args) => {
                calls.push(args);
                if (fail) throw new Error("upstream");
                return empty;
            },
        );
        const response = await get({ site: new URL("https://spacerad.io/") });
        assert.deepEqual(calls, [["SpaceRad_io", {}, 300]]);
        assert.equal(response.status, fail ? 503 : 200);
        assert.equal(response.headers.get("cache-control"), fail ? "no-store" : "no-cache");
    }
});

test("actual Telegram cache adapter normalizes keys, shares latest data and forwards abort/cursors", async () => {
    const source = readFileSync(new URL("../src/utils/telegram-cache.ts", import.meta.url), "utf8")
        .replace(/^import .*;\n/gm, "")
        .replace("export function getCachedTelegramChannel", "function getCachedTelegramChannel");
    const calls = [];
    const get = new Function(
        "createChannelDataCache",
        "channelCacheKey",
        "fetchTelegramChannel",
        `${stripTypeScriptTypes(source)}\nreturn getCachedTelegramChannel;`,
    )(createChannelDataCache, channelCacheKey, async (...args) => {
        calls.push(args);
        return empty;
    });
    await get("SpaceRad_io", {}, 300);
    await get("spacerad_io", {}, 60);
    await get("SpaceRad_io", { before: "42" }, 300);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].slice(0, 2), ["spacerad_io", {}]);
    assert.deepEqual(calls[1].slice(0, 2), ["spacerad_io", { before: "42" }]);
    assert.ok(calls.every((args) => args[2] instanceof AbortSignal));
});
