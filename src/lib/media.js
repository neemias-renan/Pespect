// Turns user files into library assets and keeps decoded media elements cached.
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES } from './defaults'
import { dominantColor } from './color'
import { uid } from './util'

const EXT_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif',
  gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm'
}

export function mimeOf(file) {
  if (file.type) return file.type
  const ext = (file.name || '').split('.').pop().toLowerCase()
  return EXT_MIME[ext] || ''
}

export function isAcceptedFile(file) {
  const mime = mimeOf(file)
  return ACCEPTED_IMAGE_TYPES.includes(mime) || ACCEPTED_VIDEO_TYPES.includes(mime)
}

export function isVideoMime(mime) {
  return String(mime || '').startsWith('video/')
}

export function formatLabel(mime) {
  const map = {
    'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/webp': 'WEBP', 'image/avif': 'AVIF', 'image/gif': 'GIF',
    'image/svg+xml': 'SVG', 'video/mp4': 'MP4', 'video/quicktime': 'MOV', 'video/webm': 'WEBM'
  }
  return map[mime] || (mime || '').split('/').pop()?.toUpperCase() || 'FILE'
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível decodificar esta imagem.'))
    img.src = url
  })
}

// Browsers throttle or stop decoding <video> elements that aren't in the document,
// so playing media lives in an invisible host element.
let videoHost = null
function attachVideo(video) {
  if (!videoHost) {
    videoHost = document.createElement('div')
    videoHost.setAttribute('aria-hidden', 'true')
    videoHost.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:-1'
    document.body.appendChild(videoHost)
  }
  video.style.cssText = 'width:2px;height:2px'
  videoHost.appendChild(video)
}

function loadVideo(url, { attach = false } = {}) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    if (attach) attachVideo(video)
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    video.onloadeddata = () => {
      // three.js sizes textures from the element's width/height attributes (0 for <video>).
      video.width = video.videoWidth
      video.height = video.videoHeight
      resolve(video)
    }
    video.onerror = () => reject(new Error('Este formato de vídeo não é suportado pelo seu navegador.'))
    video.src = url
  })
}

export function seekVideo(video, time) {
  return new Promise((resolve) => {
    const target = Math.max(0, Math.min((video.duration || 0) - 0.001, time))
    if (Math.abs(video.currentTime - target) < 0.0005 && video.readyState >= 2) return resolve()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      video.removeEventListener('seeked', finish)
      resolve()
    }
    video.addEventListener('seeked', finish)
    video.currentTime = target
    setTimeout(finish, 1500)
  })
}

export function makeThumbnail(source, srcW, srcH, max = 360) {
  const scale = Math.min(1, max / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0, w, h)
  return canvas.toDataURL('image/webp', 0.82)
}

export async function fileToAsset(file, { kind } = {}) {
  const mime = mimeOf(file)
  const url = URL.createObjectURL(file)
  try {
    const base = {
      id: uid('asset'),
      name: (file.name || 'Sem título').replace(/\.[^.]+$/, ''),
      mime,
      size: file.size,
      blob: file,
      createdAt: Date.now()
    }
    if (isVideoMime(mime)) {
      const video = await loadVideo(url)
      await seekVideo(video, Math.min(0.2, (video.duration || 1) / 2))
      const width = video.videoWidth
      const height = video.videoHeight
      return {
        ...base,
        kind: kind || 'video',
        width,
        height,
        duration: video.duration,
        trimStart: 0,
        trimEnd: video.duration,
        crop: null,
        thumbnail: makeThumbnail(video, width, height),
        dominant: dominantColor(video)
      }
    }
    const img = await loadImage(url)
    const width = img.naturalWidth || 1600
    const height = img.naturalHeight || 1000
    return {
      ...base,
      kind: kind || 'image',
      width,
      height,
      duration: null,
      crop: null,
      thumbnail: makeThumbnail(img, width, height),
      dominant: dominantColor(img)
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---- decoded media cache -------------------------------------------------

const cache = new Map()

export function getCachedMedia(assetId) {
  return cache.get(assetId)?.element || null
}

export async function loadMedia(asset) {
  if (!asset) return null
  const hit = cache.get(asset.id)
  if (hit) return hit.promise
  const url = asset.url || URL.createObjectURL(asset.blob)
  const entry = { url, element: null, promise: null, owned: !asset.url }
  entry.promise = (isVideoMime(asset.mime) ? loadVideo(url, { attach: true }) : loadImage(url)).then((el) => {
    if (isVideoMime(asset.mime)) {
      el.loop = true
    }
    entry.element = el
    return el
  })
  cache.set(asset.id, entry)
  return entry.promise
}

export function releaseMedia(assetId) {
  const entry = cache.get(assetId)
  if (!entry) return
  if (entry.element instanceof HTMLVideoElement) {
    entry.element.pause()
    entry.element.removeAttribute('src')
    entry.element.load()
    entry.element.remove()
  }
  if (entry.owned) URL.revokeObjectURL(entry.url)
  cache.delete(assetId)
}
