import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { remarkModifiedTime } from "../scripts/remark-modified-time.mjs";

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
function read(root, name = "post.md", initial = {}) {
    const previous = process.cwd();
    try {
        process.chdir(root);
        const file = { history: [join(root, name)], data: { astro: { frontmatter: { ...initial } } } };
        remarkModifiedTime()(null, file);
        return file.data.astro.frontmatter;
    } finally {
        process.chdir(previous);
    }
}

test("complete history preserves committed date and history link ahead of explicit updatedDate", (t) => {
    const root = fixture(t);
    commit(root);
    const result = read(root, "post.md", { updatedDate: explicit });
    assert.equal(result.lastModified, committed);
    assert.equal(result.updatedDate, explicit);
    assert.equal(result.lastModifiedCommitUrl, "https://github.com/example/blog/commits/main/post.md");
});

test("shallow boundary cannot fabricate an update; explicit fallback remains available", (t) => {
    const root = fixture(t);
    commit(root);
    const clone = join(fixture(t, false), "clone");
    git(root, "clone", "-q", "--depth=1", pathToFileURL(root).href, clone);
    const result = read(clone, "post.md", { updatedDate: explicit });
    assert.equal(result.lastModified, undefined);
    assert.equal(result.lastModifiedCommitUrl, undefined);
    assert.equal(result.updatedDate, explicit);
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

test("no Git history never turns checkout mtime or stale derived fields into an update", (t) => {
    const root = fixture(t, false);
    writeFileSync(join(root, "post.md"), "# Article\n");
    const result = read(root, "post.md", { lastModified: "invalid", lastModifiedCommitUrl: "stale" });
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

test("invalid Git timestamp cannot suppress an explicit updatedDate", (t) => {
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
    const result = read(root, "post.md", { updatedDate: explicit });
    assert.equal(result.lastModified, undefined);
    assert.equal(result.lastModifiedCommitUrl, undefined);
    assert.equal(result.updatedDate, explicit);
});

test("quoted filenames are passed literally and nested working directories keep repository-relative URLs", (t) => {
    const root = fixture(t);
    mkdirSync(join(root, "posts"));
    commit(root, 'posts/a"b.md');
    const result = read(join(root, "posts"), 'a"b.md');
    assert.equal(result.lastModified, committed);
    assert.equal(result.lastModifiedCommitUrl, "https://github.com/example/blog/commits/main/posts/a%22b.md");
});
