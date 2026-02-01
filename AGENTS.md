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
