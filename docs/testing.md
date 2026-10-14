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

The default browser is Playwright's bundled headless Chromium. The checked-in GitHub Actions workflow installs locked dependencies and explicitly provisions that browser with `pnpm exec playwright install --with-deps chromium`, then runs all six checks above. The workflow does not deploy the site. Local checks use already installed tools; the test command itself never downloads a browser.

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

`pnpm test:release` inspects the fresh production route manifest, emitted page files and sitemap. Run it after `pnpm build`; it rejects any design-lab route. The development suite separately verifies `/design-lab` and both reading studies remain available locally. Their templates live under Astro’s excluded `src/pages/_design-lab/` directory and are injected only for the `dev` command.

## Canonical local review

Use `http://127.0.0.1:4322/` for the compiled Cloudflare-worker review and `http://127.0.0.1:4321/` for Astro development. Build before reviewing compiled output. The existing Wrangler config uses local assets and KV when launched with `pnpm exec wrangler dev --local --ip 127.0.0.1 --port 4322`; do not start a second worker on an occupied port or silently switch ports. The strict-port development entry is `node scripts/test-browser-server.mjs`. Inspect checkout/process ownership before restarting an existing listener.

`pnpm preview:verify` is a local-only CLI check, outside the production frontend. It reports the exact checkout/branch and build generation, checks served Home/Channel content on both URLs, and compares the compiled Home response with `dist/index.html`. A passing server check does not prove an already-open browser tab is current. If a tab differs, verify its exact origin, open the canonical URL in a fresh tab, and fully reload before attributing a cause to caching or HMR. No development version label is added to production branding.

Home's latest notes use a cached HTML fragment at `/api/latest-channel`, with a reserved fallback and abortable route-owned request. The internal page is noindex and excluded from the sitemap. Remark42's fixed configured host is read through `/api/remark42-script` because its script does not expose CORS; the browser loads text with an AbortController and executes it synchronously only while its article root remains connected. No vendor source or CSP is modified. Delayed-navigation browser fixtures cover both cancellation boundaries and never submit comments.
