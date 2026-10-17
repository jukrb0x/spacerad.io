import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, webkit } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

const grass = "ue5-landscape-grass";
const optimization = "ue5-landscape-grass-memory-optimization-visibility-culling";
const standalone = "introducing-space-radio";
const engine = process.env.PLAYWRIGHT_BROWSER || "chromium";
let browser;
before(async () => {
    assert.ok(["chromium", "webkit"].includes(engine));
    browser = await { chromium, webkit }[engine].launch(launchOptions);
    console.log(`Article navigation: ${engine} ${browser.version()}`);
});
after(async () => await browser?.close());

async function openContext(options = {}) {
    const context = await browser.newContext({ serviceWorkers: "block", ...options });
    await context.route("**/*", (route) => {
        const request = route.request();
        if (new URL(request.url()).origin !== new URL(baseURL).origin || !["GET", "HEAD"].includes(request.method())) return route.abort();
        if (new URL(request.url()).pathname === "/api/remark42-script") return route.fulfill({ contentType: "text/javascript", body: "" });
        return route.continue();
    });
    return context;
}

const entrance = (page) => page.locator("[data-article-header] a[hreflang]");
async function followSPA(page, link, target, keyboard = false) {
    await page.evaluate(() => {
        window.articleNavigationSentinel = "same-document";
        window.articlePageLoaded = false;
        document.addEventListener(
            "astro:page-load",
            () => {
                window.articlePageLoaded = true;
            },
            { once: true },
        );
    });
    if (keyboard) await page.keyboard.press("Enter");
    else if (page.viewportSize().width < 768) await link.tap();
    else await link.click();
    await page.waitForURL(new URL(target, baseURL).href, { timeout: 15000 });
    await page.waitForFunction(() => window.articlePageLoaded, null, { timeout: 15000 });
    await waitForPageAnimations(page);
    assert.equal(await page.evaluate(() => window.articleNavigationSentinel), "same-document", "real ClientRouter navigation preserves the document");
}

test("both optimization articles resolve all six references to the same-language canonical article with or without a trailing slash", async () => {
    const context = await openContext();
    const page = await context.newPage();
    try {
        for (const suffix of ["", "-en"]) {
            for (const slash of ["", "/"]) {
                await page.goto(new URL(`/posts/${optimization}${suffix}${slash}`, baseURL).href);
                const links = page.locator(`.prose a`).filter({
                    hasText: suffix ? "UE5 Landscape Grass Source Analysis: A Look Under the Hood" : "UE5 Landscape Grass 地形草原理分析",
                });
                assert.equal(await links.count(), 3);
                for (const link of await links.all()) {
                    const href = await link.getAttribute("href");
                    assert.equal(new URL(href, page.url()).pathname, `/posts/${grass}${suffix}`);
                    assert.equal((await context.request.get(new URL(href, page.url()).href)).status(), 200);
                }
                await followSPA(page, links.first(), `/posts/${grass}${suffix}`);
                assert.equal(await page.locator("html").getAttribute("lang"), suffix ? "en" : "zh-CN");
                assert.equal(
                    await page.locator("[data-article-header] h1").textContent(),
                    suffix ? "UE5 Landscape Grass Source Analysis: A Look Under the Hood" : "UE5 Landscape Grass 地形草原理分析",
                );
            }
        }
    } finally {
        await context.close();
    }
});

test("direct article HTML exposes exactly one verified counterpart and no empty controls on an unpaired article, without JavaScript", async () => {
    const context = await openContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
        for (const id of [grass, optimization]) {
            for (const [suffix, otherSuffix, lang] of [
                ["", "-en", "en"],
                ["-en", "", "zh"],
            ]) {
                await page.goto(new URL(`/posts/${id}${suffix}`, baseURL).href);
                const link = entrance(page);
                assert.equal(await link.count(), 1);
                assert.equal(await link.getAttribute("href"), `/posts/${id}${otherSuffix}`);
                assert.equal(await link.getAttribute("hreflang"), lang);
                assert.equal(await link.getAttribute("lang"), lang);
                assert.equal(await link.getAttribute("data-preview"), "off");
                assert.match(await link.getAttribute("aria-label"), lang === "en" ? /^EN — English translation:/ : /^中文 — 中文版:/);
                await link.click();
                assert.equal(new URL(page.url()).pathname, `/posts/${id}${otherSuffix}`);
            }
        }
        await page.goto(new URL(`/posts/${standalone}`, baseURL).href);
        assert.equal(await entrance(page).count(), 0);
        assert.equal(await page.locator("[data-article-header] .mobile-post-languages").count(), 0);
    } finally {
        await context.close();
    }
});

for (const width of [320, 390, 1440]) {
    for (const theme of ["light", "dark"]) {
        // One touch and one desktop keyboard path retain the complete SPA journey.
        const interaction = (width === 390 && theme === "light") || (width === 1440 && theme === "dark");
        test(`article counterpart geometry and focus${interaction ? " with complete SPA journey" : ""} at ${width}px in ${theme}`, async () => {
            const context = await openContext({ viewport: { width, height: 960 }, isMobile: width < 768, hasTouch: width < 768 });
            await context.addInitScript((value) => localStorage.setItem("theme-preference", value), theme);
            const page = await context.newPage();
            try {
                if (interaction) {
                    await page.goto(new URL("/posts", baseURL).href);
                    await followSPA(page, page.locator(`a[data-post-id="${optimization}"]`), `/posts/${optimization}`);
                } else {
                    await page.goto(new URL(`/posts/${optimization}`, baseURL).href);
                }
                const link = entrance(page);
                assert.equal(await link.count(), 1);
                assert.equal((await link.innerText()).trim(), width < 768 ? "EN" : "English");
                await link.focus();
                // Mac WebKit uses Option-Tab to include links in keyboard navigation.
                const tabModifier = engine === "webkit" && process.platform === "darwin" ? "Alt+" : "";
                await page.keyboard.press(`${tabModifier}Shift+Tab`);
                await page.keyboard.press(`${tabModifier}Tab`);
                assert.equal(await link.evaluate((el) => el === document.activeElement && el.matches(":focus-visible")), true);
                const geometry = await link.evaluate((el) => {
                    const box = el.getBoundingClientRect();
                    const style = getComputedStyle(el);
                    return { x: box.x, right: box.right, width: box.width, height: box.height, outline: style.outlineStyle, color: style.color };
                });
                assert.ok(geometry.x >= 0 && geometry.right <= width, "language link fits viewport");
                assert.notEqual(geometry.outline, "none");
                assert.notEqual(geometry.color, "rgba(0, 0, 0, 0)");
                if (width < 768) assert.ok(geometry.width >= 44 && geometry.height >= 44, "mobile target remains at least 44px");
                assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                if (!interaction) return;
                await followSPA(page, link, `/posts/${optimization}-en`, width >= 768);
                assert.equal(await page.locator("html").getAttribute("lang"), "en");
                assert.equal((await entrance(page).innerText()).trim(), "中文");
                await followSPA(page, entrance(page), `/posts/${optimization}`);
                assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
                assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                await followSPA(page, page.locator('.editorial-back a[href="/posts"]'), "/posts");
                await followSPA(page, page.locator(`a[data-post-id="${standalone}"]`), `/posts/${standalone}`);
                assert.equal(await entrance(page).count(), 0, "SPA swap removes old language control");
                assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
                await followSPA(page, page.locator('header a[href="/"]').first(), "/");
                await followSPA(page, page.locator(`.home-writing a[data-post-id="${optimization}"]`), `/posts/${optimization}`);
                assert.equal(await entrance(page).count(), 1, "Home entry restores the counterpart once");
            } finally {
                await context.close();
            }
        });
    }
}
