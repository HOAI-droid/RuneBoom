import * as THREE from 'three';
import { GEBAEUDE, type Spiel, type Geb, type GebTyp, type GegTyp, type Ereignis, type Res, hoehe } from '@runeboom/core';
import { Grid, meshVoxels } from './voxel.ts';
import { geometrie, gridZuGruppe, SOLID, GLOW, LAMP, weg, ZEIT } from './grafik.ts';
import {
  hauptgebaeude, werkstatt, turmHolz, turmAlchemie, leuchtFackel, leuchtFeuer, haus, holzstapel, steinbruch, kristallmine, mauerStueck,
  moorwicht, wolf, troll, drachling, nebelrochen, figur8, turmUhrwerk, turmKristall,
  turmSchuetzen, turmKanone, turmBlitz, lichtFeuerKlein, lichtSpiegelKlein, lichtKristallKlein, turmFusion, ruine, trollPanzer, drachenFeuer,
  wohnhaus, bauernhof, fischerhuette, stufenSchmuck, mauerSchaden, burg, aschegeist, steinwerfer, schamane, schildwaechter, rissfuerst, pfeilHoch
} from './modelle.ts';
import { rng, type Ruine } from '@runeboom/core';

// ---------- Modelle der Gebäude (halbe Voxel, Mitte bei 0) ----------
const modellCache = new Map<string, THREE.Group>();
function gebModell(typ: GebTyp, stahl: boolean, zweigId?: string, stufe = 1, schaden = 0): THREE.Group {
  const zw = GEBAEUDE[typ].zweige?.findIndex((z) => z.id === zweigId) ?? -1;
  const key = typ + (stahl ? '+' : '') + zw + '/' + stufe + '/' + schaden;
  let m = modellCache.get(key);
  if (!m) {
    const g = new Grid();
    if (typ === 'haupt') burg(g, stufe);
    if (typ === 'haus') wohnhaus(g, stufe);
    if (typ === 'hof') bauernhof(g, stufe);
    if (typ === 'fischer') fischerhuette(g, stufe);
    if (typ === 'schuetzenturm') turmSchuetzen(g, 0, 0, 0, zw);
    if (typ === 'repetierer') turmUhrwerk(g, 0, 0, 0);
    if (typ === 'laser') turmKristall(g, 0, 0, 0);
    if (typ === 'kanone') turmKanone(g, 0, 0, 0, zw);
    if (typ === 'blitzspule') turmBlitz(g, 0, 0, 0, zw);
    if (typ === 'scheinwerfer') lichtSpiegelKlein(g, 0, 0, 0);
    if (typ === 'kristallfeuer') lichtKristallKlein(g, 0, 0, 0);
    if (GEBAEUDE[typ].fusion) turmFusion(g, typ);
    if (typ === 'werkstatt') werkstatt(g, 0, 0, 0, 0);
    if (typ === 'wachturm') turmHolz(g, 0, 0, 0);
    if (typ === 'feuertopf') turmAlchemie(g, 0, 0, 0);
    if (typ === 'fackel') leuchtFackel(g, 0, 0, 0);
    if (typ === 'leuchtfeuer') lichtFeuerKlein(g, 0, 0, 0);
    if (typ === 'holz') { haus(g, 0, 0, -0.5, 0, '#cdb894', '#7a3426'); holzstapel(g, -4, 0, -6); }
    if (typ === 'stein') steinbruch(g, 0, 0, 0);
    if (typ === 'kristall') kristallmine(g, 0, 0, 0);
    if (typ === 'mauer') { mauerStueck(g, 0, 0, 0, stahl); mauerSchaden(g, schaden); }
    if (typ !== 'haupt' && typ !== 'mauer' && typ !== 'haus' && typ !== 'hof' && typ !== 'fischer') stufenSchmuck(g, GEBAEUDE[typ].w, GEBAEUDE[typ].d, stufe);
    m = gridZuGruppe(g, 0.5);
    modellCache.set(key, m);
  }
  return m;
}
export function gebMitte(g: { x: number; z: number; w: number; d: number }): [number, number] { return [g.x + g.w / 2, g.z + g.d / 2]; }
const GEB_HOEHE: Partial<Record<GebTyp, number>> = { haupt: 23, werkstatt: 9, haus: 9, hof: 7, fischer: 7, wachturm: 18, feuertopf: 14, fackel: 10, leuchtfeuer: 10, scheinwerfer: 11, kristallfeuer: 14, mauer: 6.5, holz: 8, stein: 7, kristall: 6,
  schuetzenturm: 16, repetierer: 18, laser: 20, kanone: 12, blitzspule: 15, brandturm: 19, leuchtpfeil: 21, doppelturm: 18, glutmoerser: 13 };
/** Höhe, aus der Strahlen und Blitze kommen */
function spitze(g: Geb): number { return g.y + (GEB_HOEHE[g.typ] || 10) - 1; }
const WESEN_HOEHE: Record<GegTyp, number> = { moorwicht: 2.8, wolf: 3.1, troll: 5.6, drachling: 2.2, rochen: 1.6, aschegeist: 3, steinwerfer: 7, schamane: 4.4, schildwaechter: 6, rissfuerst: 16 };
/** Schadensstufe einer Mauer für das Modell */
const mauerStufe = (g: Geb) => (g.hp > g.max * 0.66 ? 0 : g.hp > g.max * 0.33 ? 1 : 2);

// ---------- Instanzen für viele gleiche Dinge ----------
class Schar {
  meshes: THREE.InstancedMesh[] = [];
  n = 0;
  constructor(grid: Grid, readonly scale: number, readonly max: number, scene: THREE.Scene, schatten = true) {
    meshVoxels(grid, grid.m.values()).forEach((T, i) => {
      if (!T) return;
      const m = new THREE.InstancedMesh(geometrie(T), [SOLID, GLOW, LAMP][i], max);
      m.castShadow = schatten && i === 0; m.receiveShadow = i === 0; m.frustumCulled = false; m.count = 0;
      this.meshes.push(m); scene.add(m);
    });
  }
  private mat = new THREE.Matrix4(); private q = new THREE.Quaternion(); private s = new THREE.Vector3(); private p = new THREE.Vector3(); private e = new THREE.Euler(0, 0, 0, 'YXZ');
  beginn() { this.n = 0; }
  setze(x: number, y: number, z: number, ry: number, rz = 0, rx = 0, groesse = 1): void {
    if (this.n >= this.max) return;
    this.e.set(rx, ry, rz); this.q.setFromEuler(this.e); this.s.setScalar(this.scale * groesse); this.p.set(x, y, z);
    this.mat.compose(this.p, this.q, this.s);
    for (const m of this.meshes) m.setMatrixAt(this.n, this.mat);
    this.n++;
  }
  ende(): void { for (const m of this.meshes) { m.count = this.n; m.instanceMatrix.needsUpdate = true; } }
}

/** Trümmer, Funken und Rauch: kleine Würfel */
class Teilchen {
  private fest: THREE.InstancedMesh; private funken: THREE.InstancedMesh; private rauch: THREE.InstancedMesh;
  private teile: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; dauer: number; s: number; art: 0 | 1 | 2; farbe: THREE.Color }[] = [];
  private mat = new THREE.Matrix4();
  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.fest = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), 2000);
    this.funken = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), 2000);
    this.rauch = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }), 800);
    for (const m of [this.fest, this.funken, this.rauch]) { m.count = 0; m.frustumCulled = false; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3), 3); scene.add(m); }
    this.fest.castShadow = true;
  }
  /** art 0 = Trümmer, 1 = Funke (leuchtet), 2 = Rauch (steigt) */
  wurf(x: number, y: number, z: number, n: number, farben: string[], kraft = 4, art: 0 | 1 | 2 = 0, s = 0.22): void {
    for (let i = 0; i < n; i++) {
      if (this.teile.length > 2600) this.teile.shift();
      const a = Math.random() * Math.PI * 2, v = kraft * (0.4 + Math.random());
      const c = new THREE.Color(farben[i % farben.length]); if (art === 1) c.multiplyScalar(2.2);
      this.teile.push({ x, y, z, vx: Math.cos(a) * v * (art === 2 ? 0.15 : 1), vy: art === 2 ? 0.8 + Math.random() : kraft * (0.6 + Math.random()), vz: Math.sin(a) * v * (art === 2 ? 0.15 : 1),
        t: 0, dauer: art === 1 ? 0.35 + Math.random() * 0.4 : art === 2 ? 1.6 + Math.random() * 1.2 : 1.2 + Math.random() * 0.8, s: s * (0.6 + Math.random() * 0.8), art, farbe: c });
    }
  }
  schritt(dt: number): void {
    const n = [0, 0, 0], meshes = [this.fest, this.funken, this.rauch];
    for (const p of this.teile) {
      p.t += dt;
      if (p.art === 2) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy *= 0.99; }
      else {
        p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const boden = hoehe(p.x, p.z); if (p.y < boden + p.s / 2) { p.y = boden + p.s / 2; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      }
      const f = p.t / p.dauer, k = p.art === 2 ? (0.6 + f * 1.6) * (1 - f) : Math.max(0, 1 - Math.max(0, f - 0.6) / 0.4), s = p.s * k;
      this.mat.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      const m = meshes[p.art], i = n[p.art]++;
      if (i >= m.instanceMatrix.count) continue;
      m.setMatrixAt(i, this.mat); m.setColorAt(i, p.farbe);
    }
    this.teile = this.teile.filter((p) => p.t < p.dauer);
    meshes.forEach((m, i) => { m.count = Math.min(n[i], m.instanceMatrix.count); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }
}

/** Lebensbalken: zwei Schichten flacher Rechtecke, immer zur Kamera gedreht */
class Balken {
  private grund: THREE.InstancedMesh; private fuell: THREE.InstancedMesh; private n = 0;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private p = new THREE.Vector3(); private s = new THREE.Vector3(); private off = new THREE.Vector3(); private c = new THREE.Color();
  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.grund = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#10141c', transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }), 600);
    this.fuell = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false, depthWrite: false }), 600);
    for (const b of [this.grund, this.fuell]) { b.count = 0; b.frustumCulled = false; b.renderOrder = 40; scene.add(b); }
    this.fuell.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3);
  }
  beginn(cam: THREE.Camera) { this.n = 0; this.q.copy(cam.quaternion); }
  setze(x: number, y: number, z: number, breite: number, anteil: number, farbe: string): void {
    if (this.n >= 600) return;
    const i = this.n++, h = Math.max(0.16, breite * 0.11);
    this.p.set(x, y, z); this.s.set(breite + 0.12, h + 0.12, 1); this.m.compose(this.p, this.q, this.s); this.grund.setMatrixAt(i, this.m);
    const w = Math.max(0.001, breite * anteil); this.off.set(-(breite - w) / 2, 0, 0.01).applyQuaternion(this.q);
    this.p.add(this.off); this.s.set(w, h, 1); this.m.compose(this.p, this.q, this.s); this.fuell.setMatrixAt(i, this.m); this.fuell.setColorAt(i, this.c.set(farbe).multiplyScalar(1.3));
  }
  ende(): void { for (const b of [this.grund, this.fuell]) { b.count = this.n; b.instanceMatrix.needsUpdate = true; } if (this.fuell.instanceColor) this.fuell.instanceColor.needsUpdate = true; }
}

/** Weg der Welle: wandernde Leuchtstriche am Boden */
class Wegvorschau {
  private mesh: THREE.InstancedMesh; private phase: THREE.InstancedBufferAttribute; private version = -1;
  readonly u = { uZeit: ZEIT, uStaerke: { value: 0 } };
  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(0.5, 1.0); geo.rotateX(-Math.PI / 2);
    this.phase = new THREE.InstancedBufferAttribute(new Float32Array(2400), 1); geo.setAttribute('aPhase', this.phase);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aPhase; varying float vP; void main(){ vP = aPhase; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uZeit, uStaerke; varying float vP; void main(){ float a = 0.5 + 0.5 * sin(vP * 0.9 - uZeit * 5.0); a = smoothstep(0.3, 1.0, a); gl_FragColor = vec4(vec3(1.0, 0.45, 0.25) * 1.6, a * uStaerke); }'
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, 2400); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 20; scene.add(this.mesh);
  }
  setze(spiel: Spiel, staerke: number): void {
    this.u.uStaerke.value = staerke;
    this.mesh.visible = staerke > 0.01;
    if (!this.mesh.visible) return;
    const wege = spiel.wegVorschau(); if (spiel.feldVersion === this.version) return;
    this.version = spiel.feldVersion;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1); let n = 0;
    for (const w of wege) for (let i = 1; i < w.length && n < 2400; i++) {
      const [ax, az] = w[i - 1], [bx, bz] = w[i], x = (ax + bx) / 2, z = (az + bz) / 2;
      q.setFromAxisAngle(up, Math.atan2(bx - ax, bz - az));
      m.compose(new THREE.Vector3(x, hoehe(x, z) + 0.08, z), q, one); this.mesh.setMatrixAt(n, m); this.phase.setX(n, i); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; this.phase.needsUpdate = true;
  }
}

const FARBEN: Record<GegTyp, string[]> = {
  moorwicht: ['#6f8a4a', '#5a4630', '#4f6136'], wolf: ['#2f2a3d', '#251f33', '#a070ff'], troll: ['#6f7a5e', '#4f7a3a', '#8c867f'], drachling: ['#9e2b25', '#d9813a', '#7a2420'], rochen: ['#3b4f6b', '#2c3b52', '#9fe7ff'],
  aschegeist: ['#3a3634', '#5a5048', '#ff7a2a'], steinwerfer: ['#7a6e5e', '#8c867f', '#5d5448'], schamane: ['#556b3a', '#7dff6a', '#e8dcc0'], schildwaechter: ['#5e4128', '#7a5532', '#4f8a3c'], rissfuerst: ['#2d2838', '#b07cff', '#efe2ff']
};
const SPAENE: Record<Res, string[]> = { holz: ['#c9a36a', '#8a6340', '#b48a5a'], stein: ['#a8a29a', '#8c867f'], kristall: ['#9fe7ff', '#d8fdff'], nahrung: ['#c9b04a', '#8fae4a', '#e0c060'] };

/** Alles, was sich bewegt oder gebaut wird: Gebäude, Wesen, Arbeiter, Bogenschützen, Geschosse, Teilchen, Balken, Vorschau. */
export class Objekte {
  private gebaeude = new Map<number, THREE.Group>();
  private wesen: Record<string, Schar>;
  private arbeiter: Record<Res, Schar>;
  private baumeister: Schar; private schuetzen: Schar;
  private traglast: Record<Res, THREE.InstancedMesh>;
  private pfeile: THREE.InstancedMesh; private steckpfeile: THREE.InstancedMesh; private toepfe: THREE.InstancedMesh; private brand: THREE.InstancedMesh;
  private steckend: { m: THREE.Matrix4; t: number }[] = []; private flecken: { x: number; y: number; z: number; t: number }[] = [];
  private teilchen: Teilchen; private balken: Balken; private weg: Wegvorschau;
  private vorschau: THREE.Group | null = null; private vorschauTyp = '';
  private vorschauMat = { ok: new THREE.MeshBasicMaterial({ color: '#9fe0a0', transparent: true, opacity: 0.45, depthWrite: false }), nein: new THREE.MeshBasicMaterial({ color: '#ff7a6a', transparent: true, opacity: 0.45, depthWrite: false }) };
  private ring: THREE.Mesh; private lichtRing: THREE.Mesh; private auswahl: THREE.Mesh;
  private wackeln = new Map<number, number>(); private rueckstoss = new Map<number, number>();
  private zeit = 0; private gewaehlt: Geb | null = null;
  private ruinen = new Map<number, THREE.Group>();
  private buergerSchar: Schar[]; private pfeilSchar: Schar; private steine: THREE.InstancedMesh;
  private buerger: { x: number; z: number; ziel: [number, number]; warte: number; art: number; tempo: number; richtung: number }[] = [];
  /** goldene Pfeile über verbesserbaren Gebäuden zeigen */
  zeigePfeile = true;
  private pfeilListe: Geb[] = []; private pfeilZeit = 0; private mauerStufen = new Map<number, number>();
  private feuer: Schar; private panzer: Schar;
  private strahlen: THREE.InstancedMesh; private blitze: { a: THREE.Vector3; b: THREE.Vector3; t: number }[] = []; private blitzMesh: THREE.InstancedMesh;
  private schild: THREE.Mesh; private kegel: THREE.Mesh[] = [];

  constructor(private scene: THREE.Scene, private spiel: Spiel) {
    const mk = (fn: (g: Grid) => void) => { const g = new Grid(); fn(g); return g; };
    this.wesen = {
      moorwicht: new Schar(mk((g) => moorwicht(g, 0, 0, 0, 0)), 0.2, 500, scene),
      wolf: new Schar(mk((g) => wolf(g, 0, 0, 0, 0)), 0.22, 150, scene),
      wolfDunkel: new Schar(mk((g) => wolf(g, 0, 0, 0, 0, true)), 0.22, 150, scene),
      troll: new Schar(mk((g) => troll(g, 0, 0, 0, 0)), 0.3, 60, scene),
      drachling: new Schar(mk((g) => drachling(g)), 0.3, 60, scene),
      rochen: new Schar(mk((g) => nebelrochen(g)), 0.3, 40, scene),
      aschegeist: new Schar(mk((g) => aschegeist(g)), 0.25, 60, scene),
      steinwerfer: new Schar(mk((g) => steinwerfer(g)), 0.3, 60, scene),
      schamane: new Schar(mk((g) => schamane(g)), 0.25, 40, scene),
      schildwaechter: new Schar(mk((g) => schildwaechter(g)), 0.28, 60, scene),
      rissfuerst: new Schar(mk((g) => rissfuerst(g)), 0.45, 6, scene)
    };
    const leute = (kleid: string, werkzeug: string, haar: string) => mk((g) => figur8(g, 0, 0, 0, 0, { hose: '#3d3328', kleid, haut: '#e0b48c', haar, werkzeug }));
    this.arbeiter = { holz: new Schar(leute('#5d7f9e', 'axt', '#5a3d24'), 0.125, 200, scene), stein: new Schar(leute('#8a4d3a', 'hacke', '#2e2620'), 0.125, 200, scene), kristall: new Schar(leute('#6b5a8a', 'hacke', '#a0703a'), 0.125, 100, scene),
      nahrung: new Schar(mk((g) => figur8(g, 0, 0, 0, 0, { hose: '#5a4a30', kleid: '#8a9a4a', haut: '#e0b48c', helm: '#d9c27a', werkzeug: 'sack' })), 0.125, 200, scene) };
    this.buergerSchar = [
      new Schar(mk((g) => figur8(g, 0, 0, 0, 0, { hose: '#3d3328', kleid: '#9c5f6a', haut: '#e8c09a', haar: '#3a2a1e', schuerze: '#d4c4a0' })), 0.125, 60, scene),
      new Schar(mk((g) => figur8(g, 0, 0, 0, 0, { hose: '#2f3a4a', kleid: '#4f6b8a', haut: '#d9a77c', haar: '#8a5a2a' })), 0.125, 60, scene),
      new Schar(mk((g) => figur8(g, 0, 0, 0, 0, { hose: '#3d3328', kleid: '#b8733f', haut: '#c99a72', haar: '#d9c27a', bart: '#d9c27a' })), 0.125, 60, scene)
    ];
    this.pfeilSchar = new Schar(mk((g) => pfeilHoch(g)), 0.22, 120, scene, false);
    this.baumeister = new Schar(mk((g) => figur8(g, 0, 0, 0, 0, { hose: '#3a3a44', kleid: '#b8733f', haut: '#d9a77c', helm: '#9aa0a6', werkzeug: 'hacke', schuerze: '#5a3d24' })), 0.125, 80, scene);
    this.schuetzen = new Schar(mk((g) => figur8(g, 0, 0, 0, 0, { hose: '#3d3328', kleid: '#4f6b3a', haut: '#e0b48c', kapuze: '#3f5a30' })), 0.125, 120, scene);
    const box = (x: number, y: number, z: number, farbe: string, leucht = false) => new THREE.InstancedMesh(new THREE.BoxGeometry(x, y, z), leucht ? new THREE.MeshBasicMaterial({ color: new THREE.Color(farbe).multiplyScalar(1.6), toneMapped: false }) : new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.9 }), 200);
    this.traglast = { holz: box(0.28, 0.28, 1.1, '#8a6038'), stein: box(0.5, 0.42, 0.5, '#a8a29a'), kristall: box(0.3, 0.5, 0.3, '#7fe9ff', true), nahrung: box(0.6, 0.45, 0.6, '#c9a04a') };
    // Pfeile: hell und leicht leuchtend, damit man sie auch nachts verfolgen kann
    this.pfeile = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 1.5), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe9c0').multiplyScalar(1.25), toneMapped: false }), 500);
    this.steckpfeile = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 1.2), new THREE.MeshStandardMaterial({ color: '#c9b48f' }), 300);
    this.steine = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: '#8c867f', roughness: 1, flatShading: true }), 100);
    this.steine.count = 0; this.steine.frustumCulled = false; this.steine.castShadow = true; scene.add(this.steine);
    this.toepfe = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3c').multiplyScalar(2), toneMapped: false }), 100);
    const fg = new THREE.CircleGeometry(1, 20); fg.rotateX(-Math.PI / 2);
    this.brand = new THREE.InstancedMesh(fg, new THREE.MeshBasicMaterial({ color: '#1a1410', transparent: true, opacity: 0.55, depthWrite: false }), 80);
    for (const m of [...Object.values(this.traglast), this.pfeile, this.steckpfeile, this.toepfe, this.brand]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
    this.teilchen = new Teilchen(scene); this.balken = new Balken(scene); this.weg = new Wegvorschau(scene);
    const ringGeo = new THREE.RingGeometry(0.97, 1, 96); ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
    this.lichtRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffb36a', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }));
    const sel = new THREE.PlaneGeometry(1, 1); sel.rotateX(-Math.PI / 2);
    this.auswahl = new THREE.Mesh(sel, new THREE.MeshBasicMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.22, depthWrite: false }));
    for (const m of [this.ring, this.lichtRing, this.auswahl]) { m.visible = false; m.renderOrder = 30; scene.add(m); }
    for (const g of spiel.gebaeude) this.neuesGeb(g);
    // v0.3: Drachenfeuer nur beim Angriff, Panzer der späten Trolle, Strahlen, Blitze, Schild, Ruinen
    this.feuer = new Schar(mk((g) => drachenFeuer(g)), 0.3, 60, scene, false);
    this.panzer = new Schar(mk((g) => trollPanzer(g)), 0.3, 60, scene, false);
    const strahlGeo = new THREE.BoxGeometry(0.16, 0.16, 1); strahlGeo.translate(0, 0, 0.5);
    this.strahlen = new THREE.InstancedMesh(strahlGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#9ff4ff').multiplyScalar(1.5), toneMapped: false }), 120);
    this.blitzMesh = new THREE.InstancedMesh(strahlGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9c0ff').multiplyScalar(1.7), toneMapped: false }), 400);
    for (const m of [this.strahlen, this.blitzMesh]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
    this.schild = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8fd8ff', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.schild.visible = false; this.schild.renderOrder = 25; scene.add(this.schild);
    for (const ru of spiel.ruinen) this.neueRuine(ru);
  }
  private neueRuine(ru: Ruine): void {
    const g = new Grid(); ruine(g, ru.w, ru.d, rng(ru.id * 7 + 3));
    const m = gridZuGruppe(g, 0.5); m.position.set(ru.x + ru.w / 2, ru.y, ru.z + ru.d / 2);
    this.scene.add(m); this.ruinen.set(ru.id, m);
  }
  /** feiner Lichtkegel eines Scheinwerfers (nur ein Hauch) */
  private kegelMesh(i: number): THREE.Mesh {
    if (!this.kegel[i]) {
      const geo = new THREE.ConeGeometry(1, 1, 24, 1, true); geo.translate(0, -0.5, 0); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying float vZ; void main(){ vZ = position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying float vZ; void main(){ float a = (1.0 - clamp(vZ, 0.0, 1.0)) * 0.05; gl_FragColor = vec4(1.0, 0.9, 0.65, a); }'
      }));
      m.renderOrder = 22; this.scene.add(m); this.kegel[i] = m;
    }
    return this.kegel[i];
  }

  private neuesGeb(g: Geb): void {
    const alt = this.gebaeude.get(g.id); if (alt) this.scene.remove(alt);
    const ms = g.typ === 'mauer' ? mauerStufe(g) : 0; this.mauerStufen.set(g.id, ms);
    const m = gebModell(g.typ, g.typ === 'mauer' && this.spiel.erfindungen.has('stahlguss'), g.zweig, g.stufe, ms).clone();
    const [cx, cz] = gebMitte(g); m.position.set(cx, g.y, cz);
    m.userData.y = g.y; this.scene.add(m); this.gebaeude.set(g.id, m);
  }
  /** Ereignisse der Simulation umsetzen */
  ereignisse(liste: Ereignis[]): void {
    const T = this.teilchen;
    for (const e of liste) {
      if (e.art === 'gebaut') { this.neuesGeb(e.geb); const [x, z] = gebMitte(e.geb); T.wurf(x, e.geb.y, z, 14, ['#b9b2a6', '#8a6340', '#7b5636'], 3); T.wurf(x, e.geb.y, z, 8, ['#d8cfc0'], 1, 2, 0.8); }
      if (e.art === 'weg') { const m = this.gebaeude.get(e.geb.id); if (m) { this.scene.remove(m); this.gebaeude.delete(e.geb.id); } const [x, z] = gebMitte(e.geb); T.wurf(x, e.geb.y + 2, z, e.zerstoert ? 70 : 20, ['#a59f95', '#8a6340', '#5a3d24', '#3a3836'], e.zerstoert ? 6 : 3); T.wurf(x, e.geb.y + 1, z, e.zerstoert ? 16 : 6, ['#6a625a', '#8a837b'], 1, 2, 1.4); }
      if (e.art === 'schaden' && e.geb.typ === 'mauer' && mauerStufe(e.geb) !== this.mauerStufen.get(e.geb.id) && this.gebaeude.has(e.geb.id)) { this.neuesGeb(e.geb); T.wurf(e.geb.x + 0.5, e.geb.y + 4, e.geb.z + 0.5, 10, ['#a59f95', '#8a837b'], 3); }
      if (e.art === 'schaden') { this.wackeln.set(e.geb.id, 0.25); const [x, z] = gebMitte(e.geb); T.wurf(x + (Math.random() - 0.5) * e.geb.w, e.geb.y + 1 + Math.random() * 3, z + (Math.random() - 0.5) * e.geb.d, 4, ['#a59f95', '#8a6340'], 2.5); }
      if (e.art === 'tod' && this.spiel.erkundetAn(e.x, e.z)) { T.wurf(e.x, e.y + 1, e.z, e.typ === 'troll' ? 44 : 20, FARBEN[e.typ], e.typ === 'troll' ? 5 : 4); T.wurf(e.x, e.y + 1, e.z, 6, ['#ffe2a0'], 3, 1, 0.15); }
      if (e.art === 'explosion') {
        T.wurf(e.x, e.y + 0.5, e.z, 34, ['#ffb347', '#ffe9a8', '#ff6a1a'], 7, 1, 0.32); T.wurf(e.x, e.y + 0.5, e.z, 12, ['#3d3836', '#5a5048'], 4); T.wurf(e.x, e.y + 0.6, e.z, 8, ['#4a4440', '#2f2a28'], 1.5, 2, 1.4);
        this.flecken.push({ x: e.x, y: e.y, z: e.z, t: 0 }); if (this.flecken.length > 80) this.flecken.shift();
      }
      if (e.art === 'treffer') T.wurf(e.x, e.y, e.z, 7, ['#ffe2a0', '#ffffff'], 3, 1, 0.14);
      if (e.art === 'fehl') {
        const m = new THREE.Matrix4().compose(new THREE.Vector3(e.x, e.y + 0.35, e.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.1 + Math.random() * 0.4, Math.random() * 6.28, 0)), new THREE.Vector3(1, 1, 1));
        this.steckend.push({ m, t: 0 }); if (this.steckend.length > 300) this.steckend.shift();
        T.wurf(e.x, e.y + 0.1, e.z, 3, ['#7b5636', '#5d8f3c'], 1.5);
      }
      if (e.art === 'hieb') T.wurf(e.x, e.y + 0.6, e.z, 4, SPAENE[e.res], 2.4, 0, 0.14);
      if (e.art === 'abwurf') T.wurf(e.x, e.y, e.z, 20, ['#9fe7ff', '#3b4f6b'], 3, 1, 0.2);
      if (e.art === 'schuss') this.rueckstoss.set(e.geb.id, 0.25);
      if (e.art === 'heilung') T.wurf(e.x, e.y, e.z, 2, ['#9dff8a', '#d0ffc0'], 1.2, 1, 0.12);
      if (e.art === 'riss') { T.wurf(e.x, hoehe(e.x, e.z) + 4, e.z, 60, ['#b07cff', '#efe2ff', '#8a5cff'], 7, 1, 0.3); T.wurf(e.x, hoehe(e.x, e.z) + 2, e.z, 20, ['#2d2838', '#3a3442'], 2, 2, 1.6); }
      if (e.art === 'brand') { const [x, z] = gebMitte(e.geb); T.wurf(x, e.geb.y + 3, z, 12, ['#ff8a2a', '#ffb347'], 3, 1, 0.2); }
      if (e.art === 'umgebaut') { this.neuesGeb(e.geb); const [x, z] = gebMitte(e.geb); T.wurf(x, e.geb.y + 3, z, 24, ['#ffe2a0', '#d4a640', '#ffffff'], 4, 1, 0.16); T.wurf(x, e.geb.y, z, 10, ['#d8cfc0'], 1, 2, 0.9); }
      if (e.art === 'ruine') {
        if (e.neu) this.neueRuine(e.ruine);
        else { const m = this.ruinen.get(e.ruine.id); if (m) { this.scene.remove(m); this.ruinen.delete(e.ruine.id); } const x = e.ruine.x + e.ruine.w / 2, z = e.ruine.z + e.ruine.d / 2; T.wurf(x, e.ruine.y + 1, z, 8, ['#8a837b', '#d8cfc0'], 1, 2, 1); }
      }
      if (e.art === 'blitz') for (let i = 1; i < e.punkte.length; i++) {
        const [ax, ay, az] = e.punkte[i - 1], [bx, by, bz] = e.punkte[i];
        // Zickzack: drei Zwischenpunkte
        let p = new THREE.Vector3(ax, ay, az);
        for (let k = 1; k <= 4; k++) {
          const f = k / 4, q = new THREE.Vector3(ax + (bx - ax) * f, ay + (by - ay) * f, az + (bz - az) * f);
          if (k < 4) q.add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6));
          this.blitze.push({ a: p, b: q, t: 0 }); p = q;
        }
        T.wurf(bx, by, bz, 5, ['#e6e0ff', '#ffffff'], 2.5, 1, 0.12);
      }
      if (e.art === 'feuer') for (let i = 0; i < 10; i++) { const f = 0.3 + i * 0.07; T.wurf(e.x + (e.tx - e.x) * f, e.y + (e.ty - e.y) * f, e.z + (e.tz - e.z) * f, 2, ['#ffb347', '#ff6a1a', '#ffe9a8'], 1.6, 1, 0.22); }
      if (e.art === 'faehigkeit') { const h = this.spiel.haupt; if (h && e.name === 'notreparatur') { const [x, z] = gebMitte(h); T.wurf(x, h.y + 4, z, 30, ['#ffe2a0', '#ffffff'], 4, 1, 0.16); } }
      if (e.art === 'reparatur' && e.fertig) { const [x, z] = gebMitte(e.geb); T.wurf(x, e.geb.y + 2, z, 16, ['#ffe2a0', '#ffffff'], 3, 1, 0.16); }
    }
  }
  /** jedes Bild: Wesen, Arbeiter, Schützen, Geschosse, Balken */
  bild(dt: number, licht: (x: number, z: number) => { wert: number; enthuellt: boolean }, nacht: boolean, kamera: THREE.Camera, wegStaerke: number): void {
    this.zeit += dt;
    const S = this.spiel, t = this.zeit;
    this.balken.beginn(kamera);
    // ---- Wesen ----
    for (const s of Object.values(this.wesen)) s.beginn();
    this.feuer.beginn(); this.panzer.beginn();
    for (const e of S.gegner) {
      if (!S.erkundetAn(e.x, e.z)) continue;
      const lauf = Math.abs(Math.sin(t * e.tempo * 3 + e.id)) * 0.18;
      let schar = this.wesen[e.typ], dunkel = false;
      if (e.typ === 'wolf' && nacht) { const l = licht(e.x, e.z); if (l.wert < 0.3 && !l.enthuellt) { schar = this.wesen.wolfDunkel; dunkel = true; } }
      schar.setze(e.x, e.y + (e.flug ? 0 : lauf), e.z, e.richtung, e.flug ? Math.sin(t * 2 + e.id) * 0.08 : 0, e.typ === 'rochen' ? Math.sin(t * 1.6 + e.id) * 0.1 : 0);
      if (e.feuer > 0 && e.typ === 'drachling') this.feuer.setze(e.x, e.y, e.z, e.richtung, Math.sin(t * 2 + e.id) * 0.08, 0, 0.7 + Math.min(1, e.feuer) * 0.4);
      if (e.panzer && !dunkel) this.panzer.setze(e.x, e.y + lauf, e.z, e.richtung);
      if (e.brand > 0 && Math.random() < dt * 8) this.teilchen.wurf(e.x, e.y + WESEN_HOEHE[e.typ] * 0.6, e.z, 1, ['#ff8a2a', '#ffb347'], 0.8, 1, 0.16);
      if (e.bossSchild > 0 && Math.random() < dt * 30) { const a = Math.random() * 6.28; this.teilchen.wurf(e.x + Math.cos(a) * 4, e.y + 2 + Math.random() * 8, e.z + Math.sin(a) * 4, 1, ['#c9a2ff', '#efe2ff'], 0.4, 1, 0.2); }
      if (e.hp < e.max && !dunkel) this.balken.setze(e.x, e.y + WESEN_HOEHE[e.typ] + 0.4, e.z, e.typ === 'rissfuerst' ? 6 : e.typ === 'troll' || e.typ === 'steinwerfer' || e.typ === 'schildwaechter' ? 2.4 : 1.4, e.hp / e.max, e.typ === 'rissfuerst' ? '#b07cff' : '#e5735f');
    }
    for (const s of Object.values(this.wesen)) s.ende();
    this.feuer.ende(); this.panzer.ende();
    // ---- Arbeiter (Tag) und Baumeister bei Reparaturen ----
    for (const s of Object.values(this.arbeiter)) s.beginn();
    for (const m of Object.values(this.traglast)) m.count = 0;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), eins = new THREE.Vector3(1, 1, 1);
    for (const a of S.arbeiter) {
      if (a.zustand === 'drin') continue;
      const g = S.gebaeude.find((o) => o.id === a.geb); if (!g) continue;
      const res = GEBAEUDE[g.typ].arbeit!.res, schar = this.arbeiter[res];
      const geht = a.zustand === 'hin' || a.zustand === 'zurueck' || a.zustand === 'heim';
      const hub = a.zustand === 'arbeit' ? Math.max(0, Math.sin(t * 9 + a.id)) * 0.35 : 0;
      schar.setze(a.x, a.y + (geht ? Math.abs(Math.sin(t * 9 + a.id)) * 0.07 : 0), a.z, a.richtung, 0, hub);
      if (a.traegt) {
        const tl = this.traglast[a.traegt];
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a.richtung + (a.traegt === 'holz' ? Math.PI / 2 : 0));
        v.set(a.x, a.y + 2.0, a.z); mtx.compose(v, q, eins); tl.setMatrixAt(tl.count++, mtx);
      }
    }
    for (const s of Object.values(this.arbeiter)) s.ende();
    for (const m of Object.values(this.traglast)) m.instanceMatrix.needsUpdate = true;
    this.bewegeBuerger(dt, t);
    // Pfeile über Gebäuden, die sich gerade verbessern lassen (nur am Tag)
    this.pfeilZeit -= dt; if (this.pfeilZeit <= 0) { this.pfeilZeit = 0.5; this.pfeilListe = S.phase === 'tag' && this.zeigePfeile ? S.gebaeude.filter((g) => g.typ !== 'mauer' && S.verbesserbar(g)) : []; }
    this.pfeilSchar.beginn();
    for (const g of this.pfeilListe) { if (!S.gebaeude.includes(g)) continue; const [cx, cz] = gebMitte(g); this.pfeilSchar.setze(cx, g.y + (GEB_HOEHE[g.typ] || 8) + 3 + Math.sin(t * 2.5 + g.id) * 0.3, cz, t * 1.2 + g.id); }
    this.pfeilSchar.ende();
    for (const g of S.gebaeude) if (g.brand > 0) {
      const [cx, cz] = gebMitte(g), hh = (GEB_HOEHE[g.typ] || 8) * 0.6;
      if (Math.random() < dt * 14) this.teilchen.wurf(cx + (Math.random() - 0.5) * g.w * 0.8, g.y + hh * Math.random(), cz + (Math.random() - 0.5) * g.d * 0.8, 1, ['#ff8a2a', '#ffb347', '#ff6a1a'], 1.2, 1, 0.3);
      if (Math.random() < dt * 5) this.teilchen.wurf(cx, g.y + hh, cz, 1, ['#4a4440', '#2f2a28'], 0.6, 2, 1.4);
    }
    this.baumeister.beginn(); this.schuetzen.beginn();
    let ns = 0; const fw0 = new THREE.Vector3(0, 0, 1);
    for (const g of S.gebaeude) {
      const [cx, cz] = gebMitte(g);
      if (g.rep || g.umbau) {
        for (let i = 0; i < (g.umbau ? 3 : 2); i++) {
          const a = i * Math.PI + g.id, x = cx + Math.cos(a) * (g.w / 2 + 0.8), z = cz + Math.sin(a) * (g.d / 2 + 0.8);
          this.baumeister.setze(x, hoehe(x, z), z, Math.atan2(cx - x, cz - z), 0, Math.max(0, Math.sin(t * 8 + i * 2)) * 0.4);
          if (Math.random() < dt * 5) this.teilchen.wurf(x + (cx - x) * 0.3, g.y + 1.5, z + (cz - z) * 0.3, 2, ['#ffe2a0'], 2, 1, 0.1);
        }
        const fort = g.umbau ? g.umbau.t / g.umbau.dauer : g.rep!.t / g.rep!.dauer;
        this.balken.setze(cx, g.y + (GEB_HOEHE[g.typ] || 8) + 1, cz, Math.min(4, 1.5 + g.w * 0.3), fort, g.umbau ? '#e8c46a' : '#84d8e8');
      } else if (g.hp < g.max - 0.5 || g === this.gewaehlt) {
        const f = g.hp / g.max;
        this.balken.setze(cx, g.y + (GEB_HOEHE[g.typ] || 8) + 1, cz, Math.min(4, 1.5 + g.w * 0.3), f, f > 0.6 ? '#9fd99a' : f > 0.3 ? '#e3a54e' : '#e5735f');
        if (f < 0.5 && Math.random() < dt * (1 - f) * 6) this.teilchen.wurf(cx + (Math.random() - 0.5) * g.w * 0.6, g.y + (GEB_HOEHE[g.typ] || 8) * 0.7, cz + (Math.random() - 0.5) * g.d * 0.6, 1, ['#4a4440', '#3a3634'], 0.5, 2, 1.1);
      }
      if (g.typ === 'wachturm' || g.typ === 'schuetzenturm' || g.typ === 'brandturm' || g.typ === 'leuchtpfeil' || g.typ === 'doppelturm') {
        const r = this.rueckstoss.get(g.id) || 0, oben = g.typ === 'schuetzenturm' ? 10.5 : 10.5;
        this.schuetzen.setze(cx + Math.sin(g.zielen) * 1.6, g.y + oben, cz + Math.cos(g.zielen) * 1.6, g.zielen, 0, -r * 0.8);
      }
      if (GEBAEUDE[g.typ].kegel) { const o = this.gebaeude.get(g.id); if (o) o.rotation.y = g.zielen; }
      for (const id of g.strahlen) {
        const e = S.gegner.find((o) => o.id === id); if (!e || e.tot || ns >= 120) continue;
        const a = new THREE.Vector3(cx, spitze(g), cz), b = new THREE.Vector3(e.x, e.y + 1, e.z), l = a.distanceTo(b);
        q.setFromUnitVectors(fw0, b.clone().sub(a).normalize()); const dick = 0.8 + Math.sin(t * 40 + id) * 0.25;
        mtx.compose(a, q, new THREE.Vector3(dick, dick, l)); this.strahlen.setMatrixAt(ns++, mtx);
        if (Math.random() < dt * 10) this.teilchen.wurf(b.x, b.y, b.z, 1, ['#c8fbff', '#ffffff'], 1.5, 1, 0.12);
      }
    }
    this.baumeister.ende(); this.schuetzen.ende();
    this.strahlen.count = ns; this.strahlen.instanceMatrix.needsUpdate = true;
    // Blitze: kurz aufflackernde Zickzack-Linien
    this.blitze = this.blitze.filter((b) => (b.t += dt) < 0.16);
    let nb = 0;
    for (const b of this.blitze) { if (nb >= 400) break; const l = b.a.distanceTo(b.b); q.setFromUnitVectors(fw0, b.b.clone().sub(b.a).normalize()); const d = 1.2 * (1 - b.t / 0.16) + 0.3; mtx.compose(b.a, q, new THREE.Vector3(d, d, l)); this.blitzMesh.setMatrixAt(nb++, mtx); }
    this.blitzMesh.count = nb; this.blitzMesh.instanceMatrix.needsUpdate = true;
    // Schild der Feste
    const h = S.haupt;
    if (h && h.schild > 0) { const [hx, hz] = gebMitte(h); this.schild.visible = true; this.schild.position.set(hx, h.y, hz); this.schild.scale.setScalar(Math.max(h.w, h.d) * 0.85 + Math.sin(t * 3) * 0.1); (this.schild.material as THREE.MeshBasicMaterial).opacity = 0.1 * Math.min(1, h.schild); }
    else this.schild.visible = false;
    // Kegel der Scheinwerfer (nur nachts, nur ein Hauch)
    let nk = 0;
    if (nacht) for (const g of S.gebaeude) {
      if (!GEBAEUDE[g.typ].kegel || g.umbau || nk >= 6) continue;
      const k = this.kegelMesh(nk++), [cx, cz] = gebMitte(g), r = GEBAEUDE[g.typ].licht, y = g.y + 10;
      k.visible = true; k.position.set(cx, y, cz);
      k.scale.set(Math.tan(GEBAEUDE[g.typ].kegel!) * r, Math.tan(GEBAEUDE[g.typ].kegel!) * r, r);
      k.lookAt(cx + Math.sin(g.zielen) * r, hoehe(cx + Math.sin(g.zielen) * r, cz + Math.cos(g.zielen) * r), cz + Math.cos(g.zielen) * r);
    }
    for (let i = nk; i < this.kegel.length; i++) this.kegel[i].visible = false;
    for (const [id, r] of this.rueckstoss) { const n = r - dt; if (n <= 0) this.rueckstoss.delete(id); else this.rueckstoss.set(id, n); }
    // ---- Geschosse ----
    let np = 0, nt = 0, nst = 0; const fw = new THREE.Vector3(0, 0, 1);
    for (const p of S.geschosse) {
      if (p.art === 'stein') { if (nst < 100 && p.t >= 0) { mtx.makeRotationFromEuler(new THREE.Euler(t * 4, t * 3, 0)).setPosition(p.x, p.y, p.z); this.steine.setMatrixAt(nst++, mtx); } continue; }
      if (p.art !== 'topf') {
        const f = Math.min(1, p.t / p.dauer), dy = (p.ty - p.sy) + Math.cos(Math.PI * f) * Math.PI * p.bogen;
        v.set(p.tx - p.sx, dy, p.tz - p.sz).normalize(); q.setFromUnitVectors(fw, v);
        mtx.compose(new THREE.Vector3(p.x, p.y, p.z), q, eins); this.pfeile.setMatrixAt(np++, mtx);
        if (Math.random() < 0.7) this.teilchen.wurf(p.x, p.y, p.z, 1, ['#ffe2a0'], 0.05, 1, 0.09);
      } else {
        mtx.makeRotationY(t * 6).setPosition(p.x, p.y, p.z); this.toepfe.setMatrixAt(nt++, mtx);
        this.teilchen.wurf(p.x, p.y, p.z, 1, ['#ffb347', '#ff6a1a'], 0.6, 1, 0.18);
        if (Math.random() < 0.5) this.teilchen.wurf(p.x, p.y, p.z, 1, ['#5a5048'], 0.2, 2, 0.6);
      }
    }
    this.steine.count = nst; this.steine.instanceMatrix.needsUpdate = true;
    this.pfeile.count = np; this.toepfe.count = nt; this.pfeile.instanceMatrix.needsUpdate = true; this.toepfe.instanceMatrix.needsUpdate = true;
    this.steckend = this.steckend.filter((s) => (s.t += dt) < 6);
    this.steckend.forEach((s, i) => this.steckpfeile.setMatrixAt(i, s.m)); this.steckpfeile.count = this.steckend.length; this.steckpfeile.instanceMatrix.needsUpdate = true;
    this.flecken = this.flecken.filter((f) => (f.t += dt) < 25);
    this.flecken.forEach((f, i) => { const s = 2.6 * Math.min(1, f.t * 4) * (1 - Math.max(0, f.t - 18) / 7); mtx.makeScale(s, 1, s).setPosition(f.x, f.y + 0.06 + i * 0.0005, f.z); this.brand.setMatrixAt(i, mtx); });
    this.brand.count = this.flecken.length; this.brand.instanceMatrix.needsUpdate = true;
    // getroffene Gebäude wackeln kurz
    for (const [id, w] of this.wackeln) {
      const o = this.gebaeude.get(id); if (!o) { this.wackeln.delete(id); continue; }
      const r = w - dt; o.position.y = o.userData.y + (r > 0 ? Math.sin(r * 60) * 0.06 : 0); o.rotation.z = r > 0 ? Math.sin(r * 47) * 0.01 : 0;
      if (r <= 0) this.wackeln.delete(id); else this.wackeln.set(id, r);
    }
    this.balken.ende();
    this.weg.setze(S, wegStaerke);
    this.teilchen.schritt(dt);
  }
  /** Einwohner ohne Arbeit schlendern am Tag zwischen Häusern, Burg, Hof und Werkstatt */
  private bewegeBuerger(dt: number, t: number): void {
    const S = this.spiel, tag = S.phase === 'tag', soll = tag ? Math.min(150, S.leerlauf()) : 0;
    const ziele = S.gebaeude.filter((g) => g.typ === 'haus' || g.typ === 'haupt' || g.typ === 'werkstatt' || g.typ === 'hof' || g.typ === 'fischer');
    const zielVon = (g: Geb): [number, number] => [g.x + g.w / 2 + (Math.random() - 0.5) * 2, g.z + g.d + 0.8 + Math.random()];
    while (this.buerger.length < soll && ziele.length) { const g = ziele[Math.floor(Math.random() * ziele.length)], [x, z] = zielVon(g); this.buerger.push({ x, z, ziel: zielVon(ziele[Math.floor(Math.random() * ziele.length)]), warte: Math.random() * 3, art: this.buerger.length % 3, tempo: 1.6 + Math.random() * 0.8, richtung: 0 }); }
    if (this.buerger.length > soll) this.buerger.length = soll;
    for (const s of this.buergerSchar) s.beginn();
    for (const b of this.buerger) {
      const dx = b.ziel[0] - b.x, dz = b.ziel[1] - b.z, d = Math.hypot(dx, dz);
      let geht = false;
      if (b.warte > 0) b.warte -= dt;
      else if (d < 0.4) { b.warte = 2 + Math.random() * 5; if (ziele.length) b.ziel = zielVon(ziele[Math.floor(Math.random() * ziele.length)]); }
      else { const sp = Math.min(d, b.tempo * dt); b.x += dx / d * sp; b.z += dz / d * sp; b.richtung = Math.atan2(dx, dz); geht = true; }
      this.buergerSchar[b.art].setze(b.x, hoehe(b.x, b.z) + (geht ? Math.abs(Math.sin(t * 8 + b.tempo * 10)) * 0.07 : 0), b.z, b.richtung);
    }
    for (const s of this.buergerSchar) s.ende();
  }
  hiebAn(x: number, y: number, z: number, res: Res): void { this.teilchen.wurf(x, y, z, 3, SPAENE[res], 2, 0, 0.12); }

  // ---------- Bauvorschau und Auswahl ----------
  zeigeVorschau(typ: GebTyp | null, x0 = 0, z0 = 0, ok = true, y = 0): void {
    if (!typ) { if (this.vorschau) this.vorschau.visible = false; if (!this.gewaehlt) this.ring.visible = this.lichtRing.visible = false; return; }
    if (this.vorschauTyp !== typ) {
      if (this.vorschau) this.scene.remove(this.vorschau);
      this.vorschau = gebModell(typ, false).clone(); this.vorschauTyp = typ; this.scene.add(this.vorschau);
    }
    const v = this.vorschau!; v.visible = true;
    const def = GEBAEUDE[typ]; const cx = x0 + def.w / 2, cz = z0 + def.d / 2;
    v.position.set(cx, y, cz);
    v.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = ok ? this.vorschauMat.ok : this.vorschauMat.nein; });
    this.ringe(cx, y, cz, def.kampf?.reichweite || def.arbeit?.radius || 0, def.licht);
  }
  private ringe(x: number, y: number, z: number, reichweite: number, licht: number): void {
    this.ring.visible = reichweite > 0; this.ring.position.set(x, y + 0.15, z); this.ring.scale.setScalar(reichweite || 1);
    this.lichtRing.visible = licht > 4; this.lichtRing.position.set(x, y + 0.12, z); this.lichtRing.scale.setScalar(licht || 1);
  }
  private flaeche: THREE.Mesh | null = null;
  /** Vorschau für „Ebnen“: Fläche in Zielhöhe */
  zeigeFlaeche(x0: number, z0: number, x1: number, z1: number, y: number, ok: boolean, sichtbar = true): void {
    if (!this.flaeche) { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0.5, -0.5, 0.5); this.flaeche = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false })); this.flaeche.renderOrder = 31; this.scene.add(this.flaeche); }
    const f = this.flaeche; f.visible = sichtbar; if (!sichtbar) return;
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1) + 1, az = Math.min(z0, z1), bz = Math.max(z0, z1) + 1;
    f.position.set(ax, y + 0.05, az); f.scale.set(bx - ax, 0.6, bz - az);
    (f.material as THREE.MeshBasicMaterial).color.set(ok ? '#9fe0a0' : '#ff7a6a');
  }
  waehle(g: Geb | null): void {
    this.gewaehlt = g;
    if (!g) { this.auswahl.visible = false; if (!this.vorschau?.visible) this.ring.visible = this.lichtRing.visible = false; return; }
    const [cx, cz] = gebMitte(g); this.auswahl.visible = true; this.auswahl.position.set(cx, g.y + 0.1, cz); this.auswahl.scale.set(g.w + 0.6, 1, g.d + 0.6);
    const def = GEBAEUDE[g.typ]; this.ringe(cx, g.y, cz, def.kampf?.reichweite || def.arbeit?.radius || 0, def.licht);
  }
  ende(): void {
    for (const m of this.gebaeude.values()) this.scene.remove(m);
    for (const m of this.ruinen.values()) this.scene.remove(m);
    for (const k of this.kegel) weg(k); weg(this.schild);
    const alle: THREE.Object3D[] = [];
    this.scene.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) alle.push(o); });
    for (const o of alle) weg(o);
    for (const m of [this.ring, this.lichtRing, this.auswahl]) weg(m);
    if (this.vorschau) this.scene.remove(this.vorschau);
  }
}
