// Procedural device mockups. Every builder returns a centered group plus the meshes that show the screen.
import * as THREE from 'three'
import { DEVICE_SCREEN_ASPECT } from '../defaults'
import { roundedPlane, roundedRing, roundedSlab } from './geometry'

const FINISHES = {
  silver: { body: '#c8cbd0', dark: '#9ea2a8', keys: '#1a1a1c', well: '#b7bac0', trackpad: '#bfc2c7' },
  dark: { body: '#2e3033', dark: '#1d1e20', keys: '#0b0b0c', well: '#27292b', trackpad: '#35373a' }
}

function metal(color, roughness = 0.38, metalness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 1 })
}

function glass(color = '#050506') {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.2, envMapIntensity: 0.9 })
}

function shared(mesh) {
  mesh.userData.sharedMaterial = true
  return mesh
}

function addScreen(parent, geometry, materials, z) {
  const screen = shared(new THREE.Mesh(geometry, materials.screen))
  screen.position.z = z
  screen.name = 'Screen'
  parent.add(screen)
  const reflection = shared(new THREE.Mesh(geometry, materials.reflection))
  reflection.position.z = z + 0.0008
  reflection.name = 'Reflection'
  reflection.renderOrder = 2
  parent.add(reflection)
  return { screen, reflection }
}

function castAll(root) {
  root.traverse((o) => {
    if (o.isMesh && o.name !== 'Screen' && o.name !== 'Reflection') {
      o.castShadow = true
    }
  })
}

// ---------------------------------------------------------------- Frame

function buildFrame(opts, materials) {
  const aspect = Math.max(0.1, opts.aspect || 16 / 10)
  const S = 3
  const w = aspect >= 1 ? S : S * aspect
  const h = aspect >= 1 ? S / aspect : S
  const m = Math.min(w, h)
  const radius = (opts.rounding ?? 0.045) * m
  const pad = ((opts.padding ?? 0) / 100) * 0.22 * m

  const group = new THREE.Group()
  let outerW = w
  let outerH = h
  let outerR = radius

  if (pad > 0) {
    outerW = w + pad * 2
    outerH = h + pad * 2
    outerR = radius + pad * 0.7
    const card = new THREE.Mesh(
      roundedPlane(outerW, outerH, outerR, 20),
      new THREE.MeshStandardMaterial({ color: opts.paddingColor || '#ffffff', roughness: 0.55, metalness: 0 })
    )
    card.position.z = -0.0005
    group.add(card)
  }

  if (opts.border) {
    const bw = (opts.borderWidth ?? 0.012) * m
    const ring = new THREE.Mesh(
      roundedRing(outerW + bw * 2, outerH + bw * 2, outerR + bw, outerW, outerH, outerR, 20),
      new THREE.MeshStandardMaterial({ color: opts.borderColor || '#ffffff', roughness: 0.4, metalness: 0.1 })
    )
    ring.position.z = -0.0003
    group.add(ring)
    outerW += bw * 2
    outerH += bw * 2
    outerR += bw
  }

  const body = new THREE.Mesh(
    roundedSlab(outerW, outerH, outerR, 0.04, 0.008),
    new THREE.MeshStandardMaterial({ color: pad > 0 ? opts.paddingColor || '#ffffff' : '#111114', roughness: 0.5, metalness: 0.1 })
  )
  body.position.z = -0.002
  group.add(body)

  const { screen, reflection } = addScreen(group, roundedPlane(w, h, radius, 20), materials, 0.0012)
  castAll(group)

  return {
    group,
    screens: [screen],
    reflections: [reflection],
    focusTarget: screen,
    screenAspect: aspect,
    screenSize: { w, h },
    fit: { w: outerW, h: outerH, d: 0.05 }
  }
}

// ---------------------------------------------------------------- MacBook

function buildMacBook(opts, materials) {
  const f = FINISHES[opts.finish] || FINISHES.silver
  const W = 3.2
  const D = 2.24
  const baseT = 0.075
  const lidT = 0.036
  const Hl = D * 0.985

  const root = new THREE.Group()
  const inner = new THREE.Group()
  root.add(inner)

  const bodyMat = metal(f.body)

  // Base: slab rotated so its thickness runs along +Y.
  const base = new THREE.Mesh(roundedSlab(W, D, 0.16, baseT, 0.022), bodyMat)
  // rotateX(-90°) maps the slab's z∈[-depth,0] onto y∈[-depth,0]; lift it onto the floor.
  base.geometry.rotateX(-Math.PI / 2)
  base.geometry.translate(0, baseT, 0)
  inner.add(base)

  const top = baseT + 0.0006
  const wellW = W * 0.86
  const wellD = D * 0.42
  const well = new THREE.Mesh(roundedPlane(wellW, wellD, 0.05), new THREE.MeshStandardMaterial({ color: f.well, roughness: 0.55, metalness: 0.5 }))
  well.rotation.x = -Math.PI / 2
  well.position.set(0, top, -D * 0.14)
  inner.add(well)

  const cols = 14
  const rows = 6
  const gap = 0.012
  const kw = (wellW - 0.06 - gap * (cols - 1)) / cols
  const kd = (wellD - 0.06 - gap * (rows - 1)) / rows
  const keys = new THREE.InstancedMesh(
    new THREE.BoxGeometry(kw, 0.008, kd),
    new THREE.MeshStandardMaterial({ color: f.keys, roughness: 0.7, metalness: 0.1 }),
    cols * rows
  )
  const m4 = new THREE.Matrix4()
  let n = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -wellW / 2 + 0.03 + kw / 2 + c * (kw + gap)
      const z = -D * 0.14 - wellD / 2 + 0.03 + kd / 2 + r * (kd + gap)
      m4.makeTranslation(x, top + 0.004, z)
      keys.setMatrixAt(n++, m4)
    }
  }
  inner.add(keys)

  const pad = new THREE.Mesh(roundedPlane(W * 0.38, D * 0.27, 0.05), new THREE.MeshStandardMaterial({ color: f.trackpad, roughness: 0.28, metalness: 0.6 }))
  pad.rotation.x = -Math.PI / 2
  pad.position.set(0, top + 0.0004, D * 0.27)
  inner.add(pad)

  // Lid, hinged on the back edge of the base.
  const lidPivot = new THREE.Group()
  lidPivot.position.set(0, baseT, -D / 2 + 0.03)
  inner.add(lidPivot)

  const lidBody = new THREE.Mesh(roundedSlab(W, Hl, 0.16, lidT, 0.014), bodyMat)
  lidBody.geometry.translate(0, Hl / 2, 0)
  lidPivot.add(lidBody)

  const bezel = new THREE.Mesh(roundedPlane(W - 0.03, Hl - 0.03, 0.15), glass())
  bezel.position.set(0, Hl / 2, 0.0008)
  lidPivot.add(bezel)

  const aspect = DEVICE_SCREEN_ASPECT.desktop
  const Sw = W - 0.18
  const Sh = Sw / aspect
  const screenHolder = new THREE.Group()
  screenHolder.position.set(0, Hl - 0.085 - Sh / 2, 0)
  lidPivot.add(screenHolder)
  const { screen, reflection } = addScreen(screenHolder, roundedPlane(Sw, Sh, 0.035), materials, 0.0018)

  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.012, 20), new THREE.MeshStandardMaterial({ color: '#1b2233', roughness: 0.1 }))
  cam.position.set(0, Hl - 0.045, 0.0016)
  lidPivot.add(cam)

  castAll(root)

  const box = new THREE.Box3()
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  const fit = { w: W, h: 2, d: D }

  function setLid(value) {
    const angle = 10 + (Math.max(0, Math.min(100, value ?? 75)) / 100) * 125
    lidPivot.rotation.x = THREE.MathUtils.degToRad(90 - angle)
    inner.position.set(0, 0, 0)
    root.updateMatrixWorld(true)
    box.setFromObject(inner)
    box.getSize(size)
    box.getCenter(center)
    inner.position.copy(center).multiplyScalar(-1)
    fit.w = size.x
    fit.h = size.y
    fit.d = size.z
  }
  setLid(opts.lid)

  return {
    group: root,
    screens: [screen],
    reflections: [reflection],
    focusTarget: screen,
    screenAspect: aspect,
    screenSize: { w: Sw, h: Sh },
    fit,
    setLid
  }
}

// ---------------------------------------------------------------- iPhone

function buildIPhone(opts, materials) {
  const dark = opts.finish === 'dark'
  const Hb = 1.6
  const Wb = 0.78
  const T = 0.085
  const R = 0.125

  const group = new THREE.Group()
  const frameMat = metal(dark ? '#3a3b3f' : '#b9b3a9', 0.3, 0.95)
  const backMat = new THREE.MeshStandardMaterial({ color: dark ? '#2b2c30' : '#d7d2c8', roughness: 0.45, metalness: 0.15 })

  const body = new THREE.Mesh(roundedSlab(Wb, Hb, R, T, 0.03, 40), [backMat, frameMat])
  body.position.z = T / 2
  group.add(body)

  const front = new THREE.Mesh(roundedPlane(Wb - 0.012, Hb - 0.012, R - 0.006, 24), glass('#030304'))
  front.position.z = T / 2 + 0.0006
  group.add(front)

  const aspect = DEVICE_SCREEN_ASPECT.mobile
  const Sh = Hb - 0.062
  const Sw = Sh * aspect
  const { screen, reflection } = addScreen(group, roundedPlane(Sw, Sh, 0.1, 24), materials, T / 2 + 0.0012)

  const island = new THREE.Mesh(roundedPlane(0.2, 0.058, 0.029), new THREE.MeshBasicMaterial({ color: '#000000' }))
  island.position.set(0, Sh / 2 - 0.058, T / 2 + 0.0026)
  group.add(island)

  const btnMat = frameMat
  const addBtn = (x, y, h) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, h, 0.028), btnMat)
    b.position.set(x, y, 0)
    group.add(b)
  }
  addBtn(Wb / 2 + 0.004, 0.28, 0.2)
  addBtn(-Wb / 2 - 0.004, 0.42, 0.07)
  addBtn(-Wb / 2 - 0.004, 0.26, 0.13)
  addBtn(-Wb / 2 - 0.004, 0.09, 0.13)

  // Camera plateau on the back.
  const camX = Wb / 2 - 0.22
  const bump = new THREE.Mesh(roundedSlab(0.34, 0.34, 0.085, 0.014, 0.005), backMat)
  bump.position.set(camX, Hb / 2 - 0.22, -T / 2)
  group.add(bump)
  const lensMat = new THREE.MeshStandardMaterial({ color: '#0a0b10', roughness: 0.05, metalness: 0.6 })
  const ringMat = metal(dark ? '#4a4b50' : '#c9c3b8', 0.25, 1)
  ;[[-0.07, 0.07], [-0.07, -0.07], [0.075, 0]].forEach(([dx, dy]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.02, 32), ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.set(camX + dx, Hb / 2 - 0.22 + dy, -T / 2 - 0.02)
    group.add(ring)
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 32), lensMat)
    lens.rotation.y = Math.PI
    lens.position.set(ring.position.x, ring.position.y, -T / 2 - 0.0305)
    group.add(lens)
  })

  castAll(group)
  return {
    group,
    screens: [screen],
    reflections: [reflection],
    focusTarget: screen,
    screenAspect: aspect,
    screenSize: { w: Sw, h: Sh },
    fit: { w: Wb, h: Hb, d: T }
  }
}

// ---------------------------------------------------------------- Pro Display XDR

function buildDisplay(opts, materials) {
  const f = FINISHES[opts.finish] || FINISHES.silver
  const Dw = 3.2
  const Dh = 1.86
  const T = 0.085

  const root = new THREE.Group()
  const inner = new THREE.Group()
  root.add(inner)
  const bodyMat = metal(f.body, 0.36)

  const display = new THREE.Group()
  inner.add(display)
  const housing = new THREE.Mesh(roundedSlab(Dw, Dh, 0.035, T, 0.012), bodyMat)
  housing.geometry.translate(0, 0, T / 2)
  display.add(housing)

  // Lattice-like back: a grid of small dimples.
  const dimples = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.03, 12),
    new THREE.MeshStandardMaterial({ color: f.dark, roughness: 0.6, metalness: 0.7 }),
    28 * 16
  )
  const m4 = new THREE.Matrix4()
  const flip = new THREE.Matrix4().makeRotationY(Math.PI)
  let n = 0
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 28; c++) {
      const x = -Dw / 2 + 0.16 + c * ((Dw - 0.32) / 27) + (r % 2 ? 0.05 : 0)
      const y = -Dh / 2 + 0.16 + r * ((Dh - 0.32) / 15)
      m4.makeTranslation(x, y, -T / 2 - 0.0008).multiply(flip)
      dimples.setMatrixAt(n++, m4)
    }
  }
  display.add(dimples)

  const bezel = new THREE.Mesh(roundedPlane(Dw - 0.012, Dh - 0.012, 0.03), glass())
  bezel.position.z = T / 2 + 0.0006
  display.add(bezel)

  const aspect = DEVICE_SCREEN_ASPECT.display
  const Sw = Dw - 0.12
  const Sh = Sw / aspect
  const { screen, reflection } = addScreen(display, roundedPlane(Sw, Sh, 0.008), materials, T / 2 + 0.0014)

  // Stand: the foot stays on the floor while the display slides along the arm.
  const stand = new THREE.Group()
  inner.add(stand)
  const ARM_H = 1.55
  const tilt = THREE.MathUtils.degToRad(7)
  const baseZ = -T / 2 - 0.22
  const arm = new THREE.Mesh(roundedSlab(0.5, ARM_H, 0.06, 0.06, 0.012), bodyMat)
  arm.geometry.translate(0, ARM_H / 2, 0)
  arm.position.set(0, 0.02, baseZ)
  arm.rotation.x = tilt
  stand.add(arm)
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.56, 24), bodyMat)
  hinge.rotation.z = Math.PI / 2
  stand.add(hinge)
  const foot = new THREE.Mesh(roundedSlab(1.0, 0.95, 0.12, 0.03, 0.01), bodyMat)
  foot.geometry.rotateX(-Math.PI / 2)
  foot.geometry.translate(0, 0.03, 0)
  foot.position.set(0, 0, baseZ + 0.1)
  stand.add(foot)

  castAll(root)

  const fit = { w: Dw, h: Dh, d: T }
  function setHeight(value) {
    const h = Math.max(0, Math.min(100, value ?? 50)) / 100
    const cy = 1.2 + h * 0.5
    const armLen = cy - 0.22
    stand.position.set(0, -cy, 0)
    arm.scale.y = armLen / ARM_H
    hinge.position.set(0, 0.02 + armLen * Math.cos(tilt), baseZ + armLen * Math.sin(tilt))
  }
  setHeight(opts.displayHeight)

  return {
    group: root,
    screens: [screen],
    reflections: [reflection],
    focusTarget: screen,
    screenAspect: aspect,
    screenSize: { w: Sw, h: Sh },
    fit,
    setHeight
  }
}

export function buildDevice(mode, opts, materials) {
  switch (mode) {
    case 'desktop':
      return buildMacBook(opts, materials)
    case 'mobile':
      return buildIPhone(opts, materials)
    case 'display':
      return buildDisplay(opts, materials)
    default:
      return buildFrame(opts, materials)
  }
}
