import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

// A closed drawer must never release a scroll lock owned by the article TOC.
test("resizing a closed navigation drawer preserves the open TOC scroll lock", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    try {
        await page.goto(new URL("/posts/introducing-space-radio", baseURL).href, { waitUntil: "networkidle" });
        await page.evaluate(() => {
            const header = document.querySelector("[data-article-header]");
            scrollTo({ top: header.getBoundingClientRect().bottom + scrollY + 16, behavior: "instant" });
        });
        await page.waitForFunction(() => !document.querySelector("[data-toc-mobile-toggle]").inert);
        await page.locator("[data-toc-mobile-toggle]").click();
        assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "hidden");
        await page.setViewportSize({ width: 900, height: 844 });
        // Let the actual breakpoint media-query change reach its listener.
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.locator("[data-nav-overlay]").evaluate((el) => el.open), false);
        assert.equal(await page.locator("[data-toc-mobile-drawer]").evaluate((el) => el.open), true);
        assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "hidden");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("[data-toc-mobile-drawer]").open);
        assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "");
    } finally {
        await context.close();
        await browser.close();
    }
});
