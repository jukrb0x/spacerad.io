import assert from "node:assert/strict";
import test from "node:test";
import { baseURL, waitForPageAnimations } from "./helpers/browser.mjs";
import { launchNavigationBrowser, navigationBrowserName, touchPan } from "./helpers/navigation-browser.mjs";

async function fixture(theme = "dark", reducedMotion = "reduce", isMobile = true) {
    const browser = await launchNavigationBrowser();
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile,
        reducedMotion,
        serviceWorkers: "block",
    });
    await context.addInitScript((value) => localStorage.setItem("theme-preference", value), theme);
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    await page.goto(new URL("/posts", baseURL).href, { waitUntil: "networkidle" });
    const toggle = page.locator("[data-nav-toggle]");
    const first = page.locator("[data-nav-overlay] [data-nav-link]").first();
    const close = async (method = "escape") => {
        if (method === "button") await page.locator("[data-nav-drawer] [data-nav-close]").tap();
        else if (method === "backdrop") await page.touchscreen.tap(16, 180);
        else await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("[data-nav-overlay]").open);
        assert.equal(await toggle.evaluate((el) => document.activeElement === el), true, "closing restores the trigger");
    };
    const open = async () => {
        await toggle.tap();
        await page.waitForFunction(() => document.activeElement === document.querySelector("[data-nav-overlay] [data-nav-link]"));
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

const navHidden = (page) => page.locator("[data-header]").evaluate((el) => el.hasAttribute("data-nav-hidden"));

test("touch return focus permits scroll-driven retraction in the selected engine", async () => {
    const f = await fixture();
    const scroll = async (top) => {
        await f.page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top);
        await f.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await waitForPageAnimations(f.page);
    };
    try {
        await scroll(700);
        await scroll(636);
        await f.open();
        await f.close("button");
        await scroll(720);
        assert.equal(await navHidden(f.page), true, "touch-restored focus does not override downward scroll intent");
        await scroll(636);
        assert.equal(await navHidden(f.page), false);
    } finally {
        await f.context.close();
        await f.browser.close();
    }
});

test("wheel reading after keyboard Escape retracts navigation without a click or layout shift", async () => {
    const f = await fixture("dark", "reduce", false);
    const scroll = async (top) => {
        await f.page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top);
        await f.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const geometry = () =>
        f.page.evaluate(() => ({
            main: document.querySelector("main").getBoundingClientRect().top + scrollY,
            height: document.documentElement.scrollHeight,
        }));
    try {
        await f.page.evaluate(() => document.fonts.ready);
        await scroll(700);
        await scroll(636);
        await f.toggle.focus();
        await f.page.keyboard.press("Enter");
        await f.page.waitForFunction(() => document.activeElement === document.querySelector("[data-nav-overlay] [data-nav-link]"));
        await f.close("escape");
        await scroll(716);
        assert.equal(await navHidden(f.page), false, "keyboard return focus holds the control visible");
        assert.equal(await f.toggle.evaluate((el) => document.activeElement === el && el.matches(":focus-visible")), true);
        const before = await geometry();
        await f.page.mouse.move(170, 500);
        await f.page.mouse.wheel(0, 180);
        await f.page.waitForFunction(() => scrollY > 740);
        await f.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await navHidden(f.page), true, "wheel resumes reading without clicking or blurring restored focus");
        assert.deepEqual(await geometry(), before, "retracting navigation preserves document geometry");
    } finally {
        await f.context.close();
        await f.browser.close();
    }
});

async function revealWithTouch(page) {
    await touchPan(page, -380);
    assert.equal(await navHidden(page), true, "downward touch reading retracts navigation");
    await touchPan(page, 140);
    await waitForPageAnimations(page);
    assert.equal(await navHidden(page), false, "upward touch reading reveals navigation");
}

for (const motion of ["reduce", "no-preference"]) {
    test(
        `touch scroll resumes after drawer close without clearing return focus (${motion})`,
        { skip: navigationBrowserName !== "chromium" },
        async () => {
            const f = await fixture("dark", motion);
            try {
                await revealWithTouch(f.page);
                for (const method of ["button", "backdrop", "escape"]) {
                    const before = await f.page.evaluate(() => scrollY);
                    await f.open();
                    assert.equal(await f.page.locator("body").evaluate((el) => el.style.overflow), "hidden");
                    await touchPan(f.page, -180);
                    assert.equal(await f.page.evaluate(() => scrollY), before, "the open drawer keeps background reading locked");
                    assert.equal(await navHidden(f.page), false, "navigation stays visible while the drawer is open");
                    await f.close(method);
                    assert.equal(await f.page.locator("body").evaluate((el) => el.style.overflow), "");
                    // No click, blur or focus change between restored trigger focus and
                    // the pan: touching reading content need not clear button focus.
                    await touchPan(f.page, -180);
                    assert.ok((await f.page.evaluate(() => scrollY)) > before + 24, "touch scrolling is unlocked");
                    assert.equal(await navHidden(f.page), true, "restored focus must not pin navigation during touch reading");
                    assert.equal(await f.page.locator(".site-header__inner").evaluate((el) => el.inert), true);
                    await touchPan(f.page, 140);
                    await waitForPageAnimations(f.page);
                    assert.equal(await navHidden(f.page), false);
                    assert.equal(await f.page.locator(".site-header__inner").evaluate((el) => el.inert), false);
                }
            } finally {
                await f.context.close();
                await f.browser.close();
            }
        },
    );
}

test("keyboard return focus holds navigation until touch reading resumes", { skip: navigationBrowserName !== "chromium" }, async () => {
    const f = await fixture();
    try {
        await revealWithTouch(f.page);
        await f.toggle.focus();
        await f.page.keyboard.press("Enter");
        await waitForPageAnimations(f.page);
        await f.close("escape");
        const before = await f.page.evaluate(() => scrollY);
        await f.page.evaluate(() => scrollTo({ top: scrollY + 80, behavior: "instant" }));
        await f.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await navHidden(f.page), false, "keyboard return focus keeps the control visible");
        assert.equal(await f.toggle.evaluate((el) => document.activeElement === el && el.matches(":focus-visible")), true);
        await touchPan(f.page, -180);
        assert.ok((await f.page.evaluate(() => scrollY)) > before + 104);
        assert.equal(await navHidden(f.page), true, "touch after Escape releases only the visibility hold");
        await touchPan(f.page, 140);
        assert.equal(await navHidden(f.page), false);
    } finally {
        await f.context.close();
        await f.browser.close();
    }
});

test("drawer route cleanup leaves touch scrolling and repeated opens working", { skip: navigationBrowserName !== "chromium" }, async () => {
    const f = await fixture();
    try {
        const notes = '<article class="channel-entry"><p>A local channel note for scrolling.</p></article>'.repeat(20);
        await f.context.route("**/api/latest-channel", (route) =>
            route.fulfill({
                contentType: "text/html",
                body: `<div class="channel-index">${notes}</div>`,
            }),
        );
        await revealWithTouch(f.page);
        await f.open();
        await f.page.evaluate(() => {
            window.previousNavigation = document.querySelector(".site-header__inner");
            window.drawerSwaps = 0;
            document.addEventListener("astro:before-swap", () => window.drawerSwaps++, { once: true });
        });
        await f.page.locator('[data-nav-link][href="/"]').tap();
        await f.page.waitForURL(new URL("/", baseURL).href);
        await f.page.waitForFunction(
            () =>
                window.previousNavigation?.isConnected === false &&
                document.querySelector("[data-header]")?.style.getPropertyValue("--navigation-height"),
        );
        await f.page.waitForFunction(() => !document.querySelector("[data-latest-channel]")?.textContent.includes("Loading"));
        await waitForPageAnimations(f.page);
        assert.equal(await f.page.evaluate(() => window.drawerSwaps), 1, "the route uses one Astro SPA swap");
        assert.equal(await f.page.locator("[data-nav-overlay]").evaluate((el) => el.open), false);
        assert.equal(await f.page.locator("body").evaluate((el) => el.style.overflow), "");
        await revealWithTouch(f.page);
        await f.open();
        await f.close("button");
        await touchPan(f.page, -180);
        assert.equal(await navHidden(f.page), true);
        await touchPan(f.page, 140);
        assert.equal(await navHidden(f.page), false);
        await touchPan(f.page, 380);
        await touchPan(f.page, 380);
        await waitForPageAnimations(f.page);
        assert.equal(await f.page.evaluate(() => scrollY), 0);
        assert.equal(
            await f.page.locator("[data-header]").evaluate((el) => el.hasAttribute("data-nav-floating")),
            false,
            "upward reading hands back to document flow",
        );
    } finally {
        await f.context.close();
        await f.browser.close();
    }
});
