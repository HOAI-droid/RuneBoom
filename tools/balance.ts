/** Bot spielt eine Partie durch: baut, erfindet, rüstet um, verschmilzt, repariert. Ausgabe je Nacht. */
import { Spiel, B, GEBAEUDE, ERFINDUNGEN, type ErfId, type GebTyp } from '../packages/core/src/index.ts';

export function botPartie(code: string, maxNacht = 20, laut = true) {
  const s = new Spiel(code);
  const plaetze: [number, number][] = [];
  for (let r = 9; r <= 30; r += 6) for (let a = 0; a < 12; a++) { const w = Math.PI * 0.15 + (a / 12) * Math.PI * 0.7; plaetze.push([Math.round(B.x + Math.cos(w) * r) - 2, Math.round(B.z + 6 + Math.sin(w) * r) - 2]); }
  const reihenfolge: ErfId[] = ['sprengpulver', 'leuchtfeuer', 'runenpfeile', 'uhrwerk', 'stahlguss', 'schuppenpanzer', 'fangnetz', 'kristallspule', 'glutkern', 'sternenstaub'];
  const tag = () => {
    for (const r of [...s.ruinen]) s.wiederaufbauen(r);
    s.alleReparieren();
    for (const id of reihenfolge) if (!s.erfindungen.has(id) && (!ERFINDUNGEN[id].braucht || s.erfindungen.has(ERFINDUNGEN[id].braucht!))) s.erfinden(id);
    s.hauptAusbauen();
    // umrüsten: vorne zuerst
    for (const g of s.gebaeude) for (const t of s.umruestOptionen(g)) { const z = GEBAEUDE[t].zweige; s.umruesten(g, t, z ? z[g.id % 2].id : undefined); }
    // mehr Wirtschaft: zweiter Steinbruch und Holzfäller
    for (const [typ, zahl, x, z] of [['stein', s.nacht >= 2 ? 3 : 1, B.x + 24, B.z - 26], ['holz', s.nacht >= 3 ? 2 : 1, B.x - 28, B.z - 10]] as [GebTyp, number, number, number][])
      if (s.gebaeude.filter((g) => g.typ === typ).length < zahl) { const p = s.findePlatz(typ, x, z, 22); if (p) s.bauen(typ, p[0], p[1], true); }
    // Kristallmine, wenn noch keine
    if (!s.gebaeude.some((g) => g.typ === 'kristall')) { const p = s.findePlatz('kristall', B.x + 32, B.z - 20, 12); if (p) s.bauen('kristall', p[0], p[1], true); }
    // neue Türme, abwechselnd Fernkampf und Fläche, dazu Licht
    let n = 0;
    for (const [x, z] of plaetze) {
      const zahlF = s.gebaeude.filter((g) => ['feuertopf', 'kanone', 'blitzspule', 'glutmoerser'].includes(g.typ)).length, zahlW = s.gebaeude.filter((g) => GEBAEUDE[g.typ].kampf).length;
      const typ: GebTyp = s.freigeschaltet('feuertopf') && zahlF * 3 < zahlW ? 'feuertopf' : 'wachturm';
      if (s.bauen(typ, x, z, true)) { n++; s.bauen('fackel', x + 5, z + 1, true); }
      if (n >= 2) break;
    }
  };
  const log: string[] = [];
  let letzte = 0;
  for (let i = 0; i < 20 * 60 * 60 && s.phase !== 'verloren' && s.nacht <= maxNacht; i++) {
    const vor = s.phase;
    if (vor === 'tag' && s.zeit < 0.06) tag();
    s.schritt(); s.ereignisse.length = 0;
    if (vor === 'morgen' && s.phase === 'tag') {
      const tuerme = s.gebaeude.filter((g) => GEBAEUDE[g.typ].kampf && g.typ !== 'haupt');
      const z = `Nacht ${s.nacht - 1}: Zeitalter ${s.zeitalter()}, Haupt ${s.haupt?.stufe} (${Math.round(s.haupt!.hp)}/${s.haupt!.max}), Türme ${tuerme.length} [${[...new Set(tuerme.map((t) => t.typ))].join(',')}], Ruinen ${s.ruinen.length}, Res ${Math.round(s.res.holz)}/${Math.round(s.res.stein)}/${Math.round(s.res.kristall)}`;
      log.push(z); if (laut) console.log(z); letzte = s.nacht - 1;
    }
  }
  return { nacht: s.phase === 'verloren' ? s.nacht - 1 : letzte, zeitalter: s.zeitalter(), verloren: s.phase === 'verloren', log, s };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const t = Date.now(); const r = botPartie(process.argv[2] || 'NEBELKRAKE-4127', Number(process.argv[3] || 20));
  console.log(r.verloren ? `Gefallen nach Nacht ${r.nacht}` : `Überstanden bis Nacht ${r.nacht}`, `– Zeitalter ${r.zeitalter} – ${Date.now() - t} ms`);
}
