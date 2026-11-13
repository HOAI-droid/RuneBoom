import { h3 } from '@runeboom/core';

// ---------- Farben (sRGB-Hex -> linear) ----------
export const srgbLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linCache = new Map();
export function lin(hex) { let c = linCache.get(hex) as number[] | undefined; if (!c) { const n = parseInt(hex.slice(1), 16); c = [srgbLin(((n >> 16) & 255) / 255), srgbLin(((n >> 8) & 255) / 255), srgbLin((n & 255) / 255)]; linCache.set(hex, c); } return c; }

// ---------- Voxel-Raster ----------
// e > 0: leuchtet immer (Kristall, Lava, Feuer) · e < 0: Lampe (Fenster, Fackeln, Riss), am Tag gedimmt
export function rotXZ(x, z, r) { switch (r & 3) { case 0: return [x, z]; case 1: return [z, -x]; case 2: return [-x, -z]; default: return [-z, x]; } }
export class Grid {
  m: Map<number, Voxel>; o: number[];
  constructor() { this.m = new Map(); this.o = [0, 0, 0, 0]; }
  key(x, y, z) { return ((x + 512) << 20) | ((y + 512) << 10) | (z + 512); }
  at(X: number, Y: number, Z: number, rot: number, fn: () => void) { const alt = this.o; const [px, pz] = rotXZ(X, Z, alt[3]); this.o = [alt[0] + px, alt[1] + Y, alt[2] + pz, (alt[3] + rot) & 3]; fn(); this.o = alt; }
  set(x: number, y: number, z: number, hex: Farbe, e = 0, j = 0.07) {
    if (typeof hex === 'function') { const h = hex(x, y, z); if (!h) return; hex = h; }
    const [lx, lz] = rotXZ(x, z, this.o[3]);
    const X = Math.round(lx + this.o[0]), Y = Math.round(y + this.o[1]), Z = Math.round(lz + this.o[2]);
    if (X < -511 || X > 511 || Z < -511 || Z > 511 || Y < -511 || Y > 511) return;
    const c = lin(hex), f = 1 + (h3(X, Y, Z) - 0.5) * 2 * j;
    this.m.set(this.key(X, Y, Z), { x: X, y: Y, z: Z, r: c[0] * f, g: c[1] * f, b: c[2] * f, e });
  }
  has(x, y, z) { return this.m.has(this.key(x, y, z)); }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: Farbe, e?: number, j?: number) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, hex, e, j);
  }
  cyl(cx: number, cz: number, y0: number, y1: number, r: number, hex: Farbe, e?: number, j?: number, hollow = false) {
    const R = Math.ceil(r);
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const d = Math.hypot(dx, dz); if (d > r + 0.01) continue; if (hollow && d < r - 1) continue;
      for (let y = y0; y <= y1; y++) this.set(cx + dx, y, cz + dz, hex, e, j);
    }
  }
  ell(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, hex: Farbe, e?: number, j?: number, cond?: (x: number, y: number, z: number) => boolean) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
      const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
      if (q <= 1 && (!cond || cond(x, y, z))) this.set(x, y, z, hex, e, j);
    }
  }
  cone(cx: number, cz: number, y0: number, h: number, r: number, hex: Farbe, e?: number, j?: number) { for (let i = 0; i < h; i++) this.cyl(cx, cz, y0 + i, y0 + i, Math.max(r * (1 - i / h), 0.45), hex, e, j); }
  line(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: Farbe, e?: number, j?: number, dicke = 0) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))));
    for (let i = 0; i <= n; i++) { const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), z = Math.round(z0 + (z1 - z0) * t);
      if (dicke) this.box(x, y, z, x + dicke, y, z + dicke, hex, e, j); else this.set(x, y, z, hex, e, j); }
  }
}

// Flächen mit Umgebungsverdeckung je Ecke; drei Töpfe: fest, leuchtend, Lampe
export type Farbe = string | ((x: number, y: number, z: number) => string | null | undefined);
export interface Voxel { x: number; y: number; z: number; r: number; g: number; b: number; e: number }
export interface MeshDaten { p: Float32Array; n: Int8Array; c: Float32Array; i: Uint32Array }
export const AOV = [0.5, 0.69, 0.85, 1];
export function meshVoxels(g: Grid, voxels: Iterable<Voxel>): (MeshDaten | null)[] {
  const T3: { p: number[]; n: number[]; c: number[]; i: number[] }[] = [{ p: [], n: [], c: [], i: [] }, { p: [], n: [], c: [], i: [] }, { p: [], n: [], c: [], i: [] }];
  for (const v of voxels) {
    const em = v.e !== 0, T = v.e > 0 ? T3[1] : v.e < 0 ? T3[2] : T3[0], k0 = Math.abs(v.e);
    for (let d = 0; d < 3; d++) for (const s of [1, -1]) {
      const n: number[] = [0, 0, 0]; n[d] = s;
      if (g.has(v.x + n[0], v.y + n[1], v.z + n[2])) continue;
      const u = (d + 1) % 3, w = (d + 2) % 3;
      const cs = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      const base = T.p.length / 3, ao: number[] = [];
      for (const [cu, cv] of cs) {
        const p = [v.x, v.y, v.z]; if (s > 0) p[d] += 1; p[u] += cu; p[w] += cv;
        T.p.push(p[0], p[1], p[2]); T.n.push(n[0], n[1], n[2]);
        let k;
        if (!em) {
          const q = [v.x + n[0], v.y + n[1], v.z + n[2]];
          const a = q.slice(); a[u] += cu ? 1 : -1;
          const b = q.slice(); b[w] += cv ? 1 : -1;
          const c = a.slice(); c[w] += cv ? 1 : -1;
          const s1 = g.has(a[0], a[1], a[2]) ? 1 : 0, s2 = g.has(b[0], b[1], b[2]) ? 1 : 0, sc = g.has(c[0], c[1], c[2]) ? 1 : 0;
          const o = (s1 && s2) ? 0 : 3 - (s1 + s2 + sc); ao.push(o); k = AOV[o];
        } else { ao.push(3); k = k0; }
        T.c.push(v.r * k, v.g * k, v.b * k);
      }
      if (ao[0] + ao[2] >= ao[1] + ao[3]) T.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else T.i.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
  }
  return T3.map((T) => (T.i.length ? { p: new Float32Array(T.p), n: new Int8Array(T.n), c: new Float32Array(T.c), i: new Uint32Array(T.i) } : null));
}

