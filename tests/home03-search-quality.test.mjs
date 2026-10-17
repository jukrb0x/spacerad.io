import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

let browser;
before(async () => {
    browser = await chromium.launch(launchOptions);
});
after(async () => {
    await browser?.close();
});
async function open(path = "/posts/") {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.goto(new URL(path, baseURL).href);
    await page.locator("[data-search-trigger]").click();
    return { context, page };
}
const zhMemory = "/posts/ue5-landscape-grass-memory-optimization-visibility-culling/";
const enMemory = "/posts/ue5-landscape-grass-memory-optimization-visibility-culling-en/";
const suite = JSON.parse(readFileSync(new URL("./fixtures/search-queries.json", import.meta.url), "utf8"));
async function runQuery(page, query) {
    await page.evaluate(() => {
        window.searchSettled = false;
        const observer = new MutationObserver(() => {
            const visible = (selector) => !document.querySelector(selector).classList.contains("hidden");
            if (
                visible("[data-search-error]") ||
                visible("[data-search-no-results]") ||
                (visible("[data-search-list]") && document.querySelector("[data-search-list] a"))
            ) {
                observer.disconnect();
                window.searchSettled = true;
            }
        });
        observer.observe(document.querySelector("[data-search-results]"), { attributes: true, childList: true, subtree: true });
    });
    await page.locator("[data-search-input]").fill(query);
    await page.waitForFunction(() => window.searchSettled);
}
async function expectHit(page, query, path) {
    await runQuery(page, query);
    await page.locator(`[data-search-list] a[href="${path}"]`).waitFor({ state: "visible" });
}
test("English entry discovers Chinese articles; Chinese entry retains English inflections", async () => {
    for (const [path, text, target] of [
        ["/posts/", "视锥剔除", zhMemory],
        [zhMemory, "optimizing", enMemory],
    ]) {
        const { context, page } = await open(path);
        try {
            await expectHit(page, text, target);
        } finally {
            await context.close();
        }
    }
});
test("failed index chunk reports unavailable and the next query retries the real index", async () => {
    const { context, page } = await open();
    let failed = false;
    await context.route("**/pagefind/index/*.pf_index", (route) => {
        failed = true;
        return route.fulfill({ status: 503, body: "temporary outage" });
    });
    try {
        await page.locator("[data-search-input]").fill("Landscape");
        await page.locator("[data-search-error]").waitFor({ state: "visible" });
        assert.equal(failed, true);
        assert.equal(await page.locator("[data-search-no-results]").isVisible(), false);
        await context.unroute("**/pagefind/index/*.pf_index");
        await expectHit(page, "视锥剔除", zhMemory);
    } finally {
        await context.close();
    }
});
test("quoted Chinese fallback stays exact; an absent phrase stays empty", async () => {
    const { context, page } = await open();
    try {
        for (const [text, path] of [
            ['"视锥剔除"', zhMemory],
            ['"内存优化"', zhMemory],
            ['"原理分析"', "/posts/ue5-landscape-grass/"],
        ]) {
            await expectHit(page, text, path);
        }
        await expectHit(page, "视锥剔除不存在", zhMemory);
        await runQuery(page, '"视锥剔除不存在"');
        assert.equal(await page.locator("[data-search-no-results]").isVisible(), true);
        await runQuery(page, '"紫色不存在的地形草星球"');
        await page.locator("[data-search-no-results]").waitFor({ state: "visible" });
        assert.equal(await page.locator("[data-search-list]").isVisible(), false);
    } finally {
        await context.close();
    }
});

for (const path of ["/posts/", zhMemory])
    test(`current published bilingual ranking matrix from ${path}`, async () => {
        const { context, page } = await open(path);
        try {
            for (const q of suite) {
                await runQuery(page, q.query);
                assert.equal(await page.locator("[data-search-error]").isVisible(), false, q.query);
                const urls = await page
                    .locator("[data-search-list] a")
                    .evaluateAll((links) => links.map((link) => decodeURI(new URL(link.href).pathname)));
                for (const target of q.paths) assert.ok(urls.slice(0, q.top).includes(target), `${q.query}: ${target}, got ${urls}`);
                if (!q.paths.length) assert.equal(await page.locator("[data-search-no-results]").isVisible(), true, q.query);
            }
        } finally {
            await context.close();
        }
    });

for (const [name, pattern, failure] of [
    ["module 503", "**/pagefind/pagefind.js?*", { status: 503, body: "temporary outage" }],
    ["WASM 503", "**/pagefind/wasm.*.pagefind", { status: 503, body: "temporary outage" }],
    ["metadata 503", "**/pagefind/*.pf_meta", { status: 503, body: "temporary outage" }],
    ["fragment 503", "**/pagefind/fragment/*.pf_fragment", { status: 503, body: "temporary outage" }],
    ["truncated gzip chunk", "**/pagefind/index/*.pf_index", { status: 200, body: Buffer.from([0x1f, 0x8b, 0, 0, 0]) }],
    ["wrong chunk signature", "**/pagefind/index/*.pf_index", { status: 200, body: gzipSync("invalid index") }],
    ["network abort", "**/pagefind/index/*.pf_index", null],
])
    test(`${name} stops the failed realm; a fresh query recovers`, async () => {
        const { context, page } = await open();
        let starts = 0;
        page.on("worker", () => starts++);
        await context.route(pattern, (route) => (failure ? route.fulfill(failure) : route.abort()));
        try {
            await page.locator("[data-search-input]").fill("Landscape");
            await page.locator("[data-search-error]").waitFor({ state: "visible" });
            assert.equal(page.workers().length, 0, "failed Pagefind timers cannot survive worker termination");
            await context.unroute(pattern);
            await expectHit(page, "地形草", zhMemory);
            assert.equal(starts, 2);
            assert.equal(page.workers().length, 1);
        } finally {
            await context.close();
        }
    });

test("stalled WASM reaches a deadline and recovers without an orphan worker", async () => {
    const { context, page } = await open();
    const releases = new Set();
    const pattern = "**/pagefind/wasm.*.pagefind";
    await context.route(pattern, async (route) => {
        await new Promise((resolve) => releases.add(resolve));
        await route.abort().catch(() => {});
    });
    try {
        await page.locator("[data-search-input]").fill("Landscape");
        await page.locator("[data-search-error]").waitFor({ state: "visible", timeout: 13000 });
        assert.equal(page.workers().length, 0);
        for (const release of releases) release();
        await context.unroute(pattern);
        await expectHit(page, "地形草", zhMemory);
        assert.equal(page.workers().length, 1);
    } finally {
        for (const release of releases) release();
        await context.close();
    }
});
test("closing and SPA navigation suppress delayed results and preserve a usable bilingual search", async () => {
    const { context, page } = await open();
    const releases = new Set();
    await context.route("**/pagefind/wasm.*.pagefind", async (route) => {
        await new Promise((resolve) => {
            releases.add(resolve);
        });
        await route.continue().catch(() => {});
    });
    try {
        const loading = page.waitForRequest((request) => /\/pagefind\/wasm\./.test(request.url()));
        await page.locator("[data-search-input]").fill("Landscape");
        await loading;
        const stopped = new Promise((resolve) => page.workers()[0].on("close", resolve));
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("[data-search-overlay]").open);
        await stopped;
        for (const release of releases) release();
        await context.unroute("**/pagefind/wasm.*.pagefind");
        await page.locator("[data-search-trigger]").click();
        await expectHit(page, "地形草", zhMemory);
        const loaded = page.waitForURL(`**${zhMemory}`);
        await page.locator(`[data-search-list] a[href="${zhMemory}"]`).click();
        await loaded;
        await waitForPageAnimations(page);
        assert.equal(await page.locator("[data-search-overlay]").evaluate((e) => e.open), false);
        assert.equal(await page.locator("body").evaluate((e) => e.style.overflow), "");
        await page.locator("[data-theme-toggle]").first().click();
        await page.locator("[data-search-trigger]").click();
        await expectHit(page, "optimized", enMemory);
    } finally {
        for (const release of releases) release();
        await context.close();
    }
});

test("clearing input cancels loading before the deadline and keeps the dialog usable", async () => {
    const { context, page } = await open();
    const releases = new Set();
    const pattern = "**/pagefind/wasm.*.pagefind";
    await context.route(pattern, async (route) => {
        await new Promise((resolve) => releases.add(resolve));
        await route.continue().catch(() => {});
    });
    try {
        const loading = page.waitForRequest((r) => /\/pagefind\/wasm\./.test(r.url()));
        await page.locator("[data-search-input]").fill("Landscape");
        await loading;
        const stopped = new Promise((resolve) => page.workers()[0].on("close", resolve));
        await page.locator("[data-search-input]").fill("");
        await stopped;
        assert.equal(page.workers().length, 0);
        assert.equal(await page.locator("[data-search-overlay]").evaluate((e) => e.open), true);
        await page.locator("[data-search-empty]").waitFor({ state: "visible" });
        for (const release of releases) release();
        await context.unroute(pattern);
        await expectHit(page, "Surgio", "/posts/surgio-tutorial-make-surge-easier/");
    } finally {
        for (const release of releases) release();
        await context.close();
    }
});

test("browser-back SPA navigation cancels native initialization while it is loading", async () => {
    const { context, page } = await open();
    const releases = new Set();
    const pattern = "**/pagefind/wasm.*.pagefind";
    try {
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("[data-search-overlay]").open);
        await page.locator('a[data-post-id="ue5-landscape-grass"]').first().click();
        await page.waitForURL("**/posts/ue5-landscape-grass");
        await waitForPageAnimations(page);
        await page.locator("[data-search-trigger]").click();
        await context.route(pattern, async (route) => {
            await new Promise((resolve) => releases.add(resolve));
            await route.continue().catch(() => {});
        });
        const loading = page.waitForRequest((r) => /\/pagefind\/wasm\./.test(r.url()));
        await page.locator("[data-search-input]").fill("Landscape");
        await loading;
        const stopped = new Promise((resolve) => page.workers()[0].on("close", resolve));
        await page.goBack();
        await page.waitForURL(/\/posts\/?$/);
        await stopped;
        assert.equal(page.workers().length, 0);
        assert.equal(await page.locator("body").evaluate((e) => e.style.overflow), "");
        for (const release of releases) release();
        await context.unroute(pattern);
        await page.locator("[data-search-trigger]").click();
        await expectHit(page, "地形草", zhMemory);
    } finally {
        for (const release of releases) release();
        await context.close();
    }
});

test("missing gzip browser API reports unavailable instead of caching an empty chunk", async () => {
    const { context, page } = await open();
    const releases = new Set();
    const pattern = "**/pagefind/index/*.pf_index";
    await context.route(pattern, async (route) => {
        await new Promise((resolve) => releases.add(resolve));
        await route.continue().catch(() => {});
    });
    try {
        const loading = page.waitForRequest((r) => /\/pagefind\/index\//.test(r.url()));
        await page.locator("[data-search-input]").fill("Landscape");
        await loading;
        await page.workers()[0].evaluate(() => {
            self.DecompressionStream = undefined;
        });
        for (const release of releases) release();
        await page.locator("[data-search-error]").waitFor({ state: "visible" });
        assert.equal(page.workers().length, 0);
        await context.unroute(pattern);
        await expectHit(page, "地形草", zhMemory);
    } finally {
        for (const release of releases) release();
        await context.close();
    }
});

test("production search fragments exclude every current draft route", () => {
    const fragments = new URL("../dist/pagefind/fragment/", import.meta.url);
    const urls = readdirSync(fragments).map((name) => {
        const decoded = gunzipSync(readFileSync(new URL(name, fragments))).toString();
        assert.ok(decoded.startsWith("pagefind_dcd"));
        return JSON.parse(decoded.slice("pagefind_dcd".length)).url;
    });
    assert.ok(urls.includes(zhMemory));
    assert.ok(urls.includes(enMemory));
    const content = new URL("../src/content/blog/", import.meta.url);
    const drafts = readdirSync(content, { recursive: true }).filter(
        (name) => /\.(md|mdx)$/.test(name) && /^draft:\s*true\s*$/m.test(readFileSync(new URL(name, content), "utf8").split("---")[1]),
    );
    assert.ok(drafts.length > 0, "exercise actual draft exclusions");
    for (const name of drafts) {
        const slug = name.replace(/\.(md|mdx)$/, "").replace(/\/index$/, "");
        assert.equal(urls.includes(`/posts/${slug}/`), false, slug);
        assert.equal(existsSync(new URL(`../dist/posts/${slug}/index.html`, import.meta.url)), false, slug);
    }
});
