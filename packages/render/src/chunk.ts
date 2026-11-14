import { CH, WR, PAL, spalte, deko, orte, rng, h3, seed, type Spalte } from '@runeboom/core';
import { Grid, meshVoxels, srgbLin, type MeshDaten, type Voxel } from './voxel.ts';
import { baum, fels, kristalle, riss, stumpf, setzling } from './modelle.ts';

export interface ChunkDaten { grob: (MeshDaten | null)[]; fein: (MeshDaten | null)[]; wasser: Float32Array; lava: Float32Array }

/** Eine Kachel (32 × 32 Blöcke) bauen: Boden, Becken, Pflanzen, Kristallfelder, Risse. Läuft im Hintergrund-Rechner. */
/**
 * Detailstufen: 3 = alles in halben Voxeln (nah); 2 = Bäume, Felsen, Kristalle in ganzen Voxeln, ohne Gras und Blumen (mittel);
 * 1 = nur Boden, Kristallfelder und Risse, dort stehen die groben Bäume (fern)
 */
export function bauChunk(cx: number, cz: number, aenderungen: [number, number, string][] = [], stufe = 3): ChunkDaten {
  const aend = new Map<number, string>(); for (const [x, z, a] of aenderungen) aend.set(x * 4096 + z, a);
  const ox = cx * CH, oz = cz * CH;
  const g = new Grid(), F = new Grid(); g.o = [-ox, 0, -oz, 0]; F.o = [-2 * ox, 0, -2 * oz, 0];
  const cache = new Map<number, Spalte | null>();
  const S = (x: number, z: number) => { const k = x * 4096 + z; let v = cache.get(k); if (v === undefined) { v = spalte(x, z); cache.set(k, v); } return v; };
  const wasser: number[] = [], lava: number[] = [];
  for (let x = ox - 1; x <= ox + CH; x++) for (let z = oz - 1; z <= oz + CH; z++) {
    const s = S(x, z); if (!s) continue;
    const asch = s.a === 'asche' || s.a === 'l', innen = x >= ox && x < ox + CH && z >= oz && z < oz + CH;
    // Seitenwände bis zum tiefsten Nachbarn, damit an Stufen (auch geebneten) keine Lücken bleiben
    let tiefst = s.h; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = S(x + dx, z + dz); if (n && n.h < tiefst) tiefst = n.h; }
    const unten = Math.min(innen ? s.h - s.dep : s.h - 3, tiefst);
    for (let y = unten; y <= s.h; y++) {
      const col = y === s.h ? s.col : y >= s.h - 2 ? (asch ? PAL.ascheE : PAL.erde) : y > s.h - 7 ? (asch ? PAL.basalt : (y % 3 ? PAL.stein : PAL.stein2)) : PAL.tief;
      g.set(x, y, z, col, 0, 0.09);
    }
    if (innen && s.a === 'w') wasser.push(x, s.h + 1.72, z);
    if (innen && s.a === 'l') lava.push(x, s.h + 1.62, z);
  }
  const fein = (x: number, z: number): [number, number, number] => { const s = S(x, z); return [2 * x + 1, 2 * ((s ? s.h : 6) + 1), 2 * z + 1]; };
  const r = rng((cx * 7919 + cz * 104729 + seed()) >>> 0);
  if (stufe >= 2) for (let x = ox; x < ox + CH; x++) for (let z = oz; z < oz + CH; z++) {
    const s = S(x, z); if (!s) continue;
    const dk = deko(x, z, s); if (!dk) continue;
    const [X, Y, Z] = fein(x, z);
    const zu = aend.get(x * 4096 + z);
    if (zu === 'weg' && dk.art !== 'gras') continue;
    if (dk.art === 'baum' && zu) { if (zu === 'stumpf') stumpf(F, X, Y, Z, dk.typ); else setzling(F, X, Y, Z, r, dk.typ); continue; }
    if (dk.art === 'baum') baum(F, X, Y, Z, r, dk.typ);
    else if (dk.art === 'fels') fels(F, X, Y, Z, 1.6 + r() * 1.6, r, s.a === 'asche' ? '#3a383c' : '#8c867f');
    else {
      const fx = X + Math.floor(r() * 2) - 1, fz = Z + Math.floor(r() * 2) - 1;
      // Zufallszahlen immer gleich ziehen, damit die Bäume in jeder Stufe gleich aussehen; Gras nur nah
      if (r() < 0.75) { if (stufe >= 3) F.set(fx, Y, fz, '#7fb04e'); if (r() > 0.5 && stufe >= 3) F.set(fx, Y + 1, fz, '#8fbd58'); }
      else { const farbe = ['#e8d06a', '#d86aa8', '#8fd0ff', '#f2f0ea'][Math.floor(r() * 4)]; if (stufe >= 3) F.set(fx, Y, fz, farbe); }
    }
  }
  for (const o of orte()) {
    if (Math.floor(o.x / CH) !== cx || Math.floor(o.z / CH) !== cz) continue;
    const [X, Y, Z] = fein(o.x, o.z);
    if (o.typ === 'kristall') kristalle(F, X, Y, Z, r, 9);
    if (o.typ === 'riss') riss(F, X, Y, Z);
  }
  const innen: Voxel[] = [];
  for (const v of g.m.values()) if (v.x >= 0 && v.x < CH && v.z >= 0 && v.z < CH) innen.push(v);
  // Boden und Pflanzen je Material in ein Netz: halb so viele Zeichenaufrufe
  const grob = meshVoxels(g, innen);
  if (stufe === 2) { // mittel: je 2 × 2 × 2 halbe Voxel zu einem ganzen (etwa ein Viertel der Dreiecke)
    const G = new Grid();
    for (const v of F.m.values()) {
      const x = Math.floor(v.x / 2), y = Math.floor(v.y / 2), z = Math.floor(v.z / 2), k = G.key(x, y, z), alt = G.m.get(k);
      if (!alt || (v.e !== 0 && alt.e === 0) || (v.y > alt.y * 2 + 1 && v.e === alt.e)) G.m.set(k, { ...v, x, y, z });
    }
    const mittel = meshVoxels(G, G.m.values());
    return { grob: grob.map((a, k) => vereine(a, mittel[k], 1)), fein: [], wasser: new Float32Array(wasser), lava: new Float32Array(lava) };
  }
  const feinM = meshVoxels(F, F.m.values());
  return { grob: grob.map((a, k) => vereine(a, feinM[k], 0.5)), fein: [], wasser: new Float32Array(wasser), lava: new Float32Array(lava) };
}

/** zwei Netze zu einem; das zweite wird dabei um sb verkleinert (halbe Voxel) */
export function vereine(a: MeshDaten | null, b: MeshDaten | null, sb: number): MeshDaten | null {
  if (!b) return a;
  if (!a) { const p = b.p.slice(); for (let k = 0; k < p.length; k++) p[k] *= sb; return { p, n: b.n, c: b.c, i: b.i }; }
  const p = new Float32Array(a.p.length + b.p.length), n = new Int8Array(a.n.length + b.n.length), c = new Float32Array(a.c.length + b.c.length), i = new Uint32Array(a.i.length + b.i.length);
  p.set(a.p); n.set(a.n); c.set(a.c); i.set(a.i);
  const vo = a.p.length / 3;
  for (let k = 0; k < b.p.length; k++) p[a.p.length + k] = b.p[k] * sb;
  n.set(b.n, a.n.length); c.set(b.c, a.c.length);
  for (let k = 0; k < b.i.length; k++) i[a.i.length + k] = b.i[k] + vo;
  return { p, n, c, i };
}

export interface UebersichtDaten { p: Float32Array; n: Int8Array; c: Float32Array; i: Uint32Array; hoch: Float32Array; boden: Float32Array; farbe: Uint8Array; N: number;
  /** grobe Bäume und Felsen der ganzen Welt: je 4 Werte x, Bodenhöhe, z, Art (0 laub, 1 tanne, 2 herbst, 3 leucht, 4 busch, 5 tot, 9 fels) */
  dekoListe: Float32Array }

/** Übersicht der ganzen Welt in Zellen zu 4 × 4 Blöcken (weite Sicht und Übersichtskarte) */
export function uebersicht(): UebersichtDaten {
  const Z = 4, N = (2 * WR) / Z;
  const hoch = new Float32Array(N * N).fill(-999), boden = new Float32Array(N * N).fill(-999), farbe = new Uint8Array(N * N * 3);
  const L = orte();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -WR + i * Z + 2, z = -WR + j * Z + 2, s = spalte(x, z); if (!s) continue;
    let top = s.h + 1, col = s.col;
    if (s.a === 'w') { top = s.h + 1.72; col = '#3f7fa0'; }
    if (s.a === 'l') { top = s.h + 1.62; col = '#c8501a'; }
    boden[i * N + j] = top;
    for (const o of L) if (o.typ === 'kristall' && Math.abs(x - o.x) < 4 && Math.abs(z - o.z) < 4) { col = '#7fe9ff'; top += 2; }
    hoch[i * N + j] = top;
    const c = parseInt(col.slice(1), 16); farbe.set([(c >> 16) & 255, (c >> 8) & 255, c & 255], (j * N + i) * 3);
  }
  // grobe Bäume und Felsen: jede Kachel der Welt einmal fragen
  const ART: Record<string, number> = { laub: 0, tanne: 1, herbst: 2, leucht: 3, busch: 4, tot: 5 };
  const dl: number[] = [];
  for (let x = -WR; x < WR; x++) for (let z = -WR; z < WR; z++) {
    if (h3(x, 9, z) > 0.07 && h3(x, 11, z) > 0.05) continue; // schneller Vorfilter (siehe deko)
    const s = spalte(x, z); if (!s) continue;
    const d = deko(x, z, s); if (!d || d.art === 'gras') continue;
    dl.push(x, s.h + 1, z, d.art === 'fels' ? 9 : ART[d.typ]);
  }
  const p: number[] = [], n: number[] = [], c: number[] = [], idx: number[] = [];
  const quad = (a: number[], b: number[], cc: number[], d: number[], nx: number, ny: number, nz: number, rgb: number[], k: number) => {
    const base = p.length / 3; p.push(...a, ...b, ...cc, ...d);
    for (let q = 0; q < 4; q++) { n.push(nx, ny, nz); c.push(rgb[0] * k, rgb[1] * k, rgb[2] * k); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const h = hoch[i * N + j]; if (h < -900) continue;
    const x0 = -WR + i * Z, z0 = -WR + j * Z, x1 = x0 + Z, z1 = z0 + Z;
    const o = (j * N + i) * 3, rgb = [srgbLin(farbe[o] / 255), srgbLin(farbe[o + 1] / 255), srgbLin(farbe[o + 2] / 255)];
    quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], 0, 1, 0, rgb, 1);
    const nb = (a: number, b: number) => (a < 0 || b < 0 || a >= N || b >= N ? -999 : hoch[a * N + b]);
    const unten = (v: number) => (v < -900 ? h - 24 : v);
    let v = unten(nb(i + 1, j)); if (v < h) quad([x1, h, z0], [x1, h, z1], [x1, v, z1], [x1, v, z0], 1, 0, 0, rgb, 0.78);
    v = unten(nb(i - 1, j)); if (v < h) quad([x0, h, z1], [x0, h, z0], [x0, v, z0], [x0, v, z1], -1, 0, 0, rgb, 0.7);
    v = unten(nb(i, j + 1)); if (v < h) quad([x1, h, z1], [x0, h, z1], [x0, v, z1], [x1, v, z1], 0, 0, 1, rgb, 0.85);
    v = unten(nb(i, j - 1)); if (v < h) quad([x0, h, z0], [x1, h, z0], [x1, v, z0], [x0, v, z0], 0, 0, -1, rgb, 0.65);
  }
  return { p: new Float32Array(p), n: new Int8Array(n), c: new Float32Array(c), i: new Uint32Array(idx), hoch, boden, farbe, N, dekoListe: new Float32Array(dl) };
}
