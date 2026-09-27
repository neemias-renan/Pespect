<script setup>
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import { getStudio } from '@/composables/studio'
import { composeShots } from '@/lib/compose'

const projects = useProjectsStore()
const library = useLibraryStore()
const ui = useUiStore()
const toast = useToast()

const assetId = computed(() => projects.composeAssetId)
const count = computed(() => projects.areasFor(assetId.value).length)

function toggleSelect() {
  if (!assetId.value) {
    toast.add({ severity: 'warn', summary: 'Adicione uma mídia primeiro', detail: 'As áreas de interesse são marcadas sobre um screenshot ou gravação.', life: 2600 })
    return
  }
  ui.areaSelecting = !ui.areaSelecting
  ui.focusPicking = false
  ui.click('toggle', 0.3)
}

function clearAreas() {
  projects.setAreas(assetId.value, [])
  ui.click('delete')
}

function compose() {
  const id = assetId.value
  const asset = library.get(id)
  if (!asset) {
    toast.add({ severity: 'warn', summary: 'Adicione uma mídia primeiro', life: 2200 })
    ui.openLibrary('add')
    return
  }
  const areas = projects.areasFor(id)
  const comp = composeShots({ engine: getStudio().engine, project: projects.current, asset, areas })
  const { scene, replaced } = projects.addComposedScene(id, comp)
  ui.areaSelecting = false
  ui.click('release', 0.3)
  toast.add({
    severity: 'success',
    summary: 'Cena composta',
    detail: `${areas.length ? `A câmera percorre ${areas.length} área${areas.length > 1 ? 's' : ''} de interesse.` : 'Nenhuma área marcada, então regiões interessantes foram escolhidas para você.'} ${replaced ? 'Ela substituiu a cena selecionada — desfaça para restaurar.' : 'Ela foi adicionada à linha do tempo.'}`,
    life: 2600
  })
  // Preview the new scene right away.
  const item = projects.layout.find((l) => l.scene.id === scene.id)
  if (item) {
    projects.playhead = item.start
    projects.playing = true
  }
}
</script>

<template>
  <div class="compose-bar" role="group" aria-label="Compor">
    <button class="compose-btn" @click="compose" v-tooltip.bottom="'Criar uma cena que percorre suas áreas de interesse'">
      <i class="pi pi-sparkles" /> Compor
    </button>
    <button class="icon-btn" :class="{ active: ui.areaSelecting }" aria-label="Seleção de áreas" @click="toggleSelect" v-tooltip.bottom="'Marcar áreas de interesse'">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
        <circle cx="12" cy="12" r="2.6" />
      </svg>
      <span v-if="count" class="badge">{{ count }}</span>
    </button>
    <button class="icon-btn" :disabled="!count" aria-label="Limpar áreas de interesse" @click="clearAreas" v-tooltip.bottom="'Limpar áreas'">
      <i class="pi pi-trash" />
    </button>
  </div>
</template>

<style scoped>
.compose-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 14px;
  background: #121215;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}
.compose-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  background: #2f7bff;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.compose-btn:hover {
  background: #4a8cff;
}
.compose-btn:active {
  transform: scale(0.95);
}
.compose-btn .pi {
  font-size: 12px;
}
.icon-btn {
  position: relative;
  width: 34px;
  height: 30px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #ededf0;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.icon-btn.active {
  background: rgba(47, 123, 255, 0.25);
  color: #7fb0ff;
}
.icon-btn .pi {
  font-size: 13px;
}
.badge {
  position: absolute;
  top: -3px;
  right: 1px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #2f7bff;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
  border: 2px solid #121215;
}
</style>
