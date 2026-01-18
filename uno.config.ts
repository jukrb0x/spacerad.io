import { defineConfig, presetWebFonts, transformerDirectives, transformerVariantGroup } from 'unocss';
import presetWind3 from '@unocss/preset-wind3';

export default defineConfig({
  presets: [
    presetWind3(),
    presetWebFonts({
      fonts: {
        sans: 'Inter:400,500,600,700',
        mono: 'Fira Code:400,500'
      }
    })
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],

  // Dark mode using data-theme attribute
  variants: [
    (matcher) => {
      if (!matcher.startsWith('dark:')) return matcher;
      return {
        matcher: matcher.slice(5),
        selector: (s) => `[data-theme="dark"] ${s}`
      };
    }
  ],

  // Theme colors mapped to CSS variables
  theme: {
    colors: {
      // Background colors
      page: 'var(--color-bg-page)',
      surface: 'var(--color-bg-surface)',
      muted: 'var(--color-bg-muted)',

      // Text colors
      primary: 'var(--color-text-primary)',
      secondary: 'var(--color-text-secondary)',
      'text-muted': 'var(--color-text-muted)',
      inverse: 'var(--color-text-inverse)',

      // Accent colors
      accent: {
        DEFAULT: 'var(--color-accent)',
        dark: 'var(--color-accent-dark)',
        soft: 'var(--color-accent-soft)',
        tint: 'var(--color-accent-tint)'
      },

      // Link colors
      link: {
        DEFAULT: 'var(--color-link)',
        hover: 'var(--color-link-hover)'
      },

      // Border colors
      border: {
        DEFAULT: 'var(--color-border)',
        soft: 'var(--color-border-soft)',
        subtle: 'var(--color-border-subtle)',
        strong: 'var(--color-border-strong)'
      },

      // State colors
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      danger: 'var(--color-danger)',
      note: 'var(--color-note)',

      // Code
      'code-bg': 'var(--color-code-bg)'
    },
    borderRadius: {
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)'
    },
    boxShadow: {
      soft: 'var(--shadow-soft)',
      strong: 'var(--shadow-strong)',
      lightbox: 'var(--shadow-lightbox)',
      'button-hover': 'var(--shadow-button-hover)'
    }
  },

  // Shortcuts for common patterns
  shortcuts: {
    // Focus states
    'focus-accent': 'outline-none focus-visible:(outline-2 outline-accent-soft outline-offset-2)',

    // Transitions
    'transition-interactive': 'transition-[color,background-color,border-color] duration-200 ease-out',
    'transition-fast': 'transition-all duration-150 ease-out',
    'transition-base': 'transition-all duration-200 ease-out',
    'transition-slow': 'transition-all duration-300 ease-out',

    // Icon button
    'icon-btn':
      'inline-flex items-center justify-center bg-transparent text-secondary cursor-pointer transition-interactive hover:text-accent',
    'icon-btn-xs': 'w-8 h-8',
    'icon-btn-sm': 'w-10 h-10',
    'icon-btn-md': 'w-12 h-12',
    'icon-btn-round': 'rounded-full',
    'icon-btn-square': 'rounded-md',
    'icon-btn-bordered': 'border border-border-soft',

    // Pill/tag
    pill: 'inline-flex items-center px-3 py-1 text-sm rounded-full bg-accent-tint text-accent border border-transparent transition-interactive hover:(bg-accent text-inverse)',

    // Surface card
    'surface-card': 'bg-surface rounded-lg border border-border-subtle shadow-soft',
    'surface-card-hover': 'hover:(border-accent shadow-strong)',

    // Page shell (main container)
    'page-shell': 'max-w-[72rem] mx-auto px-4 py-8 sm:px-6'
  },

  // Safe list for dynamic classes
  safelist: [
    'prose',
    'toc',
    'lightbox',
    'scroll-locked',
    // Animation classes
    'animate-pop',
    'animate-shake'
  ],

  // Rules for custom utilities
  rules: [
    // Measure (max-width for reading)
    ['measure', { 'max-width': '68ch' }],
    ['measure-wide', { 'max-width': '72ch' }],

    // Font sizes from tokens
    ['text-xs', { 'font-size': 'var(--font-size-xs)' }],
    ['text-sm', { 'font-size': 'var(--font-size-sm)' }],
    ['text-base', { 'font-size': 'var(--font-size-base)' }],
    ['text-lg', { 'font-size': 'var(--font-size-lg)' }],
    ['text-xl', { 'font-size': 'var(--font-size-xl)' }],
    ['text-2xl', { 'font-size': 'var(--font-size-2xl)' }],
    ['text-3xl', { 'font-size': 'var(--font-size-3xl)' }],

    // Line heights
    ['leading-base', { 'line-height': 'var(--line-height-base)' }],
    ['leading-relaxed', { 'line-height': 'var(--line-height-relaxed)' }],
    ['leading-tight', { 'line-height': 'var(--line-height-tight)' }],

    // Spacing from tokens
    ['space-1', { gap: 'var(--space-1)' }],
    ['space-2', { gap: 'var(--space-2)' }],
    ['space-3', { gap: 'var(--space-3)' }],
    ['space-4', { gap: 'var(--space-4)' }],
    ['space-6', { gap: 'var(--space-6)' }],
    ['space-8', { gap: 'var(--space-8)' }],
    ['space-12', { gap: 'var(--space-12)' }]
  ]
});
