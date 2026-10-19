import assert from "node:assert/strict";
import test from "node:test";
import { baseURL, waitForPageAnimations } from "./helpers/browser.mjs";
import { launchNavigationBrowser } from "./helpers/navigation-browser.mjs";

test("browser canvas matches the page wash through theme changes and Beer Log SPA navigation", async () => {
    const browser = await launchNavigationBrowser();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
        await page.route("**/api/latest-channel", (route) => route.fulfill({ contentType: "text/html", body: "" }));
        await page.goto(baseURL);
        await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true");
        await page.evaluate(() => {
            window.__canvasDocument = document;
        });
        for (const path of ["/", "/beer-collection", "/"]) {
            if (new URL(page.url()).pathname !== path) {
                await page.evaluate((href) => {
                    const link = document.createElement("a");
                    link.href = href;
                    document.body.append(link);
                    link.click();
                }, path);
                await page.waitForURL(new URL(path, baseURL).href);
                await page.waitForFunction(() => document.querySelector("[data-theme-toggle]")?.dataset.themeBound === "true");
                assert.equal(await page.evaluate(() => window.__canvasDocument === document), true, "navigation must use ClientRouter");
            }
            for (const theme of ["light", "dark"]) {
                for (let attempt = 0; attempt < 3 && (await page.locator("html").getAttribute("data-theme-mode")) !== theme; attempt++) {
                    await page.locator("[data-theme-toggle]").first().click();
                }
                assert.equal(await page.locator("html").getAttribute("data-theme-mode"), theme);
                await waitForPageAnimations(page);
                const paint = await page.evaluate(() => {
                    const root = getComputedStyle(document.documentElement);
                    const body = getComputedStyle(document.body);
                    const wash = getComputedStyle(document.body, "::before");
                    const probe = document.createElement("span");
                    probe.style.transition = "none";
                    probe.style.backgroundColor =
                        "color-mix(in srgb, var(--page-wash-ink, var(--color-structure)) var(--page-wash-strength), var(--color-bg-page))";
                    document.body.append(probe);
                    const top = getComputedStyle(probe).backgroundColor;
                    probe.style.backgroundColor = "var(--color-bg-page)";
                    const base = getComputedStyle(probe).backgroundColor;
                    probe.remove();
                    return {
                        root: root.backgroundColor,
                        body: body.backgroundColor,
                        image: body.backgroundImage,
                        wash: wash.backgroundImage,
                        top,
                        base,
                    };
                });
                assert.equal(paint.body, paint.top, `${path} ${theme}: Safari canvas fallback must match the wash start`);
                assert.equal(paint.root, paint.top, `${path} ${theme}: root canvas must match too`);
                assert.notEqual(paint.top, paint.base, "the wash must remain distinct from the page base");
                assert.equal(paint.image, `linear-gradient(${paint.base}, ${paint.base})`, "the visible body keeps its opaque page base");
                assert.ok(paint.wash.startsWith(`linear-gradient(${paint.top} 0px,`), "page wash shares the canvas color");
                for (let cycle = 0; cycle < 2; cycle++) {
                    for (const top of [200, 160, 100, 33, 0]) {
                        await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top);
                        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                        await waitForPageAnimations(page);
                        const navigation = await page.locator(".site-header__inner").evaluate((el) => ({
                            floating: el.closest("[data-header]").hasAttribute("data-nav-floating"),
                            color: getComputedStyle(el).backgroundColor,
                            image: getComputedStyle(el).backgroundImage,
                            root: getComputedStyle(document.documentElement).backgroundColor,
                        }));
                        assert.equal(navigation.root, paint.top, "scrolling must preserve the root canvas color");
                        assert.equal(navigation.floating, top !== 0, `${path} ${theme}: exercise the floating navigation handoff`);
                        if (navigation.floating) {
                            assert.equal(
                                navigation.color,
                                paint.top,
                                `${path} ${theme} at ${top}: fixed navigation must keep the same Safari sampling color`,
                            );
                            assert.ok(
                                navigation.image.endsWith(`, linear-gradient(${paint.base}, ${paint.base})`),
                                "the navigation keeps its opaque page base beneath the aligned wash",
                            );
                        }
                    }
                }
            }
        }
    } finally {
        await browser.close();
    }
});
