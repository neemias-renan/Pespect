// Project and scene factories.
import {
  DEFAULT_SHOT, DEVICE_DEFAULT_SHOTS, DEFAULT_SHOT_DURATION, DEFAULT_TEXT_DURATION, DEFAULT_LOGO_DURATION
} from './defaults'
import { createMotion } from './presets'
import { uid, deepClone } from './util'

export function defaultLook() {
  return {
    device: 'frame',
    finish: 'silver',
    frame: {
      rounding: 0.045,
      border: false,
      borderWidth: 0.012,
      borderColor: '#ffffff',
      padding: 0,
      paddingColor: '#ffffff'
    },
    lid: 75,
    displayHeight: 50,
    brightness: 100,
    reflections: true,
    shadow: 55,
    backdrop: { type: 'auto', color: '#1c1c1f', gradient: 'dusk', imageAssetId: null, blur: 0 },
    lens: { focal: 50, exposure: 0, chromatic: 0, vignette: 8, grain: 0 },
    focusMode: 'auto'
  }
}

export function createProject({ name = 'Sem título', assetIds = [], activeAssetId = null } = {}) {
  const now = Date.now()
  return {
    id: uid('project'),
    name,
    createdAt: now,
    updatedAt: now,
    ratio: '16:9',
    mode: 'photo',
    assetIds: [...assetIds],
    activeAssetId,
    look: defaultLook(),
    shot: { ...DEFAULT_SHOT },
    scenes: [],
    interest: {},
    thumbnail: null
  }
}

export function createShotScene(assetId, { baseShot, preset = 'soft-orbit', duration = DEFAULT_SHOT_DURATION, device = 'frame' } = {}) {
  const motion = createMotion(preset, baseShot || DEFAULT_SHOT, device)
  return {
    id: uid('scene'),
    type: 'shot',
    assetId,
    duration,
    easing: 'cinematic',
    preset,
    transition: 'cut',
    base: { ...DEFAULT_SHOT, ...(baseShot || {}), focusPoint: null },
    stops: [],
    start: motion.start,
    end: motion.end
  }
}

export function createTextScene(patch = {}) {
  return {
    id: uid('scene'),
    type: 'text',
    duration: DEFAULT_TEXT_DURATION,
    text: 'Adicione seu texto aqui...',
    font: 'Inter',
    weight: 600,
    size: 0.08,
    color: 'auto',
    align: 'center',
    animation: 'typewriter-words',
    emphasis: [],
    offsetX: 0,
    offsetY: 0,
    transition: 'fade',
    ...patch
  }
}

export function createLogoScene(assetId, patch = {}) {
  return {
    id: uid('scene'),
    type: 'logo',
    assetId,
    duration: DEFAULT_LOGO_DURATION,
    scale: 1,
    animation: 'scale',
    offsetX: 0,
    offsetY: 0,
    transition: 'fade',
    ...patch
  }
}

export function cloneScene(scene) {
  return { ...deepClone(scene), id: uid('scene') }
}

export function createDemoProject(demoIds) {
  const project = createProject({ name: 'Demo', assetIds: demoIds, activeAssetId: demoIds[0] })
  project.scenes = [
    createShotScene(demoIds[0], { preset: 'soft-orbit', baseShot: { ...DEFAULT_SHOT, ...DEVICE_DEFAULT_SHOTS.frame } }),
    createTextScene({ text: 'Visuais que sua interface merece', emphasis: [{ word: 4, style: 'underline', color: '#ffd84d' }], transition: 'fade' }),
    { ...createShotScene(demoIds[1], { preset: 'isometric-reveal' }), transition: 'fade' },
    { ...createShotScene(demoIds[2], { preset: 'focus-push', baseShot: { ...DEFAULT_SHOT, rotateX: -12, rotateY: 26, rotateZ: -8 } }), transition: 'push-left' }
  ]
  return project
}

// Upgrades older/partial project records.
export function normalizeProject(p) {
  const base = createProject()
  const look = { ...base.look, ...(p.look || {}) }
  look.frame = { ...base.look.frame, ...(p.look?.frame || {}) }
  look.backdrop = { ...base.look.backdrop, ...(p.look?.backdrop || {}) }
  look.lens = { ...base.look.lens, ...(p.look?.lens || {}) }
  return {
    ...base,
    ...p,
    look,
    shot: { ...DEFAULT_SHOT, ...(p.shot || {}) },
    scenes: Array.isArray(p.scenes) ? p.scenes : [],
    interest: p.interest && typeof p.interest === 'object' ? p.interest : {},
    assetIds: Array.isArray(p.assetIds) ? p.assetIds : []
  }
}
