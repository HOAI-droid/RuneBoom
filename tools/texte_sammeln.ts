/** Sammelt alle deutschen Texte (Schlüssel der Übersetzungen): aus Spielwerten, t('…')-Aufrufen und index.html. */
import { readFileSync } from 'node:fs';
import * as D from '../packages/core/src/daten.ts';
import { RISSE } from '../packages/core/src/welt.ts';
import { SEITEN_NAME } from '../packages/core/src/spiel.ts';
export function alleTexte(): string[] {
  const k = new Set<string>();
  const add = (s?: string) => { if (s && /[A-Za-zÄÖÜäöüß]{2}/.test(s)) k.add(s); };
  for (const g of Object.values(D.GEBAEUDE)) { add(g.name); add(g.kurz); for (const z of g.zweige || []) { add(z.name); add(z.kurz); } }
  for (const e of Object.values(D.ERFINDUNGEN)) { add(e.name); add(e.wirkung); }
  for (const g of Object.values(D.GEGNER)) { add(g.name); add(g.kurz); }
  for (const v of Object.values(D.RES_NAMEN)) add(v);
  for (const v of Object.values(D.BAUSTEIN_NAME)) add(v);
  for (const v of Object.values(D.ZEITALTER_NAME)) add(v);
  for (const v of Object.values(D.WISSEN_NAME)) add(v);
  for (const v of Object.values(D.VOELKER)) { add(v.name); add(v.stoff); add(v.kurz); v.staerken.forEach(add); }
  for (const l of Object.values(D.LEITSAETZE)) for (const x of l) { add(x.name); add(x.kurz); }
  for (const o of Object.values(D.OMEN)) { add(o.name); add(o.kurz); }
  for (const a of D.AKTE) { add(a.name); add(a.text); }
  for (const h of D.HAUPT_STUFEN) { add(h.name); add(h.kurz); }
  for (const v of Object.values(D.FAEHIGKEIT_NAME)) add(v);
  for (const v of Object.values(D.SCHWIERIGKEIT)) add(v.name);
  for (const g of D.BAUGRUPPEN) add(g.name);
  for (const r of RISSE) add(r.name);
  for (const v of Object.values(SEITEN_NAME)) add(v);
  const re = /\b(?:t|tr)\('((?:\\'|[^'])*)'/g;
  for (const f of ['apps/web/src/main.ts', 'apps/web/src/mehrspieler.ts', 'packages/core/src/spiel.ts']) for (const m of readFileSync(f, 'utf8').matchAll(re)) add(m[1].replace(/\\'/g, "'"));
  // statische Texte aus index.html (nur der Körper, ohne Stil)
  const html = readFileSync('apps/web/index.html', 'utf8').split('<body>')[1].split('<script')[0];
  for (const m of html.matchAll(/>([^<>]+)</g)) { const s = m[1].replace(/\s+/g, ' ').trim(); if (s && /[A-Za-zÄÖÜäöüß]{3}/.test(s)) add(s); }
  for (const m of html.matchAll(/(?:title|aria-label)="([^"]+)"/g)) add(m[1]);
  return [...k].filter((s) => !/^[A-Z]{3,}-\d+$/.test(s));
}
if (import.meta.url === `file://${process.argv[1]}`) { const l = alleTexte(); console.log(JSON.stringify(l, null, 0)); console.error(l.length, 'Texte'); }
