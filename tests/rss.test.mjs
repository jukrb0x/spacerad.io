import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import rss from "@astrojs/rss";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import { fetchTelegramChannel } from "../src/utils/telegram.ts";

const fixture = readFileSync(new URL("fixtures/telegram.html", import.meta.url), "utf8");
async function channel(t, html = fixture) {
    t.mock.method(globalThis, "fetch", async () => new Response(html));
    return fetchTelegramChannel("SpaceRad_io");
}
// Only replace framework imports; execute the actual endpoint and RSS serializer.
function feed(path, dependencies = {}) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8")
        .replace(/^import .*;\n/gm, "")
        .replace("export const prerender", "const prerender")
        .replace("export async function GET", "async function GET");
    return new Function(
        "rss",
        "cheerio",
        "sanitizeHtml",
        "SITE_TITLE",
        "SITE_DESCRIPTION",
        "fetchTelegramChannel",
        "getPublishedPosts",
        `${source}\nreturn GET;`,
    )(rss, cheerio, sanitizeHtml, "Fixture", "Description", dependencies.channel, dependencies.posts);
}

test("Channel RSS emits source dates, useful CJK titles, absolute media and stable IDs", async (t) => {
    const result = await channel(t, fixture.replace("&quot; onerror=&quot;example()&quot; data-x=&quot;", "中".repeat(100)));
    const response = await feed("../src/pages/channel-rss.xml.js", { channel: async () => result })({ site: new URL("https://spacerad.io/") });
    const $ = cheerio.load(await response.text(), { xml: true });
    assert.equal($("item pubDate").text(), new Date(result.posts[0].datetime).toUTCString());
    assert.equal($("item title").text(), `🖼 ${"中".repeat(80)}...`);
    assert.equal($("item guid").text(), "https://t.me/SpaceRad_io/42");
    const content = cheerio.load($("content\\:encoded").text());
    assert.equal(
        content(".telegram-post-image").attr("src"),
        "https://spacerad.io/api/image-proxy?url=https%3A%2F%2Fcdn4.telegram-cdn.org%2Fexample.jpg",
    );
    assert.equal(content('a:contains("#fixture")').attr("href"), "https://t.me/s/SpaceRad_io?q=%23fixture");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("Channel RSS CJK fallback retains the first 80 characters", async () => {
    const response = await feed("../src/pages/channel-rss.xml.js", {
        channel: async () => ({ posts: [{ id: "1", datetime: "2026-10-01", text: "中".repeat(100), content: "中".repeat(100) }] }),
    })({ site: new URL("https://spacerad.io/") });
    const $ = cheerio.load(await response.text(), { xml: true });
    assert.equal($("item title").text(), `${"中".repeat(80)}...`);
});

test("Blog RSS serializes published as pubDate and preserves links", async () => {
    const response = await feed("../src/pages/rss.xml.js", {
        posts: async () => [{ id: "existing", data: { title: "Existing", published: new Date("2020-02-03T04:05:06Z") } }],
    })({ site: new URL("https://spacerad.io/") });
    const $ = cheerio.load(await response.text(), { xml: true });
    assert.equal($("item pubDate").text(), "Mon, 03 Feb 2020 04:05:06 GMT");
    assert.equal($("item link").text(), "https://spacerad.io/posts/existing/");
});

test("Channel RSS preserves useful English title boundaries", async () => {
    const response = await feed("../src/pages/channel-rss.xml.js", {
        channel: async () => ({ posts: [{ id: "1", datetime: "2026-10-01", text: "word ".repeat(30), content: "word ".repeat(30) }] }),
    })({ site: new URL("https://spacerad.io/") });
    const $ = cheerio.load(await response.text(), { xml: true });
    assert.equal($("item title").text(), `${"word ".repeat(16).trim()}...`);
});

test("Channel RSS keeps its existing empty successful XML response on upstream failure", async (t) => {
    t.mock.method(console, "error", () => {});
    const response = await feed("../src/pages/channel-rss.xml.js", {
        channel: async () => {
            throw new Error("offline fixture");
        },
    })({ site: new URL("https://spacerad.io/") });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
    const $ = cheerio.load(await response.text(), { xml: true });
    assert.equal($("item").length, 0);
    assert.equal($("channel title").text(), "Fixture - Chanel");
});
