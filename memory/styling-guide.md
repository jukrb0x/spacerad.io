# Styling Guide

> Part of the spacerad.io memory docs. Index: [../AGENTS.md](../AGENTS.md)
>
> For token values, see [design-tokens.md](design-tokens.md)

---

## Theme System

### How It Works
- **Storage:** `localStorage` key `"theme-preference"` — values: `"system"` | `"light"` | `"dark"`
- **DOM:** `<html data-theme="light|dark" data-theme-mode="system|light|dark">`
- **Detection:** `window.matchMedia("(prefers-color-scheme: dark")`
- **Cycling:** system -> light -> dark -> system
- **Script:** `src/scripts/theme.ts` (~225 lines), observer pattern for change listeners

### Writing Dark Mode Styles

**In SCSS (global/component partials):**
```scss
// Scoped inside a selector
.my-element {
    color: var(--color-text-primary);
    @include dark-theme {
        // overrides for dark
    }
}

// At root level
@include dark-theme-root {
    // root-level dark overrides
}
```

**In Astro scoped `<style>`:**
Use `:global()` to escape Astro's scope hashing:
```scss
:global([data-theme="dark"]) .my-component {
    /* dark overrides */
}
```

**In UnoCSS (templates):**
```html
<div class="bg-white dark:bg-surface text-primary dark:text-secondary">
```

---

## SCSS Functions

```scss
space($key)       // -> var(--space-#{$key})       e.g. space(4) -> var(--space-4)
font-size($key)   // -> var(--font-size-#{$key})
radius($key)      // -> var(--radius-#{$key})
z($key)           // -> var(--z-#{$key})
transition($key)  // -> var(--transition-#{$key})
```

## SCSS Mixins

```scss
@include breakpoint(md) { }           // @media (min-width: 768px)
@include breakpoint-down(md) { }      // @media (max-width: 767px)
@include dark-theme { }               // :root[data-theme="dark"] &
@include dark-theme-root { }          // &[data-theme="dark"]
@include transition(color, bg) { }    // transition: color 0.2s ease, bg 0.2s ease
@include focus-visible($color) { }    // :focus-visible outline
@include sr-only;                     // visually hidden, accessible
@include truncate;                    // text-overflow: ellipsis
@include line-clamp($n);             // -webkit-line-clamp
@include surface-card($shadow);       // card surface pattern
@include hover-underline;             // animated underline on hover via ::after
@include reduced-motion { }           // @media (prefers-reduced-motion: reduce)
```

---

## UnoCSS Config

### Presets
- `presetWind3()` — Tailwind v3 compatible atomic classes
- `presetWebFonts()` — Inter (400/600/800), Fira Code (400/500); browser loads imports so builds do not require Google Fonts access
- **MiSans Latin** — loaded via `@font-face` in `global.scss` (CDN jsDelivr + local `/fonts/` fallback), weights 400–800

### Transformers
- `transformerDirectives()` — `@apply`, `@screen` in `<style>` blocks
- `transformerVariantGroup()` — `hover:(text-red bg-blue)` compact syntax

### Key Shortcuts

| Shortcut | Expands to |
|----------|-----------|
| `surface-card` | bg-surface, border border-soft, rounded-md, shadow-soft |
| `surface-card-hover` | surface-card + hover transitions |
| `card-interactive` | surface-card-hover + hover:shadow-strong |
| `page-shell` | max-w-layout-max-width, mx-auto, px-space-4 |
| `icon-btn` | inline-flex centered, transparent bg, secondary color |
| `pill` | inline tag badge with border |
| `flex-center` | flex items-center justify-center |
| `flex-between` | flex items-center justify-between |
| `hover-lift` | hover:-translate-y-0.5 + transition |
| `hover-glow` | hover:shadow-button-hover + transition |

### Custom Rules
- `measure` / `measure-wide` — max-width for reading (68ch / 72ch)
- `font-size-*` — maps to `--font-size-*` variables
- `space-*` — maps to `--space-*` variables
- `gradient-bg-*` — radial gradient backgrounds (warm-cool, cosmic, radio-glow, cosmic-subtle, radio-subtle)

### Safelist
`prose`, `toc`, `lightbox`, `scroll-locked`, `bg-muted`, `animate-pop`, `animate-shake`

---

## Naming Conventions

- **CSS classes:** BEM-inspired — `.component__element--modifier`
- **State:** data attributes — `[data-theme]`, `[data-header]`, `[data-tone]`, `[data-like-button]`
- **CSS variables:** `--category-name` — e.g. `--color-bg-surface`, `--font-size-lg`
- **Files:** kebab-case for files, PascalCase for Astro/Vue components

---

## Component Patterns

### Link Arrows
UI link arrows use Astro Icon's `ri:arrow-right-up-line` with `.link-arrow` (1em, inline baseline alignment), `aria-hidden="true"`, and `focusable="false"`. The installed Remix SVG inherits the link's `currentColor`; use `is:inline` so fragment responses do not depend on another document's symbol definitions. Keep authored content symbols unchanged.

### Surface Card
The standard card pattern used across the site:
```scss
background: var(--color-bg-surface);
border: 1px solid var(--color-border-soft);
border-radius: var(--radius-md);   // 10px
box-shadow: var(--shadow-soft);
```

### Button Patterns

**1. Icon button** — `.icon-btn`
- Sizes: `--xs` (2rem), `--sm` (2.5rem), `--md` (3rem)
- Shapes: `--round` (pill), `--square` (radius-md)
- Variants: `--bordered` (adds border-soft)
- Transparent bg, secondary color, accent on hover

**2. Pill / tag** — `.pill`
- Inline badge with border, xs font, semibold
- `[data-tone="accent"]` — tinted accent background via `color-mix()`

**3. Primary button**
- Solid `--color-accent` background, white text
- Hover: `--color-accent-dark`

**4. Ghost button**
- Transparent bg, accent border + text
- Hover: fills with accent, text goes white

**5. Dark mode buttons (preferred pattern)**
In dark mode, avoid solid gray fills. Use `color-mix()` tinted backgrounds for glass-like integration:
```scss
// Primary: tinted glass
:global([data-theme="dark"]) .btn--primary {
    background: color-mix(in srgb, var(--color-accent) 18%, var(--color-bg-surface));
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-subtle);
}
:global([data-theme="dark"]) .btn--primary:hover {
    background: color-mix(in srgb, var(--color-accent) 30%, var(--color-bg-surface));
    border-color: var(--color-accent);
}

// Ghost: subtle border, muted text
:global([data-theme="dark"]) .btn--ghost {
    color: var(--color-text-secondary);
    border-color: var(--color-border-subtle);
}
:global([data-theme="dark"]) .btn--ghost:hover {
    background: var(--color-accent-tint-12);
    color: var(--color-text-primary);
    border-color: var(--color-accent);
}
```

### Mobile article tools

The return arrow and label use an 8px gap. The reading shortcut appears only while the prose fills the viewport, after the header has left and before the article-end actions arrive. It is a blue 44px-high pill with a route-node mark and an explicit Contents label, sized naturally for English or Chinese. Opening the native dialog replaces the pill with a matching control that collapses toward the same bottom-right anchor into a 44px close circle; closing reverses the motion. The article-end actions sit after prose and before comments on mobile as the selected centered capsule pair: a neutral gray Like outline and content before liking, a blue Share outline, and transparent page backgrounds, 132×50px buttons with a 26px radius, 15px medium labels, 19px icons, and a 16px gap (124px buttons and a 12px gap below 360px). The bilingual invitation sits above; the total likes received appears below both buttons, never as a count of people. Like fills from the bottom according to personal likes out of 16, independently of the displayed total: pale red liquid, readable red content and matching red outline, and a brief settling wave on each click; full personal progress becomes red with white content. The frame stays fixed and reduced motion uses a static fill. Share becomes blue with white content while its existing labeled social/copy actions are expanded in one centered row, then returns to its clean surface. Imagery stays clear of share overlays.

---

## Global Style Features (`global.scss`)

### Prose Typography
Comprehensive markdown styling scoped to `.prose`:
- Heading hierarchy (h1–h6) with auto-numbering counters (h2.1, h3.1.1, etc.)
- Anchor links in headings
- Blockquotes with left border + accent background
- Code blocks: Shiki dual-theme, line numbers, line/char highlighting
- Article code presentation: `src/styles/code-blocks.css` adds thin horizontal rules, a subtle light/dark surface, horizontal scrolling and keyboard focus. `scripts/code-themes.mjs` defines grammar-scoped syntax palettes. Inline code and the copy/SPA initialization logic are unchanged; named character-highlight groups retain their existing colors.
- Highlighted char IDs: `v` = green, `s` = blue, `i` = amber
- Tables: striped rows, sticky header, responsive card mode below 48rem
- Details/summary: collapsible with chevron animation
- Footnotes: styled references with accent color
- Markdown alerts: note, tip, warning/important, caution (left border color-coded)

### Animations
```scss
@keyframes pop        // scale 1 → 1.2 → 1
@keyframes shake      // horizontal shake (-2px/+2px)
@keyframes slideDown   // opacity + translateY
@keyframes lightbox-spin  // 360° rotation
```
Utility classes: `.animate-pop`, `.animate-shake`

### Scrollbar
Custom 6px width, rounded, themed colors (`--c-scrollbar` / `--c-scrollbar-hover`)

---

## Component-Specific SCSS

### Header (`components/_header.scss`)

`editorial.css` paints a static 170px page-top wash from the invariant structure
blue `#0819ae` into the existing page base. `--page-wash-strength` in `_tokens.scss`
is 7% light / 8% dark; dark uses the same ink rather than the brighter link color.
The fade reaches 80%, 40%, and 10% of its initial strength at 45, 95, and 140px.
`body::before` replaces the former dots and covers the desktop header's collapsed
32px margin (mobile has no top margin).

`--browser-canvas-color` is the solid `html`/`body` background color, so Safari's
browser chrome canvas fallback follows the current top edge. The header's existing
scroll RAF interpolates `--browser-canvas-strength` over the same stop positions
and levels that define the static wash in CSS, reading those parameters once per
page load. The color reaches the page base at 170px and restores the wash at 0px.
An opaque, uniform page-base background image on `body` preserves its visible
paint beneath `body::before`; keep this layer on collections too. Theme and Beer
palette changes resolve through the current root tokens without extra JS effects.
Safari controls its own chrome tint and blur; desktop browser tests can verify
the canvas colors and unchanged page paint, but cannot verify real iOS chrome.

Floating navigation and the Home return backdrop share the same opaque gradient.
`header-scroll.ts` aligns their paint in document coordinates, including navigation
transforms and the profile backdrop's negative inset. It uses the existing RAF and
SPA cleanup lifecycle; past 170px, paint alignment skips geometry reads. Profile
content clipping and navigation interaction stay unchanged.

The floating navigation keeps the same solid `--browser-canvas-color` as the
root canvas, including after scrolling away and returning. A second, uniform
page-base image under its aligned wash preserves its visible color below the
wash. Safari can sample a fixed element's solid background instead of the root;
these inputs must agree with the current page edge rather than retaining the
initial wash color. While the navigation drawer dialog is open, a root `:has()`
override uses its opaque page-base panel color for all canvas inputs. Closing it
restores the current scroll color. This override intentionally targets the nav
drawer; Beer detail dialogs keep their own sheet tint. Safari owns the content
extension behind its floating toolbar, which desktop WebKit cannot verify.
The nav panel's opaque background also makes its former backdrop blur redundant;
the editorial override removes that extra compositing filter. This does not claim
to change Safari's native toolbar transparency or extend dialog content under it.

Beer Log passes `collectionId="beer"` to CollectionPage, setting
`html[data-collection="beer"]`. Only that root overrides `--page-wash-ink` and
`--page-wash-strength`: warm gray-brown `#766249` at 6% in light mode, deep brown
`#3b3020` at 14% in dark mode. The shared gradient falls back to `--color-structure`
on other pages and collections; the 170px fade and header paint alignment remain
unchanged. The structure/brand color itself is never overridden.

The footer has a full-width upward wash painted by an absolute `body::after`
behind content, using the same page-wash ink and page-base tokens. It fades over
110px at 5% strength on desktop, and 80px at 4% on mobile. Beer Log retains its
warm ink, with 8% desktop / 6% mobile strength in dark mode. This decoration has
no pointer events. The real footer is full width with its original content gutter
and divider preserved. `position: sticky; top: 0` makes it eligible for WebKit's
independent bottom-edge sampling; as the last flow element it stays at its natural
position rather than pinning to the viewport bottom. Its solid background is the
wash's bottom color, while matching gradient/base image layers preserve visible
paint. The root canvas continues following the top edge. The nav-menu override
also resets the footer sampling color to the panel base.

WebKit's `LocalFrameView::fixedContainerEdges()` requires a fixed/sticky element
spanning at least 90% of the sampled viewport edge; it does not require the sticky
box to be currently stuck. The source applies colors separately to each edge.
This is a local experiment with geometry and sampling inputs checked in desktop
WebKit/Chromium; actual iOS toolbar tint and blur still require device verification.
- Sticky with z-index `--z-sticky` (20)
- `.is-scrolled` — backdrop-filter blur(12px) saturate(180%), semi-transparent bg
- `.header--hidden` — translateY(-100%)
- `.header--minimal` — reduced padding
- `[data-reading-progress]` — 3px absolute bar at bottom, scaleX transform

### Post Preview (`components/_post-preview.scss`)
- Fixed position, z-index `--z-tooltip` (70)
- 280px width, scale + opacity transition
- Image container 140px height
- Title: 2-line clamp, Description: 3-line clamp

### Homepage section links and Channel photos

Blog and Channel headings share red resting links with an ink-on-yellow clipped
wipe on fine-pointer hover and keyboard focus. The overlay is aria-hidden and
carries ink and background together; reduced motion makes it immediate. The
static decorative greeting starts the inline About row on the reading grid.
The intro text follows with the normal flex gap and shares its baseline with
the rotating phrase.

Home shows five Channel notes. Only the first posted photo receives a small
thumbnail, loaded when visible; pointer/focus enlargement reuses the article
preview controller. Async Channel insertion registers new links without resetting
an active Blog preview.

The home About intro uses Cabin 400 at 24px on desktop and 20px on mobile.
The bundled font supports weights 400–700. Preserve the 39.2px/32.2px line boxes
and 48px/42px minimum row heights; the inline greeting scales at 0.78em.

### SPA navigation feedback

The Header uses a 104px full-width translucent wash with
9px backdrop blur, masked to fade smoothly at the bottom. It uses the existing
page-wash color and Remix `loader-4-line`; spinner and wash translate together.

Logo clicks never show the wash. The white runner spans 44% of the logo width.
At completion, `navigation-motion.ts` snapshots its computed position and width,
then transitions to the full track over 300ms before the blue wipes left-to-right.
Hover reveals blue left-to-right; clicking preserves an already-filled hover state.
The hidden clip resets without a transition before hover re-entry.

`NavigationFeedback.astro` and the Header runner are included in production on
desktop and mobile. `navigation-feedback.ts` starts at before-preparation,
carries the logo state into the swapped Header and finishes on the matching after-swap without
delaying navigation. Other SPA navigation shows the wash after 300ms; aborts and
loader failures clear state. Persistent module listeners bind once; navigation
revision guards prevent aborted requests from clearing a newer indicator.
Completion uses the matching swap signal, not uncorrelated page-load events: an
older route can emit page-load late while its arriving scripts finish.
Reduced motion disables scanning, spinning and transitions. Browser coverage in
`tests/home03-navigation-feedback.test.mjs` includes desktop/touch SPA completion
and interruption handling.


Header search, theme, and menu use matching 20px line icons with a 1.7px rounded stroke and the same tinted hover circle. The navigation drawer uses its own stable 24px inset (respecting safe areas), with Menu, language, and the 44px close button on one flex row. Its layout stays consistent when opened from either the full or floating header; menu links retain 44px touch targets with a 4px list gap.
