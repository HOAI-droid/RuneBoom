import { setzeSeed, spalte } from '../src/welt.ts';
import { seedAusCode } from '../src/zufall.ts';
import { trockenerWeg, trocken, freieSicht } from '../src/wege.ts';
let fehler = 0;
const pruefe = (ok: boolean, text: string) => { if (!ok) { fehler++; console.error('FEHLER:', text); } else console.log('ok –', text); };
// eine Welt mit Wasser: einen Teich suchen und quer darüber einen Weg verlangen
let gefunden = false;
for (const code of ['NEBELKRAKE-4127', 'BERNSTEINFESTE-9946', 'STURMKLAUE-6944']) {
  setzeSeed(seedAusCode(code));
  for (let x = -300; x < 300 && !gefunden; x += 3) for (let z = -300; z < 300 && !gefunden; z += 3) {
    const s = spalte(x, z); if (!s || s.a !== 'w') continue;
    // Ufer links und rechts des Wassers in x-Richtung
    let l = x, r = x; while (!trocken(l, z) && x - l < 30) l--; while (!trocken(r, z) && r - x < 30) r++;
    if (!trocken(l, z) || !trocken(r, z) || r - l < 4) continue;
    const ax = l - 2.5, bx = r + 2.5; if (!trocken(ax, z + 0.5) || !trocken(bx, z + 0.5)) continue;
    const w = trockenerWeg(ax, z + 0.5, bx, z + 0.5);
    if (!w || !w.length) continue;
    gefunden = true;
    let px = ax, pz = z + 0.5, ok = true;
    for (const [qx, qz] of w) { if (!freieSicht(px, pz, qx, qz)) ok = false; px = qx; pz = qz; }
    pruefe(ok, `${code}: Weg um das Wasser bei (${x}, ${z}) bleibt trocken (${w.length} Wegpunkte)`);
    pruefe(Math.hypot(px - bx, pz - z - 0.5) < 0.01, 'Weg endet am Ziel');
  }
  if (gefunden) break;
}
pruefe(gefunden, 'Testteich gefunden');
pruefe(JSON.stringify(trockenerWeg(0.5, 0.5, 0.5, 0.5)) === '[]' || !trocken(0.5, 0.5), 'gerade Linie braucht keine Wegpunkte');
if (fehler) process.exit(1);
