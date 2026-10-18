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

// Representative public-preview markup, not captures of the reported screenshot.
function withForwardHeader(header) {
    return fixture.replace('<a class="tgme_widget_message_date">', `${header}<a class="tgme_widget_message_date">`);
}

test("Telegram retains forwarding independently of optional source attribution", async (t) => {
    const variants = [
        [
            '<a class="tgme_widget_message_forwarded_from_name" href="https://t.me/source/123"><span>Source channel</span></a>',
            "Source channel",
            "https://t.me/source/123",
        ],
        ['<a class="tgme_widget_message_forwarded_from_name" href="https://t.me/person">Public user</a>', "Public user", "https://t.me/person"],
        ['<span class="tgme_widget_message_forwarded_from_name">Hidden user</span>', "Hidden user", undefined],
        ['<span class="tgme_widget_message_forwarded_from_name">   </span>', undefined, undefined],
        ["", undefined, undefined],
        ['<a class="tgme_widget_message_forwarded_from_name" href="javascript:example()">Source</a>', "Source", undefined],
    ];
    for (const [source, name, link] of variants) {
        const result = await channel(t, withForwardHeader(`<div class="tgme_widget_message_forwarded_from">Forwarded from ${source}</div>`));
        assert.equal(result.posts[0].isForwarded, true, source || "header without attribution");
        assert.equal(result.posts[0].forwardedFrom, name);
        assert.equal(result.posts[0].forwardedFromLink, link);
    }
});

test("Telegram retains legacy source-name metadata without the wrapper", async (t) => {
    const result = await channel(t, withForwardHeader('<span class="tgme_widget_message_forwarded_from_name">Legacy source</span>'));
    assert.equal(result.posts[0].isForwarded, true);
    assert.equal(result.posts[0].forwardedFrom, "Legacy source");
});

test("Telegram does not infer forwards from original text or reply authors", async (t) => {
    const result = await channel(
        t,
        withForwardHeader(
            '<a class="tgme_widget_message_reply" href="/SpaceRad_io/41"><span class="tgme_widget_message_author_name">Reply author</span><span class="tgme_widget_message_text">Forwarded from Someone</span></a>',
        ),
    );
    assert.equal(result.posts[0].isForwarded, false);
    assert.equal(result.posts[0].forwardedFrom, undefined);
    assert.equal(result.posts[0].forwardedFromLink, undefined);
    assert.equal(result.posts[0].replyInfo.replyToAuthor, "Reply author");
});

test("Telegram ordinary posts retain non-forward status", async (t) => {
    const result = await channel(t);
    assert.equal(result.posts[0].isForwarded, false);
    assert.equal(result.posts[0].forwardedFrom, undefined);
    assert.equal(result.posts[0].forwardedFromLink, undefined);
});

test("Telegram historical pages retain forward metadata", async (t) => {
    for (const direction of ["before", "after"]) {
        t.mock.method(globalThis, "fetch", async (url) => {
            assert.equal(url, `https://t.me/s/SpaceRad_io?${direction}=43`);
            return new Response(withForwardHeader('<div class="tgme_widget_message_forwarded_from">Forwarded message</div>'));
        });
        const result = await fetchTelegramChannel("SpaceRad_io", { [direction]: "43" });
        assert.equal(result.posts[0].isForwarded, true);
        assert.equal(result.posts[0].forwardedFrom, undefined);
    }
});

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

test("Telegram retains a plain description with original blank lines and literal characters", async (t) => {
    const html = fixture.replace(
        /(<div class="tgme_channel_info_description">)[\s\S]*?(<\/div>)/,
        "$1FM 466.6<br><br>We Know Nothing. 🪐 &amp; &lt;script&gt;\r\n1. Keep numbering$2",
    );
    const result = await channel(t, html);
    assert.equal(result.descriptionText, "FM 466.6\n\nWe Know Nothing. 🪐 & <script>\n1. Keep numbering");
});

test("Telegram accepts a known channel shell with no messages, but rejects invalid upstream pages", async (t) => {
    const empty = fixture.slice(0, fixture.indexOf('<div class="tgme_widget_message_wrap">'));
    assert.deepEqual((await channel(t, empty)).posts, []);
    t.mock.method(console, "error", () => {});
    for (const html of [
        "",
        "<html><h1>Access denied</h1></html>",
        fixture.replace("tgme_channel_info_header_title", "changed-title"),
        fixture.replace('data-post="SpaceRad_io/42"', 'data-post="other/42"'),
    ]) {
        await assert.rejects(channel(t, html), /Invalid Telegram/);
    }
});

test("Telegram uses the cache refresh abort signal through response body consumption", async (t) => {
    const controller = new AbortController();
    t.mock.method(globalThis, "fetch", async (_url, options) => {
        assert.equal(options.signal, controller.signal);
        return new Response(fixture);
    });
    await fetchTelegramChannel("SpaceRad_io", {}, controller.signal);
});

test("Telegram aborts a stalled response body when the refresh signal expires", { timeout: 1000 }, async (t) => {
    const controller = new AbortController();
    let bodyAborted = false;
    t.mock.method(console, "error", () => {});
    t.mock.method(
        globalThis,
        "fetch",
        async (_url, options) =>
            new Response(
                new ReadableStream({
                    start(body) {
                        options.signal.addEventListener(
                            "abort",
                            () => {
                                bodyAborted = true;
                                body.error(options.signal.reason);
                            },
                            { once: true },
                        );
                    },
                }),
            ),
    );
    const result = fetchTelegramChannel("SpaceRad_io", {}, controller.signal);
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await assert.rejects(result, { name: "AbortError" });
    assert.equal(bodyAborted, true);
});
// Public t.me/s/SpaceRad_io capture, 2026-10-18; see docs/telegram-forward-investigation.md.
test("Telegram captured 1279/1280 forwards retain status while 1281 remains an ordinary reply", async (t) => {
    const captured = readFileSync(new URL("fixtures/telegram-forward-capture.html", import.meta.url), "utf8");
    for (const options of [{}, { before: "1282" }, { after: "1278" }]) {
        t.mock.method(globalThis, "fetch", async () => new Response(captured));
        const { posts } = await fetchTelegramChannel("SpaceRad_io", options);
        assert.deepEqual(
            posts.map((post) => post.id),
            ["1281", "1280", "1279"],
        );
        const [reply, react, token] = posts;
        for (const post of [react, token]) {
            assert.equal(post.isForwarded, true, post.id);
            assert.equal(post.forwardedFrom, undefined);
            assert.equal(post.forwardedFromLink, undefined);
            assert.equal(post.replyInfo, undefined);
        }
        assert.match(react.text, /^大家好，我给大家表演一个咬赛博打火机/);
        assert.equal(react.linkPreview.title, "React 带来的生死疲劳 | 螺莉莉的数据中心");
        assert.equal(react.linkPreview.url, "https://roriri.one/2026/04/12/what-a-react");
        assert.match(token.text, /^新华社对 token 的理解/);
        assert.equal(token.linkPreview, undefined);
        assert.equal(reply.isForwarded, false);
        assert.equal(reply.linkPreview, undefined);
        assert.equal(reply.replyInfo.replyToLink, "https://t.me/SpaceRad_io/1280");
        assert.match(reply.replyInfo.replyToText, /咬赛博打火机/);
        assert.match(reply.text, /^虽然很累/);
        assert.doesNotMatch(reply.text, /咬赛博打火机/);
    }
});
