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
        const padding = await toc.evaluate((el) => {
            const box = el.getBoundingClientRect();
            const node = el.querySelector(".article-toc-toggle__node").getBoundingClientRect();
            const label = el.querySelector(".article-toc-toggle__label").getBoundingClientRect();
            return { left: node.left - box.left, right: box.right - label.right };
        });
        assert.ok(Math.abs(padding.left - padding.right) < 1, "capsule content has balanced horizontal padding");
        assert.match(await toc.innerText(), /Contents/i);
        const triggerBox = await toc.boundingBox();
        await toc.click();
        const drawer = page.locator("[data-toc-mobile-drawer]");
        assert.equal(await drawer.evaluate((el) => el.open), true);
        const close = drawer.locator(".article-toc-toggle");
        await close.waitFor({ state: "visible" });
        const closeBox = await close.boundingBox();
        assert.equal(closeBox.width, 44, "contents capsule collapses to a circular close control");
        assert.equal(closeBox.x + closeBox.width, triggerBox.x + triggerBox.width, "right anchor stays fixed");
        assert.equal(closeBox.y, triggerBox.y, "bottom anchor stays fixed");
        assert.equal(await toc.evaluate((el) => getComputedStyle(el).visibility), "hidden", "only one control is visible");
        assert.equal(await close.evaluate((el) => document.activeElement === el), true);
        assert.equal(await toc.getAttribute("aria-expanded"), "true");
        await close.click();
        await page.waitForFunction(() => !document.querySelector("[data-toc-mobile-drawer]").open);
        assert.equal(await toc.evaluate((el) => document.activeElement === el), true);
        assert.equal(await toc.getAttribute("aria-expanded"), "false");
        await toc.click();
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("[data-toc-mobile-drawer]").open);
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
        assert.equal(await like.evaluate((el) => getComputedStyle(el).touchAction), "manipulation");
        assert.deepEqual(
            await page.evaluate(() =>
                [...document.querySelectorAll("body.article-page a, body.article-page button")]
                    .filter((el) => getComputedStyle(el).touchAction !== "manipulation")
                    .map((el) => el.tagName),
            ),
            [],
        );
        const beforeColor = await like.evaluate((el) => getComputedStyle(el).backgroundColor);
        assert.notEqual(beforeColor, "rgb(223, 32, 27)");
        const beforeInk = await like.evaluate((el) => getComputedStyle(el).color);
        assert.equal(beforeInk, "rgb(104, 107, 120)");
        await like.evaluate((el) => {
            el.setAttribute("data-liked", "");
            el.closest("[data-share-mobile]")
                .querySelectorAll("[data-like-count]")
                .forEach((count) => {
                    count.textContent = "1";
                });
        });
        assert.equal(await like.evaluate((el) => getComputedStyle(el).backgroundColor), beforeColor);
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".article-share__like")).color.startsWith("color(srgb 0.743333"));
        const toggle = page.locator("[data-share-mobile-toggle]");
        assert.equal(await toggle.isVisible(), true);
        assert.equal(await like.evaluate((el) => el.parentElement?.contains(document.querySelector("[data-share-mobile-toggle]"))), true);
        const menu = page.locator("[data-share-menu]");
        assert.equal(await menu.evaluate((el) => el.hidden), true);
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        await page.waitForFunction(
            () => getComputedStyle(document.querySelector("[data-share-mobile-toggle]")).backgroundColor === "rgb(8, 25, 174)",
        );
        assert.equal(await toggle.evaluate((el) => getComputedStyle(el).color), "rgb(255, 255, 255)");
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
        await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-share-mobile-toggle]")).color === "rgb(8, 25, 174)");
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

test("mobile like fills from personal progress, restarts finite waves, caps and restores, and honors reduced motion", async () => {
    const browser = await chromium.launch(launchOptions);
    try {
        for (const reducedMotion of ["no-preference", "reduce"]) {
            const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion, serviceWorkers: "block" });
            const page = await context.newPage();
            let votes = 0;
            await page.route("**/api/like*", (route) => {
                if (route.request().method() === "POST") votes++;
                return route.fulfill({ contentType: "application/json", body: JSON.stringify({ count: 160 + votes, userLikes: votes }) });
            });
            await page.goto(new URL("/posts/ue5-landscape-grass-en", baseURL).href, { waitUntil: "networkidle" });
            const like = page.locator(".article-share__like");
            await like.scrollIntoViewIfNeeded();
            assert.equal(
                await like.evaluate((el) => el.style.getPropertyValue("--like-progress")),
                "0",
                "other readers' total never fills personal progress",
            );
            const before = await like.boundingBox();
            await like.click();
            await page.waitForFunction(() => document.querySelector(".article-share__like").style.getPropertyValue("--like-progress") === "0.0625");
            const state = await like.evaluate((el) => ({
                transform: getComputedStyle(el).transform,
                contentTransform: getComputedStyle(el.querySelector(".article-share__like-content")).transform,
                waveCount: el
                    .querySelector(".article-share__like-liquid")
                    .getAnimations({ subtree: true })
                    .filter((a) => a instanceof CSSAnimation).length,
                transition: getComputedStyle(el.querySelector(".article-share__like-liquid")).transitionDuration,
            }));
            assert.deepEqual(await like.boundingBox(), before, "button frame stays fixed");
            assert.equal(state.transform, "none");
            assert.equal(state.contentTransform, "none");
            if (reducedMotion === "reduce") {
                assert.equal(state.waveCount, 0);
                assert.ok(parseFloat(state.transition) <= 0.00001);
            } else {
                assert.equal(state.waveCount, 2);
                await page.waitForTimeout(350);
                await like.click();
                await page.waitForTimeout(500);
                assert.equal(
                    await like.evaluate((el) => el.classList.contains("animate-pop")),
                    true,
                    "earlier click timer cannot cut off the latest wave",
                );
                await page.waitForTimeout(350);
                assert.equal(await like.evaluate((el) => el.classList.contains("animate-pop")), false, "waves settle after clicking stops");
            }
            await like.evaluate((el) => {
                for (let index = 0; index < 18; index++) el.click();
            });
            await page.waitForFunction(() => document.querySelector(".article-share__like").hasAttribute("data-like-full"));
            await page.waitForFunction(() => document.querySelector(".article-share__count [data-like-count]").textContent === "176");
            assert.equal(votes, 16, "personal cap prevents extra locally intercepted POSTs");
            assert.equal(await like.evaluate((el) => el.style.getPropertyValue("--like-progress")), "1");
            assert.equal(await like.evaluate((el) => getComputedStyle(el).color), "rgb(255, 255, 255)");
            await page.reload({ waitUntil: "networkidle" });
            assert.equal(await like.evaluate((el) => el.style.getPropertyValue("--like-progress")), "1", "reload restores saved personal progress");
            await context.close();
        }
    } finally {
        await browser.close();
    }
});
