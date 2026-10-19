# Architecture & Project Structure

> Part of the spacerad.io memory docs. Index: [../AGENTS.md](../AGENTS.md)

## Directory Layout

```
src/
├── assets/              # Static images/fonts (processed by Astro build pipeline)
├── components/          # Astro & Vue components
│   ├── channel/         # Telegram channel UI
│   │   ├── ChannelSidebar.astro
│   │   ├── PostCard.astro
│   │   ├── LinkPreviewCard.astro
│   │   └── ReplyQuote.astro
│   └── home/            # Homepage sections
│       ├── ProfileCard.astro
│       ├── LatestPosts.astro
│       ├── LatestChannel.astro
│       └── SectionHeader.astro
├── content/
│   ├── blog/            # Published posts (.md/.mdx)
│   └── drafts/          # Draft posts (excluded in production)
├── data/                # Static data files (friends list, etc.)
├── layouts/
│   ├── Page.astro       # Generic page layout (about, friends, etc.)
│   └── BlogPost.astro   # Blog article layout (TOC, share sidebar, comments)
├── lib/                 # Utility libraries
├── pages/               # File-based routing (see Routing below)
├── scripts/             # Client-side JS modules (see tech-stack.md)
├── styles/              # SCSS design system (see design-tokens.md, styling-guide.md)
│   ├── _tokens.scss     # All CSS custom properties
│   ├── global.scss      # Global styles, prose, components
│   └── components/      # Component-specific SCSS (_header.scss, _post-preview.scss)
├── types/               # TypeScript type definitions
├── utils/               # Server-side utilities
├── consts.ts            # Site constants, nav links, social links
├── content.config.ts    # Content collection schemas
└── env.d.ts             # Cloudflare KV environment types
```

---

## Routing

### Static Pages

| Route | File | Notes |
|-------|------|-------|
| `/` | `index.astro` | SSR-enabled homepage (fresh Telegram data) |
| `/posts` | `posts/index.astro` | Blog index grouped by year |
| `/me` | `me.mdx` | About page |
| `/friends` | `friends.mdx` | Links/recommendations |

### Dynamic Routes

| Route | File | Notes |
|-------|------|-------|
| `/posts/[slug]` | `posts/[...slug].astro` | Individual blog post |
| `/tags` | `tags/index.astro` | Tag index |
| `/tags/[tag]` | `tags/[tag].astro` | Posts filtered by tag |
| `/channel/[cursor]` | `channel/[...cursor].astro` | Paginated Telegram channel |

### API & Feed Routes

| Route | File | Notes |
|-------|------|-------|
| `/api/like` | `api/like.ts` | Like counter (Cloudflare KV-backed) |
| `/api/image-proxy` | `api/image-proxy.ts` | Image proxy/optimization |
| `/rss.xml` | `rss.xml.js` | Blog RSS feed |
| `/channel-rss.xml` | `channel-rss.xml.js` | Telegram channel RSS |
| `/feed` | `feed.js` | Alternative feed format |

---

## Content Schema

Defined in `src/content.config.ts`. Loader: `glob("./src/content/blog/**/*.{md,mdx}")`

```typescript
{
  title: string;                              // required
  description?: string;
  published: date;                              // required, auto-coerced to Date
  updatedDate?: date;
  socialImage?: ImageMetadata | URL;          // OG image
  tags?: string[];                            // defaults []
  hidden?: boolean;                           // defaults false — excluded from lists
  draft?: boolean;                            // defaults false — excluded in production
  lang?: "en" | "zh";                         // defaults "en"
  commentSystem?: "cusdis" | "remark42";      // override per-post
  comment?: boolean;                          // defaults true
}
```

---

## Layouts

### Page.astro
Generic layout for static MDX pages. Structure:
1. `BaseHead` (SEO, meta, `<ClientRouter />` for SPA navigation)
2. `Header` (navigation) — `transition:animate="none"`
3. Prose wrapper (markdown content) — `<main transition:animate="fade">`
4. `Comments` (conditional)
5. `Lightbox` (optional)
6. `Footer` (no transition attribute — adding one breaks fixed FABs)

### BlogPost.astro
Specialized blog layout. Additional features on top of Page:
- Article header with title, date, reading time, update info
- Tag pills linking to `/tags/[tag]`
- Article language entrance uses the shared verified `getPostTranslation()` mapping and existing responsive language controls. `/posts/[...slug]` resolves counterparts from the renderable collection used for route generation; unpaired or unavailable counterparts render no control. Authored article links use absolute `/posts/<id>` paths so they work with or without a trailing slash.
- **Table of Contents** — fixed sidebar on desktop (1400px+), floating drawer on mobile
- **Share sidebar** — sticky left sidebar (desktop), floating FAB (mobile)
- Social sharing (Twitter, Telegram, WeChat, etc.)
- Like button with Cloudflare KV persistence
- Blog-interactive and mermaid init scripts (re-initialized via `astro:page-load`)

---

## Key Components

### Layout Shell
The shared `BaseHead.astro` declares the Space Radio favicon: the
outlined SVG, a four-frame ICO (16/32/48/64), a 32px PNG fallback, and a separate
opaque 180px Apple touch icon. These live in `public/`; the Apple image preserves
18px canvas padding around the 144px artwork. The `v=v8-02` query changes the
explicit icon URLs to avoid reusing the old Astro favicon cache. Root filenames
remain available for implicit browser requests. Future artwork replacements
must update the version in all four links; installed home-screen icons may still
require removal and re-adding on the actual device. No PWA manifest is needed.

| Component | Lines | Purpose |
|-----------|-------|---------|
| `BaseHead.astro` | — | SEO head (meta, OG, fonts, `<ClientRouter />`) |
| `Header.astro` | ~411 | Sticky nav, search trigger, theme toggle, mobile drawer, reading progress, neon glow |
| `Footer.astro` | — | Social links (Telegram, GitHub, Email, RSS), copyright |
| `NavDrawer.astro` | — | Mobile navigation drawer |

### Content
| Component | Purpose |
|-----------|---------|
| `Prose.astro` | Wrapper for markdown content with typography styles |
| `PostList.astro` | All published posts grouped by year |
| `PostItem.astro` | Single post in list view |
| `PostPreviewCard.astro` | Card-style post preview |
| `PostPreview.astro` | Full post preview on hover |
| `FormattedDate.astro` | Date formatting |
| `Back.astro` | Back link navigation |
| `TagPill.astro` | Tag display |
| `Spoiler.astro` | Collapsible spoiler text |

### Blog-Specific
| Component | Purpose |
|-----------|---------|
| `TableOfContents.astro` | TOC with nested lists and numbering |
| `ShareSidebar.astro` | Share buttons + like counter (~411 lines) |
| `Comments.astro` | Routes to Cusdis or Remark42 |
| `CusdisComments.astro` | Cusdis widget |
| `Remark42Comments.astro` | Remark42 widget |

### Interactive
| Component | Purpose |
|-----------|---------|
| `SearchModal.astro` | Command-palette style search |
| `SearchOverlay.astro` | Full-screen search overlay |
| `ThemeToggle.astro` | 3-state theme switcher |
| `Lightbox.astro` | Image lightbox/modal |

---

## Utility Functions (`src/utils/`)

| File | Exports | Purpose |
|------|---------|---------|
| `posts.ts` | `getPublishedPosts()`, `getAllRenderablePosts()`, `groupPostsByYear()` | Post queries |
| `extractDescription.ts` | `extractDescription()` | Extract first paragraph from markdown |
| `readingTime.ts` | `readingTime()` | Estimated reading time |
| `telegram.ts` | `fetchTelegramChannel()` | Fetch Telegram channel posts |
| `scrollLock.ts` | `lockScroll()`, `unlockScroll()` | Prevent body scroll for modals |
| `viewportHeight.ts` | — | iOS `--vh` variable tracking |

---

## Key Constants (`src/consts.ts`)

```typescript
SITE_TITLE = "Spacerad.io"
SITE_TITLE_OG = "Spacerad.io · On air with Jabriel"
SITE_TITLE_ALT = ["中文 variants", ...]   // Rotating alt titles in header
SITE_DESCRIPTION = "Space Radio, another random blog..."
NAV_LINKS = [/* posts, channel, tags, friends, me — some drawer_only */]
SOCIAL_LINKS = { github, email, telegram, rss }
```

### Mobile navigation containment

The navigation dialog clips overflow (`overflow: clip`) so its translated panel cannot create a horizontally scrollable outer dialog during focus/animation. Vertical menu scrolling remains on `[data-scroll-container]`. Opening resolves the initial panel geometry before adding `is-open`; opening frames and closing timers are cancelled on interruption and route swaps. `tests/nav-drawer.test.mjs` covers lifecycle races; `tests/home03-nav-drawer.test.mjs` samples animated geometry across mobile widths, themes, motion preferences, repeat opens and route changes. iOS Safari behavior still requires device verification.

### Channel attribution

Channel requests scrape the public `t.me/s/SpaceRad_io` HTML via
`src/utils/telegram.ts`; successfully parsed snapshots are cached through
`src/utils/telegram-cache.ts`, without Bot API ingestion.
`TelegramPost.isForwarded` records an observed forward header or source-name
element independently of the optional `forwardedFrom` / `forwardedFromLink`.
The card displays `Forwarded` when a header has no usable source name.
Ordinary posts retain the existing `Original` badge. Do not infer forwarding
from body text, reply authors, or link previews.

The same parser handles latest posts and historical `before` / `after` pages,
so old messages are reclassified when their data is refreshed; no stored records
require backfilling. Cache schema `v2` includes `isForwarded` and bypasses older
snapshots that lack it. Latest/after pages use a 60-second freshness budget;
homepage/RSS/before pages use 300 seconds. Successful HTML/feed responses use
`no-cache`; upstream failures may reuse successful data for less than one hour
with a 30-second retry backoff. Cold failures return 503/no-store. Already open
documents do not update automatically. No cache purge is performed, and missing
source metadata cannot be recovered from Telegram's public preview.

Captured SpaceRad_io posts 1280/1279 reproduce empty source-name forward headers;
1281 is a separate ordinary reply. See `docs/telegram-forward-investigation.md`
and `tests/fixtures/telegram-forward-capture.html` for evidence and regressions.

### Channel profile description

`fetchTelegramChannel()` retains `descriptionText` as plain text with Telegram's
line breaks and blank lines (CRLF/CR normalized to LF), before the legacy HTML
`description` list conversion. Posts, RSS and homepage excerpts retain their
existing paths. The Channel sidebar receives `descriptionText` and renders it
through Astro's escaped text interpolation with `white-space: pre-wrap`.

Set `CHANNEL_DESCRIPTION_MODE` in `src/consts.ts`:

- `first-line` (default): first logical line only, appropriate for the compact
  curved profile card.
- `full`: all text, including original line and blank-line boundaries.
- `merged`: trim each line, omit empty lines and join with one space; preserve
  spaces within each line.

`src/utils/channelDescription.ts` applies this presentation policy without
mutating source data. The card remains a circle with an 8% top cut in every mode.
Its height is locked to its container width; content never stretches it into a
capsule. The original `FM 466.6\n\nWe Know Nothing. 🪐` bio fits in `full` at the
normal 13px text size and 88px avatar size with slightly tighter internal gaps.

**Capacity constraint:** `full` selects all source text; it does not guarantee
that an arbitrarily long bio fits inside the fixed circle. `full` and `merged`
are intended for bios that fit. Oversized text can be clipped by the shape, so
check desktop and mobile after changing the mode, title, or upstream Telegram
bio. If it does not fit, choose `first-line` or shorten the upstream bio; a very
long first line also requires a fit check. Do not report an overflowing `full`
layout as displaying the complete bio. There is no automatic truncation,
font-size reduction, expansion control, or circle resizing fallback.

The project currently uses `first-line`. No page settings UI or client-side
state is involved. The circle-external overflow candidates were temporary
previews only and are not part of the project.

### Local Beer Collection preview

`/beer-collection` is injected only for `astro dev`. Its small excluded route
loads `collectionPages` YAML metadata and `collectionItems` Markdown records,
then renders `components/collections/CollectionPage.astro`. See
[collections.md](collections.md) for editing data and adding future collections.
The title is Beer Log; its subtitle explicitly identifies beers the author has
tried. Product summaries are sourced and separate from optional authored notes.

The shared template preserves the site header, heading width and typography.
Four square tiles on desktop, three on tablets, and two on phones use 6px gutters.
Fine-pointer hover/focus reveals identifying facts; click opens the sourced
entry, with a bottom panel on mobile. Escape, focus restoration, reduced motion
and SPA cleanup use the existing dialog/scroll-lock conventions. Collection
palette overrides are scoped to `html.collection-preview-root`.

CollectionsNav is dev-only while its destination remains a preview. Desktop
pointer hover opens the disclosure, a short close delay and pointer bridge keep
links reachable, and clicking/keyboard activation remain supported. Mobile uses
an inline expandable group. Published entries come from `COLLECTION_LINKS`.
Active/hover navigation uses the shared blue link token. Page and item strings
participate in the global UI-language preference without translating authored
personal Markdown notes. Private log fields are not part of the content schema.

The wordmark easter egg is available to mouse hover and keyboard focus at all widths. The actual phrase width and space before the header controls determine placement: right with 20px clearance, otherwise beneath the brand, aligned to its left edge with a 6px gap. Resize, language changes and font loading refresh placement; touch still follows the home link directly.
