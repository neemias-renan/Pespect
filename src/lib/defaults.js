// Static configuration shared across the studio.

export const APP_NAME = 'Pespect'

export const RATIOS = [
  { label: '16:9', value: '16:9', w: 16, h: 9 },
  { label: '4:3', value: '4:3', w: 4, h: 3 },
  { label: '1:1', value: '1:1', w: 1, h: 1 },
  { label: '4:5', value: '4:5', w: 4, h: 5 },
  { label: '9:16', value: '9:16', w: 9, h: 16 }
]

export function ratioOf(value) {
  return RATIOS.find((r) => r.value === value) || RATIOS[0]
}

export const DEVICES = [
  { mode: 'frame', label: 'Moldura' },
  { mode: 'desktop', label: 'MacBook' },
  { mode: 'mobile', label: 'iPhone' },
  { mode: 'display', label: 'Pro Display XDR' }
]

// Screen aspect (width / height) of each device mockup.
export const DEVICE_SCREEN_ASPECT = {
  desktop: 16 / 10.35,
  mobile: 1179 / 2556,
  display: 16 / 9
}

export const FRAME_CORNER_RADIUS_STEPS = [
  { label: 'Nenhum', value: 0 },
  { label: 'Pequeno', value: 0.02 },
  { label: 'Médio', value: 0.045 },
  { label: 'Grande', value: 0.085 }
]

export const FRAME_BORDER_WIDTH_STEPS = [
  { label: 'Fina', value: 0.006 },
  { label: 'Média', value: 0.012 },
  { label: 'Grossa', value: 0.024 }
]

export const ZOOM_LIMITS = { min: 0.35, max: 6 }
export const ROTATION_LIMIT = 180

export const DEFAULT_SHOT = {
  rotateX: -35,
  rotateY: 30,
  rotateZ: -15,
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  blur: 28,
  focusPoint: null
}

export const DEVICE_DEFAULT_SHOTS = {
  frame: { rotateX: -35, rotateY: 30, rotateZ: -15 },
  desktop: { rotateX: 18, rotateY: -30, rotateZ: 0 },
  mobile: { rotateX: 10, rotateY: 26, rotateZ: -6 },
  display: { rotateX: 8, rotateY: -26, rotateZ: 0 }
}

export const LENSES = [
  { label: '24mm', value: 24 },
  { label: '35mm', value: 35 },
  { label: '50mm', value: 50 },
  { label: '85mm', value: 85 },
  { label: '135mm', value: 135 }
]

// Blur 0..100 maps to an f-number between f/16 and f/1.2.
export function apertureLabel(blur) {
  const f = 16 * Math.pow(1.2 / 16, Math.max(0, Math.min(100, blur)) / 100)
  return f >= 10 ? Math.round(f).toString() : f.toFixed(1).replace(/\.0$/, '')
}

export const BACKDROP_COLORS = [
  '#0b0b0d', '#1c1c1f', '#3a3a40', '#f4f4f5', '#ffffff', '#ece6da',
  '#ffd8c2', '#ff5b3a', '#ffb020', '#2f6bff', '#6b4bff', '#12b886',
  '#0f3d3e', '#3b0764', '#f472b6', '#bde0fe'
]

export const BACKDROP_GRADIENTS = [
  { id: 'dusk', label: 'Crepúsculo', angle: 135, stops: ['#1e1b4b', '#7c3aed', '#f472b6'] },
  { id: 'ocean', label: 'Oceano', angle: 160, stops: ['#0f172a', '#1d4ed8', '#38bdf8'] },
  { id: 'sunrise', label: 'Amanhecer', angle: 120, stops: ['#ff5b3a', '#ffb020', '#ffe8a3'] },
  { id: 'mint', label: 'Menta', angle: 140, stops: ['#d1fae5', '#6ee7b7', '#10b981'] },
  { id: 'graphite', label: 'Grafite', angle: 180, stops: ['#3f3f46', '#18181b', '#09090b'] },
  { id: 'paper', label: 'Papel', angle: 180, stops: ['#ffffff', '#f1efe9', '#e2ded3'] },
  { id: 'aurora', label: 'Aurora', angle: 200, stops: ['#022c22', '#0e7490', '#a78bfa'] },
  { id: 'peach', label: 'Pêssego', angle: 130, stops: ['#fde2e4', '#fad2e1', '#ffb4a2'] }
]

export const TEXT_FONTS = [
  { family: 'Inter', fallback: 'sans-serif' },
  { family: 'Instrument Serif', fallback: 'serif' },
  { family: 'Fraunces', fallback: 'serif' },
  { family: 'Cormorant Garamond', fallback: 'serif' },
  { family: 'Bebas Neue', fallback: 'sans-serif' },
  { family: 'Space Grotesk', fallback: 'sans-serif' },
  { family: 'DM Sans', fallback: 'sans-serif' },
  { family: 'Playfair Display', fallback: 'serif' },
  { family: 'JetBrains Mono', fallback: 'monospace' },
  { family: 'Outfit', fallback: 'sans-serif' }
]

export const TEXT_ANIMATIONS = [
  { id: 'simple', label: 'Simples', description: 'Sem animação' },
  { id: 'typewriter-letters', label: 'Máquina de escrever (letras)', description: 'Escreve uma letra por vez' },
  { id: 'typewriter-words', label: 'Máquina de escrever', description: 'Escreve uma palavra por vez' },
  { id: 'letters', label: 'Letras', description: 'Revela letra por letra' },
  { id: 'words', label: 'Palavras', description: 'Revela uma palavra por vez' },
  { id: 'blur', label: 'Surgir com desfoque', description: 'Aparece saindo do desfoque' },
  { id: 'scale', label: 'Escala', description: 'Assenta a partir de uma leve ampliação' },
  { id: 'rise', label: 'Subir', description: 'Sobe até o lugar' }
]

export const TEXT_SIZES = [
  { label: 'Mínimo', value: 0.04 },
  { label: 'Pequeno', value: 0.055 },
  { label: 'Médio', value: 0.08 },
  { label: 'Grande', value: 0.115 },
  { label: 'Enorme', value: 0.17 }
]

export const TEXT_WEIGHTS = [
  { label: 'Regular', value: 400 },
  { label: 'Médio', value: 500 },
  { label: 'Semi', value: 600 },
  { label: 'Negrito', value: 700 }
]

export const EMPHASIS_STYLES = [
  { style: 'highlight', label: 'Marcar palavras selecionadas', icon: 'pi pi-pencil' },
  { style: 'underline', label: 'Sublinhar palavras selecionadas', icon: 'pi pi-minus' },
  { style: 'circle', label: 'Circular palavras selecionadas', icon: 'pi pi-circle' }
]

export const EMPHASIS_COLORS = ['#ffd84d', '#ff8b91', '#6b97ff', '#7ee787', '#ffffff', '#000000']

export const EASINGS = [
  { label: 'Cinematográfico', value: 'cinematic' },
  { label: 'Linear', value: 'linear' },
  { label: 'Suave', value: 'ease' },
  { label: 'Acelerar', value: 'ease-in' },
  { label: 'Desacelerar', value: 'ease-out' },
  { label: 'Acelerar e desacelerar', value: 'ease-in-out' },
  { label: 'Macio', value: 'smooth' }
]

export const TRANSITIONS = [
  { label: 'Corte seco', value: 'cut' },
  { label: 'Dissolver', value: 'fade' },
  { label: 'Dissolver com desfoque', value: 'blur' },
  { label: 'Empurrar para a esquerda', value: 'push-left' },
  { label: 'Empurrar para a direita', value: 'push-right' },
  { label: 'Empurrar para cima', value: 'push-up' },
  { label: 'Empurrar para baixo', value: 'push-down' }
]

export const TRANSITION_DURATION = 0.8

export const LOGO_ANIMATIONS = [
  { label: 'Simples', value: 'simple' },
  { label: 'Surgir', value: 'fade' },
  { label: 'Escala', value: 'scale' },
  { label: 'Subir', value: 'rise' },
  { label: 'Surgir com desfoque', value: 'blur' }
]

export const DEFAULT_SHOT_DURATION = 4
export const DEFAULT_TEXT_DURATION = 3
export const DEFAULT_LOGO_DURATION = 2.5
export const MIN_SCENE_DURATION = 0.5
export const MAX_SCENE_DURATION = 60

export const PHOTO_SIZES = [
  { label: 'Pequeno', value: 1280 },
  { label: 'Médio', value: 1920 },
  { label: 'Grande', value: 3840 }
]

export const PHOTO_FORMATS = [
  { label: 'PNG', value: 'image/png', ext: 'png' },
  { label: 'JPG', value: 'image/jpeg', ext: 'jpg' },
  { label: 'WEBP', value: 'image/webp', ext: 'webp' }
]

export const VIDEO_RESOLUTIONS = [
  { label: '720p', value: 1280 },
  { label: '1080p', value: 1920 },
  { label: '4K', value: 3840 }
]

export const VIDEO_FPS = [
  { label: '30 FPS', value: 30 },
  { label: '60 FPS', value: 60 }
]

export const VIDEO_QUALITIES = [
  { label: 'Padrão', value: 0.1 },
  { label: 'Alta', value: 0.18 },
  { label: 'Máxima', value: 0.3 }
]

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
export const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp,.avif,.gif,.svg,.mp4,.mov,.webm,' +
  [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')

export const KEYBOARD_SHORTCUTS = [
  {
    label: 'Estúdio',
    shortcuts: [
      { keys: ['Arrastar'], label: 'Girar a câmera' },
      { keys: ['⇧', 'Arrastar'], label: 'Mover o enquadramento' },
      { keys: ['Rolar'], label: 'Aproximar ou afastar' },
      { keys: ['Clique duplo'], label: 'Redefinir enquadramento' },
      { keys: ['F'], label: 'Clicar para definir o foco' },
      { keys: ['P'], label: 'Modo foto' },
      { keys: ['V'], label: 'Modo vídeo' },
      { keys: ['L'], label: 'Abrir biblioteca' },
      { keys: ['⌘', 'E'], label: 'Capturar ou gravar' },
      { keys: ['?'], label: 'Atalhos de teclado' }
    ]
  },
  {
    label: 'Linha do tempo',
    shortcuts: [
      { keys: ['Espaço'], label: 'Reproduzir ou pausar' },
      { keys: ['Enter'], label: 'Voltar ao início' },
      { keys: ['Delete'], label: 'Excluir a cena selecionada' },
      { keys: ['S'], label: 'Dividir a cena no cursor' },
      { keys: ['⌘', 'C'], label: 'Copiar a seleção' },
      { keys: ['⌘', 'X'], label: 'Recortar a seleção' },
      { keys: ['⌘', 'V'], label: 'Colar' },
      { keys: ['⌘', 'Z'], label: 'Desfazer' },
      { keys: ['⌘', '⇧', 'Z'], label: 'Refazer' }
    ]
  }
]
