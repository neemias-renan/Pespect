<script setup>
import { computed, nextTick, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import { formatDate } from '@/lib/util'

const projects = useProjectsStore()
const ui = useUiStore()
const confirm = useConfirm()
const panel = ref()
const nameInput = ref()
const renaming = ref(false)
const draft = ref('')

const current = computed(() => projects.current)

function toggle(e) {
  panel.value.toggle(e)
}

async function startRename() {
  draft.value = current.value.name
  renaming.value = true
  await nextTick()
  nameInput.value?.$el?.focus?.()
  nameInput.value?.$el?.select?.()
}

async function commitRename() {
  if (!renaming.value) return
  renaming.value = false
  await projects.renameProject(current.value.id, draft.value)
}

function open(id) {
  projects.saveNow()
  projects.open(id)
  ui.click('toggle', 0.3)
  panel.value.hide()
}

async function create() {
  await projects.saveNow()
  await projects.newProject({ name: 'Sem título' })
  panel.value.hide()
  ui.openLibrary('add')
}

async function duplicate(id) {
  const copy = await projects.duplicateProject(id)
  if (copy) open(copy.id)
}

function remove(project) {
  confirm.require({
    header: 'Excluir projeto',
    message: `Excluir “${project.name}”? As mídias continuam na sua biblioteca.`,
    icon: 'pi pi-trash',
    acceptLabel: 'Excluir',
    rejectLabel: 'Cancelar',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-secondary',
    accept: () => {
      ui.click('delete')
      projects.deleteProject(project.id)
    }
  })
}
</script>

<template>
  <div class="project-menu">
    <button class="project-button" aria-label="Projetos" @click="toggle">
      <span class="thumb" :style="current?.thumbnail ? { backgroundImage: `url(${current.thumbnail})` } : null" />
      <span class="name">{{ current?.name || 'Sem título' }}</span>
      <i class="pi pi-chevron-down" />
    </button>

    <OverlayPanel ref="panel" class="project-panel">
      <div class="panel-head">
        <InputText
          v-if="renaming"
          ref="nameInput"
          v-model="draft"
          aria-label="Nome do projeto"
          placeholder="Sem título"
          class="w-full"
          @keydown.enter="commitRename"
          @keydown.esc="renaming = false"
          @blur="commitRename"
        />
        <div v-else class="current-row">
          <div class="current-meta">
            <strong>{{ current?.name }}</strong>
            <span class="pp-muted">{{ current?.assetIds.length || 0 }} mídias · {{ current?.scenes.length || 0 }} cenas</span>
          </div>
          <button class="pp-icon-btn" v-tooltip.bottom="'Renomear'" @click="startRename"><i class="pi pi-pencil" /></button>
          <button class="pp-icon-btn" v-tooltip.bottom="'Duplicar'" @click="duplicate(current.id)"><i class="pi pi-copy" /></button>
        </div>
      </div>

      <div class="pp-label list-label">Projetos <span class="pp-muted">{{ projects.list.length }}</span></div>
      <div class="project-list">
        <div v-for="p in projects.sortedList" :key="p.id" class="project-item" :class="{ active: p.id === current?.id }" @click="open(p.id)">
          <span class="item-thumb" :style="p.thumbnail ? { backgroundImage: `url(${p.thumbnail})` } : null" />
          <span class="item-meta">
            <span class="item-name">{{ p.name }}</span>
            <span class="item-date">{{ formatDate(p.updatedAt) }}</span>
          </span>
          <span v-if="p.id === current?.id" class="open-now">Aberto</span>
          <button v-else class="pp-icon-btn item-del" aria-label="Excluir projeto" @click.stop="remove(p)"><i class="pi pi-trash" /></button>
        </div>
      </div>

      <div class="panel-actions">
        <Button label="Novo projeto" icon="pi pi-plus" size="small" @click="create" />
        <Button label="Excluir" icon="pi pi-trash" size="small" severity="secondary" text @click="remove(current)" />
      </div>
    </OverlayPanel>
  </div>
</template>

<style scoped>
.project-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px 0 5px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pp-text);
  cursor: pointer;
  max-width: 260px;
}
.project-button:hover {
  background: var(--pp-hover);
}
.thumb,
.item-thumb {
  width: 34px;
  height: 22px;
  border-radius: 5px;
  background: var(--pp-thumb-bg) center / cover no-repeat;
  border: 1px solid var(--pp-border);
  flex-shrink: 0;
}
.name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.project-button .pi {
  font-size: 10px;
  color: var(--pp-muted);
}
.panel-head {
  width: 340px;
  margin-bottom: 12px;
}
.current-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.current-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.current-meta span {
  font-size: 12px;
}
.list-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.project-list {
  max-height: 300px;
  overflow: auto;
  margin: 0 -6px;
}
.project-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 6px;
  border-radius: 9px;
  cursor: pointer;
}
.project-item:hover {
  background: var(--pp-hover);
}
.project-item.active {
  background: rgba(var(--pp-fg-rgb), 0.07);
}
.item-thumb {
  width: 48px;
  height: 30px;
}
.item-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.item-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-date {
  font-size: 11px;
  color: var(--pp-muted);
}
.open-now {
  font-size: 11px;
  color: var(--pp-accent);
  font-weight: 600;
}
.item-del {
  opacity: 0;
}
.project-item:hover .item-del {
  opacity: 1;
}
.panel-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--pp-border);
}
</style>
