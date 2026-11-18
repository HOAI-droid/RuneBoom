import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FABRIK } from './grafik.ts';

/**
 * Glatte Natur im „Foto-Look“ (Branch foto-look): Bäume, Büsche, Felsen, Gras und Blumen als echte Geometrie
 * mit Vertexfarben (Verlauf, Moos, Rinde), je Art ein InstancedMesh je Kachel. Maße in Blöcken, Fuß bei y = 0.
 * Der Kachelbauer (chunk.ts, läuft im Hintergrund-Rechner) liefert nur Zahlen; hier entsteht die Darstellung.
 */

/** Arten in der Instanzliste (Stufe je Instanz: 8 Werte) */
export const NAT = { laub: 0, tanne: 1, herbst: 2, leucht: 3, busch: 4, tot: 5, fels: 6, gras: 7, blume: 8 } as const;
/** Listenaufbau je Instanz: Art, x, y, z (Kachel-Koordinaten), Drehung, Größe, Variante, Tönung (0 normal, 1 Asche) */
export const NAT_SCHRITT = 8;

const rz = (x: number, y: number, z: number, s: number): number => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.3) * 43758.5453; return v - Math.floor(v); };
/** weiches Rauschen (zwei Oktaven aus Sinus), −1…1 */
const wr = (x: number, y: number, z: number, s: number): number => 0.62 * Math.sin(x * 2.3 + s) * Math.cos(z * 2.1 - s * 0.7 + y * 1.3) + 0.38 * Math.sin(x * 5.1 + y * 4.3 + z * 4.7 + s * 2.1);

type Farbe = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => THREE.Color;
/** Geometrie vorbereiten: ohne UV, mit Normalen und Farbe */
function fertig(geo: THREE.BufferGeometry, farbe: Farbe): THREE.BufferGeometry {
  geo.deleteAttribute('uv'); if (!geo.index) { geo.deleteAttribute('normal'); geo = mergeVertices(geo, 1e-4); } geo.computeVertexNormals();
  const p = geo.getAttribute('position'), n = geo.getAttribute('normal'), c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = farbe(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)); c[3 * i] = k.r; c[3 * i + 1] = k.g; c[3 * i + 2] = k.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}
const lin = (a: string, b: string, t: number): THREE.Color => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t)));

/** Laubklumpen: Kugel, unregelmäßig ausgebeult, Farbverlauf von unten (dunkel) nach oben (hell) */
function klumpen(sx: number, sy: number, sz: number, x: number, y: number, z: number, s: number, dunkel: string, mitte: string, hell: string, beule = 0.22): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-4);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i), f = 1 + beule * wr(dx * 2.2, dy * 2.2, dz * 2.2, s) + 0.07 * wr(dx * 7, dy * 7, dz * 7, s + 3);
    p.setXYZ(i, dx * f * sx + x, dy * f * sy + y, dz * f * sz + z);
  }
  return fertig(g, (px, py, pz) => { const h = (py - (y - sy)) / (2 * sy), n = wr(px * 3, py * 3, pz * 3, s + 9) * 0.5 + 0.5, t = h * 0.8 + n * 0.35 - 0.1; return t < 0.5 ? lin(dunkel, mitte, t * 2) : lin(mitte, hell, (t - 0.5) * 2); });
}
/** Ast oder Stamm: Kegelstumpf von (x0,y0,z0) nach (x1,y1,z1) */
function ast(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number, rinde = ['#3e2b1c', '#6d4c30']): THREE.BufferGeometry {
  const v = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), len = v.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 9, 4); g.deleteAttribute('uv');
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize())); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return fertig(g, (px, py, pz) => lin(rinde[0], rinde[1], 0.45 + 0.55 * wr(px * 9, py * 2, pz * 9, 4)));
}
const vereint = (teile: THREE.BufferGeometry[]): THREE.BufferGeometry => { const g = mergeGeometries(teile, false)!; teile.forEach((t) => t.dispose()); return g; };

function laubbaum(v: number, farben: [string, string, string], beeren = false): THREE.BufferGeometry {
  const s = v * 7.3 + 1, [d, m, h] = farben, t: THREE.BufferGeometry[] = [];
  const th = 4.2 + 0.5 * v;
  t.push(ast(0, -0.2, 0, 0.1, th, 0, 0.55, 0.28), ast(0.05, th - 1.3, 0, -1.8, th + 1.1, -1.0, 0.2, 0.08), ast(0.05, th - 0.9, 0, 1.9, th + 0.9, 1.2, 0.2, 0.08));
  for (const [dx, dz] of [[0.55, 0.1], [-0.4, 0.45], [0.05, -0.55]]) t.push(ast(dx * 0.6, 0.1, dz * 0.6, dx * 1.5, -0.25, dz * 1.5, 0.22, 0.1)); // Wurzelanläufe
  t.push(klumpen(2.7, 2.2, 2.7, 0, th + 2.0, 0, s, d, m, h), klumpen(1.9, 1.6, 1.9, -1.9, th + 1.2, -1.2, s + 1, d, m, h), klumpen(1.9, 1.6, 1.9, 2.0, th + 1.2, 1.3, s + 2, d, m, h),
    klumpen(1.7, 1.4, 1.7, 0.7, th + 3.6, -0.7, s + 3, d, m, h), klumpen(1.5, 1.2, 1.5, -0.8, th + 0.6, 1.9, s + 4, d, m, h));
  if (beeren) for (let i = 0; i < 9; i++) { const a = rz(i, 1, v, 5) * 6.28, y = th + 0.8 + rz(i, 2, v, 5) * 3.4, r = 2.0 + rz(i, 3, v, 5) * 0.7; t.push(fertig(new THREE.IcosahedronGeometry(0.16, 1).translate(Math.cos(a) * r, y, Math.sin(a) * r), () => new THREE.Color('#9be8ff').multiplyScalar(2.6))); }
  return vereint(t);
}
function tanne(v: number): THREE.BufferGeometry {
  const s = v * 5.1 + 2, t: THREE.BufferGeometry[] = [ast(0, -0.2, 0, 0, 2.2, 0, 0.45, 0.25)], stufen = 6;
  for (let i = 0; i < stufen; i++) {
    const f = i / (stufen - 1), r = 3.0 - 2.3 * f + 0.15 * v, h = 3.2 - 1.2 * f, y = 1.3 + i * 1.75;
    let g: THREE.BufferGeometry = new THREE.ConeGeometry(r, h, 14, 3, true); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-4);
    const p = g.getAttribute('position');
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), yy = p.getY(k), z = p.getZ(k), rand = (1 - (yy + h / 2) / h), w = 1 + 0.18 * wr(x * 3, yy * 2, z * 3, s + i); p.setXYZ(k, x * w, yy - 0.35 * rand * rand * r * 0.5, z * w); }
    g.translate(0, y + h / 2, 0);
    t.push(fertig(g, (px, py, pz) => { const n = wr(px * 4, py * 4, pz * 4, s) * 0.5 + 0.5, hh = ((py - y) / h); return lin('#1f4a2c', '#5a9a62', 0.2 + 0.6 * hh + n * 0.3); }));
  }
  t.push(fertig(new THREE.ConeGeometry(0.35, 1.6, 7).translate(0, 1.3 + stufen * 1.75 - 0.4, 0), () => new THREE.Color('#3a6b45')));
  return vereint(t);
}
function busch(v: number): THREE.BufferGeometry {
  const s = v * 3.3 + 7;
  return vereint([klumpen(1.5, 1.0, 1.4, 0, 0.8, 0, s, '#2b5a2d', '#477d38', '#6aa14a', 0.25), klumpen(1.0, 0.8, 1.0, 1.1, 0.55, 0.5, s + 1, '#2b5a2d', '#477d38', '#6aa14a', 0.25), klumpen(0.9, 0.7, 0.9, -1.0, 0.5, -0.4, s + 2, '#2b5a2d', '#477d38', '#6aa14a', 0.25)]);
}
function toterBaum(v: number): THREE.BufferGeometry {
  const s = v * 2.7, t: THREE.BufferGeometry[] = [ast(0, -0.2, 0, 0.2, 5.6, 0, 0.42, 0.12, ['#241d1a', '#4a3d35'])];
  for (let i = 0; i < 5; i++) { const a = rz(i, 1, v, 8) * 6.28, y = 2.2 + i * 0.7, l = 1.3 + rz(i, 2, v, 8); t.push(ast(0, y, 0, Math.cos(a) * l, y + 0.9 + rz(i, 3, v, 8), Math.sin(a) * l, 0.14, 0.04, ['#241d1a', '#4a3d35'])); }
  void s; return vereint(t);
}
function fels(v: number): THREE.BufferGeometry {
  const s = v * 4.1 + 3;
  const stein = (sx: number, sy: number, sz: number, x: number, y: number, z: number, k: number): THREE.BufferGeometry => {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-4);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i), f = 1 + 0.28 * wr(dx * 1.7, dy * 1.7, dz * 1.7, s + k) + 0.09 * wr(dx * 6, dy * 6, dz * 6, s + k), fl = dy < -0.55 ? 0.55 : 1; p.setXYZ(i, dx * f * sx + x, Math.max(-0.5 * sy, dy * f * sy * fl) + y, dz * f * sz + z); }
    return fertig(g, (px, py, pz, nx, ny, nz) => { const n = wr(px * 5, py * 5, pz * 5, s) * 0.5 + 0.5, grau = lin('#5c5e60', '#a3a5a6', 0.35 + n * 0.5); return ny > 0.55 ? grau.lerp(new THREE.Color('#4d7a3a'), Math.min(1, (ny - 0.55) * 2.2) * (0.55 + 0.4 * n)) : grau.multiplyScalar(0.8 + 0.3 * (ny + nx * 0.2)); });
  };
  return vereint([stein(1.25, 0.8, 1.0, 0, 0.35, 0, 0), stein(0.7, 0.5, 0.65, 1.15, 0.12, 0.55, 5), stein(0.45, 0.35, 0.4, -0.95, 0.05, -0.7, 9)]);
}
/** Grasbüschel aus 7 gebogenen Halmen */
function gras(v: number, blume?: string): THREE.BufferGeometry {
  const t: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = rz(i, 1, v, 11) * 6.28, r = 0.05 + rz(i, 2, v, 11) * 0.12, h = 0.45 + rz(i, 3, v, 11) * 0.5, bieg = 0.15 + rz(i, 4, v, 11) * 0.3;
    const g = new THREE.BufferGeometry(), dx = Math.cos(a), dz = Math.sin(a), px = -dz * 0.045, pz = dx * 0.045;
    g.setAttribute('position', new THREE.Float32BufferAttribute([r * dx - px, 0, r * dz - pz, r * dx + px, 0, r * dz + pz, r * dx + dx * bieg * 0.5, h * 0.55, r * dz + dz * bieg * 0.5, r * dx + dx * bieg, h, r * dz + dz * bieg], 3));
    g.setIndex([0, 1, 2, 1, 3, 2]); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    t.push(fertig(g, (_x, y) => lin('#2f5a26', '#9cc95a', y / 0.9 + 0.1)));
  }
  if (blume) { const h = 0.6 + rz(1, 1, v, 12) * 0.3; t.push(ast(0, 0, 0, 0.05, h, 0.02, 0.025, 0.018, ['#3d6a2c', '#4f8a3a']), fertig(new THREE.IcosahedronGeometry(0.11, 1).translate(0.05, h + 0.05, 0.02), () => new THREE.Color(blume))); }
  return vereint(t);
}

// ---------- Netze und Material (einmal je Art, geteilt von allen Kacheln) ----------
const BLUMEN = ['#e8d06a', '#d86aa8', '#8fd0ff', '#f2f0ea'];
let NETZ: Map<string, THREE.BufferGeometry> | null = null;
let MAT: { fest: THREE.Material; gras: THREE.Material } | null = null;
function netze(): Map<string, THREE.BufferGeometry> {
  if (NETZ) return NETZ; const m = new Map<string, THREE.BufferGeometry>();
  for (let v = 0; v < 2; v++) {
    m.set(`${NAT.laub}/${v}`, laubbaum(v, ['#244a22', '#4a8a3a', '#7db64e'])); m.set(`${NAT.herbst}/${v}`, laubbaum(v, ['#7a3a1c', '#c9722e', '#e6a03e']));
    m.set(`${NAT.leucht}/${v}`, laubbaum(v, ['#322a5c', '#5b4e8a', '#8678c2'], true));
    m.set(`${NAT.tanne}/${v}`, tanne(v)); m.set(`${NAT.busch}/${v}`, busch(v)); m.set(`${NAT.tot}/${v}`, toterBaum(v)); m.set(`${NAT.fels}/${v}`, fels(v));
  }
  for (let v = 0; v < 3; v++) m.set(`${NAT.gras}/${v}`, gras(v));
  for (let v = 0; v < BLUMEN.length; v++) m.set(`${NAT.blume}/${v}`, gras(v + 5, BLUMEN[v]));
  return (NETZ = m);
}
function material(): { fest: THREE.Material; gras: THREE.Material } {
  return MAT ??= { fest: FABRIK.licht({ vertexColors: true, roughness: 0.88, metalness: 0 }, 1.2), gras: FABRIK.licht({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }, 1.2) };
}

/** Instanzliste einer Kachel in Netze verwandeln; Rückgabe gehört der Kachel (`userData.geteilt`: Netze nicht freigeben) */
export function baueNatur(liste: Float32Array, schatten: boolean): THREE.Object3D[] {
  const N = netze(), M = material(), gruppen = new Map<string, number[]>();
  for (let i = 0; i < liste.length; i += NAT_SCHRITT) {
    const art = liste[i], v = liste[i + 6], key = `${art}/${art === NAT.gras ? v % 3 : art === NAT.blume ? v % BLUMEN.length : v % 2}`; (gruppen.get(key) ?? gruppen.set(key, []).get(key)!).push(i);
  }
  const aus: THREE.Object3D[] = [], mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sk = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), farbe = new THREE.Color();
  for (const [key, idx] of gruppen) {
    const geo = N.get(key); if (!geo) continue; const art = +key.split('/')[0], klein = art === NAT.gras || art === NAT.blume;
    const mesh = new THREE.InstancedMesh(geo, klein ? M.gras : M.fest, idx.length);
    idx.forEach((i, k) => {
      pos.set(liste[i + 1], liste[i + 2], liste[i + 3]); q.setFromAxisAngle(up, liste[i + 4]); const g = liste[i + 5]; sk.set(g, g, g); mat4.compose(pos, q, sk); mesh.setMatrixAt(k, mat4);
      const hell = 0.86 + 0.28 * rz(liste[i + 1], liste[i + 3], 0, 3); farbe.setRGB(hell, hell, hell); if (liste[i + 7] === 1) farbe.multiplyScalar(0.55); mesh.setColorAt(k, farbe);
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = schatten && !klein; mesh.receiveShadow = true; mesh.userData.geteilt = true; aus.push(mesh);
  }
  return aus;
}
