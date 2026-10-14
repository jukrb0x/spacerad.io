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

async function open(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: "block", ...options });
    // Browser regressions must never write to live likes/comments services.
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    await page.goto(new URL("/posts", baseURL).href, { waitUntil: "networkidle" });
    return { context, page };
}
async function preview(page) {
    // Astro restores scroll after the view transition; test hover only after that transition finishes.
    await waitForPageAnimations(page);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const link = page.locator("a[data-post-id]").first();
    await link.hover();
    await page.locator(".post-preview-card.visible").waitFor();
    return link;
}

test("pointer preview follows pointer, stays in viewport and never intercepts clicks", async () => {
    const { context, page } = await open();
    try {
        const link = await preview(page);
        const row = await link.boundingBox();
        const card = page.locator(".post-preview-card.visible");
        await page.mouse.move(row.x + 120, row.y + row.height / 2);
        await page.waitForTimeout(80);
        const first = await card.boundingBox();
        await page.mouse.move(row.x + 210, row.y + row.height / 2);
        await page.waitForTimeout(80);
        const next = await card.boundingBox();
        assert.ok(next.x > first.x + 50, "preview must move with pointer");
        await page.mouse.move(row.x + row.width - 10, row.y + row.height / 2);
        await page.waitForTimeout(80);
        const edge = await card.boundingBox();
        assert.ok(edge.x >= 12 && edge.x + edge.width <= 1428);
        assert.ok(edge.y >= 12 && edge.y + edge.height <= 948);
        assert.equal(await card.evaluate((el) => getComputedStyle(el).pointerEvents), "none");
        await link.click();
        await page.waitForURL(/\/posts\/.+/);
    } finally {
        await context.close();
    }
});

test("preview cancels on scroll and resize, including a pending hover", async () => {
    const { context, page } = await open();
    try {
        await preview(page);
        await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
        assert.equal(await page.locator(".post-preview-card.visible").count(), 0);
        await page.mouse.move(0, 0);
        await preview(page);
        await page.setViewportSize({ width: 1360, height: 700 });
        await page.locator(".post-preview-card.visible").waitFor({ state: "detached" });
        assert.equal(await page.locator(".post-preview-card.visible").count(), 0);
        await page.mouse.move(0, 0);
        await page.locator("a[data-post-id]").first().hover();
        await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
        await page.waitForTimeout(500);
        assert.equal(await page.locator(".post-preview-card.visible").count(), 0);
    } finally {
        await context.close();
    }
});

test("route swaps remove old previews and bind a single fresh instance", async () => {
    const { context, page } = await open();
    try {
        for (let i = 0; i < 3; i++) {
            const link = await preview(page);
            await link.click();
            await page.waitForURL(/\/posts\/.+/);
            assert.equal(await page.locator(".post-preview-card").count(), 0);
            const loaded = page.evaluate(
                () => new Promise((resolve) => document.addEventListener("astro:page-load", () => resolve(), { once: true })),
            );
            await page.locator(".site-header__links a[href='/posts']").click();
            await loaded;
            await page.waitForURL(/\/posts\/?$/);
            await page.waitForLoadState("networkidle");
            await page.mouse.move(0, 0);
        }
        await preview(page);
        assert.equal(await page.locator(".post-preview-card").count(), 1);
    } finally {
        await context.close();
    }
});

test("keyboard preview describes focused title, Escape closes it and Enter opens article", async () => {
    const { context, page } = await open();
    try {
        const link = page.locator("a[data-post-id]").first();
        await link.focus();
        await page.locator(".post-preview-card.visible").waitFor();
        assert.equal(await link.getAttribute("aria-describedby"), "post-preview-tooltip");
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".post-preview-card.visible").count(), 0);
        await page.keyboard.press("Enter");
        await page.waitForURL(/\/posts\/.+/);
    } finally {
        await context.close();
    }
});

test("touch titles open directly and phone layouts fit without mandatory expansion", async () => {
    const { context, page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
        await page.locator("a[data-post-id]").first().tap();
        await page.waitForURL(/\/posts\/.+/);
        assert.equal(await page.locator(".post-preview-card").count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    } finally {
        await context.close();
    }
});

test("reduced-motion preview retains pointer positioning", async () => {
    const { context, page } = await open({ reducedMotion: "reduce" });
    try {
        await preview(page);
        const box = await page.locator(".post-preview-card.visible").boundingBox();
        assert.ok(box.x > 12 && box.y >= 12, "motion reduction cannot reset preview to origin");
    } finally {
        await context.close();
    }
});

test("text-only posts never show a fabricated image or a previous post image", async () => {
    const { context, page } = await open();
    try {
        await preview(page);
        await page.locator("a[data-post-id='just-bought-a-new-domain-name-xcode-zip']").hover();
        const card = page.locator(".post-preview-card.visible");
        await card.waitFor();
        await page.waitForFunction(() => document.querySelector(".post-preview-card__title")?.textContent?.startsWith("Xcode.zip"));
        assert.equal(await card.locator(".post-preview-card__image-container").isVisible(), false);
        assert.equal(await card.locator("img").getAttribute("src"), null);
    } finally {
        await context.close();
    }
});

test("failed preview images collapse to the text summary", async () => {
    const { context, page } = await open();
    try {
        const source = await page.evaluate(() => JSON.parse(document.querySelector("#all-posts-meta").textContent)["introducing-space-radio"].image);
        await page.route(new URL(source, baseURL).href, (route) => route.fulfill({ status: 404, body: "" }));
        await preview(page);
        await page.locator(".post-preview-card__image-container").waitFor({ state: "hidden" });
        assert.ok(await page.locator(".post-preview-card__desc").isVisible());
    } finally {
        await context.close();
    }
});
