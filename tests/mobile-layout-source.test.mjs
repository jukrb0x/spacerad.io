import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const css = await readFile(new URL("../src/styles/editorial.css", import.meta.url), "utf8");
const tokens = await readFile(new URL("../src/styles/_tokens.scss", import.meta.url), "utf8");
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
