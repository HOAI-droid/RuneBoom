import { setzeSeed, spalte, deko, orte, B, RISS, seedAusCode, neuerWeltcode, rng } from '../src/index.ts';
let fehler = 0;
const pruefe = (ok: boolean, text: string) => { if (!ok) { fehler++; console.error('FEHLER:', text); } else console.log('ok –', text); };

setzeSeed(seedAusCode('NEBELKRAKE-4127'));
const a = JSON.stringify([spalte(10, 20), spalte(-200, 133), deko(37, -80), orte().length]);
setzeSeed(seedAusCode('FROSTWOLF-1000'));
const b = JSON.stringify([spalte(10, 20), spalte(-200, 133), deko(37, -80), orte().length]);
setzeSeed(seedAusCode('nebelkrake 4127'));
const c = JSON.stringify([spalte(10, 20), spalte(-200, 133), deko(37, -80), orte().length]);
pruefe(a === c, 'gleicher Weltcode ergibt gleiche Welt (auch klein geschrieben)');
pruefe(a !== b, 'anderer Weltcode ergibt andere Welt');
pruefe(!!spalte(B.x, B.z) && spalte(B.x, B.z)!.h === 6, 'Feste steht auf ebenem Grund');
pruefe(!!spalte(RISS.x, RISS.z), 'Riss liegt auf Land');
pruefe(spalte(600, 600) === null, 'außerhalb der Welt ist nichts');
pruefe(/^[A-ZÄÖÜ]+-\d{4}$/.test(neuerWeltcode(rng(3))), 'Weltcode ist lesbar');
if (fehler) process.exit(1);
