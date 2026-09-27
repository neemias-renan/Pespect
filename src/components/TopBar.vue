<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import { useRollStore } from '@/stores/roll'
import { clearEverything } from '@/lib/db'
import { isMac } from '@/lib/util'
import BrandMark from './BrandMark.vue'
import ProjectMenu from './ProjectMenu.vue'
import ComposeBar from './ComposeBar.vue'

const projects = useProjectsStore()
const ui = useUiStore()
const roll = useRollStore()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()

const settingsMenu = ref()
const mod = isMac() ? '⌘' : 'Ctrl'

const mode = computed(() => projects.mode)

function setMode(m) {
  if (m === mode.value) return
  ui.click('toggle', 0.3)
  projects.setMode(m)
}

const settingsItems = computed(() => [
  {
    label: 'Configurações',
    items: [
      { label: ui.settings.performance ? 'Modo desempenho: ligado' : 'Modo desempenho: desligado', icon: 'pi pi-bolt', command: () => ui.setPerformance(!ui.settings.performance) },
      { label: 'Atalhos de teclado', icon: 'pi pi-th-large', command: () => (ui.shortcutsOpen = true) },
      { label: 'Dados de movimento da cena', icon: 'pi pi-code', disabled: mode.value !== 'video', command: () => (ui.sceneDataOpen = true) }
    ]
  },
  { separator: true },
  { label: 'Redefinir tudo', icon: 'pi pi-refresh', command: fullReset }
])

function fullReset() {
  confirm.require({
    header: 'Redefinir tudo',
    message: 'Excluir todos os projetos, mídias e capturas salvos neste navegador? Isso não pode ser desfeito.',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Redefinir tudo',
    rejectLabel: 'Cancelar',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-secondary',
    accept: async () => {
      await clearEverything()
      toast.add({ severity: 'success', summary: 'Tudo foi redefinido', life: 1500 })
      setTimeout(() => window.location.assign(import.meta.env.BASE_URL), 400)
    }
  })
}

function openExport() {
  ui.click('toggle', 0.3)
  ui.exportOpen = true
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <router-link to="/" class="brand" aria-label="Início do Pespect">
        <BrandMark :size="24" />
        <span class="brand-name">Pespect</span>
      </router-link>
      <span class="divider" />
      <ProjectMenu />
      <button class="pp-icon-btn hide-sm" @click="ui.openLibrary('add')" v-tooltip.bottom="'Biblioteca (L)'">
        <i class="pi pi-images" /> Biblioteca
      </button>
    </div>

    <div class="topbar-center">
      <div class="mode-toggle" role="tablist" aria-label="Modo do estúdio">
        <button role="tab" :aria-selected="mode === 'photo'" :class="{ active: mode === 'photo' }" @click="setMode('photo')" v-tooltip.bottom="'Modo foto (P)'">
          <i class="pi pi-camera" /> FOTO
        </button>
        <button role="tab" :aria-selected="mode === 'video'" :class="{ active: mode === 'video' }" @click="setMode('video')" v-tooltip.bottom="'Modo vídeo (V)'">
          <i class="pi pi-video" /> VÍDEO
        </button>
        <span class="mode-indicator" :class="mode" />
      </div>
      <ComposeBar />
    </div>

    <div class="topbar-right">
      <button class="pp-icon-btn" :disabled="!projects.canUndo" @click="projects.undo()" v-tooltip.bottom="`Desfazer (${mod}+Z)`" aria-label="Desfazer">
        <i class="pi pi-undo" />
      </button>
      <button class="pp-icon-btn" :disabled="!projects.canRedo" @click="projects.redo()" v-tooltip.bottom="`Refazer (${mod}+Shift+Z)`" aria-label="Refazer">
        <i class="pi pi-refresh" />
      </button>
      <span class="divider" />
      <button class="pp-icon-btn" @click="ui.rollOpen = true" v-tooltip.bottom="'Rolo de câmera'">
        <i class="pi pi-th-large" />
        <span class="hide-sm">Capturas</span>
        <span v-if="roll.items.length" class="count">{{ roll.items.length }}</span>
      </button>
      <button class="pp-icon-btn hide-md" @click="router.push('/showcase')">Vitrine</button>
      <button class="pp-icon-btn" :aria-label="ui.settings.sound ? 'Silenciar sons' : 'Ativar sons'" @click="ui.setSound(!ui.settings.sound)" v-tooltip.bottom="ui.settings.sound ? 'Som ligado' : 'Som desligado'">
        <i :class="ui.settings.sound ? 'pi pi-volume-up' : 'pi pi-volume-off'" />
      </button>
      <button class="pp-icon-btn" :aria-label="ui.isLight ? 'Tema escuro' : 'Tema claro'" @click="ui.toggleTheme()" v-tooltip.bottom="ui.isLight ? 'Tema escuro' : 'Tema claro'">
        <i :class="ui.isLight ? 'pi pi-moon' : 'pi pi-sun'" />
      </button>
      <button class="pp-icon-btn" aria-label="Configurações" @click="(e) => settingsMenu.toggle(e)" v-tooltip.bottom="'Configurações'">
        <i class="pi pi-cog" />
      </button>
      <Menu ref="settingsMenu" :model="settingsItems" popup />
      <button class="pp-icon-btn" :class="{ 'is-active': ui.settings.panelOpen }" aria-label="Mostrar ou ocultar painel" @click="ui.togglePanel()" v-tooltip.bottom="'Mostrar ou ocultar painel'">
        <i class="pi pi-sliders-h" />
      </button>
      <button class="pp-icon-btn is-accent capture-btn" @click="openExport" v-tooltip.bottom="`${mode === 'photo' ? 'Capturar' : 'Gravar'} (${mod}+E)`">
        <span class="rec-dot" :class="mode" />
        {{ mode === 'photo' ? 'Capturar' : 'Gravar' }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 56px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
}
.topbar-left,
.topbar-right,
.topbar-center {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.topbar-center {
  gap: 10px;
}
.topbar-right {
  justify-content: flex-end;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  padding: 4px 6px;
  border-radius: 10px;
}
.brand-name {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.01em;
}
.divider {
  width: 1px;
  height: 20px;
  background: var(--pp-border-strong);
  margin: 0 6px;
}
.mode-toggle {
  position: relative;
  display: flex;
  padding: 3px;
  border-radius: 12px;
  background: rgba(var(--pp-fg-rgb), 0.05);
  border: 1px solid var(--pp-border);
}
.mode-toggle button {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: 92px;
  justify-content: center;
  height: 30px;
  border: 0;
  background: transparent;
  color: var(--pp-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color 0.2s;
}
.mode-toggle button.active {
  color: var(--pp-invert-fg);
}
.mode-toggle button .pi {
  font-size: 12px;
}
.mode-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 92px;
  height: 30px;
  border-radius: 9px;
  background: var(--pp-invert-bg);
  transition: transform 0.28s cubic-bezier(0.3, 1.3, 0.5, 1);
}
.mode-indicator.video {
  transform: translateX(92px);
}
.count {
  font-size: 10px;
  font-weight: 700;
  background: rgba(var(--pp-fg-rgb), 0.12);
  border-radius: 8px;
  padding: 1px 6px;
}
.capture-btn {
  margin-left: 4px;
  padding: 0 14px;
}
.rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
}
.rec-dot.video {
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
@media (max-width: 1280px) {
  .hide-md {
    display: none;
  }
}
@media (max-width: 1100px) {
  .hide-sm,
  .brand-name {
    display: none;
  }
}
</style>
