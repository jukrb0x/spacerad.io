import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, webkit } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

let browser;
before(async () => {
    browser = await (process.env.SEARCH_TEST_BROWSER === "webkit" ? webkit.launch({ headless: true }) : chromium.launch(launchOptions));
});
after(async () => {
    await browser?.close();
});
async function open() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.goto(new URL("/posts/", baseURL).href);
    return { context, page };
}
async function snapshot(page, name) {
    if (!process.env.SEARCH_SCREENSHOTS) return;
    await mkdir(process.env.SEARCH_SCREENSHOTS, { recursive: true });
    await waitForPageAnimations(page);
    await page.screenshot({ path: join(process.env.SEARCH_SCREENSHOTS, `${name}.png`) });
}
async function state(page, value) {
    await page.waitForFunction((value) => document.querySelector("[data-search-results]").dataset.state === value, value);
    assert.equal(await page.locator("[data-search-results]").getAttribute("aria-busy"), value === "loading" ? "true" : "false");
}
async function backdrop(page) {
    assert.equal(
        await page.locator("[data-search-overlay]").evaluate((dialog) => {
            const actual = getComputedStyle(dialog, "::backdrop").backgroundColor;
            const sample = document.createElement("span");
            sample.style.backgroundColor = "var(--color-overlay-dark-40)";
            dialog.append(sample);
            const expected = getComputedStyle(sample).backgroundColor;
            sample.remove();
            return dialog.open && actual === expected && actual !== "rgba(0, 0, 0, 0)";
        }),
        true,
        "native modal backdrop must remain painted independently of opening animation",
    );
    assert.equal(await page.locator("body").evaluate((body) => body.style.overflow), "hidden");
}

test("mobile backdrop belongs to the modal across delayed opening, reopening and SPA", async () => {
    const { context, page } = await open();
    try {
        await page.evaluate(() => {
            const raf = requestAnimationFrame.bind(window);
            window.requestAnimationFrame = (callback) =>
                raf((time) => {
                    const dialog = document.querySelector("[data-search-overlay]");
                    if (dialog?.open && !dialog.classList.contains("is-open")) setTimeout(() => callback(time), 100);
                    else callback(time);
                });
        });
        for (let i = 0; i < 3; i++) {
            await page.locator("[data-search-trigger]").click();
            await backdrop(page);
            await page.waitForFunction(() => document.querySelector("[data-search-overlay]").classList.contains("is-open"));
            await snapshot(page, `backdrop-open-${i + 1}`);
            await page.locator(".search-dialog__container [data-search-close]").click();
            await page.waitForFunction(() => !document.querySelector("[data-search-overlay]").open, null, { polling: 20 });
            assert.equal(await page.locator("body").evaluate((body) => body.style.overflow), "");
        }
        await page.evaluate(() => {
            window.searchPageReady = false;
            document.addEventListener(
                "astro:page-load",
                () => {
                    window.searchPageReady = true;
                },
                { once: true },
            );
        });
        await page.locator(".site-brand").click();
        await page.waitForURL(new URL("/", baseURL).href);
        await page.waitForFunction(() => window.searchPageReady, null, { polling: 20 });
        await waitForPageAnimations(page);
        await page.keyboard.press("Control+k");
        await backdrop(page);
        await page.waitForFunction(() => document.querySelector("[data-search-overlay]").classList.contains("is-open"));
        await snapshot(page, "backdrop-after-spa");
        await page.keyboard.press("Escape");
        await page.keyboard.press("Control+k");
        await backdrop(page);
        await page.waitForFunction(() => document.querySelector("[data-search-overlay]").classList.contains("is-open"));
        await page.waitForFunction(() => document.querySelector("[data-search-overlay]").classList.contains("is-open"), null, { polling: 20 });
        assert.equal(await page.locator("[data-search-input]").evaluate((input) => document.activeElement === input), true);
    } finally {
        await context.close();
    }
});

test("mobile cold and warm queries expose loading, results and no-results immediately", async () => {
    const { context, page } = await open();
    const releases = [];
    await context.route("**/pagefind/wasm.*.pagefind", async (route) => {
        await new Promise((resolve) => releases.push(resolve));
        await route.continue().catch(() => {});
    });
    try {
        await page.locator("[data-search-trigger]").click();
        await state(page, "idle");
        await snapshot(page, "idle");
        const request = page.waitForRequest((request) => /\/pagefind\/wasm\./.test(request.url()));
        await page.locator("[data-search-input]").fill("land");
        await state(page, "loading");
        assert.equal(await page.locator("[data-search-empty]").isVisible(), false);
        assert.equal(await page.locator("[data-search-loading]").isVisible(), true);
        await request;
        await snapshot(page, "loading");
        for (const release of releases) release();
        await context.unroute("**/pagefind/wasm.*.pagefind");
        await state(page, "results");
        await snapshot(page, "results");
        await page.locator("[data-search-input]").fill('"qzxvplm987 紫色不存在的地形草星球"');
        await state(page, "loading");
        assert.equal(await page.locator("[data-search-list]").isVisible(), false);
        await state(page, "no-results");
        await snapshot(page, "no-results");
        await page.locator("[data-search-input]").fill("");
        await state(page, "idle");
    } finally {
        for (const release of releases) release();
        await context.close();
    }
});

test("mobile cancelled cold query cannot replace idle or a reopened query", async () => {
    const { context, page } = await open();
    const releases = [];
    await context.route("**/pagefind/wasm.*.pagefind", async (route) => {
        await new Promise((resolve) => releases.push(resolve));
        await route.continue().catch(() => {});
    });
    try {
        await page.locator("[data-search-trigger]").click();
        const request = page.waitForRequest((request) => /\/pagefind\/wasm\./.test(request.url()));
        await page.locator("[data-search-input]").fill("Landscape");
        await request;
        await page.locator("[data-search-input]").fill("");
        await state(page, "idle");
        await page.waitForFunction(() => document.querySelector("[data-search-list]").children.length === 0);
        await page.locator(".search-dialog__container [data-search-close]").click();
        await page.keyboard.press("Control+k");
        await state(page, "idle");
        for (const release of releases) release();
        await context.unroute("**/pagefind/wasm.*.pagefind");
        await page.locator("[data-search-input]").fill("视锥剔除");
        await state(page, "results");
        await page.locator('[data-search-list] a[href="/posts/ue5-landscape-grass-memory-optimization-visibility-culling/"]').waitFor();
        await backdrop(page);
    } finally {
        for (const release of releases) release();
        await context.close();
    }
});

test("mobile index error is distinct from no-results and can recover", async () => {
    const { context, page } = await open();
    await context.route("**/pagefind/index/*.pf_index", (route) => route.fulfill({ status: 503, body: "temporary outage" }));
    try {
        await page.locator("[data-search-trigger]").click();
        await page.locator("[data-search-input]").fill("Landscape");
        await state(page, "error");
        assert.equal(await page.locator("[data-search-error]").isVisible(), true);
        assert.equal(await page.locator("[data-search-no-results]").isVisible(), false);
        await snapshot(page, "error");
        await context.unroute("**/pagefind/index/*.pf_index");
        await page.locator("[data-search-input]").fill("地形草");
        await state(page, "loading");
        await state(page, "results");
    } finally {
        await context.close();
    }
});
