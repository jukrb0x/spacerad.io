import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

import { spaSwaps } from "./helpers/browser-profile.mjs";

const swapCount = spaSwaps(10);
let browser;
before(async () => {
    browser = await chromium.launch(launchOptions);
});
after(async () => {
    await browser?.close();
});
async function open(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: "block", ...options });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    await page.goto(new URL("/posts", baseURL).href, { waitUntil: "networkidle" });
    return { context, page };
}
async function routeClick(page, selector) {
    await page.evaluate(() => {
        window.routeLoaded = false;
        document.addEventListener(
            "astro:page-load",
            () => {
                window.routeLoaded = true;
            },
            { once: true },
        );
    });
    await page.locator(selector).first().click();
    await page.waitForFunction(() => window.routeLoaded === true);
    await waitForPageAnimations(page);
}
test(`${swapCount} SPA swaps retain one shortcut and one theme transition, without scroll-lock leaks`, async () => {
    const { context, page } = await open();
    try {
        for (let i = 0; i < swapCount; i++) {
            await routeClick(page, i % 2 ? '.site-header a[href="/posts"]' : ".site-brand");
            const preference = await page.locator("html").getAttribute("data-theme-mode");
            await page.locator("[data-theme-toggle]").first().click();
            assert.equal(await page.locator("html").getAttribute("data-theme-mode"), { system: "light", light: "dark", dark: "system" }[preference]);
            await page.keyboard.press("Control+k");
            await page.keyboard.press("Control+k");
            assert.equal(await page.locator("[data-search-overlay]").evaluate((dialog) => dialog.open), true);
            await page.keyboard.press("Escape");
            await page.waitForFunction(() => !document.querySelector("[data-search-overlay]").open);
            assert.equal(await page.locator("body").evaluate((body) => body.style.overflow), "");
        }
        const preference = await page.locator("html").getAttribute("data-theme-mode");
        await page.reload({ waitUntil: "networkidle" });
        assert.equal(await page.locator("html").getAttribute("data-theme-mode"), preference);
    } finally {
        await context.close();
    }
});
test("real Pagefind result navigation closes search and releases body scroll", async () => {
    const { context, page } = await open();
    try {
        await page.locator("[data-search-trigger]").click();
        await page.locator("[data-search-input]").pressSequentially("Landscape Grass");
        assert.equal(await page.locator("[data-search-input]").inputValue(), "Landscape Grass");
        await page.locator('[data-search-list] a[href^="/posts/"]').first().waitFor({ state: "visible" });
        await routeClick(page, '[data-search-list] a[href^="/posts/"]');
        assert.match(new URL(page.url()).pathname, /\/posts\/.+/);
        assert.equal(await page.locator("body").evaluate((body) => body.style.overflow), "");
        assert.equal(await page.locator("[data-search-overlay]").evaluate((dialog) => dialog.open), false);
    } finally {
        await context.close();
    }
});
test("mobile TOC is named and browser-back navigation releases the modal scroll lock", async () => {
    const { context, page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
        await routeClick(page, 'a[data-post-id="ue5-landscape-grass"]');
        await page.locator("[data-toc-mobile-toggle]").click();
        assert.equal(await page.locator("[data-toc-mobile-drawer]").getAttribute("aria-label"), "Table of contents");
        assert.equal(await page.locator("body").evaluate((body) => body.style.overflow), "hidden");
        await page.evaluate(() => {
            window.routeLoaded = false;
            document.addEventListener(
                "astro:page-load",
                () => {
                    window.routeLoaded = true;
                },
                { once: true },
            );
        });
        await page.goBack();
        await page.waitForFunction(() => window.routeLoaded === true);
        await page.waitForURL(/\/posts\/?$/);
        await waitForPageAnimations(page);
        assert.equal(await page.locator("body").evaluate((body) => body.style.overflow), "");
        assert.equal(await page.locator("[data-toc-mobile-drawer]").count(), 0);
    } finally {
        await context.close();
    }
});
