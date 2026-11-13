/** Spielwerte: Gebäude, Wesen, Erfindungen, Zeitalter, Wellen. Alles an einem Ort, damit sich das Gleichgewicht leicht einstellen lässt. */
export type Res = 'holz' | 'stein' | 'kristall';
export type Baustein = 'feuerstein' | 'windrune' | 'eisenerz' | 'drachenschuppe';
export type Kosten = Partial<Record<Res, number>>;
export type GebTyp =
  | 'haupt' | 'werkstatt' | 'mauer' | 'holz' | 'stein' | 'kristall'
  // Fernkampf-Linie
  | 'wachturm' | 'schuetzenturm' | 'repetierer' | 'laser'
  // Flächen-Linie
  | 'feuertopf' | 'kanone' | 'blitzspule'
  // Licht-Linie
  | 'fackel' | 'leuchtfeuer' | 'scheinwerfer' | 'kristallfeuer'
  // Verschmelzungen
  | 'brandturm' | 'leuchtpfeil' | 'doppelturm' | 'glutmoerser';
export type ErfId = 'sprengpulver' | 'leuchtfeuer' | 'runenpfeile' | 'stahlguss' | 'uhrwerk' | 'schuppenpanzer' | 'fangnetz' | 'kristallspule' | 'glutkern' | 'sternenstaub';
export type Zeitalter = 1 | 2 | 3 | 4;
export const ZEITALTER_NAME: Record<Zeitalter, string> = { 1: 'Holz & Runen', 2: 'Glut & Alchemie', 3: 'Uhrwerk & Dampf', 4: 'Blitz & Kristall' };

export interface Kampf {
  reichweite: number; schaden: number; abklingen: number; geschoss: 'pfeil' | 'topf' | 'strahl' | 'blitz' | 'aura';
  flaeche?: number; nurBoden?: boolean;
  /** mehrere Ziele zugleich */ ziele?: number;
  /** Blitz springt auf so viele weitere Ziele */ kette?: number;
  /** durchschlägt Kristallpanzer */ panzerbrechend?: boolean;
  /** setzt in Brand: Schaden je Sekunde für 3 s */ brand?: number;
  /** Granaten je Schuss (Streuung) */ salve?: number;
}
export interface Zweig { id: string; name: string; kurz: string; kampf?: Partial<Kampf>; licht?: number }
export interface GebDef {
  name: string; kurz: string; w: number; d: number; hp: number; kosten: Kosten;
  licht: number; sicht: number; braucht?: ErfId; baubar: boolean; taste?: string;
  kampf?: Kampf;
  /** Zeitalter des Gebäudes und woraus es umgerüstet wird */
  zeitalter?: Zeitalter; von?: GebTyp; zweige?: [Zweig, Zweig];
  /** Licht enthüllt Verborgenes · Lichtkegel (halber Öffnungswinkel, rad) */
  enthuellt?: boolean; kegel?: number;
  fusion?: boolean;
  arbeit?: { res: Res; menge: number; dauer: number; radius: number; arbeiter: number };
  reparatur?: Kosten;
}
const P = (r: number, s: number, a: number): Kampf => ({ reichweite: r, schaden: s, abklingen: a, geschoss: 'pfeil' });
export const GEBAEUDE: Record<GebTyp, GebDef> = {
  haupt: { reparatur: { holz: 160, stein: 160 }, name: 'Hauptgebäude', kurz: 'Das Herz der Feste. Wehrt sich schwach selbst und lässt sich ausbauen. Fällt es, ist die Partie verloren.', w: 12, d: 12, hp: 1500, kosten: {}, licht: 15, sicht: 60, baubar: false, kampf: P(11, 6, 1.1) },
  werkstatt: { reparatur: { holz: 60, stein: 40 }, name: 'Erfinderwerkstatt', kurz: 'Hier entstehen aus Bausteinen Erfindungen. Schlüsselerfindungen öffnen neue Zeitalter.', w: 7, d: 6, hp: 400, kosten: {}, licht: 7, sicht: 12, baubar: false },
  mauer: { name: 'Mauer', kurz: 'Hält Bodenwesen auf. Ziehen zum Bauen einer Reihe.', w: 1, d: 1, hp: 160, kosten: { stein: 3 }, licht: 0, sicht: 0, baubar: true, taste: '5' },
  holz: { name: 'Holzfäller', kurz: 'Zwei Arbeiter holen am Tag Holz aus dem Umkreis. Ein Baum reicht für drei Gänge, dann wird er gefällt und wächst nach einigen Tagen nach.', w: 5, d: 6, hp: 200, kosten: { holz: 20 }, licht: 3, sicht: 12, baubar: true, taste: '6', arbeit: { res: 'holz', menge: 7, dauer: 3.5, radius: 32, arbeiter: 2 } },
  stein: { name: 'Steinbruch', kurz: 'Zwei Arbeiter brechen am Tag Felsen im Umkreis ab, jeder Felsen reicht für vier Gänge. Felswände und Berge geben unbegrenzt Stein.', w: 4, d: 4, hp: 200, kosten: { holz: 30 }, licht: 3, sicht: 12, baubar: true, taste: '7', arbeit: { res: 'stein', menge: 5, dauer: 4, radius: 32, arbeiter: 2 } },
  kristall: { name: 'Kristallmine', kurz: 'Zwei Arbeiter schlagen am Tag Kristall ab. Nur an einem Kristallfeld.', w: 4, d: 4, hp: 200, kosten: { holz: 40, stein: 30 }, licht: 4, sicht: 12, baubar: true, taste: '8', arbeit: { res: 'kristall', menge: 2, dauer: 4.5, radius: 32, arbeiter: 2 } },

  // ---- Fernkampf: Wachturm → Schützenturm → Repetierer → Kristall-Laser ----
  wachturm: { zeitalter: 1, name: 'Wachturm', kurz: 'Holz & Runen. Schießt Pfeile auf Boden und Luft.', w: 5, d: 5, hp: 320, kosten: { holz: 40, stein: 10 }, licht: 4, sicht: 18, baubar: true, taste: '1', kampf: P(13, 10, 0.9) },
  schuetzenturm: { zeitalter: 2, von: 'wachturm', braucht: 'sprengpulver', name: 'Schützenturm', kurz: 'Glut & Alchemie. Steinsockel, mehr Schützen.', w: 5, d: 5, hp: 460, kosten: { holz: 40, stein: 35, kristall: 15 }, licht: 5, sicht: 20, baubar: false, kampf: P(15, 13, 0.8),
    zweige: [{ id: 'weit', name: 'Langbogen', kurz: 'Größere Reichweite.', kampf: { reichweite: 19 } }, { id: 'salve', name: 'Salve', kurz: 'Zwei Ziele zugleich.', kampf: { ziele: 2 } }] },
  repetierer: { zeitalter: 3, von: 'schuetzenturm', braucht: 'uhrwerk', name: 'Bolzen-Repetierer', kurz: 'Uhrwerk & Dampf. Ein Uhrwerk spannt Bolzen in schneller Folge.', w: 5, d: 5, hp: 620, kosten: { holz: 40, stein: 60, kristall: 40 }, licht: 5, sicht: 22, baubar: false, kampf: { ...P(16, 11, 0.38), panzerbrechend: false },
    zweige: [{ id: 'schnell', name: 'Schnellfeuer', kurz: 'Noch schneller.', kampf: { abklingen: 0.26 } }, { id: 'durchschlag', name: 'Durchschlag', kurz: 'Schwere Bolzen durchschlagen Kristallpanzer.', kampf: { schaden: 26, abklingen: 0.7, panzerbrechend: true } }] },
  laser: { zeitalter: 4, von: 'repetierer', braucht: 'kristallspule', name: 'Kristall-Laser', kurz: 'Blitz & Kristall. Ein gebündelter Strahl, der dauerhaft brennt und Panzer schmilzt.', w: 5, d: 5, hp: 800, kosten: { stein: 80, kristall: 120 }, licht: 6, sicht: 24, baubar: false,
    kampf: { reichweite: 18, schaden: 42, abklingen: 0, geschoss: 'strahl', panzerbrechend: true },
    zweige: [{ id: 'strahl', name: 'Brennstrahl', kurz: 'Ein starker Strahl.', kampf: { schaden: 60 } }, { id: 'prisma', name: 'Prisma', kurz: 'Drei Strahlen auf drei Ziele.', kampf: { ziele: 3, schaden: 24 } }] },
  // ---- Fläche: Feuertopf → Kanonenturm → Blitzspule ----
  feuertopf: { zeitalter: 2, braucht: 'sprengpulver', name: 'Feuertopf-Schleuder', kurz: 'Glut & Alchemie. Wirft Feuertöpfe mit Flächenschaden, nur auf Bodenziele.', w: 5, d: 5, hp: 360, kosten: { holz: 60, stein: 40, kristall: 10 }, licht: 5, sicht: 18, baubar: true, taste: '2',
    kampf: { reichweite: 17, schaden: 30, abklingen: 2.6, flaeche: 2.8, nurBoden: true, geschoss: 'topf' } },
  kanone: { zeitalter: 3, von: 'feuertopf', braucht: 'uhrwerk', name: 'Kanonenturm', kurz: 'Uhrwerk & Dampf. Schwere Kugeln mit großem Einschlag.', w: 5, d: 5, hp: 700, kosten: { holz: 40, stein: 70, kristall: 40 }, licht: 5, sicht: 22, baubar: false,
    kampf: { reichweite: 21, schaden: 55, abklingen: 3, flaeche: 3.6, nurBoden: true, geschoss: 'topf', panzerbrechend: true },
    zweige: [{ id: 'schwer', name: 'Mörser', kurz: 'Noch größerer Einschlag.', kampf: { schaden: 75, flaeche: 4.4 } }, { id: 'streu', name: 'Streufeuer', kurz: 'Drei Kugeln auf einmal.', kampf: { salve: 3, schaden: 30 } }] },
  blitzspule: { zeitalter: 4, von: 'kanone', braucht: 'kristallspule', name: 'Blitzspule', kurz: 'Blitz & Kristall. Blitze springen von Wesen zu Wesen, auch auf Flieger.', w: 5, d: 5, hp: 820, kosten: { stein: 80, kristall: 130 }, licht: 7, sicht: 24, baubar: false,
    kampf: { reichweite: 17, schaden: 40, abklingen: 1.5, geschoss: 'blitz', kette: 4, panzerbrechend: true },
    zweige: [{ id: 'kette', name: 'Kettenblitz', kurz: 'Springt auf sieben Ziele.', kampf: { kette: 7 } }, { id: 'sturm', name: 'Sturmkrone', kurz: 'Trifft alles im Umkreis, laufend.', kampf: { geschoss: 'aura', reichweite: 11, schaden: 22, abklingen: 0 } }] },
  // ---- Licht: Fackelmast → Leuchtfeuer → Spiegel-Scheinwerfer → Kristall-Leuchtfeuer ----
  fackel: { zeitalter: 1, name: 'Fackelmast', kurz: 'Kleiner Lichtkreis. Im Licht treffen Türme nachts besser und weiter.', w: 2, d: 2, hp: 80, kosten: { holz: 15 }, licht: 10, sicht: 10, baubar: true, taste: '3' },
  leuchtfeuer: { zeitalter: 2, von: 'fackel', braucht: 'leuchtfeuer', name: 'Leuchtfeuer', kurz: 'Großer Lichtkreis, macht Schattenwölfe sichtbar.', w: 2, d: 2, hp: 240, kosten: { holz: 30, stein: 30, kristall: 10 }, licht: 18, sicht: 22, enthuellt: true, baubar: false },
  scheinwerfer: { zeitalter: 3, von: 'leuchtfeuer', braucht: 'uhrwerk', name: 'Spiegel-Scheinwerfer', kurz: 'Ein drehender Lichtkegel mit weiter Reichweite, folgt den Wesen.', w: 2, d: 2, hp: 360, kosten: { stein: 60, kristall: 40 }, licht: 12, kegel: 0.38, sicht: 34, enthuellt: true, baubar: false },
  kristallfeuer: { zeitalter: 4, von: 'scheinwerfer', braucht: 'kristallspule', name: 'Kristall-Leuchtfeuer', kurz: 'Riesiger Lichtkreis, enthüllt alles Verborgene.', w: 2, d: 2, hp: 480, kosten: { stein: 60, kristall: 90 }, licht: 28, sicht: 40, enthuellt: true, baubar: false },
  // ---- Verschmelzungen (zwei benachbarte Türme werden einer) ----
  brandturm: { fusion: true, zeitalter: 2, name: 'Brandpfeilturm', kurz: 'Wachturm + Feuertopf. Pfeile setzen Wesen in Brand.', w: 5, d: 5, hp: 520, kosten: { kristall: 25 }, licht: 7, sicht: 20, baubar: false, kampf: { ...P(15, 12, 0.8), brand: 8, flaeche: 1.4 } },
  leuchtpfeil: { fusion: true, zeitalter: 2, name: 'Leuchtpfeilturm', kurz: 'Wachturm + Licht. Eigenes Licht, sieht alles Verborgene.', w: 5, d: 5, hp: 460, kosten: { kristall: 20 }, licht: 13, enthuellt: true, sicht: 24, baubar: false, kampf: P(15, 13, 0.75) },
  doppelturm: { fusion: true, zeitalter: 2, name: 'Zwillingsturm', kurz: 'Zwei Wachtürme. Doppelte Besatzung, zwei Ziele.', w: 5, d: 5, hp: 640, kosten: { kristall: 20 }, licht: 5, sicht: 20, baubar: false, kampf: { ...P(15, 13, 0.75), ziele: 2 } },
  glutmoerser: { fusion: true, zeitalter: 3, name: 'Glutmörser', kurz: 'Zwei Feuertöpfe. Riesiger Einschlag, der den Boden brennen lässt.', w: 5, d: 5, hp: 760, kosten: { kristall: 45 }, licht: 8, sicht: 22, baubar: false, kampf: { reichweite: 20, schaden: 60, abklingen: 3, flaeche: 4.5, nurBoden: true, geschoss: 'topf', brand: 10, panzerbrechend: true } }
};
export const BAULEISTE: GebTyp[] = ['wachturm', 'feuertopf', 'fackel', 'mauer', 'holz', 'stein', 'kristall'];
/** Linie eines Turms (für Verschmelzungen) */
export function linie(t: GebTyp): 'fern' | 'flaeche' | 'licht' | null {
  if (['wachturm', 'schuetzenturm', 'repetierer', 'laser'].includes(t)) return 'fern';
  if (['feuertopf', 'kanone', 'blitzspule'].includes(t)) return 'flaeche';
  if (['fackel', 'leuchtfeuer', 'scheinwerfer', 'kristallfeuer'].includes(t)) return 'licht';
  return null;
}
/** Verschmelzungen: Linie A + Linie B → Ergebnis (geheim, bis entdeckt) */
export const VERSCHMELZUNGEN: { a: 'fern' | 'flaeche' | 'licht'; b: 'fern' | 'flaeche' | 'licht'; ergebnis: GebTyp }[] = [
  { a: 'fern', b: 'flaeche', ergebnis: 'brandturm' }, { a: 'fern', b: 'licht', ergebnis: 'leuchtpfeil' },
  { a: 'fern', b: 'fern', ergebnis: 'doppelturm' }, { a: 'flaeche', b: 'flaeche', ergebnis: 'glutmoerser' }
];
/** Ausbaustufen des Hauptgebäudes */
export const HAUPT_STUFEN: { stufe: number; braucht?: ErfId; kosten: Kosten; hp: number; licht: number; faehigkeit: string; kurz: string }[] = [
  { stufe: 1, kosten: {}, hp: 1500, licht: 15, faehigkeit: '', kurz: '' },
  { stufe: 2, braucht: 'sprengpulver', kosten: { holz: 160, stein: 120, kristall: 40 }, hp: 2200, licht: 19, faehigkeit: 'feuerregen', kurz: 'Fähigkeit Feuerregen: einmal je Nacht acht Feuertöpfe auf eine Stelle.' },
  { stufe: 3, braucht: 'uhrwerk', kosten: { holz: 240, stein: 200, kristall: 80 }, hp: 3000, licht: 23, faehigkeit: 'notreparatur', kurz: 'Fähigkeit Notreparatur: einmal je Nacht alle Gebäude um ein Drittel ausbessern.' },
  { stufe: 4, braucht: 'kristallspule', kosten: { holz: 300, stein: 260, kristall: 150 }, hp: 4000, licht: 28, faehigkeit: 'schild', kurz: 'Fähigkeit Kristallschild: einmal je Nacht 15 Sekunden unverwundbar.' }
];
export const FAEHIGKEIT_NAME: Record<string, string> = { feuerregen: 'Feuerregen', notreparatur: 'Notreparatur', schild: 'Kristallschild' };

export type GegTyp = 'moorwicht' | 'wolf' | 'troll' | 'drachling' | 'rochen';
export interface GegDef { name: string; hp: number; tempo: number; schaden: number; flug?: boolean; verborgen?: boolean; fracht?: number; radius: number; kristall: number; beute: [Baustein, number][] }
export const GEGNER: Record<GegTyp, GegDef> = {
  moorwicht: { name: 'Moorwicht', hp: 30, tempo: 2.3, schaden: 5, radius: 0.5, kristall: 0.25, beute: [['feuerstein', 0.3]] },
  wolf: { name: 'Schattenwolf', hp: 45, tempo: 4.2, schaden: 7, verborgen: true, radius: 0.7, kristall: 0.5, beute: [['windrune', 0.35]] },
  troll: { name: 'Steintroll', hp: 280, tempo: 1.25, schaden: 28, radius: 1.4, kristall: 4, beute: [['eisenerz', 0.6]] },
  drachling: { name: 'Drachling', hp: 95, tempo: 3.2, schaden: 16, flug: true, radius: 1.2, kristall: 3, beute: [['drachenschuppe', 0.5], ['feuerstein', 0.3]] },
  rochen: { name: 'Nebelrochen', hp: 130, tempo: 2.6, schaden: 10, flug: true, fracht: 3, radius: 1.6, kristall: 4, beute: [['windrune', 0.5]] }
};
/** ab dieser Nacht tragen Trolle Kristallpanzer: nur panzerbrechende Waffen wirken voll */
export const PANZER_AB = 10;

export interface Erfindung { name: string; zutaten: Partial<Record<Baustein, number>>; kristall: number; wirkung: string; braucht?: ErfId; zeitalter?: Zeitalter; geheim?: boolean }
export const ERFINDUNGEN: Record<ErfId, Erfindung> = {
  sprengpulver: { zeitalter: 2, name: 'Sprengpulver', zutaten: { feuerstein: 2, windrune: 1 }, kristall: 15, wirkung: 'Öffnet das Zeitalter Glut & Alchemie: Feuertopf-Schleuder, Schützenturm, Ausbau des Hauptgebäudes.' },
  leuchtfeuer: { name: 'Leuchtfeuer', zutaten: { feuerstein: 3 }, kristall: 10, wirkung: 'Fackelmasten lassen sich zum Leuchtfeuer umrüsten: großer Lichtkreis, macht Schattenwölfe sichtbar.' },
  runenpfeile: { name: 'Runenpfeile', zutaten: { windrune: 2 }, kristall: 20, wirkung: 'Pfeile und Bolzen treffen härter und sehen Verborgenes in ihrer Reichweite.' },
  stahlguss: { name: 'Stahlguss', zutaten: { eisenerz: 2 }, kristall: 20, wirkung: 'Mauern halten doppelt so viel aus.' },
  uhrwerk: { zeitalter: 3, braucht: 'sprengpulver', name: 'Uhrwerk', zutaten: { eisenerz: 3, feuerstein: 2 }, kristall: 40, wirkung: 'Öffnet das Zeitalter Uhrwerk & Dampf: Bolzen-Repetierer, Kanonenturm, Spiegel-Scheinwerfer.' },
  schuppenpanzer: { name: 'Schuppenpanzer', zutaten: { drachenschuppe: 2, eisenerz: 1 }, kristall: 25, wirkung: 'Alle Gebäude halten ein Drittel mehr aus, Drachenfeuer richtet nur halben Schaden an.' },
  fangnetz: { name: 'Fangnetz', zutaten: { windrune: 2, drachenschuppe: 1 }, kristall: 20, wirkung: 'Getroffene Flieger werden für kurze Zeit langsamer.' },
  kristallspule: { zeitalter: 4, braucht: 'uhrwerk', name: 'Kristallspule', zutaten: { drachenschuppe: 2, windrune: 3 }, kristall: 80, wirkung: 'Öffnet das Zeitalter Blitz & Kristall: Kristall-Laser, Blitzspule, Kristall-Leuchtfeuer.' },
  glutkern: { geheim: true, name: 'Glutkern', zutaten: { feuerstein: 4, drachenschuppe: 1 }, kristall: 30, wirkung: 'Feuertöpfe und Kanonen setzen Wesen in Brand.' },
  sternenstaub: { geheim: true, braucht: 'uhrwerk', name: 'Sternenstaub', zutaten: { windrune: 2, eisenerz: 2, drachenschuppe: 2 }, kristall: 60, wirkung: 'Laser und Blitze richten die Hälfte mehr Schaden an, Lichtkreise wachsen.' }
};
export const BAUSTEIN_NAME: Record<Baustein, string> = { feuerstein: 'Feuerstein', windrune: 'Windrune', eisenerz: 'Eisenerz', drachenschuppe: 'Drachenschuppe' };

export const TAG_DAUER = 80, ABEND = 22, MORGEN_DAUER = 6;
/** Dauer des Umrüstens und Verschmelzens (s) */
export const UMBAU_DAUER = 8;
/** Zusammensetzung der Welle in Nacht n (ab 1) */
export function welle(n: number): { typ: GegTyp; zahl: number }[] {
  const w: { typ: GegTyp; zahl: number }[] = [{ typ: 'moorwicht', zahl: 6 + n * 4 }];
  if (n >= 2) w.push({ typ: 'wolf', zahl: Math.round((n - 1) * 1.6) });
  if (n >= 3) w.push({ typ: 'troll', zahl: Math.floor((n - 1) / 2) });
  if (n >= 4) w.push({ typ: 'drachling', zahl: Math.floor(n / 3) });
  if (n >= 6) w.push({ typ: 'rochen', zahl: Math.floor((n - 3) / 3) });
  return w;
}
export const staerke = (n: number) => 1 + 0.14 * (n - 1);
export const START: { res: Record<Res, number> } = { res: { holz: 250, stein: 120, kristall: 25 } };
/** Anteil des Schadens, der am Morgen von selbst ausgebessert wird */
export const MORGEN_REPARATUR = 0.25;
/** Nachwachsen gefällter Bäume: Setzling nach, voller Baum nach (Tagen) */
export const SETZLING_NACH = 3, BAUM_NACH = 6;
/** Gänge, bis ein Baum gefällt bzw. ein Felsen abgebaut ist */
export const BAUM_GAENGE = 3, FELS_GAENGE = 4;
/** Gelände ebnen: Stein je Block Höhenunterschied, größte Fläche (Seitenlänge) */
export const EBNEN_STEIN = 2, EBNEN_MAX = 16;
