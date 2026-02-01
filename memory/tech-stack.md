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

| Script | Purpose |
|--------|---------|
| `theme.ts` | Theme management — 3-state cycle (system/light/dark), localStorage, matchMedia, observer pattern |
| `header-scroll.ts` | Header glow effect, hide/show on scroll, reading progress bar |
| `code-blocks.ts` | Copy button with "Copied!" feedback, language labels, execCommand fallback |
| `blog-interactive.ts` | TOC mobile drawer, share sidebar interactions, like button |
| `mermaid-init.ts` | Initialize and render Mermaid diagrams |
| `post-preview.ts` | Hover preview card for post links |
| `viewport-height.ts` | iOS 100vh fix (tracks `--vh` CSS variable) |
| `scroll-lock.ts` | Prevent body scroll during modals (adds `.scroll-locked`) |
| `cusdis.ts` | Cusdis comment system initialization |
| `remark42.ts` | Remark42 comment system initialization |

---

## Cloudflare Deployment

### Wrangler Config (`wrangler.toml`)
```toml
name = "space-radio"
main = "./dist/_worker.js/index.js"
compatibility_date = "2026-01-18"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

[assets]
binding = "ASSETS"
directory = "./dist"
html_handling = "drop-trailing-slash"

[observability]
enabled = true

[[kv_namespaces]]
binding = "LIKES"
id = "bfca45c77224430683574746d8a7069f"
```

### Environment Variables
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
