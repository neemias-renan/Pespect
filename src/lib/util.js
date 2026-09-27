export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const rand = (min, max) => min + Math.random() * (max - min)

export function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

export function formatTime(seconds, withTenths = true) {
  const s = Math.max(0, seconds || 0)
  const m = Math.floor(s / 60)
  const rest = s - m * 60
  const secs = withTenths ? rest.toFixed(1).padStart(4, '0') : String(Math.floor(rest)).padStart(2, '0')
  return `${m}:${secs}`
}

export function formatBytes(bytes) {
  if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1e3))} KB`
  const mb = bytes / 1e6
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`
}

export function formatDate(ts) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString('pt-BR')
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function slugify(name) {
  return (name || 'pespect').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pespect'
}

export function isMac() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

export function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
