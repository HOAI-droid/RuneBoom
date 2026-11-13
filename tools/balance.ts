/** Bot spielt eine Partie durch: baut, erfindet, rüstet um, verschmilzt, repariert. Ausgabe je Nacht. */
import { Spiel, B, GEBAEUDE, ERFINDUNGEN, type ErfId, type GebTyp, type Schwierigkeit } from '../packages/core/src/index.ts';

export function botPartie(code: string, maxNacht = 20, laut = true, schwierigkeit: Schwierigkeit = 'normal') {
  const s = new Spiel(code, undefined, { schwierigkeit });
  const plaetze: [number, number][] = [];
  for (let r = 9; r <= 30; r += 6) for (let a = 0; a < 12; a++) { const w = Math.PI * 0.15 + (a / 12) * Math.PI * 0.7; plaetze.push([Math.round(B.x + Math.cos(w) * r) - 2, Math.round(B.z + 6 + Math.sin(w) * r) - 2]); }
  // Erfindungen nach Zeitalter, Schlüssel zuletzt im Zeitalter
  const reihenfolge = (Object.keys(ERFINDUNGEN) as ErfId[]).sort((a, b) => ERFINDUNGEN[a].ab - ERFINDUNGEN[b].ab || (ERFINDUNGEN[a].zeitalter ? 1 : 0) - (ERFINDUNGEN[b].zeitalter ? 1 : 0));
  const wichtig: ErfId[] = ['steinmetz', 'sprengpulver', 'runenpfeile', 'leuchtfeuer', 'festungsbau', 'uhrwerk', 'meisterbau', 'kristallspule'];
  const kampfZahl = () => s.gebaeude.filter((g) => GEBAEUDE[g.typ].kampf && g.typ !== 'haupt').length;
  const tuermeBauen = (max: number) => {
    let n = 0;
    // Plätze an den Wegen der offenen Risse, 12 bis 34 Blöcke vor der Burg
    const h = s.haupt!, hx = h.x + 6, hz = h.z + 6, kand: [number, number][] = [];
    for (const w of s.wegVorschau()) for (let i = 0; i < w.length; i += 4) { const [x, z] = w[i], d = Math.hypot(x - hx, z - hz); if (d > 12 && d < 48) for (const o of [-5, 5, -9, 9]) kand.push([Math.round(x + o) - 2, Math.round(z) - 2], [Math.round(x) - 2, Math.round(z + o) - 2]); }
    kand.sort((a, b) => Math.hypot(a[0] - hx, a[1] - hz) - Math.hypot(b[0] - hx, b[1] - hz));
    // abwechselnd die Wege bedienen: nach Winkel mischen
    for (const [x, z] of [...kand, ...plaetze]) {
      if (n >= max || kampfZahl() >= s.turmGrenze()) break;
      const zahlF = s.gebaeude.filter((g) => ['feuertopf', 'kanone', 'blitzspule', 'glutmoerser'].includes(g.typ)).length, zahlW = kampfZahl();
      const typ: GebTyp = s.freigeschaltet('feuertopf') && zahlF * 3 < zahlW ? 'feuertopf' : 'wachturm';
      if (s.bauen(typ, x, z, true)) { n++; s.bauen('fackel', x + 5, z + 1, true); }
    }
  };
  const tag = () => {
    for (const r of [...s.ruinen]) s.wiederaufbauen(r);
    s.alleReparieren();
    s.hauptAusbauen();
    for (const id of [...wichtig, ...reihenfolge]) if (!s.erfindungen.has(id) && s.zeitalter() >= ERFINDUNGEN[id].ab && (!ERFINDUNGEN[id].braucht || s.erfindungen.has(ERFINDUNGEN[id].braucht!))) s.erfinden(id);
    // Türme zuerst, solange es wenige sind
    if (kampfZahl() < 3 + s.nacht) tuermeBauen(3);
    // Bevölkerung: Nahrung und Wohnraum
    if (s.res.nahrung < s.essen() * 2 || s.gebaeude.filter((g) => g.typ === 'hof').length * 9 < s.einwohner) { const p = s.findePlatz('hof', B.x - 20, B.z - 30, 26); if (p) s.bauen('hof', p[0], p[1], true); }
    if (s.wohnraum() - s.einwohner < 3) { const p = s.findePlatz('haus', B.x + 4, B.z - 30, 24); if (p) s.bauen('haus', p[0], p[1], true); }
    s.hauptAusbauen();
    for (const g of s.gebaeude) for (const t of s.umruestOptionen(g)) { const z = GEBAEUDE[t].zweige; s.umruesten(g, t, z ? z[g.id % 2].id : undefined); }
    for (const g of s.gebaeude) { const o = s.stufeOption(g); if (o && !o.grund && (GEBAEUDE[g.typ].kampf || g.typ === 'stein' || g.typ === 'hof' || g.typ === 'holz')) s.stufeAusbauen(g); }
    // mehr Wirtschaft, wenn Leute frei sind
    if (s.leerlauf() >= 2) for (const [typ, zahl, x, z] of [['holz', 3, B.x - 28, B.z - 10], ['stein', 3, B.x + 24, B.z - 26]] as [GebTyp, number, number, number][])
      if (s.gebaeude.filter((g) => g.typ === typ).length < zahl) { const p = s.findePlatz(typ, x, z, 22); if (p) { s.bauen(typ, p[0], p[1], true); break; } }
    if (!s.gebaeude.some((g) => g.typ === 'kristall') && s.leerlauf() >= 2) { const p = s.findePlatz('kristall', B.x + 32, B.z - 20, 12); if (p) s.bauen('kristall', p[0], p[1], true); }
    tuermeBauen(3);
  };
  const log: string[] = [];
  let letzte = 0;
  for (let i = 0; i < 20 * 60 * 60 && s.phase !== 'verloren' && s.nacht <= maxNacht; i++) {
    const vor = s.phase;
    if (vor === 'tag' && s.zeit < 0.06) tag();
    s.schritt(); s.ereignisse.length = 0;
    if (vor === 'morgen' && s.phase === 'tag') {
      const tuerme = s.gebaeude.filter((g) => GEBAEUDE[g.typ].kampf && g.typ !== 'haupt');
      const z = `Nacht ${s.nacht - 1}: Z${s.zeitalter()}, Burg ${s.haupt?.stufe}, Einw. ${s.einwohner}/${s.wohnraum()} Nahr. ${Math.round(s.res.nahrung)}, Haupt (${Math.round(s.haupt!.hp)}/${s.haupt!.max}), Türme ${tuerme.length}/${s.turmGrenze()} [${[...new Set(tuerme.map((t) => t.typ))].join(',')}], Ruinen ${s.ruinen.length}, Res ${Math.round(s.res.holz)}/${Math.round(s.res.stein)}/${Math.round(s.res.kristall)}`;
      log.push(z); if (laut) console.log(z); letzte = s.nacht - 1;
    }
  }
  return { nacht: s.phase === 'verloren' ? s.nacht - 1 : letzte, zeitalter: s.zeitalter(), verloren: s.phase === 'verloren', log, s };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const t = Date.now(); const r = botPartie(process.argv[2] || 'NEBELKRAKE-4127', Number(process.argv[3] || 20));
  console.log(r.verloren ? `Gefallen nach Nacht ${r.nacht}` : `Überstanden bis Nacht ${r.nacht}`, `– Zeitalter ${r.zeitalter} – ${Date.now() - t} ms`);
}
