import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

let browser;
before(async () => {
    browser = await chromium.launch(launchOptions);
});
after(async () => {
    await browser?.close();
});
const phrases = ["Unreal Engine.", "tools.", "teams.", "games.", "stories.", "performance."];
async function open(options = {}) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 960 },
        reducedMotion: "no-preference",
        serviceWorkers: "block",
        ...options,
    });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.clock.install();
    await page.goto(baseURL, { waitUntil: "networkidle" });
    return { context, page };
}
const current = (page) => page.locator(".home-profile__word[data-current]");

// Removing animate(), collapsing reserved width, or skipping/wrapping a phrase must fail.
for (const width of [1440, 390, 320]) {
    test(`whole phrases move vertically without changing surrounding geometry (${width}px)`, async () => {
        const { context, page } = await open({ viewport: { width, height: 960 } });
        try {
            const frame = page.locator(".home-profile__carousel");
            const initial = await frame.boundingBox();
            const heading = await page.locator("#home-title").boundingBox();
            for (let index = 0; index < 6; index++) {
                await page.clock.fastForward(4000);
                assert.equal(
                    await frame.evaluate((el) => el.getAnimations({ subtree: true }).length),
                    2,
                    "the exchange must animate both whole phrases, not replace text",
                );
                await page.waitForFunction(() => document.querySelector("[data-build-words]")?.getAnimations({ subtree: true }).length === 2);
                await page.waitForTimeout(100);
                const movement = await page
                    .locator(".home-profile__word[data-current]")
                    .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);
                assert.ok(movement < -1, "old whole phrase must visibly move up, not hard-cut");
                const separation = await frame.evaluate((el) => {
                    const old = el.querySelector("[data-current]").getBoundingClientRect();
                    const next = el.querySelector("[data-incoming]").getBoundingClientRect();
                    return { gap: next.top - old.top, height: old.height };
                });
                assert.ok(separation.gap >= separation.height, "the moving lines must not collide inside the clipped window");
                await page.waitForFunction(
                    (expected) => document.querySelector(".home-profile__word[data-current]")?.textContent === expected,
                    phrases[(index + 1) % 6],
                );
                assert.deepEqual(await frame.boundingBox(), initial);
                assert.deepEqual(await page.locator("#home-title").boundingBox(), heading);
            }
            assert.deepEqual(await page.locator(".home-profile__word").allTextContents(), phrases);
            assert.equal(
                await page.locator("#home-title").getAttribute("aria-label"),
                "I build Unreal Engine, tools, teams, games, stories and performance.",
            );
            assert.equal(await frame.getAttribute("aria-hidden"), "true");
            const viewport = await page.evaluate(() => ({
                width: document.documentElement.clientWidth,
                content: document.documentElement.scrollWidth,
            }));
            assert.equal(viewport.content, viewport.width, "carousel must not cause horizontal overflow, including with a reserved scrollbar");
        } finally {
            await context.close();
        }
    });
}

// Removing the visibility/media-query controller would allow motion to continue.
test("hidden pages and reduced motion cancel exchanges and stay static until eligible", async () => {
    const { context, page } = await open();
    try {
        await page.clock.fastForward(4000);
        await page.waitForFunction(() => document.querySelector("[data-build-words]")?.getAnimations({ subtree: true }).length === 2);
        await page.evaluate(() => {
            Object.defineProperty(document, "hidden", { configurable: true, value: true });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.clock.fastForward(20000);
        assert.equal(await current(page).textContent(), "Unreal Engine.");
        assert.equal(await page.evaluate(() => document.querySelector("[data-build-words]").getAnimations({ subtree: true }).length), 0);
        await page.evaluate(() => {
            Object.defineProperty(document, "hidden", { configurable: true, value: false });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.clock.fastForward(4000);
        await page.waitForFunction(() => document.querySelector("[data-build-words]")?.getAnimations({ subtree: true }).length === 2);
        await page.emulateMedia({ reducedMotion: "reduce" });
        // Chromium delivers its media-change event on a later rendering turn.
        await page.waitForFunction(() => document.querySelector("[data-build-words]").getAnimations({ subtree: true }).length === 0);
        await page.clock.fastForward(20000);
        assert.equal(await current(page).textContent(), "Unreal Engine.");
        assert.equal(await page.evaluate(() => document.querySelector("[data-build-words]").getAnimations({ subtree: true }).length), 0);
    } finally {
        await context.close();
    }
});

// A forgotten timer/disposer mutates retained old DOM or creates duplicate exchanges on return.
test("route swaps dispose the old carousel and bind one fresh exchange", async () => {
    const { context, page } = await open();
    try {
        await page.evaluate(() => {
            window.previousCarousel = document.querySelector("[data-build-words]");
        });
        await page.locator('.site-header a[href="/posts"]').click();
        await page.waitForURL(/\/posts\/?$/);
        const old = await page.evaluate(() => window.previousCarousel.innerHTML);
        await page.clock.fastForward(16000);
        assert.equal(await page.evaluate(() => window.previousCarousel.innerHTML), old);
        await page.locator(".site-brand").click();
        await page.waitForURL(`${baseURL.replace(/\/$/, "")}/`);
        await page.waitForFunction(() => document.querySelector("[data-build-words]"));
        await page.clock.fastForward(4000);
        await page.waitForFunction(() => document.querySelector("[data-build-words]")?.getAnimations({ subtree: true }).length === 2);
        await page.waitForFunction(() => document.querySelector(".home-profile__word[data-current]")?.textContent === "tools.");
    } finally {
        await context.close();
    }
});

// SSR must remain useful without JavaScript and with reduced motion from initial load.
for (const options of [{ javaScriptEnabled: false }, { reducedMotion: "reduce" }]) {
    test(`static first phrase fallback (${JSON.stringify(options)})`, async () => {
        const context = await browser.newContext(options);
        const page = await context.newPage();
        try {
            await page.goto(baseURL);
            assert.equal(await current(page).textContent(), "Unreal Engine.");
            assert.equal(await current(page).isVisible(), true);
            await page.waitForTimeout(4500);
            assert.equal(await current(page).textContent(), "Unreal Engine.");
        } finally {
            await context.close();
        }
    });
}
