import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

for (const mobile of [false, true]) {
    test(`navigation feedback follows real SPA completion (${mobile ? "touch" : "desktop"})`, async () => {
        const browser = await chromium.launch(launchOptions);
        const page = await browser.newPage({
            viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
            hasTouch: mobile,
            isMobile: mobile,
        });
        try {
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.goto(`${baseURL}/posts`);
            await page.locator("[data-navigation-feedback]").waitFor({ state: "attached" });
            await page.route(`${baseURL}/`, async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 800));
                await route.continue();
            });
            await page.locator(".site-brand").click();
            await page.waitForFunction(() => document.querySelector(".site-brand")?.dataset.loading === "active");
            assert.equal(await page.locator("[data-navigation-feedback]").getAttribute("data-loading"), null);
            assert.equal(await page.locator(".site-brand .motion-track i").evaluate((el) => getComputedStyle(el).animationName), "navigation-rail");
            await page.waitForURL(`${baseURL}/`, { waitUntil: "commit" });
            await page.waitForFunction(() => document.querySelector(".site-brand")?.dataset.loading === "settled");
            assert.equal(
                await page.locator(".site-brand__text").evaluate((el) => getComputedStyle(el, "::before").clipPath),
                "inset(0px 0px 0px 100%)",
            );
            await page.route(`${baseURL}/posts`, async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 800));
                await route.continue();
            });
            // Use a real anchor even when the desktop navigation is hidden on mobile.
            await page.evaluate(() => {
                const link = document.createElement("a");
                link.href = "/posts";
                link.textContent = "Archive";
                document.body.append(link);
                link.click();
            });
            await page.waitForFunction(() => document.querySelector("[data-navigation-feedback]")?.dataset.loading === "active");
            const panel = page.locator("[data-navigation-feedback]");
            assert.equal(await panel.evaluate((el) => getComputedStyle(el).position), "fixed");
            await page.waitForURL(`${baseURL}/posts`, { waitUntil: "commit" });
            await page.waitForFunction(() => document.querySelector("[data-navigation-feedback]")?.dataset.loading === "settled");
            assert.equal(await panel.evaluate((el) => getComputedStyle(el).visibility), "hidden");
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });
}

test("interrupted and repeated SPA navigation hands feedback to the latest destination", async () => {
    const browser = await chromium.launch(launchOptions);
    const page = await browser.newPage();
    try {
        await page.goto(`${baseURL}/posts`);
        await page.route(`${baseURL}/friends`, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await route.continue().catch(() => {});
        });
        await page.route(`${baseURL}/`, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 500));
            await route.continue().catch(() => {});
        });
        const go = async (path) =>
            page.evaluate((href) => {
                const link = document.createElement("a");
                link.href = href;
                document.body.append(link);
                link.click();
                link.remove();
            }, path);
        for (let repeat = 0; repeat < 2; repeat++) {
            await go("/friends");
            await page.waitForFunction(() => document.querySelector("[data-navigation-feedback]")?.dataset.loading === "active");
            // Astro may emit an older page-load while a new destination is still fetching.
            await page.evaluate(() => document.dispatchEvent(new Event("astro:page-load")));
            await page.waitForTimeout(380);
            assert.equal(await page.locator("[data-navigation-feedback]").getAttribute("data-loading"), "active");
            await page.locator(".site-brand").click();
            await page.waitForFunction(() => document.querySelector(".site-brand")?.dataset.loading === "active");
            assert.equal(await page.locator("[data-navigation-feedback]").getAttribute("data-loading"), null);
            await page.waitForURL(`${baseURL}/`, { waitUntil: "commit" });
            await page.waitForFunction(() => document.querySelector(".site-brand")?.dataset.loading === "settled");
            await page.waitForTimeout(600);
            assert.equal(await page.locator("[data-navigation-feedback]").getAttribute("data-loading"), null);
            // A fresh hover must work after the swapped Header completes its wipe.
            await page.mouse.move(0, 0);
            await page.locator(".site-brand").hover();
            await page.waitForTimeout(220);
            assert.equal(await page.locator(".site-brand__text").evaluate((el) => getComputedStyle(el, "::before").clipPath), "inset(0px)");
            await go("/posts");
            await page.waitForURL(`${baseURL}/posts`, { waitUntil: "commit" });
            await page.waitForFunction(() => document.querySelector("[data-navigation-feedback]")?.dataset.loading !== "active");
        }
        await go("/posts#main-content");
        await page.waitForTimeout(250);
        assert.notEqual(await page.locator("[data-navigation-feedback]").getAttribute("data-loading"), "active");
    } finally {
        await browser.close();
    }
});
