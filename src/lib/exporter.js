// Photo capture (PNG/JPG/WEBP) and video recording (MP4 via WebCodecs, MediaRecorder fallback).
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { ratioOf } from './defaults'
import { totalDuration } from './timeline'
import { makeThumbnail } from './media'

export function outputSize(ratioValue, longEdge) {
  const r = ratioOf(ratioValue)
  let w
  let h
  if (r.w >= r.h) {
    w = longEdge
    h = (longEdge * r.h) / r.w
  } else {
    h = longEdge
    w = (longEdge * r.w) / r.h
  }
  const even = (v) => Math.max(2, Math.round(v / 2) * 2)
  return { width: even(w), height: even(h) }
}

function canvasOf(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0))

export async function capturePhoto(studio, project, { longEdge = 1920, format = 'image/png', quality = 0.95 } = {}) {
  const { width, height } = outputSize(project.ratio, longEdge)
  await studio.preload(project, 'photo')
  const canvas = canvasOf(width, height)
  const ctx = canvas.getContext('2d')
  studio.renderPhoto(ctx, width, height, project, { playing: false })
  // Render twice so late-arriving textures (first upload) are guaranteed to be on screen.
  await nextTick()
  studio.renderPhoto(ctx, width, height, project, { playing: false })
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha na captura'))), format, quality)
  )
  return {
    kind: 'image',
    blob,
    mime: format,
    width,
    height,
    size: blob.size,
    thumbnail: makeThumbnail(canvas, width, height, 480)
  }
}

async function pickCodec(width, height, fps, bitrate) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null
  const candidates = ['avc1.640034', 'avc1.4d0034', 'avc1.640033', 'avc1.42003e', 'avc1.42001f']
  for (const codec of candidates) {
    try {
      const config = { codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' } }
      const res = await VideoEncoder.isConfigSupported(config)
      if (res.supported) return config
    } catch {
      // try next
    }
  }
  return null
}

function abortError() {
  const err = new Error('Gravação cancelada')
  err.name = 'AbortError'
  return err
}

export async function recordVideo(studio, project, { longEdge = 1920, fps = 30, quality = 0.18, onProgress, signal } = {}) {
  const duration = totalDuration(project.scenes)
  if (duration <= 0) throw new Error('Adicione pelo menos uma cena à linha do tempo.')
  const { width, height } = outputSize(project.ratio, longEdge)
  await studio.preload(project, 'video')
  studio.pauseAllVideos(project)
  const canvas = canvasOf(width, height)
  const ctx = canvas.getContext('2d', { alpha: false })
  const bitrate = Math.round(width * height * fps * quality)
  const config = await pickCodec(width, height, fps, bitrate)

  let result
  if (config) {
    result = await encodeWithWebCodecs({ studio, project, canvas, ctx, width, height, fps, duration, config, onProgress, signal })
  } else {
    result = await recordWithMediaRecorder({ studio, project, canvas, ctx, width, height, fps, duration, bitrate, onProgress, signal })
  }

  // Poster frame for the camera roll.
  await studio.renderTimelineExact(ctx, width, height, project, Math.min(duration * 0.35, duration - 0.01))
  return {
    ...result,
    kind: 'video',
    width,
    height,
    duration,
    frameRate: fps,
    size: result.blob.size,
    thumbnail: makeThumbnail(canvas, width, height, 480)
  }
}

async function encodeWithWebCodecs({ studio, project, canvas, ctx, width, height, fps, duration, config, onProgress, signal }) {
  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height, frameRate: fps },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset'
  })
  let failure = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e
    }
  })
  encoder.configure(config)
  const frames = Math.max(1, Math.round(duration * fps))
  const frameDuration = 1e6 / fps
  try {
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw abortError()
      if (failure) throw failure
      await studio.renderTimelineExact(ctx, width, height, project, i / fps)
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameDuration), duration: Math.round(frameDuration) })
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
      frame.close()
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4))
      onProgress?.({ phase: 'rendering', progress: (i + 1) / frames })
      if (i % 2 === 0) await nextTick()
    }
    onProgress?.({ phase: 'finalizing', progress: 1 })
    await encoder.flush()
    if (failure) throw failure
    muxer.finalize()
  } finally {
    if (encoder.state !== 'closed') encoder.close()
  }
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), mime: 'video/mp4' }
}

function pickRecorderMime() {
  const list = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return list.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || ''
}

async function recordWithMediaRecorder({ studio, project, canvas, ctx, width, height, fps, duration, bitrate, onProgress, signal }) {
  if (!window.MediaRecorder || !canvas.captureStream) throw new Error('Este navegador não suporta gravação de vídeo.')
  const mimeType = pickRecorderMime()
  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate })
  const chunks = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise((resolve) => (recorder.onstop = resolve))
  studio.renderTimeline(ctx, width, height, project, 0, { playing: true })
  recorder.start(250)
  const t0 = performance.now()
  await new Promise((resolve, reject) => {
    const tick = () => {
      if (signal?.aborted) return reject(abortError())
      const t = (performance.now() - t0) / 1000
      if (t >= duration) return resolve()
      studio.renderTimeline(ctx, width, height, project, t, { playing: true })
      onProgress?.({ phase: 'recording', progress: t / duration })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }).finally(() => {
    if (recorder.state !== 'inactive') recorder.stop()
    stream.getTracks().forEach((tr) => tr.stop())
  })
  await stopped
  studio.pauseAllVideos(project)
  const type = (mimeType || 'video/webm').split(';')[0]
  return { blob: new Blob(chunks, { type }), mime: type }
}
