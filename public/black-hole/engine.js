/* Real-time black hole (WebGL). Exposes window.BlackHole.init(canvas). */
(() => {
"use strict";


// Noise helpers. Only the one-time bake passes use them; the per-frame shader just reads textures.
const NOISE = `
float hash2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
                 mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
                 mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm2(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise2(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
float fbm3(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise3(p);
    p = p * 2.07 + 11.3;
    a *= 0.5;
  }
  return s;
}
`;

const NOISE_BAKE = `precision highp float;
varying vec2 vUv;
` + NOISE + `
// RG = disk turbulence (two phase-shifted layers), BA = fine streaks. Domain: x,z in [-14, 14].
void main() {
  vec2 q = (vUv - 0.5) * 28.0;
  gl_FragColor = vec4(fbm2(q * 0.9), fbm2(q * 0.9 + 31.0),
                      noise2(q * vec2(5.0, 9.0)), noise2(q * vec2(5.0, 9.0) + 7.0));
}
`;

const SKY_BAKE = `precision highp float;
varying vec2 vUv;
uniform float uFace;
` + NOISE + `
// Milky-Way-like band on a tilted plane, with dust lanes and a warm core (stars are drawn live).
vec3 nebula(vec3 d) {
  vec3 bn = normalize(vec3(0.25, 0.9, 0.35));
  float lat = dot(d, bn);
  float band = exp(-lat * lat * 14.0);
  float n1 = fbm3(d * 3.0);
  float n2 = fbm3(d * 7.0 + 4.0);
  float dust = smoothstep(0.35, 0.7, fbm3(d * 5.0 + 20.0));
  float core = pow(max(dot(d, normalize(vec3(-0.6, 0.1, -0.7))), 0.0), 3.0);
  vec3 cool = vec3(0.10, 0.20, 0.42);
  vec3 warm = vec3(0.55, 0.30, 0.18);
  vec3 neb  = mix(cool, warm, clamp(core * 1.3 + n2 * 0.25, 0.0, 1.0));
  vec3 c = neb * band * (0.25 + 0.9 * n1 * n1 * 2.0) * (1.0 - 0.75 * dust) * 0.55;
  c += vec3(0.20, 0.09, 0.26) * pow(fbm3(d * 2.2 + 40.0), 3.0) * 0.45;
  c += vec3(0.9, 0.85, 0.8) * band * pow(n2, 2.0) * 0.08;
  return c;
}
void main() {
  vec2 t = vUv * 2.0 - 1.0;
  vec3 d;
  if (uFace < 0.5) d = vec3(1.0, -t.y, -t.x);
  else if (uFace < 1.5) d = vec3(-1.0, -t.y, t.x);
  else if (uFace < 2.5) d = vec3(t.x, 1.0, t.y);
  else if (uFace < 3.5) d = vec3(t.x, -1.0, -t.y);
  else if (uFace < 4.5) d = vec3(t.x, -t.y, 1.0);
  else d = vec3(-t.x, -t.y, -1.0);
  gl_FragColor = vec4(sqrt(clamp(nebula(normalize(d)) / 2.0, 0.0, 1.0)), 1.0);
}
`;

const SRC = {
  noiseBake: NOISE_BAKE,
  skyBake: SKY_BAKE,
  scene: `precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uCam;
uniform vec3  uFwd;
uniform vec3  uRight;
uniform vec3  uUp;
uniform float uFov;
uniform float uPix;     // angular size of one pixel (radians)
uniform float uDisk;
uniform vec2  uShift;   // moves the hole on screen (uv units)
uniform float uVol;     // 1 = volumetric disk, 0 = thin sheet (cheaper)
uniform int   uSteps;
uniform float uStep;    // ray step multiplier (bigger = faster, coarser)
uniform sampler2D uNoise;   // baked disk noise
uniform samplerCube uSky;   // baked nebula

// Units: Schwarzschild radius rs = 1 (event horizon r = 1, photon sphere r = 1.5,
// innermost stable circular orbit r = 3).
const float R_IN  = 3.0;
const float R_OUT = 13.0;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

// ---------------------------------------------------------------- sky
vec3 starLayer(vec3 d, float scale, float density, float gain) {
  vec3 q = d * scale;
  vec3 id = floor(q);
  vec3 f = fract(q) - 0.5;
  float h = hash3(id);
  if (h < density) return vec3(0.0);
  vec3 off = vec3(hash3(id + 1.3), hash3(id + 2.7), hash3(id + 4.1)) - 0.5;
  // keep stars at least ~1 pixel wide so they do not flicker while the view moves
  float rad = max(0.2, uPix * scale * 0.9);
  float dist = length(f - off * 0.6);
  float k = (h - density) / (1.0 - density);
  float mag = 0.35 + 1.6 * k * k + 7.0 * pow(k, 14.0);
  float b = smoothstep(rad, 0.0, dist) * mag * (0.2 / rad) * (0.2 / rad);
  vec3 tint = mix(vec3(1.0, 0.72, 0.5), vec3(0.62, 0.78, 1.0), hash3(id + 9.1));
  tint = mix(tint, vec3(1.0), 0.25);
  return tint * b * gain;
}

vec3 background(vec3 d) {
  vec3 e = textureCube(uSky, d).rgb;
  return starLayer(d, 60.0, 0.90, 1.5) + starLayer(d, 130.0, 0.92, 1.2) + starLayer(d, 260.0, 0.94, 1.0)
       + e * e * 2.0;
}

// ---------------------------------------------------------------- disk
vec3 blackbody(float t) {
  vec3 c = mix(vec3(0.50, 0.06, 0.02), vec3(1.0, 0.46, 0.10), smoothstep(0.0, 0.5, t));
  c = mix(c, vec3(1.0, 0.86, 0.62), smoothstep(0.4, 0.95, t));
  c = mix(c, vec3(0.72, 0.86, 1.0), smoothstep(0.95, 1.8, t));
  return c;
}

vec2 rot(vec2 p, float a) {
  float s = sin(a), c = cos(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Density pattern of the disk (in the plane). Differential rotation is blended between
// two phase-shifted layers so the pattern never winds up into sub-pixel noise over time.
// The noise itself is baked into a texture, so this costs two texture fetches.
float diskPattern(vec2 xz, float r) {
  float omega = 1.9 / (r * sqrt(r));
  float ph0 = fract(uTime / 16.0);
  float ph1 = fract(uTime / 16.0 + 0.5);
  float w0 = 1.0 - abs(2.0 * ph0 - 1.0);
  vec4 n0 = texture2D(uNoise, rot(xz, -omega * ph0 * 16.0) * (1.0 / 28.0) + 0.5);
  vec4 n1 = texture2D(uNoise, rot(xz, -omega * ph1 * 16.0) * (1.0 / 28.0) + 0.5);
  float t0 = 0.8 * n0.r + 0.2 * n0.b;
  float t1 = 0.8 * n1.g + 0.2 * n1.a;
  float sum = w0 * (0.12 + 2.3 * t0 * t0 * t0) + (1.0 - w0) * (0.12 + 2.3 * t1 * t1 * t1);
  float x = r * 3.0, i = floor(x), f = fract(x);
  float rings = 0.62 + 0.38 * mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f));
  return clamp(sum * rings, 0.0, 1.7);
}

// Colour of the emitting gas at radius r seen along ray direction v.
vec3 diskColor(vec3 pos, float r, vec3 v) {
  float x = R_IN / r;
  float x4 = sqrt(sqrt(x));
  float temp = sqrt(x) * x4;                                  // x^0.75
  float beta = clamp(sqrt(0.5 / (r - 1.0)), 0.0, 0.62);
  vec3 u = normalize(vec3(-pos.z, 0.0, pos.x)) * beta;      // orbital velocity of the gas
  float g = 1.0 / max(0.25, 1.0 + dot(u, v));                // Doppler factor
  g *= sqrt(max(0.0, 1.0 - 1.0 / length(pos)));              // gravitational redshift
  return blackbody(temp * g) * (g * g * g) * 1.5 * (x / sqrt(x4));   // x^0.875 ~ x^0.9
}

float diskEdge(float r) {
  return smoothstep(R_IN, R_IN + 0.35, r) * (1.0 - smoothstep(R_OUT - 4.0, R_OUT, r));
}

// thin-sheet disk (used on low quality)
void diskSheet(vec3 hit, vec3 v, inout vec3 col, inout float T) {
  float r = length(hit.xz);
  if (r < R_IN || r > R_OUT) return;
  float e = diskEdge(r);
  float d = diskPattern(hit.xz, r);
  float a = clamp(d * e * 0.8, 0.0, 1.0);
  col += T * diskColor(hit, r, v) * d * e * a;
  T *= 1.0 - a;
}

float diskThickness(float r) { return 0.03 + 0.014 * r; }

// volumetric disk: one ray-march sample of length dt
void diskVolume(vec3 p, vec3 v, float dt, inout vec3 col, inout float T) {
  float r = length(p.xz);
  if (r < R_IN || r > R_OUT) return;
  float H = diskThickness(r);
  float y = p.y / H;
  if (abs(y) > 3.0) return;
  float vert = exp(-0.5 * y * y);
  float e = diskEdge(r);
  float d = diskPattern(p.xz, r);
  float a = 1.0 - exp(-d * e * vert * dt * 0.8 / (2.5 * H));
  col += T * diskColor(p, r, v) * d * e * a;
  T *= 1.0 - a;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * 2.0 - uShift;
  vec3 v = normalize(uFwd + uRight * (uv.x * uFov) + uUp * (uv.y * uFov));
  vec3 p = uCam;

  vec3 L = cross(p, v);
  float h2 = dot(L, L);                // squared angular momentum (conserved along the ray)

  bool diskOn = uDisk > 0.5;
  bool vol = uVol > 0.5;
  vec3 col = vec3(0.0);
  float T = 1.0;                       // remaining transmittance
  float rmin = 1e9;
  bool captured = false;

  for (int i = 0; i < 320; i++) {
    if (i >= uSteps) { captured = true; break; }
    float r2 = dot(p, p);
    float r = sqrt(r2);
    rmin = min(rmin, r);
    if (r < 1.0) { captured = true; break; }
    if (r > 26.0 && dot(p, v) > 0.0) break;           // flying away: nothing left to bend

    float dt = clamp(0.045 * r * (1.0 + 0.04 * r), 0.02, 3.0) * uStep;   // big steps far away, fine near the hole
    bool inSlab = false;
    float rxz = length(p.xz);
    if (diskOn && vol && rxz < R_OUT + 1.0) {
      float H = diskThickness(rxz);
      float dy = abs(p.y) - 3.0 * H;
      if (dy > 0.0) {
        if (p.y * v.y < 0.0 || r < 6.0) dt = min(dt, dy / max(abs(v.y), 0.02) + 0.1);
      } else {
        inSlab = true;
        dt = min(dt, 0.09 + 0.45 * H);
      }
    }

    // Schwarzschild null geodesic in Cartesian form: a = -1.5 * rs * h^2 * x / r^5
    v += (-1.5 * h2 / (r2 * r2 * r)) * p * dt;
    vec3 pn = p + v * dt;

    if (diskOn) {
      if (vol) {
        if (inSlab) diskVolume(0.5 * (p + pn), normalize(v), dt, col, T);
      } else if (p.y * pn.y < 0.0) {
        diskSheet(mix(p, pn, p.y / (p.y - pn.y)), normalize(v), col, T);
      }
      if (T < 0.02) break;
    }
    p = pn;
  }

  if (!captured) {
    vec3 d = normalize(v);
    col += T * background(d);
    // thin photon ring + soft halo from light skimming the photon sphere
    float x = rmin - 1.5;
    col += T * vec3(1.0, 0.78, 0.55) * (0.10 * exp(-x * 2.2) + 0.55 * exp(-x * 14.0)) * (0.4 + 0.6 * uDisk);
  }

  gl_FragColor = vec4(sqrt(clamp(col / 8.0, 0.0, 1.0)), 1.0);
}
`,
  bright: `precision mediump float;
uniform sampler2D uTex;
uniform vec2 uTexel;       // texel size of the SOURCE texture
varying vec2 vUv;
vec3 dec(vec3 e) { return e * e * 8.0; }
vec3 tap(vec2 uv) {
  vec3 c = min(dec(texture2D(uTex, uv).rgb), vec3(6.0));
  float l = max(max(c.r, c.g), c.b);
  return c * smoothstep(0.45, 1.6, l);
}
void main() {
  vec3 s = tap(vUv + uTexel * vec2(-1.0, -1.0)) + tap(vUv + uTexel * vec2(1.0, -1.0))
         + tap(vUv + uTexel * vec2(-1.0, 1.0)) + tap(vUv + uTexel * vec2(1.0, 1.0));
  gl_FragColor = vec4(sqrt(clamp(s * 0.25 / 8.0, 0.0, 1.0)), 1.0);
}
`,
  down: `precision mediump float;
uniform sampler2D uTex;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(uTex, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(uTex, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(uTex, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s * 0.25, 1.0);
}
`,
  blur: `precision mediump float;
uniform sampler2D uTex;
uniform vec2 uDir;         // texel size * blur direction
varying vec2 vUv;
vec3 dec(vec3 e) { return e * e * 8.0; }
void main() {
  vec3 c = dec(texture2D(uTex, vUv).rgb) * 0.2270270270;
  c += (dec(texture2D(uTex, vUv + uDir * 1.3846153846).rgb) + dec(texture2D(uTex, vUv - uDir * 1.3846153846).rgb)) * 0.3162162162;
  c += (dec(texture2D(uTex, vUv + uDir * 3.2307692308).rgb) + dec(texture2D(uTex, vUv - uDir * 3.2307692308).rgb)) * 0.0702702703;
  gl_FragColor = vec4(sqrt(clamp(c / 8.0, 0.0, 1.0)), 1.0);
}
`,
  final: `precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloomA;
uniform sampler2D uBloomB;
uniform vec2  uRes;
uniform float uTime;
uniform float uFade;
uniform float uBloom;
varying vec2 vUv;

vec3 dec(vec3 e) { return e * e * 8.0; }
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
  vec2 c = vUv - 0.5;
  float ca = 0.002 * dot(c, c);
  vec3 col;
  col.r = dec(texture2D(uScene, vUv + c * ca * 6.0).rgb).r;
  col.g = dec(texture2D(uScene, vUv).rgb).g;
  col.b = dec(texture2D(uScene, vUv - c * ca * 6.0).rgb).b;

  vec3 bloom = dec(texture2D(uBloomA, vUv).rgb) * 0.28 + dec(texture2D(uBloomB, vUv).rgb) * 0.45;
  col += bloom * uBloom;

  col = aces(col * 1.05);
  col = pow(col, vec3(1.0 / 2.2));
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);           // gentle contrast
  col *= 1.0 - 0.6 * dot(c, c) * 1.5;                             // vignette
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * (2.2 / 255.0);   // grain / dithering
  gl_FragColor = vec4(col * uFade, 1.0);
}
`
};

// ---------------------------------------------------------------------------
// WebGL engine. Pipeline: ray-marched scene -> two-level bloom -> composite.
// HDR values are packed as sqrt(col / 8) into plain RGBA8 targets, so only
// core WebGL 1 is required (no float-texture extensions).
// ---------------------------------------------------------------------------
function init(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' })
          || canvas.getContext('experimental-webgl');
  if (!gl) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const VS = 'attribute vec2 aPos; varying vec2 vUv; void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';
  const makeProgram = (fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const locs = {};
    return { p, u: (n) => (n in locs ? locs[n] : (locs[n] = gl.getUniformLocation(p, n))) };
  };

  let scene, bright, down, blur, fin, bakeNoise, bakeSky;
  try {
    scene = makeProgram(SRC.scene);
    bright = makeProgram(SRC.bright);
    down = makeProgram(SRC.down);
    blur = makeProgram(SRC.blur);
    fin = makeProgram(SRC.final);
    bakeNoise = makeProgram(SRC.noiseBake);
    bakeSky = makeProgram(SRC.skyBake);
  } catch (e) { console.error(e); return null; }

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.DEPTH_TEST);

  function makeTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  const freeTarget = (t) => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } };

  // S = scene, A = bloom at 1/4 size, B = bloom at 1/16 size
  let S, A1, A2, B1, B2, sizeKey = '';
  function ensureTargets(sw, sh) {
    const key = sw + 'x' + sh;
    if (key === sizeKey) return;
    sizeKey = key;
    [S, A1, A2, B1, B2].forEach(freeTarget);
    const aw = Math.max(8, sw >> 2), ah = Math.max(8, sh >> 2);
    const bw = Math.max(4, aw >> 2), bh = Math.max(4, ah >> 2);
    S = makeTarget(sw, sh);
    A1 = makeTarget(aw, ah); A2 = makeTarget(aw, ah);
    B1 = makeTarget(bw, bh); B2 = makeTarget(bw, bh);
  }

  function pass(prog, target, textures, setup) {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height);
    textures.forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
    });
    setup(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ------------------------------------------------------------------ one-time bakes
  // Procedural noise is expensive per pixel, so it is rendered once into textures:
  // the disk turbulence (2D) and the nebula behind the stars (cube map).
  const noiseT = makeTarget(1024, 1024);
  pass(bakeNoise, noiseT, [], () => {});

  const SKY_SIZE = 512;
  const skyTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTex);
  for (let f = 0; f < 6; f++) {
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, gl.RGBA, SKY_SIZE, SKY_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const skyFb = gl.createFramebuffer();
  gl.useProgram(bakeSky.p);
  gl.bindFramebuffer(gl.FRAMEBUFFER, skyFb);
  gl.viewport(0, 0, SKY_SIZE, SKY_SIZE);
  for (let f = 0; f < 6; f++) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, skyTex, 0);
    gl.uniform1f(bakeSky.u('uFace'), f);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ------------------------------------------------------------------ state
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const HOME = { yaw: 0.6, pitch: 0.17, dist: 24 };
  const MIN_DIST = 4, MAX_DIST = 60, MAX_PITCH = 1.45;
  const cam = { yaw: HOME.yaw, pitch: HOME.pitch, dist: 26, sx: 0, sy: 0 };   // what is rendered
  const target = { ...HOME };                                               // explore mode target
  const vel = { yaw: 0, pitch: 0 };
  let mode = 'scroll', drift = 0, lastInput = -1e9;
  let autoRotate = true, disk = true, bloomOn = true;

  const api = {
    // set by the page every scroll: { yaw, pitch, dist, sx, sy }
    scroll: { yaw: HOME.yaw, pitch: HOME.pitch, dist: 26, sx: 0, sy: 0 },
    onStat: null,
    get mode() { return mode; },
    setMode(m) {
      if (m === mode) return;
      mode = m;
      vel.yaw = vel.pitch = 0;
      if (m === 'explore') {
        target.yaw = cam.yaw; target.pitch = cam.pitch; target.dist = clamp(cam.dist, 8, 40);
      } else {
        const want = api.scroll.yaw + drift;
        cam.yaw -= 2 * Math.PI * Math.round((cam.yaw - want) / (2 * Math.PI));   // shortest way back
      }
    },
    setAutoRotate(on) { autoRotate = on; },
    setDisk(on) { disk = on; },
    setBloom(on) { bloomOn = on; },
    setQuality(q) { quality = q; level = q === 'auto' ? startLevel : PRESET[q]; lockUntil = 0; slow = fast = 0; },
    reset() { Object.assign(target, HOME); },
    get quality() { return quality; },
  };

  // Quality ladder, best first. `px` is the number of pixels the scene is ray-marched at (independent of
  // the screen's pixel density; it is upscaled with filtering), `step` multiplies the ray step length.
  const LEVELS = [
    { px: 900e3, steps: 300, vol: 1, step: 1.00, bloom: 1 },
    { px: 650e3, steps: 280, vol: 1, step: 1.15, bloom: 1 },
    { px: 450e3, steps: 250, vol: 1, step: 1.30, bloom: 1 },
    { px: 330e3, steps: 230, vol: 0, step: 1.30, bloom: 1 },
    { px: 240e3, steps: 200, vol: 0, step: 1.50, bloom: 1 },
    { px: 170e3, steps: 180, vol: 0, step: 1.70, bloom: 1 },
    { px: 120e3, steps: 160, vol: 0, step: 2.00, bloom: 0 },
    { px:  80e3, steps: 140, vol: 0, step: 2.20, bloom: 0 },
  ];
  const PRESET = { low: 5, mid: 3, high: 1 };
  const coarse = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600;
  const startLevel = coarse ? 4 : 2;
  let quality = 'auto', level = startLevel;
  const maxDpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5);
  const MAX_PIXELS = 1.8e6;

  // canvas size, cached (reading clientWidth every frame can force a layout)
  let cw = canvas.clientWidth, ch = canvas.clientHeight;
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { cw = canvas.clientWidth; ch = canvas.clientHeight; }).observe(canvas);
  }

  // ------------------------------------------------------------------ input (explore mode only)
  const pointers = new Map();
  let pinchDist = 0;
  const touched = () => { lastInput = performance.now(); };
  const exploring = () => mode === 'explore';

  canvas.addEventListener('pointerdown', (e) => {
    if (!exploring()) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.classList.add('drag');
    vel.yaw = vel.pitch = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
    touched();
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      const dyaw = -dx * 0.006, dpitch = dy * 0.006;
      target.yaw += dyaw;
      target.pitch = clamp(target.pitch + dpitch, -MAX_PITCH, MAX_PITCH);
      vel.yaw = vel.yaw * 0.6 + dyaw * 60 * 0.4;
      vel.pitch = vel.pitch * 0.6 + dpitch * 60 * 0.4;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) target.dist = clamp(target.dist * (pinchDist / d), MIN_DIST, MAX_DIST);
      pinchDist = d;
    }
    touched();
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 0) canvas.classList.remove('drag');
    else vel.yaw = vel.pitch = 0;
    touched();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    if (!exploring()) return;
    e.preventDefault();
    target.dist = clamp(target.dist * Math.exp(e.deltaY * 0.0012), MIN_DIST, MAX_DIST);
    touched();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { if (exploring()) api.reset(); });
  window.addEventListener('keydown', (e) => {
    if (!exploring() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('select, input, textarea')) return;
    const k = e.key;
    if (k === 'ArrowLeft') target.yaw += 0.08;
    else if (k === 'ArrowRight') target.yaw -= 0.08;
    else if (k === 'ArrowUp') target.pitch = clamp(target.pitch - 0.06, -MAX_PITCH, MAX_PITCH);
    else if (k === 'ArrowDown') target.pitch = clamp(target.pitch + 0.06, -MAX_PITCH, MAX_PITCH);
    else if (k === '+' || k === '=') target.dist = clamp(target.dist * 0.9, MIN_DIST, MAX_DIST);
    else if (k === '-') target.dist = clamp(target.dist / 0.9, MIN_DIST, MAX_DIST);
    else return;
    e.preventDefault();
    touched();
  });

  // ------------------------------------------------------------------ render loop
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  let prev = t0, ema = 16, slow = 0, fast = 0, statAt = 0, frames = 0;
  let lockUntil = 0, lockLen = 6000, lastUpgrade = 0, capMs = 33.3, lastMode = '';

  // The frame rate is capped: 30 fps while the page is being read (the camera drifts slowly),
  // 60 fps in explore mode. Skipping frames halves the GPU load while scrolling.
  function adapt(now) {
    if (quality !== 'auto' || ++frames < 30) return;
    slow = ema > capMs * 1.3 ? slow + 1 : 0;
    fast = ema < capMs * 1.12 ? fast + 1 : 0;
    if (slow > 8 && level < LEVELS.length - 1) {
      // very slow: drop two steps at once
      level = Math.min(LEVELS.length - 1, level + (ema > capMs * 2 ? 2 : 1)); slow = 0;
      // a downgrade soon after an upgrade means that level is too heavy: wait longer before retrying
      lockLen = now - lastUpgrade < 12000 ? Math.min(lockLen * 2, 60000) : 6000;
      lockUntil = now + lockLen;
    } else if (fast > 120 && level > 0 && now > lockUntil) {
      level--; fast = 0; lastUpgrade = now;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { prev = now; return; }
    capMs = mode === 'explore' ? 16.7 : 33.3;
    if (now - prev < capMs - 4) return;
    if (mode !== lastMode) { lastMode = mode; ema = capMs; slow = fast = 0; }
    const dt = Math.min(0.25, (now - prev) / 1000);
    prev = now;
    if (dt <= 0) return;
    ema += (dt * 1000 - ema) * 0.1;
    adapt(now);
    const L = LEVELS[level];

    // --- camera
    const idle = now - lastInput > 1500 && pointers.size === 0;
    let want, rate;
    if (mode === 'explore') {
      if (pointers.size === 0) {
        target.yaw += vel.yaw * dt;
        target.pitch = clamp(target.pitch + vel.pitch * dt, -MAX_PITCH, MAX_PITCH);
        const decay = Math.exp(-dt * 3.2);
        vel.yaw *= decay; vel.pitch *= decay;
      }
      if (autoRotate && !reduceMotion && idle) target.yaw += dt * 0.1;
      want = { yaw: target.yaw, pitch: target.pitch, dist: target.dist, sx: 0, sy: 0 };
      rate = 9;
    } else {
      if (!reduceMotion) drift += dt * 0.045;
      const s = api.scroll;
      want = { yaw: s.yaw + drift, pitch: s.pitch, dist: s.dist, sx: s.sx, sy: s.sy };
      rate = 2.4;
    }
    const k = 1 - Math.exp(-dt * rate);
    const ks = 1 - Math.exp(-dt * (mode === 'explore' ? 3 : 2.4));
    cam.yaw += (want.yaw - cam.yaw) * k;
    cam.pitch += (want.pitch - cam.pitch) * k;
    cam.dist += (want.dist - cam.dist) * k;
    cam.sx += (want.sx - cam.sx) * ks;
    cam.sy += (want.sy - cam.sy) * ks;

    const tIntro = reduceMotion ? 1 : clamp((now - t0) / 3200, 0, 1);
    const ease = 1 - Math.pow(1 - tIntro, 3);
    const dist = cam.dist * (1 + 1.4 * (1 - ease));
    const fade = clamp((now - t0) / 900, 0, 1);
    const sway = mode === 'explore' && autoRotate && !reduceMotion && idle ? Math.sin(now / 5200) * 0.045 : 0;
    const pitch = clamp(cam.pitch + sway, -MAX_PITCH, MAX_PITCH);

    // --- sizes: the screen buffer is sharp (capped DPR), the ray-marched scene uses a fixed pixel budget
    if (!cw || !ch) return;
    let dpr = maxDpr;
    if (cw * ch * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / (cw * ch));
    const W = Math.max(1, Math.round(cw * dpr)), H = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const sw = Math.max(16, Math.min(W, Math.round(Math.sqrt(L.px * W / H))));
    const sh = Math.max(16, Math.min(H, Math.round(sw * H / W)));
    ensureTargets(sw, sh);
    const doBloom = bloomOn && L.bloom === 1;

    // --- camera basis
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const pos = [dist * cp * Math.sin(cam.yaw), dist * sp, dist * cp * Math.cos(cam.yaw)];
    const fwd = pos.map((x) => -x / dist);
    let right = [-fwd[2], 0, fwd[0]];
    const rl = Math.hypot(right[0], right[2]) || 1;
    right = [right[0] / rl, 0, right[2] / rl];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    const fov = Math.tan(0.5 * (cw < ch ? 1.25 : 0.95));
    const aspect = sw / sh;

    pass(scene, S, [noiseT], (u) => {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTex);
      gl.uniform1i(u('uNoise'), 0);
      gl.uniform1i(u('uSky'), 1);
      gl.uniform1f(u('uStep'), L.step);
      gl.uniform2f(u('uRes'), sw, sh);
      gl.uniform1f(u('uTime'), now / 1000);
      gl.uniform3f(u('uCam'), pos[0], pos[1], pos[2]);
      gl.uniform3f(u('uFwd'), fwd[0], fwd[1], fwd[2]);
      gl.uniform3f(u('uRight'), right[0], right[1], right[2]);
      gl.uniform3f(u('uUp'), up[0], up[1], up[2]);
      gl.uniform1f(u('uFov'), fov);
      gl.uniform1f(u('uPix'), (2 * fov) / sh);
      gl.uniform1f(u('uDisk'), disk ? 1 : 0);
      gl.uniform1f(u('uVol'), L.vol);
      gl.uniform1i(u('uSteps'), L.steps);
      gl.uniform2f(u('uShift'), cam.sx * aspect, cam.sy);
    });

    if (doBloom) {
      pass(bright, A1, [S], (u) => { gl.uniform1i(u('uTex'), 0); gl.uniform2f(u('uTexel'), 1 / S.w, 1 / S.h); });
      pass(blur, A2, [A1], (u) => { gl.uniform1i(u('uTex'), 0); gl.uniform2f(u('uDir'), 1 / A1.w, 0); });
      pass(blur, A1, [A2], (u) => { gl.uniform1i(u('uTex'), 0); gl.uniform2f(u('uDir'), 0, 1 / A1.h); });
      pass(down, B1, [A1], (u) => { gl.uniform1i(u('uTex'), 0); gl.uniform2f(u('uTexel'), 1 / A1.w, 1 / A1.h); });
      pass(blur, B2, [B1], (u) => { gl.uniform1i(u('uTex'), 0); gl.uniform2f(u('uDir'), 1 / B1.w, 0); });
      pass(blur, B1, [B2], (u) => { gl.uniform1i(u('uTex'), 0); gl.uniform2f(u('uDir'), 0, 1 / B1.h); });
    }

    pass(fin, null, [S, A1, B1], (u) => {
      gl.uniform1i(u('uScene'), 0);
      gl.uniform1i(u('uBloomA'), 1);
      gl.uniform1i(u('uBloomB'), 2);
      gl.uniform2f(u('uRes'), W, H);
      gl.uniform1f(u('uTime'), now / 1000);
      gl.uniform1f(u('uFade'), fade);
      gl.uniform1f(u('uBloom'), doBloom ? 1 : 0);
    });

    if (api.onStat && now - statAt > 500) {
      statAt = now;
      api.onStat(`${Math.round(1000 / ema)} FPS · ${sw}×${sh} · q${level} · r = ${cam.dist.toFixed(1)} rs`);
    }
  }
  requestAnimationFrame(frame);

  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  return api;
}

window.BlackHole = { init };
})();
