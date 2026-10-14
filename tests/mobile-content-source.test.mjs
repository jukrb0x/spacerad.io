import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const css = await read("../src/styles/editorial.css");
const mobile = css.slice(css.indexOf("@media (max-width: 767px)"));
const desktop = css.slice(0, css.indexOf("@media (max-width: 767px)"));
const row = await read("../src/components/PostItem.astro");
const home = await read("../src/components/home/LatestPosts.astro");

test("mobile lead uses natural lines and Channel retains a left-aligned two-level sign", () => {
    assert.match(mobile, /\.lead-post h3\s*\{[^}]*text-wrap: wrap;/);
    assert.match(mobile, /\.home-channel__identity\s*\{[^}]*width: 80%;[^}]*max-width: 320px;[^}]*justify-self: start;/);
    assert.match(desktop, /\.home-channel__identity\s*\{[^}]*flex-direction: column;/);
    assert.match(mobile, /\.channel-index\s*\{[^}]*align-content: start;/);
    assert.match(mobile, /\.home-channel__content,\s*\.channel-fallback\s*\{\s*min-height: 0;/);
});

test("desktop archive columns, hover, language labels and counterpart text remain intact", () => {
    assert.match(desktop, /\.post-item\s*\{[^}]*grid-template-columns: 88px 60px minmax\(0, 1fr\);/);
    assert.match(desktop, /\.post-item:hover,\s*\.post-item:focus-visible\s*\{[^}]*background: var\(--color-bg-muted\);/);
    assert.match(desktop, /\.post-item__translation\s*\{[^}]*position: absolute;/);
    assert.match(desktop, /\.mobile-post-meta,\s*\.translation-label--mobile\s*\{\s*display: none;/);
    assert.match(
        row,
        /<a href=\{`\/posts\/\$\{post.id\}`\} class="post-item"[\s\S]*<time[\s\S]*<span class="language-label">[\s\S]*<span class="post-item__title">/,
    );
    assert.match(row, /class="post-item__translation"[^>]*>\{translation.data.lang === "en" \? "English" : "中文"\} ↗<\/a>/);
    assert.match(home, /class="translation-label--desktop">English ↗/);
});

test("mobile metadata groups quiet counterpart links alongside the current red label", () => {
    assert.match(
        row,
        /<div class="mobile-post-meta post-meta">[\s\S]*class="mobile-post-languages"[\s\S]*class="language-label"[\s\S]*class="mobile-translation"/,
    );
    assert.match(mobile, /\.post-meta \.mobile-translation\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;[^}]*text-decoration: none;/);
    assert.match(mobile, /\.post-item > time,\s*\.post-item > \.language-label,\s*\.post-item__translation\s*\{\s*display: none;/);
    assert.match(row, /aria-label=/);
    assert.match(row, /hreflang=\{translation.data.lang\}/);
    assert.doesNotMatch(home, /Read in English|阅读中文版/);
});
