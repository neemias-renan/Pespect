<script setup>
import { computed, ref } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import {
  EASINGS, TRANSITIONS, TEXT_FONTS, TEXT_ANIMATIONS, TEXT_SIZES, TEXT_WEIGHTS, EMPHASIS_STYLES, EMPHASIS_COLORS,
  LOGO_ANIMATIONS, MIN_SCENE_DURATION, MAX_SCENE_DURATION
} from '@/lib/defaults'
import { MOTION_PRESETS } from '@/lib/presets'
import { wordsOf, ensureFont, fontStack } from '@/lib/engine/overlay'
import ScreenSource from '../ScreenSource.vue'
import ColorField from '../ColorField.vue'

const projects = useProjectsStore()
const library = useLibraryStore()
const ui = useUiStore()

const scene = computed(() => projects.selectedScene)
const index = computed(() => projects.selectedIndex)
const emphasisStyle = ref('highlight')
const emphasisColor = ref(EMPHASIS_COLORS[0])

function update(patch) {
  projects.updateScene(scene.value.id, patch)
}

const typeLabel = computed(() => ({ shot: 'Tomada', text: 'Cena de texto', logo: 'Logo' })[scene.value?.type] || '')

const preset = computed({
  get: () => scene.value?.preset,
  set: (v) => {
    if (!v) return
    projects.applyPreset(scene.value.id, v)
    projects.seekToKeyframe()
    ui.click('release', 0.28)
  }
})

function shuffle() {
  projects.shuffleScene(scene.value.id)
  projects.seekToKeyframe()
  ui.click('release', 0.28)
}

function setKey(key) {
  projects.setEditingKey(key)
  ui.click('toggle', 0.3)
}

function addPosition() {
  projects.addPosition(scene.value.id)
  ui.click('release', 0.28)
}

// ---------------------------------------------------------------- text

const words = computed(() => (scene.value?.type === 'text' ? wordsOf(scene.value.text) : []))
const emphasisMap = computed(() => new Map((scene.value?.emphasis || []).map((e) => [e.word, e])))

function toggleWord(i) {
  const list = [...(scene.value.emphasis || [])]
  const existing = list.findIndex((e) => e.word === i)
  if (existing >= 0 && list[existing].style === emphasisStyle.value && list[existing].color === emphasisColor.value) {
    list.splice(existing, 1)
  } else if (existing >= 0) {
    list.splice(existing, 1, { word: i, style: emphasisStyle.value, color: emphasisColor.value })
  } else {
    list.push({ word: i, style: emphasisStyle.value, color: emphasisColor.value })
  }
  update({ emphasis: list })
  ui.click('toggle', 0.25)
}

function onTextInput(value) {
  // Drop emphasis on words that no longer exist.
  const count = wordsOf(value).length
  update({ text: value, emphasis: (scene.value.emphasis || []).filter((e) => e.word < count) })
}

async function setFont(family) {
  await ensureFont(family, scene.value.weight)
  update({ font: family })
}

const fontOptions = TEXT_FONTS.map((f) => ({ label: f.family, value: f.family }))
const alignOptions = [
  { icon: 'pi pi-align-left', value: 'left', label: 'Esquerda' },
  { icon: 'pi pi-align-center', value: 'center', label: 'Centro' },
  { icon: 'pi pi-align-right', value: 'right', label: 'Direita' }
]

const logoAsset = computed(() => (scene.value?.type === 'logo' ? library.get(scene.value.assetId) : null))
</script>

<template>
  <div v-if="!scene" class="none">
    <i class="pi pi-video" />
    <strong>Selecione uma cena na linha do tempo</strong>
    <p class="pp-muted">Ou adicione uma nova abaixo.</p>
    <div class="flex flex-column gap-2 w-full">
      <Button label="Adicionar mídia" icon="pi pi-images" size="small" @click="ui.openLibrary('add')" />
      <Button label="Adicionar cena de texto" icon="pi pi-align-left" size="small" severity="secondary" @click="projects.addTextScene()" />
      <Button label="Adicionar logo em PNG ou SVG" icon="pi pi-star" size="small" severity="secondary" @click="ui.openLibrary('logo')" />
    </div>
  </div>

  <div v-else>
    <div class="head">
      <div>
        <div class="pp-label">Cena {{ index + 1 }}</div>
        <strong>{{ typeLabel }}</strong>
      </div>
      <div class="flex gap-1">
        <button class="pp-icon-btn" v-tooltip.bottom="'Duplicar cena'" aria-label="Duplicar cena" @click="projects.duplicateScene(scene.id)"><i class="pi pi-copy" /></button>
        <button class="pp-icon-btn" v-tooltip.bottom="'Excluir cena selecionada'" aria-label="Excluir cena selecionada" @click="ui.click('delete'); projects.removeScene(scene.id)"><i class="pi pi-trash" /></button>
      </div>
    </div>

    <!-- ---------------------------------------------------------------- shot -->
    <template v-if="scene.type === 'shot'">
      <ScreenSource :asset-id="scene.assetId" />

      <div class="pp-field">
        <div class="pp-field-row">
          <label>Posições da câmera</label>
          <button class="pp-icon-btn add-pos" @click="addPosition"><i class="pi pi-plus" /> Adicionar posição</button>
        </div>
        <div class="keys">
          <div
            v-for="(k, i) in projects.selectedKeys"
            :key="k.id"
            class="key-row"
            :class="{ active: projects.editingKey === k.id }"
            role="button"
            tabindex="0"
            @click="setKey(k.id)"
            @keydown.enter="setKey(k.id)"
          >
            <span class="dot" :class="k.id === 'start' ? 'start' : k.id === 'end' ? 'end' : 'mid'" />
            <strong>{{ k.id === 'start' ? 'INÍCIO' : k.id === 'end' ? 'FIM' : `P${i}` }}</strong>
            <small>{{ (k.at * scene.duration).toFixed(1) }}s · X {{ Math.round(k.shot.rotateX) }}° · Y {{ Math.round(k.shot.rotateY) }}° · {{ k.shot.zoom.toFixed(2) }}×</small>
            <button v-if="k.id !== 'start' && k.id !== 'end'" class="key-del" aria-label="Remover posição" @click.stop="projects.removePosition(scene.id, k.id)"><i class="pi pi-times" /></button>
          </div>
        </div>
        <p class="hint">Escolha uma posição e depois arraste o palco ou use o operador para enquadrá-la.<template v-if="scene.composed"> Composta a partir das suas áreas de interesse.</template></p>
        <div class="flex gap-2">
          <Button label="INÍCIO → FIM" size="small" severity="secondary" class="flex-1" @click="projects.copyKeyframe(scene.id, 'start', 'end')" v-tooltip.bottom="'Copiar INÍCIO para FIM (sem movimento)'" />
          <Button label="Inverter" icon="pi pi-arrow-right-arrow-left" size="small" severity="secondary" class="flex-1" @click="projects.swapKeyframes(scene.id)" />
        </div>
      </div>

      <div class="pp-field">
        <label>Movimento</label>
        <div class="flex gap-2">
          <Dropdown v-model="preset" :options="MOTION_PRESETS" option-label="label" option-value="id" class="flex-1" placeholder="Personalizado">
            <template #option="{ option }">
              <div class="opt">
                <span>{{ option.label }}</span>
                <small>{{ option.description }}</small>
              </div>
            </template>
          </Dropdown>
          <button class="pp-icon-btn is-outline shuffle" v-tooltip.bottom="'Sortear movimento'" aria-label="Sortear movimento" @click="shuffle"><i class="pi pi-sync" /></button>
        </div>
      </div>

      <div class="grid-2">
        <div class="pp-field">
          <label>Duração</label>
          <InputNumber :model-value="scene.duration" :min="MIN_SCENE_DURATION" :max="MAX_SCENE_DURATION" :step="0.5" :min-fraction-digits="1" :max-fraction-digits="1" suffix=" s" input-class="num" @update:model-value="(v) => v && update({ duration: v })" />
        </div>
        <div class="pp-field">
          <label>Curva de movimento</label>
          <Dropdown :model-value="scene.easing" :options="EASINGS" option-label="label" option-value="value" @update:model-value="(v) => update({ easing: v })" />
        </div>
      </div>
    </template>

    <!-- ---------------------------------------------------------------- text -->
    <template v-else-if="scene.type === 'text'">
      <div class="pp-field">
        <label>Texto</label>
        <Textarea :model-value="scene.text" rows="3" auto-resize placeholder="Adicione seu texto aqui..." @update:model-value="onTextInput" />
      </div>

      <div class="pp-field">
        <div class="pp-field-row">
          <label>Destaque de palavras</label>
          <button class="pp-icon-btn clear" :disabled="!scene.emphasis?.length" v-tooltip.left="'Limpar todos os marcadores, sublinhados e círculos'" @click="update({ emphasis: [] })">Limpar</button>
        </div>
        <div class="emph-tools" role="group" aria-label="Destaque de palavras">
          <button
            v-for="s in EMPHASIS_STYLES"
            :key="s.style"
            :class="{ active: emphasisStyle === s.style }"
            :aria-label="s.label"
            v-tooltip.bottom="s.label"
            @click="emphasisStyle = s.style"
          >
            <span v-if="s.style === 'highlight'" class="ic hl">A</span>
            <span v-else-if="s.style === 'underline'" class="ic ul">A</span>
            <span v-else class="ic ci">A</span>
          </button>
          <span class="emph-sep" />
          <button
            v-for="c in EMPHASIS_COLORS"
            :key="c"
            class="emph-color"
            :class="{ active: emphasisColor === c }"
            :style="{ background: c }"
            :aria-label="`Cor do marcador ${c}`"
            @click="emphasisColor = c"
          />
        </div>
        <div class="words">
          <button
            v-for="w in words"
            :key="w.index"
            class="word"
            :class="emphasisMap.get(w.index)?.style"
            :style="emphasisMap.get(w.index) ? { '--em': emphasisMap.get(w.index).color } : null"
            @click="toggleWord(w.index)"
          >
            {{ w.word }}
          </button>
        </div>
        <p class="hint">Escolha um estilo e depois clique nas palavras para destacá-las.</p>
      </div>

      <div class="pp-field">
        <label>Fonte</label>
        <Dropdown :model-value="scene.font" :options="fontOptions" option-label="label" option-value="value" aria-label="Fonte" @update:model-value="setFont">
          <template #option="{ option }">
            <span :style="{ fontFamily: fontStack(option.value), fontSize: '15px' }">{{ option.label }}</span>
          </template>
        </Dropdown>
      </div>
      <div class="pp-field">
        <label>Peso da fonte</label>
        <SelectButton :model-value="scene.weight" :options="TEXT_WEIGHTS" option-label="label" option-value="value" :allow-empty="false" aria-label="Peso da fonte" class="compact" @update:model-value="(v) => v && update({ weight: v })" />
      </div>
      <div class="pp-field">
        <label>Tamanho do texto</label>
        <SelectButton :model-value="scene.size" :options="TEXT_SIZES" option-label="label" option-value="value" :allow-empty="false" aria-label="Tamanho do texto" class="compact" @update:model-value="(v) => v && update({ size: v })" />
      </div>
      <div class="grid-2">
        <div class="pp-field">
          <label>Cor</label>
          <div class="flex flex-column gap-2">
            <SelectButton :model-value="scene.color === 'auto' ? 'auto' : 'custom'" :options="[{ label: 'Auto', value: 'auto' }, { label: 'Manual', value: 'custom' }]" option-label="label" option-value="value" :allow-empty="false" class="compact" @update:model-value="(v) => update({ color: v === 'auto' ? 'auto' : '#ffffff' })" />
            <ColorField v-if="scene.color !== 'auto'" :model-value="scene.color" label="Cor do texto" @update:model-value="(v) => update({ color: v })" />
          </div>
        </div>
        <div class="pp-field">
          <label>Alinhamento</label>
          <SelectButton :model-value="scene.align" :options="alignOptions" option-value="value" :allow-empty="false" @update:model-value="(v) => v && update({ align: v })">
            <template #option="{ option }"><i :class="option.icon" :aria-label="option.label" /></template>
          </SelectButton>
        </div>
      </div>
      <div class="pp-field">
        <label>Animação do texto</label>
        <Dropdown :model-value="scene.animation" :options="TEXT_ANIMATIONS" option-label="label" option-value="id" @update:model-value="(v) => update({ animation: v })">
          <template #option="{ option }">
            <div class="opt">
              <span>{{ option.label }}</span>
              <small>{{ option.description }}</small>
            </div>
          </template>
        </Dropdown>
      </div>
      <div class="pp-field">
        <label>Duração</label>
        <InputNumber :model-value="scene.duration" :min="MIN_SCENE_DURATION" :max="MAX_SCENE_DURATION" :step="0.5" :min-fraction-digits="1" :max-fraction-digits="1" suffix=" s" input-class="num" @update:model-value="(v) => v && update({ duration: v })" />
      </div>
      <Button v-if="scene.offsetX || scene.offsetY" label="Redefinir posição" icon="pi pi-replay" size="small" severity="secondary" class="w-full mb-3" @click="update({ offsetX: 0, offsetY: 0 })" />
    </template>

    <!-- ---------------------------------------------------------------- logo -->
    <template v-else-if="scene.type === 'logo'">
      <div class="logo-preview checkerboard">
        <img v-if="logoAsset" :src="logoAsset.thumbnail" alt="" />
      </div>
      <div class="flex gap-2 mb-3">
        <Button label="Trocar logo" icon="pi pi-sync" size="small" severity="secondary" class="flex-1" @click="ui.openLibrary('replace')" />
      </div>
      <div class="pp-field">
        <div class="pp-field-row"><label>Tamanho</label><span class="pp-value">{{ Math.round(scene.scale * 100) }}%</span></div>
        <Slider :model-value="scene.scale" :min="0.3" :max="2.5" :step="0.05" @update:model-value="(v) => update({ scale: v })" />
      </div>
      <div class="pp-field">
        <label>Animação</label>
        <Dropdown :model-value="scene.animation" :options="LOGO_ANIMATIONS" option-label="label" option-value="value" @update:model-value="(v) => update({ animation: v })" />
      </div>
      <div class="pp-field">
        <label>Duração</label>
        <InputNumber :model-value="scene.duration" :min="MIN_SCENE_DURATION" :max="MAX_SCENE_DURATION" :step="0.5" :min-fraction-digits="1" :max-fraction-digits="1" suffix=" s" input-class="num" @update:model-value="(v) => v && update({ duration: v })" />
      </div>
      <Button v-if="scene.offsetX || scene.offsetY" label="Redefinir posição" icon="pi pi-replay" size="small" severity="secondary" class="w-full mb-3" @click="update({ offsetX: 0, offsetY: 0 })" />
    </template>

    <div class="pp-field">
      <label>Transição de entrada</label>
      <Dropdown :model-value="scene.transition || 'cut'" :options="TRANSITIONS" option-label="label" option-value="value" :disabled="index === 0" @update:model-value="(v) => update({ transition: v })" />
      <p v-if="index === 0" class="hint">A primeira cena não tem transição.</p>
    </div>
  </div>
</template>

<style scoped>
.none {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 24px 6px;
}
.none .pi {
  font-size: 22px;
  color: var(--pp-muted);
  margin-bottom: 6px;
}
.none p {
  margin: 0 0 12px;
  font-size: 12px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.head strong {
  font-size: 15px;
}
.keys {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
}
.key-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--pp-border);
  background: rgba(var(--pp-fg-rgb), 0.03);
  cursor: pointer;
  outline: none;
}
.key-row strong {
  font-size: 10px;
  letter-spacing: 0.08em;
  min-width: 46px;
}
.key-row.active {
  border-color: rgba(var(--pp-fg-rgb), 0.5);
  background: rgba(var(--pp-fg-rgb), 0.08);
}
.key-row small {
  font-size: 10px;
  color: var(--pp-muted);
  font-family: var(--pp-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.key-del {
  margin-left: auto;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--pp-muted);
  cursor: pointer;
  flex-shrink: 0;
}
.key-del:hover {
  background: rgba(var(--pp-fg-rgb), 0.1);
  color: var(--pp-text);
}
.key-del .pi {
  font-size: 9px;
}
.add-pos {
  height: 24px;
  font-size: 11px;
}
.dot.mid {
  background: #2f7bff;
}
.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 4px;
}
.dot.start {
  background: #4cb782;
}
.dot.end {
  background: #ff5b3a;
}
.hint {
  margin: 0;
  font-size: 11px;
  color: var(--pp-muted);
  line-height: 1.4;
}
.shuffle {
  height: auto;
}
.opt {
  display: flex;
  flex-direction: column;
}
.opt small {
  color: var(--pp-muted);
  font-size: 11px;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
:deep(.num) {
  width: 100%;
  text-align: center;
  padding: 0.45rem 0.2rem;
}
:deep(.p-inputnumber-button) {
  background: rgba(var(--pp-fg-rgb), 0.06);
  border-color: var(--pp-border-strong);
  color: var(--pp-text);
  width: 2rem;
}
.compact :deep(.p-button) {
  font-size: 11px !important;
  padding: 0.38rem 0.1rem !important;
}
.emph-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.emph-tools > button:not(.emph-color) {
  width: 30px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--pp-border);
  background: rgba(var(--pp-fg-rgb), 0.03);
  color: var(--pp-text);
  cursor: pointer;
}
.emph-tools > button.active:not(.emph-color) {
  background: rgba(var(--pp-fg-rgb), 0.14);
  border-color: rgba(var(--pp-fg-rgb), 0.4);
}
.ic {
  font-weight: 700;
  font-size: 13px;
}
.ic.hl {
  background: #ffd84d;
  color: #111;
  padding: 0 3px;
  border-radius: 3px;
}
.ic.ul {
  text-decoration: underline;
  text-decoration-thickness: 2px;
}
.ic.ci {
  border: 1.5px solid currentColor;
  border-radius: 50%;
  padding: 0 4px;
}
.emph-sep {
  width: 1px;
  height: 18px;
  background: var(--pp-border-strong);
  margin: 0 4px;
}
.emph-color {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(var(--pp-fg-rgb), 0.2);
  cursor: pointer;
  padding: 0;
}
.emph-color.active {
  box-shadow: 0 0 0 2px var(--pp-bg), 0 0 0 3.5px var(--pp-strong);
}
.words {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  border-radius: 10px;
  background: rgba(var(--pp-fg-rgb), 0.04);
  border: 1px solid var(--pp-border);
  min-height: 40px;
}
.word {
  border: 0;
  background: transparent;
  color: var(--pp-text);
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 5px;
  cursor: pointer;
}
.word:hover {
  background: rgba(var(--pp-fg-rgb), 0.08);
}
.word.highlight {
  background: var(--em);
  color: #111;
}
.word.underline {
  text-decoration: underline;
  text-decoration-color: var(--em);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.word.circle {
  box-shadow: inset 0 0 0 1.5px var(--em);
  border-radius: 999px;
}
.clear {
  height: 24px;
  font-size: 11px;
}
.logo-preview {
  height: 120px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  margin-bottom: 10px;
  overflow: hidden;
}
.logo-preview img {
  max-width: 70%;
  max-height: 80%;
  object-fit: contain;
}
</style>
