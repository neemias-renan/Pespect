import { defineStore } from 'pinia'
import { setSoundEnabled, playSound } from '@/lib/sound'

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable
  }
}

function systemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

const settings = readJSON('pespect:settings', { sound: true, performance: false, panelOpen: true, theme: null })
if (!settings.theme) settings.theme = systemTheme()
setSoundEnabled(settings.sound)

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f4f6' : '#0b0b0d')
}
applyTheme(settings.theme)

export const useUiStore = defineStore('ui', {
  state: () => ({
    settings,
    // dialogs
    library: { open: false, purpose: 'add' }, // add | replace | backdrop | logo
    exportOpen: false,
    exporting: false,
    shortcutsOpen: false,
    rollOpen: false,
    sceneDataOpen: false,
    cropAssetId: null,
    // stage
    focusPicking: false,
    areaSelecting: false,
    panel: 'frame', // scene | frame | backdrop | lens
    dragOver: false
  }),
  getters: {
    isLight: (s) => s.settings.theme === 'light'
  },
  actions: {
    saveSettings() {
      writeJSON('pespect:settings', this.settings)
    },
    setSound(value) {
      this.settings.sound = value
      setSoundEnabled(value)
      this.saveSettings()
    },
    setPerformance(value) {
      this.settings.performance = value
      this.saveSettings()
    },
    setTheme(theme) {
      this.settings.theme = theme
      applyTheme(theme)
      this.saveSettings()
    },
    toggleTheme() {
      this.setTheme(this.settings.theme === 'light' ? 'dark' : 'light')
      playSound('toggle', 0.3)
    },
    togglePanel(value) {
      this.settings.panelOpen = value ?? !this.settings.panelOpen
      this.saveSettings()
    },
    openLibrary(purpose = 'add') {
      this.library = { open: true, purpose }
    },
    click(kind = 'toggle', volume = 0.3) {
      playSound(kind, volume)
    }
  }
})
