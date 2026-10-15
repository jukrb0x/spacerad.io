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

async function open(options = {}, postMetadata = metadata) {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 }, ...options });
    const page = await context.newPage();
    page.setDefaultTimeout(2500);
    await page.route(`${baseURL}/**`, (route) =>
        route.fulfill({ contentType: "text/html", body: html.replace(JSON.stringify(metadata), JSON.stringify(postMetadata)) }),
    );
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

// Catches missing producer metadata: the fixture-only rendering tests cannot prove
// actual article tags reach the client after Astro serializes the collection.
test("published article metadata includes its actual tags", async () => {
    const page = await browser.newPage();
    try {
        await page.goto(`${baseURL}/posts`);
        const posts = JSON.parse(await page.locator("#all-posts-meta").textContent());
        assert.deepEqual(posts["ue5-landscape-grass"].tags, ["Unreal Engine", "Landscape", "Foliage", "UE5"]);
        assert.deepEqual(posts["just-bought-a-new-domain-name-xcode-zip"].tags, ["web"]);
    } finally {
        await page.close();
    }
});

// Catches unsafe HTML injection, accidental link/button affordances, missing tag
// clearing when another article is focused, and empty-height reservation.
test("outline tags are safe display-only metadata and disappear for an untagged article", async () => {
    const { context, page } = await open(
        {},
        {
            ...metadata,
            zh: { ...metadata.zh, tags: ["Unreal Engine", "Landscape", "<img src=x onerror=alert(1)>", "UE5"] },
        },
    );
    try {
        await page.keyboard.press("Tab");
        await visibleCard(page).waitFor();
        const tags = visibleCard(page).locator(".post-preview-card__tags");
        assert.deepEqual(await tags.locator("li").allTextContents(), ["#Unreal Engine", "#Landscape", "#<img src=x onerror=alert(1)>", "#UE5"]);
        assert.equal(await tags.locator("a,button,img,[tabindex]").count(), 0);
        const appearance = await tags
            .locator("li")
            .first()
            .evaluate((el) => {
                const css = getComputedStyle(el);
                return { border: css.borderTopStyle, background: css.backgroundColor, shadow: css.boxShadow, radius: parseFloat(css.borderRadius) };
            });
        assert.equal(appearance.border, "solid");
        assert.equal(appearance.background, "rgba(0, 0, 0, 0)");
        assert.equal(appearance.shadow, "none");
        assert.ok(appearance.radius > 10);
        assert.equal(await visibleCard(page).evaluate((el) => getComputedStyle(el).pointerEvents), "none");
        await page.keyboard.press("Tab");
        await page.waitForFunction(() => document.querySelector(".post-preview-card__title")?.textContent === "English article");
        assert.equal(await tags.isVisible(), false);
        assert.equal(await tags.evaluate((el) => el.getBoundingClientRect().height), 0);
        assert.equal(await tags.locator("li").count(), 0);
    } finally {
        await context.close();
    }
});

// Catches a clipped last capsule/remainder, excessively tall lists, overlong tag
// overflow, and a card that meets its max-height only by hiding its own content.
test("many and long tags fit narrow short viewports with an explicit remainder", async () => {
    const longTag = "LongUnbrokenLabel".repeat(20);
    const tags = [longTag, ...Array.from({ length: 24 }, (_, i) => `Topic ${i + 1}`)];
    const image =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='560' height='280'%3E%3Crect width='560' height='280' fill='blue'/%3E%3C/svg%3E";
    for (const viewport of [
        { width: 320, height: 240 },
        { width: 390, height: 600 },
        { width: 360, height: 180 },
    ]) {
        const { context, page } = await open(
            { viewport, reducedMotion: "reduce" },
            {
                ...metadata,
                zh: {
                    ...metadata.zh,
                    title: "A long article title that uses the two available title lines",
                    description: "A substantial excerpt. ".repeat(30),
                    tags,
                    image,
                },
            },
        );
        try {
            await page.locator("#title").evaluate((el) => {
                el.style.left = "24px";
                el.style.width = "calc(100vw - 48px)";
            });
            await page.locator("#underlying").evaluate((el) => {
                el.style.left = "24px";
            });
            await page.keyboard.press("Tab");
            await visibleCard(page).waitFor();
            const list = visibleCard(page).locator(".post-preview-card__tags");
            assert.ok((await list.getAttribute("aria-label")).includes(longTag), "full tag labels remain accessible");
            const labels = await list.locator("li").allTextContents();
            assert.match(labels.at(-1), /^\+\d+$/);
            const shown = labels.length - 1;
            assert.equal(Number(labels.at(-1).slice(1)), tags.length - shown);
            const geometry = await visibleCard(page).evaluate((card) => {
                const rect = card.getBoundingClientRect();
                const content = card.querySelector(".post-preview-card__content");
                const items = [...card.querySelectorAll(".post-preview-card__tags li")].map((el) => el.getBoundingClientRect().toJSON());
                return {
                    rect: rect.toJSON(),
                    naturalHeight: content.scrollHeight,
                    innerHeight: card.clientHeight,
                    pageWidth: document.documentElement.scrollWidth,
                    items,
                };
            });
            assert.ok(geometry.rect.x >= 12 && geometry.rect.right <= viewport.width - 12);
            assert.ok(geometry.rect.y >= 12 && geometry.rect.bottom <= viewport.height - 12);
            assert.ok(geometry.naturalHeight <= geometry.innerHeight, "card must not clip its content to meet viewport height");
            assert.equal(geometry.pageWidth, viewport.width);
            for (const item of geometry.items) {
                assert.ok(item.x >= geometry.rect.x && item.right <= geometry.rect.right);
                assert.ok(item.bottom <= geometry.rect.bottom, "whole capsule must fit");
            }
            await page.evaluate(() => destroyPostPreview());
            assert.equal(await page.locator(".post-preview-card").count(), 0);
        } finally {
            await context.close();
        }
    }
});

test("a viewport too short for a tag row retains the full accessible description", async () => {
    const tags = ["Unreal Engine", "Landscape", "Foliage", "UE5"];
    const { context, page } = await open({ viewport: { width: 320, height: 120 } }, { ...metadata, zh: { ...metadata.zh, title: "Title", tags } });
    try {
        await page.locator("#title").evaluate((el) => {
            el.style.top = "24px";
            el.style.left = "24px";
            el.style.width = "200px";
        });
        await page.keyboard.press("Tab");
        await visibleCard(page).waitFor();
        const client = await context.newCDPSession(page);
        const { nodes } = await client.send("Accessibility.getFullAXTree");
        const link = nodes.find((node) => node.role?.value === "link" && node.name?.value === "Chinese article");
        assert.ok(link.description?.value.includes(`Tags: ${tags.join(", ")}`), "computed link description must retain every tag");
        const box = await visibleCard(page).boundingBox();
        assert.ok(box.y >= 12 && box.y + box.height <= 108);
        await page.setViewportSize({ width: 320, height: 600 });
        await page.waitForFunction(() => !document.querySelector(".post-preview-card")?.classList.contains("visible"));
        await page.locator("#title").blur();
        await page.locator("#title").focus();
        await visibleCard(page).waitFor();
        assert.equal(await visibleCard(page).locator(".post-preview-card__tags li").count(), 4, "normal sizing resets the compact fallback");
        assert.ok((await visibleCard(page).locator(".post-preview-card__tags").boundingBox()).height > 1);
    } finally {
        await context.close();
    }
});

test("late image failure refits the tags", async () => {
    const { context, page } = await open(
        { viewport: { width: 360, height: 280 } },
        {
            ...metadata,
            zh: { ...metadata.zh, tags: ["Unreal Engine", "Landscape", "Foliage", "UE5"], image: `${baseURL}/late-image.svg` },
        },
    );
    let finishImage;
    const released = new Promise((resolve) => {
        finishImage = resolve;
    });
    await page.route("**/late-image.svg", async (route) => {
        await released;
        await route.abort();
    });
    try {
        await page.keyboard.press("Tab");
        await visibleCard(page).waitFor();
        finishImage();
        await page.waitForFunction(() => document.querySelector(".post-preview-card__image-container")?.hidden);
        assert.equal(await visibleCard(page).locator(".post-preview-card__tags li").count(), 4);
        assert.equal(
            await visibleCard(page).evaluate((card) => card.querySelector(".post-preview-card__content").scrollHeight <= card.clientHeight),
            true,
        );
        await page.keyboard.press("Escape");
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await visibleCard(page).count(), 0);
    } finally {
        finishImage();
        await context.close();
    }
});

test("pending images and fonts cannot refit a dismissed or destroyed preview", async () => {
    const font = readFileSync(new URL("../public/fonts/Cabin-latin.woff2", import.meta.url));
    for (const action of ["escape", "destroy"]) {
        const { context, page } = await open(
            {},
            { ...metadata, zh: { ...metadata.zh, tags: ["Unreal Engine", "Landscape"], image: `${baseURL}/pending-image.svg` } },
        );
        let release;
        const pending = new Promise((resolve) => {
            release = resolve;
        });
        let imageRequested;
        const imageRequest = new Promise((resolve) => {
            imageRequested = resolve;
        });
        let fontRequested;
        const fontRequest = new Promise((resolve) => {
            fontRequested = resolve;
        });
        await page.route("**/pending-image.svg", async (route) => {
            imageRequested();
            await pending;
            await route.abort();
        });
        await page.route("**/pending-font.woff2", async (route) => {
            fontRequested();
            await pending;
            await route.fulfill({ contentType: "font/woff2", body: font });
        });
        try {
            await page.addStyleTag({
                content: `@font-face { font-family: PendingPreviewFont; src: url('${baseURL}/pending-font.woff2'); } .post-preview-card__tags { font-family: PendingPreviewFont, sans-serif; }`,
            });
            await page.keyboard.press("Tab");
            await visibleCard(page).waitFor();
            await Promise.all([imageRequest, fontRequest]);
            if (action === "escape") {
                await page.keyboard.press("Escape");
                await page.locator(".post-preview-card__tags").evaluate((el) => {
                    el.textContent = "dismissed";
                });
            } else await page.evaluate(() => destroyPostPreview());
            release();
            await page.evaluate(() => document.fonts.ready);
            await page.waitForFunction(() => getImageState(new URL("/pending-image.svg", location.origin).href) === "error");
            assert.equal(await visibleCard(page).count(), 0);
            assert.equal(await page.locator("#title").getAttribute("aria-describedby"), "existing-description");
            if (action === "escape")
                assert.equal(
                    await page.locator(".post-preview-card__tags").textContent(),
                    "dismissed",
                    "stale callbacks cannot mutate the dismissed card",
                );
            else assert.equal(await page.locator(".post-preview-card").count(), 0);
        } finally {
            release();
            await context.close();
        }
    }
});
