import * as THREE from 'three';
import { FABRIK } from './grafik.ts';

/**
 * Glatte Modelle im „Foto-Look“ (Branch foto-look): statt Voxeln echte Geometrie mit Stein-, Holz- und Schindeltexturen.
 * Die Materialien sind normale Standardmaterialien (mit Lichtkarte über FABRIK.licht), laufen also bei WebGL und WebGPU.
 * Maße in Blöcken (1 Block ≈ 1 m), Mitte der Burg bei 0, Boden bei y = 0.
 */

/** Schalter: glatte Modelle statt Voxel (Branch foto-look: standardmäßig an) */
export const GLATT = { an: true };

// ---------- Texturen aus Rauschen (einmal erzeugt) ----------
function rauschZahl(x: number, y: number, s: number): number { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); }
function leinwand(n: number, malen: (c: CanvasRenderingContext2D, n: number) => void, wiederholen = 1): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d')!; malen(c, n);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(wiederholen, wiederholen); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function koernung(c: CanvasRenderingContext2D, n: number, menge: number, stark: number, s: number): void {
  for (let i = 0; i < menge; i++) { const x = rauschZahl(i, 1, s) * n, y = rauschZahl(i, 2, s) * n, a = rauschZahl(i, 3, s); c.fillStyle = a > 0.5 ? `rgba(255,255,255,${stark * a})` : `rgba(0,0,0,${stark * (1 - a)})`; c.fillRect(x, y, 1 + a * 2, 1 + a * 2); }
}
const TEX: { stein?: THREE.Texture; holz?: THREE.Texture; schindel?: THREE.Texture; mat?: Record<string, THREE.Material> } = {};
function steinTex(): THREE.Texture {
  return TEX.stein ??= leinwand(512, (c, n) => {
    c.fillStyle = '#6f6a62'; c.fillRect(0, 0, n, n); // Fuge
    const reihen = 8, h = n / reihen;
    for (let r = 0; r < reihen; r++) { const breite = n / (3 + (r % 3)), versatz = (r % 2) * breite / 2;
      for (let x = -breite; x < n + breite; x += breite) { const f = 0.78 + rauschZahl(r, x, 5) * 0.2, g = Math.round(185 * f), w = x + versatz;
        c.fillStyle = `rgb(${g + 6},${g},${g - 8})`; c.fillRect(w + 2, r * h + 2, breite - 4, h - 4);
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(w + 2, r * h + 2, breite - 4, 3); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(w + 2, r * h + h - 5, breite - 4, 3); } }
    koernung(c, n, 9000, 0.12, 1);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(70,95,45,${0.05 + rauschZahl(i, 9, 2) * 0.12})`; c.beginPath(); c.arc(rauschZahl(i, 7, 2) * n, rauschZahl(i, 8, 2) * n, 6 + rauschZahl(i, 4, 2) * 22, 0, 6.3); c.fill(); } // Moos
  }, 1);
}
function holzTex(): THREE.Texture {
  return TEX.holz ??= leinwand(256, (c, n) => {
    c.fillStyle = '#6b4a2f'; c.fillRect(0, 0, n, n);
    for (let x = 0; x < n; x += 2) { const f = 0.8 + rauschZahl(x, 0, 3) * 0.3; c.fillStyle = `rgba(${Math.round(120 * f)},${Math.round(80 * f)},${Math.round(48 * f)},0.9)`; c.fillRect(x, 0, 2, n); }
    for (let i = 0; i < 70; i++) { const x = rauschZahl(i, 1, 4) * n; c.fillStyle = 'rgba(30,18,8,0.25)'; c.fillRect(x, rauschZahl(i, 2, 4) * n, 1, 10 + rauschZahl(i, 3, 4) * 50); }
    for (let x = 0; x < n; x += 32) { c.fillStyle = 'rgba(20,12,6,0.55)'; c.fillRect(x, 0, 2, n); }
  });
}
function schindelTex(farbe: string): THREE.Texture {
  return leinwand(256, (c, n) => {
    c.fillStyle = '#20252f'; c.fillRect(0, 0, n, n); const reihen = 8, h = n / reihen, b = n / 6;
    for (let r = 0; r < reihen; r++) for (let x = -b; x < n + b; x += b) { const v = 0.75 + rauschZahl(r, x, 8) * 0.4, w = x + (r % 2) * b / 2;
      c.fillStyle = farbe; c.globalAlpha = Math.min(1, v); c.fillRect(w + 1, r * h, b - 2, h - 1); c.globalAlpha = 1;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(w + 1, r * h + h - 4, b - 2, 3); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(w + 1, r * h, b - 2, 2); }
    koernung(c, n, 2500, 0.1, 6);
  });
}

// ---------- Materialien ----------
function stoff(name: string, bau: () => THREE.Material): THREE.Material { TEX.mat ??= {}; return (TEX.mat[name] ??= bau()); }
const stein = (wdh: number) => { const t = steinTex().clone(); t.repeat.set(wdh, wdh); t.needsUpdate = true; return FABRIK.licht({ map: t, roughness: 0.92, metalness: 0 }, 1.2); };
const matStein = () => stoff('stein', () => stein(1));
const matHolz = () => stoff('holz', () => FABRIK.licht({ map: holzTex(), roughness: 0.85, metalness: 0 }, 1.2));
const matDach = (farbe: string) => stoff('dach' + farbe, () => FABRIK.licht({ map: schindelTex(farbe), roughness: 0.7, metalness: 0.05 }, 1.2));
const matFenster = () => stoff('fenster', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc06a').multiplyScalar(1.4), toneMapped: false }));
const matGold = () => stoff('gold', () => new THREE.MeshStandardMaterial({ color: '#d4a640', roughness: 0.35, metalness: 0.9 }));
const matKristall = () => stoff('kristall', () => new THREE.MeshPhysicalMaterial({ color: '#bff7ff', emissive: '#4fe0ff', emissiveIntensity: 1.6, roughness: 0.08, metalness: 0, transmission: 0.2, transparent: true, opacity: 0.92 }));
const matFahne = () => stoff('fahne', () => new THREE.MeshStandardMaterial({ color: '#9c2f2f', roughness: 0.9, side: THREE.DoubleSide }));

/** UV so skalieren, dass die Textur nicht gedehnt wird (Wandflächen: 1 Texturkachel ≈ 4 Blöcke) */
function weltUV(geo: THREE.BufferGeometry, kachel = 4): THREE.BufferGeometry {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = Math.abs(nor.getX(i)), nz = Math.abs(nor.getZ(i));
    uv[2 * i] = (nx > nz ? z : x) / kachel; uv[2 * i + 1] = y / kachel; if (Math.abs(nor.getY(i)) > 0.8) { uv[2 * i] = x / kachel; uv[2 * i + 1] = z / kachel; } }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}
function teil(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, schatten = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = schatten; m.receiveShadow = true; g.add(m); return m;
}
const quader = (b: number, h: number, t: number) => weltUV(new THREE.BoxGeometry(b, h, t));
const zyl = (r: number, h: number) => weltUV(new THREE.CylinderGeometry(r, r * 1.04, h, 28, 1, false));
/** Dach als Kegel mit Schindeln; Vierkantdach als Pyramide */
const kegel = (r: number, h: number, seiten = 28) => { const g = new THREE.ConeGeometry(r, h, seiten, 1); const uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 2); return g; };
const pyramide = (b: number, h: number) => { const g = new THREE.ConeGeometry(b / Math.SQRT2, h, 4, 1); g.rotateY(Math.PI / 4); const uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 2); return g; };

/** Zinnenkranz auf einer Rechteckmauer */
function zinnen(g: THREE.Group, bx: number, bz: number, y: number, rand = 0.5): void {
  const n = Math.round(bx / 1.4), m = Math.round(bz / 1.4);
  for (let i = 0; i < n; i++) { const x = -bx / 2 + (i + 0.5) * bx / n; for (const s of [-1, 1]) teil(g, quader(0.7, 0.8, 0.6), matStein(), x, y + 0.4, s * (bz / 2 - rand / 2)); }
  for (let i = 1; i < m - 1; i++) { const z = -bz / 2 + (i + 0.5) * bz / m; for (const s of [-1, 1]) teil(g, quader(0.6, 0.8, 0.7), matStein(), s * (bx / 2 - rand / 2), y + 0.4, z); }
}
function rundturm(g: THREE.Group, x: number, z: number, h: number, r: number, dach: string, fenster = true): void {
  teil(g, zyl(r, h), matStein(), x, h / 2, z);
  teil(g, new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.4, 28), matStein(), x, h + 0.2, z);
  teil(g, kegel(r * 1.3, r * 3.4), matDach(dach), x, h + 0.4 + r * 1.7, z);
  teil(g, new THREE.SphereGeometry(0.25, 12, 8), matGold(), x, h + 0.4 + r * 3.5, z, false);
  if (fenster) for (const a of [0.7, 2.4, 4.0, 5.5]) teil(g, new THREE.BoxGeometry(0.35, 0.8, 0.2), matFenster(), x + Math.cos(a) * (r + 0.02), h * 0.62, z + Math.sin(a) * (r + 0.02), false).rotation.y = -a + Math.PI / 2;
}

/** Glatte Burg, Maße nach dem Voxelmodell (Halbvoxel = 0,5 Block); stufe 1–6 wie `burg()` in modelle.ts */
export function glatteBurg(stufe: number): THREE.Group {
  const g = new THREE.Group(), dach = stufe >= 5 ? '#b87333' : '#3f5675';
  teil(g, quader(11.5, 0.6, 11.5), matStein(), 0, 0.3, 0); // Sockel
  teil(g, quader(9.4, 7.4, 9.4), matStein(), 0, 0.6 + 3.7, 0); // Hauptbau
  zinnen(g, 9.4, 9.4, 8.0);
  // Fenster (leuchten nachts), Tor
  for (const x of [-3, -1, 1, 3]) for (const y of [3.2, 6.2]) { teil(g, new THREE.BoxGeometry(0.6, 1.1, 0.15), matFenster(), x, y, 4.72, false); teil(g, new THREE.BoxGeometry(0.15, 1.1, 0.6), matFenster(), 4.72, y, x, false); teil(g, new THREE.BoxGeometry(0.15, 1.1, 0.6), matFenster(), -4.72, y, x, false); }
  teil(g, quader(2.2, 3.4, 0.5), matHolz(), 0, 2.3, 4.75); teil(g, new THREE.CylinderGeometry(1.1, 1.1, 0.5, 16, 1, false, 0, Math.PI), matHolz(), 0, 4.0, 4.75).rotation.set(Math.PI / 2, 0, 0);
  for (const s of [-1, 1]) { const f = teil(g, new THREE.PlaneGeometry(0.9, 3.2), matFahne(), s * 3, 6.6, 4.8, false); f.rotation.y = 0; }
  // Ecktürme
  for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) rundturm(g, x, z, 10.2, 1.5, dach);
  // Bergfried
  teil(g, quader(7, 4.4, 7), matStein(), 0, 8.0 + 2.2 - 0.4, 0);
  zinnen(g, 7, 7, 10.2, 0.4);
  teil(g, pyramide(8, 4.2), matDach(dach), 0, 10.4 + 2.1, 0);
  for (const x of [-2, 0, 2]) { teil(g, new THREE.BoxGeometry(0.6, 1.1, 0.15), matFenster(), x, 8.9, 3.52, false); }
  if (stufe < 2) { teil(g, new THREE.CylinderGeometry(0.08, 0.08, 4, 8), matHolz(), 0, 16.5, 0, false); teil(g, new THREE.PlaneGeometry(1.8, 1), matFahne(), 0.9, 18, 0, false); }
  else { teil(g, new THREE.CylinderGeometry(0.12, 0.12, 4, 8), matGold(), 0, 16.5, 0, false); const k = teil(g, new THREE.OctahedronGeometry(1, 0), matKristall(), 0, 19.4, 0, false); k.scale.set(0.9, 1.7, 0.9); }
  if (stufe >= 3) for (const [x, z] of [[-4.5, 0], [4.5, 0]]) rundturm(g, x, z, 7.5, 1.1, dach);
  if (stufe >= 4) { // Ringmauer (±6,2 Blöcke) mit Zinnen, Tor in der Vorderseite und Eckwehrtürmen
    const R = 6.2, H = 2.6, seg: number[][] = [[2 * R, 1, 0, -R], [1, 2 * R, -R, 0], [1, 2 * R, R, 0], [R - 1.2, 1, -(R + 1.2) / 2, R], [R - 1.2, 1, (R + 1.2) / 2, R]];
    for (const [bx, bz, x, z] of seg) { teil(g, quader(bx, H, bz), matStein(), x, H / 2, z); const z2 = new THREE.Group(); zinnen(z2, bx, bz, H, 0.3); z2.position.set(x, 0, z); g.add(z2); }
    for (const [x, z] of [[-R, -R], [R, -R], [-R, R], [R, R]]) rundturm(g, x, z, 4.6, 0.9, dach, false);
  }
  if (stufe >= 6) for (const [x, z] of [[-4.5, -4.5], [4.5, 4.5]]) { const k = teil(g, new THREE.OctahedronGeometry(0.7, 0), matKristall(), x, 16.2, z, false); k.scale.y = 1.6; }
  return g;
}
