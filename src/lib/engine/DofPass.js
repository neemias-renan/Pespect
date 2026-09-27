// Depth of field: two pre-blurred levels (half resolution, separable gaussian) blended with the
// sharp frame according to each pixel's distance from the focus plane. Smooth and artifact-free.
import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const blurShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform vec2 direction;
  uniform vec2 texel;
  uniform float radius;
  void main() {
    vec4 sum = texture2D(tColor, vUv);
    float wsum = 1.0;
    for (int i = 1; i <= 12; i++) {
      float t = float(i) / 12.0;
      float w = exp(-t * t * 3.0);
      vec2 off = direction * texel * (t * radius);
      sum += (texture2D(tColor, vUv + off) + texture2D(tColor, vUv - off)) * w;
      wsum += 2.0 * w;
    }
    gl_FragColor = sum / wsum;
  }
`

const compositeShader = /* glsl */ `
  #include <packing>
  varying vec2 vUv;
  uniform sampler2D tSharp;
  uniform sampler2D tSmall;
  uniform sampler2D tLarge;
  uniform sampler2D tDepth;
  uniform vec2 texel;
  uniform float spread;
  uniform float focus;
  uniform float focusRange;
  uniform float cocScale;
  uniform float nearClip;
  uniform float farClip;

  // Blur amount (0..1) for a geometry pixel, or -1 where nothing was drawn (backdrop / shadow wall).
  float cocAt(vec2 uv) {
    float d = unpackRGBAToDepth(texture2D(tDepth, uv));
    if (d >= 0.99999) return -1.0;
    float dist = abs(-perspectiveDepthToViewZ(d, nearClip, farClip) - focus);
    float c = clamp((dist - focusRange) * cocScale, 0.0, 1.0);
    return c * c * (3.0 - 2.0 * c);
  }

  void main() {
    float c0 = cocAt(vUv);
    float coc;
    if (c0 >= 0.0) {
      // Average with neighbours so the blur amount doesn't stair-step along silhouettes.
      float sum = c0;
      float n = 1.0;
      for (int i = 0; i < 4; i++) {
        vec2 dir = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
        float c = cocAt(vUv + dir * texel * 1.5);
        if (c >= 0.0) {
          sum += c;
          n += 1.0;
        }
      }
      coc = sum / n;
    } else {
      // Backdrop: only out-of-focus geometry nearby spreads over it, so sharp edges get no halo.
      float inner = 0.0;
      float outer = 0.0;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982;
        vec2 dir = vec2(cos(a), sin(a)) * texel;
        inner = max(inner, cocAt(vUv + dir * spread * 0.45));
        outer = max(outer, cocAt(vUv + dir * spread));
      }
      coc = max(inner, outer * 0.55) * 0.9;
    }
    vec4 sharp = texture2D(tSharp, vUv);
    vec4 small = texture2D(tSmall, vUv);
    vec4 large = texture2D(tLarge, vUv);
    gl_FragColor = coc < 0.5 ? mix(sharp, small, coc * 2.0) : mix(small, large, coc * 2.0 - 1.0);
  }
`

function halfTarget() {
  return new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
}

export class DofPass extends Pass {
  constructor(scene, camera) {
    super()
    this.scene = scene
    this.camera = camera
    this.needsSwap = true

    this.depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, blending: THREE.NoBlending })
    this.depthTarget = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
    this.tmp = halfTarget()
    this.small = halfTarget()
    this.large = halfTarget()

    this.blurUniforms = {
      tColor: { value: null },
      direction: { value: new THREE.Vector2(1, 0) },
      texel: { value: new THREE.Vector2(1, 1) },
      radius: { value: 4 }
    }
    this.blurMaterial = new THREE.ShaderMaterial({ uniforms: this.blurUniforms, vertexShader, fragmentShader: blurShader, depthTest: false, depthWrite: false })

    // Public tuning uniforms (Engine writes focus / focusRange / cocScale / maxBlur).
    this.uniforms = {
      tSharp: { value: null },
      tSmall: { value: this.small.texture },
      tLarge: { value: this.large.texture },
      tDepth: { value: this.depthTarget.texture },
      texel: { value: new THREE.Vector2(1, 1) },
      spread: { value: 8 },
      focus: { value: 8 },
      focusRange: { value: 0.1 },
      cocScale: { value: 1 },
      maxBlur: { value: 10 },
      nearClip: { value: camera.near },
      farClip: { value: camera.far }
    }
    this.compositeMaterial = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader: compositeShader, depthTest: false, depthWrite: false })
    this.quad = new FullScreenQuad(this.blurMaterial)
    this._clearColor = new THREE.Color()
    // Objects left out of the depth pass (the shadow wall): they read as "backdrop".
    this.exclude = []
  }

  setSize(width, height) {
    this.depthTarget.setSize(width, height)
    this.uniforms.texel.value.set(1 / width, 1 / height)
    const hw = Math.max(1, Math.round(width / 2))
    const hh = Math.max(1, Math.round(height / 2))
    this.tmp.setSize(hw, hh)
    this.small.setSize(hw, hh)
    this.large.setSize(hw, hh)
    this.blurUniforms.texel.value.set(1 / hw, 1 / hh)
  }

  blur(renderer, source, target, radius) {
    const u = this.blurUniforms
    this.quad.material = this.blurMaterial
    u.radius.value = radius
    u.tColor.value = source
    u.direction.value.set(1, 0)
    renderer.setRenderTarget(this.tmp)
    this.quad.render(renderer)
    u.tColor.value = this.tmp.texture
    u.direction.value.set(0, 1)
    renderer.setRenderTarget(target)
    this.quad.render(renderer)
  }

  render(renderer, writeBuffer, readBuffer) {
    const oldBackground = this.scene.background
    const oldOverride = this.scene.overrideMaterial
    renderer.getClearColor(this._clearColor)
    const oldAlpha = renderer.getClearAlpha()
    const oldAutoClear = renderer.autoClear
    renderer.autoClear = false

    // Depth
    this.scene.background = null
    this.scene.overrideMaterial = this.depthMaterial
    const hidden = this.exclude.filter((o) => o.visible)
    hidden.forEach((o) => (o.visible = false))
    renderer.setClearColor(0xffffff, 1)
    renderer.setRenderTarget(this.depthTarget)
    renderer.clear()
    renderer.render(this.scene, this.camera)
    hidden.forEach((o) => (o.visible = true))
    this.scene.overrideMaterial = oldOverride
    this.scene.background = oldBackground
    renderer.setClearColor(this._clearColor, oldAlpha)

    // Blur levels (radii are in half-resolution pixels).
    const max = Math.max(0.5, this.uniforms.maxBlur.value / 2)
    this.blur(renderer, readBuffer.texture, this.small, max * 0.4)
    this.blur(renderer, this.small.texture, this.large, max * 0.9)

    // Composite
    this.uniforms.spread.value = Math.max(1, this.uniforms.maxBlur.value * 0.9)
    this.uniforms.tSharp.value = readBuffer.texture
    this.uniforms.nearClip.value = this.camera.near
    this.uniforms.farClip.value = this.camera.far
    this.quad.material = this.compositeMaterial
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)
    renderer.autoClear = oldAutoClear
  }

  dispose() {
    this.depthTarget.dispose()
    this.tmp.dispose()
    this.small.dispose()
    this.large.dispose()
    this.depthMaterial.dispose()
    this.blurMaterial.dispose()
    this.compositeMaterial.dispose()
    this.quad.dispose()
  }
}
