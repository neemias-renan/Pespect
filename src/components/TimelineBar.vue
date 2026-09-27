<script setup>
import { computed, ref, watch } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import { MOTION_PRESETS } from '@/lib/presets'
import { TRANSITIONS } from '@/lib/defaults'
import { formatTime, clamp } from '@/lib/util'

const emit = defineEmits(['toggle-play'])
const projects = useProjectsStore()
const library = useLibraryStore()
const ui = useUiStore()

const pps = ref(64) // pixels per second
const scroller = ref()
const addMenu = ref()
const dragState = ref(null) // { id, fromIndex, dx, targetIndex }

const layout = computed(() => projects.layout)
const duration = computed(() => projects.duration)
const trackWidth = computed(() => Math.max(duration.value * pps.value + 180, 600))

const ticks = computed(() => {
  const step = pps.value >= 90 ? 0.5 : pps.value >= 40 ? 1 : pps.value >= 20 ? 2 : 5
  const out = []
  const end = Math.ceil((trackWidth.value / pps.value) / step) * step
  for (let t = 0; t <= end; t += step) out.push({ t, major: Math.abs(t - Math.round(t)) < 1e-6 && Math.round(t) % (step >= 2 ? step : 1) === 0 })
  return out
})

const addItems = [
  { label: 'Mídia', icon: 'pi pi-images', command: () => ui.openLibrary('add') },
  { label: 'Cena de texto', icon: 'pi pi-align-left', command: () => projects.addTextScene() },
  { label: 'Logo', icon: 'pi pi-star', command: () => ui.openLibrary('logo') }
]

function sceneTitle(scene) {
  if (scene.type === 'text') return scene.text?.split('\n')[0] || 'Cena de texto'
  if (scene.type === 'logo') return 'Logo'
  if (scene.composed) return `Composta · ${(scene.stops || []).length + 2} posições`
  return MOTION_PRESETS.find((p) => p.id === scene.preset)?.label || 'Movimento personalizado'
}

function thumbFor(scene) {
  const asset = library.get(scene.assetId)
  return asset?.thumbnail || null
}

function transitionLabel(scene) {
  return TRANSITIONS.find((t) => t.value === scene.transition)?.label || 'Corte seco'
}

function zoom(dir) {
  pps.value = clamp(Math.round(pps.value * (dir > 0 ? 1.25 : 0.8)), 16, 260)
}

// ---------------------------------------------------------------- scrubbing

function timeFromEvent(e) {
  const rect = scroller.value.getBoundingClientRect()
  const x = e.clientX - rect.left + scroller.value.scrollLeft - 12
  return clamp(x / pps.value, 0, duration.value)
}

let scrubbing = false
function onScrubStart(e) {
  if (!duration.value) return
  scrubbing = true
  projects.playing = false
  projects.setPlayhead(timeFromEvent(e))
  e.currentTarget.setPointerCapture(e.pointerId)
}
function onScrubMove(e) {
  if (scrubbing) projects.setPlayhead(timeFromEvent(e))
}
function onScrubEnd() {
  scrubbing = false
}

// ---------------------------------------------------------------- block drag / resize

let pointer = null

function onBlockDown(e, item) {
  if (e.button !== 0) return
  e.stopPropagation()
  pointer = { kind: 'move', id: item.scene.id, x: e.clientX, fromIndex: item.index, moved: false }
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onResizeDown(e, item) {
  e.stopPropagation()
  pointer = { kind: 'resize', id: item.scene.id, x: e.clientX, startDur: item.scene.duration }
  projects.selectScene(item.scene.id)
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onPointerMove(e) {
  if (!pointer) return
  const dx = e.clientX - pointer.x
  if (pointer.kind === 'resize') {
    projects.updateScene(pointer.id, { duration: pointer.startDur + dx / pps.value })
    return
  }
  if (!pointer.moved && Math.abs(dx) < 5) return
  pointer.moved = true
  const item = layout.value[pointer.fromIndex]
  const center = (item.start + item.scene.duration / 2) * pps.value + dx
  let target = 0
  layout.value.forEach((l, i) => {
    if (i === pointer.fromIndex) return
    const mid = (l.start + l.scene.duration / 2) * pps.value
    if (center > mid) target = i < pointer.fromIndex ? i + 1 : i
  })
  if (center <= (layout.value[0].start + layout.value[0].scene.duration / 2) * pps.value && pointer.fromIndex !== 0) target = 0
  dragState.value = { id: pointer.id, dx, targetIndex: target }
}

function onPointerUp(e) {
  if (!pointer) return
  const p = pointer
  pointer = null
  try {
    e.currentTarget.releasePointerCapture(e.pointerId)
  } catch {
    // ignore
  }
  if (p.kind === 'move') {
    if (p.moved && dragState.value) {
      projects.moveScene(p.fromIndex, dragState.value.targetIndex)
      ui.click('release', 0.28)
    } else {
      projects.selectScene(p.id)
      ui.click('toggle', 0.25)
    }
  }
  dragState.value = null
}

// Position markers: click selects, dragging an intermediate one retimes it.
let keyDrag = null
function onKeyDown(e, item, k) {
  keyDrag = { item, key: k, x: e.clientX, moved: false, width: e.currentTarget.parentElement.getBoundingClientRect().width }
  e.currentTarget.setPointerCapture(e.pointerId)
}
function onKeyMove(e) {
  if (!keyDrag || keyDrag.key.id === 'start' || keyDrag.key.id === 'end') return
  const dx = e.clientX - keyDrag.x
  if (!keyDrag.moved && Math.abs(dx) < 3) return
  keyDrag.moved = true
  projects.movePosition(keyDrag.item.scene.id, keyDrag.key.id, keyDrag.key.at + dx / keyDrag.width)
}
function onKeyUp() {
  if (!keyDrag) return
  const { item, key } = keyDrag
  keyDrag = null
  projects.selectScene(item.scene.id, key.id)
  ui.click('toggle', 0.25)
}

function addPosition() {
  projects.addPosition()
  ui.click('release', 0.28)
}

function split() {
  if (projects.splitAtPlayhead()) ui.click('release', 0.28)
}

// Keep the playhead visible while playing.
watch(
  () => projects.playhead,
  (t) => {
    const el = scroller.value
    if (!el || !projects.playing) return
    const x = t * pps.value
    if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 80)
  }
)
</script>

<template>
  <section class="timeline pp-glass" aria-label="Linha do tempo">
    <div class="toolbar">
      <div class="left">
        <button class="pp-icon-btn" aria-label="Voltar ao início" v-tooltip.top="'Voltar ao início (Enter)'" @click="projects.playing = false; projects.setPlayhead(0)">
          <i class="pi pi-step-backward" />
        </button>
        <button class="play" :aria-label="projects.playing ? 'Pausar' : 'Reproduzir'" v-tooltip.top="'Reproduzir ou pausar (Espaço)'" :disabled="!duration" @click="emit('toggle-play')">
          <i :class="projects.playing ? 'pi pi-pause' : 'pi pi-play'" />
        </button>
        <span class="time pp-mono">{{ formatTime(projects.playhead) }} <span class="pp-muted">/ {{ formatTime(duration) }}</span></span>
        <button class="pp-icon-btn" :class="{ 'is-active': projects.loop }" aria-label="Repetir" v-tooltip.top="'Repetir reprodução'" @click="projects.loop = !projects.loop">
          <i class="pi pi-sync" />
        </button>
      </div>
      <div class="right">
        <button class="pp-icon-btn" :disabled="projects.selectedScene?.type !== 'shot'" v-tooltip.top="'Adicionar uma posição de câmera no cursor'" @click="addPosition">
          <i class="pi pi-plus-circle" /> Adicionar posição
        </button>
        <button class="pp-icon-btn" :disabled="!duration" aria-label="Dividir cena" v-tooltip.top="'Dividir a cena no cursor (S)'" @click="split">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" /></svg>
        </button>
        <span class="divider" />
        <button class="pp-icon-btn is-outline" @click="(e) => addMenu.toggle(e)"><i class="pi pi-plus" /> Adicionar cena</button>
        <Menu ref="addMenu" :model="addItems" popup />
        <span class="divider" />
        <button class="pp-icon-btn" aria-label="Diminuir zoom" v-tooltip.top="'Diminuir zoom'" @click="zoom(-1)"><i class="pi pi-search-minus" /></button>
        <button class="pp-icon-btn" aria-label="Aumentar zoom" v-tooltip.top="'Aumentar zoom'" @click="zoom(1)"><i class="pi pi-search-plus" /></button>
        <button class="pp-icon-btn" aria-label="Dados de movimento da cena" v-tooltip.top="'Dados de movimento da cena'" @click="ui.sceneDataOpen = true"><i class="pi pi-code" /></button>
        <button class="pp-icon-btn" aria-label="Atalhos de teclado" v-tooltip.top="'Atalhos de teclado'" @click="ui.shortcutsOpen = true"><i class="pi pi-question-circle" /></button>
      </div>
    </div>

    <div ref="scroller" class="scroller">
      <div class="track" :style="{ width: trackWidth + 'px' }">
        <div class="ruler" @pointerdown="onScrubStart" @pointermove="onScrubMove" @pointerup="onScrubEnd">
          <span v-for="tk in ticks" :key="tk.t" class="tick" :class="{ major: tk.major }" :style="{ left: tk.t * pps + 'px' }">
            <em v-if="tk.major">{{ formatTime(tk.t, false) }}</em>
          </span>
        </div>

        <div class="lane" @pointerdown="onScrubStart" @pointermove="onScrubMove" @pointerup="onScrubEnd">
          <div
            v-for="item in layout"
            :key="item.scene.id"
            class="block"
            :class="[
              `type-${item.scene.type}`,
              {
                selected: item.scene.id === projects.selectedSceneId,
                dragging: dragState?.id === item.scene.id,
                'drop-before': dragState && dragState.id !== item.scene.id && dragState.targetIndex === item.index && dragState.targetIndex < layout.findIndex((l) => l.scene.id === dragState.id),
                'drop-after': dragState && dragState.id !== item.scene.id && dragState.targetIndex === item.index && dragState.targetIndex > layout.findIndex((l) => l.scene.id === dragState.id)
              }
            ]"
            :style="{
              left: item.start * pps + 'px',
              width: Math.max(8, item.scene.duration * pps - 3) + 'px',
              transform: dragState?.id === item.scene.id ? `translateX(${dragState.dx}px)` : null
            }"
            @pointerdown="(e) => onBlockDown(e, item)"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
          >
            <div class="block-bg" :style="thumbFor(item.scene) ? { backgroundImage: `url(${thumbFor(item.scene)})` } : null" />
            <div class="block-info">
              <span class="block-title">
                <i v-if="item.scene.type === 'text'" class="pi pi-align-left" />
                <i v-else-if="item.scene.type === 'logo'" class="pi pi-star" />
                {{ sceneTitle(item.scene) }}
              </span>
              <span class="block-dur pp-mono">{{ item.scene.duration.toFixed(1) }}s</span>
            </div>
            <span v-if="item.index > 0 && item.scene.transition && item.scene.transition !== 'cut'" class="transition" v-tooltip.top="transitionLabel(item.scene)">
              <i class="pi pi-arrow-right-arrow-left" />
            </span>
            <template v-if="item.scene.type === 'shot' && item.scene.id === projects.selectedSceneId">
              <button
                v-for="(k, ki) in projects.selectedKeys"
                :key="k.id"
                class="key"
                :class="[{ on: projects.editingKey === k.id }, k.id === 'start' ? 'k-start' : k.id === 'end' ? 'k-end' : 'k-mid']"
                :style="k.id !== 'start' && k.id !== 'end' ? { left: `calc(${k.at * 100}% - 9px)` } : null"
                :aria-label="k.id === 'start' ? 'Posição INÍCIO' : k.id === 'end' ? 'Posição FIM' : `Posição ${ki}`"
                @pointerdown.stop="(e) => onKeyDown(e, item, k)"
                @pointermove="onKeyMove"
                @pointerup="onKeyUp"
              >{{ k.id === 'start' ? 'I' : k.id === 'end' ? 'F' : ki }}</button>
            </template>
            <span class="resize" aria-hidden="true" @pointerdown="(e) => onResizeDown(e, item)" @pointermove="onPointerMove" @pointerup="onPointerUp" />
          </div>

          <button class="add-tile" :style="{ left: duration * pps + 6 + 'px' }" aria-label="Adicionar cena" @pointerdown.stop @click="(e) => addMenu.toggle(e)">
            <i class="pi pi-plus" />
          </button>
        </div>

        <div class="playhead" :style="{ left: projects.playhead * pps + 'px' }" aria-hidden="true"><span /></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.timeline {
  margin: 0 12px 12px;
  border-radius: 18px;
  flex-shrink: 0;
  overflow: hidden;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--pp-border);
  gap: 8px;
}
.left,
.right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.play {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  background: var(--pp-invert-bg);
  color: var(--pp-invert-fg);
  cursor: pointer;
  display: grid;
  place-items: center;
  margin: 0 4px;
  transition: transform 0.1s;
}
.play:active {
  transform: scale(0.92);
}
.play:disabled {
  opacity: 0.4;
}
.play .pi {
  font-size: 12px;
}
.time {
  font-size: 12px;
  min-width: 108px;
  padding: 0 6px;
}
.divider {
  width: 1px;
  height: 18px;
  background: var(--pp-border-strong);
  margin: 0 4px;
}
.scroller {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 12px 10px;
}
.track {
  position: relative;
  height: 118px;
}
.ruler {
  position: relative;
  height: 24px;
  cursor: text;
  border-bottom: 1px solid var(--pp-border);
}
.tick {
  position: absolute;
  bottom: 0;
  width: 1px;
  height: 5px;
  background: rgba(var(--pp-fg-rgb), 0.15);
}
.tick.major {
  height: 9px;
  background: rgba(var(--pp-fg-rgb), 0.3);
}
.tick em {
  position: absolute;
  bottom: 11px;
  left: 3px;
  font-style: normal;
  font-size: 10px;
  color: var(--pp-muted);
  font-family: var(--pp-mono);
  white-space: nowrap;
}
.lane {
  position: relative;
  height: 86px;
  margin-top: 8px;
}
.block {
  position: absolute;
  top: 0;
  height: 76px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--pp-raised);
  border: 1.5px solid rgba(var(--pp-fg-rgb), 0.08);
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.block.type-text {
  background: linear-gradient(135deg, #2b2440, #1f1b2e);
}
.block.type-logo {
  background: linear-gradient(135deg, #3a2a1c, #251d16);
}
.block:hover {
  border-color: rgba(var(--pp-fg-rgb), 0.25);
}
.block.selected {
  border-color: var(--pp-strong);
  box-shadow: 0 0 0 3px rgba(var(--pp-fg-rgb), 0.12);
}
.block.dragging {
  z-index: 3;
  cursor: grabbing;
  opacity: 0.9;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
.block.drop-before {
  box-shadow: -4px 0 0 0 var(--pp-accent);
}
.block.drop-after {
  box-shadow: 4px 0 0 0 var(--pp-accent);
}
.block-bg {
  position: absolute;
  inset: 0;
  background: center / auto 100% repeat-x;
  opacity: 0.55;
}
.block-info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 6px;
  padding: 18px 8px 6px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
  color: #fff;
  font-size: 11px;
}
.block-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.block-title .pi {
  font-size: 10px;
  margin-right: 3px;
}
.block-dur {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.75);
}
.transition {
  position: absolute;
  left: 5px;
  top: 5px;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: grid;
  place-items: center;
}
.transition .pi {
  font-size: 9px;
}
.key {
  position: absolute;
  top: 5px;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 0;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
}
.key.k-start {
  left: 30px;
}
.key.k-end {
  right: 12px;
}
.key.k-mid {
  top: auto;
  bottom: 26px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: ew-resize;
  z-index: 2;
}
.key.on.k-start {
  background: #4cb782;
}
.key.on.k-end {
  background: #ff5b3a;
}
.key.on.k-mid {
  background: #2f7bff;
}
.resize {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
}
.resize::after {
  content: '';
  position: absolute;
  right: 2px;
  top: 50%;
  width: 3px;
  height: 22px;
  margin-top: -11px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.7);
  opacity: 0;
  transition: opacity 0.15s;
}
.block:hover .resize::after,
.block.selected .resize::after {
  opacity: 1;
}
.add-tile {
  position: absolute;
  top: 0;
  width: 56px;
  height: 76px;
  border-radius: 10px;
  border: 1.5px dashed rgba(var(--pp-fg-rgb), 0.2);
  background: transparent;
  color: var(--pp-muted);
  cursor: pointer;
}
.add-tile:hover {
  color: var(--pp-strong);
  border-color: rgba(var(--pp-fg-rgb), 0.5);
}
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--pp-accent);
  pointer-events: none;
  z-index: 4;
}
.playhead span {
  position: absolute;
  top: 0;
  left: -5px;
  width: 12px;
  height: 12px;
  border-radius: 3px 3px 6px 6px;
  background: var(--pp-accent);
}
</style>
