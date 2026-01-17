import { defineConfig, presetUno, presetIcons, transformerDirectives } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      collections: {
        ph: () => import('@iconify-json/ph/icons.json').then((i) => i.default),
      },
    }),
  ],
  transformers: [transformerDirectives()],
  theme: {
    colors: {
      primary: 'var(--color-primary)',
      secondary: 'var(--color-secondary)',
      accent: 'var(--color-accent)',
      'accent-dim': 'var(--color-accent-dim)',
      background: 'var(--color-background)',
      surface: 'var(--color-surface)',
      'surface-elevated': 'var(--color-surface-elevated)',
      border: 'var(--color-border)',
      muted: 'var(--color-muted)',
      // Neon colors
      'neon-cyan': 'var(--color-neon-cyan)',
      'neon-magenta': 'var(--color-neon-magenta)',
      'neon-yellow': 'var(--color-neon-yellow)',
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
  },
  shortcuts: {
    // Base components
    'btn': 'px-4 py-2 rounded-lg font-medium transition-all duration-200',
    'btn-primary': 'btn bg-accent text-background font-mono tracking-wide hover:shadow-[0_0_20px_var(--color-accent-glow)] hover:brightness-110',
    'btn-ghost': 'btn hover:bg-surface-elevated hover:text-accent',
    'link': 'text-accent hover:text-neon-cyan hover:underline transition-colors',

    // Cards
    'card': 'bg-surface border border-border rounded-xl p-6 transition-all duration-300',
    'card-neon': 'card hover:border-accent hover:shadow-[0_0_15px_rgba(0,212,255,0.15)]',

    // Container
    'container': 'mx-auto max-w-4xl px-4 sm:px-6',
    'prose-content': 'prose prose-neutral dark:prose-invert max-w-none',

    // Neon effects
    'neon-glow': 'shadow-[0_0_20px_var(--color-accent-glow)]',
    'hover-glow-icon': 'hover:text-accent hover:[filter:drop-shadow(0_0_8px_var(--color-accent-glow))] transition-all duration-300',
  },
});
