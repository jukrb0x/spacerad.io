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

test("Beer Log sheet slides fully in and out while keeping the lower Safari pocket the same color", async () => {
    const browser = await webkit.launch(launchOptions);
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "no-preference" });
        await page.goto(new URL("/beer-collection", baseURL).href);
        await page.locator(".collection-tile").first().tap();
        const dialog = page.locator(".collection-detail[open]");
        const duration = await dialog.evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration) * 1000);
        assert(duration >= 500, `sheet entrance is only ${duration}ms`);
        const opening = await dialog.evaluate((element) => {
            const animation = element.getAnimations().find((item) => item.animationName === "collection-sheet-enter");
            return animation?.effect?.getKeyframes()[0];
        });
        assert.equal(opening?.opacity ?? "1", "1", "sheet must be opaque throughout its entrance");
        assert.equal(opening?.transform, "translateY(100%)", "sheet must start below the viewport");
        const midpoint = await dialog.evaluate((element, animationDuration) => {
            const animation = element.getAnimations().find((item) => item.animationName === "collection-sheet-enter");
            animation.pause();
            animation.currentTime = animationDuration / 2;
            const remaining = new DOMMatrix(getComputedStyle(element).transform).m42;
            const height = element.getBoundingClientRect().height;
            const progress = Number.parseFloat(getComputedStyle(element).getPropertyValue("--collection-sheet-progress"));
            animation.play();
            return { remaining, height, progress };
        }, duration);
        assert(
            midpoint.remaining > midpoint.height * 0.35 && midpoint.remaining < midpoint.height * 0.65,
            `sheet should be halfway through its travel: ${JSON.stringify(midpoint)}`,
        );
        assert(midpoint.progress > 0.35 && midpoint.progress < 0.65, `Safari pocket tint should track the sheet: ${JSON.stringify(midpoint)}`);
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
            element.style.setProperty("--collection-sheet-progress", "1");
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

        await dialog.evaluate((element) => {
            if (element instanceof HTMLDialogElement) element.close();
            element.style.transform = "";
            element.style.removeProperty("--collection-sheet-progress");
        });
        await page.locator(".collection-tile").first().tap();
        await page.waitForTimeout(duration + 50);
        await dialog.locator("[data-collection-close]").click();
        await page.waitForFunction(() =>
            document
                .querySelector(".collection-detail[open]")
                ?.getAnimations()
                .some((item) => item.animationName === "collection-sheet-enter" && item.playbackRate === -1),
        );
        const closing = await dialog.evaluate((element) => ({
            open: element.open,
            playbackRate: element.getAnimations().find((item) => item.animationName === "collection-sheet-enter")?.playbackRate,
        }));
        assert.deepEqual(closing, { open: true, playbackRate: -1 }, "close should reverse the entrance in place");
        await page.waitForTimeout(duration / 2);
        const closingRect = await dialog.boundingBox();
        assert(closingRect.y > top.y + top.height * 0.3, "sheet should move down before closing");
        await page.waitForFunction(() => !document.querySelector(".collection-detail")?.open);
    } finally {
        await browser.close();
    }
});

test("Beer Log dismisses the sheet by reversing from its current position", async () => {
    const browser = await webkit.launch(launchOptions);
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        await page.goto(new URL("/beer-collection", baseURL).href);
        const tile = page.locator(".collection-tile").first();
        await tile.tap();
        const dialog = page.locator(".collection-detail[open]");
        await page.waitForTimeout(180);
        const beforeDismiss = await dialog.boundingBox();
        await page.mouse.click(195, 100);
        await page.waitForFunction(() => document.querySelector(".collection-detail[open]")?.dataset.collectionClosing === "true");
        const afterDismiss = await dialog.boundingBox();
        assert(Math.abs(afterDismiss.y - beforeDismiss.y) < 100, "dismissing mid entrance should not jump the sheet to the top");
        await page.waitForFunction(() => !document.querySelector(".collection-detail")?.open);

        await tile.tap();
        await page.waitForTimeout(600);
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.querySelector(".collection-detail[open]")?.dataset.collectionClosing === "true");
        await page.waitForFunction(() => !document.querySelector(".collection-detail")?.open);
    } finally {
        await browser.close();
    }
});
