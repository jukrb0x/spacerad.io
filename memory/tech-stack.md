# Tech Stack & Infrastructure

> Part of the spacerad.io memory docs. Index: [../AGENTS.md](../AGENTS.md)

---

## Dependencies

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| `astro` | ^5.16.11 | Static site generator |
| `@astrojs/cloudflare` | ^12.6.12 | Cloudflare Pages adapter |
| `@astrojs/mdx` | ^4.3.13 | MDX support |
| `@astrojs/rss` | ^4.0.15 | RSS feed generation |
| `@astrojs/sitemap` | ^3.7.0 | Sitemap generation |
| `@astrojs/vue` | ^5.1.4 | Vue 3 component support |
| `vue` | ^3.5.27 | Vue 3 runtime |

### Styling
| Package | Version | Purpose |
|---------|---------|---------|
| `unocss` | ^66.6.0 | Atomic CSS framework |
| `@unocss/preset-wind3` | ^66.6.0 | Tailwind v3 compat preset |
| `@unocss/reset` | ^66.6.0 | CSS reset |
| `sass` | ^1.97.2 | SCSS processing (devDep) |

### State Management
| Package | Version | Purpose |
|---------|---------|---------|
| `nanostores` | ^1.1.0 | Reactive state store for theme (persists across SPA navigation) |

### Content & Markdown
| Package | Version | Purpose |
|---------|---------|---------|
| `rehype-pretty-code` | ^0.14.1 | Syntax highlighting (Shiki) |
| `rehype-katex` | ^7.0.1 | KaTeX math rendering |
| `rehype-mermaid` | ^3.0.0 | Mermaid diagrams |
| `rehype-slug` | ^6.0.0 | Auto heading IDs |
| `rehype-autolink-headings` | ^7.1.0 | Heading anchor links |
| `rehype-external-links` | ^3.0.0 | External link attrs |
| `rehype-figure` | ^1.0.1 | Figure/caption support |
| `remark-math` | ^6.0.0 | Math expression parsing |
| `remark-github-blockquote-alert` | ^1.3.1 | GitHub-style alerts |
| `markdown-it` | ^14.1.0 | Markdown parser |
| `cheerio` | ^1.1.2 | HTML parsing |

### Math & Diagrams
| Package | Version | Purpose |
|---------|---------|---------|
| `katex` | ^0.16.27 | LaTeX math rendering |
| `mermaid` | ^11.12.2 | Diagram rendering |

### Icons & UI
| Package | Version | Purpose |
|---------|---------|---------|
| `astro-icon` | ^1.1.5 | Icon component |
| `@iconify-json/ri` | ^1.2.7 | Remix Icon set (1700+) |

### Search & Utilities
| Package | Version | Purpose |
|---------|---------|---------|
| `astro-pagefind` | ^1.8.5 | Full-text search |
| `sanitize-html` | ^2.17.0 | HTML sanitization |
| `sharp` | ^0.34.3 | Image optimization |

### Dev Tools
| Package | Version | Purpose |
|---------|---------|---------|
| `@biomejs/biome` | 2.3.11 | Linter & formatter |
| `playwright` | ^1.57.0 | Browser testing |
| `wrangler` | ^4.60.0 | Cloudflare Workers CLI |
| `unist-util-visit` | ^5.1.0 | AST traversal |

---

## Astro Configuration (`astro.config.mjs`)

- **Site:** `https://spacerad.io`
- **Adapter:** Cloudflare Pages with image compilation service
- **Syntax highlighting:** Disabled built-in Shiki; using rehype-pretty-code with dual themes (github-light / github-dark)

### Integrations
1. MDX
2. Sitemap
3. UnoCSS (with automatic reset injection)
4. Astro Icon (Remix Icons `ri`, Simple Icons `folo`)
5. Pagefind (full-text search)
6. Vue 3

### SPA Navigation (Client Router)
- `<ClientRouter />` from `astro:transitions` imported in `BaseHead.astro`
- Intercepts internal link clicks, fetches new pages via fetch API, swaps DOM without full reload
- Fonts, CSS, and JS remain cached across navigations
- **Header:** `transition:animate="none"` — DOM swaps instantly (no animation), but listeners are lost
- **Footer:** No transition attribute (adding one breaks fixed-position FABs)
- **Main content:** `transition:animate="fade"` on all `<main>` elements

#### Astro Lifecycle Events (dispatched on `document`)
| Event | When | Use for |
|-------|------|---------|
| `astro:before-swap` | Before DOM swap | Close modals/drawers, cleanup |
| `astro:after-swap` | After DOM swap, before hydration | DOM manipulation on new content |
| `astro:page-load` | After swap + hydration complete | Re-initialize scripts, re-bind listeners |

#### Script Patterns for SPA
- **Module scripts** (`<script>`): Execute once. Register `astro:page-load` listener for re-init.
- **Inline scripts** (`<script is:inline>`): Add `data-astro-rerun` attribute to re-execute on navigation.
- **Persistent listeners** (scroll, resize): Use module-level guard (`let attached = false`) to bind only once.
- **Per-navigation listeners** (click on swapped elements): Re-bind in `astro:page-load` handler.
- **Document-level listeners**: Use `AbortController` pattern — abort on re-init, create new controller. See `NavDrawer.astro`.
- **Theme state**: Uses `nanostores` in `src/stores/theme.ts` — reactive state persists across navigation automatically, no manual cleanup needed.

### Remark Plugins
1. `remarkMath` — parse math expressions
2. `remarkAlert` — GitHub blockquote alerts (`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!CAUTION]`)
3. `remarkModifiedTime` — inject git modification timestamps into frontmatter

### Rehype Plugins (in order)
1. `rehypeMermaidPre` — preprocess Mermaid blocks
2. `rehypePrettyCode` — Shiki syntax highlighting with:
   - Dual themes: github-light / github-dark
   - Grid layout for line highlighting
   - onVisitLine / onVisitHighlightedLine / onVisitHighlightedChars callbacks
3. `rehypeKatex` — render KaTeX to HTML
4. `rehypeSlug` — auto-generate heading IDs
5. `rehypeExternalLinks` — add target="_blank" rel="noopener noreferrer"
6. `rehypeAutolinkHeadings` — prepend anchor links (`.anchor-link` class)
7. `rehypeFigure` — figure/caption support

---

## Custom Plugins

### remarkModifiedTime (`remark-modified-time.mjs`)
- Executes `git log` for last commit time per file
- Extracts GitHub repo URL from git config
- Generates commit history link for each file
- Fallback to filesystem mtime if git fails
- Outputs: `lastModified` (ISO string), `lastModifiedCommitUrl` (GitHub URL)
- Branch: configurable, defaults to "main"

### rehypeMermaidPre (`rehype-mermaid-pre.mjs`)
- Preprocesses Mermaid code blocks before rehype-pretty-code processes them

---

## Client-Side Scripts (`src/scripts/`)

All scripts are SPA-aware — they use `astro:page-load` or `astro:after-swap` for re-init after Client Router navigation.

| Script | Purpose | SPA Pattern |
|--------|---------|-------------|
| `theme.ts` | Theme toggle bindings — wrapper around `stores/theme` nanostores | Imports nanostores, exports `bindThemeToggles`, `onThemeChange` |
| `header-scroll.ts` | Header hide/show on scroll, reading progress bar | `let` refs re-queried on `astro:page-load`, persistent scroll listener with guard |
| `code-blocks.ts` | Copy button, language labels | Uses `autoInit()` helper for SPA-safe initialization |
| `blog-interactive.ts` | TOC navigation, responsive tables, iframe embeds, sidebar positioning | Uses `autoInit()` for persistent listeners, guard for scroll/resize |
| `mermaid-init.ts` | Mermaid diagram rendering | Caches module after first import, re-renders from `data-mermaid-src` |
| `post-preview.ts` | Hover preview card for post links | Uses image preloader utility, `astro:page-load` re-init |
| `viewport-height.ts` | iOS 100vh fix (`--vh` CSS variable) | Persistent resize listener |
| `cusdis.ts` | Cusdis comment system | Uses `embedSystem` abstraction and `autoInit()` helper |
| `remark42.ts` | Remark42 comment system | Uses `embedSystem` abstraction and `autoInit()` helper |
| `likes.ts` | Like button system with localStorage + API sync | Uses `autoInit()`, manages like state and animations |
| `shareMenu.ts` | Mobile share menu toggle and copy link | Uses `autoInit()`, handles menu animations and clipboard |

---

## Utility Functions (`src/utils/`)

Reusable utilities extracted from component code for better maintainability.

| File | Exports | Purpose |
|------|---------|---------|
| `posts.ts` | `getPublishedPosts()`, `getAllRenderablePosts()`, `groupPostsByYear()` | Post filtering and organization |
| `extractDescription.ts` | `extractDescription()` | Extract description from MDX content |
| `readingTime.ts` | `readingTime()` | Calculate reading time estimate |
| `telegram.ts` | `fetchTelegramChannel()` | Fetch Telegram channel posts |
| `scrollLock.ts` | `lockScrollForDialog()`, `unlockScrollForDialog()` | Prevent body scroll during modals |
| `viewportHeight.ts` | iOS `--vh` variable | Fix iOS viewport height issues |
| `timing.ts` | `debounce()`, `throttle()` | Rate-limiting function calls |
| `imagePreloader.ts` | `preloadImage()`, `getImageState()`, `clearImageCache()` | Image preloading with state tracking |
| `spaLifecycle.ts` | `autoInit()`, `createPersistentListener()`, `createNavigationListener()`, `once()` | Standardized SPA initialization patterns |
| `imageUrl.ts` | `getImageUrl()`, `getAbsoluteImageUrl()` | Extract URLs from ImageMetadata objects |
| `dialogUtils.ts` | `closeDialogWithAnimation()`, `openDialogWithAnimation()`, `toggleDialog()` | Dialog animation helpers |
| `navigationUtils.ts` | `isActiveLink()`, `getParentPath()` | Navigation and active link detection |

---

## Library Abstractions (`src/lib/`)

Higher-level abstractions for complex functionality.

| File | Exports | Purpose |
|------|---------|---------|
| `theme-effects.ts` | `initTheme()`, `getThemeState()`, `onThemeChange()`, `setThemePreference()`, `cycleTheme()` | Theme system with FOUC prevention and nanostores integration |
| `embedSystem.ts` | `EmbedSystem`, `createEmbedSystem()` | Generic abstraction for third-party embed widgets (comments, etc.) |

---

## Cloudflare Deployment

### Wrangler Config (`wrangler.toml`)
Check `wrangler.toml` in repo for actual config when necessary

### Environment Variables
Check `.env` files for actual values when necessary
```
PUBLIC_REMARK_URL="https://remark42.spacerad.io"
PUBLIC_REMARK_SITE_ID="space-radio"
```

### Runtime Types (`src/env.d.ts`)
```typescript
interface Env {
  LIKES: KVNamespace;
}
type Runtime = import("@astrojs/cloudflare").Runtime<Env>;
declare namespace App {
  interface Locals extends Runtime {}
}
```

---

## TypeScript Config (`tsconfig.json`)
Check `tsconfig.json` in repo when necessary

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "strictNullChecks": true,
    "jsx": "preserve"
  }
}
```

---

## Markdown Features Summary

| Feature | Stack |
|---------|-------|
| Syntax highlighting | rehype-pretty-code + Shiki (dual theme) |
| Math | remark-math + rehype-katex |
| Diagrams | Mermaid via rehype-mermaid |
| Alerts | remark-github-blockquote-alert |
| Heading links | rehype-slug + rehype-autolink-headings |
| External links | rehype-external-links (auto target/rel) |
| Figures | rehype-figure |
| Code features | Line highlighting, char highlighting (v/s/i), line numbers, copy button, language labels |
