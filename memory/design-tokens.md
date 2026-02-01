# Design Tokens

> Part of the spacerad.io memory docs. Index: [../AGENTS.md](../AGENTS.md)
>
> Source of truth: `src/styles/_tokens.scss`

The site uses a **monochrome gray accent** palette. All tokens are CSS custom properties on `:root`, with dark overrides on `:root[data-theme="dark"]`.

---

## Typography

| Token | Value |
|-------|-------|
| `--font-size-xs` | 0.8125rem (13px) |
| `--font-size-sm` | 0.9375rem (15px) |
| `--font-size-base` | 1.0625rem (17px) |
| `--font-size-lg` | 1.25rem (20px) |
| `--font-size-xl` | 1.5rem (24px) |
| `--font-size-2xl` | 1.875rem (30px) |
| `--font-size-3xl` | 2.25rem (36px) |
| `--font-size-4xl` | 3rem (48px) |
| `--font-size-5xl` | 3.75rem (60px) |
| `--font-size-6xl` | 4.5rem (72px) |

| Token | Value |
|-------|-------|
| `--font-family-sans` | `'MiSans Latin', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, emoji stack` |
| `--font-family-mono` | `'Fira Code', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace` |

| Token | Value |
|-------|-------|
| `--line-height-none` | 1 |
| `--line-height-extra-tight` | 1.1 |
| `--line-height-tight` | 1.22 |
| `--line-height-relaxed` | 1.65 |
| `--line-height-base` | 1.75 |

| Token | Value |
|-------|-------|
| `--font-weight-light` | 300 |
| `--font-weight-normal` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |
| `--font-weight-bold` | 700 |
| `--font-weight-extrabold` | 800 |

| Token | Value |
|-------|-------|
| `--letter-spacing-tighter` | -0.02em |
| `--letter-spacing-tight` | -0.01em |
| `--letter-spacing-normal` | 0 |
| `--letter-spacing-wide` | 0.04em |
| `--letter-spacing-wider` | 0.12em |

---

## Spacing

| Token | Value |
|-------|-------|
| `--space-1` | 0.25rem (4px) |
| `--space-2` | 0.5rem (8px) |
| `--space-3` | 0.75rem (12px) |
| `--space-4` | 1rem (16px) |
| `--space-6` | 1.5rem (24px) |
| `--space-8` | 2rem (32px) |
| `--space-12` | 3rem (48px) |

---

## Border Radius

| Token | Value |
|-------|-------|
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 16px |

---

## Z-Index Scale

| Token | Value |
|-------|-------|
| `--z-base` | 0 |
| `--z-dropdown` | 10 |
| `--z-sticky` | 20 |
| `--z-fixed` | 30 |
| `--z-modal-backdrop` | 40 |
| `--z-modal` | 50 |
| `--z-popover` | 60 |
| `--z-tooltip` | 70 |

---

## Transitions

| Token | Value |
|-------|-------|
| `--transition-fast` | 0.15s ease |
| `--transition-base` | 0.2s ease |
| `--transition-slow` | 0.3s ease |

---

## Layout

| Token | Value |
|-------|-------|
| `--layout-max-width` | 72rem (1152px) |
| `--measure` | 68ch |
| `--measure-wide` | 72ch |

---

## Breakpoints

| Name | Value |
|------|-------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |

---

## Color System — Light Theme (`:root`)

### Backgrounds

| Token | Value |
|-------|-------|
| `--color-bg-page` | `#fafbfc` |
| `--color-bg-surface` | `#ffffff` |
| `--color-bg-muted` | `#f6f8fa` |
| `--color-bg-elevated` | `#ffffff` |

### Text (WCAG AA compliant)

| Token | Value |
|-------|-------|
| `--color-text-primary` | `#0d1117` |
| `--color-text-secondary` | `#57606a` |
| `--color-text-muted` | `#8b949e` |
| `--color-text-inverse` | `#ffffff` |
| `--color-text-primary-rgb` | `13 17 23` |

### Accent

| Token | Value |
|-------|-------|
| `--color-accent` | `#555555` |
| `--color-accent-dark` | `#333333` |
| `--color-accent-soft` | `#f0f0f0` |
| `--color-accent-rgb` | `85 85 85` |
| `--color-accent-tint` | `rgba(85, 85, 85, 0.16)` |
| `--color-accent-tint-6` | `color-mix(in srgb, #555 6%, transparent)` |
| `--color-accent-tint-8` | `color-mix(in srgb, #555 8%, transparent)` |
| `--color-accent-tint-12` | `color-mix(in srgb, #555 12%, transparent)` |
| `--color-accent-tint-18` | `color-mix(in srgb, #555 18%, transparent)` |

### Links

| Token | Value |
|-------|-------|
| `--color-link` | `#555555` |
| `--color-link-hover` | `#222222` |

### Borders

| Token | Value |
|-------|-------|
| `--color-border` | `#d0d7de` |
| `--color-border-soft` | `rgba(13, 17, 23, 0.08)` |
| `--color-border-subtle` | `rgba(13, 17, 23, 0.12)` |
| `--color-border-strong` | `#afb8c1` |

### State Colors

| Token | Value |
|-------|-------|
| `--color-success` | `#1a7f37` |
| `--color-warning` | `#bf8700` |
| `--color-danger` | `#cf222e` |
| `--color-note` | `#8250df` |
| `--color-state-success-bg` | `#dafbe1` |
| `--color-state-success-text` | `#1a7f37` |
| `--color-state-info-bg` | `#ddf4ff` |
| `--color-state-info-text` | `#0969da` |

### Shadows

| Token | Value |
|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` |
| `--shadow-sm` | `0 2px 4px rgba(0,0,0,0.06)` |
| `--shadow-md` | `0 4px 8px rgba(0,0,0,0.08)` |
| `--shadow-soft` | `0 6px 18px rgba(47,37,25,0.08)` |
| `--shadow-strong` | `0 16px 36px rgba(47,37,25,0.14)` |
| `--shadow-xl` | `0 24px 48px rgba(0,0,0,0.18)` |
| `--shadow-2xl` | `0 32px 64px rgba(0,0,0,0.22)` |
| `--shadow-button-hover` | `0 6px 20px rgba(85,85,85,0.15)` |
| `--shadow-lightbox` | `0 20px 60px rgba(0,0,0,0.4)` |

### Space Radio Palette

| Token | Value |
|-------|-------|
| `--color-accent-warm` | `#888888` |
| `--color-accent-cool` | `#555555` |
| `--color-radio-dial` | `#d4a574` |
| `--color-radio-tube` | `#ff9f43` |
| `--color-radio-grill` | `#2c3e50` |
| `--color-space-cyan` | `#00d9ff` |
| `--color-space-purple` | `#a855f7` |
| `--color-space-blue` | `#3b82f6` |
| `--color-space-silver` | `#6e7781` |

### Glow Effects

| Token | Value |
|-------|-------|
| `--glow-accent-soft` | `0 0 20px rgba(85,85,85,0.15)` |
| `--glow-accent-strong` | `0 0 40px rgba(85,85,85,0.25)` |
| `--glow-cool` | `0 0 30px rgba(59,130,246,0.2)` |

### Gradients

| Token | Value |
|-------|-------|
| `--gradient-warm-to-cool` | `linear-gradient(135deg, #666 0%, #999 100%)` |
| `--gradient-cosmic` | `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` |
| `--gradient-radio-glow` | `radial-gradient(ellipse at center, rgba(212,165,116,0.15) 0%, transparent 70%)` |
| `--gradient-bg-subtle` | `radial-gradient(ellipse at top, rgba(85,85,85,0.02) 0%, transparent 50%)` |
| `--gradient-bg-cosmic` | `radial-gradient(ellipse at top, rgba(102,126,234,0.05) 0%, transparent 50%)` |
| `--gradient-bg-radio` | `radial-gradient(ellipse at bottom, rgba(212,165,116,0.05) 0%, transparent 50%)` |

### Shiki (syntax highlighting)

| Token | Value |
|-------|-------|
| `--shiki-color-text` | `#414141` |
| `--shiki-token-constant` | `#1976d2` |
| `--shiki-token-string` | `#22863a` |
| `--shiki-token-comment` | `#aaa` |
| `--shiki-token-keyword` | `#d32f2f` |
| `--shiki-token-parameter` | `#ff9800` |
| `--shiki-token-function` | `#6f42c1` |
| `--shiki-token-string-expression` | `#22863a` |
| `--shiki-token-punctuation` | `#212121` |
| `--shiki-token-link` | `#22863a` |

### Overlays (theme-invariant)

```
--color-overlay-dark-35:  rgba(0,0,0,0.35)
--color-overlay-dark-40:  rgba(0,0,0,0.4)
--color-overlay-dark-60:  rgba(0,0,0,0.6)
--color-overlay-light-25: rgba(255,255,255,0.25)
--color-overlay-light-35: rgba(255,255,255,0.35)
--color-overlay-light-50: rgba(255,255,255,0.5)
--color-overlay-light-80: rgba(255,255,255,0.8)
--color-overlay-light-90: rgba(255,255,255,0.9)
```

---

## Color System — Dark Theme (`:root[data-theme="dark"]`)

### Backgrounds

| Token | Value |
|-------|-------|
| `--color-bg-page` | `#0d1117` |
| `--color-bg-surface` | `#161b22` |
| `--color-bg-muted` | `#21262d` |
| `--color-bg-elevated` | `#1c2128` |

### Text

| Token | Value |
|-------|-------|
| `--color-text-primary` | `#e6edf3` |
| `--color-text-secondary` | `#8b949e` |
| `--color-text-muted` | `#6e7781` |
| `--color-text-inverse` | `#0d1117` |
| `--color-text-primary-rgb` | `230 237 243` |

### Accent

| Token | Value |
|-------|-------|
| `--color-accent` | `#a0a0a0` |
| `--color-accent-dark` | `#888888` |
| `--color-accent-soft` | `rgba(160,160,160,0.16)` |
| `--color-accent-rgb` | `160 160 160` |
| `--color-accent-tint` | `rgba(160,160,160,0.22)` |
| `--color-accent-tint-6` | `color-mix(in srgb, #a0a0a0 6%, transparent)` |
| `--color-accent-tint-8` | `color-mix(in srgb, #a0a0a0 8%, transparent)` |
| `--color-accent-tint-12` | `color-mix(in srgb, #a0a0a0 12%, transparent)` |
| `--color-accent-tint-18` | `color-mix(in srgb, #a0a0a0 18%, transparent)` |

### Links

| Token | Value |
|-------|-------|
| `--color-link` | `#a0a0a0` |
| `--color-link-hover` | `#d0d0d0` |

### Borders

| Token | Value |
|-------|-------|
| `--color-border` | `#30363d` |
| `--color-border-soft` | `rgba(230,237,243,0.08)` |
| `--color-border-subtle` | `rgba(230,237,243,0.16)` |
| `--color-border-strong` | `#484f58` |

### State Colors

| Token | Value |
|-------|-------|
| `--color-success` | `#3fb950` |
| `--color-warning` | `#d29922` |
| `--color-danger` | `#f85149` |
| `--color-note` | `#a371f7` |
| `--color-state-success-bg` | `rgba(46,160,67,0.16)` |
| `--color-state-success-text` | `#3fb950` |
| `--color-state-info-bg` | `rgba(88,166,255,0.16)` |
| `--color-state-info-text` | `#58a6ff` |

### Shadows (stronger for dark)

| Token | Value |
|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.3)` |
| `--shadow-sm` | `0 2px 4px rgba(0,0,0,0.35)` |
| `--shadow-md` | `0 4px 8px rgba(0,0,0,0.4)` |
| `--shadow-soft` | `0 10px 28px rgba(0,0,0,0.32)` |
| `--shadow-strong` | `0 24px 42px rgba(0,0,0,0.44)` |
| `--shadow-xl` | `0 24px 48px rgba(0,0,0,0.5)` |
| `--shadow-2xl` | `0 32px 64px rgba(0,0,0,0.6)` |
| `--shadow-button-hover` | `0 6px 20px rgba(160,160,160,0.2)` |
| `--shadow-lightbox` | `0 20px 60px rgba(0,0,0,0.6)` |

### Space Radio Palette (Dark)

| Token | Value |
|-------|-------|
| `--color-accent-warm` | `#b0b0b0` |
| `--color-accent-cool` | `#a0a0a0` |
| `--color-radio-dial` | `#e8c9a0` |
| `--color-radio-tube` | `#ffb366` |
| `--color-radio-grill` | `#4a6785` |
| `--color-space-cyan` | `#22e5ff` |
| `--color-space-purple` | `#c084fc` |
| `--color-space-blue` | `#60a5fa` |
| `--color-space-silver` | `#8b949e` |

### Glow (Dark)

| Token | Value |
|-------|-------|
| `--glow-accent-soft` | `0 0 20px rgba(160,160,160,0.2)` |
| `--glow-accent-strong` | `0 0 40px rgba(160,160,160,0.35)` |
| `--glow-cool` | `0 0 30px rgba(96,165,250,0.3)` |

### Gradients (Dark)

| Token | Value |
|-------|-------|
| `--gradient-warm-to-cool` | `linear-gradient(135deg, #a0a0a0 0%, #c0c0c0 100%)` |
| `--gradient-cosmic` | `linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)` |
| `--gradient-radio-glow` | `radial-gradient(ellipse at center, rgba(232,201,160,0.1) 0%, transparent 70%)` |
| `--gradient-bg-cosmic` | `radial-gradient(ellipse at top, rgba(129,140,248,0.08) 0%, transparent 50%)` |
| `--gradient-bg-radio` | `radial-gradient(ellipse at bottom, rgba(232,201,160,0.06) 0%, transparent 50%)` |

### Shiki (Dark)

| Token | Value |
|-------|-------|
| `--shiki-color-text` | `#d1d1d1` |
| `--shiki-token-constant` | `#79b8ff` |
| `--shiki-token-string` | `#ffab70` |
| `--shiki-token-comment` | `#6b737c` |
| `--shiki-token-keyword` | `#f97583` |
| `--shiki-token-parameter` | `#ff9800` |
| `--shiki-token-function` | `#b392f0` |
| `--shiki-token-string-expression` | `#4bb74a` |
| `--shiki-token-punctuation` | `#bbbbbb` |
| `--shiki-token-link` | `#ffab70` |

### Scrollbar & Backdrop (Dark)

```
--color-code-bg:      #161b22
--color-backdrop:     rgba(0,0,0,0.85)
--c-scrollbar:        #222
--c-scrollbar-hover:  #333
```
