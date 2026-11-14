import * as THREE from 'three';
import { CH, WR, NZ, NN, h3 } from '@runeboom/core';
import { zuGruppe, becken, weg, WASSER, LAVA, ZEIT, FABRIK } from './grafik.ts';
import { bauChunk, uebersicht, type ChunkDaten, type UebersichtDaten } from './chunk.ts';
import WeltRechner from './welt.worker.ts?worker&inline';

/**
 * Die Welt auf dem Bildschirm: Kacheln (32 × 32) werden im Hintergrund gebaut, die nächsten zuerst;
 * weiter weg zeigt eine grobe Übersicht die ganze Welt; über dem Unerkundeten liegt Bodennebel.
 */
export class WeltAnsicht {
  readonly gruppe = new THREE.Group();
  uebersicht: UebersichtDaten | null = null;
  private NCH = (2 * WR) / CH;
  /** geladene Kacheln; stufe 1 = Boden ohne Pflanzen (fern), 2 = Bäume in ganzen Voxeln (mittel), 3 = alles (nah) */
  private geladen = new Map<number, { grp: THREE.Group; extra: THREE.Object3D[]; cx: number; cz: number; stufe: number }>();
  private inArbeit = new Set<number>();
  private rechner: Worker[] = [];
  private frei: Worker[] = [];
  private gen = 1;
  private maske = new Uint8Array(this.NCH * this.NCH);
  private maskeTex = new THREE.DataTexture(this.maske, this.NCH, this.NCH, THREE.RedFormat, THREE.UnsignedByteType);
  private uebersichtMesh: THREE.Mesh | null = null;
  private neuBauen = new Set<number>();
  private nebelSchichten: THREE.Mesh[] = [];
  private nebelMaske = new Uint8Array(NN * NN);
  private nebelTex = new THREE.DataTexture(this.nebelMaske, NN, NN, THREE.RedFormat, THREE.UnsignedByteType);
  readonly NEBEL_U = { uZeit: ZEIT, uMaske: { value: this.nebelTex }, uFarbe: { value: new THREE.Color('#efe9dd') }, uDichte: { value: 0.24 } };
  private UEBER: THREE.Material;
  onUebersicht: () => void = () => {};
  /** Änderungen am Bewuchs einer Kachel (gefällte Bäume, abgebaute Felsen) */
  aenderungen: (cx: number, cz: number) => [number, number, string][] = () => [];
  /** geebnete Höhen in und um eine Kachel */
  hoehen: (cx: number, cz: number) => [number, number, number][] = () => [];
  /** grober Wald: jeder Baum der Welt als einfacher Stamm + Krone, sofort sichtbar */
  /** in Bereiche zu 256 × 256 geteilt, damit nur Sichtbares gezeichnet wird; wirft keine Schatten (nah stehen die feinen Bäume) */
  private wald: { teile: { stamm: THREE.InstancedMesh; krone: THREE.InstancedMesh; matS: Float32Array; matK: Float32Array }[]; index: Map<number, [number, number]> } | null = null;
  private frustum = new THREE.Frustum(); private pm = new THREE.Matrix4();

  constructor(private scene: THREE.Scene, private seed: number, private erkundet: Uint8Array) {
    this.maskeTex.magFilter = this.maskeTex.minFilter = THREE.NearestFilter; this.maskeTex.needsUpdate = true;
    this.nebelTex.magFilter = this.nebelTex.minFilter = THREE.LinearFilter;
    const mt = this.maskeTex;
    this.UEBER = FABRIK.licht({ vertexColors: true, roughness: 0.92 }, 1.2, mt, 0.25);
    const zahl = Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 4) - 1));
    try { for (let i = 0; i < zahl; i++) { const w = new WeltRechner(); w.onmessage = (e) => this.antwort(w, e.data); w.postMessage({ art: 'seed', seed }); this.rechner.push(w); this.frei.push(w); } }
    catch (e) { console.warn('Kein Hintergrund-Rechner, baue auf der Seite', e); }
    scene.add(this.gruppe);
    this.auftrag({ art: 'uebersicht' });
  }
  ende(): void { for (const w of this.rechner) w.terminate(); this.gen++; weg(this.gruppe); for (const n of this.nebelSchichten) weg(n); }

  private auftrag(msg: { art: string; cx?: number; cz?: number; stufe?: number }): boolean {
    const m: any = { ...msg, gen: this.gen }; if (m.art === 'chunk') { m.aend = this.aenderungen(m.cx, m.cz); m.hoehen = this.hoehen(m.cx, m.cz); }
    const w = this.frei.pop(); if (w) { w.postMessage(m); return true; }
    if (!this.rechner.length) { setTimeout(() => { if (m.art === 'chunk') this.chunkFertig(m.cx!, m.cz!, bauChunk(m.cx!, m.cz!, m.aend, m.stufe ?? 3), m.stufe ?? 3); else this.uebersichtFertig(uebersicht()); }, 0); return true; }
    return false;
  }
  private antwort(w: Worker, m: any): void {
    this.frei.push(w);
    if (m.gen !== this.gen) return;
    if (m.art === 'chunk') this.chunkFertig(m.cx, m.cz, m.r, m.stufe ?? 3);
    if (m.art === 'uebersicht') this.uebersichtFertig(m.u);
  }
  private chunkFertig(cx: number, cz: number, r: ChunkDaten, stufe = 3): void {
    const k = cx * 1000 + cz; this.inArbeit.delete(k);
    const alt = this.geladen.get(k); if (alt) { weg(alt.grp); alt.extra.forEach(weg); }
    if (this.neuBauen.has(k)) { this.neuBauen.delete(k); setTimeout(() => this.kachelNeu(cx, cz), 0); }
    const grp = new THREE.Group(); grp.position.set(cx * CH, 0, cz * CH);
    const netz = zuGruppe(r.grob, 1); if (stufe < 3) netz.traverse((o) => { o.castShadow = false; }); grp.add(netz);
    const extra: THREE.Object3D[] = [];
    if (r.wasser.length) extra.push(becken(r.wasser, WASSER)); if (r.lava.length) extra.push(becken(r.lava, LAVA));
    for (const e of extra) this.gruppe.add(e);
    this.gruppe.add(grp); this.geladen.set(k, { grp, extra, cx, cz, stufe });
    this.maske[(cz + this.NCH / 2) * this.NCH + (cx + this.NCH / 2)] = stufe >= 3 ? 255 : stufe === 2 ? 210 : 128; this.maskeTex.needsUpdate = true;
  }
  private uebersichtFertig(u: UebersichtDaten): void {
    this.uebersicht = u;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(u.p, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(u.n, 3)); geo.setAttribute('color', new THREE.BufferAttribute(u.c, 3)); geo.setIndex(new THREE.BufferAttribute(u.i, 1));
    this.uebersichtMesh = new THREE.Mesh(geo, this.UEBER); this.uebersichtMesh.receiveShadow = true; this.gruppe.add(this.uebersichtMesh);
    this.baueWald(u.dekoListe);
    this.baueNebel(); this.onUebersicht();
  }
  /** Kachel neu bauen (z. B. nach dem Fällen eines Baums); die alte bleibt stehen, bis die neue fertig ist */
  kachelNeu(cx: number, cz: number): void {
    const k = cx * 1000 + cz;
    if (this.inArbeit.has(k)) { this.neuBauen.add(k); return; }
    if (!this.geladen.has(k)) return;
    if (this.auftrag({ art: 'chunk', cx, cz, stufe: this.geladen.get(k)!.stufe })) this.inArbeit.add(k); else this.neuBauen.add(k);
  }
  private baueWald(liste: Float32Array): void {
    const n = liste.length / 4;
    const mat = FABRIK.licht({ roughness: 0.9 }, 1.2, this.maskeTex, 0.75);
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const BER = 256, NB = Math.ceil((2 * WR) / BER), bereich = (x: number, z: number) => Math.min(NB - 1, Math.max(0, Math.floor((x + WR) / BER))) * NB + Math.min(NB - 1, Math.max(0, Math.floor((z + WR) / BER)));
    const zahl = new Array(NB * NB).fill(0);
    for (let i = 0; i < n; i++) zahl[bereich(liste[i * 4], liste[i * 4 + 2])]++;
    const m = new THREE.Matrix4(), c = new THREE.Color(), index = new Map<number, [number, number]>();
    // Maße je Art: Stammhöhe, Kronenbreite, Kronenhöhe, Farben
    const ART: Record<number, [number, number, number, string, string]> = {
      0: [4.5, 4.6, 3.8, '#5e4128', '#4f8a3c'], 1: [1.5, 3.6, 9.5, '#4d3522', '#2f5a3a'], 2: [4.5, 4.4, 3.6, '#5e4128', '#c27030'],
      3: [4.5, 4.4, 3.6, '#5e4128', '#5b4e8a'], 4: [0, 2.6, 1.8, '#5e4128', '#4f8a3c'], 5: [6, 0, 0, '#3b302a', '#3b302a'], 9: [0, 2.6, 1.6, '#7d776f', '#8c867f']
    };
    const teile: { stamm: THREE.InstancedMesh; krone: THREE.InstancedMesh; matS: Float32Array; matK: Float32Array }[] = [];
    const roh = zahl.map((z) => { const stamm = new THREE.InstancedMesh(box, mat, Math.max(1, z)), krone = new THREE.InstancedMesh(box, mat, Math.max(1, z)); stamm.count = krone.count = 0; stamm.receiveShadow = krone.receiveShadow = true; return { stamm, krone }; });
    for (let i = 0; i < n; i++) {
      const x = liste[i * 4] + 0.5, y = liste[i * 4 + 1], z = liste[i * 4 + 2] + 0.5, a = liste[i * 4 + 3];
      const t = roh[bereich(liste[i * 4], liste[i * 4 + 2])], j = t.stamm.count++; t.krone.count++;
      const [sh, kb, kh, sc, kc] = ART[a] || ART[0], v = 0.85 + h3(x, 3, z) * 0.3;
      m.makeScale(a === 9 ? 0 : 0.55, sh * v || 0.001, a === 9 ? 0 : 0.55).setPosition(x, y, z); t.stamm.setMatrixAt(j, m); t.stamm.setColorAt(j, c.set(sc));
      m.makeScale(kb * v || 0.001, kh * v || 0.001, kb * v || 0.001).setPosition(x, y + (a === 9 ? 0 : sh * v - (a === 1 ? 0 : 1)), z); t.krone.setMatrixAt(j, m); t.krone.setColorAt(j, c.set(kc).multiplyScalar(0.9 + h3(x, 4, z) * 0.2));
      index.set((Math.floor(x) + 600) * 2048 + (Math.floor(z) + 600), [bereich(liste[i * 4], liste[i * 4 + 2]), j]);
    }
    for (const t of roh) {
      if (!t.stamm.count) { teile.push({ ...t, matS: new Float32Array(0), matK: new Float32Array(0) }); continue; }
      t.stamm.computeBoundingSphere(); t.krone.computeBoundingSphere();
      this.gruppe.add(t.stamm, t.krone);
      teile.push({ ...t, matS: (t.stamm.instanceMatrix.array as Float32Array).slice(), matK: (t.krone.instanceMatrix.array as Float32Array).slice() });
    }
    this.wald = { teile, index };
  }
  /** groben Baum an (x, z) aus- oder wieder einblenden */
  grobDeko(x: number, z: number, sichtbar: boolean): void {
    const w = this.wald; if (!w) return;
    const ij = w.index.get((Math.floor(x) + 600) * 2048 + (Math.floor(z) + 600)); if (!ij) return;
    const [b, i] = ij, t = w.teile[b];
    for (const [mesh, orig] of [[t.stamm, t.matS], [t.krone, t.matK]] as [THREE.InstancedMesh, Float32Array][]) {
      const a = mesh.instanceMatrix.array as Float32Array;
      if (sichtbar) a.set(orig.subarray(i * 16, i * 16 + 16), i * 16); else { const m = new THREE.Matrix4().makeScale(0, 0, 0); m.toArray(a, i * 16); }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  /** Kacheln um den Blickpunkt anfordern (Sichtbares zuerst), ferne freigeben */
  planen(ziel: THREE.Vector3, dist: number, kamera?: THREE.Camera): void {
    if (kamera) { this.pm.multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm); }
    const kugel = new THREE.Sphere(new THREE.Vector3(), CH * 0.75);
    const R = dist > 420 ? 0 : THREE.MathUtils.clamp(dist * 1.15, 80, 190), NCH = this.NCH;
    const wunsch: { cx: number; cz: number; d: number; k: number; stufe: number }[] = [];
    // nah alles, weiter weg nur Boden (mit etwas Spielraum, damit Kacheln am Rand nicht hin- und herwechseln)
    const NAH = this.nahRadius(dist);
    const c0x = Math.floor(ziel.x / CH), c0z = Math.floor(ziel.z / CH), n = Math.ceil(R / CH) + 1;
    for (let cx = c0x - n; cx <= c0x + n; cx++) for (let cz = c0z - n; cz <= c0z + n; cz++) {
      if (cx < -NCH / 2 || cz < -NCH / 2 || cx >= NCH / 2 || cz >= NCH / 2) continue;
      const d = Math.hypot((cx + 0.5) * CH - ziel.x, (cz + 0.5) * CH - ziel.z); if (d > R) continue;
      const k = cx * 1000 + cz; if (this.inArbeit.has(k)) continue;
      const MITTEL = this.mittelRadius(dist), soll = d <= NAH ? 3 : d <= MITTEL ? 2 : 1, da = this.geladen.get(k);
      // mit Spielraum, damit Kacheln am Rand nicht hin- und herwechseln
      if (da && (da.stufe === soll || (da.stufe > soll && d <= (da.stufe === 3 ? NAH : MITTEL) + 24))) continue;
      kugel.center.set((cx + 0.5) * CH, 8, (cz + 0.5) * CH);
      // fehlende Kacheln zuerst, Detailwechsel danach
      wunsch.push({ cx, cz, d: (kamera && !this.frustum.intersectsSphere(kugel) ? d * 2.5 + 60 : d) + (da ? 400 : 0), k, stufe: soll });
    }
    wunsch.sort((a, b) => a.d - b.d);
    for (const w of wunsch) { if (!this.auftrag({ art: 'chunk', cx: w.cx, cz: w.cz, stufe: w.stufe })) break; this.inArbeit.add(w.k); }
    if (this.geladen.size > 150) {
      const alle = [...this.geladen.values()].map((g) => ({ g, d: Math.hypot((g.cx + 0.5) * CH - ziel.x, (g.cz + 0.5) * CH - ziel.z) })).sort((a, b) => b.d - a.d);
      for (const { g, d } of alle.slice(0, this.geladen.size - 150)) {
        if (d < R + 40) break;
        weg(g.grp); g.extra.forEach(weg); this.geladen.delete(g.cx * 1000 + g.cz);
        this.maske[(g.cz + NCH / 2) * NCH + (g.cx + NCH / 2)] = 0; this.maskeTex.needsUpdate = true;
      }
    }
  }
  geladenAnzahl(): number { return this.geladen.size; }
  /** zum Messen: Teile aus- und einblenden */
  messSichtbar(nebel: boolean, wald: boolean, kacheln: boolean): void {
    for (const n of this.nebelSchichten) n.visible = nebel;
    if (this.wald) for (const t of this.wald.teile) { t.stamm.visible = t.krone.visible = wald && t.stamm.count > 0; }
    for (const g of this.geladen.values()) { g.grp.visible = kacheln; for (const e of g.extra) e.visible = kacheln; }
  }
  /** bis zu dieser Entfernung vom Blickpunkt Kacheln mit Bäumen und Pflanzen */
  nahRadius(dist: number): number { return THREE.MathUtils.clamp(dist * 0.8, 64, 140) * this.detail; }
  /** bis hierhin Bäume in ganzen Voxeln, danach der grobe Wald */
  mittelRadius(dist: number): number { return this.nahRadius(dist) + 60 * this.detail; }
  /** Detailfaktor (hoch 1, mittel 0,8, niedrig 0,6) */
  detail = 1;
  /** Ist alles Sichtbare fertig gebaut? (Übersicht da, keine fehlende Kachel im Blickfeld) */
  bereit(ziel: THREE.Vector3, dist: number, kamera: THREE.Camera): boolean {
    if (!this.uebersicht) return false;
    this.pm.multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm);
    const kugel = new THREE.Sphere(new THREE.Vector3(), CH * 0.75), NCH = this.NCH;
    const R = dist > 420 ? 0 : THREE.MathUtils.clamp(dist * 1.15, 80, 190);
    const c0x = Math.floor(ziel.x / CH), c0z = Math.floor(ziel.z / CH), n = Math.ceil(R / CH) + 1;
    for (let cx = c0x - n; cx <= c0x + n; cx++) for (let cz = c0z - n; cz <= c0z + n; cz++) {
      if (cx < -NCH / 2 || cz < -NCH / 2 || cx >= NCH / 2 || cz >= NCH / 2) continue;
      if (Math.hypot((cx + 0.5) * CH - ziel.x, (cz + 0.5) * CH - ziel.z) > R) continue;
      kugel.center.set((cx + 0.5) * CH, 8, (cz + 0.5) * CH);
      if (!this.frustum.intersectsSphere(kugel)) continue;
      const da = this.geladen.get(cx * 1000 + cz); if (!da) return false;
      { const dd = Math.hypot((cx + 0.5) * CH - ziel.x, (cz + 0.5) * CH - ziel.z); if ((da.stufe < 3 && dd <= this.nahRadius(dist)) || (da.stufe < 2 && dd <= this.mittelRadius(dist))) return false; }
    }
    return true;
  }

  // ---------- Bodennebel ----------
  /** Zahl der Nebelschichten (hoch 5, sonst 3); weniger Schichten sind je Schicht dichter */
  nebelLagen = 5;
  private nebelMaterial(k: number, n: number): THREE.Material {
    // gleiche Gesamtdichte wie mit 8 Schichten: 1 - (1 - a)^8 = 1 - (1 - a')^n
    return FABRIK.nebel(this.NEBEL_U, n > 1 ? (k * 7) / (n - 1) : 0, 8 / n);
  }
  private baueNebel(): void {
    if (!this.uebersicht) return;
    const { boden, N } = this.uebersicht, f = N / NN, V = NN + 1;
    const grund = new Float32Array(V * V), land = new Float32Array(V * V);
    for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) {
      let sum = 0, zahl = 0;
      for (let a = -f; a < f; a++) for (let b = -f; b < f; b++) { const ci = i * f + a, cj = j * f + b; if (ci < 0 || cj < 0 || ci >= N || cj >= N) continue; const h = boden[ci * N + cj]; if (h > -900) { sum += h; zahl++; } }
      grund[i * V + j] = zahl ? Math.min(sum / zahl, 15) : 6; land[i * V + j] = zahl ? 1 : 0;
    }
    const idx: number[] = [];
    for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) { const a = i * V + j, b = (i + 1) * V + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const n = this.nebelLagen, landAttr = new THREE.BufferAttribute(land, 1);
    for (let k = 0; k < n; k++) {
      const pos = new Float32Array(V * V * 3), lage = n > 1 ? (k * 7) / (n - 1) : 0;
      for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) { const o = (i * V + j) * 3; pos[o] = -WR + i * NZ; pos[o + 1] = grund[i * V + j] + 0.6 + lage * 0.95; pos[o + 2] = -WR + j * NZ; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aLand', landAttr); geo.setIndex(idx);
      const m = new THREE.Mesh(geo, this.nebelMaterial(k, n)); m.renderOrder = 10 + k; m.frustumCulled = false; this.scene.add(m); this.nebelSchichten.push(m);
    }
    this.nebelAktualisieren();
  }
  nebelAktualisieren(): void {
    for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) this.nebelMaske[j * NN + i] = this.erkundet[i * NN + j] ? 255 : 0;
    this.nebelTex.needsUpdate = true;
  }
  nebelFarbe(c: THREE.Color): void { this.NEBEL_U.uFarbe.value.copy(c); }

  /** Farbbild der Übersichtskarte (N × N), Unerkundetes als Dunst */
  kartenBild(ctx: CanvasRenderingContext2D): void {
    const u = this.uebersicht; if (!u) return;
    const { farbe, hoch, N } = u, img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const o = (j * N + i) * 4, f = (j * N + i) * 3, land = hoch[i * N + j] > -900;
      const ni = Math.floor(i / (N / NN)), nj = Math.floor(j / (N / NN)), sicht = this.erkundet[ni * NN + nj];
      if (!land) { img.data.set([13, 19, 32, 255], o); continue; }
      if (!sicht) { const k = 165 + h3(ni, 0, nj) * 20; img.data.set([farbe[f] * 0.28 + k * 0.72, farbe[f + 1] * 0.28 + k * 0.72, farbe[f + 2] * 0.28 + (k + 6) * 0.72, 255], o); continue; }
      img.data.set([farbe[f], farbe[f + 1], farbe[f + 2], 255], o);
    }
    ctx.putImageData(img, 0, 0);
  }
}
