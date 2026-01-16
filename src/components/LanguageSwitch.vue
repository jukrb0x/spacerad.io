<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  currentLang: 'en' | 'zh';
  currentPath: string;
}>();

const alternateUrl = computed(() => {
  if (props.currentLang === 'en') {
    return `/zh${props.currentPath === '/' ? '' : props.currentPath}`;
  }
  return props.currentPath || '/';
});

const label = computed(() => {
  return props.currentLang === 'en' ? '中文' : 'EN';
});
</script>

<template>
  <a
    :href="alternateUrl"
    class="btn-ghost px-3 py-2 rounded-lg text-sm font-medium"
    :aria-label="`Switch to ${currentLang === 'en' ? 'Chinese' : 'English'}`"
  >
    {{ label }}
  </a>
</template>
