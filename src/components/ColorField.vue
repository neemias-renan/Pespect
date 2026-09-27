<script setup>
import { computed, ref, watch } from 'vue'
import { normalizeHex, oklchString } from '@/lib/color'

const props = defineProps({
  modelValue: { type: String, default: '#ffffff' },
  swatches: { type: Array, default: () => [] },
  showOklch: { type: Boolean, default: false },
  label: { type: String, default: 'Cor' }
})
const emit = defineEmits(['update:modelValue'])

const hex = ref(props.modelValue)
watch(() => props.modelValue, (v) => (hex.value = v))

const pickerValue = computed({
  get: () => (props.modelValue || '#ffffff').replace('#', ''),
  set: (v) => emit('update:modelValue', normalizeHex(`#${v}`, props.modelValue))
})

function commitHex() {
  const v = normalizeHex(hex.value, props.modelValue)
  hex.value = v
  if (v !== props.modelValue) emit('update:modelValue', v)
}
</script>

<template>
  <div class="color-field">
    <div class="row">
      <ColorPicker v-model="pickerValue" format="hex" :aria-label="label" />
      <InputText v-model="hex" class="hex pp-mono" maxlength="7" :aria-label="`${label} hex`" placeholder="000000" @keydown.enter="commitHex" @blur="commitHex" />
      <span v-if="showOklch" class="oklch pp-mono" v-tooltip.top="'OKLCH'">{{ oklchString(modelValue) }}</span>
    </div>
    <div v-if="swatches.length" class="swatches">
      <button
        v-for="c in swatches"
        :key="c"
        class="pp-swatch"
        :class="{ 'is-active': c.toLowerCase() === modelValue?.toLowerCase() }"
        :style="{ background: c }"
        :aria-label="c"
        @click="emit('update:modelValue', c)"
      />
    </div>
  </div>
</template>

<style scoped>
.color-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hex {
  width: 92px;
  padding: 0.35rem 0.5rem !important;
  font-size: 12px !important;
}
.oklch {
  font-size: 10px;
  color: var(--pp-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.swatches .pp-swatch {
  width: 22px;
  height: 22px;
  border-radius: 7px;
}
</style>
