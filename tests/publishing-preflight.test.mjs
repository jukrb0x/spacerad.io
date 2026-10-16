import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { checkPublishing } from "../scripts/check-publishing.mjs";

async function fixture(name) {
    const input = JSON.parse(await readFile(new URL(`./fixtures/publishing/${name}.json`, import.meta.url), "utf8"));
    input.pages = new Map(Object.entries(input.pages));
    input.files = new Set(input.files);
    for (const { routeData } of input.routes) routeData.pattern = new RegExp(routeData.pattern);
    return input;
}

test("rendered routes, anchors, redirects, assets, queries and hidden posts pass without crawling external URLs", async () => {
    assert.deepEqual(checkPublishing(await fixture("valid")), []);
});

test("missing routes and anchors are errors; dynamic anchors and case-only tags are warnings", async () => {
    const diagnostics = checkPublishing(await fixture("invalid"));
    assert.deepEqual(
        diagnostics.map(({ severity, code }) => [severity, code]),
        [
            ["error", "missing-route"],
            ["error", "missing-anchor"],
            ["error", "missing-route"],
            ["error", "redirect-loop"],
            ["warning", "dynamic-anchor"],
            ["error", "translation-language"],
            ["error", "translation-duplicate"],
            ["error", "translation-missing"],
            ["warning", "tag-case"],
        ],
    );
    assert.match(diagnostics[0].message, /\/posts\/original\/.*\/posts\/draft/);
    assert.match(diagnostics[1].message, /missing/);
    assert.match(diagnostics.at(-1).message, /web.*original.*Web.*translated/);
});

test("translation pairs with neither side published are excluded from the production check", async () => {
    const input = await fixture("valid");
    input.pairs = [["draft-zh", "draft-en"]];
    assert.deepEqual(checkPublishing(input), []);
});

test("translation language must be present and use opposite supported languages", async () => {
    const input = await fixture("valid");
    input.pages.set("/posts/translated/", "<html><article></article></html>");
    assert.ok(checkPublishing(input).some(({ code }) => code === "translation-language"));
});

test("CLI fails for defects, report-only preserves diagnostics, and missing build remains fatal", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "publishing-preflight-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const script = resolve("scripts/check-publishing.mjs");
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", timeout: 2000 });
    assert.equal(run("--report-only").status, 1);
    await mkdir(join(root, "dist/_worker.js"), { recursive: true });
    await writeFile(join(root, "dist/_worker.js/manifest_fixture.mjs"), "export const manifest = {routes: [], site: 'https://spacerad.io'};");
    await mkdir(join(root, "dist/posts/fixture"), { recursive: true });
    await writeFile(join(root, "dist/posts/fixture/index.html"), "<html lang='en'><article><a href='/missing'>bad</a></article></html>");
    await mkdir(join(root, "dist/missing")); // A directory alone is not a served asset.
    const strict = run();
    assert.equal(strict.status, 1, strict.stderr);
    assert.match(strict.stdout, /ERROR.*missing-route.*\/missing/);
    const report = run("--report-only");
    assert.equal(report.status, 0, report.stderr);
    assert.match(report.stdout, /1 error\(s\), 0 warning\(s\)/);
    await writeFile(join(root, "dist/posts/fixture/index.html"), "<article><a href='/runtime#missing'>runtime anchor</a></article>");
    await writeFile(
        join(root, "dist/_worker.js/manifest_fixture.mjs"),
        String.raw`export const manifest = {routes: [{routeData: {prerender: false, pattern: /^\/runtime$/}}]};`,
    );
    const warning = run();
    assert.equal(warning.status, 0, warning.stderr);
    assert.match(warning.stdout, /WARNING.*dynamic-anchor/);
    assert.match(warning.stdout, /0 error\(s\), 1 warning\(s\)/);
    assert.equal(run("--typo").status, 1);
});

test("expanding redirect cycles stop with an actionable error instead of hanging", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "publishing-cycle-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(join(root, "dist/_worker.js"), { recursive: true });
    await mkdir(join(root, "dist/posts/example"), { recursive: true });
    await writeFile(join(root, "dist/_worker.js/manifest_fixture.mjs"), "export const manifest = {routes: []};");
    await writeFile(join(root, "dist/_redirects"), "/grow/* /grow/:splat/x 301");
    await writeFile(join(root, "dist/posts/example/index.html"), "<article><a href='/grow/start'>cycle</a></article>");
    const result = spawnSync(process.execPath, [resolve("scripts/check-publishing.mjs")], { cwd: root, encoding: "utf8", timeout: 2000 });
    assert.equal(result.status, 1, `checker must terminate: ${result.error || result.stderr}`);
    assert.match(result.stdout, /redirect-loop/);
});

test("a malformed pathname is diagnosed without dropping later link diagnostics", async () => {
    const input = await fixture("valid");
    input.pages.set("/posts/hidden/", "<article><a href='/bad%ZZ'>bad escape</a><a href='/absent'>missing</a></article>");
    assert.deepEqual(
        checkPublishing(input).map(({ code }) => code),
        ["missing-route", "missing-route"],
    );
});

test("unsupported redirect rules fail explicitly instead of validating ignored configuration", async () => {
    for (const rule of [
        "/legacy /target 999",
        "/legacy /target typo",
        "/legacy /target 301 unexpected",
        "/legacy /target 200",
        "/legacy/:name /target/:name 301",
    ]) {
        const input = await fixture("valid");
        input.redirects = rule;
        assert.throws(() => checkPublishing(input), /Unsupported _redirects rule/);
    }
});
