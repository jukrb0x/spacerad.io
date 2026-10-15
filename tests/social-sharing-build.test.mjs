import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { load } from "cheerio";
import sharp from "sharp";

async function head(path) {
    const $ = load(await readFile(`dist/${path}index.html`, "utf8"));
    return (key) => $(`meta[property="${key}"], meta[name="${key}"]`).attr("content");
}

test("home advertises the default large sharing card with its image metadata", async () => {
    const meta = await head("");
    for (const prefix of ["og", "twitter"]) {
        assert.equal(meta(`${prefix}:title`), "Space Radio — On my wavelength @Jabriel");
        assert.equal(meta(`${prefix}:description`), "Notes, experiments, and observations from a life in progress.");
        assert.equal(meta(`${prefix}:image`), "https://spacerad.io/og-image.png");
        assert.ok(meta(`${prefix}:image:alt`));
    }
    assert.equal(meta("twitter:card"), "summary_large_image");
    assert.equal(meta("og:image:width"), "1200");
    assert.equal(meta("og:image:height"), "630");
    assert.equal(meta("og:image:type"), "image/png");
    const image = await sharp("dist/og-image.png").metadata();
    assert.deepEqual([image.width, image.height, image.format], [1200, 630, "png"]);
});

test("articles retain their own cover or article fallback without default-card dimensions", async () => {
    const custom = await head("posts/introducing-space-radio/");
    const fallback = await head("posts/just-bought-a-new-domain-name-xcode-zip/");
    assert.match(custom("og:image"), /^https:\/\/spacerad\.io\/_astro\/image\./);
    assert.equal(fallback("og:image"), "https://spacerad.io/placeholder.png");
    for (const meta of [custom, fallback]) {
        assert.equal(meta("twitter:image"), meta("og:image"));
        assert.equal(meta("og:image:width"), undefined);
        assert.equal(meta("og:image:height"), undefined);
    }
});
