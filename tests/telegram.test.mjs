import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as cheerio from "cheerio";
import { fetchTelegramChannel } from "../src/utils/telegram.ts";

const fixture = readFileSync(new URL("fixtures/telegram.html", import.meta.url), "utf8");
async function channel(t, html = fixture) {
    t.mock.method(globalThis, "fetch", async () => new Response(html));
    return fetchTelegramChannel("SpaceRad_io");
}
test("Telegram caption is one alt value and description remains literal text", async (t) => {
    const result = await channel(t);
    const $ = cheerio.load(result.posts[0].content);
    assert.equal($(".telegram-post-image").attr("alt"), result.posts[0].title);
    assert.equal($("img[onerror]").length, 0);
    const description = cheerio.load(result.description);
    assert.equal(description("b").length, 0);
    assert.match(description.root().text(), /Literal <b>not markup<\/b>/);
    assert.equal(description("ol li").length, 2);
});

test("Telegram sanitizer retains supported formatting, images and links", async (t) => {
    const result = await channel(t);
    const $ = cheerio.load(result.posts[0].content);
    for (const tag of ["b", "i", "u", "s", "code", "blockquote", ".tg-spoiler", "ol li"]) assert.ok($(tag).length, tag);
    assert.equal($("script, svg, iframe, [onerror], [style]").length, 0);
    assert.equal($("blockquote").attr("expandable"), "");
    assert.equal($("div[dir]").attr("dir"), "auto");
    assert.equal($('a[href^="javascript:"]').length, 0);
    assert.equal($(".telegram-post-image").attr("src"), "/api/image-proxy?url=https%3A%2F%2Fcdn4.telegram-cdn.org%2Fexample.jpg");
    assert.equal(result.posts[0].id, "42");
    assert.equal(result.posts[0].datetime, "2026-10-01T12:00:00Z");
    assert.equal($('a:contains("External")').attr("href"), "https://example.com/a?x=1&y=2");
});

test("Telegram relative hashtag links resolve once at the parser boundary", async (t) => {
    const result = await channel(t);
    const $ = cheerio.load(result.posts[0].content);
    assert.equal($('a:contains("#fixture")').attr("href"), "https://t.me/s/SpaceRad_io?q=%23fixture");
    assert.deepEqual(result.posts[0].hashtags, ["fixture"]);
});

test("Telegram excludes raw text, foreign content and encoded unsafe link schemes", async (t) => {
    const payload =
        '<xmp><img src=x onerror="example()"></xmp><textarea>&lt;img src=x onerror=example()&gt;</textarea><svg><a><animate attributeName="href" values="#safe;javascript:example()"></animate></a></svg><a href="jav&#0000097;script:example()">bad</a>';
    const result = await channel(t, fixture.replace("<b>Bold</b>", payload));
    const $ = cheerio.load(result.posts[0].content);
    assert.equal($("xmp, textarea, svg, animate, [onerror]").length, 0);
    assert.equal($('a[href*="script:"]').length, 0);
});

test("Telegram passes pagination and retains fetch timeout/error behavior", async (t) => {
    t.mock.method(globalThis, "fetch", async (url, options) => {
        assert.equal(url, "https://t.me/s/SpaceRad_io?before=42");
        assert.ok(options.signal instanceof AbortSignal);
        return new Response(fixture);
    });
    assert.equal((await fetchTelegramChannel("SpaceRad_io", { before: "42" })).posts[0].id, "42");
    t.mock.method(console, "error", () => {});
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503, statusText: "Unavailable" }));
    await assert.rejects(fetchTelegramChannel("SpaceRad_io"), /Failed to fetch channel/);
});

test("Telegram single photos preserve upstream intrinsic dimensions without using album crop frames", async (t) => {
    const single = fixture
        .replace('style="background-image:', 'style="width:800px;background-image:')
        .replace("example.jpg')\"></a>", 'example.jpg\')"><i class="tgme_widget_message_photo" style="padding-top:60%"></i></a>');
    const result = await channel(t, single);
    const image = cheerio.load(result.posts[0].content)(".telegram-post-image");
    assert.equal(image.attr("width"), "800");
    assert.equal(image.attr("height"), "480");
    assert.equal(result.posts[0].previewImage, image.attr("src"));
    for (const html of [
        fixture,
        single.replace("width:800px", "width:0px"),
        single.replace("padding-top:60%", "padding-top:NaN%"),
        single.replace("padding-top:60%", "padding-top:60%;padding-top:50%"),
        single.replace("tgme_widget_message_photo_wrap", "tgme_widget_message_photo_wrap grouped_media_wrap"),
    ]) {
        const missing = cheerio.load((await channel(t, html)).posts[0].content)(".telegram-post-image");
        assert.equal(missing.attr("width"), undefined);
        assert.equal(missing.attr("height"), undefined);
    }
});
