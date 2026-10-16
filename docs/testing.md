# Project checks

Use Node **26.11.0** (`.node-version`) and pnpm **12.10.1** (`packageManager` in `package.json`). These match the existing local tools and satisfy the installed Astro and Playwright runtime requirements. `pmOnFail: ignore` in `pnpm-workspace.yaml` prevents pnpm from auto-provisioning a package manager during ordinary local commands; the CI setup supplies the pinned version explicitly. Existing dependency/build permissions are unchanged.

```sh
pnpm check
pnpm lint
pnpm test:unit
pnpm build
pnpm test:release
pnpm test:browser
```

`pnpm test` runs the unit suite. It includes the SPA, translation, theme, likes, search and runner regressions, and requires no browser installation. Its runner tests use temporary fixture servers and do not start Astro or contact production services.

`pnpm test:browser` discovers `tests/home03*.test.mjs` and runs them sequentially with Node's test runner. By default it starts a local Astro dev server on `http://127.0.0.1:4321`, waits for `/posts` to return success, and stops its server process group after success, failure or interruption. Readiness has a 45-second deadline; each browser test has a 60-second deadline. An occupied default port is an error, so the runner cannot silently reuse another server. Run builds before browser checks to avoid changes to a watched server during assertions.

The default browser is Playwright's bundled headless Chromium. GitHub Actions runs type, lint, unit, build and release checks in `checks`, independently of the `browser` job. The browser job uses `mcr.microsoft.com/playwright:v1.58.1-noble`, verifies its version and Chromium launch, builds, then runs the entire browser suite. Keep the image tag and preflight version aligned with `pnpm-lock.yaml`. Browser failures fail the workflow. The workflow does not deploy the site; the test command itself never downloads a browser.

For a fresh Mac browser installation, use Node 24 for provisioning, then the project Node 26.11.0 for checks. Playwright 1.58.1's ZIP extractor stalls on the Chromium archive under Node 26.11.0; the same archive extracts under Node 24. The preinstalled CI image avoids this installation path. With `NODE24` pointing to a Node 24 executable:

```sh
pnpm install --frozen-lockfile
"$NODE24" node_modules/playwright/cli.js install chromium
pnpm build
pnpm test:browser
```

On a normal Ubuntu runner, the equivalent provisioning command is `"$NODE24" node_modules/playwright/cli.js install --with-deps chromium`. See the official [CI](https://playwright.dev/docs/ci) and [Docker](https://playwright.dev/docs/docker) guidance for hosted installation and matching image versions.

To use the existing local Chrome without installing Chromium:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm test:browser
```

To reuse a server that you intentionally started:

```sh
BASE_URL=http://127.0.0.1:4321 PLAYWRIGHT_CHANNEL=chrome pnpm test:browser
```

`BASE_URL` opts out of server ownership; the runner checks readiness and leaves that server running. `PLAYWRIGHT_EXECUTABLE_PATH` can select an existing browser executable instead of a channel. Set either browser override as needed. `BROWSER_SERVER_TIMEOUT` overrides the readiness deadline in milliseconds. A single suite can be selected with `pnpm test:browser tests/home03.test.mjs`.

Browser assertions do not submit likes or comments. The app suite blocks non-read browser requests and service workers; the accessibility suite serves a local fixture containing the actual preview modules and stylesheet. These checks cover local UI behavior, not production KV writes, comment-service bootstrap, hosting headers or assistive-technology certification.

The navigation focus and scroll suites share `PLAYWRIGHT_BROWSER=chromium|webkit`;
the older `PLAYWRIGHT_ENGINE` alias is accepted, and conflicting values fail.
They print the launched engine and version. Touch-pan regressions use trusted
Chromium CDP input with a mobile touch context and explicitly skip on WebKit,
which has no Playwright touch-pan API. Cross-engine focus/scroll checks are
separate. Neither desktop WebKit nor Chromium mobile emulation verifies real
iOS Safari behavior.
The cross-engine suite also checks keyboard Escape followed by wheel reading in a narrow desktop context,
including focus protection before wheel input and stable document geometry.

`pnpm test:release` inspects the fresh production route manifest, emitted page files and sitemap. Run it after `pnpm build`; it rejects any design-lab route. The development suite separately verifies `/design-lab` and both reading studies remain available locally. Their templates live under Astro’s excluded `src/pages/_design-lab/` directory and are injected only for the `dev` command.

## Imported content and image boundaries

The unit suite includes `telegram.test.mjs`, `rss.test.mjs`, and `image-proxy.test.mjs`. They use mocked upstream responses, the real Telegram parser/RSS serializer, and generated raster fixtures. Negative cases never contact live hosts. They cover escaped captions/descriptions, supported passive formatting, normalized Telegram links, emitted publication dates, CJK titles, absolute feed media, redirects, MIME/signature checks, cancellation, and cache/error behavior.

The image proxy retains its existing host allowlist. Successful responses require JPEG, PNG, GIF, WebP, or AVIF with a matching signature; redirects are validated at every hop (at most three), the complete fetch has a ten-second deadline, and decoded response bytes are bounded at 10 MiB. Successful cache/CORS behavior remains unchanged; rejected/error responses are not cached. The Telegram sanitizer policy excludes active/raw-text/foreign content and preserves supported text formatting and media. Dependency upgrades remain a separate maintenance task.

## Canonical local review

Use `http://127.0.0.1:4322/` for the compiled Cloudflare-worker review and `http://127.0.0.1:4321/` for Astro development. Build before reviewing compiled output. The existing Wrangler config uses local assets and KV when launched with `pnpm exec wrangler dev --local --ip 127.0.0.1 --port 4322`; do not start a second worker on an occupied port or silently switch ports. The strict-port development entry is `node scripts/test-browser-server.mjs`. Inspect checkout/process ownership before restarting an existing listener.

`pnpm preview:verify` is a local-only CLI check, outside the production frontend. It reports the exact checkout/branch and build generation, checks served Home/Channel content on both URLs, and compares the compiled Home response with `dist/index.html`. A passing server check does not prove an already-open browser tab is current. If a tab differs, verify its exact origin, open the canonical URL in a fresh tab, and fully reload before attributing a cause to caching or HMR. No development version label is added to production branding.

Home's latest notes use a cached HTML fragment at `/api/latest-channel`, with a reserved fallback and abortable route-owned request. The internal page is noindex and excluded from the sitemap. Remark42's fixed configured host is read through `/api/remark42-script` because its script does not expose CORS; the browser loads text with an AbortController and executes it synchronously only while its article root remains connected. No vendor source or CSP is modified. Delayed-navigation browser fixtures cover both cancellation boundaries and never submit comments.
