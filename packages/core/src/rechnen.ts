/**
 * Überall gleiche Rechnung: Math.sin, Math.atan2, Math.pow … dürfen je nach Browser im letzten Bit abweichen.
 * Für Mehrspieler (jedes Gerät rechnet dieselbe Partie) nutzt die Simulation nur diese Fassungen,
 * die allein aus Grundrechenarten bestehen (die rechnen alle Geräte bitgleich, IEEE 754).
 */
const PI = 3.141592653589793, ZWEI_PI = 6.283185307179586, HALB_PI = 1.5707963267948966, LN2 = 0.6931471805599453;

/** Sinus: auf [-π, π] gebracht, dann auf [-π/2, π/2] gespiegelt, Taylor bis x^15 */
export function msin(x: number): number {
  if (!isFinite(x)) return NaN;
  x = x - ZWEI_PI * Math.round(x / ZWEI_PI);
  if (x > HALB_PI) x = PI - x; else if (x < -HALB_PI) x = -PI - x;
  const q = x * x;
  return x * (1 + q * (-1 / 6 + q * (1 / 120 + q * (-1 / 5040 + q * (1 / 362880 + q * (-1 / 39916800 + q * (1 / 6227020800 + q * (-1 / 1307674368000))))))));
}
export function mcos(x: number): number { return msin(x + HALB_PI); }

/** Arcustangens auf [0, 1] über Halbierung (atan x = 2 atan(x / (1 + sqrt(1 + x²)))) und Reihe */
function atan01(x: number): number {
  const y = x / (1 + Math.sqrt(1 + x * x)); // y ≤ 0,415
  const z = y / (1 + Math.sqrt(1 + y * y)); // z ≤ 0,2
  const q = z * z;
  let s = 0, t = z, n = 1;
  for (let i = 0; i < 12; i++) { s += t / n; t *= -q; n += 2; }
  return 4 * s;
}
export function matan(x: number): number {
  if (x !== x) return NaN;
  const neg = x < 0; if (neg) x = -x;
  const r = x > 1 ? HALB_PI - atan01(1 / x) : atan01(x);
  return neg ? -r : r;
}
export function matan2(y: number, x: number): number {
  if (x > 0) return matan(y / x);
  if (x < 0) return y >= 0 ? matan(y / x) + PI : matan(y / x) - PI;
  return y > 0 ? HALB_PI : y < 0 ? -HALB_PI : 0;
}
/** Länge: Wurzel ist in IEEE 754 exakt gerundet */
export function mhypot(a: number, b: number, c = 0): number { return Math.sqrt(a * a + b * b + c * c); }

/** natürlicher Logarithmus: x = m · 2^k mit m in [1, 2), ln m über atanh-Reihe */
export function mlog(x: number): number {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  if (!isFinite(x)) return x;
  let k = 0;
  while (x >= 2) { x /= 2; k++; }
  while (x < 1) { x *= 2; k--; }
  const u = (x - 1) / (x + 1), q = u * u;
  let s = 0, t = u;
  for (let n = 1; n < 40; n += 2) { s += t / n; t *= q; }
  return 2 * s + k * LN2;
}
/** e^x: x = k ln2 + r, e^r über Taylor, 2^k durch Verdoppeln */
export function mexp(x: number): number {
  if (x !== x) return NaN;
  if (x > 709) return Infinity; if (x < -745) return 0;
  const k = Math.round(x / LN2), r = x - k * LN2;
  let s = 1, t = 1;
  for (let n = 1; n < 22; n++) { t *= r / n; s += t; }
  let f = 1; const b = k >= 0 ? 2 : 0.5;
  for (let i = 0; i < Math.abs(k); i++) f *= b;
  return s * f;
}
/** x^y für x ≥ 0 (ganze Hochzahlen durch Multiplizieren) */
export function mpow(x: number, y: number): number {
  if (y === 0) return 1;
  if (Number.isInteger(y) && Math.abs(y) <= 64) { let r = 1; for (let i = 0; i < Math.abs(y); i++) r *= x; return y < 0 ? 1 / r : r; }
  if (x === 0) return 0;
  if (x < 0) return NaN;
  return mexp(y * mlog(x));
}
