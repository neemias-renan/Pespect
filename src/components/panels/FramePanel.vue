<script setup>
import { computed } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import { DEVICES, FRAME_CORNER_RADIUS_STEPS, FRAME_BORDER_WIDTH_STEPS } from '@/lib/defaults'
import DeviceIcon from '../DeviceIcon.vue'
import ColorField from '../ColorField.vue'
import ScreenSource from '../ScreenSource.vue'

const projects = useProjectsStore()
const ui = useUiStore()
const look = computed(() => projects.current.look)
const frame = computed(() => look.value.frame)

const screenAssetId = computed(() => {
  if (projects.mode === 'photo') return projects.current.activeAssetId
  const s = projects.selectedScene
  return s?.type === 'shot' ? s.assetId : null
})

const roundingOptions = FRAME_CORNER_RADIUS_STEPS.map((s) => ({ label: s.label, value: s.value }))
const borderOptions = [{ label: 'Nenhuma', value: 0 }, ...FRAME_BORDER_WIDTH_STEPS.map((s) => ({ label: s.label, value: s.value }))]

const border = computed({
  get: () => (frame.value.border ? frame.value.borderWidth : 0),
  set: (v) => {
    if (v === null || v === undefined) return
    frame.value.border = v > 0
    if (v > 0) frame.value.borderWidth = v
    ui.click('toggle', 0.3)
  }
})

const rounding = computed({
  get: () => frame.value.rounding,
  set: (v) => {
    if (v === null || v === undefined) return
    frame.value.rounding = v
    ui.click('toggle', 0.3)
  }
})

function pickDevice(mode) {
  ui.click('toggle', 0.3)
  projects.setDevice(mode)
}
</script>

<template>
  <div>
    <div class="pp-section-title"><span class="pp-label">Tela</span></div>
    <ScreenSource v-if="projects.mode === 'photo' || screenAssetId" :asset-id="screenAssetId" />

    <div class="pp-section-title"><span class="pp-label">Dispositivo</span></div>
    <div class="devices">
      <button
        v-for="d in DEVICES"
        :key="d.mode"
        class="device"
        :class="{ active: look.device === d.mode }"
        :aria-pressed="look.device === d.mode"
        @click="pickDevice(d.mode)"
      >
        <DeviceIcon :mode="d.mode" :size="22" />
        <span>{{ d.label }}</span>
      </button>
    </div>

    <div v-if="look.device !== 'frame'" class="pp-field">
      <label>Acabamento</label>
      <SelectButton v-model="look.finish" :options="[{ label: 'Prata', value: 'silver' }, { label: 'Preto espacial', value: 'dark' }]" option-label="label" option-value="value" :allow-empty="false" />
    </div>

    <template v-if="look.device === 'frame'">
      <div class="pp-field">
        <label>Arredondamento</label>
        <SelectButton v-model="rounding" :options="roundingOptions" option-label="label" option-value="value" :allow-empty="false" />
      </div>
      <div class="pp-field">
        <label>Borda</label>
        <SelectButton v-model="border" :options="borderOptions" option-label="label" option-value="value" :allow-empty="false" />
        <ColorField v-if="frame.border" v-model="frame.borderColor" label="Cor da borda" :swatches="['#ffffff', '#e4e4e7', '#71717a', '#18181b', '#000000', '#ff5b3a']" />
      </div>
      <div class="pp-field">
        <div class="pp-field-row"><label>Margem interna</label><span class="pp-value">{{ frame.padding }}</span></div>
        <Slider v-model="frame.padding" :min="0" :max="100" />
        <ColorField v-if="frame.padding > 0" v-model="frame.paddingColor" label="Cor da margem" :swatches="['#ffffff', '#f4f4f5', '#e8e2d6', '#18181b', '#0b0b0d', '#ff5b3a']" />
      </div>
    </template>

    <div v-if="look.device === 'desktop'" class="pp-field">
      <div class="pp-field-row"><label>Tampa</label><span class="pp-value">{{ look.lid }}</span></div>
      <Slider v-model="look.lid" :min="0" :max="100" />
    </div>

    <div v-if="look.device === 'display'" class="pp-field">
      <div class="pp-field-row"><label>Altura</label><span class="pp-value">{{ look.displayHeight }}</span></div>
      <Slider v-model="look.displayHeight" :min="0" :max="100" />
    </div>

    <div class="pp-field">
      <div class="pp-field-row"><label>Brilho</label><span class="pp-value">{{ look.brightness }}%</span></div>
      <Slider v-model="look.brightness" :min="20" :max="160" :step="5" />
    </div>

    <div class="pp-field">
      <div class="pp-field-row"><label>Sombra</label><span class="pp-value">{{ look.shadow }}</span></div>
      <Slider v-model="look.shadow" :min="0" :max="100" />
    </div>

    <div class="pp-field-row switch-row">
      <label>Reflexos</label>
      <InputSwitch v-model="look.reflections" @change="ui.click('toggle', 0.3)" />
    </div>
  </div>
</template>

<style scoped>
.devices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 18px;
}
.device {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 14px 6px 11px;
  border-radius: 12px;
  border: 1px solid var(--pp-border);
  background: rgba(var(--pp-fg-rgb), 0.03);
  color: var(--pp-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.device:hover {
  color: var(--pp-text);
  background: rgba(var(--pp-fg-rgb), 0.06);
}
.device.active {
  color: var(--pp-strong);
  border-color: rgba(var(--pp-fg-rgb), 0.5);
  background: rgba(var(--pp-fg-rgb), 0.09);
}
.switch-row {
  margin: 4px 0 8px;
}
</style>
