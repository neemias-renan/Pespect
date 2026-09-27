// 2D drawing of text scenes and logo scenes (animated), shared by preview and export.
import { TEXT_FONTS } from '../defaults'
import { ease } from '../easing'
import { clamp } from '../util'
import { isLight } from '../color'

let fontsLinked = false
const loadedFonts = new Set()

export function linkFonts() {
  if (fontsLinked || typeof document === 'undefined') return
  fontsLinked = true
  const families = TEXT_FONTS.filter((f) => f.family !== 'Inter')
    .map((f) => {
      const single = ['Instrument Serif', 'Bebas Neue'].includes(f.family)
      return `family=${f.family.replace(/ /g, '+')}${single ? '' : ':wght@400;500;600;700'}`
    })
    .join('&')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
  document.head.appendChild(link)
}

export function fontStack(family) {
  const f = TEXT_FONTS.find((x) => x.family === family) || TEXT_FONTS[0]
  return `"${f.family}", ${f.fallback}`
}

export async function ensureFont(family, weight = 500) {
  linkFonts()
  const key = `${family}:${weight}`
  if (loadedFonts.has(key)) return
  try {
    await Promise.race([
      document.fonts.load(`${weight} 48px "${family}"`),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ])
    loadedFonts.add(key)
  } catch {
    // fall back silently
  }
}

// ---------------------------------------------------------------- text

function tokenize(text) {
  const lines = String(text || '').split('\n')
  let index = 0
  return lines.map((line) =>
    line
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({ word, index: index++ }))
  )
}

export function wordsOf(text) {
  return tokenize(text).flat()
}

function layoutText(ctx, scene, W, H, fontPx) {
  const maxWidth = W * 0.82
  const space = ctx.measureText(' ').width
  const out = []
  for (const para of tokenize(scene.text)) {
    let line = []
    let width = 0
    for (const token of para) {
      const w = ctx.measureText(token.word).width
      const next = line.length ? width + space + w : w
      if (line.length && next > maxWidth) {
        out.push({ tokens: line, width })
        line = [{ ...token, w }]
        width = w
      } else {
        line.push({ ...token, w })
        width = next
      }
    }
    out.push({ tokens: line, width })
  }
  const lineHeight = fontPx * 1.16
  const blockH = out.length * lineHeight
  const cx = W / 2 + (scene.offsetX || 0) * W
  const top = H / 2 + (scene.offsetY || 0) * H - blockH / 2
  const align = scene.align || 'center'
  out.forEach((line, li) => {
    let x
    if (align === 'left') x = cx - maxWidth / 2
    else if (align === 'right') x = cx + maxWidth / 2 - line.width
    else x = cx - line.width / 2
    const y = top + li * lineHeight + lineHeight / 2
    line.tokens.forEach((t) => {
      t.x = x
      t.y = y
      x += t.w + space
    })
  })
  return { lines: out, lineHeight, top, blockH, cx }
}

export function textFontPx(scene, W, H) {
  return (scene.size || 0.08) * Math.sqrt(W * H) * 0.78
}

function drawEmphasis(ctx, token, style, color, p, fontPx) {
  if (p <= 0) return
  const padX = fontPx * 0.08
  ctx.save()
  if (style === 'highlight') {
    ctx.globalAlpha *= 0.9
    ctx.fillStyle = color
    const h = fontPx * 0.92
    ctx.beginPath()
    ctx.roundRect(token.x - padX, token.y - h / 2 + fontPx * 0.04, (token.w + padX * 2) * p, h, fontPx * 0.12)
    ctx.fill()
  } else if (style === 'underline') {
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, fontPx * 0.075)
    ctx.lineCap = 'round'
    ctx.beginPath()
    const y = token.y + fontPx * 0.5
    ctx.moveTo(token.x, y)
    ctx.lineTo(token.x + token.w * p, y)
    ctx.stroke()
  } else if (style === 'circle') {
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, fontPx * 0.06)
    ctx.lineCap = 'round'
    const cx = token.x + token.w / 2
    const cy = token.y + fontPx * 0.04
    const rx = token.w / 2 + fontPx * 0.32
    const ry = fontPx * 0.68
    const start = -Math.PI * 0.75
    const sweep = Math.PI * 2.15 * p
    ctx.beginPath()
    const steps = 64
    for (let i = 0; i <= steps; i++) {
      const a = start + (sweep * i) / steps
      const wobble = 1 + Math.sin(a * 3) * 0.025 + (i / steps) * 0.05
      const x = cx + Math.cos(a) * rx * wobble
      const y = cy + Math.sin(a) * ry * wobble
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

export function drawTextScene(ctx, W, H, scene, local, { backdropColor = '#1c1c1f' } = {}) {
  const fontPx = textFontPx(scene, W, H)
  const weight = scene.weight || 600
  ctx.save()
  ctx.font = `${weight} ${fontPx}px ${fontStack(scene.font)}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const layout = layoutText(ctx, scene, W, H, fontPx)
  const tokens = layout.lines.flatMap((l) => l.tokens)
  const totalChars = tokens.reduce((n, t) => n + t.word.length, 0)
  const anim = scene.animation || 'simple'
  const animDur = anim === 'simple' ? 0 : clamp(scene.duration * 0.55, 0.4, anim.startsWith('typewriter') ? 2.2 : 1.3)
  const pa = animDur ? clamp(local / animDur, 0, 1) : 1
  const emphasis = new Map((scene.emphasis || []).map((e) => [e.word, e]))
  const emphStart = animDur * 0.7
  const pe = ease('ease-out', clamp((local - emphStart) / 0.6, 0, 1))
  const color = !scene.color || scene.color === 'auto' ? (isLight(backdropColor) ? '#111113' : '#ffffff') : scene.color

  // Whole-block animations
  let blockAlpha = 1
  if (anim === 'blur' || anim === 'scale' || anim === 'rise') {
    const e = ease('out-expo', pa)
    blockAlpha = e
    const cy = layout.top + layout.blockH / 2
    if (anim === 'blur' && e < 1) ctx.filter = `blur(${(1 - e) * fontPx * 0.25}px)`
    if (anim === 'scale') {
      const s = 1.08 - 0.08 * e
      ctx.translate(layout.cx, cy)
      ctx.scale(s, s)
      ctx.translate(-layout.cx, -cy)
    }
    if (anim === 'rise') ctx.translate(0, (1 - e) * fontPx * 0.7)
  }
  ctx.globalAlpha = blockAlpha

  let charCursor = 0
  const wordCount = tokens.length
  tokens.forEach((t, wi) => {
    const em = emphasis.get(t.index)
    let visibleChars = t.word.length
    let alpha = 1
    let dy = 0
    let wordBlur = 0
    if (anim === 'typewriter-letters') {
      const shown = Math.floor(pa * totalChars + 1e-6)
      visibleChars = clamp(shown - charCursor, 0, t.word.length)
    } else if (anim === 'typewriter-words') {
      visibleChars = wi < Math.ceil(pa * wordCount - 1e-6) ? t.word.length : 0
    } else if (anim === 'words') {
      const local01 = clamp(pa * (wordCount + 2) - wi, 0, 2) / 2
      alpha = ease('out-expo', local01)
      dy = (1 - alpha) * fontPx * 0.3
      wordBlur = (1 - alpha) * fontPx * 0.12
    }
    if (em && visibleChars > 0 && em.style === 'highlight') {
      ctx.save()
      ctx.globalAlpha = blockAlpha * alpha
      drawEmphasis(ctx, t, em.style, em.color || '#ffd84d', pe, fontPx)
      ctx.restore()
    }
    if (anim === 'letters') {
      let x = t.x
      for (let i = 0; i < t.word.length; i++) {
        const ch = t.word[i]
        const idx = charCursor + i
        const la = ease('out-cubic', clamp(pa * (totalChars + 4) - idx, 0, 4) / 4)
        ctx.globalAlpha = blockAlpha * la
        ctx.fillStyle = color
        ctx.fillText(ch, x, t.y + (1 - la) * fontPx * 0.3)
        x += ctx.measureText(ch).width
      }
    } else if (visibleChars > 0) {
      ctx.save()
      ctx.globalAlpha = blockAlpha * alpha
      ctx.fillStyle = color
      if (wordBlur > 0.3) ctx.filter = `blur(${wordBlur}px)`
      ctx.fillText(t.word.slice(0, visibleChars), t.x, t.y + dy)
      ctx.restore()
    }
    if (em && visibleChars > 0 && em.style !== 'highlight') {
      ctx.save()
      ctx.globalAlpha = blockAlpha * alpha
      drawEmphasis(ctx, t, em.style, em.color || '#ffd84d', pe, fontPx)
      ctx.restore()
    }
    charCursor += t.word.length
  })

  // Blinking caret while typing.
  if (anim.startsWith('typewriter') && pa < 1 && tokens.length) {
    let caret = tokens[tokens.length - 1]
    let cx = caret.x + caret.w
    if (anim === 'typewriter-letters') {
      const shown = Math.floor(pa * totalChars)
      let acc = 0
      for (const t of tokens) {
        if (acc + t.word.length >= shown) {
          caret = t
          cx = t.x + ctx.measureText(t.word.slice(0, shown - acc)).width
          break
        }
        acc += t.word.length
      }
    } else {
      const idx = Math.max(0, Math.ceil(pa * wordCount) - 1)
      caret = tokens[idx]
      cx = caret.x + caret.w
    }
    if (Math.floor(local * 3) % 2 === 0) {
      ctx.globalAlpha = 1
      ctx.fillStyle = color
      ctx.fillRect(cx + fontPx * 0.06, caret.y - fontPx * 0.45, Math.max(2, fontPx * 0.06), fontPx * 0.9)
    }
  }
  ctx.restore()
  return layout
}

// Bounding box (normalized) of a text scene, used for dragging text on the stage.
export function measureTextBox(ctx, W, H, scene) {
  const fontPx = textFontPx(scene, W, H)
  ctx.save()
  ctx.font = `${scene.weight || 600} ${fontPx}px ${fontStack(scene.font)}`
  const layout = layoutText(ctx, scene, W, H, fontPx)
  ctx.restore()
  const maxW = Math.max(...layout.lines.map((l) => l.width), 10)
  return {
    x: (layout.cx - maxW / 2) / W,
    y: layout.top / H,
    w: maxW / W,
    h: layout.blockH / H
  }
}

// ---------------------------------------------------------------- logo

export function drawLogoScene(ctx, W, H, scene, local, image) {
  if (!image) return
  const iw = image.naturalWidth || image.width || 1
  const ih = image.naturalHeight || image.height || 1
  const box = Math.min(W, H) * 0.34 * (scene.scale || 1)
  const s = box / Math.max(iw, ih)
  const dw = iw * s
  const dh = ih * s
  const anim = scene.animation || 'scale'
  const p = anim === 'simple' ? 1 : ease('out-cubic', clamp(local / 0.9, 0, 1))
  ctx.save()
  const cx = W / 2 + (scene.offsetX || 0) * W
  const cy = H / 2 + (scene.offsetY || 0) * H
  ctx.translate(cx, cy)
  if (anim !== 'simple') ctx.globalAlpha = p
  if (anim === 'scale') ctx.scale(0.86 + 0.14 * p, 0.86 + 0.14 * p)
  if (anim === 'rise') ctx.translate(0, (1 - p) * box * 0.25)
  if (anim === 'blur' && p < 1) ctx.filter = `blur(${(1 - p) * 18}px)`
  ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}
