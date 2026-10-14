import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { compile } from "sass";
import ts from "typescript";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

// Run the actual modules and stylesheet in a local browser fixture; no site APIs.
const transpile = (path) =>
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
const script = `${transpile("../src/utils/imagePreloader.ts").replace(/^export /gm, "")}\n${transpile("../src/scripts/post-preview.ts")
    .replace(/^import .*;\n/m, "")
    .replace(/^export /gm, "")}\ninitPostPreview();`;
const style = compile(new URL("../src/styles/components/_post-preview.scss", import.meta.url).pathname).css;
const metadata = {
    zh: { title: "中文文章", description: "这是用来检验预览语言和键盘操作的文章摘要。", lang: "zh" },
    en: { title: "English article", description: "An English article summary.", lang: "en" },
};
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${style}
body { margin: 0; } #title { position: absolute; top: 140px; left: 80px; width: 280px; line-height: 24px; } #underlying { position: absolute; top: 170px; left: 580px; }
</style></head><body><a id="title" href="/posts/zh" data-post-id="zh" aria-describedby="existing-description">Chinese article</a><span id="existing-description" hidden>Existing description</span><a id="underlying" href="/posts/en" data-post-id="en">Underlying link</a><script id="all-posts-meta" type="application/json">${JSON.stringify(metadata)}</script></body></html>`;
let browser;
before(async () => {
    browser = await chromium.launch(launchOptions);
});
after(async () => {
    await browser?.close();
});

async function open(options = {}) {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 }, ...options });
    const page = await context.newPage();
    page.setDefaultTimeout(2500);
    await page.route(`${baseURL}/**`, (route) => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto(`${baseURL}/preview-fixture`);
    await page.addScriptTag({ content: script });
    return { context, page };
}
const visibleCard = (page) => page.locator(".post-preview-card.visible");

// Catches gating keyboard listeners by mouse capability, omitted tooltip lang,
// and Escape removing another component's description association.
test("coarse-pointer keyboard focus exposes a Chinese preview and keeps direct title activation", async () => {
    const { context, page } = await open({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 600 } });
    try {
        assert.equal(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches), false);
        await page.locator("#title").hover();
        await page.waitForTimeout(400);
        assert.equal(await visibleCard(page).count(), 0, "coarse-pointer mouse activation stays disabled");
        await page.keyboard.press("Tab");
        await visibleCard(page).waitFor();
        assert.equal(await visibleCard(page).getAttribute("lang"), "zh-CN");
        assert.equal(await page.locator("#title").getAttribute("aria-describedby"), "existing-description post-preview-tooltip");
        await page.keyboard.press("Escape");
        assert.equal(await visibleCard(page).count(), 0);
        assert.equal(await page.locator("#title").getAttribute("aria-describedby"), "existing-description");
        await page.keyboard.press("Enter");
        await page.waitForURL(`${baseURL}/posts/zh`);
    } finally {
        await context.close();
    }
});

// Catches immediate mouseleave dismissal, a moving card that evades inspection,
// and a tooltip capturing clicks meant for the title underneath it.
test("pointer crosses the bridge and inspects a stable card with click passthrough", async () => {
    const { context, page } = await open();
    try {
        await page.mouse.move(340, 152);
        await visibleCard(page).waitFor();
        await page.mouse.move(350, 152);
        await page.waitForTimeout(50);
        const box = await visibleCard(page).boundingBox();
        await page.mouse.move(362, 152);
        await page.waitForTimeout(50);
        assert.equal(await visibleCard(page).count(), 1, "bridge must keep preview visible");
        await page.mouse.move(box.x + box.width / 2, box.y + 10);
        await page.waitForTimeout(100);
        assert.deepEqual(await visibleCard(page).boundingBox(), box, "card must freeze while pointer inspects it");
        assert.equal(await visibleCard(page).evaluate((el) => getComputedStyle(el).pointerEvents), "none");
        await page.mouse.move(590, 180);
        await page.waitForTimeout(400);
        assert.equal(await visibleCard(page).locator("h4").textContent(), "中文文章", "underlying links cannot replace an inspected card");
        await page.mouse.click(590, 180);
        await page.waitForURL(`${baseURL}/posts/en`);
    } finally {
        await context.close();
    }
});

test("a preview flipped to the left remains reachable across its bridge", async () => {
    const { context, page } = await open();
    try {
        await page.locator("#title").evaluate((el) => {
            el.style.left = "700px";
            el.style.width = "80px";
        });
        await page.mouse.move(710, 152);
        await visibleCard(page).waitFor();
        const box = await visibleCard(page).boundingBox();
        assert.ok(box.x + box.width < 700, "fixture must exercise a left-side gap");
        await page.mouse.move(697, 152);
        await page.mouse.move(box.x + box.width / 2, box.y + 10);
        await page.waitForTimeout(100);
        assert.deepEqual(await visibleCard(page).boundingBox(), box);
        await page.mouse.move(0, 0);
        assert.equal(await visibleCard(page).count(), 0);
    } finally {
        await context.close();
    }
});

test("leaving both regions and lifecycle cleanup dismiss visible and pending previews", async () => {
    const { context, page } = await open();
    try {
        for (const action of ["leave", "leave-window", "escape", "scroll", "resize", "destroy"]) {
            await page.evaluate(() => initPostPreview());
            await page.mouse.move(0, 0);
            await page.mouse.move(350, 152);
            await visibleCard(page).waitFor();
            if (action === "leave") await page.mouse.move(0, 0);
            else if (action === "leave-window") await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseleave")));
            else if (action === "escape") await page.keyboard.press("Escape");
            else if (action === "destroy") await page.evaluate(() => destroyPostPreview());
            else await page.evaluate((name) => window.dispatchEvent(new Event(name)), action);
            assert.equal(await visibleCard(page).count(), 0, `${action} must dismiss`);
            assert.equal(await page.locator("#title").getAttribute("aria-describedby"), "existing-description");
        }
        await page.evaluate(() => initPostPreview());
        await page.mouse.move(0, 0);
        await page.mouse.move(350, 152);
        await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
        await page.waitForTimeout(400);
        assert.equal(await visibleCard(page).count(), 0, "scroll cancels pending preview");
        await page.mouse.move(0, 0);
        await page.mouse.move(350, 152);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
        assert.equal(await visibleCard(page).count(), 0, "Escape cancels pending preview");
        await page.evaluate(() => destroyPostPreview());
        await page.mouse.move(0, 0);
        await page.mouse.move(350, 152);
        await page.waitForTimeout(400);
        assert.equal(await page.locator(".post-preview-card").count(), 0, "destroy removes listeners and the tooltip");
    } finally {
        await context.close();
    }
});

test("reduced-motion keyboard preview fits a narrow short viewport", async () => {
    const { context, page } = await open({ viewport: { width: 360, height: 240 }, reducedMotion: "reduce" });
    try {
        await page.keyboard.press("Tab");
        await visibleCard(page).waitFor();
        const box = await visibleCard(page).boundingBox();
        assert.ok(box.x >= 12 && box.x + box.width <= 348);
        assert.ok(box.y >= 12 && box.y + box.height <= 228);
        assert.equal(await visibleCard(page).evaluate((el) => getComputedStyle(el).transitionDuration), "0s");
        assert.equal(await visibleCard(page).getAttribute("lang"), "zh-CN");
        await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseleave")));
        assert.equal(await visibleCard(page).count(), 1, "keyboard focus persists when the pointer leaves the window");
        await page.locator("#underlying").evaluate((el) => {
            el.style.left = "80px";
            el.style.top = "180px";
        });
        await page.keyboard.press("Tab");
        await visibleCard(page).waitFor();
        assert.equal(await visibleCard(page).getAttribute("lang"), "en", "language resets for the next post");
    } finally {
        await context.close();
    }
});
