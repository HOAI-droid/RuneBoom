import { gebGrid, wesenGrid } from '@runeboom/render';
import type { GebTyp, GegTyp } from '@runeboom/core';

/**
 * Erfinderskizzen im Stil „Leonardo mit Voxeln“: das echte Voxel-Modell eines Gebäudes als Federzeichnung.
 * Isometrisch, nur Kanten, an denen die Form abknickt; Seiten schraffiert (Muster in index.html, #sk-…).
 */
const cache = new Map<string, string>();

/** grob: so viele halbe Voxel werden zu einem zusammengefasst (kleine Skizzen 2–3, große 1) */
export function skizze(typ: GebTyp, breite: number, hoehe: number, grob = 1, volk = ''): string {
  return skizzeAus(`g/${typ}/${volk}`, () => gebGrid(typ, false, undefined, 1, 0, volk), breite, hoehe, grob);
}
/** Skizze eines Wesens */
export function wesenSkizze(typ: GegTyp, breite: number, hoehe: number, grob = 1): string {
  return skizzeAus(`w/${typ}`, () => wesenGrid(typ), breite, hoehe, grob);
}
function skizzeAus(name: string, grid: () => ReturnType<typeof gebGrid>, breite: number, hoehe: number, grob: number): string {
  const key = `${name}/${breite}/${hoehe}/${grob}`;
  const alt = cache.get(key); if (alt) return alt;
  const g = grid();
  const V = new Set<string>(), vox: [number, number, number][] = [];
  for (const v of g.m.values()) {
    const x = Math.floor(v.x / grob), y = Math.floor(v.y / grob), z = Math.floor(v.z / grob), k = `${x},${y},${z}`;
    if (!V.has(k)) { V.add(k); vox.push([x, y, z]); }
  }
  // Flächen sammeln
  type Flaeche = { v: [number, number, number]; a: 'o' | 'r' | 'l'; c: [number, number, number][] };
  const faces: Flaeche[] = [];
  for (const [x, y, z] of vox) {
    if (!V.has(`${x},${y + 1},${z}`)) faces.push({ v: [x, y, z], a: 'o', c: [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]] });
    if (!V.has(`${x + 1},${y},${z}`)) faces.push({ v: [x, y, z], a: 'r', c: [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]] });
    if (!V.has(`${x},${y},${z + 1}`)) faces.push({ v: [x, y, z], a: 'l', c: [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]] });
  }
  const ek = (a: string, p: number[], q: number[]) => { const A = p.join(','), B = q.join(','); return a + '|' + (A < B ? A + B : B + A); };
  const anzahl = new Map<string, number>();
  for (const f of faces) for (let i = 0; i < 4; i++) { const k = ek(f.a, f.c[i], f.c[(i + 1) % 4]); anzahl.set(k, (anzahl.get(k) || 0) + 1); }
  // isometrisch, auf die Fläche eingepasst
  const iso = (x: number, y: number, z: number): [number, number] => [(x - z) * 0.866, (x + z) * 0.5 - y];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of faces) for (const p of f.c) { const [a, b] = iso(p[0], p[1], p[2]); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
  const rand = 0.08, s = Math.min((breite * (1 - 2 * rand)) / (x1 - x0 || 1), (hoehe * (1 - 2 * rand)) / (y1 - y0 || 1));
  const ox = (breite - (x1 - x0) * s) / 2 - x0 * s, oy = (hoehe - (y1 - y0) * s) / 2 - y0 * s;
  const P = (p: [number, number, number]) => { const [a, b] = iso(p[0], p[1], p[2]); return `${(ox + a * s).toFixed(1)},${(oy + b * s).toFixed(1)}`; };
  faces.sort((p, q) => (p.v[0] + p.v[1] + p.v[2]) - (q.v[0] + q.v[1] + q.v[2]) || p.v[1] - q.v[1]);
  const fuell = { o: '#f2e1b9', r: 'url(#sk-h1)', l: 'url(#sk-h2)' };
  const strich = Math.max(0.7, Math.min(1.5, s * 0.11));
  let teile = '';
  for (const f of faces) {
    const pts = f.c.map(P);
    teile += `<path d="M${pts.join(' L')}Z" fill="${fuell[f.a]}"${f.a === 'o' ? ' stroke="#f2e1b9" stroke-width="0.5"' : ''}/>`;
    let d = '';
    for (let i = 0; i < 4; i++) if (anzahl.get(ek(f.a, f.c[i], f.c[(i + 1) % 4])) === 1) d += `M${pts[i]} L${pts[(i + 1) % 4]} `;
    if (d) teile += `<path d="${d}" fill="none" stroke="#3f2612" stroke-width="${strich.toFixed(2)}" stroke-linecap="round"/>`;
  }
  const svg = `<svg class="sk-bild" viewBox="0 0 ${breite} ${hoehe}" width="${breite}" height="${hoehe}" aria-hidden="true"><g filter="url(#sk-feder)">${teile}</g></svg>`;
  cache.set(key, svg);
  return svg;
}

/** Randnotiz in Spiegelschrift, wie in Leonardos Heften */
export function spiegelNotiz(text: string): string {
  return `<span class="sk-spiegel">${text.replace(/[<>&]/g, '')}</span>`;
}
