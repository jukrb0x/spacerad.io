# spacerad.io

Personal blog by Jabriel. Astro 5 + UnoCSS + SCSS + Vue 3, deployed on Cloudflare Pages.

## Quick Reference

| What you need | Document |
|---------------|----------|
| Project structure, routing, content schema, layouts, components | [memory/architecture.md](memory/architecture.md) |
| CSS custom properties, color system (light + dark), typography, spacing, shadows | [memory/design-tokens.md](memory/design-tokens.md) |
| Theme system, SCSS mixins/functions, UnoCSS config, naming conventions, component patterns | [memory/styling-guide.md](memory/styling-guide.md) |
| Dependencies, Astro config, plugins, client scripts, Cloudflare deployment | [memory/tech-stack.md](memory/tech-stack.md) |

## Principles
- Be excellent to others even there is only me
- Write clean, maintainable, reusable code
- Optimize for performance and accessibility
- Use modern web standards and best practices
- Prefer simplicity and minimalism over complexity
- Document decisions and architecture for future reference
- Automate repetitive tasks where possible
- Update the memory docs as the project evolves

## Commands

```bash
pnpm dev        # Dev server
pnpm build      # Production build
pnpm preview    # Preview build
pnpm format     # Biome format
pnpm lint       # Biome lint
```

## Key Conventions

- **Dark mode** via `data-theme="dark"` on `<html>` — use `:global([data-theme="dark"])` in Astro scoped styles, `@include dark-theme` in SCSS, `dark:` prefix in UnoCSS
- **Monochrome gray accent** palette — `#555` light, `#a0a0a0` dark
- **BEM naming** — `.component__element--modifier`
- **State via data attrs** — `[data-theme]`, `[data-header]`, `[data-tone]`
- **Dark mode buttons** — prefer `color-mix()` tinted backgrounds over solid gray fills
- **Tokens source of truth** — `src/styles/_tokens.scss`
- **Content** — MDX blog posts in `src/content/blog/`, loaded via Content Collections

## SPA Navigation (Client Router)

The site uses Astro's `<ClientRouter />` for SPA-style navigation. This is critical context for writing any client-side code.

### Key Rules

1. **`transition:animate="none"` swaps DOM, does NOT preserve it.** All event listeners on those elements are lost after navigation. Header uses this — its DOM is replaced on every page swap.
2. **Astro lifecycle events dispatch on `document`, NOT `window`.** Always use `document.addEventListener("astro:page-load", ...)`, never `window.addEventListener(...)`.
3. **Module `<script>` tags execute once, ever.** Use `astro:page-load` listener inside them to re-initialize after navigation.
4. **Inline `<script is:inline>` tags** need `data-astro-rerun` attribute to re-execute on navigation.
5. **Use `AbortController` for document-level listener cleanup** to prevent listener leaks across navigations. See `NavDrawer.astro` for the canonical pattern.
6. **Use module-level guards** (`let scrollListenerAttached = false`) for persistent listeners (scroll, resize) that should only bind once.
7. **Clean up `onThemeChange` subscriptions** — store the unsubscribe function and call it before re-subscribing.
8. **Don't put `transition:animate="none"` on footer** — it creates a view-transition stacking context that breaks fixed-position FABs.
9. **Header scroll offset** (`--header-offset`) — only set on page-load, never during scroll (causes layout thrashing).
