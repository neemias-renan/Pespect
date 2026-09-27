<script setup>
import { computed } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import { useMedia } from '@/composables/useMedia'
import { BACKDROP_COLORS, BACKDROP_GRADIENTS } from '@/lib/defaults'
import { autoBackdropFrom } from '@/lib/color'
import ColorField from '../ColorField.vue'

const projects = useProjectsStore()
const library = useLibraryStore()
const ui = useUiStore()
const { pickFiles } = useMedia()

const backdrop = computed(() => projects.current.look.backdrop)
const types = [
  { label: 'Auto', value: 'auto' },
  { label: 'Cor', value: 'color' },
  { label: 'Gradiente', value: 'gradient' },
  { label: 'Imagem', value: 'image' },
  { label: 'Nenhum', value: 'transparent' }
]

const type = computed({
  get: () => backdrop.value.type,
  set: (v) => {
    if (!v) return
    ui.click('toggle', 0.3)
    backdrop.value.type = v
    if (v === 'image' && !backdrop.value.imageAssetId) ui.openLibrary('backdrop')
  }
})

const autoColor = computed(() => {
  const p = projects.current
  const id = p.mode === 'photo' ? p.activeAssetId : projects.selectedScene?.assetId || p.activeAssetId
  return autoBackdropFrom(library.get(id)?.dominant || '#2a2a2e')
})

const image = computed(() => library.get(backdrop.value.imageAssetId))

function gradientCss(g) {
  return `linear-gradient(${g.angle}deg, ${g.stops.join(', ')})`
}
</script>

<template>
  <div>
    <div class="pp-section-title"><span class="pp-label">Fundo</span></div>
    <div class="pp-field">
      <SelectButton v-model="type" :options="types" option-label="label" option-value="value" :allow-empty="false" class="types" />
    </div>

    <div v-if="backdrop.type === 'auto'" class="auto">
      <span class="auto-swatch" :style="{ background: autoColor }" />
      <div>
        <strong>Fundo detectado automaticamente</strong>
        <p class="pp-muted">Escolhido a partir das cores da sua tela. Troque para Cor para ajustar.</p>
      </div>
    </div>

    <div v-else-if="backdrop.type === 'color'" class="pp-field">
      <ColorField v-model="backdrop.color" :swatches="BACKDROP_COLORS" show-oklch label="Cor do fundo" />
    </div>

    <div v-else-if="backdrop.type === 'gradient'" class="gradients">
      <button
        v-for="g in BACKDROP_GRADIENTS"
        :key="g.id"
        class="gradient"
        :class="{ active: backdrop.gradient === g.id }"
        :style="{ background: gradientCss(g) }"
        :aria-label="g.label"
        @click="backdrop.gradient = g.id"
      >
        <span>{{ g.label }}</span>
      </button>
    </div>

    <template v-else-if="backdrop.type === 'image'">
      <div class="image-preview" :style="image ? { backgroundImage: `url(${image.thumbnail})` } : null">
        <span v-if="!image" class="pp-muted">Nenhuma imagem selecionada</span>
      </div>
      <div class="flex gap-2 mb-3">
        <Button label="Escolher imagem" icon="pi pi-images" size="small" severity="secondary" class="flex-1" @click="ui.openLibrary('backdrop')" />
        <Button label="Enviar" icon="pi pi-upload" size="small" severity="secondary" class="flex-1" @click="pickFiles({ purpose: 'backdrop', multiple: false, accept: 'image/*' })" />
      </div>
      <div class="pp-field">
        <div class="pp-field-row"><label>Desfoque</label><span class="pp-value">{{ backdrop.blur }}</span></div>
        <Slider v-model="backdrop.blur" :min="0" :max="100" />
      </div>
    </template>

    <div v-else class="auto">
      <span class="auto-swatch checkerboard" />
      <div>
        <strong>Transparente</strong>
        <p class="pp-muted">Capturas em PNG e WEBP mantêm a transparência. A profundidade de campo fica desligada enquanto o fundo é transparente.</p>
      </div>
    </div>

    <Divider />
    <div class="pp-field">
      <div class="pp-field-row"><label>Sombra no fundo</label><span class="pp-value">{{ projects.current.look.shadow }}</span></div>
      <Slider v-model="projects.current.look.shadow" :min="0" :max="100" />
    </div>
  </div>
</template>

<style scoped>
.types :deep(.p-button) {
  font-size: 11px !important;
  padding: 0.38rem 0.2rem !important;
}
.auto {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  border-radius: 12px;
  background: rgba(var(--pp-fg-rgb), 0.035);
  border: 1px solid var(--pp-border);
}
.auto strong {
  font-size: 13px;
}
.auto p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.45;
}
.auto-swatch {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  flex-shrink: 0;
  border: 1px solid rgba(var(--pp-fg-rgb), 0.15);
}
.gradients {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.gradient {
  height: 58px;
  border-radius: 12px;
  border: 1px solid rgba(var(--pp-fg-rgb), 0.12);
  cursor: pointer;
  display: flex;
  align-items: flex-end;
  padding: 6px 8px;
  transition: transform 0.12s, box-shadow 0.12s;
}
.gradient span {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.gradient:hover {
  transform: translateY(-1px);
}
.gradient.active {
  box-shadow: 0 0 0 2px var(--pp-bg), 0 0 0 4px var(--pp-strong);
}
.image-preview {
  height: 120px;
  border-radius: 12px;
  background: var(--pp-thumb-bg) center / cover no-repeat;
  border: 1px solid var(--pp-border);
  display: grid;
  place-items: center;
  font-size: 12px;
  margin-bottom: 10px;
}
</style>
