<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import { useRollStore } from '@/stores/roll'
import { getStudio } from '@/composables/studio'
import { capturePhoto, recordVideo, outputSize } from '@/lib/exporter'
import { PHOTO_SIZES, PHOTO_FORMATS, VIDEO_RESOLUTIONS, VIDEO_FPS, VIDEO_QUALITIES } from '@/lib/defaults'
import { downloadBlob, formatBytes, formatTime, slugify } from '@/lib/util'
import { playSound } from '@/lib/sound'

const projects = useProjectsStore()
const ui = useUiStore()
const roll = useRollStore()
const toast = useToast()

const visible = computed({
  get: () => ui.exportOpen,
  set: (v) => {
    if (!v && ui.exporting) return
    ui.exportOpen = v
  }
})

const mode = computed(() => projects.mode)
const photo = ref({ size: 1920, format: 'image/png' })
const video = ref({ size: 1920, fps: 30, quality: 0.18 })
const progress = ref(null) // { phase, progress }
const result = ref(null)
const previewUrl = ref('')
const error = ref('')
let controller = null

const dims = computed(() => outputSize(projects.current?.ratio, mode.value === 'photo' ? photo.value.size : video.value.size))
const canRecord = computed(() => projects.duration > 0)
const hasMedia = computed(() => !!projects.current?.activeAssetId)

watch(visible, (v) => {
  if (v) reset()
})

function reset() {
  progress.value = null
  error.value = ''
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  result.value = null
}

async function start() {
  error.value = ''
  ui.exporting = true
  projects.playing = false
  controller = new AbortController()
  const studio = getStudio()
  try {
    let out
    if (mode.value === 'photo') {
      progress.value = { phase: 'capturing', progress: 0.5 }
      playSound('shutter', 0.35)
      out = await capturePhoto(studio, projects.current, { longEdge: photo.value.size, format: photo.value.format, quality: 0.95 })
    } else {
      progress.value = { phase: 'rendering', progress: 0 }
      out = await recordVideo(studio, projects.current, {
        longEdge: video.value.size,
        fps: video.value.fps,
        quality: video.value.quality,
        signal: controller.signal,
        onProgress: (p) => (progress.value = p)
      })
    }
    result.value = out
    previewUrl.value = URL.createObjectURL(out.blob)
    await roll.add({
      kind: out.kind,
      blob: out.blob,
      mime: out.mime,
      width: out.width,
      height: out.height,
      size: out.size,
      duration: out.duration ?? null,
      frameRate: out.frameRate ?? null,
      thumbnail: out.thumbnail,
      projectId: projects.current.id,
      projectName: projects.current.name
    })
    playSound('success', 0.3)
  } catch (err) {
    if (err?.name === 'AbortError') {
      toast.add({ severity: 'info', summary: 'Gravação cancelada', life: 1800 })
    } else {
      console.error(err)
      error.value = err?.message || 'Falha na exportação'
    }
  } finally {
    progress.value = null
    ui.exporting = false
    controller = null
  }
}

function cancel() {
  controller?.abort()
}

function extFor(mime) {
  return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' }[mime] || 'bin'
}

function download() {
  if (!result.value) return
  const name = `${slugify(projects.current.name)}-${Date.now().toString(36)}.${extFor(result.value.mime)}`
  downloadBlob(result.value.blob, name)
}

async function copyImage() {
  try {
    let blob = result.value.blob
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob)
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      c.getContext('2d').drawImage(bmp, 0, 0)
      blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast.add({ severity: 'success', summary: 'Copiado para a área de transferência', life: 1500 })
  } catch {
    toast.add({ severity: 'warn', summary: 'Este navegador não permite copiar imagens', life: 2500 })
  }
}

const phaseLabel = computed(() => {
  const p = progress.value
  if (!p) return ''
  if (p.phase === 'capturing') return 'Capturando…'
  if (p.phase === 'finalizing') return 'Finalizando…'
  if (p.phase === 'recording') return 'Gravando em tempo real…'
  return `Renderizando quadros · ${Math.round(p.progress * 100)}%`
})

onBeforeUnmount(() => {
  controller?.abort()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="mode === 'photo' ? 'Capturar foto' : 'Gravar vídeo'" :style="{ width: 'min(620px, 94vw)' }" :draggable="false" :closable="!ui.exporting">
    <!-- Result -->
    <div v-if="result" class="result">
      <div class="preview checkerboard">
        <img v-if="result.kind === 'image'" :src="previewUrl" alt="Prévia da captura" />
        <video v-else :src="previewUrl" controls autoplay loop muted playsinline />
      </div>
      <dl class="meta" aria-label="Detalhes da captura">
        <div title="Resolução"><dt>Resolução</dt><dd>{{ result.width }} × {{ result.height }}</dd></div>
        <div title="Tamanho do arquivo"><dt>Tamanho</dt><dd>{{ formatBytes(result.size) }}</dd></div>
        <div v-if="result.duration" title="Duração"><dt>Duração</dt><dd>{{ formatTime(result.duration) }}</dd></div>
        <div :title="result.kind === 'video' ? 'Formato e taxa de quadros' : 'Formato'">
          <dt>Formato</dt>
          <dd>{{ result.mime.split('/')[1].toUpperCase().replace('JPEG', 'JPG') }}{{ result.frameRate ? ` · ${result.frameRate} FPS` : '' }}</dd>
        </div>
      </dl>
      <p class="saved"><i class="pi pi-check-circle" /> Salvo no rolo de câmera deste navegador.</p>
    </div>

    <!-- Progress -->
    <div v-else-if="progress" class="progress">
      <ProgressSpinner v-if="progress.phase === 'capturing'" style="width: 42px; height: 42px" stroke-width="4" />
      <template v-else>
        <ProgressBar :value="Math.round(progress.progress * 100)" :show-value="false" />
      </template>
      <span>{{ phaseLabel }}</span>
    </div>

    <!-- Settings -->
    <div v-else class="settings">
      <template v-if="mode === 'photo'">
        <p v-if="!hasMedia" class="warn"><i class="pi pi-info-circle" /> Adicione uma imagem ou vídeo primeiro — a captura mostraria só o fundo.</p>
        <div class="pp-field">
          <label>Tamanho</label>
          <SelectButton v-model="photo.size" :options="PHOTO_SIZES" option-label="label" option-value="value" :allow-empty="false" />
        </div>
        <div class="pp-field">
          <label>Formato</label>
          <SelectButton v-model="photo.format" :options="PHOTO_FORMATS" option-label="label" option-value="value" :allow-empty="false" />
        </div>
      </template>
      <template v-else>
        <p v-if="!canRecord" class="warn"><i class="pi pi-info-circle" /> Adicione pelo menos uma cena à linha do tempo.</p>
        <div class="pp-field">
          <label>Resolução</label>
          <SelectButton v-model="video.size" :options="VIDEO_RESOLUTIONS" option-label="label" option-value="value" :allow-empty="false" />
        </div>
        <div class="pp-field">
          <label>Taxa de quadros</label>
          <SelectButton v-model="video.fps" :options="VIDEO_FPS" option-label="label" option-value="value" :allow-empty="false" />
        </div>
        <div class="pp-field">
          <label>Qualidade</label>
          <SelectButton v-model="video.quality" :options="VIDEO_QUALITIES" option-label="label" option-value="value" :allow-empty="false" />
        </div>
      </template>
      <div class="summary">
        <span><i class="pi pi-image" /> {{ dims.width }} × {{ dims.height }}</span>
        <span v-if="mode === 'video'"><i class="pi pi-clock" /> {{ formatTime(projects.duration) }}</span>
        <span>{{ mode === 'photo' ? PHOTO_FORMATS.find((f) => f.value === photo.format)?.label : 'MP4' }}</span>
      </div>
      <p v-if="error" class="error"><i class="pi pi-exclamation-triangle" /> {{ error }}</p>
    </div>

    <template #footer>
      <template v-if="result">
        <Button label="Nova captura" severity="secondary" size="small" text @click="reset" />
        <Button v-if="result.kind === 'image'" label="Copiar" icon="pi pi-copy" severity="secondary" size="small" @click="copyImage" />
        <Button label="Baixar" icon="pi pi-download" size="small" @click="download" />
      </template>
      <template v-else-if="progress">
        <Button v-if="mode === 'video'" label="Cancelar" severity="secondary" size="small" :disabled="progress.phase === 'finalizing'" @click="cancel" />
      </template>
      <template v-else>
        <Button label="Cancelar" severity="secondary" size="small" text @click="visible = false" />
        <Button
          :label="mode === 'photo' ? 'Capturar' : 'Gravar'"
          :icon="mode === 'photo' ? 'pi pi-camera' : 'pi pi-video'"
          size="small"
          :disabled="mode === 'video' && !canRecord"
          @click="start"
        />
      </template>
    </template>
  </Dialog>
</template>

<style scoped>
.settings .pp-field {
  margin-bottom: 14px;
}
.summary {
  display: flex;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(var(--pp-fg-rgb), 0.04);
  font-size: 12px;
  color: var(--pp-muted);
  font-family: var(--pp-mono);
}
.summary .pi {
  font-size: 11px;
  margin-right: 4px;
}
.warn,
.error {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 176, 32, 0.1);
  color: #ffc861;
  margin: 0 0 14px;
}
.error {
  background: rgba(229, 72, 77, 0.12);
  color: #ff8b91;
  margin: 14px 0 0;
}
.progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 36px 10px;
}
.progress :deep(.p-progressbar) {
  width: 100%;
}
.progress span {
  font-size: 13px;
  color: var(--pp-muted);
}
.preview {
  border-radius: 12px;
  overflow: hidden;
  display: grid;
  place-items: center;
  max-height: 52vh;
}
.preview img,
.preview video {
  display: block;
  max-width: 100%;
  max-height: 52vh;
}
.meta {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 14px 0 0;
}
.meta div {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(var(--pp-fg-rgb), 0.04);
}
.meta dt {
  font-size: 10px;
  color: var(--pp-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.meta dd {
  margin: 3px 0 0;
  font-size: 12px;
  font-family: var(--pp-mono);
}
.saved {
  font-size: 12px;
  color: #7ee787;
  margin: 12px 0 0;
}
</style>
