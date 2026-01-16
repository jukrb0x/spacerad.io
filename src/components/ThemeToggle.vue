<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

type Theme = 'light' | 'dark' | 'system';

const theme = ref<Theme>('system');

const resolvedTheme = computed(() => {
  if (theme.value === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return theme.value;
});

const iconClass = computed(() => {
  if (theme.value === 'system') return 'i-ph:monitor';
  return theme.value === 'dark' ? 'i-ph:moon' : 'i-ph:sun';
});

onMounted(() => {
  const stored = localStorage.getItem('theme') as Theme | null;
  if (stored) {
    theme.value = stored;
  }
  applyTheme();

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'system') {
      applyTheme();
    }
  });
});

function toggleTheme() {
  const modes: Theme[] = ['light', 'dark', 'system'];
  const idx = modes.indexOf(theme.value);
  theme.value = modes[(idx + 1) % modes.length];
  localStorage.setItem('theme', theme.value);
  applyTheme();
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', resolvedTheme.value);
}
</script>

<template>
  <button
    @click="toggleTheme"
    class="btn-ghost p-2 rounded-lg"
    :aria-label="`Theme: ${theme}`"
    :title="`Theme: ${theme}`"
  >
    <span :class="[iconClass, 'text-xl']"></span>
  </button>
</template>
