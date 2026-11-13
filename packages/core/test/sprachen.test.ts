import { alleTexte } from '../../../tools/texte_sammeln.ts';
import { EN } from '../../../apps/web/src/sprachen/en.ts';
import { FR } from '../../../apps/web/src/sprachen/fr.ts';
import { ES } from '../../../apps/web/src/sprachen/es.ts';
import { registriereSprache, setzeSprache, t, systemSprache } from '../src/sprache.ts';
let fehler = 0;
const pruefe = (ok: boolean, text: string) => { if (!ok) { fehler++; console.error('FEHLER:', text); } else console.log('ok –', text); };
const texte = alleTexte();
for (const [name, tab] of [['Englisch', EN], ['Französisch', FR], ['Spanisch', ES]] as const) {
  const fehlt = texte.filter((k) => !(k in tab));
  pruefe(fehlt.length === 0, `${name}: alle ${texte.length} Texte übersetzt${fehlt.length ? ` (fehlen: ${fehlt.slice(0, 5).map((s) => JSON.stringify(s)).join(', ')} …)` : ''}`);
}
registriereSprache('en', EN); setzeSprache('en');
pruefe(t('Tag {a}', { a: 3 }) === 'Day 3', 'Platzhalter werden ersetzt');
setzeSprache('de');
pruefe(systemSprache(['fr-FR']) === 'fr' && systemSprache(['ja']) === 'en' && systemSprache(['de-AT']) === 'de', 'Systemsprache wird erkannt');
if (fehler) process.exit(1);
