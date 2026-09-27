<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { KEYBOARD_SHORTCUTS } from '@/lib/defaults'
import { isMac } from '@/lib/util'

const ui = useUiStore()
const visible = computed({
  get: () => ui.shortcutsOpen,
  set: (v) => (ui.shortcutsOpen = v)
})
const mac = isMac()
const keyLabel = (k) => (k === '⌘' && !mac ? 'Ctrl' : k)
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Atalhos de teclado" :style="{ width: 'min(560px, 94vw)' }" :draggable="false" :dismissable-mask="true">
    <div class="groups">
      <section v-for="g in KEYBOARD_SHORTCUTS" :key="g.label">
        <h3 class="pp-label">{{ g.label }}</h3>
        <div v-for="s in g.shortcuts" :key="s.label" class="row">
          <span>{{ s.label }}</span>
          <span class="keys" :aria-label="s.keys.join(' mais ')">
            <span v-for="k in s.keys" :key="k" class="pp-kbd">{{ keyLabel(k) }}</span>
          </span>
        </div>
      </section>
    </div>
    <p class="pp-muted foot">Pressione <span class="pp-kbd">?</span> a qualquer momento para abrir esta lista.</p>
  </Dialog>
</template>

<style scoped>
.groups {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
}
@media (max-width: 560px) {
  .groups {
    grid-template-columns: 1fr;
  }
}
h3 {
  margin: 0 0 10px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--pp-border);
}
.keys {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.foot {
  font-size: 12px;
  margin: 16px 0 0;
}
</style>
