import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const DEFAULT_BRANCH = "main";

export function remarkModifiedTime({ branch = DEFAULT_BRANCH } = {}) {
    return (_tree, file) => {
        file.data.astro.frontmatter ??= {};
        const frontmatter = file.data.astro.frontmatter;
        // These are derived fields, never author-provided fallbacks. The layout
        // already prefers a trusted Git date, then the author's updatedDate.
        delete frontmatter.lastModified;
        delete frontmatter.lastModifiedCommitUrl;
        const filepath = file.history[0];
        if (!filepath) return;

        const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();

        let root;
        let relativePath;
        try {
            const absolutePath = realpathSync(resolve(filepath));
            root = git(dirname(absolutePath), "rev-parse", "--show-toplevel");
            relativePath = relative(root, absolutePath).split(sep).join("/");
            const [commit, timestamp, seconds] = git(root, "--literal-pathspecs", "log", "-1", "--format=%H%n%cI%n%ct", "--", relativePath).split(
                "\n",
            );
            if (!commit || !timestamp || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) return;
            if (!Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) !== Number(seconds) * 1000) return;

            if (git(root, "rev-parse", "--is-shallow-repository") === "true") {
                const shallowPath = resolve(root, git(root, "rev-parse", "--git-path", "shallow"));
                const boundaries = readFileSync(shallowPath, "utf-8").trim().split(/\s+/);
                // Git treats a shallow boundary like a root commit: every file
                // appears changed there, even when only the checkout is new.
                if (boundaries.includes(commit)) return;
            }
            frontmatter.lastModified = timestamp;
        } catch {
            // Missing/incomplete history is unknown, never filesystem mtime.
            return;
        }

        try {
            const remoteUrl = git(root, "config", "--get", "remote.origin.url");
            const githubUrl = remoteUrl.replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
            if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(githubUrl)) return;
            const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
            frontmatter.lastModifiedCommitUrl = `${githubUrl}/commits/${encodeURIComponent(branch)}/${encodedPath}`;
        } catch {
            // A missing remote only removes the optional link, not the date.
        }
    };
}
