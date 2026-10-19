import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const output = resolve("dist");
test("internal fragment APIs stay out of the public sitemap", async () => {
    for (const file of (await readdir(output)).filter((file) => /^sitemap.*\.xml$/.test(file))) {
        assert.doesNotMatch(await readFile(resolve(output, file), "utf8"), /<loc>[^<]*\/api\//);
    }
});

test("draft article stays absent from production pages and sitemap", async () => {
    const paths = await readdir(output, { recursive: true });
    assert.equal(
        paths.some((path) => path.includes("introducing-space-radio")),
        false,
    );
    for (const file of (await readdir(output)).filter((file) => /^sitemap.*\.xml$/.test(file))) {
        assert.doesNotMatch(await readFile(resolve(output, file), "utf8"), /\/posts\/introducing-space-radio(?:\/|<)/);
    }
});

test("production pages include both navigation feedback modes", async () => {
    const html = await readFile(resolve(output, "posts/index.html"), "utf8");
    assert.match(html, /class="motion-track"/);
    assert.match(html, /data-navigation-feedback/);
    assert.match(html, /data-navigation-status/);
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]).filter((path) => path.startsWith("/_astro/"));
    const code = (await Promise.all(scripts.map((path) => readFile(resolve(output, path.slice(1)), "utf8")))).join("\n");
    assert.match(code, /astro:before-preparation/);
    const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join("\n");
    assert.match(code + inline, /data-navigation-status/);
    assert.match(code + inline, /completing/);
});
