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
      background: 'var(--color-background)',
      surface: 'var(--color-surface)',
      border: 'var(--color-border)',
      muted: 'var(--color-muted)',
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
  },
  shortcuts: {
    'btn': 'px-4 py-2 rounded-lg font-medium transition-colors duration-200',
    'btn-primary': 'btn bg-accent text-white hover:bg-accent/90',
    'btn-ghost': 'btn hover:bg-surface',
    'link': 'text-accent hover:underline',
    'card': 'bg-surface border border-border rounded-xl p-6',
    'container': 'mx-auto max-w-4xl px-4 sm:px-6',
    'prose-content': 'prose prose-neutral dark:prose-invert max-w-none',
  },
});
