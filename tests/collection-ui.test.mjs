import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

test("collection controls and responsive overlays stay consistent", async () => {
    const b = await chromium.launch(launchOptions);
    try {
        const p = await b.newPage({ viewport: { width: 1164, height: 900 }, locale: "en-GB" });
        p.setDefaultTimeout(10000);
        await p.addInitScript(() =>
            document.addEventListener("astro:page-load", () => {
                window.__pageReady = true;
            }),
        );
        await p.goto(new URL("/beer-collection", baseURL).href);
        await p.waitForFunction(() => window.__pageReady);
        await p.locator(".collection-tile").first().waitFor();
        assert.equal(await p.locator(".collection-tile").count(), 12);
        assert.equal(await p.locator('[data-collection-open="collection-beer-flight-mode"] img').count(), 1);
        const tools = await p
            .locator(".site-header [data-search-trigger], .site-header [data-language-toggle], .site-header [data-theme-toggle]")
            .evaluateAll((es) =>
                es.map((e) => ({
                    search: e.hasAttribute("data-search-trigger"),
                    x: e.getBoundingClientRect().x,
                    width: e.getBoundingClientRect().width,
                })),
            );
        assert(tools[0].search);
        assert.equal(tools[1].x - tools[0].x - tools[0].width, 4);
        assert.equal(tools[2].x - tools[1].x - tools[1].width, 4);
        for (const sel of ["[data-language-toggle]", "[data-search-trigger]", "[data-theme-toggle]"]) {
            const el = p.locator(`.site-header ${sel}`);
            await el.hover();
            await p.waitForTimeout(300);
            assert.equal(await el.evaluate((e) => getComputedStyle(e).backgroundColor), "color(srgb 0.0313726 0.0980392 0.682353 / 0.06)");
            assert.equal((await el.boundingBox()).width, 44);
        }
        await p.locator('.site-header a[href="/channel"]').hover();
        const styles = await p
            .locator('.site-header a[href="/channel"], .site-header summary[data-active]')
            .evaluateAll((es) => es.map((e) => [getComputedStyle(e).textDecorationThickness, getComputedStyle(e).textUnderlineOffset]));
        assert.deepEqual(styles, [
            ["2px", "5px"],
            ["2px", "5px"],
        ]);
        for (const width of [1164, 768, 559, 390, 320]) {
            await p.setViewportSize({ width, height: 900 });
            const tile = p.locator(".collection-tile").first();
            await tile.hover();
            await p.waitForTimeout(400);
            const r = await tile.evaluate((e) => {
                const t = e.getBoundingClientRect(),
                    m = e.querySelector(".collection-tile__meta").getBoundingClientRect();
                return { gap: t.bottom - m.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert(r.gap >= 11 && r.gap <= 17, JSON.stringify({ width, ...r }));
            assert(!r.overflow);
        }
        await p.setViewportSize({ width: 1164, height: 1100 });
        await p.mouse.move(0, 0);
        await p.locator('[data-collection-open="collection-beer-sangria-de-cava"]').click();
        await p.locator("dialog[open]").waitFor({ state: "visible" });
        await p.keyboard.press("Escape");
    } finally {
        await b.close();
    }
});
