<script setup>
import { computed } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import { LENSES, ZOOM_LIMITS, apertureLabel } from '@/lib/defaults'

const projects = useProjectsStore()
const ui = useUiStore()
const lens = computed(() => projects.current.look.lens)
const shot = computed(() => projects.activeShot)

const focal = computed({
  get: () => lens.value.focal,
  set: (v) => {
    if (!v) return
    lens.value.focal = v
    ui.click('toggle', 0.3)
  }
})

function set(key, value) {
  projects.updateActiveShot({ [key]: value })
}

function autoFocus() {
  projects.updateActiveShot({ focusPoint: null })
  projects.current.look.focusMode = 'auto'
  ui.focusPicking = false
}

const cameraFields = [
  { key: 'rotateX', label: 'Girar X', min: -89, max: 89, step: 1, unit: '°' },
  { key: 'rotateY', label: 'Girar Y', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'rotateZ', label: 'Girar Z', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'offsetX', label: 'Mover X', min: -1.5, max: 1.5, step: 0.01, unit: '' },
  { key: 'offsetY', label: 'Mover Y', min: -1.5, max: 1.5, step: 0.01, unit: '' }
]

function fmt(v, step) {
  return step < 1 ? Number(v).toFixed(2) : Math.round(v)
}
</script>

<template>
  <div>
    <div class="pp-section-title"><span class="pp-label">Lente</span></div>
    <div class="pp-field">
      <label>Distância focal</label>
      <SelectButton v-model="focal" :options="LENSES" option-label="label" option-value="value" :allow-empty="false" class="focal" />
    </div>

    <template v-if="shot">
      <div class="pp-field">
        <div class="pp-field-row"><label>Abertura</label><span class="pp-value">ƒ{{ apertureLabel(shot.blur) }}</span></div>
        <Slider :model-value="shot.blur" :min="0" :max="100" @update:model-value="(v) => set('blur', v)" />
      </div>
      <div class="pp-field">
        <label>Foco</label>
        <div class="flex gap-2">
          <Button label="Auto" size="small" :severity="shot.focusPoint ? 'secondary' : undefined" class="flex-1" @click="autoFocus" />
          <Button :label="ui.focusPicking ? 'Clique no palco…' : 'Clique para focar'" icon="pi pi-bullseye" size="small" :severity="shot.focusPoint ? undefined : 'secondary'" class="flex-1" @click="ui.focusPicking = !ui.focusPicking" />
        </div>
      </div>
    </template>

    <div class="pp-field">
      <div class="pp-field-row"><label>Exposição</label><span class="pp-value">{{ lens.exposure > 0 ? '+' : '' }}{{ lens.exposure.toFixed(1) }} EV</span></div>
      <Slider v-model="lens.exposure" :min="-2" :max="2" :step="0.1" />
    </div>
    <div class="pp-field">
      <div class="pp-field-row"><label>Aberração cromática</label><span class="pp-value">{{ lens.chromatic }}</span></div>
      <Slider v-model="lens.chromatic" :min="0" :max="100" />
    </div>
    <div class="pp-field">
      <div class="pp-field-row"><label>Vinheta</label><span class="pp-value">{{ lens.vignette }}</span></div>
      <Slider v-model="lens.vignette" :min="0" :max="100" />
    </div>
    <div class="pp-field">
      <div class="pp-field-row"><label>Granulação</label><span class="pp-value">{{ lens.grain }}</span></div>
      <Slider v-model="lens.grain" :min="0" :max="100" />
    </div>

    <template v-if="shot">
      <Divider />
      <div class="pp-section-title">
        <span class="pp-label">Câmera{{ projects.mode === 'video' ? ` · ${projects.editingLabel}` : '' }}</span>
        <button class="pp-icon-btn" @click="projects.resetShot()"><i class="pi pi-replay" /> Redefinir enquadramento</button>
      </div>
      <div v-for="f in cameraFields" :key="f.key" class="pp-field">
        <div class="pp-field-row"><label>{{ f.label }}</label><span class="pp-value">{{ fmt(shot[f.key], f.step) }}{{ f.unit }}</span></div>
        <Slider :model-value="shot[f.key]" :min="f.min" :max="f.max" :step="f.step" @update:model-value="(v) => set(f.key, v)" />
      </div>
      <div class="pp-field">
        <div class="pp-field-row"><label>Zoom</label><span class="pp-value">{{ shot.zoom.toFixed(2) }}×</span></div>
        <Slider :model-value="shot.zoom" :min="ZOOM_LIMITS.min" :max="ZOOM_LIMITS.max" :step="0.01" @update:model-value="(v) => set('zoom', v)" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.focal :deep(.p-button) {
  font-size: 11px !important;
  padding: 0.38rem 0.1rem !important;
}
</style>
