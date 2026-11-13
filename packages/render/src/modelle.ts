import { h3, rng } from '@runeboom/core';
import type { Grid } from './voxel.ts';

// ================= Bäume, Felsen, Kristalle (halbe Voxel) =================
export function baum(g, X, Y, Z, r, art) {
  g.at(X, Y, Z, 0, () => {
    if (art === 'tanne') {
      g.box(0, 0, 0, 1, 5, 1, '#4d3522');
      const hh = 16 + Math.floor(r() * 9);
      for (let i = 0; i < hh; i++) { const rr = (1 - i / hh) * 5.6 + 0.7 - (i % 4) * 0.45; g.cyl(0, 0, 4 + i, 4 + i, rr, (x, y) => (y % 4 === 0 ? '#3a6b45' : '#2c5638'), 0, 0.09); }
      g.box(0, 4 + hh, 0, 0, 5 + hh, 0, '#3a6b45');
      return;
    }
    if (art === 'tot') {
      const th = 9 + Math.floor(r() * 6);
      g.box(0, 0, 0, 1, th, 1, '#3b302a');
      g.line(0, th - 3, 0, -4, th + 1, -2, '#3b302a'); g.line(1, th - 5, 1, 5, th - 1, 2, '#3b302a'); g.line(0, th, 1, 1, th + 4, 3, '#3b302a');
      return;
    }
    if (art === 'busch') { g.ell(0, 1.5, 0, 2.6 + r(), 2, 2.4 + r(), (x, y) => (y > 1 ? '#5a9a46' : '#457d38'), 0, 0.12); return; }
    const th = 8 + Math.floor(r() * 6);
    for (const [x, z] of [[-1, 0], [2, 1], [0, -1], [1, 2]]) g.set(x, 0, z, '#563b24');
    g.box(0, 0, 0, 1, th, 1, '#5e4128', 0, 0.1);
    g.line(0, th - 3, 0, -3, th + 1, -2, '#5e4128'); g.line(1, th - 2, 1, 4, th + 1, 3, '#5e4128');
    const blatt = art === 'leucht' ? ['#5b4e8a', '#6e60a3', '#4a3f75'] : art === 'herbst' ? ['#c9722e', '#d98c35', '#a95a26'] : ['#4f8a3c', '#5e9a44', '#3f7433'];
    const blobs = [[0, 3, 0, 5], [-3, 2, -2, 3.6], [3, 2, 2, 3.6], [1, 5, -1, 3.4]];
    for (const [bx, by, bz, rr] of blobs) g.ell(bx + 0.5, th + by, bz + 0.5, rr + r(), rr * 0.75, rr + r(), (x, y, z) => (y > th + by + 1 ? blatt[1] : (h3(x, y, z) > 0.8 ? blatt[2] : blatt[0])), 0, 0.12);
    if (art === 'leucht') for (let i = 0; i < 7; i++) g.set(Math.round((r() - 0.5) * 10), th + Math.round(r() * 6), Math.round((r() - 0.5) * 10), '#9fe7ff', 2.4);
  });
}
export function fels(g, X, Y, Z, s, r, hex = '#8c867f') { g.at(X, Y, Z, 0, () => { g.ell(0, 0, 0, s * 1.2, s * 0.8, s, (x, y) => (y > s * 0.3 ? hex : '#76716a'), 0, 0.1); if (r() > 0.5) g.ell(s, -0.5, s * 0.5, s * 0.6, s * 0.5, s * 0.6, hex, 0, 0.1); }); }
export function kristalle(g, X, Y, Z, r, n = 7) {
  g.at(X, Y, Z, 0, () => {
    g.ell(0, 0, 0, 4.5, 1.5, 4.5, '#3d3946', 0, 0.12);
    for (let i = 0; i < n; i++) {
      const dx = Math.round((r() - 0.5) * 7), dz = Math.round((r() - 0.5) * 7), hh = 5 + Math.floor(r() * 9), lx = (r() - 0.5) * 0.5, lz = (r() - 0.5) * 0.5;
      for (let k = 0; k < hh; k++) { const x = dx + Math.round(k * lx), z = dz + Math.round(k * lz); const col = k > hh - 3 ? '#d8fdff' : '#6ff0ff';
        g.set(x, 1 + k, z, col, 1.9); if (k < hh * 0.5) { g.set(x + 1, 1 + k, z, '#4ab8c8', 1.4); g.set(x, 1 + k, z + 1, '#4ab8c8', 1.4); } }
    }
  });
}

// ================= Menschen (Achtel-Voxel, ca. 1,8 Blöcke groß, Blick nach +z) =================
export const AUGE = '#1d1a18';
export function figur8(g, X, Y, Z, rot, c) {
  g.at(X, Y, Z, rot, () => {
    const schuh = c.schuh || '#3a2c22';
    g.box(-2, 0, -1, -1, 0, 1, schuh); g.box(1, 0, -1, 2, 0, 1, schuh);
    g.box(-2, 1, -1, -1, 5, 0, c.hose); g.box(1, 1, -1, 2, 5, 0, c.hose); g.box(-2, 6, -1, 2, 6, 0, c.hose);
    g.box(-2, 7, -1, 2, 10, 1, c.kleid, 0, 0.05);
    g.box(-2, 7, -1, 2, 7, 1, c.guertel || '#3a2a1e'); g.set(0, 7, 1, '#c9a043');
    if (c.schuerze) g.box(-1, 3, 1, 1, 9, 1, c.schuerze);
    g.box(-1, 10, 1, 1, 10, 1, c.kragen || c.kleid);
    g.box(-3, 9, -1, -3, 10, 0, c.kleid); g.box(3, 9, -1, 3, 10, 0, c.kleid);
    g.box(-3, 6, 0, -3, 8, 0, c.aermel || c.kleid); g.box(3, 6, 0, 3, 8, 0, c.aermel || c.kleid);
    g.box(-3, 5, 0, -3, 5, 1, c.haut); g.box(3, 5, 0, 3, 5, 1, c.haut);
    g.box(-1, 11, -1, 1, 11, 0, c.haut);
    g.box(-2, 12, -2, 2, 15, 1, c.haut, 0, 0.04);
    g.set(-1, 13, 1, AUGE); g.set(1, 13, 1, AUGE); g.set(0, 13, 2, c.haut); g.set(0, 12, 1, '#9a5a50');
    if (c.haar) { g.box(-2, 16, -2, 2, 16, 1, c.haar); g.box(-2, 12, -2, 2, 15, -2, c.haar); g.box(-2, 14, -1, -2, 15, 0, c.haar); g.box(2, 14, -1, 2, 15, 0, c.haar); g.set(-1, 14, 1, c.haar); g.set(1, 14, 1, c.haar); }
    if (c.bart) { g.box(-2, 11, 2, 2, 12, 2, c.bart); g.box(-1, 10, 2, 1, 10, 2, c.bart); g.box(-2, 12, 1, -2, 13, 1, c.bart); g.box(2, 12, 1, 2, 13, 1, c.bart); g.set(0, 12, 2, c.bart); }
    if (c.helm) { g.box(-3, 16, -3, 3, 16, 2, c.helm); g.box(-2, 17, -2, 2, 17, 1, c.helm); g.set(0, 18, 0, c.helm); }
    if (c.kapuze) {
      for (let x = -3; x <= 3; x++) for (let y = 12; y <= 17; y++) for (let z = -3; z <= 2; z++) {
        if (Math.abs(x) <= 2 && y <= 15 && z >= -2 && z <= 1) continue;
        if (z === 2 && Math.abs(x) <= 2 && y <= 15) continue;
        if (Math.abs(x) === 3 && (y === 17 || z === 2) ) continue;
        g.set(x, y, z, c.kapuze, 0, 0.06);
      }
      g.set(0, 18, -3, c.kapuze); g.set(0, 19, -4, c.kapuze);
    }
    if (c.brille) { g.box(-2, 13, 2, 2, 13, 2, '#c99a3e'); g.set(-1, 13, 2, '#9fe7ff', -1.2); g.set(1, 13, 2, '#9fe7ff', -1.2); }
    if (c.umhang) { g.box(-3, 2, -2, 3, 10, -2, c.umhang, 0, 0.05); g.box(-3, 10, -1, 3, 10, -1, c.umhang); }
    if (c.werkzeug === 'axt') { g.box(4, 3, 1, 4, 11, 1, '#6b4a2f'); g.box(4, 9, 2, 4, 11, 3, '#9aa0a6'); }
    if (c.werkzeug === 'hacke') { g.box(4, 3, 1, 4, 12, 1, '#6b4a2f'); g.box(4, 12, -1, 4, 12, 3, '#7d838a'); }
    if (c.werkzeug === 'sack') g.box(-2, 7, -3, 2, 12, -2, '#b49c6c', 0, 0.06);
  });
}

// ================= Wesen (eigene Maßstäbe, Blick nach +z) =================
export function moorwicht(g, X, Y, Z, rot) {
  g.at(X, Y, Z, rot, () => {
    g.box(-2, 0, 0, -1, 1, 0, '#4f6136'); g.box(1, 0, 0, 2, 1, 0, '#4f6136');
    g.box(-2, 2, -1, 2, 4, 0, '#5a4630', 0, 0.15); g.box(-1, 2, 1, 1, 2, 1, '#5a4630');
    g.box(-3, 3, 0, -3, 4, 1, '#6f8a4a'); g.box(3, 3, 0, 3, 4, 1, '#6f8a4a');
    g.box(-2, 5, -1, 2, 7, 1, '#6f8a4a', 0, 0.08);
    g.box(-4, 6, 0, -3, 6, 0, '#6f8a4a'); g.set(-5, 7, 0, '#6f8a4a'); g.box(3, 6, 0, 4, 6, 0, '#6f8a4a'); g.set(5, 7, 0, '#6f8a4a');
    g.set(-1, 6, 2, '#ffd34a', 2.2); g.set(1, 6, 2, '#ffd34a', 2.2); g.set(0, 5, 2, '#5d7a3e');
    g.box(4, 0, 2, 4, 9, 2, '#6b4a2f'); g.box(4, 10, 2, 4, 11, 2, '#8c867f'); g.set(4, 12, 2, '#a8a29a');
  });
}
export function troll(g, X, Y, Z, rot) {
  g.at(X, Y, Z, rot, () => {
    g.box(-5, 0, -2, -2, 1, 2, '#4b5340'); g.box(2, 0, -2, 5, 1, 2, '#4b5340');
    g.box(-4, 2, -1, -2, 5, 1, '#5d664f'); g.box(2, 2, -1, 4, 5, 1, '#5d664f');
    g.ell(0, 9, 0, 6, 5, 4, '#6f7a5e', 0, 0.1);
    g.ell(0, 8, 2.5, 3.6, 3, 1.6, '#8a8f72', 0, 0.08);
    g.cyl(0, 0, 6, 7, 5.6, '#5a3d24', 0, 0.12, true);
    g.ell(0, 13, -1, 6.6, 3.6, 4, '#6f7a5e', 0, 0.1);
    g.ell(0, 15, -2, 5, 1.8, 3, '#4f7a3a', 0, 0.15, (x, y) => y >= 14);
    for (const [x, z] of [[-3, -3], [2, -4], [0, -2]]) g.set(x, 17, z, '#8c867f');
    g.box(-8, 4, -1, -6, 13, 1, '#68735a'); g.box(6, 4, -1, 8, 13, 1, '#68735a');
    g.ell(-7, 3, 0, 1.8, 1.8, 1.8, '#5d664f'); g.ell(7, 3, 0.5, 1.8, 1.8, 1.8, '#5d664f');
    g.line(7, 3, 2, 7, 1, 9, '#6b4a2f', 0, 0.08, 1); g.ell(7.5, 2, 11, 2.4, 2.4, 2.4, '#57402a', 0, 0.1);
    for (const [x, y, z] of [[7, 5, 11], [10, 2, 11], [7, 2, 14], [5, 3, 11]]) g.set(x, y, z, '#a8a29a');
    g.box(-2, 12, 3, 2, 16, 7, '#7d8868', 0, 0.08); g.box(-2, 16, 3, 2, 16, 7, '#5d664f');
    g.set(-1, 15, 7, '#ffb347', 2.4); g.set(1, 15, 7, '#ffb347', 2.4); g.set(0, 14, 8, '#6f7a5e');
    g.box(-2, 12, 8, -2, 13, 8, '#ece4cf'); g.box(2, 12, 8, 2, 13, 8, '#ece4cf');
    g.set(-3, 15, 5, '#7d8868'); g.set(3, 15, 5, '#7d8868');
  });
}
// dunkel = im Dunkeln nur zu erahnen: Körper fast schwarz, nur die Augen leuchten
export function wolf(g, X, Y, Z, rot, dunkel = false) {
  const F = (hex) => (dunkel ? '#0b0a0f' : hex);
  g.at(X, Y, Z, rot, () => {
    for (const [x, z] of [[-3, 4], [2, 4], [-3, -5], [2, -5]]) { g.box(x, 1, z, x + 1, 4, z + 1, F('#211d2a')); g.box(x, 0, z, x + 1, 0, z + 2, F('#3a3348')); }
    g.ell(0, 7, 0, 3.6, 3, 7, F('#2f2a3d'), 0, 0.1);
    g.ell(0, 9, 2.5, 4, 2.4, 4, F('#251f33'), 0, 0.12);
    g.ell(0, 9.5, 7.5, 2.7, 2.7, 2.6, F('#352f45'), 0, 0.08);
    g.box(-1, 7, 9, 1, 8, 12, F('#2a2537')); g.set(0, 8, 13, '#120f18'); g.box(-1, 6, 9, 1, 6, 11, F('#221d2c'));
    g.box(-2, 12, 6, -2, 13, 7, F('#2f2a3d')); g.box(2, 12, 6, 2, 13, 7, F('#2f2a3d'));
    g.set(-2, 10, 9, '#c98bff', 2.6); g.set(2, 10, 9, '#c98bff', 2.6);
    if (!dunkel) for (let z = -5; z <= 4; z += 2) g.set(0, 10, z, '#a070ff', 1.4);
    g.line(0, 8, -7, 0, 11, -12, F('#2f2a3d'), 0, 0.1, 1);
  });
}
export function drachling(g) {
  g.ell(0, 0, 0, 4, 3.6, 7.5, '#9e2b25', 0, 0.1);
  g.ell(0, -2, 1, 3, 2, 5.6, '#d9813a', 0, 0.08);
  g.ell(0, 2, 8, 2.2, 2.2, 3.2, '#a8322a', 0, 0.08);
  g.box(-2, 2, 11, 2, 5, 15, '#ad372d', 0, 0.08); g.box(-2, 1, 11, 2, 1, 15, '#7e211c');
  for (const s of [-2, 2]) { g.line(s, 6, 11, s, 8, 8, '#e8dcc0'); g.set(s, 4, 15, '#ffe066', 2.4); }
  for (const s of [-1, 1]) for (let i = 1; i <= 16; i++) {
    const x = s * (3 + i), y = 2 + Math.round(i * 0.4), len = Math.max(2, Math.round((17 - i) * 0.75));
    g.set(x, y, 2, '#4a1414'); g.set(x, y + 1, 2, '#4a1414');
    for (let k = 1; k <= len; k++) g.set(x, y, 2 - k, (i % 5 === 0) ? '#4a1414' : '#7a2420', 0, 0.12);
  }
  for (let i = 0; i < 14; i++) { const r2 = Math.max(0.6, 2.2 - i * 0.14); g.ell(0, -Math.round(i * 0.3), -7 - i, r2, r2, 0.6, i > 11 ? '#e8dcc0' : '#9e2b25'); if (i % 3 === 0) g.set(0, 2 - Math.round(i * 0.3), -7 - i, '#e8dcc0'); }
}
export function nebelrochen(g) {
  for (let x = -13; x <= 13; x++) for (let z = -9; z <= 9; z++) {
    const q = Math.abs(x) / 13 + Math.abs(z - Math.abs(x) * 0.25) / 8; if (q > 1) continue;
    const dick = q < 0.4 ? 2 : q < 0.75 ? 1 : 0, yb = Math.round(Math.abs(x) * 0.12);
    for (let y = 0; y <= dick; y++) g.set(x, y + yb, z, y === dick ? '#3b4f6b' : '#2c3b52', 0, 0.08);
    if (h3(x, 3, z) > 0.86 && q < 0.85) g.set(x, dick + 1 + yb, z, '#9fe7ff', 1.5);
  }
  g.set(-2, 3, 7, '#d6f6ff', 2.4); g.set(2, 3, 7, '#d6f6ff', 2.4);
  for (let i = 0; i < 16; i++) g.set(0, 1 - Math.round(Math.sin(i * 0.4) * 1.5), -9 - i, i > 13 ? '#9fe7ff' : '#2c3b52', i > 13 ? 2 : 0);
}

// ================= Türme (halbe Voxel) =================
export const mauerwerk = (a, b) => (x, y, z) => ((Math.floor(y / 2) + Math.floor((x + z + (Math.floor(y / 2) % 2) * 2) / 3)) % 2 ? a : b);
export function sockel(g, hex = '#8f897f') { g.box(-5, 0, -5, 5, 2, 5, mauerwerk(hex, '#837d74'), 0, 0.08); g.box(-4, 3, -4, 4, 3, 4, '#7d776f'); }
export function turmHolz(g, X, Y, Z, rot = 0) {
  g.at(X, Y, Z, rot, () => {
    sockel(g);
    for (let y = 4; y <= 19; y++) for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
      const ecke = Math.abs(x) >= 3 && Math.abs(z) >= 3, balken = y === 4 || y === 11 || y === 19;
      if (!ecke && !balken && y >= 13 && y <= 16 && (x === 0 || z === 0)) continue;
      g.set(x, y, z, ecke ? '#5a3d24' : balken ? '#6b4a2f' : (((x + z) & 1) ? '#9a7046' : '#8a6340'), 0, 0.1);
    }
    for (const s of [-1, 1]) { g.line(s * 4, 15, 0, s * 6, 19, 0, '#5a3d24'); g.line(0, 15, s * 4, 0, 19, s * 6, '#5a3d24'); }
    g.box(-6, 20, -6, 6, 20, 6, (x) => ((x & 1) ? '#7d5a36' : '#8a6640'));
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) if (Math.abs(x) === 6 || Math.abs(z) === 6) { if ((x + z) % 2 === 0) g.box(x, 21, z, x, 22, z, '#6b4a2f'); g.set(x, 23, z, '#5a3d24'); }
    for (let i = 0; i <= 8; i++) { const s = 7 - i; g.box(-s, 24 + i, -s, s, 24 + i, s, i % 2 ? '#8a3f2b' : '#7a3424', 0, 0.1); }
    g.box(0, 33, 0, 0, 35, 0, '#c9a043'); g.box(1, 34, 0, 2, 35, 0, '#9c2f2f');
    g.box(-2, 0, 7, 1, 7, 8, mauerwerk('#8c8a86', '#7c7a76'), 0, 0.06);
    for (const [x, y] of [[-1, 2], [-1, 3], [0, 3], [0, 4], [-1, 5], [0, 6]]) g.set(x, y, 9, '#6fc3ff', 1.8);
  });
}
export function turmAlchemie(g, X, Y, Z, rot = 0) {
  g.at(X, Y, Z, rot, () => {
    sockel(g);
    g.cyl(0, 0, 4, 20, 4.5, (x, y, z) => { const a = Math.floor((Math.atan2(z, x) + 4) * 2.2 + (Math.floor(y / 2) % 2)); return ((a + Math.floor(y / 2)) % 2) ? '#9a9187' : '#8b8278'; }, 0, 0.06);
    for (const y of [9, 20]) g.cyl(0, 0, y, y, 4.9, '#b87333', 0, 0.06, true);
    for (const [x, z] of [[0, 5], [5, 0], [-5, 0], [0, -5]]) g.box(x, 13, z, x, 14, z, '#ff9a3c', -2);
    for (let a = 0; a < 16; a++) if (a % 2 === 0) { const x = Math.round(Math.cos(a / 16 * 6.283) * 4.5), z = Math.round(Math.sin(a / 16 * 6.283) * 4.5); g.box(x, 21, z, x, 22, z, '#9a9187'); }
    g.cyl(0, 0, 21, 25, 3.2, '#3a3836', 0, 0.06, true);
    g.cyl(0, 0, 24, 24, 2.2, '#7dff6a', 1.8);
    for (const [x, y, z] of [[-1, 26, 0], [1, 27, 1], [0, 29, -1], [-1, 31, 1]]) g.set(x, y, z, '#9dff8a', 1.3);
    for (const s of [-1, 1]) { g.box(s * 5, 4, 2, s * 5, 20, 2, '#b87333'); for (const y of [7, 12, 17]) g.set(s * 6, y, 2, '#8a5428'); }
    g.ell(-6, 8, -2, 1.6, 2.2, 1.6, '#7dff6a', 1.4); g.box(-6, 11, -2, -6, 12, -2, '#c9c3b6');
  });
}
export function zahnrad(g, cx, cy, z, r, hex) {
  const R = Math.ceil(r + 1);
  for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
    const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if ((d >= r * 0.55 && d <= r) || (d > r && d <= r + 1.1 && Math.cos(a * Math.round(r * 2.2)) > 0.35)) g.set(cx + dx, cy + dy, z, hex, 0, 0.06);
    else if (d < 1.3) g.set(cx + dx, cy + dy, z, '#4a4c50');
  }
}
export function turmUhrwerk(g, X, Y, Z, rot = 0) {
  g.at(X, Y, Z, rot, () => {
    sockel(g);
    g.box(-4, 4, -4, 4, 22, 4, mauerwerk('#8b8a86', '#7f7e7a'), 0, 0.06);
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) for (let y = 4; y <= 22; y++) g.set(x, y, z, y % 3 === 0 ? '#6d7076' : '#4a4c50');
    zahnrad(g, -1, 13, 5, 4.2, '#c9a043'); zahnrad(g, 3, 7, 5, 2.4, '#b38a36');
    g.box(-5, 23, -5, 5, 23, 5, '#55575c');
    g.box(-2, 24, -2, 2, 26, 2, '#4a4c50');
    for (let z = -1; z <= 8; z++) g.cyl(0, z, 27, 27, 1.5, '#2e2f33');
    g.cyl(0, 8, 27, 27, 2, '#3a3b40', 0, 0, true);
    g.box(-4, 23, -4, -3, 34, -3, '#6a5a4a');
    const r = rng(5);
    for (let i = 0; i < 5; i++) g.ell(-3.5 + (r() - 0.3) * 3, 37 + i * 2.5, -3.5 + (r() - 0.5) * 3, 1.6 + i * 0.4, 1.3 + i * 0.3, 1.6 + i * 0.4, '#dcd9d3', 0, 0.04);
    g.box(5, 8, -1, 5, 9, 0, '#ff8a2a', -2);
  });
}
export function turmKristall(g, X, Y, Z, rot = 0) {
  g.at(X, Y, Z, rot, () => {
    sockel(g, '#4a4655');
    for (let y = 4; y <= 18; y++) { const s = y < 12 ? 4 : 3; g.box(-s, y, -s, s, y, s, '#3d3b47', 0, 0.08); for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) g.set(x, y, z, '#d4a640'); }
    g.box(-4, 11, -4, 4, 11, 4, '#d4a640'); g.box(-3, 18, -3, 3, 18, 3, '#d4a640');
    for (let y = 5; y <= 16; y++) for (const [x, z] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const s = y < 12 ? 4 : 3; if (y % 4 !== 0) g.set(x * s, y, z * s, '#6ff0ff', 1.6); }
    g.box(-2, 19, -2, 2, 22, 2, '#3d3b47'); g.box(-2, 22, -2, 2, 22, 2, '#d4a640');
    g.cyl(0, 0, 26, 26, 5, '#d4a640', 0, 0.05, true); g.cyl(0, 0, 32, 32, 3, '#d4a640', 0, 0.05, true);
    for (let dx = -3; dx <= 3; dx++) for (let dy = -5; dy <= 5; dy++) for (let dz = -3; dz <= 3; dz++)
      if (Math.abs(dx) / 3 + Math.abs(dz) / 3 + Math.abs(dy) / 5.5 <= 1.05) g.set(dx, 29 + dy, dz, (dy > 1 || (dx + dz) > 1) ? '#c8fbff' : '#6ff0ff', 2);
  });
}

// ================= Leuchttürme (halbe Voxel) =================
export function leuchtFackel(g, X, Y, Z, rot = 0) {
  g.at(X, Y, Z, rot, () => {
    g.box(-2, 0, -2, 2, 1, 2, mauerwerk('#8f897f', '#837d74'), 0, 0.08);
    g.box(-1, 2, -1, 0, 15, 0, '#6b4a2f', 0, 0.1);
    g.box(-3, 12, -1, 2, 12, 0, '#5a3d24');
    g.cyl(0, 0, 16, 17, 2, '#3a3836', 0, 0.05, true); g.box(-1, 16, -1, 0, 16, 0, '#3a3836');
    g.ell(-0.5, 18.5, -0.5, 1.6, 2.2, 1.6, (x, y) => (y > 19 ? '#ffe9a8' : '#ffb347'), -2.4, 0, (x, y) => y >= 17);
  });
}
export function leuchtFeuer(g, X, Y, Z, rot = 0) {
  g.at(X, Y, Z, rot, () => {
    sockel(g);
    g.cyl(0, 0, 4, 17, 3.5, mauerwerk('#9a948b', '#8d877e'), 0, 0.06);
    g.cyl(0, 0, 9, 9, 3.9, '#b87333', 0, 0.06, true);
    g.box(0, 11, 4, 0, 13, 4, '#ffc06a', -1.8);
    g.cyl(0, 0, 18, 18, 3.2, '#8a5428'); g.cyl(0, 0, 19, 20, 4.4, '#b87333', 0, 0.06, true);
    g.ell(0, 21.5, 0, 3.2, 3.4, 3.2, (x, y) => (y > 23 ? '#ffe9a8' : (y > 21 ? '#ffc46a' : '#ff8a2a')), -2.4, 0, (x, y) => y >= 19);
  });
}
export function leuchtSpiegel(g, X, Y, Z, rot = 0) {
  g.at(X, Y, Z, rot, () => {
    sockel(g);
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) g.box(x, 4, z, x, 22, z, '#4a4c50');
    for (const s of [-3, 3]) { g.line(-3, 5, s, 3, 12, s, '#5a5c62'); g.line(3, 13, s, -3, 21, s, '#5a5c62'); g.line(s, 5, -3, s, 12, 3, '#5a5c62'); g.line(s, 13, 3, s, 21, -3, '#5a5c62'); }
    g.box(-4, 23, -4, 4, 23, 4, '#55575c');
    g.box(-1, 24, -1, 0, 24, 0, '#4a4c50');
    g.box(-3, 25, -3, 3, 29, 2, '#b38a36', 0, 0.06);
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { const d = Math.hypot(dx, dy); if (d <= 2.6) g.set(dx, 27 + dy, 3, d < 1.4 ? '#fffbe6' : '#ffe2a0', -2.6); else if (d <= 3.4) g.set(dx, 27 + dy, 3, '#8a6a2a'); }
    g.box(-2, 30, -2, 1, 30, 1, '#4a4c50'); g.box(-1, 31, -1, 0, 32, 0, '#3a3b40');
  });
}
export function leuchtKristall(g, X, Y, Z, rot = 0) {
  g.at(X, Y, Z, rot, () => {
    sockel(g, '#4a4655');
    g.cyl(0, 0, 4, 20, 2.6, '#3d3b47', 0, 0.08);
    for (const y of [8, 14, 20]) g.cyl(0, 0, y, y, 3, '#d4a640', 0, 0.05, true);
    g.box(-2, 21, -2, 2, 22, 2, '#d4a640');
    g.cyl(0, 0, 26, 26, 4.6, '#d4a640', 0, 0.05, true);
    for (let dx = -4; dx <= 4; dx++) for (let dy = -7; dy <= 7; dy++) for (let dz = -4; dz <= 4; dz++)
      if (Math.abs(dx) / 4 + Math.abs(dz) / 4 + Math.abs(dy) / 7.5 <= 1) g.set(dx, 30 + dy, dz, dy > 2 ? '#ffffff' : '#bff7ff', -2.4);
  });
}

// ================= Gebäude (halbe Voxel) =================
export function haus(g, X, Y, Z, rot, wand = '#d4c4a0', dach = '#8d3b2a') {
  g.at(X, Y, Z, rot, () => {
    g.box(-5, 0, -6, 5, 0, 6, '#8f897f');
    g.box(-4, 1, -5, 4, 6, 5, (x, y, z) => ((Math.abs(x) === 4 && Math.abs(z) === 5) || y === 1 || y === 6 || (x === 0 && Math.abs(z) === 5) || (z === 0 && Math.abs(x) === 4) || (Math.abs(z) === 5 && Math.abs(x) === y - 1)) ? '#6b4a2f' : wand, 0, 0.05);
    for (const x of [-2, 2]) g.box(x, 3, 5, x, 4, 5, '#ffc06a', -2);
    g.box(4, 3, -2, 4, 4, -2, '#ffc06a', -1.8); g.box(-1, 1, 5, 0, 4, 5, '#4a3524');
    for (let i = 0; i <= 6; i++) g.box(-5, 7 + i, -7 + i, 5, 7 + i, 7 - i, i % 2 ? dach : '#7a3426', 0, 0.1);
    g.box(2, 9, 1, 3, 15, 2, '#8a4a3a');
  });
}
export function werkstatt(g, X, Y, Z, rot) {
  g.at(X, Y, Z, rot, () => {
    g.box(-6, 0, -5, 6, 8, 5, mauerwerk('#9a948b', '#8d877e'), 0, 0.06);
    for (let i = 0; i <= 6; i++) g.box(-7, 9 + i, -6 + i, 7, 9 + i, 6 - i, i % 2 ? '#4a5568' : '#3f4a5c', 0, 0.08);
    g.box(3, 9, -2, 5, 20, 0, '#6a5a4a');
    g.box(-4, 1, 5, -1, 4, 5, '#ff8a2a', 2); g.box(-4, 5, 5, -1, 5, 5, '#3a3836');
    zahnrad(g, 3, 4, 6, 3, '#c9a043');
    g.box(-2, 0, 8, 1, 1, 9, '#3a3b40'); g.box(-3, 2, 8, 2, 2, 9, '#4a4c50');
  });
}
export function hauptgebaeude(g, X, Y, Z, dach = ['#3f5675', '#36496a']) {
  g.at(X, Y, Z, 0, () => {
    const stein = mauerwerk('#b9b2a6', '#aea79b');
    g.box(-11, 0, -11, 11, 1, 11, '#8f897f');
    g.box(-3, 0, 12, 3, 0, 14, '#8f897f'); g.box(-3, 1, 12, 3, 1, 12, '#8f897f');
    g.box(-9, 2, -9, 9, 16, 9, stein, 0, 0.05);
    for (const x of [-6, -2, 2, 6]) for (const y of [6, 12]) { g.box(x, y, 9, x, y + 2, 9, '#ffc06a', -2); g.box(9, y, x, 9, y + 2, x, '#ffc06a', -1.8); g.box(-9, y, x, -9, y + 2, x, '#ffc06a', -1.8); }
    for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { g.cyl(x, z, 2, 22, 3, stein, 0, 0.05); g.cone(x, z, 23, 9, 3.8, dach[0], 0, 0.08); g.set(x, 18, z + Math.sign(z) * 3, '#ffc06a', -2); }
    g.box(-7, 17, -7, 7, 24, 7, stein, 0, 0.05);
    for (const x of [-4, 0, 4]) g.box(x, 20, 7, x, 22, 7, '#ffc06a', -2);
    for (let i = 0; i <= 8; i++) g.box(-8 + i, 25 + i, -8 + i, 8 - i, 25 + i, 8 - i, i % 2 ? dach[0] : dach[1], 0, 0.08);
    g.box(-1, 33, -1, 1, 38, 1, '#d4a640');
    g.ell(0, 42, 0, 1.8, 3.4, 1.8, '#6ff0ff', 2);
    g.box(-2, 2, 9, 2, 7, 9, '#4a3524'); g.box(-3, 8, 9, 3, 8, 9, '#8f897f');
    for (const s of [-1, 1]) { g.box(s * 6, 9, 10, s * 5, 16, 10, '#9c2f2f'); g.set(s * 5.5, 13, 11, '#d4a640'); g.set(s * 4, 6, 10, '#ffb04a', -2.4); }
  });
}
export function mauerring(g, X, Y, Z, R = 26) {
  g.at(X, Y, Z, 0, () => {
    const stein = mauerwerk('#a59f95', '#9a948a');
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
      const m = Math.max(Math.abs(x), Math.abs(z)); if (m < R - 3) continue;
      const tor = z >= R - 3 && Math.abs(x) <= 4;
      for (let y = 0; y <= 11; y++) { if (tor && y <= 9) continue; g.set(x, y, z, y === 0 ? '#8d877e' : stein, 0, 0.06); }
      if (m >= R - 1 && Math.floor((x + z + 100) / 2) % 2 === 0) g.box(x, 12, z, x, 13, z, stein);
    }
    g.box(-4, 9, R - 3, 4, 9, R, '#6b4a2f');
    for (const s of [-1, 1]) {
      g.box(s * 5, 0, R - 4, s * 9, 18, R + 1, stein, 0, 0.05);
      for (let i = 0; i <= 3; i++) g.box(s * 5, 19 + i, R - 4 + i, s * 9, 19 + i, R + 1 - i, '#7a3426');
      g.set(s * 6, 11, R + 2, '#ffb04a', -2.4); g.box(s * 7, 12, R + 2, s * 8, 17, R + 2, '#9c2f2f');
    }
  });
}
export function holzstapel(g, X, Y, Z) { g.at(X, Y, Z, 0, () => { for (let i = 0; i < 4; i++) g.box(0, 0, i * 2, 7, 1, i * 2 + 1, i % 2 ? '#7a5230' : '#8a6038'); g.box(0, 2, 1, 7, 3, 4, '#7a5230'); }); }
export function feld(g, X, Y, Z, w, d, r) { g.at(X, Y, Z, 0, () => { for (let x = 0; x < w; x++) for (let z = 0; z < d; z += 2) if (r() > 0.15) g.box(x, 0, z, x, 1 + Math.floor(r() * 2), z, r() > 0.3 ? '#c9b04a' : '#8fae4a'); }); }
export function riss(g, X, Y, Z) {
  g.at(X, Y, Z, 0, () => {
    for (let a = 0; a < 10; a++) { const ang = a / 10 * 6.283, x = Math.round(Math.cos(ang) * 12), z = Math.round(Math.sin(ang) * 12), h = 6 + (a * 7) % 6;
      g.box(x - 1, 0, z - 1, x + 1, h, z + 1, '#2d2838', 0, 0.1); g.set(x, h - 2, z + (z > 0 ? 2 : -2), '#b07cff', -2); }
    for (let x = -8; x <= 8; x++) for (let y = 0; y <= 20; y++) { const q = (x / 7.5) ** 2 + ((y - 10) / 10) ** 2; if (q > 1.25) continue;
      if (q > 0.85) g.set(x, y, 0, '#2d2838', 0, 0.1); else g.set(x, y, 0, q < 0.3 ? '#efe2ff' : (q < 0.6 ? '#c9a2ff' : '#8a5cff'), -(2.4 - q)); }
  });
}


// ================= Neu für das Spiel =================
/** ein Block Mauer (2 × 2 halbe Voxel Grundfläche), Mitte bei (0,0) */
export function mauerStueck(g: Grid, X: number, Y: number, Z: number, stahl = false) {
  g.at(X, Y, Z, 0, () => {
    const st = stahl ? mauerwerk('#8e939a', '#7d8288') : mauerwerk('#a59f95', '#9a948a');
    g.box(-1, 0, -1, 0, 0, 0, '#8d877e'); g.box(-1, 1, -1, 0, 9, 0, st, 0, 0.06);
    g.set(-1, 10, -1, st); g.set(0, 10, 0, st);
    if (stahl) { g.set(-1, 5, -1, '#5a5e64'); g.set(0, 5, 0, '#5a5e64'); }
  });
}
export function steinbruch(g: Grid, X: number, Y: number, Z: number) {
  g.at(X, Y, Z, 0, () => {
    g.box(-4, 0, -4, 3, 0, 3, '#7d776f', 0, 0.12);
    for (const [x, z, s] of [[-2, -2, 2.4], [2, -1, 1.8], [-1, 2, 1.6]] as [number, number, number][]) g.ell(x, 1, z, s, s * 0.8, s, mauerwerk('#9a948b', '#8a847b'), 0, 0.1, (_x, y) => y >= 1);
    for (let i = 0; i < 3; i++) g.box(1, 1 + i, 1, 3, 1 + i, 3 - i, '#b9b2a6');
    g.box(-4, 1, 3, -4, 11, 3, '#6b4a2f'); g.line(-4, 11, 3, 1, 9, -1, '#6b4a2f'); g.box(1, 5, -1, 1, 8, -1, '#3a3836');
    g.box(1, 3, -2, 2, 4, -1, '#a8a29a');
  });
}
export function kristallmine(g: Grid, X: number, Y: number, Z: number) {
  g.at(X, Y, Z, 0, () => {
    g.box(-4, 0, -4, 3, 0, 3, '#4a4652', 0, 0.12);
    for (const x of [-4, 3]) g.box(x, 1, -3, x, 8, -3, '#6b4a2f');
    g.box(-4, 9, -3, 3, 9, -3, '#5a3d24'); g.box(-0.5, 5, -3, 0, 8, -3, '#3a3836');
    g.box(-3, 1, 0, 1, 3, 3, '#7a5532'); g.box(-3, 1, 0, 1, 1, 3, '#3a3836');
    for (const [x, z, h] of [[-2, 1, 3], [0, 2, 2], [-1, 2, 4]] as [number, number, number][]) for (let y = 4; y < 4 + h; y++) g.set(x, y, z, y === 3 + h ? '#d8fdff' : '#6ff0ff', 1.6);
    g.set(2, 5, -3, '#ffc06a', -2);
  });
}
/** gefällter Baum: Stumpf mit hellem Schnitt */
export function stumpf(g: Grid, X: number, Y: number, Z: number, typ: string) {
  g.at(X, Y, Z, 0, () => {
    const holz = typ === 'tot' ? '#3b302a' : typ === 'tanne' ? '#4d3522' : '#5e4128';
    g.box(0, 0, 0, 1, 0, 1, holz); g.set(0, 1, 0, '#c9a36a'); g.set(1, 1, 1, '#b48a5a'); g.set(1, 1, 0, holz);
    g.set(-1, 0, 0, '#563b24'); g.set(2, 0, 1, '#563b24');
  });
}
/** junger Baum, der nachwächst */
export function setzling(g: Grid, X: number, Y: number, Z: number, r: () => number, typ: string) {
  g.at(X, Y, Z, 0, () => {
    if (typ === 'tanne') { g.box(0, 0, 0, 0, 1, 0, '#4d3522'); g.cone(0, 0, 1, 6, 2.2, '#3a6b45', 0, 0.1); return; }
    const blatt = typ === 'herbst' ? '#c9722e' : typ === 'leucht' ? '#6e60a3' : typ === 'tot' ? '#3b302a' : '#5e9a44';
    g.box(0, 0, 0, 0, 3, 0, '#5e4128');
    if (typ !== 'tot') g.ell(0, 4, 0, 1.6 + r() * 0.4, 1.4, 1.6, blatt, 0, 0.12);
  });
}

// ================= v0.3: Türme der Zeitalter, Verschmelzungen, Ruinen =================
const ZWEIG_FARBE = ['#3f5f9a', '#9c2f2f'];
/** Banner an der Turmseite: zeigt den gewählten Zweig */
export function banner(g: Grid, x: number, y: number, z: number, zweig: number) {
  if (zweig < 0) return;
  g.box(x, y, z, x, y + 5, z, ZWEIG_FARBE[zweig]); g.set(x, y + 2, z + 1, '#d4a640'); g.set(x, y + 6, z, '#6b4a2f');
}
export function turmSchuetzen(g: Grid, X: number, Y: number, Z: number, zweig = -1) {
  g.at(X, Y, Z, 0, () => {
    sockel(g);
    g.box(-4, 4, -4, 4, 12, 4, mauerwerk('#a59f95', '#9a948a'), 0, 0.06);
    for (const [x, z] of [[0, 4], [4, 0], [-4, 0], [0, -4]]) g.box(x, 8, z, x, 10, z, '#2a2420');
    for (let y = 13; y <= 19; y++) for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { if (Math.abs(x) < 4 && Math.abs(z) < 4) continue; const ecke = Math.abs(x) >= 3 && Math.abs(z) >= 3; if (!ecke && y >= 15 && y <= 17 && (x === 0 || z === 0)) continue; g.set(x, y, z, ecke ? '#5a3d24' : ((x + z) & 1) ? '#9a7046' : '#8a6340', 0, 0.1); }
    g.box(-6, 20, -6, 6, 20, 6, '#7d5a36');
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) if ((Math.abs(x) === 6 || Math.abs(z) === 6) && (x + z) % 2 === 0) g.box(x, 21, z, x, 22, z, '#a59f95');
    for (let i = 0; i <= 7; i++) { const s = 6 - i; g.box(-s, 24 + i, -s, s, 24 + i, s, i % 2 ? '#3f5675' : '#36496a', 0, 0.08); }
    g.box(-1, 21, -1, 1, 23, 1, '#6b4a2f');
    banner(g, 5, 13, 0, zweig);
  });
}
export function turmKanone(g: Grid, X: number, Y: number, Z: number, zweig = -1) {
  g.at(X, Y, Z, 0, () => {
    sockel(g);
    g.cyl(0, 0, 4, 15, 4.6, mauerwerk('#8b8a86', '#7f7e7a'), 0, 0.06);
    for (const y of [7, 15]) g.cyl(0, 0, y, y, 4.9, '#4a4c50', 0, 0.05, true);
    g.cyl(0, 0, 16, 16, 4.2, '#55575c');
    g.box(-2, 17, -2, 2, 18, 2, '#3a3b40');
    for (let z = -2; z <= 9; z++) g.cyl(0, z, 20, 20, z > 7 ? 2.2 : 1.8, (x, y) => (z > 7 ? '#3a3b40' : '#2e2f33'));
    g.box(-2, 19, -3, 2, 21, -2, '#4a4c50');
    zahnrad(g, 5, 10, 0, 2.6, '#c9a043');
    g.box(-5, 3, 3, -4, 4, 4, '#2e2f33'); g.ell(-4.5, 5, 3.5, 1, 1, 1, '#2e2f33');
    banner(g, -5, 9, 0, zweig);
  });
}
export function turmBlitz(g: Grid, X: number, Y: number, Z: number, zweig = -1) {
  g.at(X, Y, Z, 0, () => {
    g.cyl(0, 0, 0, 3, 5, '#c9c3b6');
    g.cyl(0, 0, 4, 22, 3, mauerwerk('#e6e1d6', '#dcd6ca'), 0, 0.04);
    for (const y of [8, 14, 20]) g.cyl(0, 0, y, y, 4, '#c99a3e', 0, 0.05, true);
    for (const s of [-1, 1]) for (let i = 0; i < 10; i++) { const w = 5 - Math.floor(i / 2); g.box(s * 4, 9 + i, 0, s * (3 + w), 9 + i, 0, (i % 3 === 0) ? '#6f95bd' : '#8fb4d9', 0, 0.05); }
    g.cyl(0, 0, 27, 27, 4.4, '#c99a3e', 0, 0.05, true);
    g.ell(0, 27, 0, 2.6, 2.6, 2.6, '#9a8cff', 2); g.ell(0, 27, 0, 1.2, 1.2, 1.2, '#efeaff', 2.4);
    banner(g, 0, 10, 4, zweig);
  });
}
export function lichtFeuerKlein(g: Grid, X: number, Y: number, Z: number) {
  g.at(X, Y, Z, 0, () => {
    g.box(-2, 0, -2, 1, 1, 1, mauerwerk('#8f897f', '#837d74'));
    g.cyl(-0.5, -0.5, 2, 14, 1.6, mauerwerk('#9a948b', '#8d877e'), 0, 0.06);
    g.cyl(-0.5, -0.5, 15, 16, 2.6, '#b87333', 0, 0.06, true); g.cyl(-0.5, -0.5, 15, 15, 1.6, '#8a5428');
    g.ell(-0.5, 18, -0.5, 2, 2.4, 2, (x, y) => (y > 19 ? '#ffe9a8' : '#ffb347'), -2.4, 0, (x, y) => y >= 16);
  });
}
export function lichtSpiegelKlein(g: Grid, X: number, Y: number, Z: number) {
  g.at(X, Y, Z, 0, () => {
    g.box(-2, 0, -2, 1, 1, 1, '#7d776f');
    for (const [x, z] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) g.box(x, 2, z, x, 16, z, '#4a4c50');
    for (const s of [-2, 1]) { g.line(-2, 4, s, 1, 9, s, '#5a5c62'); g.line(1, 10, s, -2, 15, s, '#5a5c62'); }
    g.box(-2, 17, -2, 1, 17, 1, '#55575c');
    g.box(-2, 18, -2, 1, 21, 0, '#b38a36', 0, 0.06);
    for (let dx = -2; dx <= 1; dx++) for (let dy = 18; dy <= 21; dy++) { const d = Math.hypot(dx + 0.5, dy - 19.5); g.set(dx, dy, 1, d < 1.2 ? '#fffbe6' : d < 2 ? '#ffe2a0' : '#8a6a2a', d < 2 ? -2.6 : 0); }
  });
}
export function lichtKristallKlein(g: Grid, X: number, Y: number, Z: number) {
  g.at(X, Y, Z, 0, () => {
    g.box(-2, 0, -2, 1, 1, 1, '#4a4655');
    g.cyl(-0.5, -0.5, 2, 15, 1.4, '#3d3b47', 0, 0.08);
    for (const y of [6, 11, 15]) g.cyl(-0.5, -0.5, y, y, 2, '#d4a640', 0, 0.05, true);
    g.cyl(-0.5, -0.5, 19, 19, 3.4, '#d4a640', 0, 0.05, true);
    for (let dx = -3; dx <= 3; dx++) for (let dy = -5; dy <= 5; dy++) for (let dz = -3; dz <= 3; dz++)
      if (Math.abs(dx) / 3 + Math.abs(dz) / 3 + Math.abs(dy) / 5.5 <= 1) g.set(dx, 22 + dy, dz, dy > 1 ? '#ffffff' : '#bff7ff', -2.4);
  });
}
/** Verschmelzungen: Grundturm plus Merkmal */
export function turmFusion(g: Grid, typ: string) {
  if (typ === 'glutmoerser') {
    turmAlchemie(g, 0, 0, 0);
    g.cyl(0, 0, 21, 22, 5, '#2f2a2a', 0, 0.06, true); g.cyl(0, 0, 23, 23, 2.8, '#ff6a1a', 2.2);
    for (const [x, z] of [[0, 5], [5, 0], [-5, 0], [0, -5]]) g.box(x, 4, z, x, 8, z, '#ff7a2a', 1.8);
    return;
  }
  turmHolz(g, 0, 0, 0);
  if (typ === 'brandturm') { g.cyl(0, 0, 33, 34, 1.6, '#3a3836', 0, 0, true); g.ell(0, 36, 0, 1.5, 2, 1.5, (x, y) => (y > 36 ? '#ffe9a8' : '#ff8a2a'), 2); banner(g, 5, 13, 0, 1); }
  if (typ === 'leuchtpfeil') { for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) / 2 + Math.abs(dz) / 2 + Math.abs(dy) / 3.2 <= 1) g.set(dx, 37 + dy, dz, '#c8fbff', -2.2); }
  if (typ === 'doppelturm') { g.box(6, 0, -2, 9, 1, 1, '#8f897f'); g.box(6, 2, -2, 9, 18, 1, (x, y, z) => ((x + y + z) & 1 ? '#9a7046' : '#8a6340'), 0, 0.1); for (let i = 0; i <= 3; i++) g.box(6 - 1 + i, 19 + i, -3 + i, 9 + 1 - i, 19 + i, 2 - i, '#8a3f2b'); g.line(4, 16, -1, 6, 16, -1, '#5a3d24', 0, 0, 1); }
}
/** Trümmer eines zerstörten Gebäudes */
export function ruine(g: Grid, w: number, d: number, r: () => number) {
  const hw = w, hd = d; // in halben Voxeln: Grundfläche w × d Blöcke = 2w × 2d
  for (let x = -hw; x < hw; x++) for (let z = -hd; z < hd; z++) {
    const h = Math.floor(r() * 3 * (1 - Math.max(Math.abs(x + 0.5) / hw, Math.abs(z + 0.5) / hd) * 0.7));
    for (let y = 0; y <= h; y++) g.set(x, y, z, r() > 0.7 ? '#6a625a' : r() > 0.4 ? '#8a837b' : '#5a5048', 0, 0.12);
  }
  for (let i = 0; i < 3; i++) { const x = Math.round((r() - 0.5) * hw * 1.4), z = Math.round((r() - 0.5) * hd * 1.4); g.line(x, 1, z, x + Math.round((r() - 0.5) * 6), 2 + Math.round(r() * 3), z + Math.round((r() - 0.5) * 6), '#4a3524'); }
  g.set(0, 3, 0, '#ff7a2a', 1.2);
}
/** Kristallpanzer für späte Trolle (über das Trollmodell gelegt) */
export function trollPanzer(g: Grid) {
  for (const [x, y, z] of [[-4, 11, 2], [4, 11, 2], [0, 14, -3], [-3, 15, -2], [3, 15, -2], [0, 10, 4], [-6, 13, 0], [6, 13, 0]] as [number, number, number][]) {
    g.set(x, y, z, '#7fe9ff', 1.4); g.set(x, y + 1, z, '#c8fbff', 1.6);
  }
}
/** Feuer des Drachlings, nur beim Angriff sichtbar */
export function drachenFeuer(g: Grid) {
  const fr = rng(31);
  for (let i = 0; i < 16; i++) { const sp = i / 4; for (let k = 0; k <= i / 2; k++) g.set(Math.round((fr() - 0.5) * 2 * sp), 2 - Math.round(i * 0.7) + Math.round((fr() - 0.5) * sp), 16 + i, i < 5 ? '#ffe9a8' : (i < 10 ? '#ffb347' : '#ff6a1a'), 2.4 - i * 0.08); }
}


// ================= v0.4: Bevölkerung, Stufen, Burg, neue Wesen =================
/** Wohnhaus auf 4 × 4 Blöcken (8 × 8 halbe Voxel), wächst mit der Stufe */
export function wohnhaus(g: Grid, stufe = 1) {
  const holz = (x: number, y: number, z: number) => ((Math.abs(x) === 3 && Math.abs(z) === 3) || y % 4 === 1 ? '#6b4a2f' : '#d4c4a0');
  g.box(-4, 0, -4, 3, 0, 3, '#8f897f', 0, 0.08);
  const boden = stufe >= 3 ? 4 : 0;
  if (stufe >= 3) g.box(-3, 1, -3, 3, 4, 3, mauerwerk('#a59f95', '#9a948a'), 0, 0.06);
  const h = stufe >= 2 ? 9 : 5;
  g.box(-3, 1 + boden, -3, 3, h + boden, 3, holz, 0, 0.05);
  for (const y of stufe >= 2 ? [3, 7] : [3]) { g.box(-2, y + boden, 3, -1, y + 1 + boden, 3, '#ffc06a', -2); g.box(1, y + boden, 3, 2, y + 1 + boden, 3, '#ffc06a', -2); g.box(3, y + boden, -1, 3, y + 1 + boden, 0, '#ffc06a', -1.8); }
  g.box(0, 1, 3, 0, 3, 3, '#4a3524');
  const top = h + boden + 1, dach = stufe >= 3 ? ['#3f5675', '#36496a'] : ['#8d3b2a', '#7a3426'];
  for (let i = 0; i <= 4; i++) g.box(-4, top + i, -4 + i, 3, top + i, 3 - i, i % 2 ? dach[0] : dach[1], 0, 0.1);
  g.box(1, top, -2, 2, top + 5, -1, '#8a4a3a');
  if (stufe >= 2) { g.box(-3, 5 + boden, 4, 2, 5 + boden, 4, '#6b4a2f'); for (const x of [-2, 0, 2]) g.set(x, 6 + boden, 4, x === 0 ? '#e5735f' : '#f2d36b'); }
  if (stufe >= 3) for (const x of [-4, 3]) { g.box(x, 0, 4, x, 3, 4, '#6b4a2f'); g.set(x, 4, 4, '#ffb04a', -2.2); }
}
/** Bauernhof auf 6 × 6 Blöcken: Scheune, Heu, Beete; Stufe II Silo, Stufe III Windmühle */
export function bauernhof(g: Grid, stufe = 1) {
  g.box(-6, 0, -6, 5, 0, 5, '#7b5636', 0, 0.12);
  for (let x = -6; x <= 5; x++) for (let z = 1; z <= 5; z += 2) g.set(x, 1, z, (x + z) % 3 ? '#c9b04a' : '#8fae4a', 0, 0.15);
  // Scheune
  g.box(-5, 1, -5, 1, 6, -1, (x, y) => (y === 6 || x === -5 || x === 1 ? '#6b2f24' : '#8a3a2c'), 0, 0.06);
  g.box(-3, 1, -1, -1, 4, -1, '#4a3524'); g.box(-3, 5, -1, -1, 5, -1, '#d4c4a0');
  for (let i = 0; i <= 3; i++) g.box(-6, 7 + i, -5 + i, 2, 7 + i, -1 - i, i % 2 ? '#5a3d24' : '#4d3522', 0, 0.08);
  g.ell(3.5, 1.5, -3.5, 1.6, 1.4, 1.6, '#e0c060', 0, 0.12);
  g.box(-6, 1, 0, 5, 1, 0, '#6b4a2f');
  if (stufe >= 2) { g.cyl(4, -4, 1, 9, 1.6, '#b9b2a6', 0, 0.06); g.cone(4, -4, 10, 3, 2, '#7a3426'); }
  if (stufe >= 3) {
    g.cyl(-4, 3, 1, 12, 1.6, mauerwerk('#d4c4a0', '#c9b894'), 0, 0.06); g.cone(-4, 3, 13, 3, 2.2, '#5a3d24');
    for (let i = -6; i <= 6; i++) { g.set(-4 + i, 12, 5, '#e8dcc0'); g.set(-4, 12 + i, 5, '#e8dcc0'); }
    g.set(-4, 12, 5, '#6b4a2f');
  }
}
/** Fischerhütte auf 4 × 4 Blöcken: Hütte auf Pfählen, Netze, Boot */
export function fischerhuette(g: Grid, stufe = 1) {
  g.box(-4, 0, -4, 3, 0, 3, '#8a6340', 0, 0.12);
  for (const [x, z] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) g.box(x, 1, z, x, 2, z, '#5a3d24');
  g.box(-3, 3, -3, 2, 7, 2, (x, y, z) => (y === 3 || Math.abs(x + 0.5) > 2 && Math.abs(z + 0.5) > 2 ? '#5a3d24' : '#8a6a4a'), 0, 0.06);
  g.box(-1, 3, 2, -1, 5, 2, '#3a2a1e'); g.box(1, 5, 2, 1, 5, 2, '#ffc06a', -2);
  for (let i = 0; i <= 3; i++) g.box(-4, 8 + i, -4 + i, 3, 8 + i, 3 - i, i % 2 ? '#7d6a4a' : '#6a5a3a', 0, 0.1);
  g.box(3, 1, -3, 3, 5, -3, '#6b4a2f'); for (let y = 2; y <= 5; y++) for (let z = -2; z <= 0; z++) if ((y + z) % 2) g.set(3, y, z, '#c9c3b6');
  g.box(-4, 1, 4, 0, 1, 5, '#7a5230'); g.box(-3, 2, 4, -1, 2, 4, '#8a6038');
  if (stufe >= 2) { g.box(-4, 1, -4, -4, 6, -4, '#6b4a2f'); g.line(-4, 6, -4, 3, 6, -4, '#6b4a2f'); for (let x = -3; x <= 2; x += 2) g.box(x, 4, -4, x, 5, -4, '#c0c8d0'); }
  if (stufe >= 3) { g.box(1, 9, -2, 2, 14, -1, '#8a4a3a'); for (const [x, y, z] of [[1, 15, -1], [2, 17, -2], [1, 19, -1]]) g.set(x, y, z, '#dcd9d3'); }
}
/** Schmuck der Ausbaustufen: Eckpfeiler mit Bannern (II), goldene Kappen und Runen (III) */
export function stufenSchmuck(g: Grid, w: number, d: number, stufe: number) {
  if (stufe < 2) return;
  const hx = w - 1, hz = d - 1; // halbe Voxel: Fläche reicht von -w bis w-1
  if (w <= 2) { // kleine Lichter: Goldringe am Mast
    g.cyl(-0.5, -0.5, 4, 4, 2.2, '#d4a640', 0, 0.05, true);
    if (stufe >= 3) { g.cyl(-0.5, -0.5, 9, 9, 2.2, '#d4a640', 0, 0.05, true); g.set(-2, 6, -0.5, '#9fe7ff', 1.6); g.set(1, 6, -0.5, '#9fe7ff', 1.6); }
    return;
  }
  for (const [x, z] of [[-w, -d], [hx, -d], [-w, hz], [hx, hz]]) {
    g.box(x, 0, z, x, 5, z, mauerwerk('#a59f95', '#8f897f'), 0, 0.06);
    g.set(x, 6, z, stufe >= 3 ? '#d4a640' : '#8f897f');
    if (stufe >= 3) g.set(x, 3, z, '#9fe7ff', 1.6);
  }
  // Banner vorne
  for (const x of [-w + 1, hx - 1]) { g.box(x, 2, hz, x, 5, hz, stufe >= 3 ? '#3f5f9a' : '#9c2f2f'); g.set(x, 6, hz, '#d4a640'); }
}
/** sichtbare Schäden an Mauern: obere Blöcke fehlen */
export function mauerSchaden(g: Grid, stufe: number) {
  if (stufe <= 0) return;
  const r = rng(77 + stufe);
  for (const v of [...g.m.entries()]) { const [k, vox] = v; if (vox.y > 10 - stufe * 4 && r() < 0.45 + stufe * 0.2) g.m.delete(k); }
}
/** Burg: Ausbau in sechs Stufen, jede sichtbar anders */
export function burg(g: Grid, stufe: number) {
  const dach = stufe >= 5 ? ['#b87333', '#9a5f2a'] : ['#3f5675', '#36496a'];
  hauptgebaeude(g, 0, 0, 0, dach);
  const stein = mauerwerk('#b9b2a6', '#aea79b');
  if (stufe < 2) { for (let y = 38; y <= 46; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.m.delete(g.key(x, y, z)); g.box(0, 33, 0, 0, 36, 0, '#6b4a2f'); g.box(1, 35, 0, 3, 36, 0, '#9c2f2f'); }
  if (stufe >= 2) { g.cyl(0, 0, 16, 16, 10, '#d4a640', 0, 0.05, true); for (const s of [-1, 1]) for (const z of [-9, 9]) { g.box(s * 12, 2, z, s * 12, 12, z, '#6b4a2f'); g.box(s * 12, 8, z + 1, s * 12, 12, z + 1, '#9c2f2f'); } }
  if (stufe >= 3) for (const [x, z] of [[-9, -9], [9, -9]]) { g.cyl(x, z, 23, 32, 2.6, stein, 0, 0.05); g.cone(x, z, 33, 8, 3.4, dach[0], 0, 0.08); g.set(x, 28, z + 3, '#ffc06a', -2); }
  if (stufe >= 4) { // Ringmauer mit Toren und Ecktürmchen
    for (let x = -12; x <= 11; x++) for (let z = -12; z <= 11; z++) {
      const rand = x === -12 || x === 11 || z === -12 || z === 11; if (!rand) continue;
      if (z === 11 && Math.abs(x) <= 3) continue;
      g.box(x, 0, z, x, 4, z, stein, 0, 0.05); if ((x + z) % 2 === 0) g.set(x, 5, z, stein);
    }
    for (const [x, z] of [[-12, -12], [11, -12], [-12, 11], [11, 11]]) { g.box(x - 1, 0, z - 1, x + 1, 8, z + 1, stein); g.cone(x, z, 9, 4, 2.2, dach[1]); }
  }
  if (stufe >= 5) { // Dampf und Messing
    for (const [x, z] of [[-5, -6], [5, -6]]) { g.box(x, 25, z, x + 1, 36, z + 1, '#6a5a4a'); for (let i = 0; i < 4; i++) g.ell(x + 0.5 + (i % 2), 38 + i * 2.2, z + 0.5, 1.2 + i * 0.4, 1, 1.2 + i * 0.4, '#dcd9d3', 0, 0.04); }
    zahnrad(g, 0, 19, 8, 3.6, '#c9a043');
    for (const [x, z] of [[-9, 9], [9, 9]]) g.cyl(x, z, 14, 14, 3.4, '#b87333', 0, 0.05, true);
  }
  if (stufe >= 6) { // Kristallzitadelle
    for (let y = 38; y <= 46; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.m.delete(g.key(x, y, z));
    for (let dx = -3; dx <= 3; dx++) for (let dy = -8; dy <= 8; dy++) for (let dz = -3; dz <= 3; dz++)
      if (Math.abs(dx) / 3 + Math.abs(dz) / 3 + Math.abs(dy) / 8.5 <= 1) g.set(dx, 46 + dy, dz, dy > 2 ? '#ffffff' : '#bff7ff', 2.2);
    for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { g.set(x, 33 + (z < 0 ? 9 : 0), z, '#c8fbff', 2.2); g.set(x, 34 + (z < 0 ? 9 : 0), z, '#ffffff', 2.4); }
    g.cyl(0, 0, 24, 24, 9, '#6ff0ff', 1.4, 0.05, true);
  }
}
/** Aschegeist: Rauchgestalt mit Glutaugen (schwebt) */
export function aschegeist(g: Grid) {
  const r = rng(13);
  for (let i = 0; i < 9; i++) { const y = i * 1.2, s = 3.2 - Math.abs(i - 4) * 0.45; g.ell(Math.sin(i) * 0.6, y, Math.cos(i) * 0.5, s, 1, s * 0.9, (x, yy, z) => (h3(x, yy, z) > 0.75 ? '#5a5048' : '#3a3634'), 0, 0.15); }
  for (let i = 0; i < 8; i++) g.set(Math.round((r() - 0.5) * 6), Math.round(r() * 9), Math.round((r() - 0.5) * 5), '#ff7a2a', 1.6);
  g.set(-1, 8, 3, '#ffb347', 2.6); g.set(1, 8, 3, '#ffb347', 2.6);
  for (let i = 0; i < 5; i++) g.set(0, -1 - i, -i, '#3a3634');
}
/** Steinwerfer: gebückter Riese mit Felsbrocken über dem Kopf */
export function steinwerfer(g: Grid) {
  g.box(-4, 0, -1, -2, 4, 1, '#5d5448'); g.box(2, 0, -1, 4, 4, 1, '#5d5448');
  g.ell(0, 8, -1, 5, 4.5, 3.6, '#7a6e5e', 0, 0.1);
  g.ell(0, 12, 1, 3, 2.6, 2.6, '#867a68', 0, 0.08);
  g.set(-1, 12, 4, '#ffcf5a', 2.2); g.set(1, 12, 4, '#ffcf5a', 2.2);
  for (const s of [-1, 1]) g.line(s * 4, 10, 0, s * 3, 17, 1, '#6e6352', 0, 0.08, 1);
  g.ell(0, 20, 1, 3.4, 3, 3.2, mauerwerk('#8c867f', '#76716a'), 0, 0.12);
  g.cyl(0, -1, 5, 6, 4.6, '#4a3a2a', 0, 0.1, true);
}
/** Moorschamane: hagere Gestalt mit Maske und leuchtendem Stab */
export function schamane(g: Grid) {
  g.box(-2, 0, 0, -1, 3, 0, '#4f6136'); g.box(1, 0, 0, 2, 3, 0, '#4f6136');
  g.box(-3, 4, -2, 3, 11, 2, (x, y) => (y % 3 === 0 ? '#3d4a2a' : '#556b3a'), 0, 0.1);
  for (let y = 4; y <= 11; y++) g.set(0, y, 3, y % 2 ? '#c9a043' : '#8a6a2a');
  g.box(-2, 12, -1, 2, 15, 2, '#6f8a4a'); g.box(-2, 12, 3, 2, 15, 3, '#e8dcc0');
  g.set(-1, 14, 4, '#7dff6a', 2.4); g.set(1, 14, 4, '#7dff6a', 2.4);
  for (const s of [-1, 1]) { g.line(s * 2, 16, 0, s * 4, 19, -1, '#e8dcc0'); }
  g.box(4, 0, 2, 4, 16, 2, '#5a3d24'); g.ell(4, 18, 2, 1.4, 1.4, 1.4, '#7dff6a', 2.2);
}
/** Borkenwächter: Baumwesen mit großem Borkenschild vorne */
export function schildwaechter(g: Grid) {
  g.box(-3, 0, -1, -2, 5, 1, '#4d3522'); g.box(2, 0, -1, 3, 5, 1, '#4d3522');
  g.ell(0, 10, 0, 4.4, 5.4, 3.2, (x, y, z) => (h3(x, y, z) > 0.7 ? '#4d3522' : '#5e4128'), 0, 0.1);
  g.ell(0, 16, 0, 3, 2.4, 2.6, '#5e4128', 0, 0.08);
  for (let i = 0; i < 6; i++) g.ell(Math.round(Math.sin(i * 2) * 3), 19 + (i % 3), Math.round(Math.cos(i * 2) * 2), 1.8, 1.2, 1.8, '#4f8a3c', 0, 0.12);
  g.set(-1, 16, 3, '#ffd34a', 2.2); g.set(1, 16, 3, '#ffd34a', 2.2);
  for (let x = -5; x <= 5; x++) for (let y = 3; y <= 15; y++) { const q = (x / 5.5) ** 2 + ((y - 9) / 7) ** 2; if (q <= 1) g.set(x, y, 5, q > 0.75 ? '#3a2a1e' : (h3(x, y, 5) > 0.6 ? '#6b4a2f' : '#7a5532'), 0, 0.1); }
  g.box(-1, 8, 6, 1, 10, 6, '#8c867f');
}
/** Rissfürst: großer gehörnter Herrscher aus dem Riss, Risse leuchten violett */
export function rissfuerst(g: Grid) {
  const haut = (x: number, y: number, z: number) => (h3(x, y, z) > 0.88 ? '#b07cff' : '#2d2838');
  g.box(-6, 0, -2, -3, 7, 2, haut, 0, 0.08); g.box(3, 0, -2, 6, 7, 2, haut, 0, 0.08);
  g.ell(0, 14, 0, 8, 8, 5, haut, 0, 0.08);
  g.ell(0, 23, 1, 4, 3.6, 3.6, haut, 0, 0.06);
  g.set(-2, 24, 5, '#efe2ff', 2.8); g.set(2, 24, 5, '#efe2ff', 2.8);
  for (const s of [-1, 1]) { g.line(s * 3, 26, 0, s * 7, 31, -2, '#e8dcc0', 0, 0.05, 1); g.line(s * 7, 31, -2, s * 8, 34, 1, '#e8dcc0'); }
  for (const s of [-1, 1]) { g.line(s * 8, 18, 0, s * 11, 8, 2, haut, 0, 0.06, 1); g.ell(s * 11, 7, 2, 2, 2, 2, '#2d2838'); }
  g.box(-7, 6, -6, 7, 20, -6, (x, y) => (y % 4 === 0 ? '#5a2a7a' : '#3f1f5a'), 0, 0.08);
  for (let i = 0; i < 6; i++) g.set(-3 + i, 14 + (i % 3), 5, '#c9a2ff', 2);
  g.line(11, 8, 2, 11, 30, 4, '#3a3442', 0, 0.06); g.ell(11, 32, 4, 2, 2, 2, '#b07cff', 2.4);
}
/** Wegweiser für Verbesserungen: kleiner goldener Pfeil nach oben */
export function pfeilHoch(g: Grid) {
  for (let i = 0; i < 4; i++) g.box(-3 + i, i, 0, 3 - i, i, 0, '#e8b84a');
  g.box(-1, -4, 0, 1, -1, 0, '#e8b84a');
}
