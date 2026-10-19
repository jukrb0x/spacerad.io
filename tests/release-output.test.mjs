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
