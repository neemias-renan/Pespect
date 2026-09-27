import * as THREE from 'three'

export function roundedRectPath(target, w, h, r, cx = 0, cy = 0) {
  const x = cx - w / 2
  const y = cy - h / 2
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  if (rad <= 1e-5) {
    target.moveTo(x, y)
    target.lineTo(x + w, y)
    target.lineTo(x + w, y + h)
    target.lineTo(x, y + h)
    target.lineTo(x, y)
    return target
  }
  target.moveTo(x + rad, y)
  target.lineTo(x + w - rad, y)
  target.absarc(x + w - rad, y + rad, rad, -Math.PI / 2, 0, false)
  target.lineTo(x + w, y + h - rad)
  target.absarc(x + w - rad, y + h - rad, rad, 0, Math.PI / 2, false)
  target.lineTo(x + rad, y + h)
  target.absarc(x + rad, y + h - rad, rad, Math.PI / 2, Math.PI, false)
  target.lineTo(x, y + rad)
  target.absarc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5, false)
  return target
}

export function roundedRectShape(w, h, r, cx = 0, cy = 0) {
  return roundedRectPath(new THREE.Shape(), w, h, r, cx, cy)
}

// Flat rounded rectangle whose UVs span 0..1 across its bounds (so textures fill it).
export function roundedPlane(w, h, r, segments = 16) {
  const geometry = new THREE.ShapeGeometry(roundedRectShape(w, h, r), segments)
  const pos = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h)
  }
  uv.needsUpdate = true
  return geometry
}

export function roundedRing(outerW, outerH, outerR, innerW, innerH, innerR, segments = 16) {
  const shape = roundedRectShape(outerW, outerH, outerR)
  shape.holes.push(roundedRectPath(new THREE.Path(), innerW, innerH, innerR))
  return new THREE.ShapeGeometry(shape, segments)
}

// Extruded rounded slab, centered in XY, spanning z ∈ [-depth, 0] (front face at z = 0).
export function roundedSlab(w, h, r, depth, bevel = 0.01, curveSegments = 24) {
  const b = Math.min(bevel, depth / 2 - 1e-4, w / 4, h / 4)
  const shape = roundedRectShape(w - 2 * b, h - 2 * b, Math.max(0, r - b))
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - 2 * b),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 4,
    curveSegments
  })
  geometry.translate(0, 0, -(depth - b))
  geometry.computeVertexNormals()
  return geometry
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material && !obj.userData.sharedMaterial) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => m.dispose())
    }
  })
}
