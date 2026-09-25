/**
 * The hero's light beams — a WebGL2 port of the "Ethereal Beams" background
 * (three.js + react-three-fiber). Same geometry (a row of planes, each pushed
 * along its length by the same Perlin noise), lit the way three lit it: one
 * directional light, a black surface with 0.3 roughness / 0.3 metalness, so
 * only the GGX highlight shows — then ACES tone mapping, sRGB output and the
 * original's grain. It draws the same picture as the original for a few KB
 * instead of ~200 KB of three.js, and only while it is on screen.
 *
 * Framework-free on purpose: `HeroBeams.tsx` owns the React side.
 */

export interface BeamsOptions {
  beamWidth: number;
  beamHeight: number;
  beamNumber: number;
  /** Drift speed of the noise along the beams. */
  speed: number;
  /** Strength of the grain. */
  noiseIntensity: number;
  /** Noise frequency. */
  scale: number;
  /** Rotation of the whole rig, degrees. */
  rotation: number;
  /** Seeds the per-beam noise offsets, so the picture is the same on every load. */
  seed: number;
  /** Device-pixel cap (the original rendered at up to 2×). */
  maxDpr: number;
  /** Keep the drawing buffer readable (tests only). */
  preserveDrawingBuffer?: boolean;
}

export const HERO_BEAMS: BeamsOptions = {
  beamWidth: 2.5,
  beamHeight: 18,
  beamNumber: 15,
  speed: 2.5,
  noiseIntensity: 2,
  scale: 0.15,
  rotation: 43,
  seed: 7,
  maxDpr: 2,
};

/* ─── Shaders ─── */

// The original's noise, verbatim: 2D value noise for the grain, 3D classic
// Perlin noise (Stefan Gustavson) for the displacement.
const NOISE = /* glsl */ `
float random(in vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
float noise(in vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
float cnoise(vec3 P) {
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
  vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
  vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
  vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
  vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
  vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
  vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
  vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}
`;

const VERTEX = /* glsl */ `#version 300 es
precision highp float;
in vec3 position;
in vec2 uv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 normalMatrix;
uniform float time;
uniform float uSpeed;
uniform float uScale;
out vec3 vNormal;
out vec3 vViewPosition;
${NOISE}
float getPos(vec3 pos) {
  vec3 noisePos = vec3(pos.x * 0.0, pos.y - uv.y, pos.z + time * uSpeed * 3.0) * uScale;
  return cnoise(noisePos);
}
vec3 getCurrentPos(vec3 pos) {
  vec3 newpos = pos;
  newpos.z += getPos(pos);
  return newpos;
}
vec3 getNormal(vec3 pos) {
  vec3 curpos = getCurrentPos(pos);
  vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0));
  vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0));
  vec3 tangentX = normalize(nextposX - curpos);
  vec3 tangentZ = normalize(nextposZ - curpos);
  return normalize(cross(tangentZ, tangentX));
}
void main() {
  vec3 transformed = position;
  transformed.z += getPos(transformed);
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  vViewPosition = -mvPosition.xyz;
  vNormal = normalize(normalMatrix * getNormal(position));
  gl_Position = projectionMatrix * mvPosition;
}
`;

// three's MeshStandardMaterial path for one directional light on a black,
// 0.3-rough, 0.3-metal surface: diffuse is zero, so the colour is the GGX
// specular lobe alone. Its multi-scattering compensation is 1 + 0.028·(1/Ess − 1)
// ≈ 1.001 at this roughness — left out.
const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vViewPosition;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uRoughness;
uniform float uMetalness;
uniform float uNoiseIntensity;
out vec4 fragColor;
${NOISE}
#define RECIPROCAL_PI 0.3183098861837907
#define EPSILON 1e-6
float pow2(float x) { return x * x; }
vec3 F_Schlick(vec3 f0, float f90, float dotVH) {
  float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);
  return f0 * (1.0 - fresnel) + (f90 * fresnel);
}
float V_GGX_SmithCorrelated(float alpha, float dotNL, float dotNV) {
  float a2 = pow2(alpha);
  float gv = dotNL * sqrt(a2 + (1.0 - a2) * pow2(dotNV));
  float gl = dotNV * sqrt(a2 + (1.0 - a2) * pow2(dotNL));
  return 0.5 / max(gv + gl, EPSILON);
}
float D_GGX(float alpha, float dotNH) {
  float a2 = pow2(alpha);
  float denom = pow2(dotNH) * (a2 - 1.0) + 1.0;
  return RECIPROCAL_PI * a2 / pow2(denom);
}
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 ACESFilmicToneMapping(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 ACESOutputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602)
  );
  color *= 1.0 / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 sRGBTransferOETF(vec3 v) {
  return mix(pow(v, vec3(0.41666)) * 1.055 - vec3(0.055), v * 12.92, vec3(lessThanEqual(v, vec3(0.0031308))));
}
void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  vec3 dxy = max(abs(dFdx(normal)), abs(dFdy(normal)));
  float roughness = min(max(uRoughness, 0.0525) + max(max(dxy.x, dxy.y), dxy.z), 1.0);
  vec3 f0 = mix(vec3(0.04), vec3(0.0), uMetalness);
  float alpha = pow2(roughness);
  vec3 halfDir = normalize(uLightDir + viewDir);
  float dotNL = clamp(dot(normal, uLightDir), 0.0, 1.0);
  float dotNV = clamp(dot(normal, viewDir), 0.0, 1.0);
  float dotNH = clamp(dot(normal, halfDir), 0.0, 1.0);
  float dotVH = clamp(dot(viewDir, halfDir), 0.0, 1.0);
  vec3 specular = dotNL * uLightColor * F_Schlick(f0, 1.0, dotVH) * (V_GGX_SmithCorrelated(alpha, dotNL, dotNV) * D_GGX(alpha, dotNH));
  vec3 color = sRGBTransferOETF(ACESFilmicToneMapping(specular));
  color -= noise(gl_FragCoord.xy) / 15.0 * uNoiseIntensity;
  fragColor = vec4(color, 1.0);
}
`;

/* ─── Geometry ─── */

/** The same seeded generator on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The original's stacked planes: `n` side-by-side strips, 100 segments tall,
 *  each with its own random uv offset (the noise phase along the strip). */
function stackedPlanes(n: number, width: number, height: number, rand: () => number) {
  const segments = 100;
  const vertices = n * (segments + 1) * 2;
  const positions = new Float32Array(vertices * 3);
  const uvs = new Float32Array(vertices * 2);
  const indices = new Uint16Array(n * segments * 6);
  const x0 = -(n * width) / 2;
  let v = 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * width;
    const uvX = rand() * 300;
    const uvY = rand() * 300;
    for (let j = 0; j <= segments; j++) {
      const y = height * (j / segments - 0.5);
      positions.set([x, y, 0, x + width, y, 0], v * 3);
      uvs.set([uvX, j / segments + uvY, uvX + 1, j / segments + uvY], v * 2);
      if (j < segments) {
        indices.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], k);
        k += 6;
      }
      v += 2;
    }
  }
  return { positions, uvs, indices };
}

/* ─── Renderer ─── */

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Beams shader failed to compile: ${log}`);
  }
  return shader;
}

interface GlState {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  count: number;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export class BeamsRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly opts: BeamsOptions;
  private gl: WebGL2RenderingContext | null = null;
  private state: GlState | null = null;
  private frame = 0;
  private last = 0;
  private running = false;
  private lost = false;
  /** The original's `time` uniform: +0.1 per second of animation. */
  time = 0;

  constructor(canvas: HTMLCanvasElement, opts: BeamsOptions) {
    this.canvas = canvas;
    this.opts = opts;
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
  }

  /** False when WebGL2 isn't available — the caller shows its fallback. */
  init(): boolean {
    const gl = this.canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      depth: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: !!this.opts.preserveDrawingBuffer,
      powerPreference: "high-performance",
    });
    if (!gl) return false;
    this.gl = gl;
    this.state = this.build(gl);
    return true;
  }

  private build(gl: WebGL2RenderingContext): GlState {
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.bindAttribLocation(program, 0, "position");
    gl.bindAttribLocation(program, 1, "uv");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`Beams program failed to link: ${gl.getProgramInfoLog(program)}`);
    }

    const { beamNumber, beamWidth, beamHeight, seed } = this.opts;
    const geo = stackedPlanes(beamNumber, beamWidth, beamHeight, mulberry32(seed));
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const upload = (target: number, data: ArrayBufferView) => {
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(target, buffer);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return buffer;
    };
    const buffers = [upload(gl.ARRAY_BUFFER, geo.positions)];
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    buffers.push(upload(gl.ARRAY_BUFFER, geo.uvs));
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    buffers.push(upload(gl.ELEMENT_ARRAY_BUFFER, geo.indices));
    gl.bindVertexArray(null);

    const uniforms: GlState["uniforms"] = {};
    for (const name of [
      "projectionMatrix", "modelViewMatrix", "normalMatrix", "time", "uSpeed", "uScale",
      "uLightDir", "uLightColor", "uRoughness", "uMetalness", "uNoiseIntensity",
    ]) uniforms[name] = gl.getUniformLocation(program, name);

    gl.useProgram(program);
    const { rotation, speed, scale, noiseIntensity } = this.opts;
    const r = (rotation * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    // The rig (planes + light) is rotated about z; the camera sits at z = 20
    // looking down −z, so the view is a pure translation.
    gl.uniformMatrix4fv(uniforms.modelViewMatrix, false, [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, -20, 1]);
    gl.uniformMatrix3fv(uniforms.normalMatrix, false, [c, s, 0, -s, c, 0, 0, 0, 1]);
    // The light sits at (0, 3, 10) inside the rotated rig, aimed at the origin.
    const light = [-3 * s, 3 * c, 10];
    const len = Math.hypot(light[0], light[1], light[2]);
    gl.uniform3f(uniforms.uLightDir, light[0] / len, light[1] / len, light[2] / len);
    gl.uniform3f(uniforms.uLightColor, 1, 1, 1);
    gl.uniform1f(uniforms.uRoughness, 0.3);
    gl.uniform1f(uniforms.uMetalness, 0.3);
    gl.uniform1f(uniforms.uSpeed, speed);
    gl.uniform1f(uniforms.uScale, scale);
    gl.uniform1f(uniforms.uNoiseIntensity, noiseIntensity);
    return { program, vao, buffers, count: geo.indices.length, uniforms };
  }

  /** Match the canvas's backing store to its CSS size. */
  resize(): void {
    const { canvas } = this;
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  /** Draw one frame at the current `time`. */
  render(): void {
    const { gl, state, canvas } = this;
    if (!gl || !state || this.lost) return;
    const { width, height } = canvas;
    gl.viewport(0, 0, width, height);
    // three's PerspectiveCamera: 30° vertical fov, near 0.1, far 2000.
    const near = 0.1;
    const far = 2000;
    const f = 1 / Math.tan((15 * Math.PI) / 180);
    const aspect = width / height;
    gl.useProgram(state.program);
    gl.uniformMatrix4fv(state.uniforms.projectionMatrix, false, [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, -(far + near) / (far - near), -1,
      0, 0, (-2 * far * near) / (far - near), 0,
    ]);
    gl.uniform1f(state.uniforms.time, this.time);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindVertexArray(state.vao);
    gl.drawElements(gl.TRIANGLES, state.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      // A long gap (tab in the background, a paused section) must not jump the picture.
      const delta = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.time += 0.1 * delta;
      this.render();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  get isRunning(): boolean {
    return this.running;
  }

  dispose(): void {
    this.stop();
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    const { gl, state } = this;
    if (gl && state && !gl.isContextLost()) {
      gl.deleteVertexArray(state.vao);
      for (const b of state.buffers) gl.deleteBuffer(b);
      gl.deleteProgram(state.program);
    }
    this.state = null;
    this.gl = null;
  }

  private resumeAfterRestore = false;

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.resumeAfterRestore = this.running;
    this.stop();
  };

  private onRestored = () => {
    if (!this.gl) return;
    this.lost = false;
    this.state = this.build(this.gl);
    this.render();
    if (this.resumeAfterRestore) this.start();
  };
}
