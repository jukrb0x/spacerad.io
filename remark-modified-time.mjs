import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { normalize } from "node:path";

const DEFAULT_BRANCH = "main";

export function remarkModifiedTime({ branch = DEFAULT_BRANCH } = {}) {
    return (_tree, file) => {
        const filepath = file.history[0];
        if (!filepath) return;

        // Ensure frontmatter exists
        file.data.astro.frontmatter ??= {};

        try {
            // Get the last modified time from git
            const timestamp = execSync(`git log -1 --pretty="format:%cI" "${filepath}"`, {
                encoding: "utf-8",
            });
            file.data.astro.frontmatter.lastModified = timestamp.trim();

            // Get the GitHub repository URL
            const remoteUrl = execSync("git config --get remote.origin.url", {
                encoding: "utf-8",
            }).trim();

            // Convert Git URL to GitHub web URL
            // Supports both https://github.com/user/repo.git and git@github.com:user/repo.git formats
            const githubUrl = remoteUrl
                .replace(/\.git$/, "")
                .replace(/^git@github\.com:/, "https://github.com/");

            // Generate commit history URL for the file
            // Uses /commits/{branch}/{filepath} format to show all commit history for this file
            const relativeFilepath = normalize(filepath).replace(normalize(process.cwd()), "").replace(/^[/\\]/, "");
            file.data.astro.frontmatter.lastModifiedCommitUrl = `${githubUrl}/commits/${branch}/${relativeFilepath}`;
        } catch {
            // Fallback to filesystem modification time if git commands fail
            // (e.g., file not committed or outside git repo)
            try {
                const stats = statSync(filepath);
                file.data.astro.frontmatter.lastModified = stats.mtime.toISOString();
                // Filesystem time has no commit URL
                file.data.astro.frontmatter.lastModifiedCommitUrl = null;
            } catch (fsError) {
                console.warn(`Failed to get modification time for ${filepath}:`, fsError);
            }
        }
    };
}
