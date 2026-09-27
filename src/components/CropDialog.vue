<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useUiStore } from '@/stores/ui'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { DEVICE_SCREEN_ASPECT } from '@/lib/defaults'
import { isVideoMime } from '@/lib/media'
import { clamp, formatTime } from '@/lib/util'

const ui = useUiStore()
const library = useLibraryStore()
const projects = useProjectsStore()
const toast = useToast()

const asset = computed(() => library.get(ui.cropAssetId))
const isVideo = computed(() => isVideoMime(asset.value?.mime))
const visible = computed({
  get: () => !!ui.cropAssetId,
  set: (v) => {
    if (!v) ui.cropAssetId = null
  }
})

const url = ref('')
const crop = ref({ x: 0, y: 0, w: 1, h: 1 })
const aspect = ref('free')
const trim = ref([0, 1])
const videoEl = ref()
const box = ref()
const playing = ref(false)
const currentTime = ref(0)

const device = computed(() => projects.current?.look.device || 'frame')
const aspectOptions = computed(() => [
  { label: 'Livre', value: 'free' },
  ...(device.value !== 'frame' ? [{ label: 'Tela', value: DEVICE_SCREEN_ASPECT[device.value] }] : []),
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '9:16', value: 9 / 16 }
])

watch(
  () => ui.cropAssetId,
  (id) => {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = ''
    playing.value = false
    if (!id || !asset.value) return
    url.value = URL.createObjectURL(asset.value.blob)
    crop.value = asset.value.crop ? { ...asset.value.crop } : { x: 0, y: 0, w: 1, h: 1 }
    aspect.value = 'free'
    trim.value = [asset.value.trimStart ?? 0, asset.value.trimEnd ?? asset.value.duration ?? 1]
    currentTime.value = trim.value[0]
  },
  { immediate: true }
)

const mediaAspect = computed(() => (asset.value ? asset.value.width / asset.value.height : 16 / 10))

function applyAspect(a) {
  if (a === 'free') return
  // Largest centered box with the requested aspect.
  const nh = mediaAspect.value / a // normalized height when width = 1
  let w = 1
  let h = nh
  if (h > 1) {
    h = 1
    w = a / mediaAspect.value
  }
  crop.value = { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}
watch(aspect, applyAspect)

// ---------------------------------------------------------------- crop drag

let drag = null
function onDown(e, mode) {
  e.preventDefault()
  e.stopPropagation()
  const rect = box.value.getBoundingClientRect()
  drag = { mode, x: e.clientX, y: e.clientY, start: { ...crop.value }, rw: rect.width, rh: rect.height }
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onMove(e) {
  if (!drag) return
  const dx = (e.clientX - drag.x) / drag.rw
  const dy = (e.clientY - drag.y) / drag.rh
  const s = drag.start
  const min = 0.05
  let { x, y, w, h } = s
  if (drag.mode === 'move') {
    x = clamp(s.x + dx, 0, 1 - s.w)
    y = clamp(s.y + dy, 0, 1 - s.h)
  } else {
    if (drag.mode.includes('w')) {
      x = clamp(s.x + dx, 0, s.x + s.w - min)
      w = s.w + (s.x - x)
    }
    if (drag.mode.includes('e')) w = clamp(s.w + dx, min, 1 - s.x)
    if (drag.mode.includes('n')) {
      y = clamp(s.y + dy, 0, s.y + s.h - min)
      h = s.h + (s.y - y)
    }
    if (drag.mode.includes('s')) h = clamp(s.h + dy, min, 1 - s.y)
    if (aspect.value !== 'free') {
      const ratio = mediaAspect.value / aspect.value // h = w * ratio (normalized)
      h = w * ratio
      if (y + h > 1) {
        h = 1 - y
        w = h / ratio
      }
      if (drag.mode.includes('n')) y = s.y + s.h - h
      if (drag.mode.includes('w')) x = s.x + s.w - w
      x = clamp(x, 0, 1 - w)
      y = clamp(y, 0, 1 - h)
    }
  }
  crop.value = { x, y, w, h }
}

function onUp() {
  drag = null
}

function resetCrop() {
  crop.value = { x: 0, y: 0, w: 1, h: 1 }
  aspect.value = 'free'
}

// ---------------------------------------------------------------- video trim

function togglePlay() {
  const v = videoEl.value
  if (!v) return
  if (v.paused) {
    if (v.currentTime < trim.value[0] || v.currentTime >= trim.value[1]) v.currentTime = trim.value[0]
    v.play()
    playing.value = true
  } else {
    v.pause()
    playing.value = false
  }
}

function onTimeUpdate() {
  const v = videoEl.value
  if (!v) return
  currentTime.value = v.currentTime
  if (v.currentTime >= trim.value[1]) {
    v.currentTime = trim.value[0]
  }
}

watch(trim, (t, old) => {
  const v = videoEl.value
  if (!v || !old) return
  v.currentTime = t[0] !== old[0] ? t[0] : t[1]
})

async function save() {
  const c = crop.value
  const full = c.x < 0.001 && c.y < 0.001 && c.w > 0.999 && c.h > 0.999
  const patch = { crop: full ? null : { x: +c.x.toFixed(4), y: +c.y.toFixed(4), w: +c.w.toFixed(4), h: +c.h.toFixed(4) } }
  if (isVideo.value) {
    patch.trimStart = +trim.value[0].toFixed(3)
    patch.trimEnd = +trim.value[1].toFixed(3)
  }
  await library.update(asset.value.id, patch)
  toast.add({ severity: 'success', summary: isVideo.value ? 'Corte e recorte salvos' : 'Recorte salvo', life: 1500 })
  visible.value = false
}

onBeforeUnmount(() => {
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="isVideo ? 'Aparar e cortar vídeo' : 'Cortar foto'" :style="{ width: 'min(860px, 94vw)' }" :draggable="false">
    <div v-if="asset" class="crop">
      <div class="toolbar">
        <SelectButton v-model="aspect" :options="aspectOptions" option-label="label" option-value="value" :allow-empty="false" />
        <Button label="Redefinir corte" icon="pi pi-replay" size="small" severity="secondary" text @click="resetCrop" />
      </div>

      <div class="canvas-wrap">
        <div ref="box" class="media-box" :style="{ aspectRatio: `${asset.width} / ${asset.height}`, width: `min(100%, calc(54vh * ${asset.width / asset.height}))` }">
          <video v-if="isVideo" ref="videoEl" :src="url" muted playsinline class="media" @timeupdate="onTimeUpdate" @loadedmetadata="(e) => (e.target.currentTime = trim[0])" />
          <img v-else :src="url" alt="" class="media" draggable="false" />
          <div class="shade" />
          <div
            class="crop-rect"
            :style="{ left: crop.x * 100 + '%', top: crop.y * 100 + '%', width: crop.w * 100 + '%', height: crop.h * 100 + '%' }"
            @pointerdown="(e) => onDown(e, 'move')"
            @pointermove="onMove"
            @pointerup="onUp"
          >
            <span class="grid-line v1" /><span class="grid-line v2" /><span class="grid-line h1" /><span class="grid-line h2" />
            <span v-for="h in ['nw', 'ne', 'sw', 'se']" :key="h" class="handle" :class="h" @pointerdown="(e) => onDown(e, h)" @pointermove="onMove" @pointerup="onUp" />
          </div>
        </div>
      </div>

      <p class="info pp-mono">
        {{ Math.round(crop.w * asset.width) }} × {{ Math.round(crop.h * asset.height) }} px
        <span v-if="asset.demo" class="pp-muted"> · mídias de demonstração voltam ao original ao recarregar</span>
      </p>

      <div v-if="isVideo" class="trim">
        <button class="play" :aria-label="playing ? 'Pausar' : 'Reproduzir'" @click="togglePlay"><i :class="playing ? 'pi pi-pause' : 'pi pi-play'" /></button>
        <div class="trim-body">
          <Slider v-model="trim" range :min="0" :max="asset.duration" :step="0.01" />
          <div class="trim-meta pp-mono">
            <span>INÍCIO {{ formatTime(trim[0]) }}</span>
            <span class="pp-muted">{{ formatTime(currentTime) }}</span>
            <span>FIM {{ formatTime(trim[1]) }} · {{ (trim[1] - trim[0]).toFixed(1) }}s</span>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancelar" size="small" severity="secondary" text @click="visible = false" />
      <Button label="Salvar" icon="pi pi-check" size="small" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.canvas-wrap {
  overflow: hidden;
  display: flex;
  justify-content: center;
  background: var(--pp-code-bg);
  border-radius: 12px;
  padding: 16px;
}
.media-box {
  position: relative;
  user-select: none;
  touch-action: none;
}
.media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
}
.shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.crop-rect {
  position: absolute;
  border: 1.5px solid #fff;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  cursor: move;
}
.grid-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}
.v1, .v2 { top: 0; bottom: 0; width: 1px; }
.h1, .h2 { left: 0; right: 0; height: 1px; }
.v1 { left: 33.33%; }
.v2 { left: 66.66%; }
.h1 { top: 33.33%; }
.h2 { top: 66.66%; }
.handle {
  position: absolute;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 3px;
}
.nw { left: -7px; top: -7px; cursor: nwse-resize; }
.ne { right: -7px; top: -7px; cursor: nesw-resize; }
.sw { left: -7px; bottom: -7px; cursor: nesw-resize; }
.se { right: -7px; bottom: -7px; cursor: nwse-resize; }
.info {
  font-size: 12px;
  margin: 10px 0 0;
}
.trim {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
}
.play {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 0;
  background: var(--pp-invert-bg);
  color: var(--pp-invert-fg);
  cursor: pointer;
  flex-shrink: 0;
}
.trim-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.trim-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
</style>
