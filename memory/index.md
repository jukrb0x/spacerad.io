# Memory Index — spacerad.io

> This index provides a structured overview of all project memory documents for LLM context.
> Source of truth for project architecture, design system, and conventions.

---

## Document Overview

| Document | Purpose | Key Sections |
|----------|---------|--------------|
| `architecture.md` | Project structure, routing, content schema, layouts, components | Directory layout, routing table, content schema, component catalog |
| `design-tokens.md` | CSS custom properties, color system, typography, spacing, shadows | Tokens reference (light/dark), Shiki colors, gradients, glow effects |
| `styling-guide.md` | Theme system, SCSS mixins/functions, UnoCSS config, patterns | Dark mode syntax, mixins, UnoCSS shortcuts, component patterns |
| `tech-stack.md` | Dependencies, Astro config, plugins, client scripts, Cloudflare | Package list, Astro integrations, SPA patterns, deployment |

---

## Quick Lookup — Where to Find What

### Project Structure
- Directory layout → `architecture.md#directory-layout`
- Routing table → `architecture.md#routing`
- Content schema → `architecture.md#content-schema`

### Styling
- Theme system → `styling-guide.md#theme-system`
- Dark mode syntax → `styling-guide.md#writing-dark-mode-styles`
- All tokens (colors, typography, spacing) → `design-tokens.md`
- SCSS functions → `styling-guide.md#scss-functions`
- SCSS mixins → `styling-guide.md#scss-mixins`
- UnoCSS shortcuts → `styling-guide.md#unocss-config`

### Components
- Layout shell → `architecture.md#layout-shell`
- Content components → `architecture.md#content`
- Blog-specific → `architecture.md#blog-specific`
- Interactive → `architecture.md#interactive`
- Component patterns → `styling-guide.md#component-patterns`

### Tech Stack
- Dependencies → `tech-stack.md#dependencies`
- Astro config → `tech-stack.md#astro-configuration`
- SPA navigation → `tech-stack.md#spa-navigation-client-router`
- Markdown plugins → `tech-stack.md#remark-plugins` and `tech-stack.md#rehype-plugins`
- Cloudflare deployment → `tech-stack.md#cloudflare-deployment`

### State Management
- Theme state (nanostores) → `src/stores/theme.ts` |

---

## Key Conventions (Must-Know)

### Dark Mode
- **Syntax:** `data-theme="dark"` on `<html>`
- **Astro scoped:** `:global([data-theme="dark"]) .my-component`
- **SCSS:** `@include dark-theme { /* rules */ }`
- **UnoCSS:** `dark:prefix` classes
- **Buttons:** Use `color-mix()` tinted backgrounds in dark mode, avoid solid gray fills

### SPA Navigation (Critical for client-side code)
- **Header:** `transition:animate="none"` — DOM swaps, listeners lost
- **Events:** Dispatch on `document`, NOT `window`
- **Event names:** `astro:before-swap`, `astro:after-swap`, `astro:page-load`
- **Module scripts:** Execute once, use `astro:page-load` for re-init
- **Inline scripts:** Add `data-astro-rerun` attribute
- **AbortController:** Use for document-level listener cleanup
- **No `transition:animate="none"` on footer:** Breaks fixed FABs

### Naming
- **CSS:** BEM — `.component__element--modifier`
- **State:** Data attributes — `[data-theme]`, `[data-header]`, `[data-tone]`
- **Variables:** `--category-name` pattern
- **Files:** kebab-case, PascalCase for components

### Color Accent
- **Light theme:** `#555555`
- **Dark theme:** `#a0a0a0`
- **Monochrome gray palette** — no primary brand color

---

## Token Categories Reference

### Typography (`--font-size-*`)
- xs: 13px, sm: 15px, base: 17px, lg: 20px, xl: 24px, 2xl: 30px, 3xl: 36px, 4xl: 48px, 5xl: 60px, 6xl: 72px

### Spacing (`--space-*`)
- 1: 4px, 2: 8px, 3: 12px, 4: 16px, 6: 24px, 8: 32px, 12: 48px

### Border Radius (`--radius-*`)
- sm: 6px, md: 10px, lg: 16px

### Z-Index (`--z-*`)
- base: 0, dropdown: 10, sticky: 20, fixed: 30, modal-backdrop: 40, modal: 50, popover: 60, tooltip: 70

### Transitions (`--transition-*`)
- fast: 0.15s, base: 0.2s, slow: 0.3s

---

## Component Catalog

### Layout Shell
| Component | File | Key Features |
|-----------|------|--------------|
| BaseHead | `BaseHead.astro` | SEO, meta, ClientRouter import |
| Header | `Header.astro` | Sticky, search, theme toggle, reading progress, neon glow |
| Footer | `Footer.astro` | Social links, copyright |
| NavDrawer | `NavDrawer.astro` | Mobile navigation |

### Content
| Component | Purpose |
|-----------|---------|
| Prose | Markdown typography wrapper |
| PostList | Posts grouped by year |
| PostItem | Single post in list |
| PostPreviewCard / PostPreview | Hover preview card |
| FormattedDate | Date formatting |
| Back | Back link navigation |
| TagPill | Tag display |
| Spoiler | Collapsible text |

### Blog-Specific
| Component | Purpose |
|-----------|---------|
| TableOfContents | Fixed sidebar (desktop), floating drawer (mobile) |
| ShareSidebar | Share buttons + like counter |
| Comments / CusdisComments / Remark42Comments | Comment systems |

### Interactive
| Component | Purpose |
|-----------|---------|
| SearchModal | Command-palette search |
| ThemeToggle | 3-state theme switcher |
| Lightbox | Image modal |

---

## Utility Functions (`src/utils/`)

| File | Exports |
|------|---------|
| `posts.ts` | `getPublishedPosts()`, `getAllRenderablePosts()`, `groupPostsByYear()` |
| `extractDescription.ts` | `extractDescription()` |
| `readingTime.ts` | `readingTime()` |
| `telegram.ts` | `fetchTelegramChannel()` |
| `scrollLock.ts` | `lockScroll()`, `unlockScroll()` |
| `viewportHeight.ts` | iOS `--vh` variable |

## State Management (`src/stores/`)

| File | Exports |
|------|---------|
| `theme.ts` | `themePreference`, `activeTheme`, `setThemePreference`, `cycleTheme`, `getThemeState` |

---

## Client Scripts (`src/scripts/`)

| Script | Purpose | SPA Pattern |
|--------|---------|-------------|
| `theme.ts` | Theme toggle bindings — wrapper around `stores/theme` nanostores | Imports nanostores, exports `bindThemeToggles`, `onThemeChange` |
| `header-scroll.ts` | Header hide/show, reading progress | `astro:page-load` re-query refs, persistent scroll guard |
| `code-blocks.ts` | Copy button, language labels | `astro:after-swap` re-init |
| `blog-interactive.ts` | TOC, share sidebar, like button | Called from BlogPost, persistent listener guard |
| `mermaid-init.ts` | Mermaid diagram rendering | Cache module, re-render from `data-mermaid-src` |
| `post-preview.ts` | Hover preview card | `astro:page-load` re-init |
| `viewport-height.ts` | iOS 100vh fix | Persistent resize listener |
| `scroll-lock.ts` | Prevent body scroll | Stateless utility |
| `cusdis.ts` | Cusdis comments | `astro:after-swap` re-init, theme cleanup |
| `remark42.ts` | Remark42 comments | `astro:after-swap` re-init, `destroyRemark42()` cleanup |

---

## Routing Summary

### Static Pages
- `/` → `index.astro` (SSR, fresh Telegram data)
- `/posts` → `posts/index.astro`
- `/me` → `me.mdx`
- `/friends` → `friends.mdx`

### Dynamic Routes
- `/posts/[slug]` → `posts/[...slug].astro`
- `/tags` / `/tags/[tag]` → tag pages
- `/channel/[cursor]` → paginated Telegram channel

### API / Feeds
- `/api/like` → Cloudflare KV like counter
- `/api/image-proxy` → Image proxy
- `/rss.xml` / `/channel-rss.xml` / `/feed` → RSS feeds

---

## Markdown Features

| Feature | Implementation |
|---------|---------------|
| Syntax highlighting | rehype-pretty-code + Shiki (github-light / github-dark) |
| Math | remark-math + rehype-katex |
| Diagrams | Mermaid via rehype-mermaid |
| Alerts | remark-github-blockquote-alert (NOTE, TIP, WARNING, CAUTION) |
| Heading links | rehype-slug + rehype-autolink-headings |
| External links | rehype-external-links |
| Figures | rehype-figure |

---

## Cloudflare Config

### KV Namespace
- Binding: `LIKES`

### Environment Variables
- `PUBLIC_REMARK_URL` — Remark42 instance URL
- `PUBLIC_REMARK_SITE_ID` — Site identifier

---

## UnoCSS Key Shortcuts

| Shortcut | Expands to |
|----------|-----------|
| `surface-card` | bg-surface, border border-soft, rounded-md, shadow-soft |
| `card-interactive` | surface-card + hover:shadow-strong |
| `icon-btn` | inline-flex centered, transparent bg, secondary color |
| `pill` | inline tag badge with border |
| `flex-center` | flex items-center justify-center |
| `flex-between` | flex items-center justify-between |

---

## Constants (`src/consts.ts`)

```typescript
SITE_TITLE = "Spacerad.io"
SITE_TITLE_OG = "Spacerad.io · On air with Jabriel"
SITE_DESCRIPTION = "Space Radio, another random blog..."
NAV_LINKS = [/* posts, channel, tags, friends, me */]
SOCIAL_LINKS = { github, email, telegram, rss }
```

---

## Content Schema Frontmatter

| Field | Type | Default |
|-------|------|---------|
| `title` | string | required |
| `description` | string | — |
| `published` | date | required (auto-coerced) |
| `updatedDate` | date | — |
| `socialImage` | ImageMetadata \| URL | — |
| `tags` | string[] | `[]` |
| `hidden` | boolean | `false` |
| `draft` | boolean | `false` |
| `lang` | "en" \| "zh" | `"en"` |
| `commentSystem` | "cusdis" \| "remark42" | — |
| `comment` | boolean | `true` |

---

## Design System Source Files

- **Tokens:** `src/styles/_tokens.scss` — CSS custom properties (source of truth)
- **Global styles:** `src/styles/global.scss` — prose, animations, scrollbar
- **Component styles:** `src/styles/components/*.scss`

---

## SPA Navigation Lifecycle

```
User clicks link
    ↓
ClientRouter intercepts
    ↓
astro:before-swap (on document) → cleanup, close modals
    ↓
DOM swap
    ↓
astro:after-swap (on document) → DOM manipulation
    ↓
Hydration complete
    ↓
astro:page-load (on document) → Re-initialize scripts, bind listeners
```

---

## Last Updated

This index reflects the current state of memory documents. Update when:
- New components are added
- Routing changes
- Design tokens are modified
- SPA patterns evolve
- New dependencies are added
- State management patterns change (e.g., nanostores adoption)
