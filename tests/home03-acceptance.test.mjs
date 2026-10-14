import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import ts from "typescript";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

let browser;
before(async () => {
    browser = await chromium.launch(launchOptions);
});
after(async () => {
    await browser?.close();
});
async function open(path, options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", ...options });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(new URL(path, baseURL).href, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true");
    return { context, page };
}

// Opacity/aria-hidden alone must not let keyboard focus enter a collapsed menu.
test("closed mobile sharing stays out of focus; open controls work and Escape restores focus", async () => {
    const { context, page } = await open("/posts/introducing-space-radio", { viewport: { width: 390, height: 844 } });
    try {
        const item = page.locator("[data-share-menu-item]").first();
        await item.evaluate((el) => el.focus());
        assert.equal(await page.evaluate(() => !!document.activeElement.closest("[data-share-menu]")), false);
        const toggle = page.locator("[data-share-mobile-toggle]");
        await toggle.focus();
        await page.keyboard.press("Enter");
        await item.focus();
        assert.equal(await page.evaluate(() => !!document.activeElement.closest("[data-share-menu]")), true);
        await page.keyboard.press("Escape");
        assert.equal(await toggle.evaluate((el) => el === document.activeElement), true);
        await item.evaluate((el) => el.focus());
        assert.equal(await page.evaluate(() => !!document.activeElement.closest("[data-share-menu]")), false);
    } finally {
        await context.close();
    }
});

// Tag callers must provide the real collection when the shared row resolves translations.
test("tag rows retain verified translations and the link opens the actual English article", async () => {
    const { context, page } = await open("/tags/Landscape");
    try {
        const row = page.locator("li").filter({ has: page.locator('a[data-post-id="ue5-landscape-grass"]') });
        const translation = row.locator(".post-item__translation");
        assert.equal(await translation.count(), 1);
        assert.equal(await translation.getAttribute("href"), "/posts/ue5-landscape-grass-en");
        await translation.click();
        await page.waitForURL(/\/posts\/ue5-landscape-grass-en\/?$/);
        await waitForPageAnimations(page);
        assert.equal(await page.locator("html").getAttribute("lang"), "en");
        assert.match(await page.locator("main h1").textContent(), /Landscape Grass/);
        await page.goBack();
        await page.waitForURL(/\/tags\/Landscape\/?$/);
        await page.goForward();
        await page.waitForURL(/\/posts\/ue5-landscape-grass-en\/?$/);
    } finally {
        await context.close();
    }
});

test("English topic shells declare English while article rows retain their own languages", async () => {
    const { context, page } = await open("/tags");
    try {
        assert.equal(await page.locator("html").getAttribute("lang"), "en");
        await page.locator('.topic-grid a[href="/tags/Landscape"]').click();
        await page.waitForURL(/\/tags\/Landscape\/?$/);
        assert.equal(await page.locator("html").getAttribute("lang"), "en");
        assert.ok(await page.locator('li[lang="zh-CN"]').count());
        assert.ok(await page.locator('li[lang="en"]').count());
    } finally {
        await context.close();
    }
});

// Clicking and keyboard activation must expose the same actual article lightbox.
test("article images open with Enter and Escape returns focus without a scroll lock", async () => {
    const { context, page } = await open("/posts/introducing-space-radio");
    try {
        const image = page.locator(".prose img").first();
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((el) => el.focus());
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("[data-lightbox]").evaluate((el) => el.open), true);
        await page.keyboard.press("Escape");
        assert.equal(await image.evaluate((el) => el === document.activeElement), true);
        assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "");
    } finally {
        await context.close();
    }
});

const compile = (path) =>
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
const lightboxSource = readFileSync(new URL("../src/components/Lightbox.astro", import.meta.url), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
const fixtureScript = `${compile("../src/utils/scrollLock.ts").replace(/^export /gm, "")}\n${ts.transpileModule(lightboxSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*;\n/m, "")}\ndocument.dispatchEvent(new Event('astro:page-load'));`;

// Delayed real browser image loads cannot roll back a newer selection.
test("rapid lightbox navigation selects the newest image even when old loads finish last", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(3000);
    try {
        await page.route(`${baseURL}/fixture`, (route) =>
            route.fulfill({
                contentType: "text/html",
                body: `<body><button class="shot" data-photo-url="${baseURL}/controlled/0.svg">Photo</button><button class="shot" data-photo-url="${baseURL}/controlled/1.svg">Second</button><button class="shot" data-photo-url="${baseURL}/controlled/2.svg">Third</button><dialog data-lightbox data-selector=".shot"><button data-lightbox-close>Close</button><div data-lightbox-container><img data-lightbox-img></div><p data-lightbox-caption></p><p data-lightbox-counter></p></dialog></body>`,
            }),
        );
        await page.route(`${baseURL}/controlled/*.svg`, async (route) => {
            const index = Number(new URL(route.request().url()).pathname.match(/(\d)\.svg/)[1]);
            await new Promise((resolve) => setTimeout(resolve, [500, 250, 20][index]));
            await route.fulfill({
                contentType: "image/svg+xml",
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>',
            });
        });
        await page.goto(`${baseURL}/fixture`);
        await page.addScriptTag({ content: fixtureScript });
        await page.locator(".shot").first().click();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(650);
        assert.equal(await page.locator("[data-lightbox-counter]").textContent(), "3 / 3");
        assert.ok((await page.locator("[data-lightbox-img]").getAttribute("src")).endsWith("/2.svg"));
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "");
    } finally {
        await context.close();
    }
});
