<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import { isTypingTarget } from '@/lib/util'
import { useMedia } from '@/composables/useMedia'

import TopBar from '@/components/TopBar.vue'
import StageView from '@/components/StageView.vue'
import OperatorBar from '@/components/OperatorBar.vue'
import SidePanel from '@/components/SidePanel.vue'
import TimelineBar from '@/components/TimelineBar.vue'
import LibraryDialog from '@/components/LibraryDialog.vue'
import ExportDialog from '@/components/ExportDialog.vue'
import ShortcutsDialog from '@/components/ShortcutsDialog.vue'
import CameraRollDialog from '@/components/CameraRollDialog.vue'
import CropDialog from '@/components/CropDialog.vue'
import SceneDataDialog from '@/components/SceneDataDialog.vue'

const props = defineProps({ id: { type: String, default: null } })
const projects = useProjectsStore()
const ui = useUiStore()
const router = useRouter()
const toast = useToast()
const { intake } = useMedia()

const mode = computed(() => projects.mode)

// Keep the URL in sync with the open project.
watch(
  () => props.id,
  (id) => {
    if (id && id !== projects.current?.id && !projects.open(id)) router.replace('/')
  },
  { immediate: true }
)
watch(
  () => projects.current?.id,
  (id) => {
    if (id && id !== props.id) router.replace(`/p/${id}`)
  },
  { immediate: true }
)

// Persist + record history for every project edit.
watch(
  () => projects.current,
  () => projects.touch(),
  { deep: true }
)

function onKeydown(e) {
  if (isTypingTarget(e.target) || e.defaultPrevented) return
  const mod = e.metaKey || e.ctrlKey
  const key = e.key.toLowerCase()
  const anyDialog = ui.library.open || ui.exportOpen || ui.rollOpen || ui.cropAssetId || ui.sceneDataOpen
  if (anyDialog) return

  if (mod && key === 'z') {
    e.preventDefault()
    e.shiftKey ? projects.redo() : projects.undo()
    return
  }
  if (mod && key === 'y') {
    e.preventDefault()
    projects.redo()
    return
  }
  if (mod && key === 'e') {
    e.preventDefault()
    ui.exportOpen = true
    return
  }
  if (mode.value === 'video') {
    if (mod && key === 'c') {
      if (projects.copySelected()) toast.add({ severity: 'info', summary: 'Cena copiada', life: 1200 })
      return
    }
    if (mod && key === 'x') {
      if (projects.cutSelected()) toast.add({ severity: 'info', summary: 'Cena recortada', life: 1200 })
      return
    }
    if (mod && key === 'v' && projects.clipboard) {
      e.preventDefault()
      projects.paste()
      return
    }
    if (e.code === 'Space') {
      e.preventDefault()
      togglePlay()
      return
    }
    if (key === 'enter') {
      e.preventDefault()
      projects.playing = false
      projects.setPlayhead(0)
      return
    }
    if ((key === 'delete' || key === 'backspace') && projects.selectedScene) {
      e.preventDefault()
      ui.click('delete')
      projects.removeScene(projects.selectedScene.id)
      return
    }
  }
  if (mod || e.altKey) return
  if (key === 'p') projects.setMode('photo')
  else if (key === 'v') projects.setMode('video')
  else if (key === 'l') ui.openLibrary('add')
  else if (key === 'f') ui.focusPicking = !ui.focusPicking
  else if (key === '?' || (e.shiftKey && key === '/')) ui.shortcutsOpen = !ui.shortcutsOpen
  else if (key === 's' && mode.value === 'video') projects.splitAtPlayhead()
  else if (key === 'escape') {
    ui.focusPicking = false
    ui.areaSelecting = false
    ui.shortcutsOpen = false
  } else if (key.startsWith('arrow') && projects.activeShot) {
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    const s = projects.activeShot
    if (key === 'arrowleft') projects.updateActiveShot({ rotateY: s.rotateY - step })
    if (key === 'arrowright') projects.updateActiveShot({ rotateY: s.rotateY + step })
    if (key === 'arrowup') projects.updateActiveShot({ rotateX: s.rotateX + step })
    if (key === 'arrowdown') projects.updateActiveShot({ rotateX: s.rotateX - step })
  }
}

function togglePlay() {
  if (!projects.duration) return
  if (!projects.playing && projects.playhead >= projects.duration - 0.01) projects.setPlayhead(0)
  projects.playing = !projects.playing
  ui.click(projects.playing ? 'release' : 'toggle', 0.25)
}

function onPaste(e) {
  if (isTypingTarget(e.target)) return
  const files = [...(e.clipboardData?.files || [])]
  if (files.length) {
    e.preventDefault()
    intake(files, { purpose: 'add' })
  }
}

function onBeforeUnload() {
  projects.flushHistory()
  projects.saveNow()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('paste', onPaste)
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('paste', onPaste)
  window.removeEventListener('beforeunload', onBeforeUnload)
  projects.playing = false
  projects.saveNow()
})
</script>

<template>
  <div v-if="projects.current" class="studio" :class="{ 'is-video': mode === 'video' }">
    <TopBar />
    <div class="studio-body">
      <main class="stage-area">
        <StageView />
        <OperatorBar />
      </main>
      <transition name="panel">
        <aside v-if="ui.settings.panelOpen" class="side-panel-wrap">
          <SidePanel />
        </aside>
      </transition>
    </div>
    <TimelineBar v-if="mode === 'video'" @toggle-play="togglePlay" />

    <LibraryDialog />
    <ExportDialog />
    <ShortcutsDialog />
    <CameraRollDialog />
    <CropDialog />
    <SceneDataDialog />
  </div>
</template>

<style scoped>
.studio {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: radial-gradient(1200px 600px at 50% -10%, var(--pp-bg-2) 0%, var(--pp-bg) 60%);
}
.studio-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.stage-area {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.side-panel-wrap {
  width: 312px;
  flex-shrink: 0;
  padding: 0 12px 12px 0;
  min-height: 0;
  display: flex;
}
.panel-enter-active,
.panel-leave-active {
  transition: width 0.22s ease, opacity 0.18s ease;
}
.panel-enter-from,
.panel-leave-to {
  width: 0;
  opacity: 0;
}
@media (max-width: 900px) {
  .side-panel-wrap {
    position: absolute;
    right: 0;
    top: 56px;
    bottom: 0;
    z-index: 20;
    padding: 0 8px 8px 0;
  }
}
</style>
