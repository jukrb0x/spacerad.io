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

async function assertArrow(link, name = "ri:arrow-right-up-line") {
    const icon = link.locator(`svg[data-icon="${name}"]`);
    assert.equal(await icon.count(), 1, "UI arrow is a library SVG instead of an emoji glyph");
    assert.equal(await icon.getAttribute("aria-hidden"), "true");
    assert.equal(await icon.getAttribute("focusable"), "false");
    const geometry = await icon.evaluate((svg) => {
        const style = getComputedStyle(svg);
        const parent = getComputedStyle(svg.parentElement);
        const box = svg.getBoundingClientRect();
        const linkBox = svg.closest("a, button").getBoundingClientRect();
        return {
            color: style.color,
            parentColor: parent.color,
            width: box.width,
            height: box.height,
            fontSize: Number.parseFloat(style.fontSize),
            contained: box.top >= linkBox.top - 1 && box.bottom <= linkBox.bottom + 1,
        };
    });
    assert.equal(geometry.color, geometry.parentColor, "arrow inherits the link color");
    assert.equal(await icon.locator("path").getAttribute("fill"), "currentColor");
    assert.ok(Math.abs(geometry.width - geometry.fontSize) < 1);
    assert.ok(Math.abs(geometry.height - geometry.fontSize) < 1);
    assert.ok(geometry.contained, "arrow stays aligned inside its link");
    assert.doesNotMatch(await link.textContent(), /[↗←]\uFE0F?/u);
}

for (const width of [320, 390, 1440]) {
    for (const theme of ["light", "dark"]) {
        test(`link arrows inherit color and retain labels at ${width}px in ${theme} mode`, async () => {
            const context = await browser.newContext({
                viewport: { width, height: 960 },
                isMobile: width < 768,
                hasTouch: width < 768,
                serviceWorkers: "block",
            });
            await context.addInitScript((value) => localStorage.setItem("theme-preference", value), theme);
            await context.route("**/api/latest-channel", (route) => route.abort());
            const page = await context.newPage();
            try {
                await page.goto(new URL("/", baseURL).href);
                const archive = page.getByRole("link", { name: "All posts", exact: true });
                await assertArrow(archive);
                assert.equal(await archive.getAttribute("href"), "/posts");
                const lead = page.locator(".lead-post:visible");
                const read = lead.locator(".lead-post__read");
                const label = "Continue reading";
                assert.equal(await lead.getByRole("link", { name: label, exact: true }).count(), 1);
                assert.equal(await read.getAttribute("href"), await lead.locator("h3 a").getAttribute("href"));
                await assertArrow(read);
                await assertArrow(page.getByRole("link", { name: "Read the Channel", exact: true }));
                if (width >= 768) {
                    await assertArrow(page.locator(".mobile-translation:visible").first());
                    await archive.hover();
                    await assertArrow(archive);
                    await archive.focus();
                    await assertArrow(archive);
                } else {
                    await archive.tap();
                    await page.waitForURL("**/posts");
                }
                await page.goto(new URL("/posts", baseURL).href);
                if (width >= 768) await assertArrow(page.locator(".post-item__translation").first());
                await page.goto(new URL("/posts/introducing-space-radio", baseURL).href);
                await assertArrow(page.locator(".editorial-back a"), "ri:arrow-left-line");
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
            } finally {
                await context.close();
            }
        });
    }
}
