import { Spiel, B, type Befehl } from '../src/index.ts';
let fehler = 0;
const pruefe = (ok: boolean, text: string) => { if (!ok) { fehler++; console.error('FEHLER:', text); } else console.log('ok –', text); };
// Partie A: Befehle zu verschiedenen Zeiten, dann bis in die zweite Nacht
const A = new Spiel('NEBELKRAKE-4127'); A.res.holz = A.res.stein = 2000; A.res.kristall = 300;
const plan: { takt: number; b: () => Befehl | null }[] = [];
const ort = (typ: Parameters<Spiel['pruefe']>[0], r0: number) => { for (let r = r0; r < r0 + 30; r += 2) for (let a = 0; a < 6.28; a += 0.3) { const x = Math.round(B.x + Math.cos(a) * r), z = Math.round(B.z + 6 + Math.sin(a) * r); if (A.pruefe(typ, x, z).ok) return [x, z]; } return null; };
plan.push({ takt: 20, b: () => { const p = ort('wachturm', 14); return p && { art: 'bauen', typ: 'wachturm', x: p[0], z: p[1] }; } });
plan.push({ takt: 60, b: () => { const p = ort('feuertopf', 18); return p && { art: 'bauen', typ: 'feuertopf', x: p[0], z: p[1] }; } });
plan.push({ takt: 90, b: () => ({ art: 'spaeher', x: B.x + 60, z: B.z + 40 }) });
plan.push({ takt: 200, b: () => ({ art: 'nacht' }) });
const N = 20 * 60 * 4; // vier Minuten Spielzeit
const summen: number[] = [];
for (let i = 0; i < N; i++) {
  for (const p of plan) if (p.takt === A.takt) { const b = p.b(); if (b) A.befehl(b); }
  A.schritt(); A.ereignisse.length = 0;
  if (i % 400 === 0) summen.push(A.pruefsumme());
}
pruefe(A.protokoll.length >= 3, `Befehle aufgezeichnet (${A.protokoll.length})`);
// Partie B: nur das Protokoll nachspielen
const Bs = new Spiel('NEBELKRAKE-4127'); Bs.res.holz = Bs.res.stein = 2000; Bs.res.kristall = 300;
const proto = JSON.parse(JSON.stringify(A.protokoll)) as typeof A.protokoll;
const summenB: number[] = [];
for (let i = 0; i < N; i++) {
  for (const e of proto) if (e.takt === Bs.takt) Bs.befehl(e.b);
  Bs.schritt(); Bs.ereignisse.length = 0;
  if (i % 400 === 0) summenB.push(Bs.pruefsumme());
}
pruefe(JSON.stringify(summen) === JSON.stringify(summenB), 'Wiederholung aus dem Protokoll ergibt dieselbe Partie (Prüfsummen gleich)');
pruefe(A.pruefsumme() === Bs.pruefsumme() && A.nacht === Bs.nacht, `gleicher Endstand (Nacht ${A.nacht}, ${A.gegner.length} Wesen)`);
const C = new Spiel('NEBELKRAKE-4127'); C.res.holz = C.res.stein = 2000; C.res.kristall = 300;
for (let i = 0; i < 400; i++) C.schritt();
pruefe(C.pruefsumme() !== summen[1], 'ohne Befehle weicht die Prüfsumme ab');
if (fehler) process.exit(1);
