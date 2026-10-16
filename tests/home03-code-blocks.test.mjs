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

for (const width of [320, 390, 1440]) {
    for (const theme of ["light", "dark"]) {
        test(`article code keeps syntax, scroll and exact copy at ${width}px in ${theme}`, async () => {
            const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
            await context.addInitScript((value) => localStorage.setItem("theme-preference", value), theme);
            const page = await context.newPage();
            try {
                await page.goto(new URL("/posts/ue5-landscape-grass-en", baseURL).href, { waitUntil: "domcontentloaded" });
                await page.waitForFunction(
                    () =>
                        document.querySelector(".code-copy-button") &&
                        getComputedStyle(document.querySelector(".code-copy-button")).minHeight !== "auto",
                );
                const pre = page.locator('pre[data-language="cpp"]').first();
                await pre.waitFor();
                assert.equal(
                    await page.locator("html").getAttribute("data-code-preview"),
                    null,
                    "normal production rendering needs no preview switch",
                );
                const block = pre.locator('xpath=ancestor::div[contains(@class,"code-block-wrapper")]');
                const state = await pre.evaluate((el) => ({
                    pageWidth: document.documentElement.scrollWidth,
                    viewport: innerWidth,
                    scrollWidth: el.scrollWidth,
                    width: el.clientWidth,
                    colors: [...new Set([...el.querySelectorAll("span[style]")].map((span) => getComputedStyle(span).color))],
                }));
                assert.ok(state.pageWidth <= state.viewport);
                if (width < 500) assert.ok(state.scrollWidth > state.width);
                assert.ok(state.colors.length >= 6, "C++ grammar categories retain distinct colors");
                assert.equal(await block.evaluate((el) => getComputedStyle(el).borderLeftWidth), "0px");
                const code = await pre.locator("code").textContent();
                await block.locator("button").click();
                await page.waitForTimeout(250);
                const successColors = await block.locator("button").evaluate((el) => {
                    const probe = document.createElement("span");
                    probe.style.color = "var(--color-success)";
                    el.append(probe);
                    const colors = { actual: getComputedStyle(el).color, expected: getComputedStyle(probe).color };
                    probe.remove();
                    return colors;
                });
                assert.equal(successColors.actual, successColors.expected, "copy success retains its success color");
                assert.equal(await page.evaluate(() => navigator.clipboard.readText()), code);
                await block.locator("button").focus();
                await page.keyboard.press("Tab");
                assert.ok(await pre.evaluate((el) => el === document.activeElement));
            } finally {
                await context.close();
            }
        });
    }
}

test("Markdown link text and destinations remain distinct in both themes", async () => {
    const page = await browser.newPage();
    try {
        await page.goto(new URL("/posts/the-evolution-of-my-website-how-i-rebuilt-it-with-nextjs", baseURL).href);
        const pre = page.locator('pre[data-language="markdown"]').first();
        for (const theme of ["light", "dark"]) {
            await page.evaluate((value) => {
                document.documentElement.dataset.theme = value;
            }, theme);
            const colors = await pre.evaluate((el) => {
                const tokens = [...el.querySelectorAll("span[style]")];
                const color = (text) => getComputedStyle(tokens.find((token) => token.textContent === text)).color;
                return { label: color("Learn more"), path: color("/more"), punctuation: color("[") };
            });
            assert.equal(new Set(Object.values(colors)).size, 3);
        }
    } finally {
        await page.close();
    }
});

test("grouped character highlights keep their distinct author-selected colors", async () => {
    const page = await browser.newPage();
    try {
        await page.goto(new URL("/posts/ue5-landscape-grass-en", baseURL).href);
        const colors = await page
            .locator("pre [data-highlighted-chars]")
            .first()
            .evaluate((el) => {
                const original = el.getAttribute("data-highlighted-chars-id");
                const result = ["v", "s", "i"].map((id) => {
                    el.setAttribute("data-highlighted-chars-id", id);
                    return getComputedStyle(el).backgroundColor;
                });
                if (original === null) el.removeAttribute("data-highlighted-chars-id");
                else el.setAttribute("data-highlighted-chars-id", original);
                return result;
            });
        assert.equal(new Set(colors).size, 3);
    } finally {
        await page.close();
    }
});
