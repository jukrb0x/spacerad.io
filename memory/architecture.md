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
- **Table of Contents** — fixed sidebar on desktop (1400px+), floating drawer on mobile
- **Share sidebar** — sticky left sidebar (desktop), floating FAB (mobile)
- Social sharing (Twitter, Telegram, WeChat, etc.)
- Like button with Cloudflare KV persistence
- Blog-interactive and mermaid init scripts (re-initialized via `astro:page-load`)

---

## Key Components

### Layout Shell
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
