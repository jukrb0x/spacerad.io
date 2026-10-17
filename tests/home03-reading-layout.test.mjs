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

async function open(width = 1440, options = {}, fixture) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block", ...options });
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    await context.route("**/api/latest-channel", (route) =>
        route.fulfill({
            contentType: "text/html",
            body: '<div class="channel-index"><article class="channel-entry"><time class="editorial-meta">2026.10.07</time><p>First note</p></article><article class="channel-entry"><time class="editorial-meta">2026.08.31</time><p>Second note with a longer description.</p></article><article class="channel-entry"><time class="editorial-meta">2026.08.28</time><p>Third note</p></article></div>',
        }),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(20000);
    await page.goto(fixture ? new URL(`/__test/reading/${fixture}`, baseURL).href : baseURL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true");
    return { context, page };
}
async function settledWord(page, index) {
    await page.evaluate(
        (index) =>
            document.querySelectorAll(".home-profile__word").forEach((word, i) => {
                word.toggleAttribute("data-current", i === index);
            }),
        index,
    );
    await page.waitForFunction(
        () => getComputedStyle(document.querySelector(".home-profile__word[data-current]")).transform === "matrix(1, 0, 0, 1, 0, 0)",
    );
}
async function scroll(page, y) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

for (const width of [1440, 390, 320])
    for (const colorScheme of ["light", "dark"]) {
        test(`reading stream preserves content and one aligned About entry (${width}, ${colorScheme})`, async () => {
            const { context, page } = await open(width, { colorScheme });
            try {
                assert.equal(await page.locator(".home-profile a").count(), 1);
                const about = page.getByRole("link", { name: "About Jabriel", exact: true });
                assert.equal(await about.getAttribute("href"), "/me");
                assert.equal(await about.locator("h1").count(), 1);
                assert.equal(await about.locator(".home-profile__name").textContent(), "Jabriel");
                assert.equal(await about.locator("a").count(), 0);
                assert.equal(await page.locator(".lead-post,.home-post").count(), 5);
                await page.locator(".channel-entry:nth-child(3)").waitFor();
                assert.equal(await page.locator(".channel-entry").count(), 3);
                assert.equal(await page.locator(".home-writing__grid").evaluate((el) => getComputedStyle(el).display), "block");
                let initial;
                for (let index = 0; index < 6; index++) {
                    await settledWord(page, index);
                    const geometry = await page.evaluate(() => {
                        const lead = document.createRange(),
                            word = document.createRange();
                        lead.selectNodeContents(document.querySelector(".home-profile__lead"));
                        word.selectNodeContents(document.querySelector(".home-profile__word[data-current]"));
                        return {
                            lead: lead.getBoundingClientRect().y,
                            word: word.getBoundingClientRect().y,
                            link: document.querySelector(".home-profile__about").getBoundingClientRect().toJSON(),
                        };
                    });
                    assert.equal(geometry.lead, geometry.word, `phrase ${index} must share the text baseline`);
                    initial ??= geometry.link;
                    assert.deepEqual(geometry.link, initial, "phrase changes must not move or resize the About link");
                }
                await settledWord(page, 1);
                await about.hover();
                const ink = await page.locator(".home-profile__word[data-current]").evaluate((el) => {
                    const style = getComputedStyle(el, "::before");
                    const slot = el.parentElement.getBoundingClientRect();
                    const rect = el.getBoundingClientRect();
                    return {
                        height: parseFloat(style.height),
                        top: parseFloat(style.top),
                        wordHeight: rect.height,
                        width: rect.width,
                        slot: slot.width,
                        clip: style.clipPath,
                        duration: style.transitionDuration,
                    };
                });
                assert.ok(ink.height >= (width >= 768 ? 11 : 9), "yellow must be a backing plane below the text");
                assert.ok(ink.top > ink.wordHeight * 0.65);
                assert.ok(ink.top + ink.height <= ink.wordHeight + 0.1, "backing stays inside the carousel clip");
                assert.ok(ink.width < ink.slot - 50, "short phrase backing must not fill the reserved blank width");
                assert.equal(ink.clip, "inset(0px)");
                assert.equal(ink.duration, "0s");
                assert.equal(await about.evaluate((el) => getComputedStyle(el, "::before").content), "none");
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
            } finally {
                await context.close();
            }
        });
    }

for (const width of [1440, 768, 390, 320])
    for (const colorScheme of ["light", "dark"]) {
        test(`shared navigation contains brand painting and covers content (${width}, ${colorScheme})`, async () => {
            const { context, page } = await open(width, { colorScheme });
            try {
                for (const path of ["/", "/posts", "/posts/the-evolution-of-my-website-how-i-rebuilt-it-with-nextjs", "/channel"]) {
                    await page.goto(new URL(path, baseURL).href, { waitUntil: "domcontentloaded" });
                    await page.evaluate(() => document.fonts.ready);
                    await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true");
                    const bodyTop = await page.locator("main").evaluate((el) => el.getBoundingClientRect().top + scrollY);
                    const target = await page.evaluate(() => Math.max(80, Math.min(500, document.documentElement.scrollHeight - innerHeight - 160)));
                    await scroll(page, target + 160);
                    await scroll(page, target);
                    await page.locator(".site-brand").hover();
                    const geometry = await page.evaluate(() => {
                        const nav = document.querySelector(".site-header__inner"),
                            rect = nav.getBoundingClientRect();
                        const title = document.querySelector(".site-brand__text"),
                            text = title.getBoundingClientRect(),
                            paint = getComputedStyle(title, "::before");
                        const progress = document.querySelector("[data-reading-progress]");
                        return {
                            nav: rect.toJSON(),
                            left: text.left + parseFloat(paint.left),
                            right: text.right - parseFloat(paint.right),
                            surface: getComputedStyle(nav).backgroundColor,
                            paddingTop: getComputedStyle(nav).paddingTop,
                            paddingBottom: getComputedStyle(nav).paddingBottom,
                            gap: rect.bottom - progress.getBoundingClientRect().bottom,
                            width: progress.offsetWidth,
                            mainTop: document.querySelector("main").getBoundingClientRect().top + scrollY,
                            clip: paint.clipPath,
                            whiteClip: getComputedStyle(title, "::after").clipPath,
                        };
                    });
                    assert.equal(geometry.nav.height, width >= 768 ? 64 : 60);
                    assert.ok(geometry.left >= geometry.nav.left + 10);
                    assert.ok(geometry.right <= geometry.nav.right - 10);
                    assert.ok(!geometry.surface.includes("rgba"), "floating navigation needs an opaque theme surface");
                    assert.equal(geometry.gap, 8);
                    assert.equal(geometry.paddingTop, "8px");
                    assert.equal(geometry.paddingBottom, "16px");
                    assert.equal(geometry.width, Math.round(geometry.nav.width));
                    assert.equal(geometry.mainTop, bodyTop, "floating navigation must reserve exactly its original height");
                    assert.equal(geometry.clip, "inset(0px)");
                    assert.equal(geometry.clip, geometry.whiteClip, "blue and white title reveals must stay synchronized");
                    await scroll(page, 0);
                    assert.equal(await page.locator("main").evaluate((el) => el.getBoundingClientRect().top), bodyTop);
                    assert.equal(await page.locator("[data-header]").evaluate((el) => el.hasAttribute("data-nav-floating")), false);
                }
            } finally {
                await context.close();
            }
        });
    }

test("About marker retracts, supports keyboard focus and keeps the touch link direct", async () => {
    const { context, page } = await open(1440, { reducedMotion: "no-preference" });
    try {
        const about = page.locator(".home-profile__about");
        const initial = await about.boundingBox();
        await about.hover();
        await page.waitForFunction(
            () => getComputedStyle(document.querySelector(".home-profile__word[data-current]"), "::before").clipPath === "inset(0px)",
        );
        await page.mouse.move(4, 4);
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".home-profile__lead"), "::before").clipPath.includes("100%"));
        assert.deepEqual(await about.boundingBox(), initial);
        await about.focus();
        assert.equal(await about.evaluate((el) => el.matches(":focus-visible")), true);
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".home-profile__lead"), "::before").clipPath === "inset(0px)");
    } finally {
        await context.close();
    }
    const touch = await open(390, { isMobile: true, hasTouch: true });
    try {
        assert.equal(await touch.page.locator(".home-profile__lead").evaluate((el) => getComputedStyle(el, "::before").clipPath), "inset(0px)");
        await touch.page.locator(".home-profile__about").tap();
        await touch.page.waitForURL(/\/me\/?$/);
    } finally {
        await touch.context.close();
    }
});

for (const fixture of ["with-image", "without-image"])
    for (const width of [1440, 390, 320])
        for (const colorScheme of ["light", "dark"]) {
            test(`reading cards preserve cover and text layouts (${fixture}, ${width}, ${colorScheme})`, async () => {
                const { context, page } = await open(width, { colorScheme }, fixture);
                try {
                    assert.deepEqual(
                        await page.locator(".lead-post h3 a, .home-post h3 a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
                        [
                            "/posts/fixture-lead",
                            "/posts/fixture-image-one",
                            "/posts/fixture-text-one",
                            "/posts/fixture-image-two",
                            "/posts/fixture-text-two",
                        ],
                    );
                    assert.equal(await page.locator("main img").count(), fixture === "with-image" ? 3 : 2);
                    assert.equal(await page.locator(".home-post__image").count(), 2);
                    assert.equal(await page.locator(".home-post__body--image").count(), 2);
                    const label = fixture === "with-image" ? "继续阅读" : "Continue reading";
                    assert.equal(
                        await page.locator(".lead-post").getByRole("link", { name: label, exact: true }).getAttribute("href"),
                        "/posts/fixture-lead",
                    );
                    assert.equal(await page.locator(".home-writing__grid").evaluate((el) => getComputedStyle(el).display), "block");
                    const leadImage = page.locator(".lead-post__image");
                    assert.equal(await leadImage.count(), fixture === "with-image" ? 1 : 0);
                    if (fixture === "with-image") {
                        const image = await leadImage.boundingBox();
                        assert.equal(image.width, width >= 768 ? 520 : Math.min(300, (await page.locator("main").boundingBox()).width - 12));
                        assert.equal(await leadImage.locator("img").getAttribute("fetchpriority"), "high");
                    } else {
                        const title = await page.locator(".lead-post h3").boundingBox();
                        const excerpt = await page.locator(".lead-post__excerpt").boundingBox();
                        assert.ok(excerpt.y >= title.y + title.height);
                        assert.ok(excerpt.y - title.y - title.height < 60, "no empty cover space before the excerpt");
                    }
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                } finally {
                    await context.close();
                }
            });
        }
