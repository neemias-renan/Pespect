// Camera movement presets: each one builds a START and END camera state around a base shot.
import { DEFAULT_SHOT, ZOOM_LIMITS } from './defaults'
import { clamp, rand } from './util'

export const MOTION_PRESETS = [
  { id: 'static', label: 'Sem movimento', description: 'Mantém o enquadramento' },
  { id: 'focus-push', label: 'Aproximação', description: 'Aproxima devagar da tela' },
  { id: 'focus-pull', label: 'Afastamento', description: 'Afasta para revelar o dispositivo' },
  { id: 'side-drift', label: 'Deslize lateral', description: 'Desliza de lado pela interface' },
  { id: 'angle-settle', label: 'Ajuste de ângulo', description: 'Assenta a partir de um ângulo inclinado' },
  { id: 'soft-orbit', label: 'Órbita suave', description: 'Órbita leve ao redor do dispositivo' },
  { id: 'diagonal-rise', label: 'Subida diagonal', description: 'Sobe na diagonal até o lugar' },
  { id: 'close-orbit', label: 'Órbita próxima', description: 'Órbita fechada, perto da tela' },
  { id: 'wide-sweep', label: 'Varredura ampla', description: 'Grande movimento de um lado ao outro' },
  { id: 'isometric-glide', label: 'Deslize isométrico', description: 'Desliza por uma vista isométrica' },
  { id: 'isometric-reveal', label: 'Revelação isométrica', description: 'Revela até uma vista isométrica' }
]

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d

function normalize(shot) {
  return {
    ...DEFAULT_SHOT,
    ...shot,
    rotateX: round(clamp(shot.rotateX, -89, 89), 1),
    rotateY: round(clamp(shot.rotateY, -180, 180), 1),
    rotateZ: round(clamp(shot.rotateZ, -180, 180), 1),
    offsetX: round(clamp(shot.offsetX, -1.5, 1.5), 3),
    offsetY: round(clamp(shot.offsetY, -1.5, 1.5), 3),
    zoom: round(clamp(shot.zoom, ZOOM_LIMITS.min, ZOOM_LIMITS.max), 3)
  }
}

export function createMotion(presetId, baseShot = DEFAULT_SHOT, device = 'frame') {
  const base = { ...DEFAULT_SHOT, ...baseShot }
  const U = Math.random() < 0.5 ? -1 : 1
  const F = Math.random() < 0.5 ? -1 : 1
  const z = base.zoom
  const at = (patch) => normalize({ ...base, ...patch })
  const o = 0.01 // offset unit

  switch (presetId) {
    case 'static':
      return { start: at({}), end: at({}) }
    case 'focus-push':
      return {
        start: at({ zoom: z * rand(0.72, 0.86), offsetX: base.offsetX + U * rand(4, 14) * o }),
        end: at({ zoom: z * rand(1.18, 1.35) })
      }
    case 'focus-pull':
      return {
        start: at({ rotateY: base.rotateY + U * rand(8, 18), zoom: z * rand(1.3, 1.6) }),
        end: at({ zoom: z * rand(0.9, 1) })
      }
    case 'side-drift':
      return {
        start: at({ rotateX: base.rotateX + F * rand(2, 8), rotateY: base.rotateY + U * rand(8, 16), offsetX: base.offsetX + U * rand(14, 30) * o }),
        end: at({ rotateY: base.rotateY - U * rand(4, 10), offsetX: base.offsetX - U * rand(10, 22) * o })
      }
    case 'angle-settle':
      return {
        start: at({ rotateX: base.rotateX + F * rand(14, 26), rotateY: base.rotateY + U * rand(18, 32), zoom: z * rand(0.82, 0.94) }),
        end: at({ zoom: z * rand(1.02, 1.12) })
      }
    case 'soft-orbit':
      return {
        start: at({ rotateY: base.rotateY + U * rand(14, 24), rotateX: base.rotateX + F * rand(2, 8) }),
        end: at({ rotateY: base.rotateY - U * rand(12, 22), rotateX: base.rotateX - F * rand(2, 6) })
      }
    case 'diagonal-rise':
      return {
        start: at({ rotateX: base.rotateX - rand(10, 18), rotateZ: base.rotateZ + U * rand(4, 9), offsetY: base.offsetY - rand(18, 30) * o, zoom: z * rand(0.85, 0.95) }),
        end: at({ rotateZ: base.rotateZ - U * rand(1, 4), offsetY: base.offsetY + rand(2, 8) * o, zoom: z * rand(1.04, 1.14) })
      }
    case 'close-orbit':
      return {
        start: at({ rotateY: base.rotateY - U * rand(20, 32), rotateZ: base.rotateZ + U * F * rand(3, 8), zoom: z * rand(1.5, 1.9) }),
        end: at({ rotateY: base.rotateY + U * rand(8, 16), zoom: z * rand(1.25, 1.45) })
      }
    case 'wide-sweep':
      return {
        start: at({ rotateX: base.rotateX - F * rand(4, 12), rotateY: base.rotateY + U * rand(34, 50), zoom: z * rand(0.75, 0.88), offsetX: base.offsetX + U * rand(10, 20) * o }),
        end: at({ rotateY: base.rotateY - U * rand(10, 20), offsetX: base.offsetX - U * rand(4, 12) * o, zoom: z * rand(1, 1.1) })
      }
    case 'isometric-glide':
      if (device !== 'frame') {
        return {
          start: at({ rotateX: rand(26, 34), rotateY: U * rand(36, 48), rotateZ: 0, zoom: z * rand(0.9, 1), offsetX: U * rand(10, 18) * o }),
          end: at({ rotateX: rand(20, 28), rotateY: U * rand(18, 28), rotateZ: 0, zoom: z * rand(1.08, 1.2), offsetX: -U * rand(4, 10) * o })
        }
      }
      return {
        start: at({ rotateX: -rand(46, 54), rotateY: U * rand(6, 16), rotateZ: U * rand(38, 46), zoom: z * rand(0.9, 1), offsetX: U * rand(12, 22) * o }),
        end: at({ rotateX: -rand(40, 48), rotateY: -U * rand(4, 12), rotateZ: U * rand(32, 40), zoom: z * rand(1.1, 1.25), offsetX: -U * rand(6, 14) * o })
      }
    case 'isometric-reveal':
      if (device !== 'frame') {
        return {
          start: at({ rotateX: rand(4, 10), rotateY: -U * rand(8, 16), rotateZ: 0, zoom: z * rand(0.72, 0.84) }),
          end: at({ rotateX: rand(28, 36), rotateY: U * rand(34, 44), rotateZ: 0, zoom: z * rand(1.02, 1.12) })
        }
      }
      return {
        start: at({ rotateX: -rand(20, 32), rotateY: -U * rand(8, 18), rotateZ: U * rand(14, 24), zoom: z * rand(0.7, 0.82) }),
        end: at({ rotateX: -rand(46, 54), rotateY: U * rand(6, 14), rotateZ: U * rand(40, 46), zoom: z * rand(1.02, 1.14) })
      }
    default:
      return { start: at({}), end: at({}) }
  }
}

export function randomPresetId(exclude) {
  const pool = MOTION_PRESETS.filter((p) => p.id !== 'static' && p.id !== exclude)
  return pool[Math.floor(Math.random() * pool.length)].id
}
