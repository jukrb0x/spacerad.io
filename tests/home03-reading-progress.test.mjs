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
const article = "/posts/ue5-landscape-grass";
async function open(width, theme, reducedMotion = "no-preference") {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion, serviceWorkers: "block" });
    await context.addInitScript((theme) => localStorage.setItem("theme-preference", theme), theme);
    await context.route("**/*", (route) => (["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort()));
    // Isolate reading geometry from the third-party comment widget's later resizing.
    await context.route("**/api/remark42-script", (route) =>
        route.fulfill({ contentType: "application/javascript", body: "window.REMARK42={createInstance(){return {destroy(){}}}};" }),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    return { context, page, errors };
}
async function go(page, path = article) {
    await page.goto(new URL(path, baseURL).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true");
    await page.evaluate(() => document.fonts.ready);
    await settle(page);
}
async function settle(page) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await waitForPageAnimations(page);
}
async function scroll(page, position) {
    await page.evaluate((position) => {
        const track = document.documentElement.scrollHeight - innerHeight;
        const top = position === "middle" ? track / 2 : position === "end" ? track : position === "up" ? scrollY - 64 : position;
        scrollTo({ top, behavior: "instant" });
    }, position);
    await settle(page);
}
async function sample(page) {
    return page.evaluate(() => {
        const bar = document.querySelector("[data-reading-progress]"),
            nav = document.querySelector(".site-header__inner");
        const b = bar.getBoundingClientRect(),
            n = nav.getBoundingClientRect(),
            style = getComputedStyle(bar);
        return {
            value: Number(bar.getAttribute("aria-valuenow")),
            scale: new DOMMatrixReadOnly(style.transform).a,
            opacity: style.opacity,
            color: style.backgroundColor,
            top: b.top,
            bottom: b.bottom,
            width: b.width,
            height: b.height,
            nav: { top: n.top, bottom: n.bottom, width: n.width },
            scroll: scrollY,
            track: document.documentElement.scrollHeight - innerHeight,
        };
    });
}
function atNavigation(sample) {
    assert.ok(
        sample.top >= 0 && Math.abs(sample.nav.bottom - sample.bottom - 8) < 1,
        `progress must follow navigation with its 8px opaque buffer: ${JSON.stringify(sample)}`,
    );
    assert.ok(sample.height >= 2 && sample.height <= 3);
    assert.ok(Math.abs(sample.width - sample.nav.width * sample.scale) < 2);
}

// Leaving progress as a sibling of the relative header must fail at the middle reveal.
for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
        test(`reading progress follows revealed navigation and retains 0/50/100% calculation (${width}px ${theme})`, async () => {
            const { context, page, errors } = await open(width, theme);
            try {
                await go(page);
                const start = await sample(page);
                assert.equal(start.value, 0);
                assert.equal(start.scale, 0);
                assert.equal(start.opacity, "1");
                await scroll(page, "middle");
                const middle = await sample(page);
                assert.ok(Math.abs(middle.value - 50) <= 1);
                assert.ok(middle.scale > 0.49 && middle.scale < 0.51);
                assert.equal(await page.locator("[data-header]").evaluate((el) => el.hasAttribute("data-nav-hidden")), true);
                await scroll(page, "up");
                const reveal = await sample(page);
                atNavigation(reveal);
                assert.equal(reveal.color, "rgb(223, 32, 27)");
                await scroll(page, "end");
                const endHidden = await sample(page);
                assert.equal(endHidden.value, 100);
                assert.equal(endHidden.scale, 1);
                assert.ok(endHidden.bottom <= 1, "the original hide-with-navigation behavior is retained");
                await scroll(page, "up");
                await page.locator("[data-search-trigger]").focus();
                await scroll(page, "end");
                const endVisible = await sample(page);
                assert.equal(endVisible.value, 100);
                atNavigation(endVisible);
                const bar = page.getByRole("progressbar", { name: "Reading progress" });
                assert.equal(await bar.getAttribute("aria-valuemin"), "0");
                assert.equal(await bar.getAttribute("aria-valuemax"), "100");
                assert.equal(await bar.getAttribute("aria-live"), null);
                await scroll(page, 0);
                assert.equal((await sample(page)).value, 0);
                assert.deepEqual(errors, []);
            } finally {
                await context.close();
            }
        });
    }

test("short articles keep the original progress suppression", async () => {
    const { context, page, errors } = await open(390, "light");
    try {
        await go(page, "/posts/just-bought-a-new-domain-name-xcode-zip");
        const short = await sample(page);
        assert.ok(short.track < 1200, `fixture must remain below the original 1.5 viewport threshold: ${short.track}`);
        assert.equal(short.opacity, "0");
        assert.equal(short.value, 0);
        assert.deepEqual(errors, []);
    } finally {
        await context.close();
    }
});

test("reduced-motion progress follows navigation and releases old route DOM", async () => {
    const { context, page, errors } = await open(390, "dark", "reduce");
    try {
        await go(page);
        await scroll(page, "middle");
        await scroll(page, "up");
        atNavigation(await sample(page));
        assert.ok(
            await page.locator("[data-reading-progress]").evaluate((el) =>
                getComputedStyle(el)
                    .transitionDuration.split(",")
                    .every((duration) => parseFloat(duration) <= 0.01),
            ),
        );
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.emulateMedia({ reducedMotion: "reduce" });
        for (let i = 0; i < 2; i++) {
            await page.evaluate(() => {
                Reflect.set(window, "readingProgressPrevious", document.querySelector("[data-reading-progress]"));
            });
            await page.locator(".site-brand").click();
            await page.waitForURL(new URL("/", baseURL).href);
            await settle(page);
            assert.equal((await sample(page)).value, 0);
            await page.evaluate(() => {
                Reflect.set(window, "readingProgressPreviousState", Reflect.get(window, "readingProgressPrevious").outerHTML);
            });
            await page.goBack();
            await page.waitForURL(new URL(article, baseURL).href);
            await settle(page);
            await scroll(page, "middle");
            await scroll(page, "up");
            atNavigation(await sample(page));
            assert.ok(
                await page.evaluate(
                    () =>
                        !Reflect.get(window, "readingProgressPrevious").isConnected &&
                        Reflect.get(window, "readingProgressPrevious").outerHTML === Reflect.get(window, "readingProgressPreviousState"),
                ),
            );
        }
        assert.deepEqual(errors, []);
    } finally {
        await context.close();
    }
});
