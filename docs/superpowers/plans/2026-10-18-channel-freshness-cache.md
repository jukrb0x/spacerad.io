# Channel freshness cache implementation plan

> Initial scope: implement and verify in an isolated worktree without commits/push/deploy. Later explicit user authorization permits signed commits and push of the combined work; see integration record below. No deployment, new resources, or image cache changes.

Goal: share successfully parsed Telegram data while giving Channel navigation a 60-second freshness budget and homepage/RSS/before pages 300 seconds.

Architecture: one versioned data cache wrapper using the existing Cloudflare Cache API, with bounded isolate-local fallback and pending-request coalescing. Expired requests wait for an abortable two-second refresh; on failure only, reuse success up to one hour old and back off retries for 30 seconds. Cache hits never renew success time. No client DOM replacement or new banner.

## Tasks

- [x] Cache core: dependency-free tests with fake clock/cache/load for cold/warm, per-consumer age, expiry, pagination keys, same-isolate concurrency, failures, one-hour cutoff, backoff, abort, cache failures and version isolation. Observe RED, implement, observe GREEN.
- [x] Telegram integration: keep raw parser independently testable; pass cache timeout signal into fetch. Validate existing observed channel title structure and message envelopes without requiring nonempty posts. Test legitimate empty pages and invalid HTML. Preserve scraper formatting/classification.
- [x] Consumers: shared homepage/RSS latest key (300s), Channel latest/after (60s), before (300s); no-cache successful responses, no-store/503 failures, no UI changes; images untouched.
- [x] Verification: targeted dependency-light tests, available parser/RSS/proxy regressions, syntax/types/format where tooling exists, self-review then independent code review. Report unavailable checks accurately.

Review focus: no per-visitor retry storm during outages; timeout covers body consumption and aborts; empty feed cannot become an error cache; Cache API writes never extend stale age; per-datacenter storage and isolate-only coalescing cannot imply a global lock.

## Execution record

- Base: 85f7b7a. No dependencies installed initially. User explicitly authorized execution and targeted checks, so no further plan approval or full-suite requirement.

- Cache core RED→GREEN verified with fake clock/store/load. Found and fixed consumer-budget mixing, late cache-read duplicate refreshes, and one-hour expiry during refresh.
- Independent GPT-6.1 Sol review found two P2 issues. Both reproduced RED and fixed GREEN: failure markers now use a separate key (cannot overwrite another isolate's successful snapshot); shared cache hits populate bounded local fallback. No deferred review findings.
- Read-only parser/RSS baseline and final regressions are blocked by missing cheerio/@astrojs/rss. One lightweight npm install attempt returned registry HTTP 403; not retried. No full build/check/lint or live cache-hit verification claimed.
- Route integration checks execute actual frontmatter and endpoint code with injected dependencies; they do not replace an Astro build or real RSS/parser regression. Node's TypeScript-strip API prints its experimental warning.
- Ruling: use existing observed title/message structures to validate upstream pages and permit no messages; do not invent an empty-channel marker. A title-bearing, structurally changed Telegram page could still resemble an empty channel; actual parser regression and upstream verification remain necessary before release.
- Ruling: raw Telegram HTML refreshes use no-store so an unmeasured upstream HTTP cache does not stack with data freshness. Images remain unchanged.
- No commits, push, deployment, new resources, or changes to the original worktree. The independent reviewer did not inspect the unrelated forward-classification task.

## Local continuation — 2026-10-18

- Original checkout was clean at the exact base `85f7b7a18ea90f3d247e147b923678e8a4163c78`. Read root `AGENTS.md`; no repository `.agents/` directory exists. Verified the patch at `[local path]`, passed `git apply --check` before applying in the managed worktree `[local path]`. Original checkout remains clean; no unrelated task was contacted or modified.
- Reused installed dependencies through ignored worktree-local links; no dependency download was needed. Initial pnpm script invocations attempted automatic dependency verification and could not install into the directory symlink; their scripts still ran successfully. Subsequent checks invoke installed binaries directly to avoid automatic installation.
- The actual RSS regression exposed an outdated assertion expecting HTTP 200 on upstream failure. Updated it to the approved HTTP 503/no-store contract and asserted no-cache for successful XML.
- Added a regression for a fallback crossing the one-hour cutoff while awaiting failure-marker storage. Observed failure before changing production code, then passed after rechecking age immediately before serving fallback. Added a streaming-body regression proving the parser propagates abort while consuming the response.
- Final verification: targeted cache/route/guard checks 22 passed; full configured unit suite 162 passed, zero failures/skips (including actual Telegram/RSS/image-proxy/description checks and sharp raster-format coverage). Installed `astro build` passed; `astro check` passed with zero errors/warnings and two existing `document.execCommand` deprecation hints. Whole-repository `biome check .` passed (171 files), as did `git diff --check`. Tests using Node's TypeScript-strip API emit its experimental notice.
- Independent GPT-6.1 Sol review of all uncommitted cache changes reported no actionable findings and passed 37 focused cache/parser/route/RSS tests. No reviewer edits or unrelated-task inspection.
- Remaining release checks: production Cloudflare Cache API HIT behavior and live Telegram markup are not verified. The title/message validator remains the approved structural heuristic; legitimate empty fixture results are covered. No deployment is authorized.

## Combined integration and signing requirements

- The user subsequently authorized continuing both local tasks through signed commit and push. All commits must use SSH signing; verify each generated commit with `git verify-commit`. Never bypass signing on failure. PR creation and deployment remain unauthorized.
- Integration branch: `codex/telegram-freshness-and-forward-status`, based on the exact original base. Remote verified as `https://github.com/jukrb0x/spacerad.io`; remote default `main` initially had zero divergence. Original checkout and the independent forward worktree are preserved.
- Read the completed forward investigation and inspected its diff before applying. Production hunks passed `git apply --check`; the overlapping append to `tests/telegram.test.mjs` was merged by preserving both sets of tests. Added the investigation document and captured fixture from that worktree.
- Preserved `isForwarded` separately from source-name/link metadata. Real captured posts 1280/1279 remain forwards with empty source names; ordinary reply 1281 stays original. The fixture now includes the real title node from the same captured upstream response so page validation remains strict.
- Whole-repository Biome found one malformed quote attribute on the captured reply link. Removed that unrelated invalid attribute in the test fixture only; the original responses/DOM remain in the unmodified evidence archive. Actual component rendering still checks body/reply/preview and all five badge scenarios.
- Upgraded the cache schema to `v2`. The new old-snapshot regression failed against v1 and passed with v2, proving cached data lacking `isForwarded` cannot reach the new renderer. Cache timeout/AbortSignal, freshness budgets, sanitization and image proxy behavior remain intact. Updated architecture notes to describe the integrated data cache rather than the superseded rendered-HTML TTL.
- Final combined verification: all 169 configured unit tests passed (zero failures/skips); actual Astro compiler/container rendered five expected card scenarios; `astro build`, `astro check` (zero errors/warnings, two existing deprecation hints), all-repository Biome (172 files), and `git diff --check` passed. Independent GPT-6.1 Sol review found no actionable issues and passed 49 focused regressions.
- Browser visual testing and live Cloudflare Cache API HIT behavior were not exercised. Live Telegram evidence supports the forward fix, but the original screenshot's exact response/cache state remains unrecoverable. No deployment or cache purge is performed.
