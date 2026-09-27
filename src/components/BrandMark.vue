<script setup>
defineProps({ size: { type: Number, default: 22 } })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true" class="brand-mark">
    <rect width="64" height="64" rx="16" fill="var(--pp-invert-bg)" />
    <rect x="14" y="20" width="36" height="26" rx="5" fill="none" stroke="var(--pp-invert-fg)" stroke-width="4" />
    <circle cx="32" cy="33" r="7" fill="#ff5b3a" />
    <rect x="22" y="14" width="12" height="6" rx="2" fill="var(--pp-invert-fg)" />
  </svg>
</template>
