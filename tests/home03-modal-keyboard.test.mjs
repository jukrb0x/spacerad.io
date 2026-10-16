import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { baseURL, waitForPageAnimations } from "./helpers/browser.mjs";
import { launchNavigationBrowser, navigationBrowserName, touchPan } from "./helpers/navigation-browser.mjs";

let browser;
before(async () => {
    browser = await launchNavigationBrowser();
});
after(async () => {
    await browser?.close();
});

async function open(options = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", ...options });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    await context.route("**/api/remark42-script", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    await page.goto(new URL("/posts", baseURL).href, { waitUntil: "networkidle", timeout: 45000 });
    return { context, page };
}

async function routeAction(page, action) {
    await page.evaluate(() => {
        window.modalRouteLoaded = false;
        document.addEventListener(
            "astro:page-load",
            () => {
                window.modalRouteLoaded = true;
            },
            { once: true },
        );
    });
    await action();
    await page.waitForFunction(() => window.modalRouteLoaded);
    await waitForPageAnimations(page);
}
const routeClick = (page, selector) => routeAction(page, () => page.locator(selector).first().click());
const isOpen = (page, selector) => page.locator(selector).evaluate((el) => el.open);
const locked = (page) => page.locator("body").evaluate((el) => el.style.overflow);
async function search(page) {
    await page.keyboard.press("Control+k");
    await page.waitForFunction(() => document.activeElement.matches("[data-search-input]"));
    await waitForPageAnimations(page);
}
async function closeSearch(page) {
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[data-search-overlay]").open);
}
async function openLightbox(page) {
    await page.locator("[data-nav-toggle]").click();
    await waitForPageAnimations(page);
    await routeClick(page, '[data-nav-link][href="/channel"]');
    const image = page.locator(".telegram-post-image").first();
    await image.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("[data-lightbox-counter]").textContent.startsWith("1 /"));
    return image;
}

// Cancelling the real lock's keydown used to remove Space and disable caret keys.
test("search preserves multiword key entry, caret movement and native selection", async () => {
    const { context, page } = await open();
    try {
        await routeClick(page, ".site-brand");
        await search(page);
        const input = page.locator("[data-search-input]");
        await input.pressSequentially("alpha beta");
        assert.equal(await input.inputValue(), "alpha beta");
        // WebKit on macOS uses Command+Arrow for line boundaries; Chromium uses Home/End.
        await page.keyboard.press(navigationBrowserName === "webkit" ? "Meta+ArrowLeft" : "Home");
        assert.equal(await input.evaluate((el) => el.selectionStart), 0);
        await page.keyboard.press(navigationBrowserName === "webkit" ? "Meta+Shift+ArrowRight" : "Shift+End");
        assert.deepEqual(await input.evaluate((el) => [el.selectionStart, el.selectionEnd]), [0, 10]);
        await page.keyboard.press("Backspace");
        assert.equal(await input.inputValue(), "");
        await closeSearch(page);
        assert.equal(await locked(page), "");
    } finally {
        await context.close();
    }
});

test("Space activates the real lightbox Close button and returns focus", async () => {
    const { context, page } = await open();
    try {
        const image = await openLightbox(page);
        await page.locator("button[data-lightbox-close]").focus();
        await page.keyboard.press("Space");
        assert.equal(await isOpen(page, "[data-lightbox]"), false);
        assert.equal(await image.evaluate((el) => el === document.activeElement), true);
        assert.equal(await locked(page), "");
    } finally {
        await context.close();
    }
});

test("Home and End in search keep their native defaults", async () => {
    const { context, page } = await open();
    try {
        await search(page);
        const input = page.locator("[data-search-input]");
        await input.pressSequentially("alpha");
        await page.evaluate(() => {
            window.modalKeys = [];
            window.addEventListener("keydown", (event) => window.modalKeys.push([event.key, event.defaultPrevented]));
        });
        await page.keyboard.press("Home");
        if (navigationBrowserName === "chromium") assert.equal(await input.evaluate((el) => el.selectionStart), 0);
        await page.keyboard.press("End");
        assert.deepEqual(await page.evaluate(() => window.modalKeys), [
            ["Home", false],
            ["End", false],
        ]);
        await closeSearch(page);
    } finally {
        await context.close();
    }
});

test("first Escape closes search only; second closes lightbox with focus and lock intact between", async () => {
    const { context, page } = await open();
    try {
        const image = await openLightbox(page);
        const close = page.locator("button[data-lightbox-close]");
        await close.focus();
        await search(page);
        await closeSearch(page);
        assert.equal(await isOpen(page, "[data-lightbox]"), true);
        assert.equal(await locked(page), "hidden");
        assert.equal(await close.evaluate((el) => el === document.activeElement), true);
        await page.keyboard.press("Escape");
        assert.equal(await isOpen(page, "[data-lightbox]"), false);
        assert.equal(await locked(page), "");
        assert.equal(await image.evaluate((el) => el === document.activeElement), true);
    } finally {
        await context.close();
    }
});

test("native stacked Tab keeps page focus and arrow actions out of the lower dialog", async () => {
    const { context, page } = await open();
    try {
        await openLightbox(page);
        await search(page);
        for (let i = 0; i < 12; i++) {
            await page.keyboard.press("Tab");
            assert.equal(
                await page.evaluate(() => !document.hasFocus() || !!document.activeElement.closest("[data-search-overlay]")),
                true,
                "page focus stays in the top dialog; native Tab may visit browser chrome",
            );
            if (await page.evaluate(() => document.hasFocus())) await page.keyboard.press("ArrowRight");
            assert.match(await page.locator("[data-lightbox-counter]").textContent(), /^1 \/ /);
        }
        await closeSearch(page);
        assert.equal(await isOpen(page, "[data-lightbox]"), true);
        assert.equal(await locked(page), "hidden");
        await page.keyboard.press("Escape");
        assert.equal(await isOpen(page, "[data-lightbox]"), false);
        assert.equal(await locked(page), "");
    } finally {
        await context.close();
    }
});

test("rapid search reopen and external close restore lower dialog inertness, lock and focus", async () => {
    const { context, page } = await open();
    try {
        await openLightbox(page);
        const lower = page.locator("[data-lightbox]");
        const close = page.locator("button[data-lightbox-close]");
        await close.focus();
        await search(page);
        assert.equal(await lower.evaluate((el) => el.inert), true);
        await page.keyboard.press("Escape");
        assert.equal(await lower.evaluate((el) => el.inert), true, "lower remains inert through Search's close animation");
        await search(page);
        await closeSearch(page);
        assert.equal(await lower.evaluate((el) => el.inert), false);
        assert.equal(await close.evaluate((el) => el === document.activeElement), true);
        await search(page);
        await page.locator("[data-search-overlay]").evaluate((el) => el.close());
        await page.waitForFunction(() => !document.querySelector("[data-lightbox]").inert);
        assert.equal(await close.evaluate((el) => el === document.activeElement), true);
        assert.equal(await locked(page), "hidden");
        await page.keyboard.press("Escape");
        assert.equal(await locked(page), "");
    } finally {
        await context.close();
    }
});

test("search arrows never advance the background lightbox", async () => {
    const { context, page } = await open();
    try {
        await openLightbox(page);
        const counter = page.locator("[data-lightbox-counter]");
        const initial = await counter.textContent();
        await search(page);
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(100);
        assert.equal(await counter.textContent(), initial);
        await page.keyboard.press("ArrowLeft");
        await closeSearch(page);
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => document.querySelector("[data-lightbox-counter]").textContent.startsWith("2 /"));
        await page.keyboard.press("Escape");
        assert.equal(await locked(page), "");
    } finally {
        await context.close();
    }
});

test("global Meta+K and real search result keys navigate through ClientRouter and release stacked locks", async () => {
    const { context, page } = await open();
    try {
        await openLightbox(page);
        await page.keyboard.press("Meta+k");
        await page.waitForFunction(() => document.activeElement.matches("[data-search-input]"));
        await page.locator("[data-search-input]").pressSequentially("Landscape Grass");
        assert.equal(await page.locator("[data-search-input]").inputValue(), "Landscape Grass");
        const first = page.locator("[data-search-result-index]").first();
        await first.waitFor({ state: "visible" });
        await page.keyboard.press("ArrowDown");
        assert.equal(await first.evaluate((el) => el === document.activeElement), true);
        await routeAction(page, () => page.keyboard.press("Enter"));
        assert.match(new URL(page.url()).pathname, /\/posts\/ue5-landscape-grass/);
        assert.equal(await locked(page), "");
        assert.equal(await isOpen(page, "[data-search-overlay]"), false);
        assert.equal(await isOpen(page, "[data-lightbox]"), false);
    } finally {
        await context.close();
    }
});

test("search over navigation retains lower focus, input modality and scroll lock", async () => {
    const { context, page } = await open();
    try {
        await page.locator("[data-nav-toggle]").click();
        await waitForPageAnimations(page);
        const link = page.locator("[data-nav-link]").first();
        await link.focus();
        await search(page);
        const modality = await page.locator("[data-nav-overlay]").getAttribute("data-nav-input");
        await page.keyboard.press("ArrowDown");
        assert.equal(await page.locator("[data-nav-overlay]").getAttribute("data-nav-input"), modality);
        await closeSearch(page);
        assert.equal(await isOpen(page, "[data-nav-overlay]"), true);
        assert.equal(await locked(page), "hidden");
        assert.equal(await link.evaluate((el) => el === document.activeElement), true);
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("[data-nav-overlay]").open);
        assert.equal(await locked(page), "");
        assert.equal(await page.locator("[data-nav-toggle]").evaluate((el) => el === document.activeElement), true);
    } finally {
        await context.close();
    }
});

test("scroll keys and wheel remain contained outside native controls", async () => {
    const { context, page } = await open();
    try {
        await openLightbox(page);
        await page.locator("button[data-lightbox-close]").focus();
        const y = await page.evaluate(() => scrollY);
        for (const key of ["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp"]) await page.keyboard.press(key);
        await page.locator("[data-lightbox]").focus();
        await page.keyboard.press("Space");
        await page.mouse.move(180, 400);
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => scrollY), y);
        assert.equal(await isOpen(page, "[data-lightbox]"), true);
        await page.keyboard.press("Escape");
        assert.equal(await locked(page), "");
    } finally {
        await context.close();
    }
});

test(
    "touch panning remains contained while a lightbox owns the lock",
    { skip: navigationBrowserName === "webkit" ? "Playwright WebKit has no trusted touch-pan API" : false },
    async () => {
        const { context, page } = await open({ isMobile: true, hasTouch: true });
        try {
            await openLightbox(page);
            const y = await page.evaluate(() => scrollY);
            await touchPan(page, -400);
            assert.equal(await page.evaluate(() => scrollY), y);
            await page.keyboard.press("Escape");
            assert.equal(await locked(page), "");
        } finally {
            await context.close();
        }
    },
);

test("twenty real route swaps release stacked modal owners and retain one search shortcut", async () => {
    const { context, page } = await open({ reducedMotion: "reduce", colorScheme: "dark" });
    try {
        for (let i = 0; i < 20; i++) {
            await page.locator("[data-nav-toggle]").click();
            await waitForPageAnimations(page);
            await search(page);
            await page.keyboard.press("Control+k");
            await closeSearch(page);
            assert.equal(await locked(page), "hidden");
            await routeClick(page, i % 2 ? '[data-nav-link][href="/posts"]' : '[data-nav-link][href="/tags"]');
            assert.equal(await locked(page), "");
            assert.equal(await isOpen(page, "[data-search-overlay]"), false);
            assert.equal(await isOpen(page, "[data-nav-overlay]"), false);
        }
    } finally {
        await context.close();
    }
});
