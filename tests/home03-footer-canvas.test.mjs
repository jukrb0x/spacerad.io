import assert from "node:assert/strict";
import test from "node:test";
import { baseURL, waitForPageAnimations } from "./helpers/browser.mjs";
import { launchNavigationBrowser } from "./helpers/navigation-browser.mjs";

test("the real footer offers a separate bottom sampling color without moving its content", async () => {
    const browser = await launchNavigationBrowser();
    try {
        for (const width of [390, 1440]) {
            for (const theme of ["light", "dark"]) {
                for (const path of ["/posts", "/beer-collection"]) {
                    const page = await browser.newPage({ viewport: { width, height: 844 }, colorScheme: theme, reducedMotion: "reduce" });
                    await page.goto(new URL(path, baseURL).href);
                    await page.evaluate(() => document.fonts.ready);
                    await waitForPageAnimations(page);
                    const measure = () =>
                        page.locator(".site-footer").evaluate((el) => {
                            const rect = el.getBoundingClientRect();
                            const inner = el.firstElementChild.getBoundingClientRect();
                            const style = getComputedStyle(el);
                            const probe = document.createElement("span");
                            probe.style.transition = "none";
                            const strength =
                                innerWidth < 768
                                    ? document.documentElement.dataset.collection === "beer" && document.documentElement.dataset.theme === "dark"
                                        ? 6
                                        : 4
                                    : document.documentElement.dataset.collection === "beer" && document.documentElement.dataset.theme === "dark"
                                      ? 8
                                      : 5;
                            probe.style.backgroundColor = `color-mix(in srgb, var(--page-wash-ink, var(--color-structure)) ${strength}%, var(--color-bg-page))`;
                            el.append(probe);
                            const expected = getComputedStyle(probe).backgroundColor;
                            probe.remove();
                            return {
                                y: rect.y + scrollY,
                                bottom: rect.bottom,
                                height: rect.height,
                                width: rect.width,
                                contentX: inner.x,
                                contentWidth: inner.width,
                                pageWidth: document.body.getBoundingClientRect().width,
                                position: style.position,
                                color: style.backgroundColor,
                                expected,
                                canvas: getComputedStyle(document.documentElement).backgroundColor,
                                strength: document.documentElement.style.getPropertyValue("--browser-canvas-strength"),
                                edgeHit: document.elementFromPoint(innerWidth / 2, innerHeight - 4)?.closest(".site-footer") === el,
                            };
                        });
                    const initial = await measure();
                    assert.equal(initial.position, "sticky");
                    assert.ok(Math.abs(initial.width - initial.pageWidth) < 1, "the footer spans the viewport sampling edge");
                    assert.ok(initial.contentX >= 23 && initial.contentWidth < initial.width, "content keeps its reading gutter");
                    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
                    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                    await waitForPageAnimations(page);
                    const bottom = await measure();
                    assert.equal(bottom.y, initial.y, "sticky positioning does not move the natural footer");
                    assert.equal(bottom.height, initial.height);
                    assert.equal(bottom.contentWidth, initial.contentWidth);
                    assert.equal(bottom.color, bottom.expected);
                    assert.notEqual(bottom.color, bottom.canvas, "the bottom color must not recolor the top canvas");
                    assert.equal(bottom.strength, "0");
                    assert.equal(bottom.edgeHit, true);
                    await page.evaluate(() => {
                        const extra = document.createElement("div");
                        extra.style.height = "240px";
                        document.querySelector("main").append(extra);
                        scrollTo({ top: 0, behavior: "instant" });
                    });
                    assert.ok(Math.abs((await measure()).y - initial.y - 240) < 1, "late content moves the footer naturally");
                    if (width === 390) {
                        await page.locator("[data-nav-toggle]").click();
                        await waitForPageAnimations(page);
                        const color = await page.locator(".site-footer").evaluate((el) => {
                            const probe = document.createElement("span");
                            probe.style.backgroundColor = "var(--color-bg-page)";
                            el.append(probe);
                            const base = getComputedStyle(probe).backgroundColor;
                            probe.remove();
                            return { actual: getComputedStyle(el).backgroundColor, base };
                        });
                        assert.equal(color.actual, color.base, "menu state clears the footer sampling tint too");
                    }
                    await page.close();
                }
            }
        }
    } finally {
        await browser.close();
    }
});
