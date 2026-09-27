// Final lens look: exposure, chromatic aberration, vignette and film grain (runs in linear space).
export const LensShader = {
  name: 'LensShader',
  uniforms: {
    tDiffuse: { value: null },
    exposure: { value: 1 },
    chromatic: { value: 0.05 },
    vignette: { value: 0.08 },
    grain: { value: 0 },
    time: { value: 0 },
    resolution: { value: [1920, 1080] }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float exposure;
    uniform float chromatic;
    uniform float vignette;
    uniform float grain;
    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 dir = vUv - 0.5;
      float d = length(dir);
      vec2 off = dir * d * chromatic * 0.015;
      vec4 base = texture2D(tDiffuse, vUv);
      vec4 rs = texture2D(tDiffuse, vUv + off);
      vec4 bs = texture2D(tDiffuse, vUv - off);
      vec3 col = vec3(rs.r, base.g, bs.b) * exposure;
      float alpha = max(base.a, max(rs.a, bs.a));
      float vig = smoothstep(0.95, 0.25, d * 1.25);
      col *= mix(1.0, vig, clamp(vignette, 0.0, 1.0));
      if (grain > 0.0) {
        float n = hash(vUv * resolution + fract(time) * 100.0) - 0.5;
        col += n * grain * 0.06;
      }
      gl_FragColor = vec4(max(col, 0.0), alpha);
    }
  `
}
