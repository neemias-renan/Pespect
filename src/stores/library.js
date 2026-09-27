import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { assetsDb } from '@/lib/db'
import { buildDemoAssets } from '@/lib/demoAssets'
import { fileToAsset, isAcceptedFile, releaseMedia } from '@/lib/media'
import { deepClone } from '@/lib/util'

function serializable(asset) {
  const raw = toRaw(asset)
  return { ...raw, crop: deepClone(raw.crop) ?? null }
}

export const useLibraryStore = defineStore('library', {
  state: () => ({
    assets: [],
    ready: false,
    uploading: 0
  }),
  getters: {
    byId: (state) => {
      const map = new Map()
      state.assets.forEach((a) => map.set(a.id, a))
      return map
    },
    demoAssets: (state) => state.assets.filter((a) => a.demo),
    userAssets: (state) => state.assets.filter((a) => !a.demo).sort((a, b) => b.createdAt - a.createdAt)
  },
  actions: {
    async init() {
      if (this.ready) return
      const [demos, stored] = await Promise.all([buildDemoAssets(), assetsDb.all().catch(() => [])])
      this.assets = [...demos, ...stored]
      this.ready = true
    },
    get(id) {
      return this.byId.get(id) || null
    },
    async addFiles(files, { kind } = {}) {
      const list = [...files]
      const accepted = list.filter(isAcceptedFile)
      const rejected = list.length - accepted.length
      const added = []
      const errors = []
      this.uploading += accepted.length
      for (const file of accepted) {
        try {
          const asset = await fileToAsset(file, { kind })
          await assetsDb.set(asset.id, asset)
          this.assets.push(asset)
          added.push(asset)
        } catch (err) {
          errors.push(`${file.name}: ${err.message}`)
        } finally {
          this.uploading -= 1
        }
      }
      return { added, rejected, errors }
    },
    async update(id, patch) {
      const asset = this.get(id)
      if (!asset) return
      Object.assign(asset, patch)
      if (!asset.demo) await assetsDb.set(id, serializable(asset))
    },
    async remove(id) {
      const asset = this.get(id)
      if (!asset || asset.demo) return
      this.assets = this.assets.filter((a) => a.id !== id)
      releaseMedia(id)
      await assetsDb.del(id)
    },
    storageBytes() {
      return this.userAssets.reduce((n, a) => n + (a.size || 0), 0)
    }
  }
})
