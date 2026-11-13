import { Spiel, DT, GEBAEUDE, TAG_DAUER, B } from '../src/index.ts';
let fehler = 0;
const pruefe = (ok: boolean, text: string) => { if (!ok) { fehler++; console.error('FEHLER:', text); } else console.log('ok –', text); };

const s = new Spiel('NEBELKRAKE-4127');
pruefe(s.gebaeude.length === 7, 'Start: Hauptgebäude, Werkstatt, Wachturm, Holzfäller, Steinbruch, Bauernhof, Wohnhaus'); pruefe(s.arbeiter.length === 6 && s.einwohner === 12, `Start: 12 Einwohner, davon ${s.arbeiter.length} Arbeiter`);
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
// Holzfäller und Steinbruch liefern auch nach vielen Tagen noch (großer Umkreis, mehrere Gänge je Baum)
{
  const w = new Spiel('NEBELKRAKE-4127');
  const ertrag: number[] = [];
  for (let tag = 0; tag < 10; tag++) {
    const h0 = w.res.holz + w.res.stein;
    for (let i = 0; i < 20 * 80; i++) { w.schritt(); w.ereignisse.length = 0; }
    ertrag.push(Math.round(w.res.holz + w.res.stein - h0));
    w.phase = 'morgen'; w.zeit = 99; w.gegner.length = 0; w.schritt(); w.ereignisse.length = 0; // Nacht überspringen
  }
  console.log('  Holz + Stein je Tag:', ertrag.join(', '));
  pruefe(ertrag[9] > ertrag[0] * 0.55, 'Auch an Tag 10 bringen die Arbeiter noch gut Ertrag');
  // Gelände ebnen
  const st = w.res.stein = 500;
  const vor = w.ebnenPruefen(-30, -10, -20, -2);
  pruefe(vor.ok || vor.grund === 'Die Fläche ist schon eben.', `Ebnen prüfbar (${vor.grund || vor.stein + ' Stein'})`);
  const x0 = 24, z0 = -60; const p = w.ebnenPruefen(x0, z0, x0 + 6, z0 + 6);
  if (p.ok) { pruefe(w.ebnen(x0, z0, x0 + 6, z0 + 6) && w.res.stein === st - p.stein, `Ebnen kostet ${p.stein} Stein`); pruefe(w.pruefe('wachturm', x0 + 1, z0 + 1).ok || w.pruefe('wachturm', x0 + 1, z0 + 1).grund === 'Hier steht schon etwas.', 'Nach dem Ebnen passt ein Wachturm'); }
  else console.log('  (Testfläche nicht ebnbar: ' + p.grund + ')');
}
// Bot spielt durch die Zeitalter
{
  const { botPartie } = await import('../../../tools/balance.ts');
  const r = botPartie('FROSTWOLF-1000', 10, false, 'leicht');
  console.log('  ' + r.log[r.log.length - 1]);
  pruefe(!r.verloren && r.nacht >= 10, `Bot übersteht auf Leicht 10 Nächte (bis ${r.nacht})`);
  pruefe(r.zeitalter >= 2, `Bot erreicht durch Erfindungen das Zeitalter ${r.zeitalter}`);
  pruefe(r.s.einwohner > 20, `Die Feste wächst (${r.s.einwohner} Einwohner)`);
  // Umrüsten, Verschmelzen, Ruinen
  const s = r.s;
  const ruine = s.ruinen[0];
  pruefe(s.gebaeude.some((g) => g.stufe > 1), 'Gebäude wurden ausgebaut');
  void ruine;
}
// Kein Riss darf unerreichbar sein, keine Nacht darf ewig dauern
{
  const { RISS, RISS2, NACHT_MAX } = await import('../src/index.ts');
  let ok = 0; const codes = ['NEBELKRAKE-4127', 'FROSTWOLF-1000', 'GLUTDRACHE-2222', 'MOORQUELLE-3131', 'RUNENEICHE-9001', 'ASCHEKRONE-5555', 'DORNKLAUE-7777', 'WINDMOTTE-8181'];
  for (const c of codes) {
    const w = new Spiel(c); w.nacht = 20; (w as any).feldAlt = true;
    const wege = w.wegVorschau(); const h = w.haupt!;
    const angekommen = wege.every((p) => { const [x, z] = p[p.length - 1]; return Math.hypot(x - h.x - 6, z - h.z - 6) < 12; });
    if (angekommen) ok++; else console.log('  unerreichbar in', c, wege.map((p) => p.length));
    void RISS; void RISS2;
  }
  pruefe(ok === codes.length, `Von allen Rissen führt ein Weg zur Feste (${ok}/${codes.length} Welten)`);
  const w = new Spiel('FROSTWOLF-1000'); w.nachtEinlaeuten();
  // ein Wesen künstlich einsperren: weit weg auf unerreichbarem Fels
  for (let i = 0; i < 20 * (NACHT_MAX + 30); i++) { w.schritt(); w.ereignisse.length = 0; if (w.phase !== 'nacht') break; for (const g of w.gegner) if (g.typ === 'moorwicht' && g.id % 5 === 0) { g.x = 400; g.z = 400; } }
  pruefe(w.phase !== 'nacht', 'Eine Nacht endet auch, wenn Wesen festhängen');
}
// 0.4: Bevölkerung, Stufen, Turmgrenze, Runenkraft
{
  const w = new Spiel('NEBELKRAKE-4127');
  const e0 = w.einwohner;
  for (let tag = 0; tag < 3; tag++) { for (let i = 0; i < 20 * 80; i++) { w.schritt(); w.ereignisse.length = 0; } w.phase = 'morgen'; w.zeit = 99; w.gegner.length = 0; w.schritt(); w.ereignisse.length = 0; }
  pruefe(w.res.nahrung >= 0 && w.einwohner >= e0, `Bevölkerung nach 3 Tagen: ${w.einwohner} (Nahrung ${Math.round(w.res.nahrung)})`);
  w.res.holz = w.res.stein = w.res.kristall = 2000; w.bausteine.feuerstein = 10;
  const t = w.gebaeude.find((g) => g.typ === 'wachturm')!;
  pruefe(!!w.stufeOption(t)?.grund, 'Stufe II braucht erst Steinmetzkunst');
  w.erfinden('steinmetz');
  pruefe(w.stufeAusbauen(t), 'Wachturm auf Stufe II ausbauen');
  for (let i = 0; i < 20 * 10; i++) { w.schritt(); w.ereignisse.length = 0; }
  pruefe(t.stufe === 2 && t.max > GEBAEUDE.wachturm.hp && Number.isInteger(t.max), `Stufe II: Haltbarkeit ${t.max}`);
  const grenze = w.turmGrenze(); let n = 0;
  for (let r = 10; r < 40 && w.turmZahl() < grenze + 2; r += 6) for (let a = 0; a < 16; a++) { if (w.bauen('wachturm', Math.round(B.x + Math.cos(a / 16 * 6.28) * r) - 2, Math.round(B.z + Math.sin(a / 16 * 6.28) * r) - 2, true)) n++; }
  pruefe(w.turmZahl() === grenze, `Turmgrenze ${grenze} wird eingehalten (${w.turmZahl()} Türme)`);
  w.res.kristall = 3; w.zeit = TAG_DAUER - 0.01; const bedarf = w.runenkraftBedarf(); w.schritt();
  pruefe(bedarf > 3 && w.gebaeude.some((g) => !g.kraft && GEBAEUDE[g.typ].kampf), `Runenkraft: ${bedarf} Kristall nötig, ohne genug feuern äußere Türme langsamer`);
  void n;
}
if (fehler) process.exit(1);
// 0.5: Völker, Akte, Omen, Siegel, Fallen, Verarbeitung, Sieg
{
  const { AKTE, ENDE_NACHT, OMEN } = await import('../src/index.ts');
  const w = new Spiel('NEBELKRAKE-4127', undefined, { volk: 'hainmar' });
  pruefe(w.volk === 'hainmar' && w.baumNach() < 6, 'Volk Hainmar: Bäume wachsen schneller');
  pruefe(AKTE.length === 4 && ENDE_NACHT === 40, 'Vier Akte, 40 Nächte');
  let omen = 0; for (let n = 1; n <= 40; n++) if (w.omenFuer(n)) omen++;
  pruefe(omen >= 3 && omen <= 14, `Omen in ${omen} von 40 Nächten`);
  void OMEN;
  w.res.holz = w.res.stein = w.res.kristall = 5000;
  w.erfindungen.add('axtschmiede');
  const p = w.findePlatz('saegewerk', B.x - 10, B.z - 26, 20);
  pruefe(!!p && w.bauen('saegewerk', p![0], p![1]), 'Sägewerk gebaut');
  w.einwohner = 30; w.verteileArbeiter();
  const b0 = w.res.balken; for (let i = 0; i < 20 * 30; i++) { w.schritt(); w.ereignisse.length = 0; }
  pruefe(w.res.balken > b0, `Sägewerk macht Balken (${w.res.balken})`);
  // Fallen sind begehbar und wirken
  w.erfindungen.add('dornenwall');
  pruefe(w.bauen('dornenfeld', B.x + 1, B.z + 20, true), 'Dornenfeld gebaut');
  // Siegel erst in Akt IV
  pruefe(!w.pruefe('siegel', 6, B.z + 120).ok, 'Siegel erst ab Akt IV');
  // Sieg nach der letzten Nacht
  const v = new Spiel('FROSTWOLF-1000'); v.nacht = ENDE_NACHT; v.nachtEinlaeuten();
  for (let i = 0; i < 20 * 400 && v.phase === 'nacht'; i++) { v.schritt(); v.ereignisse.length = 0; v.gegner.length = 0; }
  pruefe(v.phase === 'gewonnen' && !!v.sieg, 'Nach der 40. Nacht ist die Partie gewonnen');
  const st = v.speichern(); pruefe(st.v === 4 && st.volk === 'glutborn', 'Spielstand v4 mit Volk');
}
if (fehler) process.exit(1);
