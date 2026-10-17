import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export function getGitModifiedTime(filepath, { branch = "main" } = {}) {
    const dates = {};
    if (!filepath) return dates;
    const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();

    let root;
    let relativePath;
    try {
        const absolutePath = realpathSync(resolve(filepath));
        root = git(dirname(absolutePath), "rev-parse", "--show-toplevel");
        relativePath = relative(root, absolutePath).split(sep).join("/");
        const [commit, timestamp, seconds] = git(root, "--literal-pathspecs", "log", "-1", "--format=%H%n%cI%n%ct", "--", relativePath).split("\n");
        if (!commit || !timestamp || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) return dates;
        if (!Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) !== Number(seconds) * 1000) return dates;

        if (git(root, "rev-parse", "--is-shallow-repository") === "true") {
            const shallowPath = resolve(root, git(root, "rev-parse", "--git-path", "shallow"));
            const boundaries = readFileSync(shallowPath, "utf-8").trim().split(/\s+/);
            // Git treats a shallow boundary like a root commit: every file
            // appears changed there, even when only the checkout is new.
            if (boundaries.includes(commit)) return dates;
        }
        dates.lastModified = timestamp;
    } catch {
        // Missing/incomplete history is unknown, never filesystem mtime.
        return dates;
    }

    try {
        const remoteUrl = git(root, "config", "--get", "remote.origin.url");
        const githubUrl = remoteUrl.replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
        if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(githubUrl)) return dates;
        const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
        dates.lastModifiedCommitUrl = `${githubUrl}/commits/${encodeURIComponent(branch)}/${encodedPath}`;
    } catch {
        // A missing remote only removes the optional link, not the date.
    }
    return dates;
}

// Git history is build metadata, not part of a Markdown content digest.
// Refresh it even when glob can reuse a previously rendered body.
export function withGitModifiedTime(loader) {
    return {
        ...loader,
        name: `${loader.name}-git-modified-time`,
        async load(context) {
            const refreshed = new Set();
            const set = (entry) => {
                const data = { ...entry.data };
                delete data.lastModified;
                delete data.lastModifiedCommitUrl;
                const filepath = entry.filePath ? resolve(fileURLToPath(context.config.root), entry.filePath) : undefined;
                Object.assign(data, getGitModifiedTime(filepath));
                const existing = context.store.get(entry.id);
                if (existing && existing.digest === entry.digest) {
                    if (existing.data.lastModified === data.lastModified && existing.data.lastModifiedCommitUrl === data.lastModifiedCommitUrl) {
                        refreshed.add(entry.id);
                        return false;
                    }
                    // Astro ignores same-digest sets. Preserve the body digest and
                    // complete rendered/deferred entry while replacing only dates.
                    context.store.delete(entry.id);
                }
                refreshed.add(entry.id);
                return context.store.set({ ...entry, data });
            };
            // The same facade is retained by glob's add/change watchers.
            await loader.load({ ...context, store: { ...context.store, set } });
            // Snapshot before replacement: deleting/reinserting while iterating
            // a live Map iterator would visit the replaced entry again.
            for (const entry of [...context.store.values()]) {
                if (!refreshed.has(entry.id)) set(entry);
            }
        },
    };
}
