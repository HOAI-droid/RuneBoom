import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { WR } from '@runeboom/core';
import { meshVoxels, type Grid, type MeshDaten } from './voxel.ts';

// ================= Lichtkarte: jeder Block weiß, wie hell ihn Fackeln und Leuchttürme machen =================
const LK = 2 * WR;
export const LICHTKARTE = new Uint8Array(LK * LK);
export const lichtTex = new THREE.DataTexture(LICHTKARTE, LK, LK, THREE.RedFormat, THREE.UnsignedByteType);
lichtTex.magFilter = THREE.LinearFilter; lichtTex.minFilter = THREE.LinearFilter; lichtTex.needsUpdate = true;
/** Jahreszeit: Anteile von Frühling, Herbst und Winter (Sommer = alle 0) */
export const JAHR_U = { uFruehling: { value: 0 }, uHerbst: { value: 0 }, uWinter: { value: 0 } };
export function jahreszeitSetzen(fruehling: number, herbst: number, winter: number): void { JAHR_U.uFruehling.value = fruehling; JAHR_U.uHerbst.value = herbst; JAHR_U.uWinter.value = winter; }
/** Grün erkennen und je Jahreszeit umfärben; Schnee auf Oberseiten (gleiche Rechnung in knoten.ts) */
const JAHR_GLSL = `vec3 jahreszeit(vec3 c, vec3 n) {
  float gruen = smoothstep(0.0, 0.05, c.g - max(c.r, c.b));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, c * vec3(1.08, 1.12, 0.78) + vec3(0.01, 0.015, 0.0), gruen * uFruehling);
  vec3 herbst = mix(vec3(l * 1.7, l * 0.85, l * 0.22), vec3(l * 1.25, l * 0.48, l * 0.12), step(0.5, fract(c.g * 37.0)));
  c = mix(c, herbst, gruen * uHerbst * 0.7);
  c = mix(c, vec3(l) * vec3(0.82, 0.88, 0.92), gruen * uWinter * 0.55);
  float oben = smoothstep(0.55, 0.95, n.y);
  c = mix(c, vec3(0.86, 0.9, 0.96), oben * uWinter * 0.88);
  return c; }`;
export const LICHT_U = { uLicht: { value: lichtTex }, uNacht: { value: 0 }, uLichtFarbe: { value: new THREE.Color('#ffb36a') } };
type Lichtquelle = { x: number; z: number; r: number; kegel?: number; geb?: { zielen: number } };
const LK_FEST = new Uint8Array(LK * LK);
let lkKegelAn = false;
function lichtMalen(ziel: Uint8Array, l: Lichtquelle): void {
  const r = Math.ceil(l.r);
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const x = Math.floor(l.x + dx) + WR, z = Math.floor(l.z + dz) + WR; if (x < 0 || z < 0 || x >= LK || z >= LK) continue;
    const e = Math.hypot(dx, dz); let d = e / l.r; if (d >= 1) continue;
    if (l.kegel && l.geb) { // Scheinwerfer: kleiner Kreis plus Kegel in Blickrichtung
      let da = Math.atan2(dx, dz) - l.geb.zielen; da = Math.atan2(Math.sin(da), Math.cos(da));
      const kreis = e < 6 ? 1 - e / 6 : 0, kegel = Math.abs(da) < l.kegel ? Math.max(0, 1 - d) * (1 - Math.abs(da) / l.kegel * 0.5) : 0;
      d = 1 - Math.max(kreis, kegel); if (d >= 1) continue;
    }
    const v = Math.round((1 - d) * 255), i = z * LK + x; if (v > ziel[i]) ziel[i] = v;
  }
}
/**
 * Lichtkarte neu malen. fest = true: alle Lichter haben sich geändert (Bau, Abriss);
 * sonst werden nur die Scheinwerfer auf den zwischengespeicherten festen Teil gemalt – und nur nachts.
 */
export function lichtkarteSetzen(lichter: Lichtquelle[], fest = true, nacht = true): void {
  if (fest) { LK_FEST.fill(0); for (const l of lichter) if (!l.kegel) lichtMalen(LK_FEST, l); }
  const kegel = nacht ? lichter.filter((l) => l.kegel && l.geb) : [];
  if (!fest && !kegel.length && !lkKegelAn) return;
  LICHTKARTE.set(LK_FEST); for (const l of kegel) lichtMalen(LICHTKARTE, l);
  lkKegelAn = kegel.length > 0;
  lichtTex.needsUpdate = true;
}
/** Material bekommt Licht aus der Lichtkarte, nachts */
export function mitLichtkarte<T extends THREE.Material>(mat: T, staerke = 1.7, maske?: THREE.Texture, schwelle = 0.5): T {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LICHT_U);
    Object.assign(sh.uniforms, JAHR_U);
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 w4 = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nw4 = instanceMatrix * w4;\n#endif\nvWP = (modelMatrix * w4).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); }');
    sh.fragmentShader = 'uniform sampler2D uLicht; uniform float uNacht, uFruehling, uHerbst, uWinter; uniform vec3 uLichtFarbe; varying vec3 vWP; varying vec3 vWN;\n' + JAHR_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = jahreszeit(diffuseColor.rgb, vWN);').replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\nfloat lmw = texture2D(uLicht, (vWP.xz + ${WR.toFixed(1)}) / ${(2 * WR).toFixed(1)}).r;\ntotalEmissiveRadiance += diffuseColor.rgb * uLichtFarbe * lmw * lmw * uNacht * ${staerke.toFixed(2)};`);
    if (maske) { // unter fertigen Kacheln ausblenden
      sh.uniforms.uMaske = { value: maske };
      sh.fragmentShader = 'uniform sampler2D uMaske;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `if (texture2D(uMaske, (vWP.xz + ${WR.toFixed(1)}) / ${(2 * WR).toFixed(1)}).r > ${schwelle.toFixed(2)}) discard;\n#include <clipping_planes_fragment>`);
    }
  };
  if (maske) mat.customProgramCacheKey = () => `lichtkarte-maske-${staerke}-${schwelle}`;
  return mat;
}

/**
 * Alle eigenen Materialien entstehen über diese Fabrik. Für WebGPU ersetzt knoten.ts jeden Eintrag
 * durch eine Fassung in Three.js-Knoten (TSL); WebGL behält die Shader hier.
 */
export const FABRIK = {
  gpu: false,
  licht: (p: THREE.MeshStandardMaterialParameters, staerke = 1.7, maske?: THREE.Texture, schwelle = 0.5): THREE.Material => mitLichtkarte(new THREE.MeshStandardMaterial(p), staerke, maske, schwelle),
  wasser: (): THREE.Material => wasserGL(),
  lava: (): THREE.Material => lavaGL(),
  himmel: (u: { uTop: { value: THREE.Color }; uBot: { value: THREE.Color }; uFog: { value: THREE.Color } }): THREE.Material => himmelGL(u),
  nebel: (u: NebelU, lage: number, zahl: number): THREE.Material => nebelGL(u, lage, zahl),
  wegLeuchten: (u: { uZeit: { value: number }; uStaerke: { value: number } }): THREE.Material => wegGL(u),
  kegel: (): THREE.Material => kegelGL(),
  post: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, tilt: number): Post => new Nachbearbeitung(renderer, scene, camera, tilt)
};
export interface NebelU { uZeit: { value: number }; uMaske: { value: THREE.Texture }; uFarbe: { value: THREE.Color }; uDichte: { value: number } }
export interface Post { tilt: boolean; groesse(w: number, h: number): void; setze(b: Beleuchtung): void; render(): void }

// ================= Materialien =================
export let SOLID: THREE.Material = FABRIK.licht({ vertexColors: true, roughness: 0.86, metalness: 0.02 });
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
const wasserGL = () => new THREE.ShaderMaterial({
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
const lavaGL = () => new THREE.ShaderMaterial({
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
export let WASSER: THREE.Material = wasserGL(), LAVA: THREE.Material = lavaGL();
/** nach dem Umschalten auf WebGPU die festen Materialien neu anlegen */
export function materialienNeu(): void { SOLID = FABRIK.licht({ vertexColors: true, roughness: 0.86, metalness: 0.02 }); WASSER = FABRIK.wasser(); LAVA = FABRIK.lava(); }
const himmelGL = (u: Parameters<typeof FABRIK.himmel>[0]) => new THREE.ShaderMaterial({
  uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 uTop, uBot, uFog; varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(uBot, uTop, smoothstep(0.0, 0.55, h)) : mix(uBot, uFog, smoothstep(0.0, 0.25, -h)); gl_FragColor = vec4(c, 1.0); }'
});
const nebelGL = (u: NebelU, lage: number, zahl: number) => new THREE.ShaderMaterial({
  uniforms: { ...u, uLage: { value: lage }, uZahl: { value: zahl } },
  vertexShader: `attribute float aLand; uniform float uZeit; varying float vLand, vGross; varying vec3 vW; ${NOISE_GLSL}
    void main(){ vLand = aLand; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
      vGross = aLand > 0.0 ? fbm(w.xz * 0.0065 + vec2(uZeit * 0.006, -uZeit * 0.004)) : 0.0;
      gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uZeit, uDichte, uLage, uZahl; uniform vec3 uFarbe; uniform sampler2D uMaske; varying float vLand, vGross; varying vec3 vW; ${NOISE_GLSL}
    void main(){
      if (vLand < 0.01) discard;
      float frei = smoothstep(0.2, 0.8, texture2D(uMaske, (vW.xz + ${WR.toFixed(1)}) / ${(2 * WR).toFixed(1)}).r);
      if (frei > 0.995) discard;
      vec2 p = vW.xz * 0.03 + vec2(uZeit * 0.012 * (1.0 + uLage * 0.3), uZeit * 0.007) + uLage * 3.7;
      float n = fbm(p);
      float wechsel = mix(0.4, 1.25, smoothstep(0.32, 0.72, vGross)) * (0.88 + 0.12 * sin(uZeit * 0.21 + vGross * 9.0));
      float a = uDichte * (0.45 + 0.9 * n) * wechsel * (1.0 - frei) * vLand * (1.0 - uLage * 0.06);
      a = 1.0 - pow(1.0 - clamp(a, 0.0, 0.98), uZahl);
      if (a < 0.01) discard;
      gl_FragColor = vec4(uFarbe * (0.9 + 0.18 * n), a);
    }`,
  transparent: true, depthWrite: false
});
const wegGL = (u: Parameters<typeof FABRIK.wegLeuchten>[0]) => new THREE.ShaderMaterial({
  uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: 'attribute float aPhase; varying float vP; void main(){ vP = aPhase; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform float uZeit, uStaerke; varying float vP; void main(){ float a = 0.5 + 0.5 * sin(vP * 0.9 - uZeit * 5.0); a = smoothstep(0.3, 1.0, a); gl_FragColor = vec4(vec3(1.0, 0.45, 0.25) * 1.6, a * uStaerke); }'
});
const kegelGL = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: 'varying float vZ; void main(){ vZ = position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying float vZ; void main(){ float a = (1.0 - clamp(vZ, 0.0, 1.0)) * 0.05; gl_FragColor = vec4(1.0, 0.9, 0.65, a); }'
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
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2500, 24, 12), FABRIK.himmel(this.u));
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
// Ablauf: Szene → Bloom → Tilt-Shift waagrecht → Abschluss (Tilt-Shift senkrecht, Farbstimmung, Vignette, Tonwerte, sRGB) in einem Durchgang
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const TILT_GLSL = `float tiltR(vec2 uv, float st, vec2 res) { return smoothstep(0.45, 1.0, abs(uv.y - 0.5) * 2.0) * st * res.y / 300.0; }
  vec3 tiltBlur(sampler2D t, vec2 uv, vec2 st) { vec3 c = vec3(0.0); float ws = 0.0;
    for (int i = -4; i <= 4; i++) { float w = exp(-float(i * i) / 6.0); c += texture2D(t, uv + st * float(i)).rgb * w; ws += w; } return c / ws; }`;
const TILT = () => new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uStaerke: { value: 0.7 } },
  vertexShader: QUAD_VS,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uStaerke; varying vec2 vUv; ${TILT_GLSL}
    void main(){ float r = tiltR(vUv, uStaerke, uRes); gl_FragColor = vec4(r < 0.05 ? texture2D(tDiffuse, vUv).rgb : tiltBlur(tDiffuse, vUv, vec2(r, 0.0) / uRes), 1.0); }`
});
const ABSCHLUSS = () => new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uStaerke: { value: 0.7 }, uTint: { value: new THREE.Color('#ffd9a8') }, uBelichtung: { value: 1 } },
  vertexShader: QUAD_VS, toneMapped: false,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uStaerke, uBelichtung; uniform vec3 uTint; varying vec2 vUv; ${TILT_GLSL}
    vec3 rrt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c) {
      const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      c *= uBelichtung / 0.6; return clamp(O * rrt(I * c), 0.0, 1.0); }
    vec3 srgb(vec3 c) { return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
    void main(){
      float r = tiltR(vUv, uStaerke, uRes);
      vec3 c = r < 0.05 ? texture2D(tDiffuse, vUv).rgb : tiltBlur(tDiffuse, vUv, vec2(0.0, r) / uRes);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, c * uTint, smoothstep(0.3, 1.0, l) * 0.35);
      c = mix(c, c * vec3(0.85, 0.9, 1.1), (1.0 - smoothstep(0.0, 0.4, l)) * 0.3);
      c = mix(vec3(l), c, 1.12); vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.55;
      gl_FragColor = vec4(srgb(aces(max(c, 0.0))), 1.0); }`
});
export class Nachbearbeitung implements Post {
  comp: EffectComposer; private bloom: UnrealBloomPass; private tiltH: ShaderPass; private ende: ShaderPass; private tiltStaerke: number;
  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, tilt = 0.5) {
    this.tiltStaerke = tilt;
    this.comp = new EffectComposer(renderer);
    this.comp.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), 0.3, 0.55, 1.0); this.comp.addPass(this.bloom);
    this.tiltH = new ShaderPass(TILT()); this.tiltH.uniforms.uStaerke.value = tilt; this.comp.addPass(this.tiltH);
    this.ende = new ShaderPass(ABSCHLUSS()); this.ende.uniforms.uStaerke.value = tilt; this.comp.addPass(this.ende);
  }
  /** Tilt-Shift an oder aus (mittlere Grafikstufe ohne) */
  set tilt(an: boolean) { this.tiltH.enabled = an; this.ende.uniforms.uStaerke.value = an ? this.tiltStaerke : 0; }
  groesse(w: number, h: number): void {
    const pr = this.renderer.getPixelRatio();
    this.comp.setPixelRatio(pr); this.comp.setSize(w, h); this.bloom.resolution.set(w * pr, h * pr);
    this.tiltH.uniforms.uRes.value.set(w * pr, h * pr); this.ende.uniforms.uRes.value.set(w * pr, h * pr);
  }
  setze(b: Beleuchtung): void { this.bloom.strength = b.werte.bloom; this.ende.uniforms.uTint.value.copy(b.werte.tint); this.ende.uniforms.uBelichtung.value = b.werte.exp; this.renderer.toneMappingExposure = b.werte.exp; }
  render(): void { this.comp.render(); }
}
function webglRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  return r;
}
export type Darstellung = 'auto' | 'webgpu' | 'webgl';
const RUECKFALL = 'runeboom-webgl-rueckfall';
/**
 * Zeichner anlegen: WebGPU, wenn gewünscht und vom Gerät unterstützt, sonst WebGL.
 * Bei WebGPU werden alle eigenen Materialien auf Knoten umgestellt (knoten.ts, erst dann geladen).
 */
export async function neuerRenderer(canvas: HTMLCanvasElement, wunsch: Darstellung = 'auto', beiVerlust?: () => void): Promise<{ renderer: THREE.WebGLRenderer; weg: 'WebGPU' | 'WebGL' }> {
  let rueckfall = false; try { rueckfall = sessionStorage.getItem(RUECKFALL) === '1'; } catch { /* */ }
  if (rueckfall && wunsch !== 'webgpu') wunsch = 'webgl';
  const nav = navigator as Navigator & { gpu?: { requestAdapter(o?: object): Promise<unknown> } };
  if ((wunsch as string) === 'knoten-webgl') { // nur für Tests: Knoten-Materialien über WebGL zeichnen
    const k = await import('./knoten.ts'); return { renderer: await k.webgpuRenderer(canvas, true), weg: 'WebGPU' };
  }
  if (wunsch !== 'webgl' && nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const k = await import('./knoten.ts');
        // geht das Gerät verloren (Treiber, Ruhezustand), einmal mit WebGL neu starten
        const r = await k.webgpuRenderer(canvas, false, () => { try { sessionStorage.setItem(RUECKFALL, '1'); } catch { /* */ } beiVerlust?.(); location.reload(); });
        if (r) return { renderer: r, weg: 'WebGPU' };
      }
    } catch (e) { console.warn('WebGPU nicht verfügbar, nehme WebGL', e); }
  }
  return { renderer: webglRenderer(canvas), weg: 'WebGL' };
}
