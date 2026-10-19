import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

test("UI language respects browser, persists explicit choice, and survives SPA/mobile controls", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ locale: "zh-CN", viewport: { width: 1440, height: 960 }, serviceWorkers: "block" });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    try {
        await page.goto(new URL("/", baseURL).href);
        await page.waitForFunction(() => document.querySelector(".nav-link")?.textContent === "博客");
        assert.equal(await page.locator("html").getAttribute("data-ui-language"), "zh");
        assert.equal(await page.locator('[data-ui-lang="zh"]').isVisible(), true);
        await page.locator(".site-header [data-language-toggle]").click();
        await page.waitForFunction(() => document.documentElement.dataset.uiLanguage === "en");
        assert.equal(await page.evaluate(() => localStorage.getItem("ui-language")), "en");
        assert.equal(await page.locator(".site-header [data-language-toggle] svg").count(), 1, "language icon survives switching");
        assert.equal(await page.locator('[data-ui-lang="en"]').isVisible(), true);
        assert.equal(await page.locator('[data-ui-lang="zh"]').isVisible(), false);
        const englishCards = await page.locator('[data-ui-lang="en"] h3 a').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
        assert(
            englishCards.some((href) => href.endsWith("-en")),
            "available English translation is the main home card",
        );
        await page.locator('.site-header__links a[href="/posts"]').click();
        await page.waitForURL("**/posts");
        await waitForPageAnimations(page);
        assert.equal(await page.locator("html").getAttribute("data-ui-language"), "en");
        await page.reload();
        await page.waitForFunction(() => document.querySelector(".nav-link")?.textContent === "Blog");
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("[data-nav-toggle]").click();
        await page.locator("[data-nav-overlay][open] [data-language-toggle]").click();
        assert.equal(await page.locator("html").getAttribute("data-ui-language"), "zh");
        assert.equal(
            await page
                .locator('[data-nav-overlay] a[href="/posts"]')
                .textContent()
                .then((s) => s.trim()),
            "博客",
        );
        await page.keyboard.press("Escape");
        await page.setViewportSize({ width: 1440, height: 960 });
        await page.locator(".site-header [data-language-toggle]").click();
        assert.equal(await page.locator("html").getAttribute("data-ui-language"), "en", "exactly one toggle listener after navigation");
    } finally {
        await context.close();
        await browser.close();
    }
});
