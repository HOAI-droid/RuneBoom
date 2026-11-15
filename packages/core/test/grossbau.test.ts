import { Spiel, B, GEBAEUDE, GROSSBAU_ZWEITER, type GebTyp } from '../src/index.ts';
let fehler = 0;
const pruefe = (ok: boolean, text: string) => { if (!ok) { fehler++; console.error('FEHLER:', text); } else console.log('ok –', text); };
const S = new Spiel('NEBELKRAKE-4127', undefined, { volk: 'glutborn' });
S.res.holz = S.res.stein = 99999; S.res.kristall = 99999; S.res.stahl = 999; S.res.balken = 999; S.res.linsen = 999;
for (const e of ['sprengpulver', 'uhrwerk', 'kristallspule'] as const) S.erfindungen.add(e);
const platz = (typ: GebTyp, r0: number) => { for (let r = r0; r < r0 + 40; r += 2) for (let a = 0; a < 6.28; a += 0.3) { const x = Math.round(B.x + Math.cos(a) * r), z = Math.round(B.z + 6 + Math.sin(a) * r); if (S.pruefe(typ, x, z).ok) return [x, z]; } return null; };
pruefe(!S.pruefe('samenschleuder', 0, 0).ok, 'Bauten anderer Völker sind gesperrt');
const p1 = platz('lavaschleuder', 16)!; pruefe(S.bauen('lavaschleuder', p1[0], p1[1]), 'erste Lavaschleuder gebaut');
const k1 = GEBAEUDE.lavaschleuder.kosten.stein!, k2 = S.kostenFuer('lavaschleuder').stein!;
pruefe(k2 === Math.ceil(k1 * 1.5), `zweite kostet das 1,5-Fache (${k1} → ${k2})`);
const alt = S.haupt!.stufe; S.haupt!.stufe = 6; const p2 = platz('lavaschleuder', 18)!; S.haupt!.stufe = alt; pruefe(!S.pruefe('lavaschleuder', p2[0], p2[1]).ok, 'zweite erst ab höherer Burgstufe');
S.haupt!.stufe = GROSSBAU_ZWEITER; pruefe(S.bauen('lavaschleuder', p2[0], p2[1]), 'zweite mit Burgstufe ' + GROSSBAU_ZWEITER);
const p3 = platz('lavaschleuder', 20); pruefe(!p3 || !S.pruefe('lavaschleuder', p3[0], p3[1]).ok, 'keine dritte');
pruefe(S.turmZahl() === 1, 'Großbauten zählen nicht zur Turmgrenze');
// Stufe III und Fähigkeit in der Nacht
const lav = S.gebaeude.filter((g) => g.typ === 'lavaschleuder');
for (const g of lav) { g.umbau = undefined; g.stufe = 3; }
const ps = platz('schlackengrund', 14)!; S.bauen('schlackengrund', ps[0], ps[1]); const sg = S.gebaeude.at(-1)!; sg.umbau = undefined; sg.stufe = 3;
S.befehl({ art: 'nacht' });
for (let i = 0; i < 20 * 30; i++) { S.schritt(); S.ereignisse.length = 0; }
const gf = S.grossFaehigkeiten();
pruefe(gf.length === 3 && gf.every((x) => x.frei === 2), `drei Fähigkeiten bereit, je zweimal (${gf.map((x) => x.name).join(', ')})`);
const ziel = S.gegner.find((e) => !e.tot && !e.flug);
if (ziel) { const g = lav[0]; ziel.x = g.x + 12; ziel.z = g.z + 2; }
const ok1 = S.befehl({ art: 'faehigkeit', name: `gb:${lav[0].id}` }), ok2 = S.befehl({ art: 'faehigkeit', name: `gb:${lav[0].id}` }), ok3 = S.befehl({ art: 'faehigkeit', name: `gb:${lav[0].id}` });
pruefe(ok1 && ok2 && !ok3, 'Fähigkeit zweimal je Nacht, nicht dreimal');
// Wirkkreis brennt Wesen darin
const w = S.gegner.find((e) => !e.tot && !e.flug);
if (w) { w.x = sg.x + 2.5; w.z = sg.z + 2.5; const hp = w.hp; for (let i = 0; i < 20; i++) S.schritt(); pruefe(w.hp < hp || w.tot, 'Schlackengrund verletzt Wesen im Kreis'); }
// ganze Nacht ohne Fehler
for (let i = 0; i < 20 * 120; i++) S.schritt();
pruefe(true, 'Nacht mit Großbauten läuft durch');
// Sturmweber: nass + Glocke betäubt
const T = new Spiel('NEBELKRAKE-4127', undefined, { volk: 'sturmweber' });
T.res.holz = T.res.stein = T.res.kristall = 99999; T.res.stahl = T.res.linsen = T.res.balken = 999; for (const e of ['sprengpulver', 'uhrwerk', 'kristallspule'] as const) T.erfindungen.add(e);
let q: number[] | null = null; for (let r = 16; r < 50 && !q; r += 2) for (let a = 0; a < 6.28 && !q; a += 0.3) { const x = Math.round(B.x + Math.cos(a) * r), z = Math.round(B.z + 6 + Math.sin(a) * r); if (T.pruefe('donnerglocke', x, z).ok) q = [x, z]; }
T.bauen('donnerglocke', q![0], q![1]); const dg = T.gebaeude.at(-1)!; dg.umbau = undefined;
T.befehl({ art: 'nacht' }); for (let i = 0; i < 20 * 30; i++) T.schritt();
const opfer = T.gegner.find((e) => !e.tot); if (opfer) { opfer.x = dg.x + 3; opfer.z = dg.z + 3; dg.cd = 0; T.schritt(); pruefe((opfer.starr || 0) > 0 || opfer.tot, 'Donnerglocke betäubt'); }
if (fehler) { console.error(fehler + ' Fehler'); process.exit(1); }
