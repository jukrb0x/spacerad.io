import assert from "node:assert/strict";
import test from "node:test";
import { channelCacheKey, createChannelDataCache } from "../src/utils/channel-cache.ts";

function harness(options = {}) {
    let time = 0;
    let calls = 0;
    let fail = false;
    let gate;
    const stored = options.stored || new Map();
    const cache = {
        async match(key) {
            const entry = stored.get(key);
            return entry && entry.expires > time ? entry.response.clone() : undefined;
        },
        async put(key, response) {
            const ttl = Number(response.headers.get("cache-control").match(/max-age=(\d+)/)[1]);
            stored.set(key, { response: response.clone(), expires: time + ttl * 1000 });
        },
    };
    const config = {
        now: () => time,
        cache: () => cache,
        async load(key, signal) {
            calls++;
            assert.ok(signal instanceof AbortSignal);
            if (gate) await gate;
            if (fail) throw new Error("upstream unavailable");
            return { key, revision: calls, posts: [] };
        },
        ...options,
    };
    return {
        config,
        stored,
        read: createChannelDataCache(config),
        calls: () => calls,
        at(value) {
            time = value;
        },
        fail() {
            fail = true;
        },
        hold() {
            let release;
            gate = new Promise((resolve) => {
                release = resolve;
            });
            return release;
        },
    };
}
const latest = channelCacheKey("SpaceRad_io");

test("cold then warm reads share success, but each consumer uses its own freshness budget", async () => {
    const h = harness();
    assert.equal((await h.read(latest, 300)).revision, 1);
    h.at(60_000);
    assert.equal((await h.read(latest, 300)).revision, 1);
    assert.equal((await h.read(latest, 60)).revision, 2);
    h.at(300_000);
    assert.equal((await h.read(latest, 300)).revision, 2);
    h.at(360_000);
    assert.equal((await h.read(latest, 300)).revision, 3);
    assert.equal(h.calls(), 3);
});

test("same-isolate concurrent cold and expired reads perform one load each", async () => {
    const h = harness();
    const release = h.hold();
    const requests = Array.from({ length: 12 }, () => h.read(latest, 60));
    release();
    const results = await Promise.all(requests);
    assert.ok(results.every((result) => result.revision === 1));
    h.at(60_000);
    await Promise.all(Array.from({ length: 12 }, () => h.read(latest, 60)));
    assert.equal(h.calls(), 2);
});

test("new isolate reads shared cache; separate data centers still load independently", async () => {
    const h = harness();
    await h.read(latest, 300);
    assert.equal((await createChannelDataCache(h.config)(latest, 60)).revision, 1);
    assert.equal(h.calls(), 1);
    const other = harness();
    await other.read(latest, 60);
    assert.equal(other.calls(), 1);
});

test("failed refresh retains success, backs off across isolates and never renews its age", async () => {
    const h = harness();
    await h.read(latest, 300);
    h.at(300_000);
    h.fail();
    assert.equal((await h.read(latest, 60)).revision, 1);
    h.at(329_999);
    assert.equal((await createChannelDataCache(h.config)(latest, 60)).revision, 1);
    assert.equal(h.calls(), 2);
    h.at(330_000);
    await h.read(latest, 60);
    assert.equal(h.calls(), 3);
    h.at(3_600_000);
    await assert.rejects(h.read(latest, 60), /upstream unavailable/);
    assert.equal(h.calls(), 4);
    await assert.rejects(h.read(latest, 60));
    assert.equal(h.calls(), 4);
});

test("cold failure gets a short backoff, and a successful empty feed is reusable", async () => {
    const h = harness();
    h.fail();
    await assert.rejects(h.read(latest, 60));
    await assert.rejects(createChannelDataCache(h.config)(latest, 60));
    assert.equal(h.calls(), 1);
    h.at(30_000);
    await assert.rejects(h.read(latest, 60));
    assert.equal(h.calls(), 2);
    const empty = harness();
    assert.deepEqual((await empty.read(latest, 60)).posts, []);
    await empty.read(latest, 60);
    assert.equal(empty.calls(), 1);
});

test("timeout aborts a stalled upstream, releases pending work and backs off", async () => {
    let signal;
    let calls = 0;
    const h = harness({
        timeoutMs: 15,
        load: async (_key, value) => {
            signal = value;
            calls++;
            return new Promise(() => {});
        },
    });
    await assert.rejects(h.read(latest, 60), /timed out/);
    assert.equal(signal.aborted, true);
    await assert.rejects(h.read(latest, 60));
    assert.equal(calls, 1);
    h.at(30_000);
    await assert.rejects(h.read(latest, 60));
    assert.equal(calls, 2);
});

test("late upstream success after timeout cannot overwrite the successful snapshot", async () => {
    let resolve;
    const h = harness({
        timeoutMs: 10,
        load: async () =>
            new Promise((r) => {
                resolve = r;
            }),
    });
    await assert.rejects(h.read(latest, 60));
    resolve({ revision: 99 });
    await new Promise((r) => setImmediate(r));
    await assert.rejects(createChannelDataCache(h.config)(latest, 60));
});

test("missing/broken cache falls back locally, bounded entries evict, and cache corruption refreshes", async () => {
    for (const cache of [
        () => undefined,
        () => ({
            match() {
                throw new Error("cache down");
            },
            put() {
                throw new Error("cache down");
            },
        }),
    ]) {
        const h = harness({ cache, maxEntries: 2 });
        await h.read(latest, 60);
        await h.read(latest, 60);
        assert.equal(h.calls(), 1);
        await h.read(channelCacheKey("SpaceRad_io", { before: "42" }), 300);
        await h.read(channelCacheKey("SpaceRad_io", { before: "24" }), 300);
        await h.read(latest, 60);
        assert.equal(h.calls(), 4);
    }
    const h = harness({
        cache: () => ({
            async match() {
                return new Response("broken json");
            },
            async put() {},
        }),
    });
    await h.read(latest, 60);
    assert.equal(h.calls(), 1);
});

test("versioned normalized keys separate pagination and reject ambiguous or invalid inputs", () => {
    assert.equal(latest, channelCacheKey("spacerad_IO", {}));
    assert.notEqual(latest, channelCacheKey("SpaceRad_io", {}, "v-next"));
    assert.notEqual(channelCacheKey("SpaceRad_io", { before: "42" }), channelCacheKey("SpaceRad_io", { after: "42" }));
    for (const options of [{ before: "x" }, { after: "-1" }, { before: "42", after: "43" }]) {
        assert.throws(() => channelCacheKey("SpaceRad_io", options));
    }
    assert.throws(() => channelCacheKey("bad/channel"));
});

test("current parser cache ignores legacy snapshots lacking forward classification", async () => {
    const h = harness({ load: async () => ({ posts: [{ id: "1280", isForwarded: true }] }) });
    h.stored.set("https://spacerad.io/__channel-data/v1/spacerad_io", {
        expires: 3_600_000,
        response: new Response(JSON.stringify({ data: { posts: [{ id: "1280" }] }, fetchedAt: 0, retryAfter: 0 })),
    });
    const result = await h.read(latest, 60);
    assert.equal(result.posts[0].isForwarded, true);
    assert.equal(h.stored.size, 2);
});

test("a concurrent homepage cache hit cannot weaken the Channel freshness budget", async () => {
    const h = harness();
    await h.read(latest, 300);
    h.at(90_000);
    const [home, channel] = await Promise.all([h.read(latest, 300), h.read(latest, 60)]);
    assert.equal(home.revision, 1);
    assert.equal(channel.revision, 2);
    assert.equal(h.calls(), 2);
});

test("a snapshot crossing the one-hour limit during a failed refresh is not served", async () => {
    const h = harness();
    await h.read(latest, 300);
    h.at(3_599_999);
    h.fail();
    const release = h.hold();
    const request = h.read(latest, 60);
    await new Promise((r) => setImmediate(r));
    h.at(3_600_000);
    release();
    await assert.rejects(request);
});

test("a snapshot crossing the one-hour limit while storing the failure marker is not served", async () => {
    const h = harness();
    const cache = h.config.cache();
    const read = createChannelDataCache({
        ...h.config,
        cache: () => ({
            match: cache.match,
            async put(key, response) {
                if (new URL(key).searchParams.has("__retry")) h.at(3_600_000);
                return cache.put(key, response);
            },
        }),
    });
    await read(latest, 300);
    h.at(3_599_999);
    h.fail();
    await assert.rejects(read(latest, 60), /upstream unavailable/);
});

test("a failed cold isolate never overwrites another isolate's successful snapshot", async () => {
    const stored = new Map();
    const good = harness({ stored });
    const bad = harness({ stored });
    bad.fail();
    const releaseGood = good.hold();
    const releaseBad = bad.hold();
    const success = good.read(latest, 60);
    const failure = bad.read(latest, 60);
    await new Promise((r) => setImmediate(r));
    releaseGood();
    await success;
    releaseBad();
    await failure.catch(() => {});
    const newcomer = createChannelDataCache(good.config);
    assert.equal((await newcomer(latest, 60)).revision, 1);
    assert.equal(good.calls(), 1);
    assert.equal(bad.calls(), 1);
});

test("a shared cache hit is retained locally when edge cache and upstream subsequently fail", async () => {
    const h = harness();
    await h.read(latest, 300);
    let broken = false;
    const read = createChannelDataCache({ ...h.config, cache: () => (broken ? undefined : h.config.cache()) });
    assert.equal((await read(latest, 60)).revision, 1);
    broken = true;
    h.fail();
    h.at(60_000);
    assert.equal((await read(latest, 60)).revision, 1);
    assert.equal(h.calls(), 2);
});

test("invalid parsed upstream data cannot poison success, and cold validation failures back off", async () => {
    const { assertTelegramPage } = await import("../src/utils/telegram-page.ts");
    let invalid = false;
    let calls = 0;
    const h = harness({
        load: async () => {
            calls++;
            assertTelegramPage(invalid ? "" : "Radio", [], "SpaceRad_io");
            return { revision: calls, posts: [] };
        },
    });
    await h.read(latest, 60);
    invalid = true;
    h.at(60_000);
    assert.equal((await h.read(latest, 60)).revision, 1);
    assert.equal((await h.read(latest, 60)).revision, 1);
    assert.equal(calls, 2);
    const cold = channelCacheKey("AnotherRadio");
    await assert.rejects(h.read(cold, 60), /Invalid Telegram/);
    await assert.rejects(h.read(cold, 60));
    assert.equal(calls, 3);
});
