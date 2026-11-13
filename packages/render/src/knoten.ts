import * as THREE from 'three/webgpu';
import {
  Fn, If, Discard, float, vec2, vec3, vec4, uniform, texture, attribute, varying, positionWorld, positionLocal, diffuseColor,
  floor, fract, sin, dot, mix, smoothstep, step, abs, clamp, max, pow, length, exp, normalize, select, uv, pass, convertToTexture, screenSize
} from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { WR } from '@runeboom/core';
import { FABRIK, LICHT_U, WASSER_U, ZEIT, lichtTex, materialienNeu, type NebelU, type Post, type Beleuchtung } from './grafik.ts';

/**
 * WebGPU-Fassung aller eigenen Materialien und der Nachbearbeitung, geschrieben in Three.js-Knoten (TSL).
 * Wird nur geladen, wenn WebGPU genutzt wird; dieselben Werte (Zeit, Nacht, Farben, Lichtkarte) wie bei WebGL.
 */
type N = any; // TSL-Knoten sind in den Typen sehr verschachtelt

// ---------- gemeinsame Werte ----------
const uZeit = uniform(0).onFrameUpdate(() => ZEIT.value);
const uNacht = uniform(0).onFrameUpdate(() => LICHT_U.uNacht.value);
const uLichtFarbe = uniform(LICHT_U.uLichtFarbe.value);
const weltUV = (p: N) => p.xz.add(WR).div(2 * WR);
const lichtWert = () => texture(lichtTex, weltUV(positionWorld)).r;

// ---------- Rauschen wie NOISE_GLSL ----------
const h1 = Fn(([p]: N[]) => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453))).setLayout({ name: 'h1', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const h2 = Fn(([p]: N[]) => { const q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(q).mul(43758.5453)); }).setLayout({ name: 'h2', type: 'vec2', inputs: [{ name: 'p', type: 'vec2' }] });
const rausch = Fn(([p]: N[]) => {
  const i: N = floor(p), f0: N = fract(p), f: N = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(h1(i), h1(i.add(vec2(1, 0))), f.x), mix(h1(i.add(vec2(0, 1))), h1(i.add(vec2(1, 1))), f.x), f.y);
}).setLayout({ name: 'rausch', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const fbm = Fn(([p0]: N[]) => {
  const s = float(0).toVar(), p = vec2(p0).toVar();
  for (const a of [0.5, 0.25, 0.125, 0.0625]) { s.addAssign(rausch(p).mul(a)); p.mulAssign(2.03); }
  return s;
}).setLayout({ name: 'fbm', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

// ---------- Materialien ----------
function licht(p: THREE.MeshStandardMaterialParameters, staerke = 1.7, maske?: THREE.Texture): THREE.Material {
  const m = new THREE.MeshStandardNodeMaterial(p as any);
  const lm = lichtWert();
  m.emissiveNode = diffuseColor.rgb.mul(uLichtFarbe).mul(lm.mul(lm)).mul(uNacht).mul(staerke);
  if (maske) { m.opacityNode = select(texture(maske, weltUV(positionWorld)).r.greaterThan(0.5), float(0), float(1)); m.alphaTest = 0.5; }
  return m;
}
function wasser(): THREE.Material {
  const m = new THREE.MeshBasicNodeMaterial({ fog: false });
  const W = WASSER_U;
  const uTief = uniform(W.uTief.value), uHell = uniform(W.uHell.value), uFunkeln = uniform(W.uFunkeln.value);
  m.colorNode = Fn(() => {
    const p = floor(positionWorld.xz.mul(8)).div(8), t = uZeit;
    const w = fbm(p.mul(0.7).add(vec2(t.mul(0.09), t.mul(0.05)))).add(fbm(p.mul(1.8).sub(vec2(t.mul(0.07), t.mul(-0.11)))).mul(0.5));
    const c = mix(uTief, uHell, smoothstep(0.62, 1.12, w)).toVar();
    const funk = step(0.965, h1(floor(positionWorld.xz.mul(8)).add(floor(t.mul(1.5)).mul(7.13))));
    c.addAssign(uFunkeln.mul(funk).mul(smoothstep(0.75, 1.05, w)).mul(0.9));
    const lm = lichtWert(); c.addAssign(uLichtFarbe.mul(lm.mul(lm)).mul(uNacht).mul(0.35));
    return vec4(c, 1);
  })();
  return m;
}
function lava(): THREE.Material {
  const m = new THREE.MeshBasicNodeMaterial({ fog: false });
  const zellen = Fn(([p, t]: N[]) => {
    const i = floor(p), f = fract(p), d1 = float(8).toVar(), d2 = float(8).toVar();
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const g = vec2(x, y), o = sin(t.mul(0.35).add(h2(i.add(g)).mul(6.2831))).mul(0.4).add(0.5), d = length(g.add(o).sub(f)).toVar();
      If(d.lessThan(d1), () => { d2.assign(d1); d1.assign(d); }).ElseIf(d.lessThan(d2), () => { d2.assign(d); });
    }
    return d2.sub(d1);
  }).setLayout({ name: 'zellen', type: 'float', inputs: [{ name: 'p', type: 'vec2' }, { name: 't', type: 'float' }] });
  m.colorNode = Fn(() => {
    const p = floor(positionWorld.xz.mul(8)).div(8).mul(0.5), t = uZeit;
    const q = p.mul(0.9).add(vec2(fbm(p.mul(0.6).add(t.mul(0.06))), fbm(p.mul(0.6).sub(t.mul(0.05)).add(3.7))).mul(1.4)).toVar();
    const riss = zellen(q.mul(1.3), t).toVar(), adern = fbm(q.mul(2.2).add(t.mul(0.15))).toVar();
    const see = smoothstep(0.5, 0.68, fbm(q.mul(0.7).add(vec2(t.mul(0.04), t.mul(-0.03)))));
    const hitze0 = max(max(smoothstep(0.42, 0.04, riss), see.mul(0.9)), smoothstep(0.64, 0.9, adern).mul(0.6));
    const hitze = clamp(hitze0.mul(sin(t.mul(2.2).add(adern.mul(8)).add(p.x.mul(1.7))).mul(0.15).add(0.85)), 0, 1).toVar();
    const kruste = mix(vec3(0.07, 0.02, 0.015), vec3(0.22, 0.05, 0.02), fbm(q.mul(4))).add(vec3(0.35, 0.06, 0).mul(smoothstep(0.7, 0.2, riss)).mul(0.6));
    const glut = mix(vec3(0.75, 0.1, 0.02), vec3(1, 0.38, 0.05), smoothstep(0.25, 0.65, hitze)).toVar();
    glut.assign(mix(glut, vec3(1, 0.72, 0.22), smoothstep(0.72, 0.95, hitze)));
    glut.assign(mix(glut, vec3(1, 0.95, 0.75), smoothstep(0.97, 1, hitze)));
    return vec4(mix(kruste.mul(1.4), glut.mul(1.7), smoothstep(0.12, 0.45, hitze)).add(vec3(0.15, 0.03, 0)), 1);
  })();
  return m;
}
function himmel(u: { uTop: { value: THREE.Color }; uBot: { value: THREE.Color }; uFog: { value: THREE.Color } }): THREE.Material {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  const top = uniform(u.uTop.value), bot = uniform(u.uBot.value), fog = uniform(u.uFog.value);
  const h = normalize(positionLocal).y;
  m.colorNode = select(h.greaterThan(0), mix(bot, top, smoothstep(0, 0.55, h)), mix(bot, fog, smoothstep(0, 0.25, h.negate())));
  return m;
}
function nebel(u: NebelU, lage: number, zahl: number): THREE.Material {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const farbe = uniform(u.uFarbe.value), dichte = uniform(0).onFrameUpdate(() => u.uDichte.value);
  const land = varying(attribute('aLand', 'float'));
  const gross = varying(fbm(positionWorld.xz.mul(0.0065).add(vec2(uZeit.mul(0.006), uZeit.mul(-0.004)))));
  m.colorNode = Fn(() => {
    const n = float(0).toVar(), a = float(0).toVar();
    If(land.lessThan(0.01), () => { Discard(); });
    const frei = smoothstep(0.2, 0.8, texture(u.uMaske.value, weltUV(positionWorld)).r);
    If(frei.greaterThan(0.995), () => { Discard(); });
    const p = positionWorld.xz.mul(0.03).add(vec2(uZeit.mul(0.012 * (1 + lage * 0.3)), uZeit.mul(0.007))).add(lage * 3.7);
    n.assign(fbm(p));
    const wechsel = mix(0.4, 1.25, smoothstep(0.32, 0.72, gross)).mul(sin(uZeit.mul(0.21).add(gross.mul(9))).mul(0.12).add(0.88));
    const a0 = dichte.mul(n.mul(0.9).add(0.45)).mul(wechsel).mul(frei.oneMinus()).mul(land).mul(1 - lage * 0.06);
    a.assign(pow(clamp(a0, 0, 0.98).oneMinus(), zahl).oneMinus());
    If(a.lessThan(0.01), () => { Discard(); });
    return vec4(farbe.mul(n.mul(0.18).add(0.9)), a);
  })();
  return m;
}
function wegLeuchten(u: { uZeit: { value: number }; uStaerke: { value: number } }): THREE.Material {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const st = uniform(0).onFrameUpdate(() => u.uStaerke.value), ph = attribute('aPhase', 'float');
  m.colorNode = vec3(1.6, 0.72, 0.4);
  m.opacityNode = smoothstep(0.3, 1, sin(ph.mul(0.9).sub(uZeit.mul(5))).mul(0.5).add(0.5)).mul(st);
  return m;
}
function kegel(): THREE.Material {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  m.colorNode = vec3(1, 0.9, 0.65);
  m.opacityNode = clamp(positionLocal.z, 0, 1).oneMinus().mul(0.05);
  return m;
}

// ---------- Nachbearbeitung ----------
class NachbearbeitungGPU implements Post {
  private pipe: THREE.RenderPipeline; private bl: any;
  private uStaerke = uniform(0.5); private uTint = uniform(new THREE.Color('#ffd9a8'));
  constructor(private renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, private tiltWert: number) {
    this.uStaerke.value = tiltWert;
    const szene = pass(scene, camera), farbe = szene.getTextureNode('output');
    this.bl = bloom(farbe, 0.3, 0.55, 1.0);
    const st = this.uStaerke;
    const tiltR = (q: N) => smoothstep(0.45, 1, abs(q.y.sub(0.5)).mul(2)).mul(st).mul(screenSize.y).div(300);
    const blur = (tex: N, q: N, schritt: N) => {
      const c = vec3(0).toVar(); let ws = 0;
      for (let i = -4; i <= 4; i++) { const w = Math.exp(-(i * i) / 6); c.addAssign(tex.sample(q.add(schritt.mul(i))).rgb.mul(w)); ws += w; }
      return c.div(ws);
    };
    const summe = convertToTexture(vec4(farbe.rgb.add(this.bl.rgb), 1));
    const waag = convertToTexture(Fn(() => { const q = uv(), r = tiltR(q); return vec4(select(r.lessThan(0.05), summe.sample(q).rgb, blur(summe, q, vec2(r, 0).div(screenSize))), 1); })());
    const tint = this.uTint;
    this.pipe = new THREE.RenderPipeline(renderer, Fn(() => {
      const q = uv(), r = tiltR(q);
      const c = vec3(select(r.lessThan(0.05), waag.sample(q).rgb, blur(waag, q, vec2(0, r).div(screenSize)))).toVar();
      const l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c.assign(mix(c, c.mul(tint), smoothstep(0.3, 1, l).mul(0.35)));
      c.assign(mix(c, c.mul(vec3(0.85, 0.9, 1.1)), smoothstep(0, 0.4, l).oneMinus().mul(0.3)));
      c.assign(mix(vec3(l), c, 1.12));
      const d = q.sub(0.5); c.mulAssign(dot(d, d).mul(-0.55).add(1));
      return vec4(max(c, 0), 1);
    })());
  }
  set tilt(an: boolean) { this.uStaerke.value = an ? this.tiltWert : 0; }
  groesse(): void { /* Knoten folgen der Leinwand selbst */ }
  setze(b: Beleuchtung): void { this.bl.strength.value = b.werte.bloom; this.uTint.value.copy(b.werte.tint); this.renderer.toneMappingExposure = b.werte.exp; }
  render(): void { this.pipe.render(); }
}

/** WebGPU-Zeichner anlegen und alle Materialien umstellen; null, wenn das Gerät es nicht kann */
export async function webgpuRenderer(canvas: HTMLCanvasElement, ueberWebGL = false, beiVerlust?: () => void): Promise<any> {
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, powerPreference: 'high-performance', forceWebGL: ueberWebGL });
  if (beiVerlust) r.onDeviceLost = (info: unknown) => { console.error('WebGPU-Gerät verloren', info); beiVerlust(); };
  await r.init();
  if (!ueberWebGL && !(r.backend as any).isWebGPUBackend) { r.dispose(); return null; }
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  Object.assign(FABRIK, {
    gpu: true, licht, wasser, lava, himmel, nebel, wegLeuchten, kegel,
    post: (_r: unknown, scene: THREE.Scene, camera: THREE.Camera, tilt: number) => new NachbearbeitungGPU(r, scene, camera, tilt)
  });
  materialienNeu();
  return r;
}
void exp; void step;
