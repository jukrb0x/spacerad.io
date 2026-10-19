import assert from "node:assert/strict";
import test from "node:test";
import { webkit } from "playwright";
import sharp from "sharp";
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

test("Beer Log sheet rises gently and keeps the lower Safari pocket the same color as the sheet", async () => {
    const browser = await webkit.launch(launchOptions);
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "no-preference" });
        await page.goto(new URL("/beer-collection", baseURL).href);
        await page.locator(".collection-tile").first().tap();
        const dialog = page.locator(".collection-detail[open]");
        const duration = await dialog.evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration) * 1000);
        assert(duration >= 400, `sheet entrance is only ${duration}ms`);
        const backdropDuration = await dialog.evaluate(
            (element) => Number.parseFloat(getComputedStyle(element, "::backdrop").animationDuration) * 1000,
        );
        assert(backdropDuration >= 250, `backdrop entrance is only ${backdropDuration}ms`);

        await page.waitForTimeout(duration + 50);
        const top = await dialog.boundingBox();
        const topImage = await sharp(await page.screenshot())
            .raw()
            .toBuffer({ resolveWithObject: true });
        const topPixel = (x, y) => [
            ...topImage.data.subarray(
                (Math.floor(y) * topImage.info.width + x) * topImage.info.channels,
                (Math.floor(y) * topImage.info.width + x) * topImage.info.channels + 3,
            ),
        ];
        const corner = topPixel(0, top.y + 1);
        const panel = topPixel(195, top.y + 1);
        assert(
            corner.some((value, index) => Math.abs(value - panel[index]) >= 30),
            `rounded corner ${corner} is filled with panel color ${panel}`,
        );

        await dialog.evaluate((element) => {
            for (const animation of element.getAnimations()) animation.cancel();
            element.style.transform = "translateY(-80px)";
        });
        const rect = await dialog.boundingBox();
        const screenshot = await page.screenshot();
        const { data, info } = await sharp(screenshot).raw().toBuffer({ resolveWithObject: true });
        const pixel = (x, y) => [
            ...data.subarray(
                (Math.floor(y) * info.width + Math.floor(x)) * info.channels,
                (Math.floor(y) * info.width + Math.floor(x)) * info.channels + 3,
            ),
        ];
        const sheet = pixel(10, rect.y + rect.height - 15);
        const pocket = pixel(10, 834);
        assert(
            sheet.every((value, index) => Math.abs(value - pocket[index]) <= 3),
            `sheet ${sheet} and lower pocket ${pocket} differ`,
        );
    } finally {
        await browser.close();
    }
});
