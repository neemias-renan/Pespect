// Small color helpers (hex/rgb/oklch, luminance, dominant color).

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }) {
  const to = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function normalizeHex(value, fallback = '#000000') {
  const v = String(value || '').trim().replace(/^#?/, '#')
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(v)) return rgbToHex(hexToRgb(v))
  return fallback
}

export function mix(a, b, t) {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t })
}

function srgbToLinear(c) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

export function isLight(hex) {
  return luminance(hex) > 0.36
}

export function toOklch(hex) {
  const { r, g, b } = hexToRgb(hex)
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.sqrt(A * A + B * B)
  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360
  return { l: L, c: C, h: H }
}

export function oklchString(hex) {
  const { l, c, h } = toOklch(hex)
  return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${Math.round(h)})`
}

// Samples an image/video/canvas and returns its average "mood" color.
export function dominantColor(source) {
  try {
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(source, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)
    let r = 0, g = 0, b = 0, w = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const cr = data[i], cg = data[i + 1], cb = data[i + 2]
      const max = Math.max(cr, cg, cb)
      const min = Math.min(cr, cg, cb)
      // Favor saturated pixels so the backdrop picks up the UI's accent.
      const weight = 1 + ((max - min) / 255) * 6
      r += cr * weight; g += cg * weight; b += cb * weight; w += weight
    }
    if (!w) return '#1c1c1f'
    return rgbToHex({ r: r / w, g: g / w, b: b / w })
  } catch {
    return '#1c1c1f'
  }
}

// Turns a UI's dominant color into a calm studio backdrop.
export function autoBackdropFrom(hex) {
  const lum = luminance(hex)
  if (lum > 0.5) return mix(hex, '#e9e7e2', 0.55)
  if (lum < 0.03) return mix(hex, '#141417', 0.4)
  return mix(hex, lum > 0.2 ? '#d9d6cf' : '#101014', 0.45)
}
