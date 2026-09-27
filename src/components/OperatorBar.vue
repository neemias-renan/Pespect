<script setup>
import { computed, ref } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import { LENSES, RATIOS, ZOOM_LIMITS, apertureLabel } from '@/lib/defaults'
import ScrubValue from './ScrubValue.vue'

const projects = useProjectsStore()
const ui = useUiStore()

const aperturePanel = ref()
const zoomPanel = ref()
const lensMenu = ref()
const ratioMenu = ref()

const project = computed(() => projects.current)
const shot = computed(() => projects.activeShot)
const disabled = computed(() => !shot.value)
const isVideo = computed(() => projects.mode === 'video')
const selected = computed(() => projects.selectedScene)

function update(key, value) {
  projects.updateActiveShot({ [key]: value })
}

const af = computed(() => !shot.value?.focusPoint)

function toggleAF() {
  if (!shot.value) return
  ui.click('toggle', 0.3)
  if (shot.value.focusPoint) {
    projects.updateActiveShot({ focusPoint: null })
    project.value.look.focusMode = 'auto'
    ui.focusPicking = false
  } else {
    ui.focusPicking = !ui.focusPicking
  }
}

const lensItems = computed(() =>
  LENSES.map((l) => ({
    label: `${l.label}${l.value === project.value?.look.lens.focal ? '  ✓' : ''}`,
    command: () => {
      project.value.look.lens.focal = l.value
      ui.click('toggle', 0.3)
    }
  }))
)

const ratioItems = computed(() =>
  RATIOS.map((r) => ({
    label: `${r.label}${r.value === project.value?.ratio ? '  ✓' : ''}`,
    command: () => {
      projects.setRatio(r.value)
      ui.click('toggle', 0.3)
    }
  }))
)

const keyIndex = computed(() => projects.selectedKeys.findIndex((k) => k.id === projects.editingKey))

function step(dir) {
  ui.click('toggle', 0.3)
  projects.stepKey(dir)
}

function addPosition() {
  projects.addPosition()
  ui.click('release', 0.28)
}
</script>

<template>
  <div class="operator-wrap">
    <div class="operator pp-glass" :class="{ 'is-disabled': disabled }" role="toolbar" aria-label="Operador">
      <template v-if="isVideo && selected?.type === 'shot'">
        <div class="keyframes" role="group" aria-label="Posição da câmera">
          <button class="kbtn" aria-label="Posição anterior" :disabled="keyIndex <= 0" @click="step(-1)">‹</button>
          <span class="klabel" v-tooltip.top="'Posição da câmera em edição'">{{ projects.editingLabel }}</span>
          <button class="kbtn" aria-label="Próxima posição" :disabled="keyIndex >= projects.selectedKeys.length - 1" @click="step(1)">›</button>
          <button class="kbtn add" aria-label="Adicionar posição" v-tooltip.top="'Adicionar posição no cursor'" @click="addPosition"><i class="pi pi-plus" /></button>
        </div>
        <span class="sep" />
      </template>

      <template v-if="shot">
        <ScrubValue label="X" :model-value="shot.rotateX" :min="-89" :max="89" @update:model-value="(v) => update('rotateX', v)" />
        <ScrubValue label="Y" :model-value="shot.rotateY" :min="-180" :max="180" @update:model-value="(v) => update('rotateY', v)" />
        <ScrubValue label="Z" :model-value="shot.rotateZ" :min="-180" :max="180" @update:model-value="(v) => update('rotateZ', v)" />
        <span class="sep" />
        <button class="op-btn" :class="{ active: af && !ui.focusPicking, picking: ui.focusPicking }" @click="toggleAF" v-tooltip.top="af ? 'Foco automático · clique e depois clique no palco para definir o foco' : 'Foco manual · clique para voltar ao automático'">
          {{ af ? 'AF' : 'MF' }}
        </button>
        <button class="op-btn" @click="(e) => aperturePanel.toggle(e)" v-tooltip.top="'Abertura (profundidade de campo)'">
          <span class="f">ƒ</span>{{ apertureLabel(shot.blur) }}
        </button>
        <button class="op-btn" @click="(e) => zoomPanel.toggle(e)" v-tooltip.top="'Zoom'">{{ shot.zoom >= 10 ? shot.zoom.toFixed(0) : shot.zoom.toFixed(shot.zoom % 1 ? 1 : 0) }}×</button>
        <span class="sep" />
      </template>
      <div v-else class="op-note">
        <i class="pi pi-info-circle" />
        {{ selected ? (selected.type === 'text' ? 'Cena de texto · edite no painel' : 'Cena de logo · edite no painel') : 'Selecione uma cena' }}
      </div>

      <button class="op-btn" @click="(e) => lensMenu.toggle(e)" v-tooltip.top="'Distância focal da lente'">
        <span class="f">L</span>{{ project?.look.lens.focal }}
      </button>
      <button class="op-btn" @click="(e) => ratioMenu.toggle(e)" v-tooltip.top="'Proporção'">{{ project?.ratio }}</button>
      <button v-if="shot" class="op-btn icon" aria-label="Redefinir enquadramento" @click="projects.resetShot()" v-tooltip.top="'Redefinir enquadramento (clique duplo no palco)'">
        <i class="pi pi-replay" />
      </button>
    </div>

    <Menu ref="lensMenu" :model="lensItems" popup />
    <Menu ref="ratioMenu" :model="ratioItems" popup />

    <OverlayPanel ref="aperturePanel">
      <div v-if="shot" class="pop">
        <div class="pp-field-row">
          <label>Abertura</label>
          <span class="pp-value">ƒ{{ apertureLabel(shot.blur) }}</span>
        </div>
        <Slider :model-value="shot.blur" :min="0" :max="100" @update:model-value="(v) => update('blur', v)" />
        <div class="pop-scale"><span>ƒ16 · nítido</span><span>ƒ1.2 · desfocado</span></div>
        <Button :label="af ? 'Clique para definir o foco' : 'Usar foco automático'" size="small" severity="secondary" class="w-full mt-3" @click="toggleAF" />
      </div>
    </OverlayPanel>

    <OverlayPanel ref="zoomPanel">
      <div v-if="shot" class="pop">
        <div class="pp-field-row">
          <label>Zoom</label>
          <span class="pp-value">{{ shot.zoom.toFixed(2) }}×</span>
        </div>
        <Slider :model-value="shot.zoom" :min="ZOOM_LIMITS.min" :max="ZOOM_LIMITS.max" :step="0.01" @update:model-value="(v) => update('zoom', v)" />
        <div class="flex gap-2 mt-3">
          <Button label="Afastar" icon="pi pi-search-minus" size="small" severity="secondary" class="flex-1" @click="update('zoom', Math.max(ZOOM_LIMITS.min, shot.zoom / 1.2))" />
          <Button label="Aproximar" icon="pi pi-search-plus" size="small" severity="secondary" class="flex-1" @click="update('zoom', Math.min(ZOOM_LIMITS.max, shot.zoom * 1.2))" />
        </div>
        <Button label="Ajustar (1×)" size="small" text class="w-full mt-2" @click="update('zoom', 1)" />
      </div>
    </OverlayPanel>
  </div>
</template>

<style scoped>
.operator-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 20px;
  display: flex;
  justify-content: center;
  pointer-events: none;
  padding: 0 12px;
  z-index: 4;
}
.operator {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 16px;
  max-width: 100%;
  overflow-x: auto;
}
.sep {
  width: 1px;
  height: 22px;
  background: var(--pp-border-strong);
  margin: 0 4px;
  flex-shrink: 0;
}
.op-btn {
  height: 36px;
  min-width: 40px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: rgba(var(--pp-fg-rgb), 0.045);
  color: var(--pp-text);
  font-family: var(--pp-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.op-btn:hover {
  background: rgba(var(--pp-fg-rgb), 0.09);
  border-color: var(--pp-border);
}
.op-btn:active {
  transform: scale(0.94);
}
.op-btn.active {
  color: var(--pp-af);
}
.op-btn.picking {
  background: #ffd84d;
  color: #111;
}
.op-btn.icon .pi {
  font-size: 13px;
}
.f {
  font-style: italic;
  color: var(--pp-muted);
  font-family: Georgia, serif;
  margin-right: 1px;
}
.keyframes {
  display: flex;
  background: rgba(var(--pp-fg-rgb), 0.05);
  border-radius: 10px;
  padding: 2px;
  flex-shrink: 0;
}
.keyframes {
  align-items: center;
}
.kbtn {
  width: 24px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--pp-muted);
  font-size: 16px;
  cursor: pointer;
}
.kbtn:hover:not(:disabled) {
  color: var(--pp-text);
  background: rgba(var(--pp-fg-rgb), 0.08);
}
.kbtn:disabled {
  opacity: 0.3;
  cursor: default;
}
.kbtn.add .pi {
  font-size: 11px;
}
.klabel {
  min-width: 52px;
  height: 28px;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--pp-invert-bg);
  color: var(--pp-invert-fg);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  display: grid;
  place-items: center;
}
.op-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--pp-muted);
  height: 36px;
  white-space: nowrap;
}
.pop {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pop-scale {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--pp-muted);
}
</style>
