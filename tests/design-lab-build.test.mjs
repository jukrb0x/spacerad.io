import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const output = resolve("dist");
test("production output has no design-lab routes or page modules", async () => {
    const worker = resolve(output, "_worker.js");
    const name = (await readdir(worker)).find((file) => /^manifest_.*\.mjs$/.test(file));
    assert.ok(name, "run pnpm build before the release check");
    const { manifest } = await import(pathToFileURL(resolve(worker, name)));
    const leaked = manifest.routes.filter(({ routeData }) => /^\/design-lab(?:\/|$)/.test(routeData.route));
    assert.equal(
        manifest.routes.some(({ routeData }) => routeData.route.startsWith("/__test/")),
        false,
    );
    assert.deepEqual(
        leaked.map(({ routeData }) => routeData.route),
        [],
    );
    const paths = await readdir(output, { recursive: true });
    assert.deepEqual(
        paths.filter((path) => /(?:^|\/)(?:_?design-lab|__test)(?:\/|\.|$)/.test(path.replaceAll("\\", "/"))),
        [],
    );
});
test("production sitemap has no design-lab URLs", async () => {
    const files = (await readdir(output)).filter((file) => /^sitemap.*\.xml$/.test(file));
    assert.ok(files.length > 0, "run pnpm build before the release check");
    for (const file of files) assert.doesNotMatch(await readFile(resolve(output, file), "utf8"), /\/design-lab(?:\/|<)/);
});

test("internal fragment APIs stay out of the public sitemap", async () => {
    for (const file of (await readdir(output)).filter((file) => /^sitemap.*\.xml$/.test(file))) {
        assert.doesNotMatch(await readFile(resolve(output, file), "utf8"), /<loc>[^<]*\/api\//);
    }
});

// The curated study may render this draft locally, but never in a release.
test("curated draft stays absent from production pages and sitemap", async () => {
    const paths = await readdir(output, { recursive: true });
    assert.equal(
        paths.some((path) => path.includes("introducing-space-radio")),
        false,
    );
    for (const file of (await readdir(output)).filter((file) => /^sitemap.*\.xml$/.test(file))) {
        assert.doesNotMatch(await readFile(resolve(output, file), "utf8"), /\/posts\/introducing-space-radio(?:\/|<)/);
    }
});
