/**
 * Wegfeld (Dijkstra, 8 Nachbarn, keine Diagonale an Ecken vorbei) in einem Ausschnitt der Welt.
 * kosten(x, z): Infinity = unpassierbar; Gebäude sind teuer, aber passierbar – dort greifen die Wesen an.
 */
export class Wegfeld {
  readonly x0: number; readonly z0: number; readonly w: number; readonly d: number;
  dist: Float32Array; kosten: Float32Array;
  private heap: Int32Array; private key: Float32Array; private n = 0;
  constructor(x0: number, z0: number, w: number, d: number) {
    this.x0 = x0; this.z0 = z0; this.w = w; this.d = d;
    this.dist = new Float32Array(w * d); this.kosten = new Float32Array(w * d);
    this.heap = new Int32Array(w * d * 8); this.key = new Float32Array(w * d * 8);
  }
  idx(x: number, z: number): number { const i = Math.floor(x) - this.x0, j = Math.floor(z) - this.z0; return i < 0 || j < 0 || i >= this.w || j >= this.d ? -1 : j * this.w + i; }
  innen(x: number, z: number): boolean { return this.idx(x, z) >= 0; }
  setzeKosten(fn: (x: number, z: number) => number): void { for (let j = 0; j < this.d; j++) for (let i = 0; i < this.w; i++) this.kosten[j * this.w + i] = fn(this.x0 + i, this.z0 + j); }
  berechne(quellen: [number, number][]): void {
    const W = this.w, D = this.d, dist = this.dist, k = this.kosten;
    dist.fill(Infinity); this.n = 0;
    for (const [x, z] of quellen) { const i = this.idx(x, z); if (i >= 0) { dist[i] = 0; this.push(i, 0); } }
    while (this.n) {
      const i = this.pop(), di = dist[i], ix = i % W, iz = (i - ix) / W;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = ix + dx, nz = iz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
        const ni = nz * W + nx, c = k[ni]; if (c === Infinity) continue;
        if (dx && dz && (k[iz * W + nx] === Infinity || k[nz * W + ix] === Infinity)) continue;
        const nd = di + c * (dx && dz ? 1.4142 : 1);
        if (nd < dist[ni]) { dist[ni] = nd; this.push(ni, nd); }
      }
    }
  }
  wert(x: number, z: number): number { const i = this.idx(x, z); return i < 0 ? Infinity : this.dist[i]; }
  /** bester Nachbar (Kachelmitte) von (x, z) aus */
  naechster(x: number, z: number): [number, number] | null {
    const cx = Math.floor(x), cz = Math.floor(z); let best = this.wert(cx, cz), bx = 0, bz = 0, ok = false;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const i = this.idx(cx + dx, cz + dz); if (i < 0) continue;
      if (dx && dz && (this.kosten[this.idx(cx + dx, cz)] === Infinity || this.kosten[this.idx(cx, cz + dz)] === Infinity)) continue;
      const v = this.dist[i]; if (v < best) { best = v; bx = dx; bz = dz; ok = true; }
    }
    return ok ? [cx + bx + 0.5, cz + bz + 0.5] : null;
  }
  private push(i: number, v: number): void {
    let p = this.n++; const h = this.heap, k = this.key;
    while (p > 0) { const q = (p - 1) >> 1; if (k[q] <= v) break; h[p] = h[q]; k[p] = k[q]; p = q; }
    h[p] = i; k[p] = v;
  }
  private pop(): number {
    const h = this.heap, k = this.key, top = h[0], last = h[--this.n], lv = k[this.n];
    let p = 0;
    for (;;) { let c = 2 * p + 1; if (c >= this.n) break; if (c + 1 < this.n && k[c + 1] < k[c]) c++; if (k[c] >= lv) break; h[p] = h[c]; k[p] = k[c]; p = c; }
    h[p] = last; k[p] = lv;
    return top;
  }
}
