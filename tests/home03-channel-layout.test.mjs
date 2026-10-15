import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

let browser;
before(async () => {
    browser = await chromium.launch(launchOptions);
});
after(async () => {
    await browser?.close();
});

async function open(width, theme) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
    await context.addInitScript((value) => localStorage.setItem("theme-preference", value), theme);
    const page = await context.newPage();
    await page.goto(new URL("/channel", baseURL).href);
    await page.locator(".channel-sidebar__card").waitFor();
    await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true");
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".post-card__content img").first().waitFor();
    await waitForPageAnimations(page);
    return { context, page };
}

async function geometry(page) {
    return page.evaluate(() => {
        const rect = (selector) => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height, documentY: r.y + scrollY, center: r.x + r.width / 2 };
        };
        const card = rect(".channel-sidebar__card");
        return {
            card,
            cutTop: card.y + card.height * 0.08,
            nav: rect(".site-header__inner"),
            image: rect(".post-card__content img"),
            rss: rect(".channel-sidebar__btn--ghost"),
            telegram: rect(".channel-sidebar__btn--primary"),
            avatar: rect(".channel-sidebar__avatar"),
            main: rect(".page-shell"),
            description: rect(".channel-sidebar__description"),
            label: rect(".channel-sidebar__identity"),
            clip: getComputedStyle(document.querySelector(".channel-sidebar__card")).clipPath,
            theme: document.documentElement.dataset.theme,
            overflow: document.documentElement.scrollWidth > innerWidth,
        };
    });
}

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1, `${message}: expected ${expected}, got ${actual}`);

// Catches reserving the clipped cap twice, or removing mobile post padding along with desktop padding.
for (const width of [320, 390, 960, 961, 1440]) {
    for (const theme of ["light", "dark"]) {
        test(`Channel visible spacing and content fit at ${width}px in ${theme} mode`, async () => {
            const { context, page } = await open(width, theme);
            try {
                const g = await geometry(page);
                near(g.cutTop - g.nav.y - g.nav.height, 28, "navigation-to-cut gap");
                if (width > 960) {
                    near(g.image.y, g.cutTop, "first image and visible cut align");
                } else {
                    near(g.image.y - g.rss.y - g.rss.height, 36, "RSS-to-first-image gap");
                }
                near(g.card.width, Math.min(280, g.main.width), "profile width");
                near(g.card.height, g.card.width, "profile aspect ratio");
                assert.equal(g.clip, "inset(8% 0px 0px)");
                assert.equal(g.theme, theme);
                assert.equal(g.overflow, false);
                for (const item of [g.avatar, g.telegram, g.rss]) near(item.center, g.card.center, "profile center line");
                assert.ok(g.label.y >= g.cutTop, "cut must not clip the channel label");
                assert.ok(g.description.y + g.description.height <= g.card.y + g.card.height, "description stays in the circle");
                assert.ok(g.telegram.y >= g.card.y + g.card.height, "follow links remain outside the circle");
                assert.ok(g.telegram.height >= 44 && g.rss.height >= 44, "follow links retain touch targets");
            } finally {
                await context.close();
            }
        });
    }
}

// Catches coupling sticky position or document flow to navigation visibility.
for (const theme of ["light", "dark"]) {
    test(`Channel sticky stays fixed through navigation reveal/hide in ${theme} mode`, async () => {
        const { context, page } = await open(1440, theme);
        try {
            await page.evaluate(() => scrollTo({ top: 700, behavior: "instant" }));
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await waitForPageAnimations(page);
            assert.equal(await page.locator("[data-header]").getAttribute("data-nav-hidden"), "");
            const hidden = await geometry(page);
            await page.evaluate(() => scrollTo({ top: 636, behavior: "instant" }));
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await waitForPageAnimations(page);
            assert.equal(await page.locator("[data-header]").getAttribute("data-nav-hidden"), null);
            const shown = await geometry(page);
            near(hidden.cutTop, 98, "hidden navigation sticky position");
            near(shown.cutTop, 98, "shown navigation sticky position");
            near(shown.cutTop - shown.nav.y - shown.nav.height, 28, "revealed navigation clearance");
            near(shown.main.documentY, hidden.main.documentY, "main document position stays fixed");
            near(shown.image.documentY, hidden.image.documentY, "feed document position stays fixed");
        } finally {
            await context.close();
        }
    });
}
