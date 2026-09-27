<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRollStore } from '@/stores/roll'
import { formatDate, formatTime } from '@/lib/util'
import BrandMark from '@/components/BrandMark.vue'

const roll = useRollStore()
const router = useRouter()
const filter = ref('featured')
const urls = new Map()
const active = ref(null)

const items = computed(() => {
  if (filter.value === 'featured') return roll.items.filter((i) => i.featured)
  if (filter.value === 'video') return roll.recordings
  if (filter.value === 'image') return roll.captures
  return roll.items
})

function urlFor(item) {
  if (!urls.has(item.id)) urls.set(item.id, URL.createObjectURL(item.blob))
  return urls.get(item.id)
}

function play(e) {
  e.currentTarget.querySelector('video')?.play().catch(() => {})
}
function stop(e) {
  const v = e.currentTarget.querySelector('video')
  if (v) {
    v.pause()
    v.currentTime = 0
  }
}

onBeforeUnmount(() => urls.forEach((u) => URL.revokeObjectURL(u)))
</script>

<template>
  <div class="showcase">
    <header class="head">
      <router-link to="/" class="brand"><BrandMark :size="26" /> <strong>Pespect</strong></router-link>
      <nav>
        <Button label="Abrir estúdio" icon="pi pi-arrow-right" icon-pos="right" size="small" @click="router.push('/')" />
      </nav>
    </header>

    <section class="hero">
      <span class="pp-label">Vitrine</span>
      <h1>Fotografia de produto para software</h1>
      <p class="pp-muted">Crie visuais de produto incríveis a partir da sua interface. Fotos e vídeos de software com qualidade de estúdio, direto no navegador.</p>
    </section>

    <div class="filters">
      <SelectButton
        v-model="filter"
        :options="[
          { label: 'Destaques', value: 'featured' },
          { label: 'Vídeos', value: 'video' },
          { label: 'Fotos', value: 'image' },
          { label: 'Todos', value: 'all' }
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
      />
    </div>

    <div v-if="items.length" class="grid">
      <article v-for="item in items" :key="item.id" class="card" @mouseenter="play" @mouseleave="stop" @click="active = item">
        <div class="media" :style="{ aspectRatio: `${item.width} / ${item.height}` }">
          <video v-if="item.kind === 'video'" :src="urlFor(item)" :poster="item.thumbnail" muted loop playsinline preload="none" />
          <img v-else :src="item.thumbnail" alt="" />
          <span v-if="item.kind === 'video'" class="badge pp-mono"><i class="pi pi-play" /> {{ formatTime(item.duration, false) }}</span>
        </div>
        <div class="meta">
          <strong>{{ item.caption || item.projectName }}</strong>
          <span class="pp-muted">{{ formatDate(item.createdAt) }}</span>
        </div>
      </article>
    </div>
    <div v-else class="empty">
      <i class="pi pi-sparkles" />
      <strong>{{ filter === 'featured' ? 'Ainda não há nada em destaque.' : 'Nada por aqui ainda.' }}</strong>
      <span class="pp-muted">Capture ou grave algo no estúdio e depois escolha “Destacar na vitrine” no rolo de câmera.</span>
      <Button label="Abrir estúdio" size="small" class="mt-3" @click="router.push('/')" />
    </div>

    <footer class="foot pp-muted">
      <span>FEITO COM PESPECT</span>
      <span>Tudo nesta página fica no seu navegador.</span>
    </footer>

    <Dialog :visible="!!active" modal :header="active?.caption || active?.projectName" :style="{ width: 'min(1000px, 94vw)' }" :dismissable-mask="true" @update:visible="(v) => !v && (active = null)">
      <div v-if="active" class="viewer">
        <video v-if="active.kind === 'video'" :src="urlFor(active)" controls autoplay loop playsinline />
        <img v-else :src="urlFor(active)" alt="" />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.showcase {
  height: 100%;
  overflow-y: auto;
  padding: 0 28px 40px;
  background: radial-gradient(1000px 500px at 50% -10%, var(--pp-bg-2), var(--pp-bg) 70%);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
  max-width: 1200px;
  margin: 0 auto;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-size: 15px;
}
.hero {
  max-width: 720px;
  margin: 48px auto 28px;
  text-align: center;
}
.hero h1 {
  font-size: clamp(32px, 5vw, 56px);
  letter-spacing: -0.035em;
  line-height: 1.02;
  margin: 12px 0 14px;
}
.hero p {
  font-size: 16px;
  line-height: 1.5;
}
.filters {
  display: flex;
  justify-content: center;
  margin-bottom: 28px;
}
.filters :deep(.p-selectbutton) {
  width: 360px;
}
.grid {
  max-width: 1200px;
  margin: 0 auto;
  columns: 3 320px;
  column-gap: 16px;
}
.card {
  break-inside: avoid;
  margin-bottom: 16px;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(var(--pp-fg-rgb), 0.03);
  border: 1px solid var(--pp-border);
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s;
}
.card:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--pp-fg-rgb), 0.2);
}
.media {
  position: relative;
  background: #111;
}
.media video,
.media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.badge {
  position: absolute;
  left: 10px;
  bottom: 10px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 3px 7px;
  border-radius: 6px;
}
.badge .pi {
  font-size: 9px;
}
.meta {
  display: flex;
  justify-content: space-between;
  padding: 12px 14px;
  font-size: 12px;
  gap: 10px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 60px 10px;
  max-width: 420px;
  margin: 0 auto;
}
.empty .pi {
  font-size: 28px;
  color: var(--pp-muted);
  margin-bottom: 6px;
}
.empty span {
  font-size: 13px;
  line-height: 1.5;
}
.foot {
  max-width: 1200px;
  margin: 40px auto 0;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  letter-spacing: 0.06em;
  border-top: 1px solid var(--pp-border);
  padding-top: 16px;
}
.viewer {
  display: grid;
  place-items: center;
}
.viewer video,
.viewer img {
  max-width: 100%;
  max-height: 75vh;
  border-radius: 10px;
}
</style>
