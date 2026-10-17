import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

// Match the observed vendor contract: embed.js starts once itself; createInstance
// adds handlers; global destroy releases only the most recently created instance.
const embedFixture = `
window.commentCalls ||= [];
window.REMARK42 = {
  createInstance(config) {
    window.commentCalls.push({url: config.url});
    const root = document.getElementById('remark42');
    const frame = root.firstElementChild || document.createElement('iframe');
    frame.srcdoc = '<p>Read-only comments fixture</p>';
    root.append(frame);
    const handler = () => {};
    window.addEventListener('message', handler);
    const destroy = () => { window.removeEventListener('message', handler); frame.remove(); };
    window.REMARK42.destroy = destroy;
    window.REMARK42.changeTheme = theme => { window.remark_config.theme = theme; };
    return {destroy, changeTheme: window.REMARK42.changeTheme};
  }
};
window.REMARK42.createInstance(window.remark_config);
window.dispatchEvent(new Event('REMARK42::ready'));
`;

test("comment startup owns one instance and releases vendor handlers on every route swap", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ serviceWorkers: "block" });
    let scriptRequests = 0;
    await context.route("**/*", async (route) => {
        if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.abort();
        if (/\/(web\/embed\.js|api\/remark42-script)$/.test(new URL(route.request().url()).pathname)) {
            scriptRequests++;
            return route.fulfill({ contentType: "application/javascript", body: embedFixture });
        }
        return route.continue();
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    async function messageListeners() {
        const { result } = await cdp.send("Runtime.evaluate", { expression: "window" });
        const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId });
        return listeners.filter((listener) => listener.type === "message").length;
    }
    async function navigate(selector) {
        await page.evaluate(() => {
            window.routeReady = false;
            document.addEventListener(
                "astro:page-load",
                () => {
                    window.routeReady = true;
                },
                { once: true },
            );
        });
        await page.locator(selector).click();
        await page.waitForFunction(() => window.routeReady);
    }
    try {
        await page.goto(new URL("/posts/ue5-landscape-grass", baseURL).href, { waitUntil: "networkidle" });
        assert.equal(scriptRequests, 0, "offscreen comments must not fetch the vendor script");
        await page.locator(".comments-section").scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector("#remark42 iframe"));
        assert.equal(await page.evaluate(() => window.commentCalls.length), 1, "embed startup must not be invoked twice");
        assert.equal(await messageListeners(), 1);
        for (let round = 0; round < 3; round++) {
            await navigate(".editorial-back a");
            assert.equal(await messageListeners(), 0, "leaving the article must destroy its vendor instance");
            assert.equal(await page.locator("#remark42 iframe").count(), 0);
            await navigate('a[data-post-id="ue5-landscape-grass-en"]');
            await page.locator(".comments-section").scrollIntoViewIfNeeded();
            await page.waitForFunction(() => document.querySelector("#remark42 iframe"));
            assert.equal(await messageListeners(), 1);
            assert.equal(
                await page.evaluate(() => new URL(window.commentCalls.at(-1).url).pathname.replace(/\/$/, "")),
                "/posts/ue5-landscape-grass-en",
            );
        }
        assert.equal(scriptRequests, 1, "an already loaded vendor must be reused without reexecuting embed.js");
    } finally {
        await context.close();
        await browser.close();
    }
});

// Third-party script latency must not delay initial Astro page-load UI binding.
test("a slow comment script does not block initial header controls", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ serviceWorkers: "block" });
    let started;
    const requested = new Promise((resolve) => {
        started = resolve;
    });
    let release;
    const held = new Promise((resolve) => {
        release = resolve;
    });
    await context.route("**/*", async (route) => {
        if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.abort();
        if (/\/(web\/embed\.js|api\/remark42-script)$/.test(new URL(route.request().url()).pathname)) {
            started();
            await held;
            return route.fulfill({ contentType: "application/javascript", body: embedFixture });
        }
        return route.continue();
    });
    const page = await context.newPage();
    try {
        await page.goto(new URL("/posts/surgio-tutorial-make-surge-easier", baseURL).href, { waitUntil: "domcontentloaded" });
        await page.locator(".comments-section").scrollIntoViewIfNeeded();
        await requested;
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true", undefined, { timeout: 3000 });
        await page.locator("[data-search-trigger]").click();
        assert.equal(await page.locator("[data-search-overlay]").evaluate((el) => el.open), true);
        await page.keyboard.press("Escape");
    } finally {
        release();
        await context.close();
        await browser.close();
    }
});
