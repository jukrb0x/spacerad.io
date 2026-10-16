import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const css = await readFile(new URL("../src/styles/editorial.css", import.meta.url), "utf8");
const tokens = await readFile(new URL("../src/styles/_tokens.scss", import.meta.url), "utf8");
const theme = await readFile(new URL("../src/components/ThemeToggle.astro", import.meta.url), "utf8");
const mobile = css.slice(css.indexOf("@media (max-width: 767px)"));

test("mobile navigation fills the viewport while the reading gutter stays 24px", () => {
    assert.match(tokens, /--layout-max-width: 860px/);
    assert.match(tokens, /@media \(max-width: 767px\)[\s\S]*--page-gutter: 24px/);
    assert.match(
        mobile,
        /\.site-header \.site-header__inner\s*\{[^}]*width: calc\(100% \+ 48px\);[^}]*margin-inline: -24px;[^}]*padding-inline: 24px;/,
    );
    assert.match(mobile, /\.site-header\[data-nav-floating\] \.site-header__inner\s*\{[^}]*width: 100%;[^}]*max-width: none;/);
    assert.match(mobile, /\.site-header__inner\s*\{[^}]*height: 60px;/);
    assert.match(mobile, /\.home-profile\s*\{[^}]*padding: 20px 0 0;/);
});

test("mobile share actions and both triggers use one 44px rail", () => {
    assert.match(css, /--article-control-size: 44px/);
    assert.match(css, /--article-control-inset: max\(24px, env\(safe-area-inset-right\)\)/);
    assert.match(
        css,
        /body\.article-page \[data-toc-mobile-toggle\],\s*body\.article-page \[data-share-mobile-toggle\],\s*body\.article-page \[data-share-menu\]\s*\{\s*right: var\(--article-control-inset\);\s*width: var\(--article-control-size\);/,
    );
    assert.match(
        css,
        /body\.article-page \[data-share-menu-item\]\s*\{\s*width: var\(--article-control-size\);\s*height: var\(--article-control-size\);/,
    );
});

test("dark control palette is neutral with explicit focus and a blue trigger rim", () => {
    assert.match(
        css,
        /html\[data-theme="dark"\] body\.article-page\s*\{\s*--article-control-surface: #242421;\s*--article-control-ink: #f0f0eb;\s*--article-control-border: #8b8b82;/,
    );
    assert.match(
        css,
        /html\[data-theme="dark"\] body\.article-page \[data-toc-mobile-toggle\]\s*\{\s*border: 1px solid var\(--article-control-border\);/,
    );
    assert.match(css, /\[data-share-menu-item\]:focus-visible\s*\{[^}]*outline: 2px solid var\(--article-control-ink\)/);
    assert.match(theme, /\.theme-toggle\[data-variant="header"\] \[data-theme-toggle\]\s*\{\s*color: var\(--color-on-structure\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
