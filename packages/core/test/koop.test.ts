import { Spiel, B, RISSE, type Befehl } from '../src/index.ts';
let fehler = 0;
const pruefe = (ok: boolean, text: string) => { if (!ok) { fehler++; console.error('FEHLER:', text); } else console.log('ok –', text); };
const CODE = 'NEBELKRAKE-4127';
const A = new Spiel(CODE);
const holz0 = A.res.holz;
A.befehl({ art: 'beitritt', id: 'anna', name: 'Anna', seite: 'sued' });
A.befehl({ art: 'beitritt', id: 'ben', name: 'Ben', seite: 'sued' }); // Süden ist vergeben → nächste freie Seite
pruefe(A.spieler.length === 2 && A.spieler[1].seite === 'ost', `zweiter Spieler bekommt eine freie Seite (${A.spieler[1]?.seite})`);
pruefe(A.kasse('anna').holz === holz0 && A.kasse('ben').holz === 150, 'erste Kasse übernimmt die Feste, zweite bekommt einen Grundstock');
pruefe(A.gebaeude.filter((g) => g.spieler !== 'anna').length === 1 && A.gebaeude.some((g) => g.spieler === 'ben' && g.typ === 'wachturm'), 'vorhandene Gebäude gehören dem ersten Spieler, der zweite findet einen Wachturm vor');
pruefe(A.offeneRisse(1).length >= 2, `Risse beider Seiten ab Nacht 1 offen (${A.offeneRisse(1).map((q) => q.name).join(', ')})`);
// Ben baut: zahlt aus seiner Kasse, Anna bleibt unberührt
const ort = (typ: Parameters<Spiel['pruefe']>[0], r0: number) => { for (let r = r0; r < r0 + 30; r += 2) for (let a = 0; a < 6.28; a += 0.3) { const x = Math.round(B.x + Math.cos(a) * r), z = Math.round(B.z + 6 + Math.sin(a) * r); if (A.pruefe(typ, x, z).ok) return [x, z]; } return null; };
const p = ort('wachturm', 14)!;
const annaVor = A.kasse('anna').holz, benVor = A.kasse('ben').holz;
const b: Befehl = { art: 'bauen', typ: 'wachturm', x: p[0], z: p[1], spieler: 'ben' };
pruefe(A.befehl(b), 'Ben baut einen Wachturm');
pruefe(A.kasse('ben').holz < benVor && A.kasse('anna').holz === annaVor, 'Ben zahlt selbst');
pruefe(A.gebaeude.at(-1)!.spieler === 'ben', 'der Turm gehört Ben');
A.ansicht = 'ben'; const kann = A.kannBezahlen({ holz: 5000 }); A.ansicht = null;
pruefe(!kann, 'Prüfung der Oberfläche nutzt die eigene Kasse');
// Erträge gehen an den Besitzer
const annaH = A.kasse('anna').holz;
for (let i = 0; i < 20 * 60; i++) { A.schritt(); A.ereignisse.length = 0; }
pruefe(A.kasse('anna').holz > annaH, `Holzfäller liefert an Anna (${annaH} → ${Math.floor(A.kasse('anna').holz)})`);
// Speichern und Laden behalten Spieler und Kassen
const st = JSON.parse(JSON.stringify(A.speichern()));
const C = new Spiel(CODE, st);
pruefe(C.spieler.length === 2 && C.kasse('ben').holz === A.kasse('ben').holz, 'Spielstand behält Spieler und Kassen');
pruefe(C.gebaeude.filter((g) => g.spieler === 'ben').length === 2, 'Besitz bleibt nach dem Laden');
// zwei Rechner, die denselben Spielstand laden und dieselben Befehle bekommen, bleiben gleich
const D = new Spiel(CODE, JSON.parse(JSON.stringify(st))), E = new Spiel(CODE, JSON.parse(JSON.stringify(st)));
let gleich = true;
for (let i = 0; i < 20 * 200; i++) {
  if (i === 30) for (const s of [D, E]) s.befehl({ art: 'nacht', spieler: 'ben' });
  D.schritt(); E.schritt(); D.ereignisse.length = 0; E.ereignisse.length = 0;
  if (i % 200 === 0 && D.pruefsumme() !== E.pruefsumme()) gleich = false;
}
pruefe(gleich && D.pruefsumme() === E.pruefsumme(), 'zwei Rechner bleiben in der Nacht gleich');
pruefe(D.gegner.length > 0 || D.besiegt > 0, `Wesen kommen (${D.gegner.length} unterwegs)`);
void RISSE;
if (fehler) { console.error(fehler + ' Fehler'); process.exit(1); }
