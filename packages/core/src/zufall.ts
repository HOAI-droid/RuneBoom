/** Zufall und Rauschen mit Seed: gleiche Eingabe, gleiches Ergebnis auf jedem Gerät. */
export function h3(x: number, y: number, z: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export type Rng = () => number;
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const sm = (t: number) => t * t * (3 - 2 * t);
export function noise(x: number, z: number, s: number): number {
  const xi = Math.floor(x), zi = Math.floor(z), fx = sm(x - xi), fz = sm(z - zi);
  const a = h3(xi, zi, s), b = h3(xi + 1, zi, s), c = h3(xi, zi + 1, s), d = h3(xi + 1, zi + 1, s);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export function fbm(x: number, z: number, f: number, s: number): number {
  return noise(x * f, z * f, s) * 0.55 + noise(x * f * 2.1, z * f * 2.1, s + 11) * 0.3 + noise(x * f * 4.3, z * f * 4.3, s + 23) * 0.15;
}
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const pick = <T>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length)];

/** Weltcode → Seed (FNV-1a über die Großbuchstaben und Ziffern) */
export function seedAusCode(code: string): number {
  const s = code.toUpperCase().replace(/[^A-Z0-9ÄÖÜ]/g, '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 1000000007;
}
const SILBE_A = ['NEBEL', 'GLUT', 'STURM', 'MOOR', 'RUNEN', 'KRISTALL', 'ASCHE', 'FROST', 'DORN', 'SCHATTEN', 'BERNSTEIN', 'WIND'];
const SILBE_B = ['KRAKE', 'FALKE', 'WOLF', 'DRACHE', 'EICHE', 'KRONE', 'FESTE', 'QUELLE', 'SCHMIEDE', 'LAUTE', 'KLAUE', 'MOTTE'];
/** Neuer zufälliger, gut lesbarer Weltcode, z. B. NEBELKRAKE-4127 */
export function neuerWeltcode(r: Rng = Math.random): string {
  return pick(r, SILBE_A) + pick(r, SILBE_B) + '-' + String(1000 + Math.floor(r() * 9000));
}
