// Compose: turns areas of interest into one shot that travels between them with varied angles.
import { DEFAULT_SHOT, DEVICE_DEFAULT_SHOTS, ZOOM_LIMITS, ratioOf } from './defaults'
import { clamp, rand, uid } from './util'

const TRAVEL = 1.6 // seconds moving between positions
const HOLD = 1.2 // seconds lingering on each area

const r1 = (v) => Math.round(v * 10) / 10
const r3 = (v) => Math.round(v * 1000) / 1000

function clean(shot) {
  return {
    ...DEFAULT_SHOT,
    ...shot,
    rotateX: r1(clamp(shot.rotateX, -89, 89)),
    rotateY: r1(shot.rotateY),
    rotateZ: r1(shot.rotateZ),
    offsetX: r3(clamp(shot.offsetX, -1.5, 1.5)),
    offsetY: r3(clamp(shot.offsetY, -1.5, 1.5)),
    zoom: r3(clamp(shot.zoom, ZOOM_LIMITS.min, ZOOM_LIMITS.max)),
    blur: Math.round(shot.blur ?? DEFAULT_SHOT.blur)
  }
}

// When no areas were marked, pick a few plausible regions of a UI (header, main content, a corner).
export function autoAreas(asset) {
  const tall = asset && asset.height > asset.width * 1.2
  const pool = tall
    ? [
        { x: 0.05, y: 0.04, w: 0.9, h: 0.16 },
        { x: 0.05, y: 0.3, w: 0.9, h: 0.22 },
        { x: 0.05, y: 0.62, w: 0.9, h: 0.24 }
      ]
    : [
        { x: 0.03, y: 0.04, w: 0.42, h: 0.3 },
        { x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
        { x: 0.55, y: 0.05, w: 0.42, h: 0.34 },
        { x: 0.52, y: 0.58, w: 0.44, h: 0.36 },
        { x: 0.04, y: 0.6, w: 0.42, h: 0.34 }
      ]
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, tall ? 3 : 3).map((a) => ({
    ...a,
    x: clamp(a.x + rand(-0.03, 0.03), 0, 1 - a.w),
    y: clamp(a.y + rand(-0.03, 0.03), 0, 1 - a.h)
  }))
}

/**
 * @returns {{ start, end, stops: Array<{id, at, shot}>, duration }}
 */
export function composeShots({ engine, project, asset, areas }) {
  const look = project.look
  const device = look.device
  const r = ratioOf(project.ratio)
  const aspect = r.w / r.h
  const base = { ...DEFAULT_SHOT, ...DEVICE_DEFAULT_SHOTS[device] }
  const U = Math.random() < 0.5 ? -1 : 1
  const targets = areas.length ? areas : autoAreas(asset)

  const keys = []
  const durations = [] // duration of the segment leading into each key (first key has none)

  // Establishing shot.
  keys.push(clean({ ...base, rotateY: base.rotateY + U * rand(6, 14), zoom: rand(0.86, 0.95), offsetX: 0, offsetY: 0, blur: 22, focusPoint: null }))

  targets.forEach((area, i) => {
    const side = i % 2 ? -U : U
    const rot =
      device === 'frame'
        ? { rotateX: base.rotateX * 0.45 + rand(-6, 6), rotateY: side * rand(12, 24), rotateZ: base.rotateZ * 0.4 + rand(-4, 4) }
        : { rotateX: rand(4, 14), rotateY: side * rand(14, 28), rotateZ: rand(-2, 2) }
    const framed = engine.frameArea(look, asset, area, rot, aspect)
    const arrive = clean({ ...rot, ...framed, blur: 48, focusPoint: { x: 0.5, y: 0.5 } })
    // Drift slightly while holding so the frame never feels frozen.
    const drift = { ...rot, rotateY: rot.rotateY - side * rand(2, 4), rotateX: rot.rotateX + rand(-1.5, 1.5) }
    const framedHold = engine.frameArea(look, asset, area, drift, aspect)
    const hold = clean({ ...drift, ...framedHold, zoom: framedHold.zoom * 1.05, blur: 48, focusPoint: { x: 0.5, y: 0.5 } })
    keys.push(arrive)
    durations.push(TRAVEL)
    keys.push(hold)
    durations.push(HOLD)
  })

  // Pull back to finish.
  keys.push(clean({ ...base, rotateY: base.rotateY - U * rand(6, 12), zoom: rand(0.92, 1.02), offsetX: 0, offsetY: 0, blur: 22, focusPoint: null }))
  durations.push(TRAVEL + 0.2)

  const total = durations.reduce((a, b) => a + b, 0)
  let acc = 0
  const stops = keys.slice(1, -1).map((shot, i) => {
    acc += durations[i]
    return { id: uid('pos'), at: r3(acc / total), shot }
  })
  return {
    start: keys[0],
    end: keys[keys.length - 1],
    stops,
    duration: Math.round(total * 10) / 10
  }
}
