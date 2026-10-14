import assert from "node:assert/strict";
import test from "node:test";
import { chromium, webkit } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

const engine = process.env.PLAYWRIGHT_ENGINE === "webkit" ? webkit : chromium;

async function fixture(theme = "dark", reducedMotion = "reduce") {
    const browser = await engine.launch(engine === webkit ? { headless: true } : launchOptions);
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        reducedMotion,
        serviceWorkers: "block",
    });
    await context.addInitScript((value) => localStorage.setItem("theme-preference", value), theme);
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    await page.goto(new URL("/posts", baseURL).href, { waitUntil: "networkidle" });
    const toggle = page.locator("[data-nav-toggle]");
    const first = page.locator("[data-nav-link]").first();
    const close = async (method = "escape") => {
        if (method === "button") await page.locator("[data-nav-drawer] [data-nav-close]").tap();
        else if (method === "backdrop") await page.touchscreen.tap(16, 180);
        else await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("[data-nav-overlay]").open);
        assert.equal(await toggle.evaluate((el) => document.activeElement === el), true, "closing restores the trigger");
    };
    const open = async () => {
        await toggle.tap();
        await waitForPageAnimations(page);
        assert.equal(await page.getByRole("dialog", { name: "Navigation menu" }).count(), 1);
        assert.equal(await first.evaluate((el) => document.activeElement === el), true, "initial focus stays inside the named modal");
        assert.equal(await first.evaluate((el) => getComputedStyle(el).outlineStyle), "none", "touch opening has no automatic Home focus frame");
    };
    return { browser, context, page, toggle, first, open, close };
}

test("repeated touch opens stay quiet while retaining modal focus and return focus", async () => {
    for (const theme of ["light", "dark"]) {
        for (const reducedMotion of ["reduce", "no-preference"]) {
            const f = await fixture(theme, reducedMotion);
            try {
                assert.equal(await f.page.locator("[data-nav-overlay]").getAttribute("aria-label"), "Navigation menu");
                for (let i = 0; i < 3; i++) {
                    await f.open();
                    await f.close(["button", "backdrop", "escape"][i]);
                }
            } finally {
                await f.context.close();
                await f.browser.close();
            }
        }
    }
});

test("touch-to-keyboard switching restores visible focus and the dialog focus trap", async () => {
    const f = await fixture();
    try {
        await f.open();
        await f.page.keyboard.press("ArrowDown");
        assert.ok(await f.first.evaluate((el) => el.matches(":focus-visible") && Number.parseFloat(getComputedStyle(el).outlineWidth) >= 2));
        for (let i = 0; i < 12; i++) {
            await f.page.keyboard.press(i < 6 ? "Tab" : "Shift+Tab");
            assert.equal(
                await f.page.locator("[data-nav-overlay]").evaluate((el) => !document.hasFocus() || el.contains(document.activeElement)),
                true,
                "Tab may reach browser chrome but never the background page",
            );
        }
        await f.first.focus();
        await f.page.locator(".site-brand").evaluate((el) => el.focus());
        assert.equal(await f.first.evaluate((el) => document.activeElement === el), true, "the native modal keeps background content inert");
        await f.close();
        await f.open();
        await f.close();
        for (const key of ["Enter", "Space", "zero-detail"]) {
            await f.toggle.focus();
            if (key === "zero-detail") await f.toggle.evaluate((el) => /** @type {HTMLButtonElement} */ (el).click());
            else await f.page.keyboard.press(key);
            await waitForPageAnimations(f.page);
            assert.equal(await f.first.evaluate((el) => document.activeElement === el), true);
            assert.ok(
                await f.first.evaluate((el) => el.matches(":focus-visible") && Number.parseFloat(getComputedStyle(el).outlineWidth) >= 2),
                "keyboard activation shows Home focus",
            );
            await f.close();
            await f.open();
            await f.close();
        }
        await f.open();
        await f.page.locator('[data-nav-link][href="/tags"]').tap();
        await f.page.waitForURL("**/tags");
        await waitForPageAnimations(f.page);
        await f.open();
        await f.page.keyboard.press("ArrowDown");
        assert.ok(
            await f.page
                .locator("[data-nav-overlay]")
                .evaluate(
                    (el) => el.contains(document.activeElement) && Number.parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2,
                ),
        );
    } finally {
        await f.context.close();
        await f.browser.close();
    }
});
