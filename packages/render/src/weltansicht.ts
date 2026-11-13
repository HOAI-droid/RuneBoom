import * as THREE from 'three';
import { CH, WR, NZ, NN, h3 } from '@runeboom/core';
import { zuGruppe, becken, weg, WASSER, LAVA, ZEIT, NOISE_GLSL, mitLichtkarte } from './grafik.ts';
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
  private geladen = new Map<number, { grp: THREE.Group; extra: THREE.Object3D[]; cx: number; cz: number }>();
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
  private UEBER: THREE.MeshStandardMaterial;
  onUebersicht: () => void = () => {};
  /** Änderungen am Bewuchs einer Kachel (gefällte Bäume, abgebaute Felsen) */
  aenderungen: (cx: number, cz: number) => [number, number, string][] = () => [];
  /** geebnete Höhen in und um eine Kachel */
  hoehen: (cx: number, cz: number) => [number, number, number][] = () => [];
  /** grober Wald: jeder Baum der Welt als einfacher Stamm + Krone, sofort sichtbar */
  private wald: { stamm: THREE.InstancedMesh; krone: THREE.InstancedMesh; index: Map<number, number>; matS: Float32Array; matK: Float32Array } | null = null;
  private frustum = new THREE.Frustum(); private pm = new THREE.Matrix4();

  constructor(private scene: THREE.Scene, private seed: number, private erkundet: Uint8Array) {
    this.maskeTex.magFilter = this.maskeTex.minFilter = THREE.NearestFilter; this.maskeTex.needsUpdate = true;
    this.nebelTex.magFilter = this.nebelTex.minFilter = THREE.LinearFilter;
    const mt = this.maskeTex;
    this.UEBER = mitLichtkarte(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), 1.2);
    const alt = this.UEBER.onBeforeCompile;
    this.UEBER.onBeforeCompile = (sh, r) => {
      alt(sh, r);
      sh.uniforms.uMaske = { value: mt };
      sh.fragmentShader = 'uniform sampler2D uMaske;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `if (texture2D(uMaske, (vWP.xz + ${WR.toFixed(1)}) / ${(2 * WR).toFixed(1)}).r > 0.5) discard;\n#include <clipping_planes_fragment>`);
    };
    const zahl = Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 4) - 1));
    try { for (let i = 0; i < zahl; i++) { const w = new WeltRechner(); w.onmessage = (e) => this.antwort(w, e.data); w.postMessage({ art: 'seed', seed }); this.rechner.push(w); this.frei.push(w); } }
    catch (e) { console.warn('Kein Hintergrund-Rechner, baue auf der Seite', e); }
    scene.add(this.gruppe);
    this.auftrag({ art: 'uebersicht' });
  }
  ende(): void { for (const w of this.rechner) w.terminate(); this.gen++; weg(this.gruppe); for (const n of this.nebelSchichten) weg(n); }

  private auftrag(msg: { art: string; cx?: number; cz?: number }): boolean {
    const m: any = { ...msg, gen: this.gen }; if (m.art === 'chunk') { m.aend = this.aenderungen(m.cx, m.cz); m.hoehen = this.hoehen(m.cx, m.cz); }
    const w = this.frei.pop(); if (w) { w.postMessage(m); return true; }
    if (!this.rechner.length) { setTimeout(() => { if (m.art === 'chunk') this.chunkFertig(m.cx!, m.cz!, bauChunk(m.cx!, m.cz!, m.aend)); else this.uebersichtFertig(uebersicht()); }, 0); return true; }
    return false;
  }
  private antwort(w: Worker, m: any): void {
    this.frei.push(w);
    if (m.gen !== this.gen) return;
    if (m.art === 'chunk') this.chunkFertig(m.cx, m.cz, m.r);
    if (m.art === 'uebersicht') this.uebersichtFertig(m.u);
  }
  private chunkFertig(cx: number, cz: number, r: ChunkDaten): void {
    const k = cx * 1000 + cz; this.inArbeit.delete(k);
    const alt = this.geladen.get(k); if (alt) { weg(alt.grp); alt.extra.forEach(weg); }
    if (this.neuBauen.has(k)) { this.neuBauen.delete(k); setTimeout(() => this.kachelNeu(cx, cz), 0); }
    const grp = new THREE.Group(); grp.position.set(cx * CH, 0, cz * CH);
    grp.add(zuGruppe(r.grob, 1)); grp.add(zuGruppe(r.fein, 0.5));
    const extra: THREE.Object3D[] = [];
    if (r.wasser.length) extra.push(becken(r.wasser, WASSER)); if (r.lava.length) extra.push(becken(r.lava, LAVA));
    for (const e of extra) this.gruppe.add(e);
    this.gruppe.add(grp); this.geladen.set(k, { grp, extra, cx, cz });
    this.maske[(cz + this.NCH / 2) * this.NCH + (cx + this.NCH / 2)] = 255; this.maskeTex.needsUpdate = true;
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
    if (this.auftrag({ art: 'chunk', cx, cz })) this.inArbeit.add(k); else this.neuBauen.add(k);
  }
  private baueWald(liste: Float32Array): void {
    const n = liste.length / 4;
    const mat = mitLichtkarte(new THREE.MeshStandardMaterial({ roughness: 0.9 }), 1.2);
    const alt = mat.onBeforeCompile, mt = this.maskeTex;
    mat.onBeforeCompile = (sh, r) => { alt(sh, r); sh.uniforms.uMaske = { value: mt }; sh.fragmentShader = 'uniform sampler2D uMaske;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `if (texture2D(uMaske, (vWP.xz + ${WR.toFixed(1)}) / ${(2 * WR).toFixed(1)}).r > 0.5) discard;\n#include <clipping_planes_fragment>`); };
    mat.customProgramCacheKey = () => 'grober-wald';
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const stamm = new THREE.InstancedMesh(box, mat, n), krone = new THREE.InstancedMesh(box, mat, n);
    stamm.castShadow = krone.castShadow = true; stamm.receiveShadow = krone.receiveShadow = true;
    const m = new THREE.Matrix4(), c = new THREE.Color(), index = new Map<number, number>();
    // Maße je Art: Stammhöhe, Kronenbreite, Kronenhöhe, Farben
    const ART: Record<number, [number, number, number, string, string]> = {
      0: [4.5, 4.6, 3.8, '#5e4128', '#4f8a3c'], 1: [1.5, 3.6, 9.5, '#4d3522', '#2f5a3a'], 2: [4.5, 4.4, 3.6, '#5e4128', '#c27030'],
      3: [4.5, 4.4, 3.6, '#5e4128', '#5b4e8a'], 4: [0, 2.6, 1.8, '#5e4128', '#4f8a3c'], 5: [6, 0, 0, '#3b302a', '#3b302a'], 9: [0, 2.6, 1.6, '#7d776f', '#8c867f']
    };
    for (let i = 0; i < n; i++) {
      const x = liste[i * 4] + 0.5, y = liste[i * 4 + 1], z = liste[i * 4 + 2] + 0.5, a = liste[i * 4 + 3];
      const [sh, kb, kh, sc, kc] = ART[a] || ART[0], v = 0.85 + h3(x, 3, z) * 0.3;
      m.makeScale(a === 9 ? 0 : 0.55, sh * v || 0.001, a === 9 ? 0 : 0.55).setPosition(x, y, z); stamm.setMatrixAt(i, m); stamm.setColorAt(i, c.set(sc));
      m.makeScale(kb * v || 0.001, kh * v || 0.001, kb * v || 0.001).setPosition(x, y + (a === 9 ? 0 : sh * v - (a === 1 ? 0 : 1)), z); krone.setMatrixAt(i, m); krone.setColorAt(i, c.set(kc).multiplyScalar(0.9 + h3(x, 4, z) * 0.2));
      index.set((Math.floor(x) + 600) * 2048 + (Math.floor(z) + 600), i);
    }
    this.gruppe.add(stamm, krone);
    this.wald = { stamm, krone, index, matS: (stamm.instanceMatrix.array as Float32Array).slice(), matK: (krone.instanceMatrix.array as Float32Array).slice() };
  }
  /** groben Baum an (x, z) aus- oder wieder einblenden */
  grobDeko(x: number, z: number, sichtbar: boolean): void {
    const w = this.wald; if (!w) return;
    const i = w.index.get((Math.floor(x) + 600) * 2048 + (Math.floor(z) + 600)); if (i === undefined) return;
    for (const [mesh, orig] of [[w.stamm, w.matS], [w.krone, w.matK]] as [THREE.InstancedMesh, Float32Array][]) {
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
    const wunsch: { cx: number; cz: number; d: number; k: number }[] = [];
    const c0x = Math.floor(ziel.x / CH), c0z = Math.floor(ziel.z / CH), n = Math.ceil(R / CH) + 1;
    for (let cx = c0x - n; cx <= c0x + n; cx++) for (let cz = c0z - n; cz <= c0z + n; cz++) {
      if (cx < -NCH / 2 || cz < -NCH / 2 || cx >= NCH / 2 || cz >= NCH / 2) continue;
      const d = Math.hypot((cx + 0.5) * CH - ziel.x, (cz + 0.5) * CH - ziel.z); if (d > R) continue;
      const k = cx * 1000 + cz; if (this.geladen.has(k) || this.inArbeit.has(k)) continue;
      kugel.center.set((cx + 0.5) * CH, 8, (cz + 0.5) * CH);
      wunsch.push({ cx, cz, d: kamera && !this.frustum.intersectsSphere(kugel) ? d * 2.5 + 60 : d, k });
    }
    wunsch.sort((a, b) => a.d - b.d);
    for (const w of wunsch) { if (!this.auftrag({ art: 'chunk', cx: w.cx, cz: w.cz })) break; this.inArbeit.add(w.k); }
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
      if (this.frustum.intersectsSphere(kugel) && !this.geladen.has(cx * 1000 + cz)) return false;
    }
    return true;
  }

  // ---------- Bodennebel ----------
  private nebelMaterial(k: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { ...this.NEBEL_U, uLage: { value: k } },
      vertexShader: 'attribute float aLand; varying float vLand; varying vec3 vW; void main(){ vLand = aLand; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uZeit, uDichte, uLage; uniform vec3 uFarbe; uniform sampler2D uMaske; varying float vLand; varying vec3 vW; ${NOISE_GLSL}
        void main(){
          float frei = smoothstep(0.2, 0.8, texture2D(uMaske, (vW.xz + ${WR.toFixed(1)}) / ${(2 * WR).toFixed(1)}).r);
          vec2 p = vW.xz * 0.03 + vec2(uZeit * 0.012 * (1.0 + uLage * 0.3), uZeit * 0.007) + uLage * 3.7;
          float n = fbm(p);
          float gross = fbm(vW.xz * 0.0065 + vec2(uZeit * 0.006, -uZeit * 0.004));
          float wechsel = mix(0.4, 1.25, smoothstep(0.32, 0.72, gross)) * (0.88 + 0.12 * sin(uZeit * 0.21 + gross * 9.0));
          float a = uDichte * (0.45 + 0.9 * n) * wechsel * (1.0 - frei) * vLand * (1.0 - uLage * 0.06);
          if (a < 0.01) discard;
          gl_FragColor = vec4(uFarbe * (0.9 + 0.18 * n), a);
        }`,
      transparent: true, depthWrite: false
    });
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
    for (let k = 0; k < 8; k++) {
      const pos = new Float32Array(V * V * 3), idx: number[] = [];
      for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) { const o = (i * V + j) * 3; pos[o] = -WR + i * NZ; pos[o + 1] = grund[i * V + j] + 0.6 + k * 0.95; pos[o + 2] = -WR + j * NZ; }
      for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) { const a = i * V + j, b = (i + 1) * V + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aLand', new THREE.BufferAttribute(land, 1)); geo.setIndex(idx);
      const m = new THREE.Mesh(geo, this.nebelMaterial(k)); m.renderOrder = 10 + k; m.frustumCulled = false; this.scene.add(m); this.nebelSchichten.push(m);
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
