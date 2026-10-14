import assert from "node:assert/strict";
import { test } from "node:test";
import { baseURL } from "./helpers/browser.mjs";

test("local development retains the index and both original design-lab reading studies", async () => {
    for (const path of ["/design-lab", "/design-lab/read/introducing-space-radio", "/design-lab/read/ue5-landscape-grass-en"]) {
        const response = await fetch(new URL(path, baseURL), { signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 200, path);
        const html = await response.text();
        assert.match(html, /class="lab-page"/, path);
        assert.match(html, /name="robots" content="noindex,nofollow"/, path);
        assert.match(html, /data-pagefind-ignore="all"/, path);
    }
});
