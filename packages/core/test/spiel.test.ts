import { Spiel, DT, GEBAEUDE, TAG_DAUER, B } from '../src/index.ts';
let fehler = 0;
const pruefe = (ok: boolean, text: string) => { if (!ok) { fehler++; console.error('FEHLER:', text); } else console.log('ok –', text); };

const s = new Spiel('NEBELKRAKE-4127');
pruefe(s.gebaeude.length === 5, 'Start: Hauptgebäude, Werkstatt, Wachturm, Holzfäller, Steinbruch'); pruefe(s.arbeiter.length === 4, 'Start: vier Arbeiter');
pruefe(s.erkundetAn(B.x, B.z) && !s.erkundetAn(B.x + 300, B.z), 'Um die Feste erkundet, weit draußen Nebel');
// Bot: baut vor dem Tor ein paar Türme und Fackeln
const plaetze: [number, number][] = [[-9, 8], [10, 10], [-4, 16], [6, 18], [-12, 20]];
let gebaut = 0;
for (const [dx, dz] of plaetze) if (s.bauen('wachturm', B.x + dx, B.z + dz, true)) gebaut++;
s.bauen('fackel', B.x + 1, B.z + 14, true);
s.bauen('holz', B.x - 22, B.z - 14, true);
pruefe(gebaut >= 1, `Bot konnte ${gebaut} Wachtürme bauen`);
const t0 = Date.now();
let naechte = 0;
for (let i = 0; i < (TAG_DAUER + 200) * 20 * 3 && s.phase !== 'verloren'; i++) {
  const vor = s.phase; s.schritt(); s.ereignisse.length = 0;
  if (vor === 'morgen' && s.phase === 'tag') { naechte++; for (const [dx, dz] of plaetze) s.bauen('wachturm', B.x + dx, B.z + dz, true); }
}
console.log(`  ${naechte} Nächte simuliert in ${Date.now() - t0} ms, besiegt: ${s.besiegt}, Phase: ${s.phase}, Holz ${Math.round(s.res.holz)}`);
pruefe(naechte >= 2, 'Mit ein paar Türmen übersteht man die ersten Nächte');
pruefe(s.besiegt > 20, 'Türme besiegen Wesen');
const st = s.speichern();
const t = new Spiel(st.code, JSON.parse(JSON.stringify(st)));
pruefe(t.gebaeude.length === s.gebaeude.length && t.nacht === s.nacht && Math.round(t.res.holz) === Math.round(s.res.holz), 'Spielstand speichern und laden');
// ohne jede Verteidigung fällt die Feste irgendwann
const leer = new Spiel('LEER-1111');
for (const g of [...leer.gebaeude]) if (g.typ === 'wachturm') leer.abreissen(g);
for (let i = 0; i < 20 * 60 * 30 && leer.phase !== 'verloren'; i++) { leer.schritt(); leer.ereignisse.length = 0; }
pruefe(leer.phase === 'verloren', `Ohne Türme fällt die Feste (nach Nacht ${leer.nacht})`);
void GEBAEUDE; void DT;
if (fehler) process.exit(1);
// Arbeiter fällen Bäume, die nachwachsen
{
  const w = new Spiel('NEBELKRAKE-4127'); const holz0 = w.res.holz;
  for (let i = 0; i < 20 * 60; i++) { w.schritt(); w.ereignisse.length = 0; }
  pruefe(w.res.holz > holz0 + 20, `Arbeiter bringen Holz (+${Math.round(w.res.holz - holz0)} in einer Minute)`);
  pruefe(w.gefaellt.size > 0, `Bäume wurden gefällt (${w.gefaellt.size})`);
  const [k] = [...w.gefaellt.keys()]; const x = Math.floor(k / 2048) - 600, z = (k % 2048) - 600;
  pruefe(w.dekoZustand(x, z) === 'stumpf', 'gefällter Baum ist ein Stumpf');
  w.nacht += 3; pruefe(w.dekoZustand(x, z) === 'setzling', 'nach 3 Tagen ein Setzling');
  w.nacht += 3; pruefe(w.dekoZustand(x, z) === null, 'nach 6 Tagen wieder ein Baum');
  // Reparieren
  const t = w.gebaeude.find((g) => g.typ === 'wachturm')!; t.hp = t.max * 0.3; const st0 = w.res.stein;
  pruefe(w.reparieren(t), 'Reparatur startet am Tag');
  for (let i = 0; i < 20 * 15; i++) { w.schritt(); w.ereignisse.length = 0; }
  pruefe(t.hp >= t.max - 0.5 && w.res.stein < st0 + 50, 'Reparatur kostet und heilt über die Zeit');
  pruefe(w.wegVorschau()[0].length > 50, `Wegvorschau vom Riss zur Feste (${w.wegVorschau()[0].length} Schritte)`);
}
