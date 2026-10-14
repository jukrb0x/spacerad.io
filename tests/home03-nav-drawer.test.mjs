import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

// Sample every animation frame, not only the settled end state. Also deliberately
// try scrolling the outer dialog: focus must never move the panel's containing box.
test("mobile drawer stays right-anchored throughout first/repeated opens and route changes", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    try {
        for (const width of [320, 390, 767]) {
            await page.setViewportSize({ width, height: 844 });
            for (const reducedMotion of ["no-preference", "reduce"]) {
                await page.emulateMedia({ reducedMotion });
                for (const theme of ["light", "dark"]) {
                    await page.goto(new URL("/posts", baseURL).href, { waitUntil: "networkidle" });
                    await waitForPageAnimations(page);
                    await page.evaluate((value) => {
                        document.documentElement.dataset.theme = value;
                    }, theme);
                    for (let opening = 0; opening < 2; opening++) {
                        const origin = opening === 0 ? "[data-nav-toggle]" : "[data-search-trigger]";
                        await page.locator(origin).focus();
                        const samples = await page.evaluate(async () => {
                            const dialog = document.querySelector("[data-nav-overlay]");
                            const panel = document.querySelector("[data-nav-drawer]");
                            document.querySelector("[data-nav-toggle]").click();
                            dialog.scrollLeft = 10000;
                            const frames = [];
                            const end = performance.now() + 260;
                            do {
                                const rect = panel.getBoundingClientRect();
                                frames.push({
                                    left: rect.left,
                                    right: rect.right,
                                    width: rect.width,
                                    viewport: dialog.clientWidth,
                                    scroll: dialog.scrollLeft,
                                });
                                await new Promise(requestAnimationFrame);
                            } while (performance.now() < end);
                            return frames;
                        });
                        for (const sample of samples) {
                            assert.equal(sample.scroll, 0, "dialog cannot scroll horizontally even while the panel is offscreen");
                            assert.ok(
                                sample.left >= sample.viewport - sample.width - 1,
                                `panel overshot its right-anchored resting position: ${JSON.stringify(sample)}`,
                            );
                        }
                        const last = samples.at(-1);
                        assert.ok(Math.abs(last.right - last.viewport) <= 1, "settled panel aligns with viewport right edge");
                        assert.equal(
                            await page
                                .locator("[data-nav-link]")
                                .first()
                                .evaluate((el) => document.activeElement === el),
                            true,
                        );
                        await page.keyboard.press("Escape");
                        await page.waitForFunction(() => !document.querySelector("[data-nav-overlay]").open);
                        assert.equal(
                            await page.locator(origin).evaluate((el) => document.activeElement === el),
                            true,
                            "closing restores the actual focus origin",
                        );
                    }
                }
            }
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("[data-nav-toggle]").click();
        await page.locator('[data-nav-link][href="/tags"]').click();
        await page.waitForURL("**/tags");
        await waitForPageAnimations(page);
        assert.equal(await page.locator("[data-nav-overlay]").evaluate((el) => el.open), false);
        await page.locator("[data-nav-toggle]").click();
        await page.waitForFunction(() => document.querySelector("[data-nav-overlay]").classList.contains("is-open"));
        await page.setViewportSize({ width: 900, height: 844 });
        await page.waitForFunction(() => !document.querySelector("[data-nav-overlay]").open);
        assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "");
    } finally {
        await context.close();
        await browser.close();
    }
});
