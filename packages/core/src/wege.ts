import { WR, spalte, seed } from './welt.ts';

/**
 * Wege für Menschen: um Wasser und Lava herum statt hindurch.
 * Je Block wird einmal gemerkt, ob er trocken ist. Gesucht wird nur, wenn die gerade Linie nass wäre.
 */
const N = 2 * WR;
let trockenKarte = new Uint8Array(N * N), karteSeed = NaN;
/** 0 = unbekannt, 1 = trocken, 2 = Wasser, Lava oder kein Land */
export function trocken(x: number, z: number): boolean {
  if (seed() !== karteSeed) { trockenKarte = new Uint8Array(N * N); karteSeed = seed(); }
  const X = Math.floor(x) + WR, Z = Math.floor(z) + WR;
  if (X < 0 || Z < 0 || X >= N || Z >= N) return false;
  const i = Z * N + X; let v = trockenKarte[i];
  if (!v) { const s = spalte(Math.floor(x), Math.floor(z)); v = s && s.a !== 'w' && s.a !== 'l' ? 1 : 2; trockenKarte[i] = v; }
  return v === 1;
}
/** führt die gerade Strecke nur über trockene Blöcke? */
export function freieSicht(ax: number, az: number, bx: number, bz: number): boolean {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.4);
  for (let i = 1; i <= n; i++) { const t = i / n; if (!trocken(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
  return true;
}

// kleiner Binärhaufen für die Suche
class Haufen { k: number[] = []; w: number[] = [];
  push(k: number, w: number) { const K = this.k, W = this.w; let i = K.length; K.push(k); W.push(w); while (i > 0) { const p = (i - 1) >> 1; if (W[p] <= w) break; K[i] = K[p]; W[i] = W[p]; i = p; } K[i] = k; W[i] = w; }
  pop(): number { const K = this.k, W = this.w, top = K[0], lk = K.pop()!, lw = W.pop()!; const n = K.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && W[c + 1] < W[c]) c++; if (W[c] >= lw) break; K[i] = K[c]; W[i] = W[c]; i = c; } K[i] = lk; W[i] = lw; } return top; }
  get size() { return this.k.length; } }

/**
 * Weg von (sx, sz) nach (zx, zz) als Liste von Wegpunkten (der letzte ist das Ziel oder, wenn das Ziel nass ist,
 * der nächste trockene Block daneben). Leer = gerade Linie geht. null = kein Weg gefunden (dann gerade, wie bisher).
 */
export function trockenerWeg(sx: number, sz: number, zx: number, zz: number, maxSchritte = 6000): [number, number][] | null {
  const zielTrocken = trocken(zx, zz);
  if (zielTrocken && freieSicht(sx, sz, zx, zz)) return [];
  const R = 64, x0 = Math.floor(Math.min(sx, zx)) - R, z0 = Math.floor(Math.min(sz, zz)) - R;
  const B = Math.max(Math.floor(Math.max(sx, zx)) - x0, Math.floor(Math.max(sz, zz)) - z0) + R + 1;
  if (B > 400) return null; // zu weit für eine Suche
  const idx = (x: number, z: number) => (z - z0) * B + (x - x0);
  const g = new Float32Array(B * B).fill(Infinity), von = new Int32Array(B * B).fill(-1);
  const ax = Math.floor(sx), az = Math.floor(sz), bx = Math.floor(zx), bz = Math.floor(zz);
  const h = (x: number, z: number) => Math.hypot(x - bx, z - bz);
  const offen = new Haufen(); const s0 = idx(ax, az); g[s0] = 0; offen.push(s0, h(ax, az));
  let ende = -1, schritte = 0;
  while (offen.size && schritte++ < maxSchritte) {
    const k = offen.pop(), x = (k % B) + x0, z = Math.floor(k / B) + z0;
    if ((x === bx && z === bz) || (!zielTrocken && Math.abs(x - bx) <= 1 && Math.abs(z - bz) <= 1)) { ende = k; break; }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz; if (nx < x0 || nz < z0 || nx >= x0 + B || nz >= z0 + B) continue;
      if (!trocken(nx, nz)) continue;
      if (dx && dz && (!trocken(x + dx, z) || !trocken(x, z + dz))) continue; // keine Ecken am Ufer abschneiden
      const nk = idx(nx, nz), ng = g[k] + (dx && dz ? 1.4142 : 1);
      if (ng < g[nk]) { g[nk] = ng; von[nk] = k; offen.push(nk, ng + h(nx, nz)); }
    }
  }
  if (ende < 0) return null;
  const roh: [number, number][] = [];
  for (let k = ende; k >= 0 && k !== s0; k = von[k]) roh.push([(k % B) + x0 + 0.5, Math.floor(k / B) + z0 + 0.5]);
  roh.reverse();
  if (zielTrocken) roh[roh.length - 1] = [zx, zz]; else if (!roh.length) return [];
  // glätten: Punkte überspringen, solange die Sicht frei ist
  const aus: [number, number][] = []; let px = sx, pz = sz, i = 0;
  while (i < roh.length) {
    let j = roh.length - 1; while (j > i && !freieSicht(px, pz, roh[j][0], roh[j][1])) j--;
    aus.push(roh[j]); [px, pz] = roh[j]; i = j + 1;
  }
  return aus;
}
