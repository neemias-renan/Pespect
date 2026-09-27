<script setup>
import { onMounted, ref } from 'vue'
import { useLibraryStore } from './stores/library'
import { useProjectsStore } from './stores/projects'
import { useRollStore } from './stores/roll'
import './stores/ui' // applies the saved theme before the studio mounts
import { linkFonts } from './lib/engine/overlay'
import BrandMark from './components/BrandMark.vue'

const library = useLibraryStore()
const projects = useProjectsStore()
const roll = useRollStore()
const ready = ref(false)
const failed = ref('')
const reload = () => window.location.reload()

onMounted(async () => {
  linkFonts()
  try {
    await Promise.all([library.init(), roll.init()])
    await projects.init()
    ready.value = true
  } catch (err) {
    console.error(err)
    failed.value = err?.message || 'Algo deu errado ao abrir o estúdio.'
  }
})
</script>

<template>
  <Toast position="bottom-center" />
  <ConfirmDialog />
  <router-view v-if="ready" />
  <div v-else class="boot">
    <BrandMark :size="44" />
    <p v-if="!failed" class="pp-muted">Preparando o estúdio…</p>
    <template v-else>
      <p>Não foi possível carregar esta página</p>
      <p class="pp-muted boot-error">{{ failed }}</p>
      <button class="pp-icon-btn is-primary" @click="reload">Recarregar</button>
    </template>
  </div>
</template>

<style scoped>
.boot {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.boot-error {
  max-width: 420px;
  text-align: center;
  font-size: 12px;
}
</style>
