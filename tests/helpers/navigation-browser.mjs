import { chromium, webkit } from "playwright";
import { launchOptions } from "./browser.mjs";

// Keep the older focus-suite alias working, but never silently mix engines.
const requested = process.env.PLAYWRIGHT_BROWSER;
const legacy = process.env.PLAYWRIGHT_ENGINE;
if (requested && legacy && requested !== legacy) throw new Error("PLAYWRIGHT_BROWSER and PLAYWRIGHT_ENGINE must agree");
export const navigationBrowserName = requested || legacy || "chromium";
const browserType = { chromium, webkit }[navigationBrowserName];
if (!browserType) throw new Error("Navigation tests require PLAYWRIGHT_BROWSER=chromium or webkit");

export async function launchNavigationBrowser() {
    const browser = await browserType.launch(navigationBrowserName === "webkit" ? { headless: true } : launchOptions);
    if (browser.browserType().name() !== navigationBrowserName) throw new Error("Navigation browser engine mismatch");
    console.info(`Navigation browser: ${browser.browserType().name()} ${browser.version()}`);
    return browser;
}

// Playwright has no cross-engine touch-pan API. CDP dispatches trusted touch
// input in Chromium; WebKit tests must not label wheel/scrollTo as touch pans.
export async function touchPan(page, deltaY) {
    const session = await page.context().newCDPSession(page);
    const startY = deltaY < 0 ? 650 : 230;
    try {
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 170, y: startY }] });
        for (let i = 1; i <= 12; i++) {
            await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 170, y: startY + (deltaY * i) / 12 }] });
            await page.waitForTimeout(25);
        }
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(
            () =>
                new Promise((resolve) => {
                    let lastY = scrollY;
                    let stillFrames = 0;
                    const check = () => {
                        stillFrames = Math.abs(scrollY - lastY) < 0.5 ? stillFrames + 1 : 0;
                        lastY = scrollY;
                        if (stillFrames >= 8) resolve(true);
                        else requestAnimationFrame(check);
                    };
                    requestAnimationFrame(check);
                }),
        );
    } finally {
        await session.detach();
    }
}
