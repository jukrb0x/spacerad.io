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

for (const theme of ["light", "dark"]) {
    test(`Channel first photo and heading links support pointer and keyboard in ${theme}`, async () => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
        await page.goto(baseURL);
        await page.locator(".channel-entry").nth(4).waitFor();
        assert.equal(await page.locator(".channel-entry").count(), 5);
        const thumbnail = page.locator(".channel-entry__thumbnail");
        assert.equal(await thumbnail.count(), 1);
        assert.equal(await thumbnail.getAttribute("src"), null);
        for (const label of ["Blog", "Channel"]) {
            const link = page.locator("h2").getByRole("link", { name: label, exact: true });
            assert.equal(await link.getAttribute("href"), label === "Blog" ? "/posts" : "/channel");
            await link.scrollIntoViewIfNeeded();
            await page.mouse.move(1439, 1);
            await page.waitForTimeout(250);
            const wipe = link.locator(".section-heading-link__wipe");
            assert.equal(await wipe.evaluate((e) => getComputedStyle(e).clipPath), "inset(0px 100% 0px 0px)");
            await link.hover();
            await page.waitForTimeout(250);
            assert.equal(await wipe.evaluate((e) => getComputedStyle(e).clipPath), "inset(0px)");
            assert.equal(await wipe.evaluate((e) => getComputedStyle(e).color), "rgb(23, 23, 23)");
            await page.mouse.move(1439, 1);
            await page.keyboard.press("Tab");
            await link.focus();
            await page.waitForTimeout(250);
            assert(await link.evaluate((e) => e.matches(":focus-visible")));
            assert.equal(await wipe.evaluate((e) => getComputedStyle(e).clipPath), "inset(0px)");
            await link.blur();
        }
        const media = page.locator("a[data-channel-preview]");
        await media.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector(".channel-entry__thumbnail")?.naturalWidth > 0);
        await page.waitForTimeout(250);
        await media.hover();
        await page.locator(".post-preview-card.visible .post-preview-card__image.loaded").waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".post-preview-card.visible").count(), 0);
        await page.emulateMedia({ reducedMotion: "reduce" });
        assert(
            parseFloat(
                await page
                    .locator(".section-heading-link__wipe")
                    .first()
                    .evaluate((e) => getComputedStyle(e).transitionDuration),
            ) <= 0.001,
        );
        await page.close();
    });
}

test("touch follows media and heading links on first tap and a failed photo keeps navigation", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    await page.route("**/og-image.png", (route) => route.abort());
    await page.goto(baseURL);
    const media = page.locator("a[data-channel-preview]");
    await media.waitFor();
    await media.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".channel-entry__thumbnail")?.hidden);
    assert((await media.innerText()).length > 0);
    await media.tap();
    await page.waitForURL("**/channel#100");
    await page.goBack();
    await page.locator(".channel-entry").nth(4).waitFor();
    await page.locator("h2").getByRole("link", { name: "Blog", exact: true }).tap();
    await page.waitForURL("**/posts");
    await page.goBack();
    await page.locator("h2").getByRole("link", { name: "Channel", exact: true }).tap();
    await page.waitForURL("**/channel");
    await page.close();
});

test("late Channel data preserves an active Blog preview", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    await page.route("**/api/latest-channel", async (route) => {
        await gate;
        await route.continue();
    });
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await page.locator(".lead-post h3 a:visible").hover();
    await page.locator(".post-preview-card.visible").waitFor();
    const title = await page.locator(".post-preview-card__title").innerText();
    release();
    await page.locator(".channel-entry").nth(4).waitFor();
    assert.equal(await page.locator(".post-preview-card.visible").count(), 1);
    assert.equal(await page.locator(".post-preview-card__title").innerText(), title);
    await page.close();
});

test("static greeting preserves intro geometry through all phrases and keyboard focus", async () => {
    for (const width of [320, 390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        await page.goto(baseURL);
        const link = page.getByRole("link", { name: "About Jabriel", exact: true });
        assert.equal(await link.count(), 1);
        assert.equal(await link.getAttribute("href"), "/me");
        const greeting = link.locator(".home-profile__greeting");
        assert.equal(await greeting.getAttribute("aria-hidden"), "true");
        assert.equal(await greeting.innerText(), "👋");
        await page.evaluate(() => document.fonts.ready);
        const typography = await link.locator("h1").evaluate((e) => ({ size: getComputedStyle(e).fontSize, weight: getComputedStyle(e).fontWeight }));
        assert.equal(typography.size, width < 768 ? "20px" : "24px");
        assert.equal(typography.weight, "400");
        const before = await link.locator("h1").boundingBox();
        const row = await link.boundingBox();
        assert.equal((await greeting.boundingBox()).x, row.x);
        for (const selector of [".home-writing h2", ".lead-post", ".home-post", ".home-channel h2"]) {
            assert.equal((await page.locator(selector).first().boundingBox()).x, row.x);
        }
        await greeting.evaluate((e) => {
            e.style.display = "none";
        });
        const withoutGreeting = await link.locator("h1").boundingBox();
        assert.equal(withoutGreeting.x, row.x);
        assert.equal(withoutGreeting.y, before.y);
        assert.equal(withoutGreeting.height, before.height);
        assert.equal(withoutGreeting.width, before.width);
        await greeting.evaluate((e) => {
            e.style.display = "";
        });
        for (let i = 0; i < 6; i++) {
            await page.locator(".home-profile__word").evaluateAll(
                (words, index) =>
                    words.forEach((word, j) => {
                        word.toggleAttribute("data-current", j === index);
                    }),
                i,
            );
            assert.deepEqual(await link.locator("h1").boundingBox(), before);
            const rect = await greeting.boundingBox();
            assert(rect.x >= 2 && rect.x + rect.width <= width);
            assert(
                await page.evaluate(
                    ({ x, y, width, height }) => document.elementFromPoint(x + width / 2, y + height / 2)?.closest(".home-profile__about") !== null,
                    rect,
                ),
            );
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await page.keyboard.press("Tab");
        await link.focus();
        assert(await link.evaluate((e) => e.matches(":focus-visible")));
        assert.equal(await greeting.evaluate((e) => e.getAnimations().length), 0);
        await page.close();
    }
});
