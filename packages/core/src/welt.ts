import { h3, rng, noise, fbm, clamp01 } from './zufall.ts';

/**
 * Die Welt: 1024 × 1024 Blöcke (x, z von -512 bis 511), prozedural aus dem Seed des Weltcodes.
 * Alles hier ist rein rechnerisch (kein DOM, kein Three.js) und läuft in der Simulation, auf der
 * Seite und in den Hintergrund-Rechnern gleich.
 */
export const WR = 512, CH = 32;
export const B = { x: 0, z: -40 };                       // Hauptgebäude (Mitte)
export const RISS = { x: 6, z: B.z + 124 };               // erster Riss, durch den Pfad verbunden
export const RISS2 = { x: B.x + 150, z: B.z + 30 };       // öffnet sich später
export const GLUT = { x: B.x + 30, z: B.z + 16 }, TEICH = { x: B.x - 24, z: B.z + 6 };
export const PAL = {
  gras: ['#4f8234', '#5d8f3c', '#6a9a42', '#7ea74c'], erde: '#7b5636', stein: '#8a837b', stein2: '#7d766f', tief: '#575260',
  asche: ['#55514d', '#4c4845', '#5d5853'], ascheE: '#45403d', basalt: '#36333a',
  fels: ['#8d877f', '#9a948b', '#807a73'], schnee: '#eef0f2', pfad: ['#b49c6c', '#a58d5f']
};
export type Art = 'gras' | 'asche' | 'fels' | 'schnee' | 'w' | 'l';
export interface Spalte { h: number; a: Art; col: string; dep: number; db: number }
export interface Ort { typ: 'riss' | 'kristall'; x: number; z: number; r: number; spaeter?: boolean }

let SEED = 4127;
let ORTE: Ort[] | null = null;
const roheCache = new Map<number, ReturnType<typeof rohBerechnen>>();
export function setzeSeed(s: number): void { SEED = s; ORTE = null; roheCache.clear(); }
export function seed(): number { return SEED; }

export function pfadX(z: number): number {
  const z0 = B.z + 13, t = clamp01((z - z0) / 30);
  return B.x + Math.round((Math.sin((z - z0) * 0.05) * 12 + (Math.sin(z * 0.03) - Math.sin(z0 * 0.03)) * 10) * t);
}
export function amPfad(x: number, z: number, w: number): boolean { return z > B.z + 11 && z < RISS.z + 2 && Math.abs(x - pfadX(z)) <= w; }

function rohBerechnen(x: number, z: number) {
  const d = Math.hypot(x, z) / WR + (fbm(x, z, 0.012, SEED) - 0.5) * 0.16; if (d > 1) return null;
  const db = Math.hypot(x - B.x, z - B.z), t = clamp01((db - 18) / 14);
  const v = fbm(x, z, 0.035, SEED + 1), lo = fbm(x, z, 0.008, SEED + 2);
  const berg = Math.max(0, d - 0.8) * 44 * fbm(x, z, 0.05, SEED + 7) + Math.max(0, lo - 0.6) * 55 * fbm(x, z, 0.03, SEED + 8);
  let h = 6 + Math.round((Math.max(0, v - 0.46) * 18 + berg) * t);
  if (amPfad(x, z, 3)) h = Math.min(h, 7);
  let a: Art = 'gras';
  const dg = Math.hypot(x - GLUT.x, z - GLUT.z), dr = Math.min(Math.hypot(x - RISS.x, z - RISS.z), Math.hypot(x - RISS2.x, z - RISS2.z));
  if ((fbm(x, z, 0.011, SEED + 50) > 0.63 && t > 0.8) || dg < 8) a = 'asche';
  let pool: Art | null = null;
  if (a === 'gras' && t > 0.7 && dr > 14 && !amPfad(x, z, 4) && (v < 0.32 || lo < 0.3)) pool = 'w';
  if (Math.hypot(x - TEICH.x, z - TEICH.z) < 3.6 + noise(x * 0.5, z * 0.5, 3)) pool = 'w';
  if (a === 'asche' && dr > 14 && !amPfad(x, z, 4) && (fbm(x, z, 0.09, SEED + 60) < 0.3 || dg < 3.8 + noise(x * 0.4, z * 0.4, 5) * 1.5)) pool = 'l';
  if (dr < 12) h = Math.min(h, 8);
  if (h >= 12 && !pool) a = h >= 17 ? 'schnee' : 'fels';
  if (pool) { h = 5; a = pool; }
  return { d, db, h, a };
}
export function roh(x: number, z: number) {
  const k = (x + 600) * 2048 + (z + 600);
  let r = roheCache.get(k);
  if (r === undefined) { r = rohBerechnen(x, z); if (roheCache.size > 400000) roheCache.clear(); roheCache.set(k, r); }
  return r;
}
export function spalte(x: number, z: number): Spalte | null {
  const r = roh(x, z); if (!r) return null;
  const { h, a } = r; let col: string;
  if (a === 'gras') col = PAL.gras[Math.min(3, Math.floor(fbm(x, z, 0.16, SEED + 9) * 4.8))];
  else if (a === 'asche') {
    col = PAL.asche[Math.floor(h3(x, 0, z) * 3)];
    rand: for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { if (!dx && !dz) continue; const q = roh(x + dx, z + dz); if (q && q.a === 'l') { col = '#2f2a2a'; break rand; } }
  } else if (a === 'fels') col = PAL.fels[Math.floor(h3(x, 1, z) * 3)];
  else if (a === 'schnee') col = PAL.schnee;
  else if (a === 'w') col = '#6e6a52'; else col = '#2a1a14';
  const pool = a === 'w' || a === 'l';
  if (amPfad(x, z, 1.5) && !pool) col = PAL.pfad[(x + z) & 1];
  const dep = r.d > 0.86 ? Math.round((1 - Math.pow(Math.min(r.d, 1), 1.25)) * 60 + fbm(x, z, 0.2, SEED + 5) * 6) + 3 : 3;
  return { h, a, col, dep, db: r.db };
}
export function orte(): Ort[] {
  if (ORTE) return ORTE;
  const L: Ort[] = [{ typ: 'riss', x: RISS.x, z: RISS.z, r: 10 }, { typ: 'riss', x: RISS2.x, z: RISS2.z, r: 10, spaeter: true }];
  for (const [x, z] of [[400, 60], [-350, -220], [-120, 400]]) if (roh(x, z)) L.push({ typ: 'riss', x, z, r: 10, spaeter: true });
  for (const [x, z] of [[B.x + 34, B.z - 18], [B.x - 16, B.z - 34], [B.x - 46, B.z + 30]]) L.push({ typ: 'kristall', x, z, r: 8 });
  const r = rng(SEED + 5);
  for (let i = 0; i < 70; i++) {
    const x = Math.round((r() - 0.5) * 2 * WR * 0.9), z = Math.round((r() - 0.5) * 2 * WR * 0.9), s = roh(x, z);
    if (!s || s.a === 'w' || s.a === 'l' || s.db < 50 || amPfad(x, z, 8)) continue;
    L.push({ typ: 'kristall', x, z, r: 8 });
  }
  ORTE = L; return L;
}
/** Ist hier Platz für Bewuchs? (nicht Feste, Pfad, Orte, Becken) */
export function frei(x: number, z: number, s: Spalte): boolean {
  if (s.a === 'w' || s.a === 'l') return false;
  if (s.db < 24 || amPfad(x, z, 4)) return false;
  for (const o of orte()) if (Math.abs(x - o.x) < o.r && Math.abs(z - o.z) < o.r && Math.hypot(x - o.x, z - o.z) < o.r) return false;
  return true;
}
export type Deko = { art: 'baum'; typ: string } | { art: 'fels' } | { art: 'gras' } | null;
/** Was wächst auf dieser Kachel? Gleiche Antwort für Grafik und Simulation. */
export function deko(x: number, z: number, s: Spalte | null = spalte(x, z)): Deko {
  if (!s || !frei(x, z, s)) return null;
  const a = s.a, wald = fbm(x, z, 0.045, SEED + 20);
  const p = a === 'gras' ? (wald > 0.58 ? 0.06 : 0.007) : a === 'asche' ? 0.02 : a === 'fels' ? 0.02 : 0;
  if (h3(x, 9, z) < p) {
    const q = h3(x, 5, z);
    const typ = a === 'asche' ? 'tot' : (a === 'fels' || (wald > 0.66 && h3(x, 4, z) > 0.4)) ? 'tanne' : q > 0.94 ? 'leucht' : q > 0.84 ? 'herbst' : q > 0.7 ? 'busch' : 'laub';
    return { art: 'baum', typ };
  }
  if (h3(x, 11, z) < (a === 'fels' ? 0.05 : 0.008)) return { art: 'fels' };
  if (a === 'gras' && h3(x, 12, z) < 0.12) return { art: 'gras' };
  return null;
}
export function istWald(x: number, z: number, s: Spalte): boolean { return s.a === 'gras' && fbm(x, z, 0.045, SEED + 20) > 0.58 && frei(x, z, s); }
/** Kann man hier gehen? (keine Becken, keine hohen Felsen) */
export function begehbar(s: Spalte | null): boolean { return !!s && s.a !== 'w' && s.a !== 'l' && s.h < 14; }
export function hoehe(x: number, z: number): number { const s = spalte(Math.floor(x), Math.floor(z)); return s ? s.h + 1 : 0; }
