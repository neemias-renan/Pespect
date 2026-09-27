<script setup>
// Shows which asset is on the screen right now, with Replace / Crop actions.
import { computed } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import { formatLabel, isVideoMime } from '@/lib/media'

const props = defineProps({ assetId: { type: String, default: null } })
const projects = useProjectsStore()
const library = useLibraryStore()
const ui = useUiStore()

const asset = computed(() => library.get(props.assetId))
</script>

<template>
  <div class="source">
    <div class="thumb" :style="asset ? { backgroundImage: `url(${asset.thumbnail})` } : null">
      <i v-if="!asset" class="pi pi-image" />
      <span v-if="asset && isVideoMime(asset.mime)" class="badge"><i class="pi pi-play" /></span>
    </div>
    <div class="meta">
      <strong>{{ asset?.name || 'Sem mídia' }}</strong>
      <span v-if="asset">{{ asset.width }} × {{ asset.height }} · {{ formatLabel(asset.mime) }}</span>
      <span v-else>Adicione uma imagem ou vídeo</span>
      <div class="actions">
        <button class="pp-icon-btn is-outline" @click="ui.openLibrary(projects.mode === 'video' ? 'replace' : 'replace')">
          <i class="pi pi-sync" /> {{ asset ? 'Trocar' : 'Adicionar' }}
        </button>
        <button v-if="asset" class="pp-icon-btn is-outline" @click="ui.cropAssetId = asset.id">
          <i class="pi pi-stop" /> {{ isVideoMime(asset.mime) ? 'Aparar e cortar' : 'Cortar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.source {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(var(--pp-fg-rgb), 0.035);
  border: 1px solid var(--pp-border);
  margin-bottom: 18px;
}
.thumb {
  position: relative;
  width: 76px;
  height: 56px;
  border-radius: 8px;
  flex-shrink: 0;
  background: var(--pp-thumb-bg) center / cover no-repeat;
  display: grid;
  place-items: center;
  color: var(--pp-muted);
}
.badge {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
}
.badge .pi {
  font-size: 8px;
  color: #fff;
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.meta strong {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta span {
  font-size: 11px;
  color: var(--pp-muted);
}
.actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.actions .pp-icon-btn {
  height: 26px;
  font-size: 11px;
  padding: 0 8px;
}
</style>
