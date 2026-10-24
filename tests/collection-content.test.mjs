import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve("astro/package.json"));
const { z } = astroRequire("zod");
const yaml = astroRequire("js-yaml");
const ts = astroRequire("typescript");
const source = readFileSync(new URL("../src/utils/collectionSchema.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const schemaExports = {};
new Function("require", "exports", compiled)((id) => {
    assert.equal(id, "astro:content");
    return { z };
}, schemaExports);
const schema = schemaExports.collectionItemSchema(() => z.string());
const folder = new URL("../src/content/collections/items/beer/", import.meta.url);
const entries = readdirSync(folder)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
        const url = new URL(file, folder);
        const raw = readFileSync(url, "utf8");
        const [, frontmatter, body] = raw.split(/^---\s*$/m);
        return { url, data: yaml.load(frontmatter), body: body.trim() };
    });
test("collection entries have bilingual public data, valid available artwork and no invented notes", () => {
    assert.equal(entries.length, 16);
    for (const { url, data, body } of entries) {
        const parsed = schema.parse(data);
        assert.equal(parsed.collection, "beer");
        if (parsed.image) assert(existsSync(new URL(parsed.image, url)));
        assert.equal(body, "");
        assert(parsed.sources.every((source) => source.url.startsWith("https://")));
    }
    assert.equal(new Set(entries.map((entry) => entry.data.order)).size, entries.length);
});
test("collection frontmatter rejects accidental private-log imports and missing language content", () => {
    for (const field of ["location", "drinkingDate", "travelRoute"]) {
        assert.equal(schema.safeParse({ ...entries[0].data, [field]: "private fixture" }).success, false);
    }
    assert.equal(schema.safeParse({ ...entries[0].data, summary: { zh: "only one language" } }).success, false);
});
test("page configuration is independently editable and schema-validated", () => {
    const raw = readFileSync(new URL("../src/content/collections/pages/beer.yaml", import.meta.url), "utf8");
    const page = schemaExports.collectionPageSchema.parse(yaml.load(raw));
    assert.equal(page.subtitle.zh, "我喝过的啤酒，以及其他几杯。");
});

test("unverified artwork and strengths are explicit rather than invented", () => {
    const sangria = entries.find(({ data }) => data.title === "Sangria de cava").data;
    assert.equal(sangria.image, undefined);
    assert.equal(sangria.facts[1].value.en, "Not confirmed");
    assert.deepEqual(sangria.sources, []);
});
