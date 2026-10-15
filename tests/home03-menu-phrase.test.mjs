import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

const phrases = ["太空来电", "宇宙频道", "星际广播", "I'm Jabriel", "智人大冲浪"];

test("mobile menu keeps one quiet phrase per opening and remembers it across navigation", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: "block" });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    await context.addInitScript(() => {
        Math.random = () => 0;
    });
    const page = await context.newPage();
    try {
        await page.goto(new URL("/posts", baseURL).href, { waitUntil: "networkidle" });
        const phrase = page.locator("[data-nav-phrase]");
        assert.equal(await phrase.count(), 1, "menu has a decorative footer phrase");
        assert.equal(await phrase.getAttribute("aria-hidden"), "true");
        assert.equal(await phrase.getAttribute("aria-live"), null);
        let previous = "";
        for (let i = 0; i < 6; i++) {
            await page.locator("[data-nav-toggle]").click();
            await waitForPageAnimations(page);
            const current = await phrase.textContent();
            assert.ok(phrases.includes(current));
            assert.notEqual(current, previous);
            assert.equal(
                await page
                    .locator("[data-nav-link]")
                    .first()
                    .evaluate((el) => document.activeElement === el),
                true,
            );
            previous = current;
            if (i === 0) {
                await page.waitForTimeout(2800);
                assert.equal(await phrase.textContent(), current, "no autoplay or expiry while open");
                assert.equal(await phrase.isVisible(), true);
            }
            await page.keyboard.press("Escape");
            await page.waitForFunction(() => !document.querySelector("[data-nav-overlay]").open);
            assert.equal(await page.locator("[data-nav-toggle]").evaluate((el) => document.activeElement === el), true);
        }
        await page.locator("[data-nav-toggle]").click();
        await waitForPageAnimations(page);
        previous = await phrase.textContent();
        await page.locator('[data-nav-link][href="/tags"]').click();
        await page.waitForURL("**/tags");
        await waitForPageAnimations(page);
        assert.equal(await page.locator("[data-nav-overlay]").evaluate((el) => el.open), false);
        await page.locator("[data-nav-toggle]").click();
        await waitForPageAnimations(page);
        assert.notEqual(await phrase.textContent(), previous, "route swap retains the previous phrase choice");
        await page.keyboard.press("Tab");
        assert.equal(await page.locator("[data-nav-overlay]").evaluate((el) => el.contains(document.activeElement)), true);
        assert.equal(await phrase.evaluate((el) => el.tabIndex), -1);
        assert.equal(await page.locator("[data-wordmark-whisper]").getAttribute("data-visible"), null, "touch header remains quiet");
    } finally {
        await context.close();
        await browser.close();
    }
});

test("menu footer stays reachable on narrow and short screens in both themes and motion preferences", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    try {
        await page.goto(new URL("/posts", baseURL).href, { waitUntil: "networkidle" });
        for (const viewport of [
            { width: 320, height: 240 },
            { width: 390, height: 844 },
            { width: 767, height: 320 },
        ]) {
            await page.setViewportSize(viewport);
            for (const reducedMotion of ["reduce", "no-preference"]) {
                await page.emulateMedia({ reducedMotion });
                for (const theme of ["light", "dark"]) {
                    await page.evaluate((value) => {
                        document.documentElement.dataset.theme = value;
                    }, theme);
                    await page.evaluate(() => new Promise(requestAnimationFrame));
                    await waitForPageAnimations(page);
                    await page.locator("[data-nav-toggle]").click();
                    await waitForPageAnimations(page);
                    const layout = await page.locator("[data-nav-drawer]").evaluate((panel) => {
                        const phrase = panel.querySelector("[data-nav-phrase]");
                        const nav = panel.querySelector("nav");
                        const top = panel.querySelector("div");
                        panel.scrollTop = panel.scrollHeight;
                        const p = phrase.getBoundingClientRect();
                        const bounds = panel.getBoundingClientRect();
                        const css = getComputedStyle(phrase);
                        return {
                            phrase: p.toJSON(),
                            panel: bounds.toJSON(),
                            navBottom: nav.getBoundingClientRect().bottom,
                            topHeight: top.getBoundingClientRect().height,
                            overflowX: panel.scrollWidth > panel.clientWidth,
                            bottomPadding: Number.parseFloat(getComputedStyle(panel).paddingBottom),
                            color: css.color,
                            background: getComputedStyle(panel).backgroundColor,
                            animations: phrase
                                .getAnimations()
                                .filter((animation) => !["color", "scrollbar-color"].includes(animation.transitionProperty)).length,
                        };
                    });
                    assert.equal(layout.overflowX, false);
                    assert.ok(layout.phrase.top >= layout.navBottom, "footer never overlaps navigation");
                    assert.ok(layout.phrase.bottom <= viewport.height - layout.bottomPadding + 1, "footer can scroll clear of the viewport edge");
                    assert.ok(layout.phrase.left >= layout.panel.left && layout.phrase.right <= viewport.width);
                    assert.ok(layout.topHeight >= 44, "close control keeps its touch target on short screens");
                    assert.notEqual(layout.color, layout.background);
                    assert.equal(layout.animations, 0, "only existing theme color transitions may affect the phrase");
                    await page.keyboard.press("Escape");
                    await page.waitForFunction(() => !document.querySelector("[data-nav-overlay]").open);
                }
            }
        }
    } finally {
        await context.close();
        await browser.close();
    }
});
