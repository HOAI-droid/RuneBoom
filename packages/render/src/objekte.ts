import * as THREE from 'three';
import { GEBAEUDE, type Spiel, type Geb, type GebTyp, type GegTyp, type Ereignis, hoehe } from '@runeboom/core';
import { Grid, meshVoxels } from './voxel.ts';
import { geometrie, gridZuGruppe, SOLID, GLOW, LAMP, weg } from './grafik.ts';
import {
  hauptgebaeude, werkstatt, turmHolz, turmAlchemie, leuchtFackel, leuchtFeuer, haus, holzstapel, steinbruch, kristallmine, mauerStueck,
  moorwicht, wolf, troll, drachling, figur8
} from './modelle.ts';

// ---------- Modelle der Gebäude (halbe Voxel, Mitte bei 0) ----------
const modellCache = new Map<string, THREE.Group>();
function gebModell(typ: GebTyp, stahl: boolean): THREE.Group {
  const key = typ + (stahl ? '+' : '');
  let m = modellCache.get(key);
  if (!m) {
    const g = new Grid();
    if (typ === 'haupt') hauptgebaeude(g, 0, 0, 0);
    if (typ === 'werkstatt') werkstatt(g, 0, 0, 0, 0);
    if (typ === 'wachturm') turmHolz(g, 0, 0, 0);
    if (typ === 'feuertopf') turmAlchemie(g, 0, 0, 0);
    if (typ === 'fackel') leuchtFackel(g, 0, 0, 0);
    if (typ === 'leuchtfeuer') leuchtFeuer(g, 0, 0, 0);
    if (typ === 'holz') { haus(g, 0, 0, -0.5, 0, '#cdb894', '#7a3426'); holzstapel(g, -4, 0, -6); }
    if (typ === 'stein') steinbruch(g, 0, 0, 0);
    if (typ === 'kristall') kristallmine(g, 0, 0, 0);
    if (typ === 'mauer') mauerStueck(g, 0, 0, 0, stahl);
    m = gridZuGruppe(g, 0.5);
    modellCache.set(key, m);
  }
  return m;
}
export function gebMitte(g: { x: number; z: number; w: number; d: number }): [number, number] { return [g.x + g.w / 2, g.z + g.d / 2]; }

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
  private mat = new THREE.Matrix4(); private q = new THREE.Quaternion(); private s = new THREE.Vector3(); private p = new THREE.Vector3(); private e = new THREE.Euler();
  beginn() { this.n = 0; }
  setze(x: number, y: number, z: number, ry: number, rz = 0): void {
    if (this.n >= this.max) return;
    this.e.set(0, ry, rz); this.q.setFromEuler(this.e); this.s.setScalar(this.scale); this.p.set(x, y, z);
    this.mat.compose(this.p, this.q, this.s);
    for (const m of this.meshes) m.setMatrixAt(this.n, this.mat);
    this.n++;
  }
  ende(): void { for (const m of this.meshes) { m.count = this.n; m.instanceMatrix.needsUpdate = true; } }
}

/** Trümmer und Funken: kleine Würfel mit Schwerkraft */
class Truemmer {
  private fest: THREE.InstancedMesh; private funken: THREE.InstancedMesh;
  private teile: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; dauer: number; s: number; funke: boolean; farbe: THREE.Color }[] = [];
  private mat = new THREE.Matrix4();
  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.fest = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), 1500);
    this.funken = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), 1500);
    for (const m of [this.fest, this.funken]) { m.count = 0; m.frustumCulled = false; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1500 * 3), 3); scene.add(m); }
    this.fest.castShadow = true;
  }
  wurf(x: number, y: number, z: number, n: number, farben: string[], kraft = 4, funke = false, s = 0.22): void {
    for (let i = 0; i < n; i++) {
      if (this.teile.length > 1400) this.teile.shift();
      const a = Math.random() * Math.PI * 2, v = kraft * (0.4 + Math.random());
      const c = new THREE.Color(farben[i % farben.length]); if (funke) c.multiplyScalar(2.2);
      this.teile.push({ x, y, z, vx: Math.cos(a) * v, vy: kraft * (0.6 + Math.random()), vz: Math.sin(a) * v, t: 0, dauer: funke ? 0.5 + Math.random() * 0.5 : 1.2 + Math.random() * 0.8, s: s * (0.6 + Math.random() * 0.8), funke, farbe: c });
    }
  }
  schritt(dt: number): void {
    let nf = 0, ng = 0;
    for (const p of this.teile) {
      p.t += dt; p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const boden = hoehe(p.x, p.z); if (p.y < boden + p.s / 2) { p.y = boden + p.s / 2; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const k = Math.max(0, 1 - Math.max(0, p.t - p.dauer * 0.6) / (p.dauer * 0.4)), s = p.s * k;
      this.mat.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      const m = p.funke ? this.funken : this.fest, i = p.funke ? nf++ : ng++;
      m.setMatrixAt(i, this.mat); m.setColorAt(i, p.farbe);
    }
    this.teile = this.teile.filter((p) => p.t < p.dauer);
    this.fest.count = ng; this.funken.count = nf;
    for (const m of [this.fest, this.funken]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
}

const FARBEN: Record<GegTyp, string[]> = {
  moorwicht: ['#6f8a4a', '#5a4630', '#4f6136'], wolf: ['#2f2a3d', '#251f33', '#a070ff'], troll: ['#6f7a5e', '#4f7a3a', '#8c867f'], drachling: ['#9e2b25', '#d9813a', '#7a2420']
};

/** Alles, was sich bewegt oder gebaut wird: Gebäude, Wesen, Arbeiter, Geschosse, Trümmer, Vorschau. */
export class Objekte {
  private gebaeude = new Map<number, THREE.Group>();
  private wesen: Record<string, Schar>;
  private arbeiter: Schar;
  private pfeile: THREE.InstancedMesh; private toepfe: THREE.InstancedMesh;
  private truemmer: Truemmer;
  private vorschau: THREE.Group | null = null; private vorschauTyp = '';
  private vorschauMat = { ok: new THREE.MeshBasicMaterial({ color: '#9fe0a0', transparent: true, opacity: 0.45, depthWrite: false }), nein: new THREE.MeshBasicMaterial({ color: '#ff7a6a', transparent: true, opacity: 0.45, depthWrite: false }) };
  private ring: THREE.Mesh; private lichtRing: THREE.Mesh; private auswahl: THREE.Mesh;
  private wackeln = new Map<number, number>();
  private zeit = 0;

  constructor(private scene: THREE.Scene, private spiel: Spiel) {
    const mk = (fn: (g: Grid) => void) => { const g = new Grid(); fn(g); return g; };
    this.wesen = {
      moorwicht: new Schar(mk((g) => moorwicht(g, 0, 0, 0, 0)), 0.2, 400, scene),
      wolf: new Schar(mk((g) => wolf(g, 0, 0, 0, 0)), 0.22, 150, scene),
      wolfDunkel: new Schar(mk((g) => wolf(g, 0, 0, 0, 0, true)), 0.22, 150, scene),
      troll: new Schar(mk((g) => troll(g, 0, 0, 0, 0)), 0.3, 60, scene),
      drachling: new Schar(mk((g) => { drachling(g); }), 0.3, 60, scene)
    };
    this.arbeiter = new Schar(mk((g) => figur8(g, 0, 0, 0, 0, { hose: '#3d3328', kleid: '#5d7f9e', haut: '#e0b48c', haar: '#5a3d24', werkzeug: 'axt' })), 0.125, 200, scene);
    const pg = new THREE.BoxGeometry(0.07, 0.07, 0.9);
    this.pfeile = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: '#d8c8a0' }), 400);
    this.toepfe = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3c').multiplyScalar(2), toneMapped: false }), 100);
    for (const m of [this.pfeile, this.toepfe]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
    this.truemmer = new Truemmer(scene);
    const ringGeo = new THREE.RingGeometry(0.97, 1, 96); ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
    this.lichtRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffb36a', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }));
    const sel = new THREE.PlaneGeometry(1, 1); sel.rotateX(-Math.PI / 2);
    this.auswahl = new THREE.Mesh(sel, new THREE.MeshBasicMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.22, depthWrite: false }));
    for (const m of [this.ring, this.lichtRing, this.auswahl]) { m.visible = false; m.renderOrder = 30; scene.add(m); }
    for (const g of spiel.gebaeude) this.neuesGeb(g);
  }

  private neuesGeb(g: Geb): void {
    const m = gebModell(g.typ, g.typ === 'mauer' && this.spiel.erfindungen.has('stahlguss')).clone();
    const [cx, cz] = gebMitte(g); m.position.set(cx, g.y, cz);
    m.userData.y = g.y; this.scene.add(m); this.gebaeude.set(g.id, m);
  }
  /** Ereignisse der Simulation umsetzen */
  ereignisse(liste: Ereignis[]): void {
    for (const e of liste) {
      if (e.art === 'gebaut') { this.neuesGeb(e.geb); const [x, z] = gebMitte(e.geb); this.truemmer.wurf(x, e.geb.y, z, 14, ['#b9b2a6', '#8a6340', '#7b5636'], 3); }
      if (e.art === 'weg') { const m = this.gebaeude.get(e.geb.id); if (m) { this.scene.remove(m); this.gebaeude.delete(e.geb.id); } const [x, z] = gebMitte(e.geb); this.truemmer.wurf(x, e.geb.y + 2, z, e.zerstoert ? 60 : 20, ['#a59f95', '#8a6340', '#5a3d24', '#3a3836'], e.zerstoert ? 6 : 3); }
      if (e.art === 'schaden') this.wackeln.set(e.geb.id, 0.25);
      if (e.art === 'tod') { const sichtbar = this.spiel.erkundetAn(e.x, e.z); if (sichtbar) this.truemmer.wurf(e.x, e.y + 1, e.z, e.typ === 'troll' ? 40 : 18, FARBEN[e.typ], e.typ === 'troll' ? 5 : 4); }
      if (e.art === 'explosion') { this.truemmer.wurf(e.x, e.y + 0.5, e.z, 26, ['#ffb347', '#ffe9a8', '#ff6a1a'], 6, true, 0.3); this.truemmer.wurf(e.x, e.y + 0.5, e.z, 10, ['#3d3836', '#5a5048'], 4); }
      if (e.art === 'treffer') this.truemmer.wurf(e.x, e.y, e.z, 3, ['#ffe2a0'], 2, true, 0.12);
    }
  }
  /** jedes Bild: Wesen, Geschosse, Arbeiter */
  bild(dt: number, licht: (x: number, z: number) => { wert: number; enthuellt: boolean }, nacht: boolean): void {
    this.zeit += dt;
    for (const s of Object.values(this.wesen)) s.beginn();
    for (const e of this.spiel.gegner) {
      if (!this.spiel.erkundetAn(e.x, e.z)) continue;
      const lauf = Math.abs(Math.sin(this.zeit * e.tempo * 3 + e.id)) * 0.18;
      let schar = this.wesen[e.typ];
      if (e.typ === 'wolf' && nacht) { const l = licht(e.x, e.z); if (l.wert < 0.3 && !l.enthuellt) schar = this.wesen.wolfDunkel; }
      schar.setze(e.x, e.y + (e.flug ? 0 : lauf), e.z, e.richtung, e.flug ? Math.sin(this.zeit * 2 + e.id) * 0.08 : 0);
    }
    for (const s of Object.values(this.wesen)) s.ende();
    // Arbeiter: tagsüber zwischen ihrem Gebäude und der Umgebung unterwegs
    this.arbeiter.beginn();
    if (!nacht) for (const g of this.spiel.gebaeude) {
      if (!GEBAEUDE[g.typ].ertrag) continue;
      const [cx, cz] = gebMitte(g), a = g.id * 2.39, t = (Math.sin(this.zeit * 0.25 + g.id) + 1) / 2;
      const x = cx + Math.cos(a) * (2.5 + t * 6), z = cz + Math.sin(a) * (2.5 + t * 6);
      const raus = Math.cos(this.zeit * 0.25 + g.id) > 0, ry = Math.atan2(Math.cos(a), Math.sin(a)) + (raus ? 0 : Math.PI);
      this.arbeiter.setze(x, hoehe(x, z) + Math.abs(Math.sin(this.zeit * 7 + g.id)) * 0.08, z, ry);
    }
    this.arbeiter.ende();
    // Geschosse
    let np = 0, nt = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), fw = new THREE.Vector3(0, 0, 1);
    for (const p of this.spiel.geschosse) {
      if (p.art === 'pfeil') {
        const f = Math.min(1, p.t / p.dauer), dy = (p.ty - p.sy) + Math.cos(Math.PI * f) * Math.PI * p.bogen;
        v.set(p.tx - p.sx, dy, p.tz - p.sz).normalize(); q.setFromUnitVectors(fw, v);
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q, one); this.pfeile.setMatrixAt(np++, m);
      } else { m.makeTranslation(p.x, p.y, p.z); this.toepfe.setMatrixAt(nt++, m); if (Math.random() < 0.5) this.truemmer.wurf(p.x, p.y, p.z, 1, ['#ffb347', '#ff6a1a'], 0.6, true, 0.15); }
    }
    this.pfeile.count = np; this.toepfe.count = nt; this.pfeile.instanceMatrix.needsUpdate = true; this.toepfe.instanceMatrix.needsUpdate = true;
    // getroffene Gebäude wackeln kurz
    for (const [id, t] of this.wackeln) {
      const o = this.gebaeude.get(id); if (!o) { this.wackeln.delete(id); continue; }
      const r = t - dt; o.position.y = o.userData.y + (r > 0 ? Math.sin(r * 60) * 0.06 : 0); o.rotation.z = r > 0 ? Math.sin(r * 47) * 0.01 : 0;
      if (r <= 0) this.wackeln.delete(id); else this.wackeln.set(id, r);
    }
    this.truemmer.schritt(dt);
  }

  // ---------- Bauvorschau und Auswahl ----------
  zeigeVorschau(typ: GebTyp | null, x0 = 0, z0 = 0, ok = true, y = 0): void {
    if (!typ) { if (this.vorschau) this.vorschau.visible = false; this.ring.visible = this.lichtRing.visible = false; return; }
    if (this.vorschauTyp !== typ) {
      if (this.vorschau) this.scene.remove(this.vorschau);
      this.vorschau = gebModell(typ, false).clone(); this.vorschauTyp = typ; this.scene.add(this.vorschau);
    }
    const v = this.vorschau!; v.visible = true;
    const def = GEBAEUDE[typ]; const cx = x0 + def.w / 2, cz = z0 + def.d / 2;
    v.position.set(cx, y, cz);
    v.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = ok ? this.vorschauMat.ok : this.vorschauMat.nein; });
    this.ringe(cx, y, cz, def.kampf?.reichweite || 0, def.licht);
  }
  private ringe(x: number, y: number, z: number, reichweite: number, licht: number): void {
    this.ring.visible = reichweite > 0; this.ring.position.set(x, y + 0.15, z); this.ring.scale.setScalar(reichweite || 1);
    this.lichtRing.visible = licht > 4; this.lichtRing.position.set(x, y + 0.12, z); this.lichtRing.scale.setScalar(licht || 1);
  }
  waehle(g: Geb | null): void {
    if (!g) { this.auswahl.visible = false; if (!this.vorschau?.visible) this.ring.visible = this.lichtRing.visible = false; return; }
    const [cx, cz] = gebMitte(g); this.auswahl.visible = true; this.auswahl.position.set(cx, g.y + 0.1, cz); this.auswahl.scale.set(g.w + 0.6, 1, g.d + 0.6);
    const def = GEBAEUDE[g.typ]; this.ringe(cx, g.y, cz, def.kampf?.reichweite || 0, def.licht);
  }
  ende(): void {
    for (const m of this.gebaeude.values()) this.scene.remove(m);
    weg(this.pfeile); weg(this.toepfe);
  }
}
