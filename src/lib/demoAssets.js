// Procedurally drawn demo screenshots, so the studio has something to shoot on first launch.
import { makeThumbnail } from './media'
import { dominantColor } from './color'

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function fillRR(ctx, x, y, w, h, r, color) {
  rr(ctx, x, y, w, h, r)
  ctx.fillStyle = color
  ctx.fill()
}

function text(ctx, str, x, y, { size = 14, weight = 500, color = '#111', align = 'left', font = 'Inter, system-ui, sans-serif' } = {}) {
  ctx.font = `${weight} ${size}px ${font}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(str, x, y)
}

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function drawDashboard(ctx, W, H) {
  const r = seeded(7)
  ctx.fillStyle = '#f6f6f4'
  ctx.fillRect(0, 0, W, H)

  // Sidebar
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 250, H)
  ctx.fillStyle = '#ecebe7'
  ctx.fillRect(250, 0, 1, H)
  fillRR(ctx, 24, 26, 30, 30, 9, '#ff5b3a')
  text(ctx, 'Northwind', 66, 41, { size: 17, weight: 700 })
  const nav = ['Visão geral', 'Análises', 'Clientes', 'Receita', 'Campanhas', 'Integrações', 'Configurações']
  nav.forEach((n, i) => {
    const y = 104 + i * 42
    if (i === 1) fillRR(ctx, 14, y - 17, 222, 34, 9, '#f2f1ed')
    fillRR(ctx, 30, y - 7, 14, 14, 4, i === 1 ? '#ff5b3a' : '#d8d6d0')
    text(ctx, n, 58, y, { size: 14, weight: i === 1 ? 600 : 500, color: i === 1 ? '#111' : '#6b6a66' })
  })
  fillRR(ctx, 16, H - 120, 218, 96, 14, '#111')
  text(ctx, 'Assine o Pro', 34, H - 90, { size: 14, weight: 600, color: '#fff' })
  text(ctx, 'Relatórios avançados', 34, H - 66, { size: 12, weight: 400, color: '#a3a3a3' })
  fillRR(ctx, 34, H - 52, 70, 18, 9, '#ff5b3a')

  // Header
  text(ctx, 'Análises', 290, 52, { size: 26, weight: 700 })
  text(ctx, 'Últimos 30 dias · Atualizado há 2 min', 290, 82, { size: 13, weight: 400, color: '#8a8984' })
  fillRR(ctx, W - 380, 34, 220, 38, 10, '#fff')
  text(ctx, 'Buscar relatórios…', W - 360, 53, { size: 13, weight: 400, color: '#a09f9a' })
  fillRR(ctx, W - 146, 34, 110, 38, 10, '#111')
  text(ctx, 'Exportar', W - 91, 53, { size: 13, weight: 600, color: '#fff', align: 'center' })

  // KPI cards
  const kpis = [
    ['Receita', 'R$ 84.210', '+12,4%'],
    ['Usuários ativos', '18.392', '+8,1%'],
    ['Conversão', '4,62%', '+0,6%'],
    ['Cancelamentos', '1,8%', '-0,3%']
  ]
  const cw = (W - 290 - 40 - 3 * 20) / 4
  kpis.forEach(([label, value, delta], i) => {
    const x = 290 + i * (cw + 20)
    fillRR(ctx, x, 116, cw, 118, 16, '#fff')
    text(ctx, label, x + 22, 146, { size: 13, weight: 500, color: '#8a8984' })
    text(ctx, value, x + 22, 186, { size: 30, weight: 700 })
    fillRR(ctx, x + 22, 208, 62, 20, 10, i === 3 ? '#e8f7ef' : '#fff0eb')
    text(ctx, delta, x + 53, 218, { size: 11, weight: 600, color: i === 3 ? '#139a5b' : '#e0482a', align: 'center' })
    // sparkline
    ctx.beginPath()
    for (let k = 0; k < 12; k++) {
      const px = x + cw - 130 + k * 10
      const py = 190 - Math.sin(k * 0.8 + i) * 10 - k * 1.5
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
    }
    ctx.strokeStyle = i === 3 ? '#139a5b' : '#ff5b3a'
    ctx.lineWidth = 2.5
    ctx.stroke()
  })

  // Main chart
  const chartX = 290, chartY = 256, chartW = (W - 330) * 0.64, chartH = 380
  fillRR(ctx, chartX, chartY, chartW, chartH, 16, '#fff')
  text(ctx, 'Receita ao longo do tempo', chartX + 24, chartY + 34, { size: 16, weight: 600 })
  fillRR(ctx, chartX + chartW - 190, chartY + 20, 166, 30, 8, '#f2f1ed')
  ;['1D', '1S', '1M', '1A'].forEach((t, i) => {
    if (i === 2) fillRR(ctx, chartX + chartW - 186 + i * 40, chartY + 24, 38, 22, 6, '#fff')
    text(ctx, t, chartX + chartW - 167 + i * 40, chartY + 35, { size: 11, weight: 600, color: i === 2 ? '#111' : '#8a8984', align: 'center' })
  })
  const gx = chartX + 50, gy = chartY + 80, gw = chartW - 80, gh = chartH - 130
  ctx.strokeStyle = '#efeee9'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath()
    ctx.moveTo(gx, gy + (gh / 4) * i)
    ctx.lineTo(gx + gw, gy + (gh / 4) * i)
    ctx.stroke()
    text(ctx, `${(4 - i) * 25}k`, gx - 12, gy + (gh / 4) * i, { size: 11, weight: 400, color: '#a09f9a', align: 'right' })
  }
  const pts = []
  for (let i = 0; i <= 30; i++) {
    const v = 0.35 + Math.sin(i / 4) * 0.12 + i / 60 + (r() - 0.5) * 0.08
    pts.push([gx + (gw / 30) * i, gy + gh - v * gh])
  }
  const grad = ctx.createLinearGradient(0, gy, 0, gy + gh)
  grad.addColorStop(0, 'rgba(255,91,58,0.28)')
  grad.addColorStop(1, 'rgba(255,91,58,0)')
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.lineTo(gx + gw, gy + gh)
  ctx.lineTo(gx, gy + gh)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.strokeStyle = '#ff5b3a'
  ctx.lineWidth = 3
  ctx.stroke()
  const [hx, hy] = pts[21]
  ctx.beginPath()
  ctx.arc(hx, hy, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.stroke()
  fillRR(ctx, hx - 60, hy - 58, 120, 40, 10, '#111')
  text(ctx, 'R$ 62.480', hx, hy - 38, { size: 14, weight: 600, color: '#fff', align: 'center' })

  // Donut
  const dx = chartX + chartW + 20, dw = W - 40 - dx
  fillRR(ctx, dx, chartY, dw, chartH, 16, '#fff')
  text(ctx, 'Origem do tráfego', dx + 24, chartY + 34, { size: 16, weight: 600 })
  const segs = [[0.42, '#ff5b3a'], [0.26, '#111111'], [0.18, '#ffb020'], [0.14, '#d8d6d0']]
  let a0 = -Math.PI / 2
  const cx = dx + dw / 2, cy = chartY + 170
  segs.forEach(([v, c]) => {
    ctx.beginPath()
    ctx.arc(cx, cy, 86, a0, a0 + v * Math.PI * 2 - 0.03)
    ctx.strokeStyle = c
    ctx.lineWidth = 26
    ctx.lineCap = 'round'
    ctx.stroke()
    a0 += v * Math.PI * 2
  })
  ctx.lineCap = 'butt'
  text(ctx, '48,2 mil', cx, cy - 6, { size: 24, weight: 700, align: 'center' })
  text(ctx, 'visitas', cx, cy + 20, { size: 12, weight: 400, color: '#8a8984', align: 'center' })
  ;['Orgânico', 'Direto', 'Indicação', 'Social'].forEach((l, i) => {
    const y = chartY + 296 + i * 20
    fillRR(ctx, dx + 24, y - 5, 10, 10, 3, segs[i][1])
    text(ctx, l, dx + 44, y, { size: 12, weight: 500, color: '#6b6a66' })
    text(ctx, `${Math.round(segs[i][0] * 100)}%`, dx + dw - 24, y, { size: 12, weight: 600, align: 'right' })
  })

  // Table
  const ty = chartY + chartH + 20
  fillRR(ctx, 290, ty, W - 330, H - ty - 24, 16, '#fff')
  text(ctx, 'Principais clientes', 314, ty + 34, { size: 16, weight: 600 })
  const cols = ['Cliente', 'Plano', 'Licenças', 'MRR', 'Status']
  const colX = [314, 700, 900, 1060, 1220]
  cols.forEach((c, i) => text(ctx, c, colX[i], ty + 72, { size: 12, weight: 500, color: '#a09f9a' }))
  const rows = [['Acme Corp', 'Empresarial', '240', 'R$ 12.400', 'Ativo'], ['Globex', 'Negócios', '86', 'R$ 4.120', 'Ativo'], ['Initech', 'Negócios', '52', 'R$ 2.640', 'Teste']]
  rows.forEach((row, ri) => {
    const y = ty + 110 + ri * 44
    ctx.fillStyle = '#f2f1ed'
    ctx.fillRect(314, y - 24, W - 380, 1)
    ctx.beginPath()
    ctx.arc(328, y, 13, 0, Math.PI * 2)
    ctx.fillStyle = ['#ffd8c2', '#dbeafe', '#dcfce7'][ri]
    ctx.fill()
    row.forEach((c, i) => {
      if (i === 4) {
        fillRR(ctx, colX[i], y - 11, 62, 22, 11, c === 'Ativo' ? '#e8f7ef' : '#fff6e0')
        text(ctx, c, colX[i] + 31, y, { size: 11, weight: 600, color: c === 'Ativo' ? '#139a5b' : '#b7791f', align: 'center' })
      } else {
        text(ctx, c, colX[i] + (i === 0 ? 26 : 0), y, { size: 13, weight: i === 0 ? 600 : 500, color: i === 0 ? '#111' : '#55544f' })
      }
    })
  })
}

function drawTracker(ctx, W, H) {
  const r = seeded(21)
  ctx.fillStyle = '#0e0f11'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#131417'
  ctx.fillRect(0, 0, 240, H)
  ctx.fillStyle = '#1f2024'
  ctx.fillRect(240, 0, 1, H)

  fillRR(ctx, 20, 22, 26, 26, 7, '#5e6ad2')
  text(ctx, 'Orbit', 58, 35, { size: 15, weight: 600, color: '#eeeff1' })
  const nav = [['Entrada', 4], ['Minhas tarefas', 0], ['Visualizações', 0], ['Roteiro', 0]]
  nav.forEach(([n, badge], i) => {
    const y = 86 + i * 34
    fillRR(ctx, 24, y - 6, 12, 12, 3, '#3a3b40')
    text(ctx, n, 48, y, { size: 13, color: '#b4b5b9' })
    if (badge) {
      fillRR(ctx, 200, y - 9, 24, 18, 9, '#2a2b30')
      text(ctx, String(badge), 212, y, { size: 11, color: '#b4b5b9', align: 'center' })
    }
  })
  text(ctx, 'Suas equipes', 22, 250, { size: 11, weight: 600, color: '#6b6c72' })
  ;[['Engenharia', '#26b5ce'], ['Design', '#f2994a'], ['Crescimento', '#4cb782']].forEach(([n, c], i) => {
    const y = 282 + i * 34
    if (i === 0) fillRR(ctx, 12, y - 15, 216, 30, 7, '#1d1e22')
    fillRR(ctx, 24, y - 7, 14, 14, 4, c)
    text(ctx, n, 48, y, { size: 13, color: i === 0 ? '#eeeff1' : '#b4b5b9' })
  })

  // Top bar
  text(ctx, 'Engenharia', 272, 36, { size: 14, weight: 600, color: '#eeeff1' })
  text(ctx, '›  Tarefas ativas', 368, 36, { size: 14, color: '#8a8b91' })
  ;['Todas', 'Ativas', 'Pendências'].forEach((t, i) => {
    const x = 272 + i * 104
    fillRR(ctx, x, 60, 94, 28, 7, i === 1 ? '#26272c' : 'rgba(0,0,0,0)')
    ctx.strokeStyle = '#2a2b30'
    rr(ctx, x, 60, 94, 28, 7)
    ctx.stroke()
    text(ctx, t, x + 47, 74, { size: 12, color: i === 1 ? '#eeeff1' : '#8a8b91', align: 'center' })
  })
  fillRR(ctx, W - 132, 22, 104, 30, 8, '#5e6ad2')
  text(ctx, '+  Nova tarefa', W - 80, 37, { size: 12, weight: 600, color: '#fff', align: 'center' })

  const groups = [
    ['Em andamento', '#f2c94c', 5],
    ['A fazer', '#8a8b91', 6],
    ['Em revisão', '#4cb782', 3]
  ]
  const titles = [
    'Refatorar a câmera para suportar keyframes', 'Adicionar mudança de foco na timeline', 'Corrigir sombra na tampa do MacBook',
    'Exportar MP4 a 60 FPS com WebCodecs', 'Melhorar a detecção automática do fundo', 'Onboarding: checklist da primeira captura',
    'Atalhos de teclado na ferramenta de corte', 'Tempo do efeito máquina de escrever', 'Seleção múltipla na biblioteca com Shift',
    'Reduzir o tempo de compilação dos shaders', 'Salvar projetos no IndexedDB', 'Curva da aberração cromática',
    'Virtualizar a grade do rolo de câmera', 'Altura do suporte do Pro Display', 'Histórico de desfazer nas cenas'
  ]
  let y = 116
  let k = 0
  groups.forEach(([g, color, count]) => {
    ctx.fillStyle = '#16171a'
    ctx.fillRect(241, y, W - 241, 40)
    ctx.beginPath()
    ctx.arc(284, y + 20, 7, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
    text(ctx, g, 302, y + 20, { size: 13, weight: 600, color: '#eeeff1' })
    text(ctx, String(count), 302 + ctx.measureText(g).width + 14, y + 20, { size: 13, color: '#6b6c72' })
    y += 40
    for (let i = 0; i < count && y < H - 20; i++, k++) {
      ctx.fillStyle = '#1b1c20'
      ctx.fillRect(241, y + 43, W - 241, 1)
      const prio = Math.floor(r() * 4)
      for (let b = 0; b < 3; b++) {
        ctx.fillStyle = b <= prio - 1 ? '#b4b5b9' : '#3a3b40'
        ctx.fillRect(272 + b * 5, y + 26 - (b + 1) * 4, 3, (b + 1) * 4)
      }
      text(ctx, `ENG-${214 + k}`, 300, y + 22, { size: 12, color: '#6b6c72' })
      ctx.beginPath()
      ctx.arc(378, y + 22, 7, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()
      text(ctx, titles[k % titles.length], 398, y + 22, { size: 13, weight: 500, color: '#dcdde0' })
      const labels = [['Recurso', '#5e6ad2'], ['Bug', '#eb5757'], ['Desemp.', '#4cb782']][k % 3]
      const lx = W - 330
      fillRR(ctx, lx, y + 11, 76, 22, 11, '#1d1e22')
      ctx.beginPath()
      ctx.arc(lx + 13, y + 22, 4, 0, Math.PI * 2)
      ctx.fillStyle = labels[1]
      ctx.fill()
      text(ctx, labels[0], lx + 24, y + 22, { size: 11, color: '#b4b5b9' })
      text(ctx, `${3 + k} set`, W - 150, y + 22, { size: 12, color: '#6b6c72' })
      ctx.beginPath()
      ctx.arc(W - 60, y + 22, 11, 0, Math.PI * 2)
      ctx.fillStyle = ['#f2994a', '#26b5ce', '#bb87fc', '#4cb782'][k % 4]
      ctx.fill()
      y += 44
    }
  })
}

function drawMobile(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#fdf2ec')
  bg.addColorStop(0.45, '#ffffff')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  text(ctx, '9:41', 44, 30, { size: 16, weight: 600 })
  fillRR(ctx, W - 72, 24, 28, 12, 3, '#111')
  text(ctx, 'Bom dia,', 24, 104, { size: 15, weight: 500, color: '#8a8984' })
  text(ctx, 'Alex', 24, 132, { size: 28, weight: 700 })
  ctx.beginPath()
  ctx.arc(W - 46, 116, 22, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd8c2'
  ctx.fill()

  fillRR(ctx, 20, 170, W - 40, 190, 24, '#111')
  const g = ctx.createRadialGradient(W - 60, 190, 10, W - 60, 190, 220)
  g.addColorStop(0, 'rgba(255,91,58,0.7)')
  g.addColorStop(1, 'rgba(255,91,58,0)')
  ctx.save()
  rr(ctx, 20, 170, W - 40, 190, 24)
  ctx.clip()
  ctx.fillStyle = g
  ctx.fillRect(20, 170, W - 40, 190)
  ctx.restore()
  text(ctx, 'Saldo total', 42, 206, { size: 13, color: '#a3a3a3' })
  text(ctx, 'R$ 24.562,80', 42, 246, { size: 34, weight: 700, color: '#fff' })
  fillRR(ctx, 42, 272, 84, 24, 12, 'rgba(255,255,255,0.12)')
  text(ctx, '+4,2% ↑', 84, 284, { size: 12, weight: 600, color: '#7ee787', align: 'center' })
  text(ctx, '•••• 4821', 42, 334, { size: 13, color: '#a3a3a3' })
  text(ctx, 'VISA', W - 42, 334, { size: 15, weight: 700, color: '#fff', align: 'right' })

  const actions = ['Enviar', 'Pedir', 'Recarregar', 'Mais']
  const aw = (W - 40) / 4
  actions.forEach((a, i) => {
    const cx = 20 + aw * i + aw / 2
    fillRR(ctx, cx - 28, 388, 56, 56, 18, i === 0 ? '#ff5b3a' : '#f2f1ed')
    text(ctx, ['↗', '↙', '+', '⋯'][i], cx, 416, { size: 22, weight: 600, color: i === 0 ? '#fff' : '#111', align: 'center' })
    text(ctx, a, cx, 462, { size: 12, weight: 500, color: '#55544f', align: 'center' })
  })

  text(ctx, 'Atividade recente', 24, 516, { size: 18, weight: 700 })
  text(ctx, 'Ver tudo', W - 24, 516, { size: 13, weight: 600, color: '#ff5b3a', align: 'right' })
  const items = [
    ['Spotify', 'Assinatura', '-R$ 9,99', '#1db954'], ['Figma', 'Ferramentas de design', '-R$ 15,00', '#a259ff'],
    ['Salário', 'Northwind Ltda.', '+R$ 4.200', '#ff5b3a'], ['Uber', 'Corrida · 12 min', '-R$ 18,40', '#111'],
    ['Blue Bottle', 'Café', '-R$ 6,50', '#2f6bff'], ['Apple', 'iCloud+', '-R$ 2,99', '#8a8984'],
    ['Airbnb', 'Lisboa · 3 noites', '-R$ 412,00', '#ff385c']
  ]
  items.forEach(([n, s, v, c], i) => {
    const y = 566 + i * 72
    if (y > H - 110) return
    fillRR(ctx, 20, y - 26, 52, 52, 16, c)
    text(ctx, n[0], 46, y, { size: 20, weight: 700, color: '#fff', align: 'center' })
    text(ctx, n, 86, y - 10, { size: 15, weight: 600 })
    text(ctx, s, 86, y + 12, { size: 12, color: '#8a8984' })
    text(ctx, v, W - 24, y, { size: 15, weight: 600, color: v.startsWith('+') ? '#139a5b' : '#111', align: 'right' })
  })

  fillRR(ctx, 16, H - 94, W - 32, 66, 24, '#111')
  ;['⌂', '▦', '◎', '☰'].forEach((ic, i) => {
    const cx = 16 + ((W - 32) / 4) * (i + 0.5)
    text(ctx, ic, cx, H - 61, { size: 22, color: i === 0 ? '#fff' : '#6b6a66', align: 'center' })
  })
  fillRR(ctx, W / 2 - 67, H - 14, 134, 5, 3, '#111')
}

const DEMOS = [
  { id: 'demo-dashboard', name: 'Demo', width: 2880, height: 1800, logical: [1440, 900], draw: drawDashboard },
  { id: 'demo-tracker', name: 'Orbit', width: 2880, height: 1800, logical: [1440, 900], draw: drawTracker },
  { id: 'demo-mobile', name: 'Carteira', width: 1179, height: 2556, logical: [393, 852], draw: drawMobile }
]

let pending = null

export function buildDemoAssets() {
  if (pending) return pending
  pending = (async () => {
    try {
      await document.fonts?.load?.('600 16px Inter')
    } catch {
      // fall back to system font
    }
    const out = []
    for (const demo of DEMOS) {
      const canvas = document.createElement('canvas')
      canvas.width = demo.width
      canvas.height = demo.height
      const ctx = canvas.getContext('2d')
      const scale = demo.width / demo.logical[0]
      ctx.scale(scale, scale)
      demo.draw(ctx, demo.logical[0], demo.logical[1])
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      out.push({
        id: demo.id,
        name: demo.name,
        kind: 'image',
        mime: 'image/png',
        width: demo.width,
        height: demo.height,
        size: blob.size,
        duration: null,
        crop: null,
        blob,
        demo: true,
        createdAt: 0,
        thumbnail: makeThumbnail(canvas, demo.width, demo.height),
        dominant: dominantColor(canvas)
      })
    }
    return out
  })()
  return pending
}

export const DEMO_ASSET_IDS = DEMOS.map((d) => d.id)
