import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

test("mobile article keeps its first image clear and reveals a labeled contents control while reading", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", reducedMotion: "reduce" });
    const page = await context.newPage();
    try {
        await page.goto(new URL("/posts/ue5-landscape-grass-en", baseURL).href, { waitUntil: "networkidle" });
        const backGap = await page.locator(".editorial-back a").evaluate((el) => getComputedStyle(el).gap);
        assert.equal(backGap, "8px");

        const toc = page.locator("[data-toc-mobile-toggle]");
        assert.equal(await toc.evaluate((el) => el.inert), true, "floating contents stays out of the first screen");
        await page.evaluate(() => {
            const header = document.querySelector("[data-article-header]");
            window.scrollTo({ top: header.getBoundingClientRect().bottom + scrollY + 16, behavior: "instant" });
        });
        await page.waitForFunction(() => !document.querySelector("[data-toc-mobile-toggle]").inert);
        const style = await toc.evaluate((el) => {
            const s = getComputedStyle(el);
            return { background: s.backgroundColor, radius: s.borderRadius, shadow: s.boxShadow, width: el.getBoundingClientRect().width };
        });
        assert.equal(style.background, "rgb(8, 25, 174)");
        assert.equal(style.radius, "999px");
        assert.equal(style.shadow, "none");
        assert.ok(style.width >= 110);
        assert.match(await toc.innerText(), /Contents/i);
        await toc.click();
        assert.equal(await page.locator("[data-toc-mobile-drawer]").evaluate((el) => el.open), true);
        await page.keyboard.press("Escape");
        await page.evaluate(() => {
            const prose = document.querySelector("article .prose");
            window.scrollTo({ top: prose.getBoundingClientRect().bottom + scrollY - innerHeight + 20, behavior: "instant" });
        });
        assert.equal(await page.locator("article").evaluate((el) => el.getBoundingClientRect().bottom > innerHeight), true);
        await page.waitForFunction(() => document.querySelector("[data-toc-mobile-toggle]").inert);
    } finally {
        await context.close();
        await browser.close();
    }
});

test("mobile article ends with visible like and share actions, then expands labeled share rows", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", reducedMotion: "reduce" });
    const page = await context.newPage();
    try {
        await page.route("**/api/like*", (route) => {
            const liked = route.request().method() === "POST";
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ count: liked ? 1 : 0, userLikes: liked ? 1 : 0 }),
            });
        });
        await page.goto(new URL("/posts/ue5-landscape-grass-en", baseURL).href, { waitUntil: "networkidle" });
        const share = page.locator("[data-share-mobile]");
        assert.equal(await share.count(), 1);
        const placement = await share.evaluate((el) => ({
            shareTop: el.getBoundingClientRect().top + scrollY,
            articleBottom: document.querySelector("article").getBoundingClientRect().bottom + scrollY,
            proseBottom: document.querySelector("article .prose").getBoundingClientRect().bottom + scrollY,
            position: getComputedStyle(el).position,
        }));
        assert.ok(placement.shareTop >= placement.proseBottom);
        assert.ok(placement.shareTop < placement.articleBottom);
        assert.notEqual(placement.position, "fixed");
        const like = share.locator("[data-like-button]");
        assert.equal(await like.isVisible(), true);
        assert.match(await like.innerText(), /Like/i);
        const beforeColor = await like.evaluate((el) => getComputedStyle(el).backgroundColor);
        assert.notEqual(beforeColor, "rgb(223, 32, 27)");
        await like.click();
        assert.equal(await like.evaluate((el) => el.hasAttribute("data-liked")), true);
        assert.equal(await like.evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(223, 32, 27)");
        assert.equal(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("spacerad_likes") || "{}"))[0]), 1);
        const toggle = page.locator("[data-share-mobile-toggle]");
        assert.equal(await toggle.isVisible(), true);
        assert.equal(await like.evaluate((el) => el.parentElement?.contains(document.querySelector("[data-share-mobile-toggle]"))), true);
        const menu = page.locator("[data-share-menu]");
        assert.equal(await menu.evaluate((el) => el.hidden), true);
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        assert.equal(await menu.evaluate((el) => el.hidden), false);
        assert.deepEqual(
            (await menu.locator("[data-share-menu-item]").allTextContents()).map((text) => text.trim()),
            ["Twitter", "Telegram", "Copy link"],
        );
        assert.equal(
            await menu
                .locator("[data-share-menu-item]")
                .first()
                .evaluate((el) => getComputedStyle(el).borderRadius),
            "0px",
        );
        await page.keyboard.press("Escape");
        assert.equal(await menu.evaluate((el) => el.hidden), true);
        assert.equal(await toggle.evaluate((el) => el === document.activeElement), true);
    } finally {
        await context.close();
        await browser.close();
    }
});

test("dark article share action uses readable blue text", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", serviceWorkers: "block" });
    const page = await context.newPage();
    try {
        await page.goto(new URL("/posts/ue5-landscape-grass-en", baseURL).href, { waitUntil: "networkidle" });
        const shareColor = await page.locator("[data-share-mobile-toggle]").evaluate((el) => getComputedStyle(el).color);
        assert.equal(shareColor, "rgb(210, 216, 255)");
    } finally {
        await context.close();
        await browser.close();
    }
});
