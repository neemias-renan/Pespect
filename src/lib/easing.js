// Easing curves used by camera moves and transitions.
function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t) => ((ay * t + by) * t + cy) * t
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x
      if (Math.abs(err) < 1e-5) break
      const d = sampleDX(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    return sampleY(Math.max(0, Math.min(1, t)))
  }
}

export const EASING_FUNCTIONS = {
  linear: (t) => t,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  'ease-in': cubicBezier(0.42, 0, 1, 1),
  'ease-out': cubicBezier(0, 0, 0.58, 1),
  'ease-in-out': cubicBezier(0.42, 0, 0.58, 1),
  smooth: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  cinematic: cubicBezier(0.45, 0.05, 0.15, 1),
  'out-cubic': (t) => 1 - Math.pow(1 - t, 3),
  'out-expo': (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  'out-back': (t) => {
    const c1 = 1.4
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }
}

export function ease(name, t) {
  const fn = EASING_FUNCTIONS[name] || EASING_FUNCTIONS.linear
  return fn(Math.max(0, Math.min(1, t)))
}
