<script setup>
import { nextTick, ref } from 'vue'
import { playSound } from '@/lib/sound'
import { clamp } from '@/lib/util'

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Number, default: 0 },
  step: { type: Number, default: 1 },
  min: { type: Number, default: -Infinity },
  max: { type: Number, default: Infinity },
  suffix: { type: String, default: '°' },
  precision: { type: Number, default: 0 },
  speed: { type: Number, default: 0.35 },
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const editing = ref(false)
const draft = ref('')
const input = ref()
const scrubbing = ref(false)
let start = null

function format(v) {
  return Number(v || 0).toFixed(props.precision).replace(/^-0(\.0+)?$/, '0')
}

function set(v) {
  const next = clamp(Number(v.toFixed(Math.max(props.precision, 3))), props.min, props.max)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function nudge(dir, e) {
  const mult = e?.shiftKey ? 10 : e?.altKey ? 0.1 : 1
  set((props.modelValue || 0) + dir * props.step * mult)
  playSound('tick', 0.2)
}

function onPointerDown(e) {
  if (props.disabled || editing.value) return
  start = { x: e.clientX, value: props.modelValue || 0, moved: false, last: 0 }
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onPointerMove(e) {
  if (!start) return
  const dx = e.clientX - start.x
  if (Math.abs(dx) > 2) {
    start.moved = true
    scrubbing.value = true
  }
  if (!start.moved) return
  const mult = e.shiftKey ? 4 : e.altKey ? 0.25 : 1
  const raw = start.value + dx * props.speed * props.step * mult
  const snapped = Math.round(raw / props.step) * props.step
  set(props.step < 1 ? raw : snapped)
  const tick = Math.round(dx / 10)
  if (tick !== start.last) {
    start.last = tick
    playSound('tick', 0.15)
  }
}

async function onPointerUp(e) {
  if (!start) return
  const wasMoved = start.moved
  start = null
  scrubbing.value = false
  try {
    e.currentTarget.releasePointerCapture(e.pointerId)
  } catch {
    // ignore
  }
  if (!wasMoved && !props.disabled) {
    draft.value = format(props.modelValue)
    editing.value = true
    await nextTick()
    input.value?.focus()
    input.value?.select()
  }
}

function commit() {
  if (!editing.value) return
  editing.value = false
  const v = parseFloat(String(draft.value).replace(',', '.'))
  if (Number.isFinite(v)) set(v)
}
</script>

<template>
  <div class="scrub" :class="{ disabled, scrubbing }" v-tooltip.top="hint || `Arraste para ajustar ${label} · clique para digitar`">
    <button class="arrow" :disabled="disabled" :aria-label="`Diminuir ${label}`" @click="nudge(-1, $event)">‹</button>
    <div
      class="scrub-body"
      role="slider"
      :aria-label="label"
      :aria-valuenow="modelValue"
      tabindex="0"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @keydown.left.prevent="nudge(-1, $event)"
      @keydown.right.prevent="nudge(1, $event)"
    >
      <span class="scrub-label">{{ label }}</span>
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="scrub-input"
        inputmode="decimal"
        @keydown.enter="commit"
        @keydown.esc="editing = false"
        @blur="commit"
      />
      <span v-else class="scrub-value">{{ format(modelValue) }}<small>{{ suffix }}</small></span>
    </div>
    <button class="arrow" :disabled="disabled" :aria-label="`Aumentar ${label}`" @click="nudge(1, $event)">›</button>
  </div>
</template>

<style scoped>
.scrub {
  display: inline-flex;
  align-items: center;
  height: 36px;
  border-radius: 10px;
  background: rgba(var(--pp-fg-rgb), 0.045);
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.scrub:hover:not(.disabled),
.scrub.scrubbing {
  background: rgba(var(--pp-fg-rgb), 0.08);
  border-color: var(--pp-border);
}
.scrub.disabled {
  opacity: 0.35;
}
.arrow {
  width: 18px;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--pp-muted);
  font-size: 16px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  padding: 0;
}
.scrub:hover .arrow:not(:disabled) {
  opacity: 1;
}
.arrow:hover {
  color: var(--pp-strong);
}
.scrub-body {
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  padding: 0 2px;
  cursor: ew-resize;
  user-select: none;
  touch-action: none;
  outline: none;
}
.disabled .scrub-body {
  cursor: default;
}
.scrub-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--pp-muted);
}
.scrub-value {
  min-width: 38px;
  font-family: var(--pp-mono);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 500;
  text-align: right;
}
.scrub-value small {
  color: var(--pp-muted);
  font-size: 11px;
  margin-left: 1px;
}
.scrub-input {
  width: 46px;
  background: rgba(var(--pp-fg-rgb), 0.08);
  border: 1px solid var(--pp-border-strong);
  border-radius: 6px;
  color: var(--pp-text);
  font-family: var(--pp-mono);
  font-size: 12px;
  padding: 2px 4px;
  outline: none;
}
</style>
