// Composites what the camera sees: 3D shots, text and logo scenes, transitions. Used by preview and export.
import { Engine } from './Engine'
import { paintBackdrop, resolveBackdropColor } from './backdrop'
import { drawTextScene, drawLogoScene, ensureFont } from './overlay'
import { evaluateTimeline, sourceTimeFor } from '../timeline'
import { getCachedMedia, loadMedia, seekVideo, isVideoMime } from '../media'
import { autoBackdropFrom } from '../color'
import { DEFAULT_SHOT } from '../defaults'

export class Studio {
  constructor({ getAsset, onInvalidate } = {}) {
    this.engine = new Engine()
    this.getAsset = getAsset || (() => null)
    this.onInvalidate = onInvalidate || (() => {})
    this.loading = new Set()
    this.scratch = [document.createElement('canvas'), document.createElement('canvas')]
    this.boundVideos = new WeakSet()
  }

  // ---------------------------------------------------------------- media

  media(assetId) {
    if (!assetId) return null
    const el = getCachedMedia(assetId)
    if (el) return el
    const asset = this.getAsset(assetId)
    if (asset && !this.loading.has(assetId)) {
      this.loading.add(assetId)
      loadMedia(asset)
        .then((element) => {
          if (element instanceof HTMLVideoElement && !this.boundVideos.has(element)) {
            this.boundVideos.add(element)
            element.addEventListener('seeked', () => this.onInvalidate())
          }
          this.onInvalidate()
        })
        .catch(() => {})
        .finally(() => this.loading.delete(assetId))
    }
    return null
  }

  async preload(project, mode) {
    const ids = new Set()
    const look = project.look
    if (look.backdrop?.type === 'image' && look.backdrop.imageAssetId) ids.add(look.backdrop.imageAssetId)
    if (mode === 'photo') {
      if (project.activeAssetId) ids.add(project.activeAssetId)
    } else {
      for (const s of project.scenes) {
        if (s.assetId) ids.add(s.assetId)
        if (s.type === 'text') await ensureFont(s.font || 'Inter', s.weight || 600)
      }
    }
    await Promise.all(
      [...ids].map((id) => {
        const asset = this.getAsset(id)
        return asset ? loadMedia(asset).catch(() => null) : null
      })
    )
  }

  autoColor(project, assetId) {
    const asset = this.getAsset(assetId || project.activeAssetId || project.scenes.find((s) => s.type === 'shot')?.assetId)
    return autoBackdropFrom(asset?.dominant || '#2a2a2e')
  }

  // ---------------------------------------------------------------- drawing

  drawShot(ctx, W, H, project, assetId, shot, { time = 0, transparent = false } = {}) {
    const look = project.look
    const asset = this.getAsset(assetId)
    const element = this.media(assetId)
    const backdropImage = look.backdrop?.type === 'image' ? this.media(look.backdrop.imageAssetId) : null
    this.engine.setSize(W, H, 1)
    const canvas = this.engine.renderState({
      look,
      shot: { ...DEFAULT_SHOT, ...shot },
      asset,
      element,
      isVideo: element instanceof HTMLVideoElement,
      backdropImage,
      autoColor: this.autoColor(project, assetId),
      transparent: transparent || look.backdrop?.type === 'transparent',
      time
    })
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(canvas, 0, 0, W, H)
  }

  drawBackdrop2D(ctx, W, H, project) {
    const look = project.look
    const backdropImage = look.backdrop?.type === 'image' ? this.media(look.backdrop.imageAssetId) : null
    paintBackdrop(ctx, W, H, look.backdrop, { autoColor: this.autoColor(project), image: backdropImage })
  }

  drawFrame(ctx, W, H, project, frame, { time = 0, playing = false, exact = false } = {}) {
    if (!frame) {
      this.drawBackdrop2D(ctx, W, H, project)
      return
    }
    const scene = frame.scene
    if (frame.type === 'shot') {
      const el = this.media(scene.assetId)
      if (el instanceof HTMLVideoElement && !exact) {
        this.syncVideo(el, sourceTimeFor(scene, this.getAsset(scene.assetId), frame.local), playing)
      }
      this.drawShot(ctx, W, H, project, scene.assetId, frame.shot, { time })
    } else if (frame.type === 'text') {
      this.drawBackdrop2D(ctx, W, H, project)
      drawTextScene(ctx, W, H, scene, frame.local, { backdropColor: resolveBackdropColor(project.look.backdrop, this.autoColor(project)) })
    } else if (frame.type === 'logo') {
      this.drawBackdrop2D(ctx, W, H, project)
      drawLogoScene(ctx, W, H, scene, frame.local, this.media(scene.assetId))
    }
  }

  syncVideo(video, target, playing) {
    if (video.seeking) return
    if (playing) {
      // Resync only on real drift (wrap-around at the loop point is handled by the video itself).
      const drift = Math.abs(video.currentTime - target)
      if (drift > 0.35 && !(video.duration && Math.abs(drift - video.duration) < 0.35)) video.currentTime = target
      if (video.paused) video.play().catch(() => {})
    } else {
      if (!video.paused) video.pause()
      if (Math.abs(video.currentTime - target) > 0.02 && !video.seeking) video.currentTime = target
    }
  }

  scratchCanvas(i, W, H) {
    const c = this.scratch[i]
    if (c.width !== W || c.height !== H) {
      c.width = W
      c.height = H
    }
    return c
  }

  composeTransition(ctx, W, H, type, p, a, b) {
    const scaled = (img, scale, alpha = 1, blurPx = 0, dx = 0, dy = 0) => {
      ctx.save()
      ctx.globalAlpha = alpha
      if (blurPx > 0.3) ctx.filter = `blur(${blurPx}px)`
      const w = W * scale
      const h = H * scale
      ctx.drawImage(img, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h)
      ctx.restore()
    }
    // Speed bell curve: 0 at both ends, 1 in the middle (used for motion blur).
    const speed = Math.sin(Math.PI * p)
    const unit = Math.max(W, H)
    ctx.save()
    ctx.clearRect(0, 0, W, H)
    switch (type) {
      case 'fade':
        // Crossfade with a gentle push-in on both frames.
        scaled(a, 1 + 0.03 * p)
        scaled(b, 1.03 - 0.03 * p, p)
        break
      case 'blur': {
        const px = unit * 0.014
        scaled(a, 1 + 0.05 * p, 1, p * px)
        scaled(b, 1.05 - 0.05 * p, p, (1 - p) * px)
        break
      }
      case 'push-left':
      case 'push-right':
      case 'push-up':
      case 'push-down': {
        const horizontal = type === 'push-left' || type === 'push-right'
        const dir = type === 'push-left' || type === 'push-up' ? -1 : 1
        const span = horizontal ? W : H
        const mb = speed * unit * 0.006
        const offA = dir * p * span
        const offB = -dir * (1 - p) * span
        scaled(a, 1, 1, mb, horizontal ? offA : 0, horizontal ? 0 : offA)
        scaled(b, 1, 1, mb, horizontal ? offB : 0, horizontal ? 0 : offB)
        break
      }
      default:
        ctx.drawImage(b, 0, 0)
    }
    ctx.restore()
  }

  renderTimeline(ctx, W, H, project, t, opts = {}) {
    const ev = evaluateTimeline(project.scenes, t)
    if (!ev) {
      this.drawBackdrop2D(ctx, W, H, project)
      return null
    }
    if (ev.transition && !opts.skipTransition) {
      const a = this.scratchCanvas(0, W, H)
      const b = this.scratchCanvas(1, W, H)
      this.drawFrame(a.getContext('2d'), W, H, project, ev.transition.from, { ...opts, time: t, playing: false })
      this.drawFrame(b.getContext('2d'), W, H, project, ev.frame, { ...opts, time: t })
      this.composeTransition(ctx, W, H, ev.transition.type, ev.transition.progress, a, b)
    } else {
      this.drawFrame(ctx, W, H, project, ev.frame, { ...opts, time: t })
    }
    return ev
  }

  renderPhoto(ctx, W, H, project, { time = 0, playing = true, transparent = false } = {}) {
    const el = this.media(project.activeAssetId)
    if (el instanceof HTMLVideoElement) {
      // Loop inside the trimmed range.
      // Only manage looping when the clip is actually trimmed; otherwise the native loop is smoother
      // and avoids seeks, which some files (e.g. recordings without a seek index) handle poorly.
      const asset = this.getAsset(project.activeAssetId)
      const start = asset?.trimStart ?? 0
      const end = Number.isFinite(asset?.trimEnd) ? asset.trimEnd : el.duration
      const trimmed = start > 0.01 || (Number.isFinite(end) && Number.isFinite(el.duration) && end < el.duration - 0.05)
      if (trimmed && !el.seeking && (el.currentTime < start - 0.05 || el.currentTime >= end - 0.02)) el.currentTime = start
      if (playing && el.paused) el.play().catch(() => {})
    }
    this.drawShot(ctx, W, H, project, project.activeAssetId, project.shot, { time, transparent })
  }

  // Frame-accurate render used by the exporter: waits for media and seeks videos first.
  async renderTimelineExact(ctx, W, H, project, t) {
    const ev = evaluateTimeline(project.scenes, t)
    const frames = ev ? [ev.frame, ev.transition?.from].filter(Boolean) : []
    for (const frame of frames) {
      if (frame.type !== 'shot') continue
      const asset = this.getAsset(frame.scene.assetId)
      if (!asset || !isVideoMime(asset.mime)) continue
      const el = await loadMedia(asset)
      if (!el.paused) el.pause()
      await seekVideo(el, sourceTimeFor(frame.scene, asset, frame.local))
    }
    this.renderTimeline(ctx, W, H, project, t, { exact: true, playing: false })
  }

  pauseAllVideos(project) {
    const ids = [project.activeAssetId, ...project.scenes.map((s) => s.assetId)]
    ids.forEach((id) => {
      const el = id && getCachedMedia(id)
      if (el instanceof HTMLVideoElement && !el.paused) el.pause()
    })
  }

  dispose() {
    this.engine.dispose()
  }
}
