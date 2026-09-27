<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useRollStore } from '@/stores/roll'
import { downloadBlob, formatBytes, formatDate, formatTime, slugify } from '@/lib/util'

const ui = useUiStore()
const roll = useRollStore()
const confirm = useConfirm()
const router = useRouter()

const tab = ref('image')
const active = ref(null)
const activeUrl = ref('')

const visible = computed({
  get: () => ui.rollOpen,
  set: (v) => (ui.rollOpen = v)
})

const items = computed(() => (tab.value === 'image' ? roll.captures : roll.recordings))

watch(visible, (v) => {
  if (!v) close()
  else if (!roll.captures.length && roll.recordings.length) tab.value = 'video'
})

function open(item) {
  close()
  active.value = item
  activeUrl.value = URL.createObjectURL(item.blob)
}

function close() {
  if (activeUrl.value) URL.revokeObjectURL(activeUrl.value)
  activeUrl.value = ''
  active.value = null
}

function download(item) {
  const ext = item.mime.split('/')[1].replace('jpeg', 'jpg')
  downloadBlob(item.blob, `${slugify(item.projectName)}-${item.id.slice(-6)}.${ext}`)
}

function remove(item) {
  confirm.require({
    header: 'Excluir',
    message: 'Excluir este item do seu rolo de câmera?',
    icon: 'pi pi-trash',
    acceptLabel: 'Excluir',
    rejectLabel: 'Cancelar',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-secondary',
    accept: async () => {
      if (active.value?.id === item.id) close()
      await roll.remove(item.id)
      ui.click('delete')
    }
  })
}

function toggleFeatured(item) {
  roll.update(item.id, { featured: !item.featured })
  ui.click('toggle', 0.3)
}

onBeforeUnmount(close)
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Rolo de câmera" :style="{ width: 'min(900px, 94vw)' }" :draggable="false" :dismissable-mask="true">
    <div v-if="active" class="viewer">
      <button class="pp-icon-btn back" @click="close"><i class="pi pi-arrow-left" /> Voltar</button>
      <div class="stage checkerboard">
        <img v-if="active.kind === 'image'" :src="activeUrl" alt="" />
        <video v-else :src="activeUrl" controls autoplay loop muted playsinline />
      </div>
      <div class="viewer-meta">
        <div class="facts">
          <span>{{ active.width }} × {{ active.height }}</span>
          <span>{{ formatBytes(active.size) }}</span>
          <span v-if="active.duration">{{ formatTime(active.duration) }}</span>
          <span>{{ active.mime.split('/')[1].toUpperCase() }}{{ active.frameRate ? ` · ${active.frameRate} FPS` : '' }}</span>
          <span class="pp-muted">{{ active.projectName }} · {{ formatDate(active.createdAt) }}</span>
        </div>
        <div class="feature">
          <InputText :model-value="active.caption" placeholder="Adicione uma legenda para o destaque" class="flex-1" @update:model-value="(v) => roll.update(active.id, { caption: v })" />
          <Button :label="active.featured ? 'Em destaque' : 'Destacar na vitrine'" :icon="active.featured ? 'pi pi-star-fill' : 'pi pi-star'" size="small" :severity="active.featured ? undefined : 'secondary'" @click="toggleFeatured(active)" />
        </div>
        <div class="flex gap-2 justify-content-end">
          <Button label="Excluir" icon="pi pi-trash" size="small" severity="secondary" text @click="remove(active)" />
          <Button label="Baixar" icon="pi pi-download" size="small" @click="download(active)" />
        </div>
      </div>
    </div>

    <template v-else>
      <div class="roll-top">
        <div class="tabs">
          <button :class="{ active: tab === 'image' }" @click="tab = 'image'">Capturas <span>{{ roll.captures.length }}</span></button>
          <button :class="{ active: tab === 'video' }" @click="tab = 'video'">Gravações <span>{{ roll.recordings.length }}</span></button>
        </div>
        <span class="pp-muted note"><i class="pi pi-lock" /> Rolo de câmera salvo neste navegador</span>
      </div>
      <div v-if="items.length" class="grid">
        <div v-for="item in items" :key="item.id" class="tile" role="button" tabindex="0" @click="open(item)" @keydown.enter="open(item)">
          <div class="tile-thumb" :style="{ backgroundImage: `url(${item.thumbnail})` }">
            <span v-if="item.kind === 'video'" class="badge pp-mono"><i class="pi pi-play" /> {{ formatTime(item.duration, false) }}</span>
            <span v-if="item.featured" class="star"><i class="pi pi-star-fill" /></span>
            <div class="tile-actions" @click.stop>
              <button aria-label="Baixar" @click="download(item)"><i class="pi pi-download" /></button>
              <button aria-label="Excluir" @click="remove(item)"><i class="pi pi-trash" /></button>
            </div>
          </div>
          <div class="tile-meta">
            <strong>{{ item.projectName }}</strong>
            <span>{{ item.width }} × {{ item.height }} · {{ formatBytes(item.size) }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty">
        <i :class="tab === 'image' ? 'pi pi-camera' : 'pi pi-video'" />
        <strong>{{ tab === 'image' ? 'Nenhuma captura ainda' : 'Nenhuma gravação ainda' }}</strong>
        <span class="pp-muted">{{ tab === 'image' ? 'Clique em Capturar no modo foto para fazer sua primeira foto.' : 'Monte uma linha do tempo no modo vídeo e clique em Gravar.' }}</span>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-content-between w-full align-items-center">
        <Button label="Abrir vitrine" icon="pi pi-external-link" size="small" text severity="secondary" @click="visible = false; router.push('/showcase')" />
        <Button label="Fechar" size="small" severity="secondary" @click="visible = false" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.roll-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 10px;
  flex-wrap: wrap;
}
.tabs {
  display: flex;
  gap: 4px;
  background: rgba(var(--pp-fg-rgb), 0.04);
  border: 1px solid var(--pp-border);
  border-radius: 10px;
  padding: 3px;
}
.tabs button {
  border: 0;
  background: transparent;
  color: var(--pp-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 7px;
  cursor: pointer;
}
.tabs button span {
  opacity: 0.7;
  font-weight: 500;
}
.tabs button.active {
  background: rgba(var(--pp-fg-rgb), 0.12);
  color: var(--pp-strong);
}
.note {
  font-size: 12px;
}
.note .pi {
  font-size: 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
  max-height: 58vh;
  overflow: auto;
}
.tile {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(var(--pp-fg-rgb), 0.03);
  border: 1.5px solid transparent;
  cursor: pointer;
}
.tile:hover {
  border-color: rgba(var(--pp-fg-rgb), 0.25);
}
.tile-thumb {
  position: relative;
  height: 120px;
  background: var(--pp-thumb-bg) center / cover no-repeat;
}
.badge {
  position: absolute;
  left: 8px;
  bottom: 8px;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 2px 6px;
  border-radius: 5px;
}
.badge .pi {
  font-size: 8px;
}
.star {
  position: absolute;
  left: 8px;
  top: 8px;
  color: #ffd84d;
}
.tile-actions {
  position: absolute;
  right: 6px;
  top: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.tile:hover .tile-actions {
  opacity: 1;
}
.tile-actions button {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  cursor: pointer;
}
.tile-actions .pi {
  font-size: 11px;
}
.tile-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px 10px;
}
.tile-meta strong {
  font-size: 12px;
}
.tile-meta span {
  font-size: 11px;
  color: var(--pp-muted);
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 50px 10px;
  text-align: center;
}
.empty .pi {
  font-size: 24px;
  color: var(--pp-muted);
  margin-bottom: 6px;
}
.empty span {
  font-size: 12px;
}
.viewer .back {
  margin-bottom: 10px;
}
.viewer .stage {
  border-radius: 12px;
  overflow: hidden;
  display: grid;
  place-items: center;
  max-height: 55vh;
}
.viewer img,
.viewer video {
  display: block;
  max-width: 100%;
  max-height: 55vh;
}
.viewer-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  font-family: var(--pp-mono);
}
.feature {
  display: flex;
  gap: 8px;
}
</style>
