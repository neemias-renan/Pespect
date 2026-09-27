// Pure timeline math: scene layout, keyframe interpolation and transitions.
import { DEFAULT_SHOT, TRANSITION_DURATION } from './defaults'
import { ease } from './easing'
import { clamp, lerp } from './util'

const NUMERIC_KEYS = ['rotateX', 'rotateY', 'rotateZ', 'offsetX', 'offsetY', 'zoom', 'blur']

const lerpZoom = (a, b, t) => Math.exp(lerp(Math.log(Math.max(0.01, a)), Math.log(Math.max(0.01, b)), t))

export function interpolateShot(a, b, t) {
  const from = { ...DEFAULT_SHOT, ...a }
  const to = { ...DEFAULT_SHOT, ...b }
  const out = { ...from }
  for (const key of NUMERIC_KEYS) out[key] = key === 'zoom' ? lerpZoom(from.zoom, to.zoom, t) : lerp(from[key], to[key], t)
  out.focusPoint = blendFocus(from.focusPoint, to.focusPoint, t)
  return out
}

function blendFocus(a, b, t) {
  if (a && b) return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
  return t < 0.5 ? a : b
}

// Monotone cubic (Fritsch–Carlson) through (times, values): smooth velocity through every
// position, no overshoot, and zero speed at the first and last position.
function monotoneCubic(times, values, x) {
  const n = times.length
  const d = []
  const h = []
  for (let i = 0; i < n - 1; i++) {
    h[i] = Math.max(1e-6, times[i + 1] - times[i])
    d[i] = (values[i + 1] - values[i]) / h[i]
  }
  const m = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0
    else {
      const w1 = 2 * h[i] + h[i - 1]
      const w2 = h[i] + 2 * h[i - 1]
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    }
  }
  let i = 0
  while (i < n - 2 && x > times[i + 1]) i++
  const t = clamp((x - times[i]) / h[i], 0, 1)
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * values[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * values[i + 1] + (t3 - t2) * h[i] * m[i + 1]
}

export function layoutScenes(scenes = []) {
  let cursor = 0
  return scenes.map((scene, index) => {
    const item = { scene, index, start: cursor, end: cursor + scene.duration }
    cursor = Math.round((cursor + scene.duration) * 1000) / 1000
    return item
  })
}

export function totalDuration(scenes = []) {
  return scenes.reduce((sum, s) => sum + s.duration, 0)
}

export function sceneIndexAt(scenes, t) {
  const layout = layoutScenes(scenes)
  if (!layout.length) return -1
  const found = layout.find((l) => t >= l.start && t < l.end)
  return found ? found.index : layout.length - 1
}

export function transitionLength(prev, scene) {
  if (!prev || !scene || !scene.transition || scene.transition === 'cut') return 0
  return Math.min(TRANSITION_DURATION, prev.duration / 2, scene.duration / 2)
}

// All camera positions of a shot scene, in time order: START, intermediate positions, END.
export function keysOf(scene) {
  const stops = [...(scene.stops || [])].sort((a, b) => a.at - b.at)
  return [
    { id: 'start', at: 0, shot: scene.start },
    ...stops.map((s) => ({ id: s.id, at: clamp(s.at, 0.001, 0.999), shot: s.shot })),
    { id: 'end', at: 1, shot: scene.end }
  ]
}

export function shotAt(scene, progress) {
  const keys = keysOf(scene)
  const easing = scene.easing || 'cinematic'
  if (keys.length === 2) return interpolateShot(scene.start, scene.end, ease(easing, progress))
  // Several positions: one continuous spline, eased gently at the very start and end.
  const x = ease('ease-in-out', progress) * 0.35 + progress * 0.65
  const times = keys.map((k) => k.at)
  const shots = keys.map((k) => ({ ...DEFAULT_SHOT, ...k.shot }))
  const out = { ...shots[0] }
  for (const key of NUMERIC_KEYS) {
    const vals = shots.map((sh) => (key === 'zoom' ? Math.log(Math.max(0.01, sh.zoom)) : sh[key]))
    const v = monotoneCubic(times, vals, x)
    out[key] = key === 'zoom' ? Math.exp(v) : v
  }
  let i = 0
  while (i < keys.length - 2 && x > times[i + 1]) i++
  const local = clamp((x - times[i]) / Math.max(1e-6, times[i + 1] - times[i]), 0, 1)
  out.focusPoint = blendFocus(shots[i].focusPoint, shots[i + 1].focusPoint, ease('smooth', local))
  return out
}

export function frameForScene(scene, local) {
  const progress = clamp(local / Math.max(0.001, scene.duration), 0, 1)
  if (scene.type === 'shot') {
    return { type: 'shot', scene, local, progress, shot: shotAt(scene, progress) }
  }
  return { type: scene.type, scene, local, progress }
}

// Returns what should be on screen at time `t`, including an optional outgoing frame for transitions.
export function evaluateTimeline(scenes, t) {
  const layout = layoutScenes(scenes)
  if (!layout.length) return null
  const total = layout[layout.length - 1].end
  const time = clamp(t, 0, Math.max(0, total - 0.0001))
  const current = layout.find((l) => time >= l.start && time < l.end) || layout[layout.length - 1]
  const local = time - current.start
  const frame = frameForScene(current.scene, local)
  const prevItem = current.index > 0 ? layout[current.index - 1] : null
  const length = prevItem ? transitionLength(prevItem.scene, current.scene) : 0
  let transition = null
  if (length > 0 && local < length) {
    // The outgoing scene keeps moving into the transition window, past its own end.
    const prevFrame = frameForScene(prevItem.scene, prevItem.scene.duration)
    transition = { type: current.scene.transition, progress: ease('smooth', local / length), from: prevFrame }
  }
  return { index: current.index, start: current.start, frame, transition, total }
}

// Source media time for a video-backed shot scene at a given local time.
export function sourceTimeFor(scene, asset, local) {
  if (!asset || !asset.duration) return 0
  const start = clamp(asset.trimStart ?? 0, 0, asset.duration)
  const end = clamp(asset.trimEnd ?? asset.duration, start + 0.05, asset.duration)
  const span = Math.max(0.05, end - start)
  const t = local % span
  return start + t
}
