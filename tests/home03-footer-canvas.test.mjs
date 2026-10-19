import assert from "node:assert/strict";
import test from "node:test";
import { baseURL, waitForPageAnimations } from "./helpers/browser.mjs";
import { launchNavigationBrowser } from "./helpers/navigation-browser.mjs";

test("footer canvas tint follows the document bottom and clears as its links leave view", async () => {
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
                        page.evaluate(() => {
                            const root = document.documentElement;
                            const footer = document.querySelector(".site-footer");
                            const rect = footer.getBoundingClientRect();
                            const inner = footer.firstElementChild.getBoundingClientRect();
                            const probe = document.createElement("span");
                            probe.style.backgroundColor = "color-mix(in srgb, var(--page-wash-ink, var(--color-structure)) 0%, var(--color-bg-page))";
                            footer.append(probe);
                            const base = getComputedStyle(probe).backgroundColor;
                            probe.remove();
                            return {
                                y: rect.y + scrollY,
                                height: rect.height,
                                width: rect.width,
                                contentX: inner.x,
                                contentWidth: inner.width,
                                position: getComputedStyle(footer).position,
                                canvas: getComputedStyle(root).backgroundColor,
                                base,
                                edgeStrength: Number(root.style.getPropertyValue("--footer-edge-strength")),
                                remaining: Math.round(root.scrollHeight - innerHeight - scrollY),
                                linksBottom: Math.round(footer.querySelector("nav").getBoundingClientRect().bottom),
                                overflow: root.scrollWidth > innerWidth,
                            };
                        });
                    const scrollFromBottom = async (distance) => {
                        await page.evaluate(
                            (delta) => scrollTo({ top: document.documentElement.scrollHeight - innerHeight - delta, behavior: "instant" }),
                            distance,
                        );
                        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                        await waitForPageAnimations(page);
                        return measure();
                    };
                    const initial = await measure();
                    assert.equal(initial.position, "static", "the footer must not keep Safari's bottom edge sampled while reading");
                    assert.ok(initial.contentX >= 23 && initial.contentWidth <= initial.width, "footer links retain their reading gutter");
                    const bottom = await scrollFromBottom(0);
                    assert.equal(bottom.y, initial.y, "the footer stays in normal document flow");
                    assert.equal(bottom.height, initial.height);
                    assert.equal(bottom.overflow, false);
                    if (width < 768) {
                        assert.equal(bottom.edgeStrength, 1);
                        assert.notEqual(bottom.canvas, bottom.base, "the bottom canvas samples the footer wash");
                        const away = await scrollFromBottom(24);
                        assert.equal(away.edgeStrength, 0);
                        assert.equal(away.canvas, away.base, "the tint clears when the final link row reaches the viewport edge");
                        assert.ok(Math.abs(away.linksBottom - 844) < 2);
                        const again = await scrollFromBottom(0);
                        assert.equal(again.canvas, bottom.canvas, "returning to the footer restores its tint");
                    } else {
                        assert.equal(bottom.edgeStrength, 0, "desktop canvas keeps its existing behavior");
                        assert.equal(bottom.canvas, bottom.base);
                    }
                    await page.evaluate(() => {
                        const extra = document.createElement("div");
                        extra.style.height = "240px";
                        document.querySelector("main").append(extra);
                        scrollTo({ top: 0, behavior: "instant" });
                    });
                    assert.ok(Math.abs((await measure()).y - initial.y - 240) < 1, "late content moves the footer naturally");
                    await page.close();
                }
            }
        }
    } finally {
        await browser.close();
    }
});
