<script setup>
import { computed, watch } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import FramePanel from './panels/FramePanel.vue'
import BackdropPanel from './panels/BackdropPanel.vue'
import LensPanel from './panels/LensPanel.vue'
import ScenePanel from './panels/ScenePanel.vue'

const projects = useProjectsStore()
const ui = useUiStore()

const tabs = computed(() => [
  ...(projects.mode === 'video' ? [{ id: 'scene', label: 'Cena', icon: 'pi pi-video' }] : []),
  { id: 'frame', label: 'Dispositivo', icon: 'pi pi-desktop' },
  { id: 'backdrop', label: 'Fundo', icon: 'pi pi-palette' },
  { id: 'lens', label: 'Lente', icon: 'pi pi-camera' }
])

watch(
  () => projects.mode,
  (mode) => {
    if (mode === 'video') ui.panel = 'scene'
    else if (ui.panel === 'scene') ui.panel = 'frame'
  },
  { immediate: true }
)

watch(
  () => projects.selectedSceneId,
  () => {
    if (projects.mode === 'video' && ui.panel !== 'scene' && projects.selectedScene?.type !== 'shot') ui.panel = 'scene'
  }
)

function select(id) {
  ui.panel = id
  ui.click('toggle', 0.25)
}
</script>

<template>
  <div class="side-panel pp-glass">
    <nav class="tabs" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        role="tab"
        :aria-selected="ui.panel === t.id"
        :class="{ active: ui.panel === t.id }"
        @click="select(t.id)"
      >
        {{ t.label }}
      </button>
    </nav>
    <div class="panel-body">
      <ScenePanel v-if="ui.panel === 'scene'" />
      <FramePanel v-else-if="ui.panel === 'frame'" />
      <BackdropPanel v-else-if="ui.panel === 'backdrop'" />
      <LensPanel v-else-if="ui.panel === 'lens'" />
    </div>
  </div>
</template>

<style scoped>
.side-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  overflow: hidden;
}
.tabs {
  display: flex;
  gap: 2px;
  padding: 6px;
  border-bottom: 1px solid var(--pp-border);
}
.tabs button {
  flex: 1;
  height: 32px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--pp-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tabs button:hover {
  color: var(--pp-text);
}
.tabs button.active {
  background: rgba(var(--pp-fg-rgb), 0.1);
  color: var(--pp-strong);
}
.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}
</style>
