import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { getGitModifiedTime, withGitModifiedTime } from "../scripts/git-modified-time.mjs";

const committed = "2020-01-02T12:00:00Z";
const explicit = new Date("2021-03-04T12:00:00Z");
function git(cwd, ...args) {
    return execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_AUTHOR_DATE: committed, GIT_COMMITTER_DATE: committed },
    }).trim();
}
function fixture(t, initialize = true) {
    const root = mkdtempSync(join(tmpdir(), "modified-time-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    if (initialize) {
        git(root, "init", "-q");
        git(root, "config", "user.name", "Fixture");
        git(root, "config", "user.email", "fixture@example.invalid");
        git(root, "remote", "add", "origin", "https://github.com/example/blog.git");
    }
    return root;
}
function commit(root, name = "post.md") {
    writeFileSync(join(root, name), "# Article\n");
    git(root, "add", "--", name);
    git(root, "-c", "commit.gpgsign=false", "commit", "-qm", "article");
}
function read(root, name = "post.md") {
    const previous = process.cwd();
    try {
        process.chdir(root);
        return getGitModifiedTime(join(root, name));
    } finally {
        process.chdir(previous);
    }
}

test("complete history preserves committed date and history link", (t) => {
    const root = fixture(t);
    commit(root);
    const result = read(root);
    assert.equal(result.lastModified, committed);
    assert.equal(result.lastModifiedCommitUrl, "https://github.com/example/blog/commits/main/post.md");
});

test("shallow boundary cannot fabricate an update", (t) => {
    const root = fixture(t);
    commit(root);
    const clone = join(fixture(t, false), "clone");
    git(root, "clone", "-q", "--depth=1", pathToFileURL(root).href, clone);
    const result = read(clone);
    assert.equal(result.lastModified, undefined);
    assert.equal(result.lastModifiedCommitUrl, undefined);
});

test("a real change after the shallow boundary remains trustworthy", (t) => {
    const root = fixture(t);
    commit(root);
    commit(root, "later.md");
    const clone = join(fixture(t, false), "clone");
    git(root, "clone", "-q", "--depth=2", pathToFileURL(root).href, clone);
    assert.equal(read(clone, "later.md").lastModified, committed);
    assert.equal(read(clone).lastModified, undefined);
});

test("no Git history never turns checkout mtime into an update", (t) => {
    const root = fixture(t, false);
    writeFileSync(join(root, "post.md"), "# Article\n");
    const result = read(root);
    assert.equal(result.lastModified, undefined);
    assert.equal(result.lastModifiedCommitUrl, undefined);
});

test("untracked file has no synthetic date while dirty tracked file keeps last committed date", (t) => {
    const root = fixture(t);
    commit(root);
    writeFileSync(join(root, "new.md"), "# New\n");
    assert.equal(read(root, "new.md").lastModified, undefined);
    writeFileSync(join(root, "post.md"), "# Uncommitted edit\n");
    assert.equal(read(root).lastModified, committed);
});

test("missing remote does not discard a trustworthy timestamp", (t) => {
    const root = fixture(t);
    commit(root);
    git(root, "remote", "remove", "origin");
    const result = read(root);
    assert.equal(result.lastModified, committed);
    assert.equal(result.lastModifiedCommitUrl, undefined);
});

test("invalid Git timestamp produces no derived date", (t) => {
    const root = fixture(t);
    commit(root);
    const tree = git(root, "rev-parse", "HEAD^{tree}");
    // A raw commit can contain a timestamp outside JavaScript's Date range.
    const identity = "Fixture <fixture@example.invalid> 99999999999999999 +0000";
    const hash = execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], {
        cwd: root,
        encoding: "utf8",
        input: `tree ${tree}\nauthor ${identity}\ncommitter ${identity}\n\ninvalid date\n`,
    }).trim();
    git(root, "update-ref", "HEAD", hash);
    const result = read(root);
    assert.equal(result.lastModified, undefined);
    assert.equal(result.lastModifiedCommitUrl, undefined);
});

test("quoted filenames are passed literally and nested working directories keep repository-relative URLs", (t) => {
    const root = fixture(t);
    mkdirSync(join(root, "posts"));
    commit(root, 'posts/a"b.md');
    const result = read(join(root, "posts"), 'a"b.md');
    assert.equal(result.lastModified, committed);
    assert.equal(result.lastModifiedCommitUrl, "https://github.com/example/blog/commits/main/posts/a%22b.md");
});

// Exercise the locked Astro store: its same-digest shortcut is the regression.
const require = createRequire(import.meta.url);
const { MutableDataStore } = await import(pathToFileURL(join(dirname(require.resolve("astro/package.json")), "dist/content/mutable-data-store.js")));

test("warm loader refreshes dates without replacing rendered content or explicit fallback", async (t) => {
    const root = fixture(t);
    commit(root);
    const clone = join(fixture(t, false), "clone");
    git(root, "clone", "-q", "--depth=1", pathToFileURL(root).href, clone);
    const store = new MutableDataStore().scopedStore("blog");
    store.set({
        id: "post",
        filePath: "post.md",
        digest: "unchanged",
        body: "body",
        rendered: { html: "<p>cached</p>", metadata: {} },
        data: { updatedDate: explicit, lastModified: "stale", lastModifiedCommitUrl: "stale" },
        assetImports: ["image.png"],
        deferredRender: true,
    });
    const before = store.get("post");
    const loader = withGitModifiedTime({ name: "cached", load() {} });
    const context = { store, config: { root: pathToFileURL(`${clone}/`) } };
    await loader.load(context);
    let result = store.get("post");
    assert.equal(result.data.lastModified, undefined);
    assert.equal(result.data.lastModifiedCommitUrl, undefined);
    assert.equal(result.data.updatedDate, explicit);
    for (const key of ["digest", "body", "rendered", "deferredRender"]) assert.equal(result[key], before[key]);
    assert.deepEqual(result.assetImports, before.assetImports);
    git(clone, "fetch", "-q", "--unshallow");
    await loader.load(context);
    result = store.get("post");
    assert.equal(result.data.lastModified, committed);
    git(clone, "remote", "remove", "origin");
    await loader.load(context);
    assert.equal(store.get("post").data.lastModified, committed);
    assert.equal(store.get("post").data.lastModifiedCommitUrl, undefined);
    const unchanged = store.get("post");
    await loader.load(context);
    assert.equal(store.get("post"), unchanged);
});

test("loader watcher writes derive dates from root-relative paths and reject authored dates", async (t) => {
    const root = fixture(t);
    commit(root);
    const store = new MutableDataStore().scopedStore("blog");
    let watcherStore;
    const loader = withGitModifiedTime({
        name: "watched",
        load(context) {
            watcherStore = context.store;
        },
    });
    await loader.load({ store, config: { root: pathToFileURL(`${root}/`) } });
    watcherStore.set({ id: "slug-is-not-file", filePath: "post.md", digest: "first", data: { updatedDate: explicit, lastModified: "authored" } });
    assert.equal(store.get("slug-is-not-file").data.lastModified, committed);
    watcherStore.set({ id: "slug-is-not-file", filePath: "post.md", digest: "changed", data: { title: "Changed", updatedDate: explicit } });
    assert.equal(store.get("slug-is-not-file").data.title, "Changed");
    assert.equal(store.get("slug-is-not-file").data.lastModified, committed);
    watcherStore.set({
        id: "no-file",
        digest: "other",
        data: { updatedDate: explicit, lastModified: "authored", lastModifiedCommitUrl: "authored" },
    });
    assert.deepEqual(store.get("no-file").data, { updatedDate: explicit });
});
