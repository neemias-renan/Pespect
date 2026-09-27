<script setup>
import { computed, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import { useMedia } from '@/composables/useMedia'
import { formatLabel, isVideoMime } from '@/lib/media'
import { formatBytes, formatTime, isMac } from '@/lib/util'

const projects = useProjectsStore()
const library = useLibraryStore()
const ui = useUiStore()
const confirm = useConfirm()
const { applyAssets, intake } = useMedia()

const tab = ref('project')
const selected = ref([])
const dropping = ref(false)
const mod = isMac() ? '⌘' : 'Ctrl'

const visible = computed({
  get: () => ui.library.open,
  set: (v) => (ui.library.open = v)
})
const purpose = computed(() => ui.library.purpose)
const multi = computed(() => purpose.value === 'add')

const title = computed(() => {
  switch (purpose.value) {
    case 'backdrop': return 'Escolha uma mídia · Fundo'
    case 'logo': return 'Adicione um logo em PNG ou SVG'
    case 'replace': return 'Escolha uma mídia'
    default: return `${projects.current?.name || 'Projeto'} / Mídias`
  }
})

const tabs = computed(() => [
  { id: 'project', label: 'Este projeto', count: projectAssets.value.length },
  { id: 'all', label: 'Todas as mídias', count: library.userAssets.length },
  { id: 'demo', label: 'Demo', count: library.demoAssets.length }
])

const projectAssets = computed(() => (projects.current?.assetIds || []).map((id) => library.get(id)).filter(Boolean))

const items = computed(() => {
  let list
  if (tab.value === 'project') list = projectAssets.value
  else if (tab.value === 'all') list = library.userAssets
  else list = library.demoAssets
  if (purpose.value === 'backdrop' || purpose.value === 'logo') list = list.filter((a) => !isVideoMime(a.mime))
  return list
})

watch(visible, (v) => {
  if (v) {
    selected.value = []
    if (!projectAssets.value.length) tab.value = library.userAssets.length ? 'all' : 'demo'
  }
})

function onCardClick(asset, e) {
  if (multi.value && (e.metaKey || e.ctrlKey || e.shiftKey)) {
    const i = selected.value.indexOf(asset.id)
    if (i >= 0) selected.value.splice(i, 1)
    else selected.value.push(asset.id)
    ui.click('toggle', 0.25)
    return
  }
  if (selected.value.length) {
    if (!selected.value.includes(asset.id)) selected.value.push(asset.id)
    useSelection()
    return
  }
  applyAssets([asset.id], purpose.value)
  visible.value = false
}

function useSelection() {
  if (!selected.value.length) return
  applyAssets([...selected.value], purpose.value)
  selected.value = []
  visible.value = false
}

function pick() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = multi.value
  input.accept = purpose.value === 'logo' || purpose.value === 'backdrop'
    ? '.png,.svg,.webp,.jpg,.jpeg,.avif,image/*'
    : '.png,.jpg,.jpeg,.webp,.avif,.gif,.svg,.mp4,.mov,.webm,image/*,video/mp4,video/quicktime,video/webm'
  input.onchange = () => upload(input.files)
  input.click()
}

async function upload(files) {
  const added = await intake(files, { purpose: purpose.value })
  if (added.length) visible.value = false
}

function onDrop(e) {
  dropping.value = false
  if (e.dataTransfer?.files?.length) upload(e.dataTransfer.files)
}

function removeFromProject(asset) {
  projects.removeAssetFromProject(asset.id)
  ui.click('delete')
}

function deleteAsset(asset) {
  confirm.require({
    header: 'Excluir',
    message: `Excluir “${asset.name}” deste dispositivo? As cenas que a usam serão removidas.`,
    icon: 'pi pi-trash',
    acceptLabel: 'Excluir',
    rejectLabel: 'Cancelar',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-secondary',
    accept: async () => {
      if (projects.current?.assetIds.includes(asset.id)) projects.removeAssetFromProject(asset.id)
      await library.remove(asset.id)
      ui.click('delete')
    }
  })
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="title" :style="{ width: 'min(880px, 94vw)' }" :draggable="false" class="library-dialog" :dismissable-mask="true">
    <div class="lib-top">
      <div class="lib-tabs" role="tablist">
        <button v-for="t in tabs" :key="t.id" role="tab" :class="{ active: tab === t.id }" @click="tab = t.id">
          {{ t.label }} <span>{{ t.count }}</span>
        </button>
      </div>
      <span v-if="multi" class="lib-hint">Clique para adicionar · {{ mod }}+clique ou Shift+clique para selecionar várias</span>
      <span v-else class="lib-hint">Clique em uma mídia para usá-la</span>
    </div>

    <div class="lib-grid" :class="{ dropping }" @dragover.prevent="dropping = true" @dragleave.prevent="dropping = false" @drop.prevent="onDrop">
      <button class="upload" @click="pick">
        <i class="pi pi-cloud-upload" />
        <strong>Enviar mídia</strong>
        <span>{{ purpose === 'logo' ? 'Sobreposição em PNG ou SVG' : 'PNG, JPG, WEBP, AVIF, GIF · MP4, MOV, WEBM' }}</span>
        <span class="small">Clique para procurar ou arraste e solte</span>
      </button>

      <div
        v-for="asset in items"
        :key="asset.id"
        class="card"
        :class="{ selected: selected.includes(asset.id), active: asset.id === projects.current?.activeAssetId && projects.mode === 'photo' }"
        role="button"
        tabindex="0"
        @click="onCardClick(asset, $event)"
        @keydown.enter="onCardClick(asset, $event)"
      >
        <div class="card-thumb" :class="{ checkerboard: asset.kind === 'logo' || asset.mime === 'image/svg+xml' }" :style="{ backgroundImage: `url(${asset.thumbnail})` }">
          <span v-if="asset.demo" class="demo">DEMO</span>
          <span v-if="isVideoMime(asset.mime)" class="dur pp-mono"><i class="pi pi-play" /> {{ formatTime(asset.duration, false) }}</span>
          <span v-if="selected.includes(asset.id)" class="check"><i class="pi pi-check" /></span>
          <div class="card-actions" @click.stop>
            <button v-tooltip.top="isVideoMime(asset.mime) ? 'Aparar e cortar vídeo' : 'Cortar foto'" :aria-label="isVideoMime(asset.mime) ? 'Aparar e cortar vídeo' : 'Cortar foto'" @click="ui.cropAssetId = asset.id"><i class="pi pi-stop" /></button>
            <button v-if="tab === 'project'" v-tooltip.top="'Remover do projeto'" aria-label="Remover do projeto" @click="removeFromProject(asset)"><i class="pi pi-minus-circle" /></button>
            <button v-if="!asset.demo" v-tooltip.top="'Excluir'" aria-label="Excluir" @click="deleteAsset(asset)"><i class="pi pi-trash" /></button>
          </div>
        </div>
        <div class="card-meta">
          <strong>{{ asset.name }}</strong>
          <span>{{ asset.width }} × {{ asset.height }} · {{ formatLabel(asset.mime) }}</span>
        </div>
      </div>

      <div v-if="!items.length" class="empty-tab">
        <span class="pp-muted">{{ tab === 'project' ? 'Ainda não há mídias neste projeto.' : 'Nada por aqui ainda — envie uma imagem ou uma gravação de tela.' }}</span>
      </div>
    </div>

    <template #footer>
      <div class="lib-footer">
        <span class="pp-muted storage"><i class="pi pi-lock" /> Salvo neste dispositivo · {{ formatBytes(library.storageBytes()) }}</span>
        <div class="flex gap-2">
          <Button v-if="selected.length" :label="`Usar seleção (${selected.length})`" icon="pi pi-check" size="small" @click="useSelection" />
          <Button label="Fechar" size="small" severity="secondary" @click="visible = false" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.lib-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.lib-tabs {
  display: flex;
  gap: 4px;
  background: rgba(var(--pp-fg-rgb), 0.04);
  border: 1px solid var(--pp-border);
  border-radius: 10px;
  padding: 3px;
}
.lib-tabs button {
  border: 0;
  background: transparent;
  color: var(--pp-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 7px;
  cursor: pointer;
}
.lib-tabs button span {
  font-weight: 500;
  opacity: 0.7;
  margin-left: 3px;
}
.lib-tabs button.active {
  background: rgba(var(--pp-fg-rgb), 0.12);
  color: var(--pp-strong);
}
.lib-hint {
  font-size: 12px;
  color: var(--pp-muted);
}
.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  max-height: 56vh;
  overflow: auto;
  padding: 4px;
  border-radius: 12px;
  transition: background 0.15s;
}
.lib-grid.dropping {
  background: rgba(255, 91, 58, 0.08);
  outline: 2px dashed rgba(255, 91, 58, 0.5);
}
.upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 170px;
  border-radius: 12px;
  border: 1.5px dashed rgba(var(--pp-fg-rgb), 0.2);
  background: rgba(var(--pp-fg-rgb), 0.02);
  color: var(--pp-text);
  cursor: pointer;
  padding: 12px;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
}
.upload:hover {
  border-color: rgba(var(--pp-fg-rgb), 0.5);
  background: rgba(var(--pp-fg-rgb), 0.05);
}
.upload .pi {
  font-size: 22px;
  margin-bottom: 4px;
}
.upload span {
  font-size: 11px;
  color: var(--pp-muted);
}
.upload .small {
  font-size: 10px;
  opacity: 0.7;
}
.card {
  border-radius: 12px;
  border: 1.5px solid transparent;
  background: rgba(var(--pp-fg-rgb), 0.03);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.12s;
  outline: none;
}
.card:hover,
.card:focus-visible {
  border-color: rgba(var(--pp-fg-rgb), 0.25);
}
.card.active {
  border-color: rgba(var(--pp-fg-rgb), 0.4);
}
.card.selected {
  border-color: var(--pp-accent);
}
.card-thumb {
  position: relative;
  height: 118px;
  background: var(--pp-thumb-bg) center / cover no-repeat;
}
.card-thumb.checkerboard {
  background-size: contain, 18px 18px, 18px 18px, 18px 18px, 18px 18px;
  background-repeat: no-repeat, repeat, repeat, repeat, repeat;
}
.demo {
  position: absolute;
  left: 8px;
  top: 8px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
}
.dur {
  position: absolute;
  left: 8px;
  bottom: 8px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
}
.dur .pi {
  font-size: 8px;
}
.check {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--pp-accent);
  display: grid;
  place-items: center;
}
.check .pi {
  font-size: 11px;
}
.card-actions {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.card:hover .card-actions {
  opacity: 1;
}
.card-actions button {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: 0;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  cursor: pointer;
}
.card-actions button:hover {
  background: rgba(0, 0, 0, 0.9);
}
.card-actions .pi {
  font-size: 11px;
}
.card-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px 10px;
}
.card-meta strong {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-meta span {
  font-size: 11px;
  color: var(--pp-muted);
}
.empty-tab {
  grid-column: span 3;
  display: flex;
  align-items: center;
  padding: 20px;
  font-size: 12px;
}
.lib-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.storage {
  font-size: 12px;
}
.storage .pi {
  font-size: 10px;
  margin-right: 4px;
}
</style>
