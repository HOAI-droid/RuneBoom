import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { WR } from '@runeboom/core';
import { meshVoxels, type Grid, type MeshDaten } from './voxel.ts';

// ================= Lichtkarte: jeder Block weiß, wie hell ihn Fackeln und Leuchttürme machen =================
const LK = 2 * WR;
export const LICHTKARTE = new Uint8Array(LK * LK);
export const lichtTex = new THREE.DataTexture(LICHTKARTE, LK, LK, THREE.RedFormat, THREE.UnsignedByteType);
lichtTex.magFilter = THREE.LinearFilter; lichtTex.minFilter = THREE.LinearFilter; lichtTex.needsUpdate = true;
export const LICHT_U = { uLicht: { value: lichtTex }, uNacht: { value: 0 }, uLichtFarbe: { value: new THREE.Color('#ffb36a') } };
export function lichtkarteSetzen(lichter: { x: number; z: number; r: number; kegel?: number; geb?: { zielen: number } }[]): void {
  LICHTKARTE.fill(0);
  for (const l of lichter) {
    const r = Math.ceil(l.r);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = Math.floor(l.x + dx) + WR, z = Math.floor(l.z + dz) + WR; if (x < 0 || z < 0 || x >= LK || z >= LK) continue;
      const e = Math.hypot(dx, dz); let d = e / l.r; if (d >= 1) continue;
      if (l.kegel && l.geb) { // Scheinwerfer: kleiner Kreis plus Kegel in Blickrichtung
        let da = Math.atan2(dx, dz) - l.geb.zielen; da = Math.atan2(Math.sin(da), Math.cos(da));
        const kreis = e < 6 ? 1 - e / 6 : 0, kegel = Math.abs(da) < l.kegel ? Math.max(0, 1 - d) * (1 - Math.abs(da) / l.kegel * 0.5) : 0;
        d = 1 - Math.max(kreis, kegel); if (d >= 1) continue;
      }
      const v = Math.round((1 - d) * 255), i = z * LK + x; if (v > LICHTKARTE[i]) LICHTKARTE[i] = v;
    }
  }
  lichtTex.needsUpdate = true;
}
/** Material bekommt Licht aus der Lichtkarte, nachts */
export function mitLichtkarte<T extends THREE.Material>(mat: T, staerke = 1.7): T {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LICHT_U);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 w4 = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nw4 = instanceMatrix * w4;\n#endif\nvWP = (modelMatrix * w4).xyz; }');
    sh.fragmentShader = 'uniform sampler2D uLicht; uniform float uNacht; uniform vec3 uLichtFarbe; varying vec3 vWP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\nfloat lmw = texture2D(uLicht, (vWP.xz + ${WR.toFixed(1)}) / ${(2 * WR).toFixed(1)}).r;\ntotalEmissiveRadiance += diffuseColor.rgb * uLichtFarbe * lmw * lmw * uNacht * ${staerke.toFixed(2)};`);
  };
  return mat;
}

// ================= Materialien =================
export const SOLID = mitLichtkarte(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02 }));
export const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
export const LAMP = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
export function geometrie(T: MeshDaten): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(T.p, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(T.n, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(T.c, 3));
  geo.setIndex(new THREE.BufferAttribute(T.i, 1));
  geo.computeBoundingSphere();
  return geo;
}
export function zuGruppe(meshes: (MeshDaten | null)[], scale = 1): THREE.Group {
  const grp = new THREE.Group(); grp.scale.setScalar(scale);
  meshes.forEach((T, idx) => {
    if (!T) return;
    const m = new THREE.Mesh(geometrie(T), [SOLID, GLOW, LAMP][idx]); m.castShadow = true; m.receiveShadow = idx === 0; grp.add(m);
  });
  return grp;
}
export const gridZuGruppe = (g: Grid, scale = 1) => zuGruppe(meshVoxels(g, g.m.values()), scale);
export function weg(obj: THREE.Object3D): void { obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); }); obj.parent?.remove(obj); }

// ================= Wasser und Lava =================
export const ZEIT = { value: 0 };
export const WASSER_U = { uTief: { value: new THREE.Color('#1f5a6e') }, uHell: { value: new THREE.Color('#4fa3b3') }, uFunkeln: { value: new THREE.Color('#ffe2b0') } };
export const NOISE_GLSL = `
  float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec2 h2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
  float rausch(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += rausch(p) * a; p *= 2.03; a *= 0.5; } return s; }`;
const VS = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
export const WASSER = new THREE.ShaderMaterial({
  uniforms: { uZeit: ZEIT, ...WASSER_U, ...LICHT_U }, vertexShader: VS,
  fragmentShader: `uniform float uZeit, uNacht; uniform vec3 uTief, uHell, uFunkeln, uLichtFarbe; uniform sampler2D uLicht; varying vec3 vW; ${NOISE_GLSL}
    void main(){
      vec2 p = floor(vW.xz * 8.0) / 8.0; float t = uZeit;
      float w = fbm(p * 0.7 + vec2(t * 0.09, t * 0.05)) + 0.5 * fbm(p * 1.8 - vec2(t * 0.07, -t * 0.11));
      vec3 c = mix(uTief, uHell, smoothstep(0.62, 1.12, w));
      float funk = step(0.965, h1(floor(vW.xz * 8.0) + floor(t * 1.5) * 7.13));
      c += uFunkeln * funk * smoothstep(0.75, 1.05, w) * 0.9;
      float lm = texture2D(uLicht, (vW.xz + ${WR.toFixed(1)}) / ${(2 * WR).toFixed(1)}).r; c += uLichtFarbe * lm * lm * uNacht * 0.35;
      gl_FragColor = vec4(c, 1.0);
    }`
});
export const LAVA = new THREE.ShaderMaterial({
  uniforms: { uZeit: ZEIT }, vertexShader: VS,
  fragmentShader: `uniform float uZeit; varying vec3 vW; ${NOISE_GLSL}
    float zellen(vec2 p, float t) { vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = h2(i + g);
        o = 0.5 + 0.4 * sin(t * 0.35 + 6.2831 * o); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      return d2 - d1; }
    void main(){
      vec2 p = floor(vW.xz * 8.0) / 8.0 * 0.5; float t = uZeit;
      vec2 q = p * 0.9 + vec2(fbm(p * 0.6 + t * 0.06), fbm(p * 0.6 - t * 0.05 + 3.7)) * 1.4;
      float riss = zellen(q * 1.3, t), adern = fbm(q * 2.2 + t * 0.15);
      float see = smoothstep(0.5, 0.68, fbm(q * 0.7 + vec2(t * 0.04, -t * 0.03)));
      float hitze = max(max(smoothstep(0.42, 0.04, riss), see * 0.9), smoothstep(0.64, 0.9, adern) * 0.6);
      hitze = clamp(hitze * (0.85 + 0.15 * sin(t * 2.2 + adern * 8.0 + p.x * 1.7)), 0.0, 1.0);
      vec3 kruste = mix(vec3(0.07, 0.02, 0.015), vec3(0.22, 0.05, 0.02), fbm(q * 4.0)) + vec3(0.35, 0.06, 0.0) * smoothstep(0.7, 0.2, riss) * 0.6;
      vec3 glut = mix(vec3(0.75, 0.10, 0.02), vec3(1.0, 0.38, 0.05), smoothstep(0.25, 0.65, hitze));
      glut = mix(glut, vec3(1.0, 0.72, 0.22), smoothstep(0.72, 0.95, hitze));
      glut = mix(glut, vec3(1.0, 0.95, 0.75), smoothstep(0.97, 1.0, hitze));
      gl_FragColor = vec4(mix(kruste * 1.4, glut * 1.7, smoothstep(0.12, 0.45, hitze)) + vec3(0.15, 0.03, 0.0), 1.0);
    }`
});
export function becken(zellen: Float32Array, mat: THREE.Material): THREE.Mesh {
  const p: number[] = [], idx: number[] = [];
  for (let k = 0; k < zellen.length; k += 3) { const x = zellen[k], y = zellen[k + 1], z = zellen[k + 2], b = p.length / 3; p.push(x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1); idx.push(b, b + 2, b + 1, b, b + 3, b + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setIndex(idx);
  return new THREE.Mesh(geo, mat);
}

// ================= Tag und Nacht =================
export interface Stimmung { top: string; bot: string; fog: string; sun: string; sunI: number; sunP: [number, number, number]; hemiS: string; hemiG: string; hemiI: number; exp: number; glow: number; lamp: number; tint: string; bloom: number; wasser: [string, string, string]; nebel: string }
export const TAG: Stimmung = { top: '#3c5c8f', bot: '#f2bf86', fog: '#e7b48a', sun: '#ffc27a', sunI: 3.4, sunP: [-50, 42, 34], hemiS: '#a9c4ff', hemiG: '#6b4a2f', hemiI: 1.15, exp: 1.0, glow: 0.62, lamp: 0.3, tint: '#ffd9a8', bloom: 0.32, wasser: ['#1f5a6e', '#4fa3b3', '#ffe2b0'], nebel: '#efe9dd' };
export const NACHT: Stimmung = { top: '#060b1e', bot: '#24386a', fog: '#1b2a52', sun: '#9db4ff', sunI: 1.2, sunP: [44, 58, -24], hemiS: '#4a63a8', hemiG: '#16122a', hemiI: 0.5, exp: 1.1, glow: 0.7, lamp: 0.8, tint: '#c8d6ff', bloom: 0.28, wasser: ['#0b1a33', '#21466e', '#9db4ff'], nebel: '#55607e' };
const c1 = new THREE.Color(), c2 = new THREE.Color();
const mixC = (a: string, b: string, t: number, out: THREE.Color) => out.copy(c1.set(a)).lerp(c2.set(b), t);

export class Himmel {
  readonly mesh: THREE.Mesh;
  private u = { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uFog: { value: new THREE.Color() } };
  constructor() {
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2500, 24, 12), new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uTop, uBot, uFog; varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(uBot, uTop, smoothstep(0.0, 0.55, h)) : mix(uBot, uFog, smoothstep(0.0, 0.25, -h)); gl_FragColor = vec4(c, 1.0); }'
    }));
    this.mesh.renderOrder = -100; this.mesh.frustumCulled = false;
  }
  setze(top: THREE.Color, bot: THREE.Color, fog: THREE.Color) { this.u.uTop.value.copy(top); this.u.uBot.value.copy(bot); this.u.uFog.value.copy(fog); }
}

/** Licht der Szene; folgt der Kamera, damit die Schatten scharf bleiben */
export class Beleuchtung {
  sun = new THREE.DirectionalLight('#fff', 3); hemi = new THREE.HemisphereLight('#fff', '#000', 1); front = new THREE.DirectionalLight('#fff', 0.35);
  himmel = new Himmel(); fog = new THREE.Fog('#e7b48a', 200, 520);
  private richtung = new THREE.Vector3(1, 1, 1);
  private tmp = { top: new THREE.Color(), bot: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color() };
  werte = { exp: 1, bloom: 0.3, tint: new THREE.Color(), nebel: new THREE.Color() };
  constructor(scene: THREE.Scene, ausdehnung = 60) {
    const s = this.sun; s.castShadow = true; s.shadow.mapSize.set(2048, 2048);
    Object.assign(s.shadow.camera, { left: -ausdehnung, right: ausdehnung, top: ausdehnung, bottom: -ausdehnung, near: 1, far: 360 });
    s.shadow.bias = -0.0005; s.shadow.normalBias = 0.03; s.shadow.radius = 4;
    this.front.position.set(30, 40, 60);
    scene.add(s, s.target, this.hemi, this.front, this.himmel.mesh);
    scene.fog = this.fog;
  }
  /** d: 0 = Tag, 1 = Nacht */
  setze(d: number): void {
    const t = this.tmp, A = TAG, N = NACHT;
    mixC(A.top, N.top, d, t.top); mixC(A.bot, N.bot, d, t.bot); mixC(A.fog, N.fog, d, t.fog);
    this.himmel.setze(t.top, t.bot, t.fog); this.fog.color.copy(t.fog);
    mixC(A.sun, N.sun, d, this.sun.color); this.sun.intensity = A.sunI + (N.sunI - A.sunI) * d;
    this.richtung.set(A.sunP[0] + (N.sunP[0] - A.sunP[0]) * d, A.sunP[1] + (N.sunP[1] - A.sunP[1]) * d, A.sunP[2] + (N.sunP[2] - A.sunP[2]) * d).normalize();
    mixC(A.hemiS, N.hemiS, d, this.hemi.color); mixC(A.hemiG, N.hemiG, d, this.hemi.groundColor); this.hemi.intensity = A.hemiI + (N.hemiI - A.hemiI) * d;
    this.front.intensity = 0.35 - 0.23 * d;
    GLOW.color.setScalar(A.glow + (N.glow - A.glow) * d); LAMP.color.setScalar(A.lamp + (N.lamp - A.lamp) * d);
    mixC(A.wasser[0], N.wasser[0], d, WASSER_U.uTief.value); mixC(A.wasser[1], N.wasser[1], d, WASSER_U.uHell.value); mixC(A.wasser[2], N.wasser[2], d, WASSER_U.uFunkeln.value);
    LICHT_U.uNacht.value = Math.max(0, (d - 0.25) / 0.75);
    this.werte.exp = A.exp + (N.exp - A.exp) * d; this.werte.bloom = A.bloom + (N.bloom - A.bloom) * d;
    mixC(A.tint, N.tint, d, this.werte.tint); mixC(A.nebel, N.nebel, d, this.werte.nebel);
  }
  folge(p: THREE.Vector3, cam: THREE.Camera): void {
    this.sun.target.position.copy(p); this.sun.position.copy(p).addScaledVector(this.richtung, 160);
    this.himmel.mesh.position.copy(cam.position);
  }
}

// ================= Nachbearbeitung wie im Grafik-Zweig von overBOOM =================
const GRADE = () => new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uTint: { value: new THREE.Color('#ffd9a8') } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uTint; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, c * uTint, smoothstep(0.3, 1.0, l) * 0.35);
      c = mix(c, c * vec3(0.85, 0.9, 1.1), (1.0 - smoothstep(0.0, 0.4, l)) * 0.3);
      c = mix(vec3(l), c, 1.12); vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.55; gl_FragColor = vec4(c, 1.0); }`
});
const TILT = () => new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uDir: { value: new THREE.Vector2(1, 0) }, uStaerke: { value: 0.7 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes, uDir; uniform float uStaerke; varying vec2 vUv;
    void main(){ float d = abs(vUv.y - 0.5) * 2.0; float r = smoothstep(0.45, 1.0, d) * uStaerke * uRes.y / 300.0;
      vec2 st = uDir * r / uRes; vec3 c = vec3(0.0); float ws = 0.0;
      for (int i = -4; i <= 4; i++) { float w = exp(-float(i * i) / 6.0); c += texture2D(tDiffuse, vUv + st * float(i)).rgb * w; ws += w; }
      gl_FragColor = vec4(c / ws, 1.0); }`
});
export class Nachbearbeitung {
  comp: EffectComposer; private bloom: UnrealBloomPass; private grade: ShaderPass; private tilt: ShaderPass[];
  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, tilt = 0.5) {
    this.comp = new EffectComposer(renderer);
    this.comp.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), 0.3, 0.55, 1.0); this.comp.addPass(this.bloom);
    this.grade = new ShaderPass(GRADE()); this.comp.addPass(this.grade);
    this.tilt = [new ShaderPass(TILT()), new ShaderPass(TILT())];
    this.tilt.forEach((p, i) => { p.uniforms.uDir.value.set(i ? 0 : 1, i ? 1 : 0); p.uniforms.uStaerke.value = tilt; this.comp.addPass(p); });
    this.comp.addPass(new OutputPass());
  }
  groesse(w: number, h: number): void {
    const pr = this.renderer.getPixelRatio();
    this.comp.setSize(w, h); this.bloom.resolution.set(w * pr, h * pr); for (const p of this.tilt) p.uniforms.uRes.value.set(w * pr, h * pr);
  }
  setze(b: Beleuchtung): void { this.bloom.strength = b.werte.bloom; this.grade.uniforms.uTint.value.copy(b.werte.tint); this.renderer.toneMappingExposure = b.werte.exp; }
  render(): void { this.comp.render(); }
}
export function neuerRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  return r;
}
