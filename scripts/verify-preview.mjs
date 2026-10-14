import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const digest = (value) => createHash("sha256").update(value).digest("hex");
const built = await readFile(resolve(root, "dist/index.html"), "utf8");
const generation = (await stat(resolve(root, "dist/index.html"))).mtime.toISOString();
const results = [];
for (const port of [4321, 4322]) {
    const origin = `http://127.0.0.1:${port}`;
    const response = await fetch(origin, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    const html = await response.text();
    const channel = await fetch(`${origin}/channel`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const channelHtml = await channel.text();
    const current = response.ok && html.includes("data-latest-channel") && (html.match(/class="home-profile__word"/g) || []).length === 6;
    assert.ok(current, `${origin} does not serve the current Home structure`);
    assert.ok(channel.ok && channelHtml.includes("channel-sidebar__identity"), `${origin}/channel does not serve the current Channel identity`);
    if (port === 4322)
        assert.equal(digest(html), digest(built), "compiled preview differs from the current dist/index.html; rebuild/reload its owned worker");
    results.push({
        origin,
        status: response.status,
        currentHome: current,
        currentChannel: true,
        responseSHA256: digest(html),
        matchesBuild: port === 4322 ? digest(html) === digest(built) : null,
    });
}
console.log(
    JSON.stringify(
        {
            checkout: root,
            branch: execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim(),
            generation,
            canonicalReview: "http://127.0.0.1:4322/",
            development: "http://127.0.0.1:4321/",
            results,
        },
        null,
        2,
    ),
);
