import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

let browser;
before(async () => {
    browser = await chromium.launch(launchOptions);
});
after(async () => {
    await browser?.close();
});

for (const width of [320, 390, 430, 768, 1440]) {
    for (const theme of ["light", "dark"]) {
        test(`editorial content fits ${width}px in ${theme} mode`, async () => {
            const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
            await context.addInitScript((value) => localStorage.setItem("theme-preference", value), theme);
            await context.route("**/api/latest-channel", (route) =>
                route.fulfill({
                    contentType: "text/html",
                    body: '<div class="channel-index"><article class="channel-entry"><time>2026.10.07</time><p>Short note</p></article><article class="channel-entry"><time>2026.08.31</time><p>A longer note with a link https://example.com/a-long-path-to-check-wrapping</p></article><article class="channel-entry"><time>2026.08.28</time><p>Third note</p></article></div>',
                }),
            );
            const page = await context.newPage();
            try {
                await page.goto(new URL("/", baseURL).href);
                await page.locator(".channel-entry").first().waitFor();
                assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                if (width < 768) {
                    assert.equal(await page.locator(".lead-post h3").evaluate((el) => getComputedStyle(el).textWrap), "wrap");
                    const section = await page.locator(".home-channel").boundingBox();
                    const identity = await page.locator(".home-channel__identity").boundingBox();
                    assert.ok(Math.abs(section.x - identity.x) < 1);
                    assert.ok(identity.width <= section.width * 0.81);
                    assert.ok(identity.width >= section.width * 0.4);
                    const heading = await page.locator(".home-channel__identity h2").boundingBox();
                    const entry = await page.locator(".home-channel__identity > span").boundingBox();
                    assert.ok(entry.y >= heading.y + heading.height);
                    const first = await page.locator(".channel-entry").nth(0).boundingBox();
                    const second = await page.locator(".channel-entry").nth(1).boundingBox();
                    assert.ok(second.y - first.y - first.height <= 29, "notes retain a compact fixed gap");
                }
                await page.goto(new URL("/posts", baseURL).href);
                assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
                const row = page.locator("li").filter({ has: page.locator('a[data-post-id="ue5-landscape-grass-en"]') });
                const translation = row.locator(width < 768 ? ".mobile-translation" : ".post-item__translation");
                assert.equal(await translation.getAttribute("href"), "/posts/ue5-landscape-grass");
                assert.equal(await translation.getAttribute("hreflang"), "zh");

                if (width < 768) {
                    assert.ok((await translation.boundingBox()).height >= 44);
                    const metadata = await row.locator(".mobile-post-meta").boundingBox();
                    const title = await row.locator(".post-item").boundingBox();
                    assert.ok(metadata.y + metadata.height <= title.y);
                    assert.ok(title.y - metadata.y - metadata.height <= 11);
                }
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            } finally {
                await context.close();
            }
        });
    }
}
