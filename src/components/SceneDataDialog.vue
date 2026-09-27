<script setup>
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useUiStore } from '@/stores/ui'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'

const ui = useUiStore()
const projects = useProjectsStore()
const library = useLibraryStore()
const toast = useToast()

const visible = computed({
  get: () => ui.sceneDataOpen,
  set: (v) => (ui.sceneDataOpen = v)
})

const json = computed(() => {
  const p = projects.current
  if (!p || !visible.value) return ''
  let cursor = 0
  const data = {
    project: p.name,
    ratio: p.ratio,
    duration: projects.duration,
    look: p.look,
    scenes: p.scenes.map((s, i) => {
      const asset = library.get(s.assetId)
      const out = {
        index: i + 1,
        type: s.type,
        start: Math.round(cursor * 1000) / 1000,
        duration: s.duration,
        transition: s.transition,
        ...(asset ? { source: { name: asset.name, width: asset.width, height: asset.height, mime: asset.mime } } : {}),
        ...(s.type === 'shot' ? { preset: s.preset, easing: s.easing, camera: { start: s.start, positions: (s.stops || []).map((p) => ({ at: p.at, time: +(p.at * s.duration).toFixed(3), ...p.shot })), end: s.end } } : {}),
        ...(s.type === 'text' ? { text: s.text, font: s.font, weight: s.weight, animation: s.animation, emphasis: s.emphasis } : {}),
        ...(s.type === 'logo' ? { scale: s.scale, animation: s.animation } : {})
      }
      cursor += s.duration
      return out
    })
  }
  return JSON.stringify(data, null, 2)
})

async function copy() {
  try {
    await navigator.clipboard.writeText(json.value)
    toast.add({ severity: 'success', summary: 'JSON copiado', life: 1500 })
  } catch {
    toast.add({ severity: 'warn', summary: 'Não foi possível acessar a área de transferência', life: 2000 })
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Dados de movimento da cena" :style="{ width: 'min(680px, 94vw)' }" :draggable="false" :dismissable-mask="true">
    <p class="pp-muted sub">Valores completos de linha do tempo, mídia, câmera, lente, foco e movimento.</p>
    <textarea class="code pp-mono" :value="json" readonly spellcheck="false" aria-label="JSON dos movimentos da cena para copiar" />
    <template #footer>
      <Button label="Fechar" size="small" severity="secondary" text @click="visible = false" />
      <Button label="Copiar JSON" icon="pi pi-copy" size="small" @click="copy" />
    </template>
  </Dialog>
</template>

<style scoped>
.sub {
  margin: 0 0 10px;
  font-size: 12px;
}
.code {
  width: 100%;
  height: 50vh;
  resize: vertical;
  background: var(--pp-code-bg);
  color: var(--pp-text);
  border: 1px solid var(--pp-border-strong);
  border-radius: 10px;
  padding: 12px;
  font-size: 11.5px;
  line-height: 1.5;
  outline: none;
}
</style>
