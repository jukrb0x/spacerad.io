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
async function open(width, theme, reducedMotion = "no-preference") {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion, serviceWorkers: "block" });
    await context.addInitScript((theme) => localStorage.setItem("theme-preference", theme), theme);
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    // Keep unrelated asynchronous feed sizing out of the header geometry measurement.
    await context.route("**/api/latest-channel", (route) =>
        route.fulfill({
            contentType: "text/html",
            body: '<div class="channel-index"><article class="channel-entry"><p>Channel fixture</p></article></div>',
        }),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    return { context, page, errors };
}
async function go(page, path = "/") {
    await page.goto(new URL(path, baseURL).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true");
    await waitForPageAnimations(page);
    if (path === "/") await page.waitForFunction(() => !document.querySelector("[data-latest-channel]").textContent.includes("Loading"));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function scroll(page, y) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await waitForPageAnimations(page);
    return page.evaluate(() => window.scrollY);
}
const navBox = (page) => page.locator(".site-header__inner").boundingBox();
const geometry = (page) =>
    page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        main: document.querySelector("main").getBoundingClientRect().top + scrollY,
        header: document.querySelector("[data-header]").offsetHeight,
    }));
async function reveal(page) {
    const y = await scroll(page, 700);
    await page.mouse.click(1, 400);
    await scroll(page, y - 64);
    const box = await navBox(page);
    assert.ok(box.y >= -1 && box.y < 2, `scroll-up navigation remains offscreen: ${JSON.stringify(box)}`);
    return y - 64;
}

// Hover utilities must not override article control ink on the parent or mobile SVG.
for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
        test(`social hover and keyboard focus retain palette (${width}px ${theme})`, async () => {
            const { context, page, errors } = await open(width, theme);
            try {
                await go(page, "/posts/introducing-space-radio");
                await page.locator("[data-share-mobile-toggle]").click();
                const buttons = page.locator("[data-share-menu-item]");
                const token = await page.locator("body").evaluate((el) => getComputedStyle(el).getPropertyValue("--article-control-ink").trim());
                assert.notEqual(token, "", "article control ink must be defined");
                const expected = await page.locator("body").evaluate((el) => {
                    const probe = document.createElement("span");
                    probe.style.color = "var(--article-control-ink)";
                    el.append(probe);
                    const ink = getComputedStyle(probe).color;
                    probe.remove();
                    return ink;
                });
                assert.ok((await buttons.count()) >= 3, "share controls must be present");
                assert.equal(await page.locator("[data-share-mobile] [data-like-button]").isVisible(), true);
                assert.equal(await page.locator("[data-share-sidebar]").count(), 0);
                for (let i = 0; i < (await buttons.count()); i++) {
                    const button = buttons.nth(i);
                    await button.hover();
                    await waitForPageAnimations(page);
                    const hover = await button.evaluate((el) => ({
                        color: getComputedStyle(el).color,
                        icon: getComputedStyle(el.querySelector("svg")).color,
                    }));
                    assert.equal(hover.color, expected);
                    assert.equal(hover.icon, expected);
                    await page.mouse.move(1, 1);
                    await page.keyboard.press("Tab");
                    await button.focus();
                    await waitForPageAnimations(page);
                    const focus = await button.evaluate((el) => ({
                        visible: el.matches(":focus-visible"),
                        width: parseFloat(getComputedStyle(el).outlineWidth),
                        style: getComputedStyle(el).outlineStyle,
                        color: getComputedStyle(el).outlineColor,
                    }));
                    assert.ok(focus.visible && focus.width >= 2 && focus.style === "solid", JSON.stringify(focus));
                    assert.equal(focus.color, expected);
                }
                assert.deepEqual(errors, []);
            } finally {
                await context.close();
            }
        });

        // Normal-flow-only headers, floating the whole hero, or removing reserved space must fail.
        test(`scroll-up reveals only navigation without layout shift (${width}px ${theme})`, async () => {
            const { context, page, errors } = await open(width, theme);
            try {
                await go(page);
                const before = await geometry(page);
                const flowOrigin = (await navBox(page)).y;
                const y = await scroll(page, 700);
                const hidden = await navBox(page);
                assert.ok(hidden.y + hidden.height <= 1, "navigation should hide after scrolling down");
                await scroll(page, y - 3);
                assert.ok((await navBox(page)).y < -10, "tiny reverse jitter must not reveal navigation");
                await scroll(page, y - 64);
                const visible = await navBox(page);
                assert.ok(visible.y >= -1 && visible.y < 2, `scroll-up reveal missing: ${JSON.stringify(visible)}`);
                assert.ok(visible.height <= 80, "only the navigation bar should float");
                assert.ok(await page.locator(".home-profile").evaluate((el) => el.getBoundingClientRect().bottom < 0), "hero must remain offscreen");
                assert.deepEqual(await geometry(page), before);
                await page.locator("[data-search-trigger]").click();
                assert.equal(await page.locator("[data-search-overlay]").evaluate((el) => el.open), true);
                assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "hidden");
                await page.keyboard.press("Escape");
                await page.waitForFunction(() => !document.querySelector("[data-search-overlay]").open);
                if (width < 768) {
                    await page.locator("[data-nav-toggle]").click();
                    assert.equal(await page.locator("[data-nav-overlay]").evaluate((el) => el.open), true);
                    await waitForPageAnimations(page);
                    await page.keyboard.press("Escape");
                    await page.waitForFunction(() => !document.querySelector("[data-nav-overlay]").open);
                }
                // Floating-to-flow handoff near the top must tolerate a few pixels of reversal.
                await page.mouse.click(1, 400);
                let returnedToFlow = false;
                for (const top of [45, 47, 43, 30, 32, 25, 27, 17, 16, 15, 1, 0, 2, 0]) {
                    await scroll(page, top);
                    const box = await navBox(page);
                    if (top <= flowOrigin) returnedToFlow = true;
                    const expectedTop = returnedToFlow ? flowOrigin - top : 0;
                    assert.ok(Math.abs(box.y - expectedTop) <= 1, `near-top header handoff at ${top}: ${JSON.stringify(box)}`);
                    assert.ok(box.y + box.height >= box.height / 4, "near-top navigation must remain visible");
                }
                assert.deepEqual(await geometry(page), before);
                assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "");
                assert.deepEqual(errors, []);
            } finally {
                await context.close();
            }
        });
    }

for (const width of [1440, 390]) {
    test(`reduced-motion reveal stays instant, including runtime preference changes (${width}px)`, async () => {
        const { context, page, errors } = await open(width, "dark", "reduce");
        try {
            await go(page);
            await reveal(page);
            assert.ok(
                await page.locator(".site-header__inner").evaluate((el) =>
                    getComputedStyle(el)
                        .transitionDuration.split(",")
                        .every((duration) => parseFloat(duration) <= 0.01),
                ),
            );
            await page.emulateMedia({ reducedMotion: "no-preference" });
            await page.emulateMedia({ reducedMotion: "reduce" });
            await reveal(page);
            assert.deepEqual(errors, []);
        } finally {
            await context.close();
        }
    });
}

test("repeated route swaps dispose old floating navigation and restore current controls", async () => {
    const { context, page, errors } = await open(390, "light");
    try {
        await go(page);
        for (let i = 0; i < 4; i++) {
            await reveal(page);
            await page.evaluate(() => {
                window.oldHeader = document.querySelector("[data-header]");
            });
            await page.locator("[data-nav-toggle]").click();
            await page.locator('[data-nav-link][href="/posts"]').click();
            await page.waitForURL(new URL("/posts", baseURL).href);
            await waitForPageAnimations(page);
            await page.evaluate(() => {
                window.oldHeaderState = oldHeader.outerHTML;
            });
            assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "");
            await page.locator(".site-brand").click();
            await page.waitForURL(new URL("/", baseURL).href);
            await waitForPageAnimations(page);
            await reveal(page);
            assert.ok(await page.evaluate(() => !oldHeader.isConnected && oldHeader.outerHTML === oldHeaderState));
            await page.locator("[data-search-trigger]").click();
            await page.keyboard.press("Escape");
            await page.waitForFunction(() => !document.querySelector("[data-search-overlay]").open);
        }
        assert.deepEqual(errors, []);
    } finally {
        await context.close();
    }
});

// A placeholder accidentally sharing heading selectors must fail before any scroll.
test("headings keep their intrinsic content height", async () => {
    const { context, page } = await open(1440, "light");
    try {
        await go(page);
        assert.ok((await page.locator(".home-profile h1").boundingBox()).height < 50, "Home heading must remain a single intrinsic line");
        await go(page, "/posts/introducing-space-radio");
        const heading = page.locator("#main-content h2").first();
        const size = await heading.evaluate((el) => ({
            height: el.getBoundingClientRect().height,
            line: parseFloat(getComputedStyle(el).lineHeight),
        }));
        assert.ok(size.height <= size.line + 1, `short article heading should size to its line: ${JSON.stringify(size)}`);
    } finally {
        await context.close();
    }
});
