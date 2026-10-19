import assert from "node:assert/strict";
import test from "node:test";
import { webkit } from "playwright";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

test("Beer Log touch opens and closes details without focus frames while keyboard focus remains visible", async () => {
    const browser = await webkit.launch(launchOptions);
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        await page.goto(new URL("/beer-collection", baseURL).href);
        await page.locator(".collection-tile").first().tap();
        const close = page.locator(".collection-detail__close:visible");
        assert.equal(await close.evaluate((el) => el === document.activeElement), true);
        assert.equal(await close.evaluate((el) => getComputedStyle(el).outlineStyle), "none");
        await close.tap();
        await page.waitForFunction(() => document.activeElement === document.querySelector("main"));
        assert.equal(await page.locator("main").evaluate((el) => el === document.activeElement), true);
        assert.equal(await page.locator("main").evaluate((el) => getComputedStyle(el).outlineStyle), "none");

        await page.locator(".collection-tile").first().focus();
        await page.keyboard.press("Enter");
        assert.notEqual(await page.locator(".collection-detail__close:visible").evaluate((el) => getComputedStyle(el).outlineStyle), "none");
    } finally {
        await browser.close();
    }
});
