<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import { useLibraryStore } from '@/stores/library'
import { getStudio, onStudioInvalidate } from '@/composables/studio'
import { useMedia } from '@/composables/useMedia'
import { ratioOf, ZOOM_LIMITS } from '@/lib/defaults'
import { evaluateTimeline } from '@/lib/timeline'
import { measureTextBox } from '@/lib/engine/overlay'
import { makeThumbnail, isVideoMime } from '@/lib/media'
import { clamp } from '@/lib/util'
import InterestOverlay from './InterestOverlay.vue'

const projects = useProjectsStore()
const ui = useUiStore()
const library = useLibraryStore()
const { intake } = useMedia()

const host = ref()
const canvas = ref()
const frameSize = ref({ width: 640, height: 360 })
const dragDepth = ref(0)
const interacting = ref(false)
const textBox = ref(null)
const failed = ref('')

let studio = null
let ctx = null
let raf = 0
let dirty = true
let lastTs = 0
let ro = null
let thumbTimer = null
let offInvalidate = null

const project = computed(() => projects.current)
const mode = computed(() => projects.mode)
const ratio = computed(() => ratioOf(project.value?.ratio))
const transparent = computed(() => project.value?.look.backdrop.type === 'transparent')

const currentFrame = computed(() => {
  if (mode.value !== 'video') return null
  return evaluateTimeline(projects.scenes, projects.playhead)?.frame || null
})

const isEmpty = computed(() => {
  if (!project.value) return true
  if (mode.value === 'photo') return !project.value.activeAssetId || !library.get(project.value.activeAssetId)
  return projects.scenes.length === 0
})

// The focus reticle only flashes when the focus is set, never during playback.
const reticleVisible = ref(false)
let reticleTimer = null
function flashReticle() {
  reticleVisible.value = true
  clearTimeout(reticleTimer)
  reticleTimer = setTimeout(() => (reticleVisible.value = false), 1400)
}

const focusPoint = computed(() => {
  if (mode.value === 'photo') return project.value?.shot.focusPoint
  return currentFrame.value?.shot?.focusPoint || null
})

const hasLiveVideo = computed(() => {
  const p = project.value
  if (!p) return false
  if (mode.value === 'photo') return isVideoMime(library.get(p.activeAssetId)?.mime)
  return false
})

// ---------------------------------------------------------------- sizing

function measure() {
  const el = host.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const padX = rect.width < 700 ? 16 : 48
  const padTop = 12
  const padBottom = 92
  const availW = Math.max(120, rect.width - padX * 2)
  const availH = Math.max(120, rect.height - padTop - padBottom)
  const r = ratio.value.w / ratio.value.h
  let width = availW
  let height = width / r
  if (height > availH) {
    height = availH
    width = height * r
  }
  frameSize.value = { width: Math.round(width), height: Math.round(height) }
  resizeCanvas()
}

function pixelRatio() {
  const dpr = Math.min(window.devicePixelRatio || 1, ui.settings.performance ? 1 : 2)
  const long = Math.max(frameSize.value.width, frameSize.value.height) * dpr
  return long > 2600 ? (2600 / long) * dpr : dpr
}

function resizeCanvas() {
  const c = canvas.value
  if (!c) return
  const dpr = pixelRatio()
  const w = Math.max(2, Math.round(frameSize.value.width * dpr))
  const h = Math.max(2, Math.round(frameSize.value.height * dpr))
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
  }
  dirty = true
}

// ---------------------------------------------------------------- render loop

function renderNow(ts) {
  const p = project.value
  if (!p || !ctx) return
  const W = canvas.value.width
  const H = canvas.value.height
  if (mode.value === 'photo') {
    studio.renderPhoto(ctx, W, H, p, { time: ts / 1000, playing: true })
  } else {
    studio.renderTimeline(ctx, W, H, p, projects.playhead, { playing: projects.playing, skipTransition: projects.keyframePreview && !projects.playing })
  }
}

function loop(ts) {
  raf = requestAnimationFrame(loop)
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0
  lastTs = ts
  if (ui.exporting || !project.value) return
  if (projects.playing && mode.value === 'video') {
    if (projects.keyframePreview) projects.keyframePreview = false
    let t = projects.playhead + dt
    if (t >= projects.duration) {
      if (projects.loop) t = 0
      else {
        t = projects.duration
        projects.playing = false
      }
    }
    projects.playhead = t
    dirty = true
  }
  if (!dirty && !hasLiveVideo.value) return
  dirty = false
  try {
    renderNow(ts)
  } catch (err) {
    console.error(err)
    failed.value = err?.message || 'Falha na renderização'
  }
}

function invalidate() {
  dirty = true
}

function scheduleThumbnail() {
  clearTimeout(thumbTimer)
  thumbTimer = setTimeout(() => {
    if (!canvas.value || isEmpty.value || ui.exporting) return
    try {
      projects.setThumbnail(makeThumbnail(canvas.value, canvas.value.width, canvas.value.height, 320))
    } catch {
      // ignore (e.g. tainted canvas)
    }
  }, 1600)
}

watch(() => project.value, () => {
  invalidate()
  scheduleThumbnail()
}, { deep: true })
watch(() => [projects.playhead, mode.value, projects.selectedSceneId, projects.keyframePreview], invalidate)
watch(() => project.value?.id, () => scheduleThumbnail())
watch(() => ratio.value, () => measure())
watch(() => ui.settings.performance, (v) => {
  studio?.engine.setPerformance(v)
  resizeCanvas()
})
watch(() => ui.exporting, (v) => {
  if (!v) {
    resizeCanvas()
    invalidate()
  }
})
watch(() => library.assets.map((a) => [a.id, a.crop, a.trimStart, a.trimEnd]), invalidate, { deep: true })

// Stop videos when leaving photo mode / switching assets.
watch(() => [mode.value, project.value?.activeAssetId], () => studio?.pauseAllVideos(project.value))

// ---------------------------------------------------------------- interaction

let drag = null

function normalizedPoint(e) {
  const rect = canvas.value.getBoundingClientRect()
  return { x: clamp((e.clientX - rect.left) / rect.width, 0, 1), y: clamp((e.clientY - rect.top) / rect.height, 0, 1) }
}

function onPointerDown(e) {
  if (!project.value || isEmpty.value) return
  const pt = normalizedPoint(e)

  if (ui.focusPicking) {
    if (projects.activeShot) {
      projects.updateActiveShot({ focusPoint: pt })
      project.value.look.focusMode = 'manual'
      flashReticle()
      if ((projects.activeShot.blur ?? 0) < 10) projects.updateActiveShot({ blur: 45 })
      ui.click('release', 0.3)
    }
    ui.focusPicking = false
    return
  }

  const frame = currentFrame.value
  if (mode.value === 'video' && frame && frame.type !== 'shot') {
    projects.playing = false
    projects.selectScene(frame.scene.id)
    drag = { kind: 'text', x: e.clientX, y: e.clientY, sceneId: frame.scene.id, ox: frame.scene.offsetX || 0, oy: frame.scene.offsetY || 0 }
  } else {
    if (mode.value === 'video') {
      projects.playing = false
      if (frame?.scene && frame.scene.id !== projects.selectedSceneId) projects.selectScene(frame.scene.id)
    }
    const shot = projects.activeShot
    if (!shot) return
    const pan = e.shiftKey || e.button === 1 || e.button === 2 || e.altKey
    drag = {
      kind: pan ? 'pan' : 'rotate',
      x: e.clientX,
      y: e.clientY,
      rx: shot.rotateX,
      ry: shot.rotateY,
      ox: shot.offsetX,
      oy: shot.offsetY,
      upp: studio.engine.unitsPerPixel() * pixelRatio(),
      lastTick: 0
    }
  }
  interacting.value = true
  canvas.value.setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onPointerMove(e) {
  if (!drag) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  if (drag.kind === 'rotate') {
    const rotateY = Math.round((drag.ry + dx * 0.3) * 10) / 10
    const rotateX = clamp(Math.round((drag.rx + dy * 0.3) * 10) / 10, -89, 89)
    projects.updateActiveShot({ rotateX, rotateY })
    const moved = Math.floor((Math.abs(dx) + Math.abs(dy)) / 14)
    if (moved !== drag.lastTick) {
      drag.lastTick = moved
      ui.click('tick', 0.15)
    }
  } else if (drag.kind === 'pan') {
    projects.updateActiveShot({
      offsetX: Math.round(clamp(drag.ox + dx * drag.upp, -1.5, 1.5) * 1000) / 1000,
      offsetY: Math.round(clamp(drag.oy - dy * drag.upp, -1.5, 1.5) * 1000) / 1000
    })
  } else if (drag.kind === 'text') {
    const rect = canvas.value.getBoundingClientRect()
    projects.updateScene(drag.sceneId, {
      offsetX: Math.round(clamp(drag.ox + dx / rect.width, -0.45, 0.45) * 1000) / 1000,
      offsetY: Math.round(clamp(drag.oy + dy / rect.height, -0.45, 0.45) * 1000) / 1000
    })
  }
}

function onPointerUp(e) {
  if (!drag) return
  drag = null
  interacting.value = false
  try {
    canvas.value.releasePointerCapture(e.pointerId)
  } catch {
    // already released
  }
}

function onWheel(e) {
  const shot = projects.activeShot
  if (!shot || isEmpty.value) return
  e.preventDefault()
  const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
  const zoom = clamp(shot.zoom * factor, ZOOM_LIMITS.min, ZOOM_LIMITS.max)
  projects.updateActiveShot({ zoom: Math.round(zoom * 1000) / 1000 })
}

function onDblClick() {
  if (!projects.activeShot || isEmpty.value) return
  projects.resetShot()
  ui.click('release', 0.3)
}

// Text box outline for dragging text / logo scenes.
watch(
  () => [currentFrame.value?.scene, frameSize.value, currentFrame.value?.type],
  () => {
    const frame = currentFrame.value
    if (!frame || frame.type === 'shot') {
      textBox.value = null
      return
    }
    if (frame.type === 'text') {
      const c = document.createElement('canvas').getContext('2d')
      textBox.value = measureTextBox(c, frameSize.value.width, frameSize.value.height, frame.scene)
    } else {
      const size = 0.34 * (frame.scene.scale || 1) * Math.min(frameSize.value.width, frameSize.value.height)
      textBox.value = {
        x: 0.5 + (frame.scene.offsetX || 0) - size / 2 / frameSize.value.width,
        y: 0.5 + (frame.scene.offsetY || 0) - size / 2 / frameSize.value.height,
        w: size / frameSize.value.width,
        h: size / frameSize.value.height
      }
    }
  },
  { deep: true, immediate: true }
)

// ---------------------------------------------------------------- drop zone

function onDragEnter(e) {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return
  dragDepth.value++
}
function onDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}
function onDrop(e) {
  dragDepth.value = 0
  const files = e.dataTransfer?.files
  if (files?.length) intake(files, { purpose: 'add' })
}

// ---------------------------------------------------------------- lifecycle

onMounted(() => {
  try {
    studio = getStudio()
    studio.engine.setPerformance(ui.settings.performance)
  } catch (err) {
    failed.value = 'O WebGL não está disponível neste navegador, então o estúdio 3D não pode iniciar.'
    console.error(err)
    return
  }
  ctx = canvas.value.getContext('2d')
  offInvalidate = onStudioInvalidate(() => {
    invalidate()
    scheduleThumbnail()
  })
  ro = new ResizeObserver(measure)
  ro.observe(host.value)
  measure()
  raf = requestAnimationFrame(loop)
  scheduleThumbnail()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  offInvalidate?.()
  clearTimeout(thumbTimer)
  clearTimeout(reticleTimer)
  studio?.pauseAllVideos(project.value)
})
</script>

<template>
  <div
    ref="host"
    class="stage"
    :class="{ 'is-dragging': dragDepth > 0 }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="frame" :class="{ checkerboard: transparent, interacting }" :style="{ width: frameSize.width + 'px', height: frameSize.height + 'px' }">
      <canvas
        ref="canvas"
        class="stage-canvas"
        :class="{ 'is-focus-picking': ui.focusPicking, 'is-empty': isEmpty }"
        aria-label="Prévia do estúdio"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
        @dblclick="onDblClick"
        @contextmenu.prevent
      />

      <span v-if="focusPoint && !isEmpty && !projects.playing && (reticleVisible || ui.focusPicking)" class="focus-reticle" :style="{ left: focusPoint.x * 100 + '%', top: focusPoint.y * 100 + '%' }" aria-hidden="true">
        <span class="c tl" /><span class="c tr" /><span class="c br" /><span class="c bl" />
      </span>

      <div
        v-if="textBox && !projects.playing"
        class="text-box"
        :style="{ left: textBox.x * 100 + '%', top: textBox.y * 100 + '%', width: textBox.w * 100 + '%', height: textBox.h * 100 + '%' }"
        aria-hidden="true"
      >
        <span class="text-box-tag"><i class="pi pi-arrows-alt" /> Arrastar {{ currentFrame?.type === 'logo' ? 'logo' : 'texto' }}</span>
      </div>

      <InterestOverlay v-if="ui.areaSelecting && projects.composeAssetId" />

      <div v-if="isEmpty" class="empty">
        <template v-if="mode === 'photo'">
          <div class="empty-icon"><i class="pi pi-image" /></div>
          <strong>Solte sua imagem ou vídeo aqui</strong>
          <span class="pp-muted">PNG, JPG, WEBP, AVIF, GIF · MP4, MOV, WEBM</span>
          <div class="empty-actions">
            <Button label="Adicionar mídia" icon="pi pi-plus" size="small" @click="ui.openLibrary('add')" />
          </div>
        </template>
        <template v-else>
          <div class="empty-icon"><i class="pi pi-video" /></div>
          <strong>Adicione uma cena para começar seu vídeo</strong>
          <span class="pp-muted">As cenas tocam uma após a outra na linha do tempo.</span>
          <div class="empty-actions">
            <Button label="Mídia" icon="pi pi-images" size="small" @click="ui.openLibrary('add')" />
            <Button label="Cena de texto" icon="pi pi-align-left" size="small" severity="secondary" @click="projects.addTextScene()" />
            <Button label="Logo" icon="pi pi-star" size="small" severity="secondary" @click="ui.openLibrary('logo')" />
          </div>
        </template>
      </div>

      <div v-if="failed" class="empty is-error">
        <div class="empty-icon"><i class="pi pi-exclamation-triangle" /></div>
        <strong>Não foi possível carregar</strong>
        <span class="pp-muted">{{ failed }}</span>
      </div>
    </div>

    <div v-if="ui.focusPicking" class="focus-hint pp-glass">
      <i class="pi pi-bullseye" /> Clique para definir o foco <span class="pp-kbd">Esc</span>
    </div>

    <div v-if="dragDepth > 0" class="drop-overlay">
      <div class="drop-card">
        <i class="pi pi-cloud-upload" />
        <strong>Solte sua imagem ou vídeo aqui</strong>
        <span class="pp-muted">{{ mode === 'video' ? 'Cada arquivo vira uma nova cena' : 'Ela será colocada na tela' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12px;
  overflow: hidden;
}
.frame {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--pp-stage-shadow);
  background: var(--pp-stage-bg);
}
.stage-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}
.frame.interacting .stage-canvas {
  cursor: grabbing;
}
.stage-canvas.is-focus-picking {
  cursor: crosshair;
}
.stage-canvas.is-empty {
  cursor: default;
  opacity: 0.35;
}
.focus-reticle {
  position: absolute;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.focus-reticle .c {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 2px solid #ffd84d;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}
.c.tl { left: 0; top: 0; border-right: 0; border-bottom: 0; }
.c.tr { right: 0; top: 0; border-left: 0; border-bottom: 0; }
.c.br { right: 0; bottom: 0; border-left: 0; border-top: 0; }
.c.bl { left: 0; bottom: 0; border-right: 0; border-top: 0; }
.text-box {
  position: absolute;
  border: 1.5px dashed #2f7bff;
  border-radius: 6px;
  pointer-events: none;
  margin: -8px;
  padding: 8px;
  box-sizing: content-box;
}
.text-box-tag {
  position: absolute;
  top: -24px;
  left: 0;
  font-size: 11px;
  background: #2f7bff;
  color: #fff;
  padding: 2px 7px;
  border-radius: 6px;
  white-space: nowrap;
}
.text-box-tag .pi {
  font-size: 10px;
}
.empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 20px;
  background: radial-gradient(circle at 50% 40%, rgba(var(--pp-fg-rgb), 0.04), transparent 60%);
}
.empty-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: rgba(var(--pp-fg-rgb), 0.07);
  border: 1px solid var(--pp-border);
  margin-bottom: 6px;
}
.empty-icon .pi {
  font-size: 20px;
}
.empty strong {
  font-size: 15px;
}
.empty span {
  font-size: 12px;
}
.empty-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.empty.is-error {
  background: var(--pp-bg);
}
.focus-hint {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
}
.drop-overlay {
  position: absolute;
  inset: 8px;
  border-radius: 18px;
  border: 2px dashed rgba(var(--pp-fg-rgb), 0.35);
  background: color-mix(in srgb, var(--pp-bg) 75%, transparent);
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: 5;
}
.drop-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.drop-card .pi {
  font-size: 28px;
  margin-bottom: 4px;
}
</style>
