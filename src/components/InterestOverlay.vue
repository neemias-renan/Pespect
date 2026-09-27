<script setup>
// Flat view of the screen media where areas of interest are drawn, moved and removed.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import { isVideoMime } from '@/lib/media'
import { clamp } from '@/lib/util'

const MAX_AREAS = 8

const projects = useProjectsStore()
const library = useLibraryStore()
const ui = useUiStore()

const root = ref()
const wrap = ref()
const box = ref({ width: 0, height: 0 })
const url = ref('')
const draft = ref(null)
let ro = null
let drag = null

const assetId = computed(() => projects.composeAssetId)
const asset = computed(() => library.get(assetId.value))
const areas = computed(() => projects.areasFor(assetId.value))

watch(
  asset,
  (a, old) => {
    if (url.value && old && !isVideoMime(old.mime) && old.blob) URL.revokeObjectURL(url.value)
    url.value = !a ? '' : isVideoMime(a.mime) || !a.blob ? a.thumbnail : URL.createObjectURL(a.blob)
    measure()
  },
  { immediate: true }
)

function measure() {
  const el = root.value
  if (!el || !asset.value) return
  const W = el.clientWidth - 48
  const H = el.clientHeight - 96
  const aspect = asset.value.width / asset.value.height
  let width = W
  let height = width / aspect
  if (height > H) {
    height = H
    width = height * aspect
  }
  box.value = { width: Math.max(10, width), height: Math.max(10, height) }
}

function point(e) {
  const rect = wrap.value.getBoundingClientRect()
  return { x: clamp((e.clientX - rect.left) / rect.width, 0, 1), y: clamp((e.clientY - rect.top) / rect.height, 0, 1) }
}

function save(list) {
  projects.setAreas(assetId.value, list)
}

function onDown(e) {
  if (e.button !== 0) return
  if (areas.value.length >= MAX_AREAS) return
  const p = point(e)
  drag = { kind: 'draw', start: p }
  draft.value = { x: p.x, y: p.y, w: 0, h: 0 }
  wrap.value.setPointerCapture(e.pointerId)
}

function onAreaDown(e, index) {
  e.stopPropagation()
  const p = point(e)
  drag = { kind: 'move', index, start: p, orig: { ...areas.value[index] } }
  wrap.value.setPointerCapture(e.pointerId)
}

function onMove(e) {
  if (!drag) return
  const p = point(e)
  if (drag.kind === 'draw') {
    const s = drag.start
    draft.value = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }
  } else {
    const o = drag.orig
    const list = areas.value.map((a) => ({ ...a }))
    list[drag.index] = {
      ...o,
      x: clamp(o.x + p.x - drag.start.x, 0, 1 - o.w),
      y: clamp(o.y + p.y - drag.start.y, 0, 1 - o.h)
    }
    save(list)
  }
}

function onUp(e) {
  if (!drag) return
  if (drag.kind === 'draw' && draft.value && draft.value.w > 0.02 && draft.value.h > 0.02) {
    const d = draft.value
    save([...areas.value.map((a) => ({ ...a })), { x: +d.x.toFixed(4), y: +d.y.toFixed(4), w: +d.w.toFixed(4), h: +d.h.toFixed(4) }])
    ui.click('release', 0.28)
  }
  drag = null
  draft.value = null
  try {
    wrap.value.releasePointerCapture(e.pointerId)
  } catch {
    // ignore
  }
}

function remove(index) {
  save(areas.value.filter((_, i) => i !== index).map((a) => ({ ...a })))
  ui.click('delete')
}

function style(a) {
  return { left: a.x * 100 + '%', top: a.y * 100 + '%', width: a.w * 100 + '%', height: a.h * 100 + '%' }
}

onMounted(() => {
  ro = new ResizeObserver(measure)
  ro.observe(root.value)
  measure()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (url.value && asset.value && !isVideoMime(asset.value.mime) && asset.value.blob) URL.revokeObjectURL(url.value)
})
</script>

<template>
  <div ref="root" class="interest">
    <div class="interest-head">
      <span><i class="pi pi-bullseye" /> Arraste para marcar áreas de interesse · {{ areas.length }}/{{ MAX_AREAS }}</span>
      <button class="done" @click="ui.areaSelecting = false">Concluir</button>
    </div>
    <div
      v-if="asset"
      ref="wrap"
      class="sheet"
      :style="{ width: box.width + 'px', height: box.height + 'px' }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <img :src="url" alt="" draggable="false" />
      <div v-for="(a, i) in areas" :key="i" class="area" :style="style(a)" @pointerdown="(e) => onAreaDown(e, i)">
        <span class="num">{{ i + 1 }}</span>
        <button class="del" aria-label="Remover área" @pointerdown.stop @click.stop="remove(i)"><i class="pi pi-times" /></button>
      </div>
      <div v-if="draft" class="area drawing" :style="style(draft)" />
    </div>
    <p class="interest-foot">Depois clique em <strong>Compor</strong> — a câmera vai percorrer as áreas em ordem, de ângulos diferentes.</p>
  </div>
</template>

<style scoped>
.interest {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: var(--pp-sheet);
}
.interest-head {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--pp-muted);
}
.interest-head .pi {
  font-size: 11px;
  margin-right: 4px;
}
.done {
  height: 26px;
  padding: 0 12px;
  border-radius: 8px;
  border: 0;
  background: #2f7bff;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}
.sheet {
  position: relative;
  border: 3px solid var(--pp-sheet-frame);
  border-radius: 12px;
  overflow: hidden;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
  background: #fff;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.sheet img {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.area {
  position: absolute;
  border: 1.5px solid #2f7bff;
  background: rgba(47, 123, 255, 0.12);
  cursor: move;
}
.area.drawing {
  border-style: dashed;
  pointer-events: none;
}
.num {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2f7bff;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}
.del {
  position: absolute;
  right: -9px;
  top: -9px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 0;
  background: #0b0b0d;
  color: #fff;
  cursor: pointer;
  display: none;
  place-items: center;
  padding: 0;
}
.del .pi {
  font-size: 8px;
}
.area:hover .del {
  display: grid;
}
.interest-foot {
  margin: 0;
  font-size: 12px;
  color: var(--pp-muted);
}
</style>
