// Backdrop painting shared by the 3D stage and the 2D text/logo scenes.
import { BACKDROP_GRADIENTS } from '../defaults'

export function gradientById(id) {
  return BACKDROP_GRADIENTS.find((g) => g.id === id) || BACKDROP_GRADIENTS[0]
}

export function resolveBackdropColor(backdrop, autoColor) {
  if (!backdrop || backdrop.type === 'auto') return autoColor || '#1c1c1f'
  if (backdrop.type === 'color') return backdrop.color || '#1c1c1f'
  if (backdrop.type === 'gradient') return gradientById(backdrop.gradient).stops[1]
  return autoColor || '#1c1c1f'
}

function paintGradient(ctx, W, H, g) {
  const a = ((g.angle - 90) * Math.PI) / 180
  const len = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a))
  const cx = W / 2
  const cy = H / 2
  const dx = (Math.cos(a) * len) / 2
  const dy = (Math.sin(a) * len) / 2
  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
  g.stops.forEach((c, i) => grad.addColorStop(i / (g.stops.length - 1), c))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
}

export function paintBackdrop(ctx, W, H, backdrop, { autoColor, image } = {}) {
  const type = backdrop?.type || 'auto'
  ctx.save()
  ctx.clearRect(0, 0, W, H)
  if (type === 'transparent') {
    ctx.restore()
    return
  }
  if (type === 'gradient') {
    paintGradient(ctx, W, H, gradientById(backdrop.gradient))
  } else if (type === 'image' && image) {
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, W, H)
    const iw = image.naturalWidth || image.videoWidth || image.width
    const ih = image.naturalHeight || image.videoHeight || image.height
    const blur = Math.max(0, backdrop.blur || 0)
    const px = (blur / 100) * Math.max(W, H) * 0.03
    const scale = Math.max(W / iw, H / ih) * (1 + (px > 0 ? 0.08 : 0))
    const dw = iw * scale
    const dh = ih * scale
    if (px > 0) ctx.filter = `blur(${px}px)`
    ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh)
    ctx.filter = 'none'
  } else {
    ctx.fillStyle = resolveBackdropColor(backdrop, autoColor)
    ctx.fillRect(0, 0, W, H)
  }
  ctx.restore()
}

export function paintCheckerboard(ctx, W, H, size = 16) {
  ctx.save()
  ctx.fillStyle = '#2a2a2e'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#353539'
  for (let y = 0; y < H; y += size) {
    for (let x = (y / size) % 2 ? size : 0; x < W; x += size * 2) ctx.fillRect(x, y, size, size)
  }
  ctx.restore()
}
