import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, webkit } from "playwright";
import { baseURL, launchOptions, waitForPageAnimations } from "./helpers/browser.mjs";

let browser;
before(async () => {
    const browserType = { chromium, webkit }[process.env.PLAYWRIGHT_BROWSER || "chromium"];
    assert.ok(browserType, "PLAYWRIGHT_BROWSER must be chromium or webkit");
    browser = await browserType.launch(launchOptions);
});
after(async () => {
    await browser?.close();
});

async function open(width, reducedMotion = "no-preference") {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion, serviceWorkers: "block" });
    await context.route("**/api/latest-channel", (route) =>
        route.fulfill({
            contentType: "text/html",
            body: `<div class="channel-index">${'<article class="channel-entry"><p>A local channel entry with enough reading content for deep scrolling.</p></article>'.repeat(20)}</div>`,
        }),
    );
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true");
    await page.waitForFunction(() => !document.querySelector("[data-latest-channel]").textContent.includes("Loading"));
    await page.evaluate(() => document.fonts.ready);
    await waitForPageAnimations(page);
    return { context, page };
}
async function scroll(page, y, settle = true) {
    await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (settle) await waitForPageAnimations(page);
}
const nav = (page) => page.locator(".site-header__inner");
const hidden = (page) => page.locator("[data-header]").evaluate((el) => el.hasAttribute("data-nav-hidden"));

for (const width of [1440, 390]) {
    test(`returning profile never paints over the Blog heading (${width}px)`, async () => {
        const { context, page } = await open(width);
        try {
            const origin = (await nav(page).boundingBox()).y;
            const height = (await nav(page).boundingBox()).height;
            await scroll(page, 700);
            await scroll(page, 636);
            await scroll(page, origin + height);
            const sample = await page.evaluate(() => {
                const profile = document.querySelector(".home-profile");
                const rect = profile.getBoundingClientRect();
                const sides = getComputedStyle(profile).clipPath.match(/[\d.]+px/g) ?? ["0px"];
                const bottom = rect.bottom - parseFloat(sides[2] ?? sides[0]);
                return { bottom, writing: document.querySelector("#writing-title").getBoundingClientRect().top };
            });
            assert.ok(sample.bottom <= sample.writing + 1, `profile covers Blog: ${JSON.stringify(sample)}`);
        } finally {
            await context.close();
        }
    });

    test(`near-top exit protects profile text throughout painted navigation frames (${width}px)`, async () => {
        const { context, page } = await open(width);
        try {
            const origin = (await nav(page).boundingBox()).y;
            await scroll(page, 700);
            await scroll(page, 636);
            await scroll(page, origin + 48);
            await scroll(page, origin + 80, false);
            const frames = await page.evaluate(async () => {
                const frames = [];
                for (let i = 0; i < 8; i++) {
                    await new Promise(requestAnimationFrame);
                    const profile = document.querySelector(".home-profile");
                    const p = profile.getBoundingClientRect();
                    const t = profile.querySelector("h1").getBoundingClientRect();
                    const sides = getComputedStyle(profile).clipPath.match(/[\d.]+px/g) ?? ["0px"];
                    const top = p.top + parseFloat(sides[0]);
                    const bottom = p.bottom - parseFloat(sides[2] ?? sides[0]);
                    frames.push({
                        inkTop: Math.max(0, top, t.top),
                        inkBottom: Math.min(bottom, t.bottom),
                        navBottom: document.querySelector(".site-header__inner").getBoundingClientRect().bottom,
                    });
                }
                return frames;
            });
            for (const frame of frames)
                if (frame.inkBottom > frame.inkTop + 1)
                    assert.ok(frame.inkTop >= frame.navBottom - 1, `exiting navigation covers profile: ${JSON.stringify(frame)}`);
        } finally {
            await context.close();
        }
    });

    // A revealed bar must stay painted on every upward frame until its flow origin catches up.
    for (const step of [8, 80]) {
        test(`continuous upward handoff stays visible frame by frame (${width}px, ${step}px steps)`, async () => {
            const { context, page } = await open(width);
            try {
                for (const motion of ["no-preference", "reduce"]) {
                    await page.emulateMedia({ reducedMotion: motion });
                    await scroll(page, 0);
                    const origin = (await nav(page).boundingBox()).y;
                    await scroll(page, 700);
                    await scroll(page, 636);
                    const frames = await page.evaluate(async (step) => {
                        const nav = document.querySelector(".site-header__inner");
                        const header = document.querySelector("[data-header]");
                        const frames = [];
                        for (let y = 360; y >= 0; y = y === 0 ? -1 : Math.max(0, y - step)) {
                            scrollTo({ top: y, behavior: "instant" });
                            for (let frame = 0; frame < 2; frame++) {
                                await new Promise(requestAnimationFrame);
                                const rect = nav.getBoundingClientRect();
                                frames.push({
                                    y: scrollY,
                                    frame,
                                    top: rect.top,
                                    bottom: rect.bottom,
                                    height: rect.height,
                                    visibility: getComputedStyle(nav).visibility,
                                    hidden: header.hasAttribute("data-nav-hidden"),
                                    transitions: nav.getAnimations().filter((a) => a.transitionProperty === "transform").length,
                                });
                            }
                        }
                        return frames;
                    }, step);
                    for (const frame of frames) {
                        assert.ok(
                            frame.top >= -1 && frame.bottom >= frame.height - 1 && frame.visibility === "visible" && !frame.hidden,
                            `upward handoff retracts: ${JSON.stringify(frame)}`,
                        );
                        assert.equal(frame.transitions, 0, `handoff must not restart drawer animation: ${JSON.stringify(frame)}`);
                        if (frame.frame === 1)
                            assert.ok(Math.abs(frame.top - Math.max(0, origin - frame.y)) <= 1, `handoff position jumps: ${JSON.stringify(frame)}`);
                    }
                }
            } finally {
                await context.close();
            }
        });
    }

    // A returning profile must clear the pinned bar while document geometry stays unchanged.
    test(`returning Home masthead preserves flow and never covers profile (${width}px)`, async () => {
        const { context, page } = await open(width);
        try {
            const initial = await page.evaluate(() => ({
                main: document.querySelector("main").getBoundingClientRect().top,
                height: document.documentElement.scrollHeight,
                nav: document.querySelector(".site-header__inner").getBoundingClientRect().top,
            }));
            await scroll(page, 700);
            await scroll(page, 636);
            let returnedToFlow = false;
            for (const y of [300, 250, 200, 170, 140, 100, 80, 45, 47, 43, 30, 32, 25, 27, 2, 0]) {
                await scroll(page, y);
                const sample = await page.evaluate(() => {
                    const nav = document.querySelector(".site-header__inner").getBoundingClientRect();
                    const profile = document.querySelector(".home-profile");
                    const rect = profile.getBoundingClientRect();
                    const title = profile.querySelector("h1").getBoundingClientRect();
                    const clips = getComputedStyle(profile).clipPath.match(/[\d.]+px/g) ?? ["0px"];
                    return {
                        top: nav.top,
                        bottom: nav.bottom,
                        titleTop: Math.max(0, title.top, rect.top + parseFloat(clips[0])),
                        titleBottom: Math.min(title.bottom, rect.bottom - parseFloat(clips[2] ?? clips[0])),
                        main: document.querySelector("main").getBoundingClientRect().top + scrollY,
                        height: document.documentElement.scrollHeight,
                    };
                });
                assert.ok(
                    sample.titleBottom <= sample.titleTop + 1 || sample.bottom <= sample.titleTop + 1,
                    `profile covered at ${y}: ${JSON.stringify(sample)}`,
                );
                if (y <= initial.nav) returnedToFlow = true;
                const expected = returnedToFlow ? initial.nav - y : 0;
                assert.ok(Math.abs(sample.top - expected) < 1, `masthead handoff lost at ${y}: ${JSON.stringify(sample)}`);
                assert.equal(sample.main, initial.main);
                assert.equal(sample.height, initial.height);
            }
        } finally {
            await context.close();
        }
    });

    // Resetting intent on every sign change prevents slow deliberate reversals from completing.
    test(`slow reversals survive jitter in both directions (${width}px)`, async () => {
        const { context, page } = await open(width);
        try {
            await scroll(page, 700);
            for (const y of [697, 699, 696, 700, 698]) await scroll(page, y);
            assert.equal(await hidden(page), true);
            for (let y = 696; y >= 661; y -= 3) {
                await scroll(page, y);
                await scroll(page, y + 1);
            }
            assert.equal(await hidden(page), false, "slow upward intent should reveal despite 1px jitter");
            await scroll(page, 663);
            assert.equal(await hidden(page), false, "tiny downward reversal must not hide");
            for (let y = 665; y <= 692; y += 3) {
                await scroll(page, y);
                await scroll(page, y - 1);
            }
            assert.equal(await hidden(page), true, "slow downward intent should hide despite 1px jitter");
        } finally {
            await context.close();
        }
    });

    // Removing the exit transition or hiding visibility at its start must fail mid-drawer.
    test(`drawer entrance and exit retain painted visibility until exit finishes (${width}px)`, async () => {
        const { context, page } = await open(width);
        try {
            await scroll(page, 700);
            await scroll(page, 636, false);
            const entering = await nav(page).evaluate((el) => {
                const animation = el.getAnimations().find((a) => a.transitionProperty === "transform");
                if (!animation) return null;
                animation.pause();
                animation.currentTime = 70;
                return { y: el.getBoundingClientRect().top, height: el.offsetHeight, visibility: getComputedStyle(el).visibility };
            });
            assert.ok(entering && entering.y < 0 && entering.y > -entering.height && entering.visibility === "visible", JSON.stringify(entering));
            await nav(page).evaluate((el) => {
                el.getAnimations().forEach((a) => {
                    a.finish();
                });
            });
            await scroll(page, 640);
            assert.equal(await hidden(page), false);
            await scroll(page, 675, false);
            const exiting = await nav(page).evaluate((el) => {
                const animation = el.getAnimations().find((a) => a.transitionProperty === "transform");
                if (!animation) return null;
                animation.pause();
                animation.currentTime = 70;
                const style = getComputedStyle(el);
                return {
                    y: el.getBoundingClientRect().top,
                    height: el.offsetHeight,
                    visibility: style.visibility,
                    pointer: style.pointerEvents,
                    inert: el.inert,
                };
            });
            assert.ok(exiting && exiting.y < 0 && exiting.y > -exiting.height && exiting.visibility === "visible", JSON.stringify(exiting));
            assert.equal(exiting.inert, true);
            assert.equal(exiting.pointer, "none");
            await nav(page).evaluate((el) => {
                el.getAnimations().forEach((a) => {
                    a.finish();
                });
            });
            assert.equal(await nav(page).evaluate((el) => getComputedStyle(el).visibility), "hidden");
            await page.keyboard.press("Tab");
            assert.equal(await nav(page).evaluate((el) => el.contains(document.activeElement)), false);
            await scroll(page, 611);
            await scroll(page, 650, false);
            await nav(page).evaluate((el) => {
                const animation = el.getAnimations().find((a) => a.transitionProperty === "transform");
                animation.pause();
                animation.currentTime = 70;
            });
            await scroll(page, 611, false);
            assert.equal(await nav(page).evaluate((el) => getComputedStyle(el).visibility), "visible");
            assert.equal(await nav(page).evaluate((el) => el.inert), false);
            await nav(page).evaluate((el) => {
                el.getAnimations().forEach((a) => {
                    a.finish();
                });
            });
            assert.ok((await nav(page).boundingBox()).y >= 0, "reversing an unfinished exit must finish visible");
        } finally {
            await context.close();
        }
    });

    test(`reduced motion, focus and open dialogs preserve navigation (${width}px)`, async () => {
        const { context, page } = await open(width, "reduce");
        try {
            await scroll(page, 700);
            assert.equal(await nav(page).evaluate((el) => getComputedStyle(el).visibility), "hidden");
            await scroll(page, 636);
            assert.ok((await nav(page).boundingBox()).y >= 0);
            assert.equal(await nav(page).evaluate((el) => el.getAnimations().length), 0);
            await page.locator("[data-search-trigger]").focus();
            await scroll(page, 750);
            assert.equal(await hidden(page), false, "focused navigation must remain visible");
            await page.locator("[data-search-trigger]").click();
            await page.waitForFunction(() => document.querySelector("[data-search-overlay]").classList.contains("is-open"));
            await waitForPageAnimations(page);
            await page.mouse.wheel(0, 100);
            assert.equal(await page.evaluate(() => scrollY), 750);
            assert.equal(await hidden(page), false);
            await page.keyboard.press("Escape");
            await page.waitForFunction(() => !document.querySelector("[data-search-overlay]").open);
            if (width < 768) {
                await page.locator("[data-nav-toggle]").click();
                await waitForPageAnimations(page);
                await page.mouse.wheel(0, 100);
                assert.equal(await page.evaluate(() => scrollY), 750);
                assert.equal(await hidden(page), false);
                await page.keyboard.press("Escape");
                await page.waitForFunction(() => !document.querySelector("[data-nav-overlay]").open);
            }
            await page.mouse.click(1, 400);
            await scroll(page, 754);
            assert.equal(await hidden(page), false, "dialog close must not create hide intent");
            await page.emulateMedia({ reducedMotion: "no-preference" });
            await scroll(page, 790, false);
            await page.emulateMedia({ reducedMotion: "reduce" });
            assert.equal(await nav(page).evaluate((el) => getComputedStyle(el).visibility), "hidden");
            assert.equal(await nav(page).evaluate((el) => el.getAnimations().length), 0);
            await scroll(page, 725);
            await page.evaluate(() => {
                window.detachedNavigation = document.querySelector(".site-header__inner");
            });
            if (width < 768) {
                await page.locator("[data-nav-toggle]").click();
                await page.locator('[data-nav-link][href="/posts"]').click();
            } else await page.locator('.site-header__links a[href="/posts"]').click();
            await page.waitForURL(new URL("/posts", baseURL).href);
            await waitForPageAnimations(page);
            assert.equal(await page.locator("body").evaluate((el) => el.style.overflow), "");
            assert.equal(await page.evaluate(() => detachedNavigation.isConnected), false);
            await page.locator(".site-brand").click();
            await page.waitForURL(new URL("/", baseURL).href);
            await waitForPageAnimations(page);
            await page.waitForFunction(() => !document.querySelector("[data-latest-channel]").textContent.includes("Loading"));
            await scroll(page, 700);
            await scroll(page, 636);
            assert.equal(await hidden(page), false);
        } finally {
            await context.close();
        }
    });

    test(`focus stays visible through the floating masthead handoff (${width}px)`, async () => {
        const { context, page } = await open(width);
        try {
            const boundary = await page.locator("[data-header]").evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
            await scroll(page, 700);
            await scroll(page, 636);
            await page.locator("[data-search-trigger]").focus();
            await scroll(page, boundary + 1);
            assert.ok((await nav(page).boundingBox()).y >= 0, "focused fixed navigation must stay fully visible");
            assert.equal(await nav(page).evaluate((el) => el.inert), false);
            await page.mouse.click(1, 400);
            await scroll(page, boundary + 2);
            assert.equal(await nav(page).evaluate((el) => el.inert), false, "continuously visible controls must stay accessible");
            assert.ok((await nav(page).boundingBox()).y >= 0);
            await page.locator("[data-search-trigger]").focus();
            await page.keyboard.press(process.env.PLAYWRIGHT_BROWSER === "webkit" ? "Alt+Shift+Tab" : "Tab");
            assert.equal(await nav(page).evaluate((el) => el.contains(document.activeElement)), true);
            await scroll(page, 0);
            assert.equal(await nav(page).evaluate((el) => el.inert), false);
        } finally {
            await context.close();
        }
    });

    test(`resizing floating navigation preserves the measured flow space (${width}px)`, async () => {
        const { context, page } = await open(width);
        try {
            await scroll(page, 700);
            await scroll(page, 636);
            await page.setViewportSize({ width: width === 390 ? 1440 : 320, height: 800 });
            await scroll(page, 636);
            const geometry = () =>
                page.evaluate(() => ({
                    main: document.querySelector("main").getBoundingClientRect().top + scrollY,
                    height: document.documentElement.scrollHeight,
                }));
            const before = await geometry();
            await scroll(page, 750);
            await scroll(page, 686);
            assert.deepEqual(await geometry(), before);
            const size = await nav(page).evaluate((el) => ({
                height: el.offsetHeight,
                reserved: parseFloat(el.parentElement.style.getPropertyValue("--navigation-height")),
                right: el.getBoundingClientRect().right,
                viewport: innerWidth,
            }));
            assert.equal(size.height, size.reserved);
            assert.ok(size.right <= size.viewport);
        } finally {
            await context.close();
        }
    });
}
