// Tiny synthesized UI sounds (no audio files needed).
let ctx = null
let enabled = true

export function setSoundEnabled(value) {
  enabled = !!value
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

const VOICES = {
  toggle: { freq: 880, end: 620, dur: 0.05, type: 'triangle' },
  tick: { freq: 1600, end: 1500, dur: 0.018, type: 'square' },
  release: { freq: 520, end: 760, dur: 0.07, type: 'sine' },
  shutter: { freq: 220, end: 90, dur: 0.12, type: 'sawtooth', noise: true },
  success: { freq: 660, end: 990, dur: 0.16, type: 'sine' },
  delete: { freq: 300, end: 140, dur: 0.1, type: 'triangle' }
}

let lastTick = 0

export function playSound(kind = 'toggle', volume = 0.3) {
  if (!enabled) return
  if (kind === 'tick') {
    const now = performance.now()
    if (now - lastTick < 45) return
    lastTick = now
  }
  const ac = audio()
  if (!ac) return
  const v = VOICES[kind] || VOICES.toggle
  const t0 = ac.currentTime
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.12 * volume, t0 + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + v.dur)
  gain.connect(ac.destination)
  const osc = ac.createOscillator()
  osc.type = v.type
  osc.frequency.setValueAtTime(v.freq, t0)
  osc.frequency.exponentialRampToValueAtTime(v.end, t0 + v.dur)
  osc.connect(gain)
  osc.start(t0)
  osc.stop(t0 + v.dur + 0.02)
  if (v.noise) {
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * v.dur), ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = ac.createBufferSource()
    src.buffer = buffer
    const ng = ac.createGain()
    ng.gain.value = 0.25 * volume
    src.connect(ng)
    ng.connect(ac.destination)
    src.start(t0)
  }
}
