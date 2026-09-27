import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { projectsDb, metaDb } from '@/lib/db'
import { DEMO_ASSET_IDS } from '@/lib/demoAssets'
import {
  createProject, createDemoProject, createShotScene, createTextScene, createLogoScene, cloneScene, normalizeProject
} from '@/lib/project'
import { layoutScenes, totalDuration, sceneIndexAt, evaluateTimeline, keysOf, shotAt } from '@/lib/timeline'
import { createMotion, randomPresetId } from '@/lib/presets'
import { DEFAULT_SHOT, DEVICE_DEFAULT_SHOTS, MIN_SCENE_DURATION, MAX_SCENE_DURATION } from '@/lib/defaults'
import { clamp, deepClone, uid } from '@/lib/util'

const HISTORY_LIMIT = 100

function snapshotOf(project) {
  if (!project) return ''
  const { thumbnail, updatedAt, ...rest } = toRaw(project)
  return JSON.stringify(rest)
}

let saveTimer = null
let historyTimer = null
let pendingBase = null

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    list: [],
    current: null,
    ready: false,
    // timeline / editing state (not persisted)
    playhead: 0,
    playing: false,
    // True while the stage shows a scene's own camera position (after selecting a scene or
    // editing a position): the preview then ignores the incoming transition.
    keyframePreview: false,
    loop: true,
    selectedSceneId: null,
    editingKey: 'start',
    clipboard: null,
    // history
    past: [],
    future: [],
    lastSnapshot: '',
    applyingHistory: false
  }),
  getters: {
    project: (s) => s.current,
    mode: (s) => s.current?.mode || 'photo',
    scenes: (s) => s.current?.scenes || [],
    duration: (s) => totalDuration(s.current?.scenes || []),
    layout: (s) => layoutScenes(s.current?.scenes || []),
    selectedScene: (s) => s.current?.scenes.find((sc) => sc.id === s.selectedSceneId) || null,
    selectedIndex: (s) => (s.current?.scenes || []).findIndex((sc) => sc.id === s.selectedSceneId),
    canUndo: (s) => s.past.length > 0,
    canRedo: (s) => s.future.length > 0,
    sortedList: (s) => [...s.list].sort((a, b) => b.updatedAt - a.updatedAt),
    // The camera state the operator currently edits.
    activeShot(s) {
      const p = s.current
      if (!p) return { ...DEFAULT_SHOT }
      if (p.mode === 'photo') return p.shot
      const scene = this.selectedScene
      if (scene?.type !== 'shot') return null
      if (s.editingKey === 'start' || s.editingKey === 'end') return scene[s.editingKey]
      return scene.stops?.find((st) => st.id === s.editingKey)?.shot || scene.start
    },
    // Camera positions of the selected shot scene (START, P1…, END).
    selectedKeys() {
      const scene = this.selectedScene
      return scene?.type === 'shot' ? keysOf(scene) : []
    },
    editingLabel(s) {
      if (s.editingKey === 'start') return 'INÍCIO'
      if (s.editingKey === 'end') return 'FIM'
      const idx = this.selectedKeys.findIndex((k) => k.id === s.editingKey)
      return idx > 0 ? `P${idx}` : 'INÍCIO'
    },
    // Asset whose areas of interest are being edited / composed.
    composeAssetId(s) {
      const p = s.current
      if (!p) return null
      if (p.mode === 'photo') return p.activeAssetId
      const sel = this.selectedScene
      if (sel?.type === 'shot') return sel.assetId
      return p.scenes.find((sc) => sc.type === 'shot')?.assetId || p.activeAssetId
    }
  },
  actions: {
    async init() {
      if (this.ready) return
      const stored = (await projectsDb.all().catch(() => [])).map(normalizeProject)
      if (!stored.length) {
        const demo = createDemoProject(DEMO_ASSET_IDS)
        await projectsDb.set(demo.id, demo)
        stored.push(demo)
      }
      this.list = stored
      const lastId = await metaDb.get('lastProjectId').catch(() => null)
      const target = stored.find((p) => p.id === lastId) || this.sortedList[0]
      this.open(target.id)
      this.ready = true
    },

    open(id) {
      const found = this.list.find((p) => p.id === id)
      if (!found) return false
      this.current = normalizeProject(deepClone(found))
      this.past = []
      this.future = []
      pendingBase = null
      clearTimeout(historyTimer)
      this.lastSnapshot = snapshotOf(this.current)
      this.playhead = 0
      this.playing = false
      this.selectedSceneId = this.current.scenes[0]?.id || null
      this.editingKey = 'start'
      metaDb.set('lastProjectId', id).catch(() => {})
      return true
    },

    async newProject({ name = 'Sem título', assetIds = [], activeAssetId = null } = {}) {
      const project = createProject({ name, assetIds, activeAssetId })
      this.list.push(project)
      await projectsDb.set(project.id, deepClone(project))
      this.open(project.id)
      return project
    },

    async duplicateProject(id) {
      const source = this.list.find((p) => p.id === id)
      if (!source) return null
      const copy = { ...deepClone(source), id: uid('project'), name: `${source.name} (cópia)`, createdAt: Date.now(), updatedAt: Date.now() }
      this.list.push(copy)
      await projectsDb.set(copy.id, copy)
      return copy
    },

    async renameProject(id, name) {
      const clean = (name || '').trim() || 'Sem título'
      const entry = this.list.find((p) => p.id === id)
      if (entry) entry.name = clean
      if (this.current?.id === id) this.current.name = clean
      if (entry) await projectsDb.set(id, deepClone(this.current?.id === id ? this.current : entry))
    },

    async deleteProject(id) {
      this.list = this.list.filter((p) => p.id !== id)
      await projectsDb.del(id)
      if (this.current?.id === id) {
        if (!this.list.length) {
          await this.newProject({ name: 'Sem título' })
        } else {
          this.open(this.sortedList[0].id)
        }
      }
    },

    // Called by a deep watcher whenever the current project changes. Bursts of edits
    // (e.g. dragging a slider) collapse into a single undo step.
    touch() {
      if (!this.current) return
      const snap = snapshotOf(this.current)
      if (snap === this.lastSnapshot) return
      if (!this.applyingHistory) {
        if (pendingBase === null) pendingBase = this.lastSnapshot
        clearTimeout(historyTimer)
        historyTimer = setTimeout(() => this.flushHistory(), 450)
      }
      this.lastSnapshot = snap
      this.scheduleSave()
    },

    flushHistory() {
      clearTimeout(historyTimer)
      if (pendingBase !== null && pendingBase !== this.lastSnapshot) {
        this.past.push(pendingBase)
        if (this.past.length > HISTORY_LIMIT) this.past.shift()
        this.future = []
      }
      pendingBase = null
    },

    scheduleSave() {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => this.saveNow(), 400)
    },

    async saveNow() {
      if (!this.current) return
      this.current.updatedAt = Date.now()
      const plain = deepClone(this.current)
      const idx = this.list.findIndex((p) => p.id === plain.id)
      if (idx >= 0) this.list.splice(idx, 1, plain)
      else this.list.push(plain)
      await projectsDb.set(plain.id, plain).catch(() => {})
    },

    setThumbnail(dataUrl) {
      if (!this.current || !dataUrl) return
      const entry = this.list.find((p) => p.id === this.current.id)
      if (entry) entry.thumbnail = dataUrl
      // Write straight through without touching history.
      const raw = toRaw(this.current)
      raw.thumbnail = dataUrl
      projectsDb.set(raw.id, deepClone(raw)).catch(() => {})
    },

    undo() {
      this.flushHistory()
      if (!this.past.length) return
      const prev = this.past.pop()
      this.future.push(snapshotOf(this.current))
      this.applySnapshot(prev)
    },

    redo() {
      this.flushHistory()
      if (!this.future.length) return
      const next = this.future.pop()
      this.past.push(snapshotOf(this.current))
      this.applySnapshot(next)
    },

    applySnapshot(snap) {
      this.applyingHistory = true
      const thumbnail = this.current?.thumbnail
      this.current = { ...JSON.parse(snap), thumbnail, updatedAt: Date.now() }
      this.lastSnapshot = snapshotOf(this.current)
      if (!this.current.scenes.find((s) => s.id === this.selectedSceneId)) {
        this.selectedSceneId = this.current.scenes[0]?.id || null
      }
      if (this.playhead > this.duration) this.playhead = Math.max(0, this.duration - 0.001)
      this.scheduleSave()
      setTimeout(() => {
        this.applyingHistory = false
      }, 0)
    },

    // ---------------------------------------------------------------- photo / look

    setMode(mode, { autoScene = true } = {}) {
      if (!this.current || this.current.mode === mode) return
      this.current.mode = mode
      this.playing = false
      if (autoScene && mode === 'video' && !this.current.scenes.length && this.current.activeAssetId) {
        this.addShotScenes([this.current.activeAssetId])
      }
      if (mode === 'video' && !this.selectedSceneId) this.selectedSceneId = this.current.scenes[0]?.id || null
    },

    setRatio(ratio) {
      if (this.current) this.current.ratio = ratio
    },

    setActiveAsset(assetId) {
      if (!this.current) return
      this.current.activeAssetId = assetId
      this.addAssetToProject(assetId)
    },

    addAssetToProject(assetId) {
      if (assetId && !this.current.assetIds.includes(assetId)) this.current.assetIds.push(assetId)
    },

    removeAssetFromProject(assetId) {
      const p = this.current
      if (!p) return
      p.assetIds = p.assetIds.filter((id) => id !== assetId)
      if (p.activeAssetId === assetId) p.activeAssetId = p.assetIds[0] || null
      p.scenes = p.scenes.filter((s) => s.assetId !== assetId)
      if (p.look.backdrop.imageAssetId === assetId) {
        p.look.backdrop.imageAssetId = null
        p.look.backdrop.type = 'auto'
      }
    },

    updateActiveShot(patch) {
      const shot = this.activeShot
      if (!shot) return
      Object.assign(shot, patch)
      if (this.current.mode === 'video') {
        // Hand-tuned keyframes are no longer a preset.
        if (this.selectedScene) this.selectedScene.preset = null
        this.seekToKeyframe()
      }
    },

    resetShot() {
      const device = this.current?.look.device || 'frame'
      this.updateActiveShot({ ...DEFAULT_SHOT, ...DEVICE_DEFAULT_SHOTS[device], focusPoint: null })
    },

    setDevice(mode) {
      const p = this.current
      if (!p || p.look.device === mode) return
      p.look.device = mode
      // Re-aim the camera for the new device; preset-driven scenes are regenerated around it.
      const aim = DEVICE_DEFAULT_SHOTS[mode]
      Object.assign(p.shot, aim, { offsetX: 0, offsetY: 0, zoom: 1 })
      p.scenes.forEach((scene) => {
        if (scene.type !== 'shot' || !scene.preset) return
        scene.stops = []
        scene.base = { ...DEFAULT_SHOT, ...aim, focusPoint: null }
        const motion = createMotion(scene.preset, scene.base, mode)
        scene.start = motion.start
        scene.end = motion.end
      })
    },

    // ---------------------------------------------------------------- timeline

    setPlayhead(t) {
      this.keyframePreview = false
      this.playhead = clamp(t, 0, Math.max(0, this.duration))
      const idx = sceneIndexAt(this.scenes, this.playhead)
      if (idx >= 0 && !this.playing) this.selectedSceneId = this.scenes[idx].id
    },

    selectScene(id, key) {
      this.selectedSceneId = id
      if (key) this.editingKey = key
      this.seekToKeyframe()
    },

    setEditingKey(key) {
      this.editingKey = key
      this.seekToKeyframe()
    },

    seekToKeyframe() {
      const item = this.layout.find((l) => l.scene.id === this.selectedSceneId)
      if (!item) return
      this.playing = false
      this.keyframePreview = true
      if (item.scene.type !== 'shot') {
        this.playhead = item.start + Math.min(item.scene.duration * 0.75, 1.6)
        return
      }
      const key = keysOf(item.scene).find((k) => k.id === this.editingKey)
      if (!key) this.editingKey = 'start'
      const at = key ? key.at : 0
      this.playhead = at >= 1 ? Math.max(item.start, item.end - 0.001) : item.start + at * item.scene.duration
    },

    stepKey(dir) {
      const keys = this.selectedKeys
      if (!keys.length) return
      const idx = Math.max(0, keys.findIndex((k) => k.id === this.editingKey))
      const next = keys[Math.max(0, Math.min(keys.length - 1, idx + dir))]
      this.setEditingKey(next.id)
    },

    // Adds a camera position at the playhead (or in the biggest gap) using the shot seen there.
    addPosition(sceneId = this.selectedSceneId) {
      const item = this.layout.find((l) => l.scene.id === sceneId)
      if (!item || item.scene.type !== 'shot') return null
      const scene = item.scene
      const keys = keysOf(scene)
      let at = (this.playhead - item.start) / scene.duration
      const tooClose = keys.some((k) => Math.abs(k.at - at) < 0.04)
      if (!(at > 0.03 && at < 0.97) || tooClose) {
        let best = 0
        for (let i = 0; i < keys.length - 1; i++) {
          if (keys[i + 1].at - keys[i].at > keys[best + 1].at - keys[best].at) best = i
        }
        at = (keys[best].at + keys[best + 1].at) / 2
      }
      at = Math.round(at * 1000) / 1000
      const stop = { id: uid('pos'), at, shot: deepClone(shotAt(scene, at)) }
      if (!scene.stops) scene.stops = []
      scene.stops.push(stop)
      scene.stops.sort((a, b) => a.at - b.at)
      scene.preset = null
      this.selectedSceneId = sceneId
      this.setEditingKey(stop.id)
      return stop
    },

    removePosition(sceneId, stopId) {
      const scene = this.current?.scenes.find((s) => s.id === sceneId)
      if (!scene?.stops) return
      scene.stops = scene.stops.filter((s) => s.id !== stopId)
      if (this.editingKey === stopId) this.setEditingKey('start')
    },

    movePosition(sceneId, stopId, at) {
      const scene = this.current?.scenes.find((s) => s.id === sceneId)
      const stop = scene?.stops?.find((s) => s.id === stopId)
      if (!stop) return
      const keys = keysOf(scene)
      const idx = keys.findIndex((k) => k.id === stopId)
      const min = keys[idx - 1].at + 0.02
      const max = keys[idx + 1].at - 0.02
      stop.at = Math.round(clamp(at, min, max) * 1000) / 1000
    },

    // Splits the scene under the playhead in two.
    splitAtPlayhead() {
      const item = this.layout.find((l) => this.playhead > l.start + 0.2 && this.playhead < l.end - 0.2)
      if (!item) return false
      const scene = item.scene
      const t = this.playhead - item.start
      const p = t / scene.duration
      const second = cloneScene(scene)
      second.transition = 'cut'
      if (scene.type === 'shot') {
        const mid = deepClone(shotAt(scene, p))
        const stops = scene.stops || []
        scene.stops = stops.filter((s) => s.at < p - 0.01).map((s) => ({ ...s, at: s.at / p }))
        second.stops = stops.filter((s) => s.at > p + 0.01).map((s) => ({ ...deepClone(s), id: uid('pos'), at: (s.at - p) / (1 - p) }))
        second.start = mid
        scene.end = deepClone(mid)
        scene.preset = null
        second.preset = null
      }
      second.duration = Math.round((scene.duration - t) * 10) / 10
      scene.duration = Math.round(t * 10) / 10
      this.current.scenes.splice(item.index + 1, 0, second)
      this.selectedSceneId = second.id
      this.editingKey = 'start'
      return true
    },

    // ---------------------------------------------------------------- areas of interest

    areasFor(assetId) {
      return this.current?.interest?.[assetId] || []
    },

    setAreas(assetId, areas) {
      if (!this.current || !assetId) return
      if (!this.current.interest) this.current.interest = {}
      this.current.interest[assetId] = areas
    },

    // Compose swaps the selected media scene for a composed one, in place; the rest of the
    // timeline is untouched. Without a matching selected scene it is inserted after the selection.
    addComposedScene(assetId, comp) {
      if (!this.current) return null
      if (this.current.mode !== 'video') this.setMode('video', { autoScene: false })
      this.addAssetToProject(assetId)
      const scenes = this.current.scenes
      const selected = this.selectedScene
      const replace = selected?.type === 'shot' && selected.assetId === assetId
      const index = replace ? scenes.indexOf(selected) : this.selectedIndex >= 0 ? this.selectedIndex + 1 : scenes.length
      const scene = createShotScene(assetId, { device: this.current.look.device })
      Object.assign(scene, {
        preset: null,
        composed: true,
        duration: comp.duration,
        easing: 'cinematic',
        start: comp.start,
        end: comp.end,
        stops: comp.stops,
        transition: replace ? selected.transition || 'cut' : index > 0 ? 'fade' : 'cut'
      })
      scenes.splice(index, replace ? 1 : 0, scene)
      this.selectedSceneId = scene.id
      this.editingKey = 'start'
      return { scene, replaced: replace }
    },

    currentFrameShot() {
      const ev = evaluateTimeline(this.scenes, this.playhead)
      return ev?.frame?.shot || null
    },

    insertScenes(scenes, atIndex) {
      const p = this.current
      const index = atIndex ?? (this.selectedIndex >= 0 ? this.selectedIndex + 1 : p.scenes.length)
      p.scenes.splice(index, 0, ...scenes)
      this.selectedSceneId = scenes[scenes.length - 1].id
      this.editingKey = 'start'
      this.seekToKeyframe()
    },

    addShotScenes(assetIds, opts = {}) {
      if (!this.current || !assetIds.length) return
      const base = this.current.mode === 'photo' ? this.current.shot : this.currentFrameShot() || this.current.shot
      const scenes = assetIds.map((id, i) => {
        this.addAssetToProject(id)
        const preset = i === 0 && opts.preset ? opts.preset : randomPresetId()
        const scene = createShotScene(id, { baseShot: { ...base, focusPoint: null }, preset, device: this.current.look.device })
        if (this.current.scenes.length || i > 0) scene.transition = 'fade'
        return scene
      })
      this.insertScenes(scenes, opts.atIndex)
    },

    addTextScene(patch) {
      if (!this.current) return
      this.insertScenes([createTextScene(patch)])
    },

    addLogoScene(assetId) {
      if (!this.current) return
      this.addAssetToProject(assetId)
      this.insertScenes([createLogoScene(assetId)])
    },

    updateScene(id, patch) {
      const scene = this.current?.scenes.find((s) => s.id === id)
      if (!scene) return
      if (patch.duration !== undefined) patch.duration = clamp(Math.round(patch.duration * 10) / 10, MIN_SCENE_DURATION, MAX_SCENE_DURATION)
      Object.assign(scene, patch)
      if (this.playhead > this.duration) this.playhead = Math.max(0, this.duration - 0.001)
    },

    applyPreset(id, presetId) {
      const scene = this.current?.scenes.find((s) => s.id === id)
      if (!scene || scene.type !== 'shot') return
      const motion = createMotion(presetId, scene.base || scene.start, this.current.look.device)
      scene.preset = presetId
      scene.start = motion.start
      scene.end = motion.end
      scene.stops = []
      scene.composed = false
      if (!['start', 'end'].includes(this.editingKey)) this.editingKey = 'start'
    },

    shuffleScene(id) {
      const scene = this.current?.scenes.find((s) => s.id === id)
      if (!scene || scene.type !== 'shot') return
      this.applyPreset(id, randomPresetId(scene.preset))
    },

    copyKeyframe(id, from, to) {
      const scene = this.current?.scenes.find((s) => s.id === id)
      if (!scene || scene.type !== 'shot') return
      scene[to] = deepClone(scene[from])
    },

    swapKeyframes(id) {
      const scene = this.current?.scenes.find((s) => s.id === id)
      if (!scene || scene.type !== 'shot') return
      const a = scene.start
      scene.start = scene.end
      scene.end = a
      if (scene.stops) scene.stops = scene.stops.map((s) => ({ ...s, at: Math.round((1 - s.at) * 1000) / 1000 })).sort((x, y) => x.at - y.at)
    },

    removeScene(id) {
      const p = this.current
      const idx = p.scenes.findIndex((s) => s.id === id)
      if (idx < 0) return
      p.scenes.splice(idx, 1)
      const next = p.scenes[Math.min(idx, p.scenes.length - 1)]
      this.selectedSceneId = next?.id || null
      this.setPlayhead(Math.min(this.playhead, this.duration))
    },

    duplicateScene(id) {
      const scene = this.current?.scenes.find((s) => s.id === id)
      if (!scene) return
      this.insertScenes([cloneScene(scene)], this.current.scenes.indexOf(scene) + 1)
    },

    moveScene(fromIndex, toIndex) {
      const list = this.current.scenes
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= list.length) return
      const [item] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, item)
      this.seekToKeyframe()
    },

    copySelected() {
      if (this.selectedScene) this.clipboard = deepClone(this.selectedScene)
      return !!this.clipboard
    },

    cutSelected() {
      if (!this.selectedScene) return false
      this.copySelected()
      this.removeScene(this.selectedScene.id)
      return true
    },

    paste() {
      if (!this.clipboard || !this.current) return false
      if (this.clipboard.assetId) this.addAssetToProject(this.clipboard.assetId)
      this.insertScenes([cloneScene(this.clipboard)])
      return true
    }
  }
})
