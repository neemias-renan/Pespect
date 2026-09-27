// three.js studio: device mockup, lights, shadow wall, depth of field and lens effects.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildDevice } from './devices'
import { disposeObject } from './geometry'
import { LensShader } from './passes'
import { DofPass } from './DofPass'
import { paintBackdrop } from './backdrop'

const DEG = Math.PI / 180

export class Engine {
  constructor({ performance = false } = {}) {
    this.canvas = document.createElement('canvas')
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.VSMShadowMap
    this.renderer.setClearColor(0x000000, 0)
    this.maxTexture = this.renderer.capabilities.maxTextureSize || 4096

    this.scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.environment = this.envTexture
    this.scene.environmentIntensity = 0.95

    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200)

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a8a8a', 0.9))
    this.key = new THREE.DirectionalLight('#ffffff', 2.4)
    this.key.position.set(-2.6, 4.2, 9)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(2048, 2048)
    this.key.shadow.radius = 14
    this.key.shadow.blurSamples = 20
    this.key.shadow.bias = -0.0004
    const sc = this.key.shadow.camera
    sc.left = -7
    sc.right = 7
    sc.top = 7
    sc.bottom = -7
    sc.near = 0.5
    sc.far = 40
    this.scene.add(this.key)
    this.scene.add(this.key.target)
    const rim = new THREE.DirectionalLight('#ffffff', 0.7)
    rim.position.set(5, 2, -3)
    this.scene.add(rim)

    this.wallMaterial = new THREE.ShadowMaterial({ color: '#000000', opacity: 0.3 })
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this.wallMaterial)
    this.wall.receiveShadow = true
    this.scene.add(this.wall)

    // rig: offsets · pivot: rotation · device.group: centered model
    this.rig = new THREE.Group()
    this.pivot = new THREE.Group()
    this.rig.add(this.pivot)
    this.scene.add(this.rig)

    this.materials = {
      screen: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      reflection: new THREE.MeshPhysicalMaterial({
        color: '#000000',
        roughness: 0.1,
        metalness: 0,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        blending: THREE.AdditiveBlending,
        envMapIntensity: 0.7,
        specularIntensity: 0.6
      })
    }

    this.device = null
    this.deviceSig = ''
    this.deviceCache = new Map()
    this.textures = new Map()
    this.currentTexture = null
    this.backdropCanvas = document.createElement('canvas')
    this.backdropTexture = new THREE.CanvasTexture(this.backdropCanvas)
    this.backdropTexture.colorSpace = THREE.SRGBColorSpace
    this.backdropSig = ''
    this.transparent = false
    this.raycaster = new THREE.Raycaster()

    this.width = 1280
    this.height = 720
    this.pixelRatio = 1
    // Size the canvas up front: setSize() skips work when the size doesn't change, so without
    // this a 1280×720 output would stay on the default 300×150 canvas and come out blurry.
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(this.width, this.height, false)
    this.performance = performance
    this.buildComposer()
  }

  buildComposer() {
    if (this.composer) {
      this.composer.renderTarget1.dispose()
      this.composer.renderTarget2.dispose()
    }
    const target = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      samples: this.performance ? 0 : 4
    })
    this.composer = new EffectComposer(this.renderer, target)
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.dofPass = new DofPass(this.scene, this.camera)
    this.dofPass.exclude = [this.wall]
    this.lensPass = new ShaderPass(LensShader)
    this.outputPass = new OutputPass()
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.dofPass)
    this.composer.addPass(this.lensPass)
    this.composer.addPass(this.outputPass)
    this.composer.setPixelRatio(this.pixelRatio)
    this.composer.setSize(this.width, this.height)
  }

  setPerformance(value) {
    if (this.performance === !!value) return
    this.performance = !!value
    this.key.shadow.mapSize.set(this.performance ? 1024 : 2048, this.performance ? 1024 : 2048)
    if (this.key.shadow.map) {
      this.key.shadow.map.dispose()
      this.key.shadow.map = null
    }
    this.buildComposer()
  }

  setSize(width, height, pixelRatio = 1) {
    const w = Math.max(2, Math.round(width))
    const h = Math.max(2, Math.round(height))
    if (w === this.width && h === this.height && pixelRatio === this.pixelRatio && this.canvas.width === Math.round(w * pixelRatio)) return
    this.width = w
    this.height = h
    this.pixelRatio = pixelRatio
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(w, h, false)
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.backdropSig = ''
  }

  // ---------------------------------------------------------------- textures

  textureFor(key, element, isVideo) {
    if (isVideo && element.videoWidth && (element.width !== element.videoWidth || element.height !== element.videoHeight)) {
      element.width = element.videoWidth
      element.height = element.videoHeight
    }
    let entry = this.textures.get(key)
    if (entry && entry.element === element) return entry.texture
    if (entry) entry.texture.dispose()
    let source = element
    const w = element.naturalWidth || element.videoWidth || element.width
    const h = element.naturalHeight || element.videoHeight || element.height
    if (!isVideo && Math.max(w, h) > this.maxTexture) {
      const s = this.maxTexture / Math.max(w, h)
      const c = document.createElement('canvas')
      c.width = Math.round(w * s)
      c.height = Math.round(h * s)
      c.getContext('2d').drawImage(element, 0, 0, c.width, c.height)
      source = c
    }
    const texture = new THREE.Texture(source)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    if (isVideo) {
      texture.generateMipmaps = false
      texture.minFilter = THREE.LinearFilter
    } else {
      texture.minFilter = THREE.LinearMipmapLinearFilter
    }
    texture.needsUpdate = true
    entry = { element, texture, isVideo }
    this.textures.set(key, entry)
    return texture
  }

  releaseTexture(key) {
    const entry = this.textures.get(key)
    if (!entry) return
    entry.texture.dispose()
    this.textures.delete(key)
  }

  // Cover-fit of the (cropped) source into the screen: texture repeat + offset.
  computeFit(srcW, srcH, crop, screenAspect) {
    const c = crop || { x: 0, y: 0, w: 1, h: 1 }
    const ra = (c.w * srcW) / Math.max(1e-6, c.h * srcH)
    let uW = c.w
    let uH = c.h
    let u0 = c.x
    const vTop = c.y
    if (ra > screenAspect * 1.001) {
      uW = c.w * (screenAspect / ra)
      u0 = c.x + (c.w - uW) / 2
    } else if (ra < screenAspect * 0.999) {
      uH = c.h * (ra / screenAspect)
    }
    return { repeat: { x: uW, y: uH }, offset: { x: u0, y: 1 - vTop - uH } }
  }

  applyFit(texture, srcW, srcH, crop, screenAspect) {
    const f = this.computeFit(srcW, srcH, crop, screenAspect)
    texture.repeat.set(f.repeat.x, f.repeat.y)
    texture.offset.set(f.offset.x, f.offset.y)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
  }

  // ---------------------------------------------------------------- device

  ensureDevice(look, sourceAspect) {
    const frame = look.frame || {}
    const sig = [
      look.device,
      look.finish,
      look.device === 'frame'
        ? [sourceAspect.toFixed(3), frame.rounding, frame.padding, frame.paddingColor, frame.border, frame.borderWidth, frame.borderColor].join('|')
        : ''
    ].join('#')
    if (sig !== this.deviceSig) {
      if (this.device) this.pivot.remove(this.device.group)
      // Keep a couple of built devices around so transitions between assets don't rebuild every frame.
      let cached = this.deviceCache.get(sig)
      if (!cached) {
        cached = buildDevice(
          look.device,
          {
            aspect: sourceAspect,
            rounding: frame.rounding,
            padding: frame.padding,
            paddingColor: frame.paddingColor,
            border: frame.border,
            borderWidth: frame.borderWidth,
            borderColor: frame.borderColor,
            lid: look.lid,
            displayHeight: look.displayHeight,
            finish: look.finish
          },
          this.materials
        )
        cached.lidValue = look.lid
        cached.heightValue = look.displayHeight
        this.deviceCache.set(sig, cached)
        while (this.deviceCache.size > 3) {
          const [oldSig, old] = this.deviceCache.entries().next().value
          this.deviceCache.delete(oldSig)
          if (old !== cached) disposeObject(old.group)
        }
      } else {
        // refresh LRU order
        this.deviceCache.delete(sig)
        this.deviceCache.set(sig, cached)
      }
      this.device = cached
      this.pivot.add(this.device.group)
      this.deviceSig = sig
    }
    if (this.device.setLid && this.device.lidValue !== look.lid) {
      this.device.setLid(look.lid)
      this.device.lidValue = look.lid
    }
    if (this.device.setHeight && this.device.heightValue !== look.displayHeight) {
      this.device.setHeight(look.displayHeight)
      this.device.heightValue = look.displayHeight
    }
    return this.device
  }

  // ---------------------------------------------------------------- backdrop

  applyBackdrop(backdrop, autoColor, image, transparent) {
    this.transparent = transparent
    if (transparent) {
      this.scene.background = null
      return
    }
    const aspect = this.width / this.height
    const sig = [backdrop.type, backdrop.color, backdrop.gradient, backdrop.imageAssetId, backdrop.blur, autoColor, aspect.toFixed(3), !!image].join('|')
    if (sig !== this.backdropSig) {
      const long = backdrop.type === 'image' ? 2048 : backdrop.type === 'gradient' ? 1024 : 64
      const W = aspect >= 1 ? long : Math.round(long * aspect)
      const H = aspect >= 1 ? Math.round(long / aspect) : long
      this.backdropCanvas.width = Math.max(2, W)
      this.backdropCanvas.height = Math.max(2, H)
      paintBackdrop(this.backdropCanvas.getContext('2d'), W, H, backdrop, { autoColor, image })
      this.backdropTexture.dispose()
      this.backdropTexture = new THREE.CanvasTexture(this.backdropCanvas)
      this.backdropTexture.colorSpace = THREE.SRGBColorSpace
      this.backdropSig = sig
    }
    this.scene.background = this.backdropTexture
  }

  // ---------------------------------------------------------------- camera

  // Distance at which the device's bounding sphere fits the frame, whatever its rotation.
  fitDistance(fit, vfov, aspect) {
    const tv = Math.tan((vfov * DEG) / 2)
    const th = tv * aspect
    const radius = Math.sqrt(fit.w ** 2 + fit.h ** 2 + fit.d ** 2) / 2
    // Weight toward the flat footprint so thin screens don't end up tiny.
    const flat = Math.max(fit.h / 2 / tv, fit.w / 2 / th) * 1.22
    const sphere = (radius / Math.min(tv, th)) * 0.9
    return Math.max(flat, sphere * 0.85 + flat * 0.15)
  }

  // ---------------------------------------------------------------- frame

  /**
   * state: { look, shot, element, isVideo, asset, backdropImage, autoColor, transparent, time }
   */
  renderState(state) {
    const { look, shot } = state
    const asset = state.asset
    const srcW = asset?.crop ? asset.width * asset.crop.w : asset?.width || 1600
    const srcH = asset?.crop ? asset.height * asset.crop.h : asset?.height || 1000
    const sourceAspect = srcW / srcH
    const device = this.ensureDevice(look, sourceAspect)

    // Screen texture
    const screenMat = this.materials.screen
    if (state.element) {
      const tex = this.textureFor(asset?.id || 'screen', state.element, state.isVideo)
      // Only upload video frames once the element actually has one (avoids a 0×0 allocation).
      if (state.isVideo && state.element.readyState >= 2) tex.needsUpdate = true
      this.applyFit(tex, asset?.width || srcW, asset?.height || srcH, asset?.crop, device.screenAspect)
      if (screenMat.map !== tex) {
        screenMat.map = tex
        screenMat.needsUpdate = true
      }
      screenMat.color.setScalar(1)
    } else {
      if (screenMat.map) {
        screenMat.map = null
        screenMat.needsUpdate = true
      }
      screenMat.color.set('#101012')
    }
    const brightness = (look.brightness ?? 100) / 100
    screenMat.color.multiplyScalar(brightness)
    device.reflections.forEach((r) => {
      r.visible = look.reflections !== false
    })

    // Backdrop & shadow
    this.applyBackdrop(look.backdrop || { type: 'auto' }, state.autoColor, state.backdropImage, state.transparent)
    this.wallMaterial.opacity = ((look.shadow ?? 55) / 100) * 0.6
    this.wall.visible = (look.shadow ?? 55) > 0

    // Camera & rig
    const lens = look.lens || {}
    const focal = lens.focal || 50
    const vfov = 2 * Math.atan(12 / focal) / DEG
    this.camera.fov = vfov
    this.camera.aspect = this.width / this.height
    const zoom = Math.max(0.05, shot.zoom || 1)
    const baseDist = this.fitDistance(device.fit, vfov, this.camera.aspect)
    const dist = baseDist / zoom
    this.camera.position.set(0, 0, dist)
    this.camera.near = Math.max(0.05, dist * 0.02)
    this.camera.far = dist + 60
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()
    // The camera is not part of the scene graph: refresh its matrices now so focus picking
    // and depth-of-field use this frame's camera, not the previous one.
    this.camera.updateMatrixWorld(true)

    const unit = Math.max(device.fit.w, device.fit.h)
    this.rig.position.set((shot.offsetX || 0) * unit, (shot.offsetY || 0) * unit, 0)
    // Positive X orbits the camera up (looks down on the device).
    this.pivot.rotation.set((shot.rotateX || 0) * DEG, (shot.rotateY || 0) * DEG, (shot.rotateZ || 0) * DEG, 'XYZ')

    // Shadow wall behind the device; the key light and its shadow volume travel with the device
    // so the drop shadow keeps the same shape and never gets clipped when the frame moves.
    const radius = Math.sqrt(device.fit.w ** 2 + device.fit.h ** 2 + device.fit.d ** 2) / 2
    const wallZ = -(radius + 0.35)
    const rp = this.rig.position
    this.wall.position.set(rp.x, rp.y, wallZ)
    const k = radius / 1.8
    this.key.position.set(rp.x - 2.6 * k, rp.y + 4.2 * k, 9 * k)
    this.key.target.position.set(rp.x, rp.y, wallZ)
    const sc = this.key.shadow.camera
    const extent = radius * 2.4
    if (Math.abs(sc.right - extent) > 1e-3) {
      sc.left = -extent
      sc.right = extent
      sc.top = extent
      sc.bottom = -extent
      sc.near = 0.1
      sc.far = 12 * k + radius * 4
      sc.updateProjectionMatrix()
    }
    this.key.shadow.radius = 10 + 8 * ((look.shadowSoftness ?? 50) / 100)
    this.scene.updateMatrixWorld(true)

    // Depth of field
    const blur = Math.max(0, Math.min(100, shot.blur ?? 0)) / 100
    const useDof = blur > 0.01 && !state.transparent
    this.dofPass.enabled = useDof
    if (useDof) {
      const u = this.dofPass.uniforms
      u.focus.value = this.focusDepth(shot.focusPoint)
      // Everything within a thin slab around the focus stays crisp; blur ramps to full half a device away.
      // Sharp zone and falloff are relative to the focus distance, like a real lens.
      u.focusRange.value = u.focus.value * 0.03
      u.cocScale.value = 1 / (u.focus.value * 0.14)
      u.maxBlur.value = Math.pow(blur, 0.85) * 0.055 * this.height * this.pixelRatio
    }

    // Lens look
    const lu = this.lensPass.uniforms
    lu.exposure.value = Math.pow(2, lens.exposure || 0)
    lu.chromatic.value = (lens.chromatic ?? 0) / 100
    lu.vignette.value = (lens.vignette ?? 8) / 100
    lu.grain.value = (lens.grain ?? 0) / 100
    lu.time.value = state.time || 0
    lu.resolution.value = [this.width * this.pixelRatio, this.height * this.pixelRatio]

    this.renderer.setClearColor(0x000000, 0)
    this.composer.render()
    return this.canvas
  }

  /**
   * Camera offset + zoom that center an area of the source image (normalized, top-left origin)
   * on screen for a given rotation, filling `fill` of the frame.
   */
  frameArea(look, asset, area, rotation, aspect, fill = 0.62) {
    const srcW = asset?.crop ? asset.width * asset.crop.w : asset?.width || 1600
    const srcH = asset?.crop ? asset.height * asset.crop.h : asset?.height || 1000
    const device = this.ensureDevice(look, srcW / srcH)
    const fit = this.computeFit(asset?.width || srcW, asset?.height || srcH, asset?.crop, device.screenAspect)
    const { w: sw, h: sh } = device.screenSize

    const savedPos = this.rig.position.clone()
    const savedRot = this.pivot.rotation.clone()
    this.rig.position.set(0, 0, 0)
    this.pivot.rotation.set(0, 0, 0)
    this.scene.updateMatrixWorld(true)

    const euler = new THREE.Euler((rotation.rotateX || 0) * DEG, (rotation.rotateY || 0) * DEG, (rotation.rotateZ || 0) * DEG, 'XYZ')
    const toWorld = (u, v) => {
      const gx = (u - fit.offset.x) / fit.repeat.x
      const gy = (1 - v - fit.offset.y) / fit.repeat.y
      const p = new THREE.Vector3((gx - 0.5) * sw, (gy - 0.5) * sh, 0)
      return device.focusTarget.localToWorld(p).applyEuler(euler)
    }
    const corners = [
      toWorld(area.x, area.y),
      toWorld(area.x + area.w, area.y),
      toWorld(area.x, area.y + area.h),
      toWorld(area.x + area.w, area.y + area.h)
    ]
    this.rig.position.copy(savedPos)
    this.pivot.rotation.copy(savedRot)
    this.scene.updateMatrixWorld(true)

    const center = corners.reduce((acc, c) => acc.add(c), new THREE.Vector3()).multiplyScalar(0.25)
    const xs = corners.map((c) => c.x)
    const ys = corners.map((c) => c.y)
    const extW = Math.max(0.02, Math.max(...xs) - Math.min(...xs))
    const extH = Math.max(0.02, Math.max(...ys) - Math.min(...ys))

    const focal = look.lens?.focal || 50
    const vfov = (2 * Math.atan(12 / focal)) / DEG
    const t = Math.tan((vfov * DEG) / 2)
    const baseDist = this.fitDistance(device.fit, vfov, aspect)
    const unit = Math.max(device.fit.w, device.fit.h)
    const need = Math.max(extH / (2 * t * fill), extW / (2 * t * aspect * fill))
    const camDist = Math.max(0.2, need + center.z)
    return {
      offsetX: -center.x / unit,
      offsetY: -center.y / unit,
      zoom: baseDist / camDist
    }
  }

  // Camera-space depth of the point to keep sharp.
  focusDepth(focusPoint) {
    const v = new THREE.Vector3()
    if (focusPoint) {
      const hit = this.pick(focusPoint.x, focusPoint.y)
      if (hit) v.copy(hit.point)
      else this.device.focusTarget.getWorldPosition(v)
    } else {
      this.device.focusTarget.getWorldPosition(v)
    }
    v.applyMatrix4(this.camera.matrixWorldInverse)
    return Math.max(0.1, -v.z)
  }

  pick(nx, ny) {
    if (!this.device) return null
    this.raycaster.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), this.camera)
    const hits = this.raycaster.intersectObject(this.device.group, true).filter((h) => h.object.name !== 'Reflection')
    return hits[0] || null
  }

  // World units the rig moves per output pixel (used for drag-to-pan).
  unitsPerPixel() {
    if (!this.device) return 0.001
    const dist = this.camera.position.z
    const visibleH = 2 * Math.tan((this.camera.fov * DEG) / 2) * dist
    const unit = Math.max(this.device.fit.w, this.device.fit.h)
    return visibleH / this.height / unit
  }

  dispose() {
    this.textures.forEach((e) => e.texture.dispose())
    this.textures.clear()
    this.deviceCache.forEach((d) => disposeObject(d.group))
    this.deviceCache.clear()
    this.backdropTexture.dispose()
    this.envTexture.dispose()
    this.composer.renderTarget1.dispose()
    this.composer.renderTarget2.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss?.()
  }
}
