<script setup>
defineProps({
  mode: { type: String, default: 'frame' },
  size: { type: Number, default: 18 }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="mode === 'frame'">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M3.5 15l4.5-4 3.5 3 3-2.5 6 4.5" />
    </template>
    <template v-else-if="mode === 'desktop'">
      <rect x="4.5" y="4.5" width="15" height="10.5" rx="1.5" />
      <path d="M2 18.5h20l-1.2 1.5H3.2z" />
    </template>
    <template v-else-if="mode === 'mobile'">
      <rect x="7" y="2.5" width="10" height="19" rx="2.6" />
      <path d="M10.5 5h3" />
    </template>
    <template v-else>
      <rect x="2.5" y="3.5" width="19" height="12" rx="1" />
      <path d="M12 15.5v4M8 20.5h8" />
    </template>
  </svg>
</template>
