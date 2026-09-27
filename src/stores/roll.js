// Camera roll: every capture and recording is saved in this browser.
import { defineStore } from 'pinia'
import { rollDb } from '@/lib/db'
import { uid } from '@/lib/util'

export const useRollStore = defineStore('roll', {
  state: () => ({
    items: [],
    ready: false
  }),
  getters: {
    captures: (s) => s.items.filter((i) => i.kind === 'image'),
    recordings: (s) => s.items.filter((i) => i.kind === 'video')
  },
  actions: {
    async init() {
      if (this.ready) return
      const all = await rollDb.all().catch(() => [])
      this.items = all.sort((a, b) => b.createdAt - a.createdAt)
      this.ready = true
    },
    async add(entry) {
      const item = { id: uid('shot'), createdAt: Date.now(), featured: false, caption: '', ...entry }
      await rollDb.set(item.id, item)
      this.items.unshift(item)
      return item
    },
    async update(id, patch) {
      const item = this.items.find((i) => i.id === id)
      if (!item) return
      Object.assign(item, patch)
      await rollDb.set(id, { ...item })
    },
    async remove(id) {
      this.items = this.items.filter((i) => i.id !== id)
      await rollDb.del(id)
    }
  }
})
