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
- `presetWebFonts()` — Inter (400/600/800), Fira Code (400/500)

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

---

## Global Style Features (`global.scss`)

### Prose Typography
Comprehensive markdown styling scoped to `.prose`:
- Heading hierarchy (h1–h6) with auto-numbering counters (h2.1, h3.1.1, etc.)
- Anchor links in headings
- Blockquotes with left border + accent background
- Code blocks: Shiki dual-theme, line numbers, line/char highlighting
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
