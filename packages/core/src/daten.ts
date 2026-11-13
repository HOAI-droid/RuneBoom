/** Spielwerte: Gebäude, Wesen, Erfindungen, Zeitalter, Wellen. Alles an einem Ort, damit sich das Gleichgewicht leicht einstellen lässt. */
export type Res = 'holz' | 'stein' | 'kristall' | 'nahrung';
export const RES_NAMEN: Record<Res, string> = { holz: 'Holz', stein: 'Stein', kristall: 'Kristall', nahrung: 'Nahrung' };
export type Baustein = 'feuerstein' | 'windrune' | 'eisenerz' | 'drachenschuppe';
export type Kosten = Partial<Record<Res, number>>;
export type GebTyp =
  | 'haupt' | 'werkstatt' | 'mauer' | 'holz' | 'stein' | 'kristall' | 'haus' | 'hof' | 'fischer'
  // Fernkampf-Linie
  | 'wachturm' | 'schuetzenturm' | 'repetierer' | 'laser'
  // Flächen-Linie
  | 'feuertopf' | 'kanone' | 'blitzspule'
  // Licht-Linie
  | 'fackel' | 'leuchtfeuer' | 'scheinwerfer' | 'kristallfeuer'
  // Verschmelzungen
  | 'brandturm' | 'leuchtpfeil' | 'doppelturm' | 'glutmoerser';
export type ErfId =
  // Zeitalter 1
  | 'sprengpulver' | 'steinmetz' | 'leuchtfeuer' | 'runenpfeile' | 'pflug' | 'axtschmiede' | 'dornenwall' | 'wachrune' | 'kraeuterkunde' | 'fischerei'
  // Zeitalter 2
  | 'uhrwerk' | 'stahlguss' | 'festungsbau' | 'fangnetz' | 'kriegstrommel' | 'glutkern' | 'brandoel' | 'kornspeicher' | 'fernrohr' | 'schuppenpanzer' | 'loeschtrupp' | 'runenkreis'
  // Zeitalter 3
  | 'kristallspule' | 'meisterbau' | 'dampfmaschine' | 'zahnradgetriebe' | 'spiegelschliff' | 'sternenstaub' | 'bollwerk' | 'alchemistenofen' | 'runenglocke'
  // Zeitalter 4
  | 'kristallgitter' | 'resonanz' | 'prismenlinse' | 'aetherspeicher' | 'sternenkorn' | 'himmelsschmiede';
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
  /** Einwohner, die hier wohnen (Stufe I) */
  wohnraum?: number;
  /** lässt sich in Stufen I–III ausbauen */
  stufen?: boolean;
}
const P = (r: number, s: number, a: number): Kampf => ({ reichweite: r, schaden: s, abklingen: a, geschoss: 'pfeil' });
export const GEBAEUDE: Record<GebTyp, GebDef> = {
  haupt: { reparatur: { holz: 160, stein: 160 }, name: 'Hauptgebäude', kurz: 'Das Herz der Feste. Wehrt sich schwach selbst und lässt sich ausbauen. Fällt es, ist die Partie verloren.', w: 12, d: 12, hp: 1500, kosten: {}, licht: 15, sicht: 60, baubar: false, kampf: P(11, 6, 1.1) },
  werkstatt: { reparatur: { holz: 60, stein: 40 }, name: 'Erfinderwerkstatt', kurz: 'Hier entstehen aus Bausteinen Erfindungen. Schlüsselerfindungen öffnen neue Zeitalter.', w: 7, d: 6, hp: 400, kosten: {}, licht: 7, sicht: 12, baubar: false },
  mauer: { name: 'Mauer', kurz: 'Hält Bodenwesen auf. Ziehen zum Bauen einer Reihe.', w: 1, d: 1, hp: 160, kosten: { stein: 3 }, licht: 0, sicht: 0, baubar: true, taste: '5' },
  holz: { stufen: true, name: 'Holzfäller', kurz: 'Arbeiter holen am Tag Holz aus dem Umkreis. Ein Baum reicht für drei Gänge, dann wird er gefällt und wächst nach einigen Tagen nach.', w: 5, d: 6, hp: 200, kosten: { holz: 20 }, licht: 3, sicht: 12, baubar: true, taste: '6', arbeit: { res: 'holz', menge: 7, dauer: 3.5, radius: 32, arbeiter: 2 } },
  stein: { stufen: true, name: 'Steinbruch', kurz: 'Arbeiter brechen am Tag Felsen im Umkreis ab, jeder Felsen reicht für vier Gänge. Felswände und Berge geben unbegrenzt Stein.', w: 4, d: 4, hp: 200, kosten: { holz: 30 }, licht: 3, sicht: 12, baubar: true, taste: '7', arbeit: { res: 'stein', menge: 5, dauer: 4, radius: 32, arbeiter: 2 } },
  kristall: { stufen: true, name: 'Kristallmine', kurz: 'Arbeiter schlagen am Tag Kristall ab. Nur an einem Kristallfeld.', w: 4, d: 4, hp: 200, kosten: { holz: 40, stein: 30 }, licht: 4, sicht: 12, baubar: true, taste: '8', arbeit: { res: 'kristall', menge: 2, dauer: 4.5, radius: 32, arbeiter: 2 } },
  haus: { stufen: true, name: 'Wohnhaus', kurz: 'Hier wohnen Einwohner. Ohne Einwohner keine Arbeiter. Wachsen kann die Feste nur mit freiem Wohnraum und genug Nahrung.', w: 4, d: 4, hp: 180, kosten: { holz: 30, stein: 10 }, licht: 3, sicht: 10, baubar: true, taste: '4', wohnraum: 4 },
  hof: { stufen: true, name: 'Bauernhof', kurz: 'Bauern bestellen die Felder rund um den Hof und bringen Nahrung.', w: 6, d: 6, hp: 200, kosten: { holz: 35 }, licht: 3, sicht: 10, baubar: true, taste: 'H', arbeit: { res: 'nahrung', menge: 1.6, dauer: 4, radius: 7, arbeiter: 2 } },
  fischer: { stufen: true, braucht: 'fischerei', name: 'Fischerhütte', kurz: 'Fischer fangen Nahrung an Teichen und Seen in der Nähe.', w: 4, d: 4, hp: 160, kosten: { holz: 30, stein: 5 }, licht: 3, sicht: 12, baubar: true, taste: 'F', arbeit: { res: 'nahrung', menge: 3, dauer: 5, radius: 18, arbeiter: 2 } },

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
export const BAULEISTE: GebTyp[] = ['wachturm', 'feuertopf', 'fackel', 'haus', 'mauer', 'holz', 'stein', 'kristall', 'hof', 'fischer'];
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
/** Ausbaustufen des Hauptgebäudes: Haltbarkeit, Licht, Turmgrenze, Wohnraum, Fähigkeit */
export interface HauptStufe { stufe: number; name: string; braucht?: ErfId; kosten: Kosten; hp: number; licht: number; tuerme: number; wohnraum: number; faehigkeit: string; kurz: string }
export const HAUPT_STUFEN: HauptStufe[] = [
  { stufe: 1, name: 'Wehrhof', kosten: {}, hp: 1500, licht: 15, tuerme: 6, wohnraum: 8, faehigkeit: '', kurz: '' },
  { stufe: 2, name: 'Steinfeste', braucht: 'steinmetz', kosten: { holz: 120, stein: 80, kristall: 20 }, hp: 2000, licht: 17, tuerme: 9, wohnraum: 10, faehigkeit: 'feuerregen', kurz: 'Fähigkeit Feuerregen: acht Feuertöpfe auf eine Stelle.' },
  { stufe: 3, name: 'Turmburg', braucht: 'sprengpulver', kosten: { holz: 180, stein: 150, kristall: 50 }, hp: 2600, licht: 20, tuerme: 13, wohnraum: 12, faehigkeit: 'notreparatur', kurz: 'Fähigkeit Notreparatur: alle Gebäude um ein Drittel ausbessern.' },
  { stufe: 4, name: 'Wehrburg', braucht: 'festungsbau', kosten: { holz: 240, stein: 220, kristall: 90 }, hp: 3300, licht: 23, tuerme: 18, wohnraum: 14, faehigkeit: 'sturmglocke', kurz: 'Fähigkeit Sturmglocke: alle Türme feuern 12 Sekunden doppelt so schnell.' },
  { stufe: 5, name: 'Dampfzitadelle', braucht: 'uhrwerk', kosten: { holz: 300, stein: 300, kristall: 140 }, hp: 4200, licht: 26, tuerme: 24, wohnraum: 16, faehigkeit: 'dampfstoss', kurz: 'Fähigkeit Dampfstoß: wirft alle Wesen nahe der Burg zurück und bremst sie.' },
  { stufe: 6, name: 'Kristallzitadelle', braucht: 'kristallspule', kosten: { holz: 380, stein: 380, kristall: 220 }, hp: 5200, licht: 30, tuerme: 30, wohnraum: 20, faehigkeit: 'schild', kurz: 'Fähigkeit Kristallschild: 15 Sekunden unverwundbar.' }
];
export const FAEHIGKEIT_NAME: Record<string, string> = { feuerregen: 'Feuerregen', notreparatur: 'Notreparatur', sturmglocke: 'Sturmglocke', dampfstoss: 'Dampfstoß', schild: 'Kristallschild' };

/** Stufen I–III eines Gebäudes: Erfindung, Kosten, Wirkung */
export const STUFE_BRAUCHT: Record<number, ErfId> = { 2: 'steinmetz', 3: 'meisterbau' };
export const STUFE_NAME = ['', 'I', 'II', 'III'];
export function stufenKosten(typ: GebTyp, stufe: number): Kosten {
  const k = GEBAEUDE[typ].kosten, f = stufe === 2 ? 0.8 : 1.4, out: Kosten = {};
  for (const [r, n] of Object.entries(k)) out[r as Res] = Math.ceil((n as number) * f);
  out.kristall = (out.kristall || 0) + (stufe === 2 ? 10 : 30);
  if (!out.stein) out.stein = stufe === 2 ? 15 : 40;
  return out;
}
/** Faktoren je Stufe: Schaden/Haltbarkeit, Reichweite, Ertrag, Arbeiter, Umkreis, Wohnraum, Licht */
export const STUFE_WERT = {
  kraft: [1, 1, 1.3, 1.65], reichweite: [0, 0, 1, 2], ertrag: [1, 1, 1.25, 1.5], arbeiter: [0, 0, 1, 2], radius: [0, 0, 6, 12], wohnraum: [0, 4, 7, 10], licht: [0, 0, 2, 4]
};
/** Runenkraft: Kristall, den ein Turm je Nacht verbraucht */
export function runenkraft(typ: GebTyp, stufe: number): number {
  const d = GEBAEUDE[typ]; if (!d.kampf || typ === 'haupt') return 0;
  return [0, 1, 2, 3, 5][d.zeitalter || 1] + (d.fusion ? 1 : 0) + (stufe - 1);
}

export type GegTyp = 'moorwicht' | 'wolf' | 'troll' | 'drachling' | 'rochen' | 'aschegeist' | 'steinwerfer' | 'schamane' | 'schildwaechter' | 'rissfuerst';
export interface GegDef {
  name: string; kurz: string; hp: number; tempo: number; schaden: number; flug?: boolean; verborgen?: boolean; fracht?: number; radius: number; kristall: number;
  /** Baustein, Wahrscheinlichkeit, Anzahl */ beute: [Baustein, number, number?][];
  /** fliegt tief und greift die Wirtschaft an */ wirtschaft?: boolean;
  /** wirft aus dieser Entfernung Steine auf Gebäude */ fern?: number;
  /** heilt Wesen im Umkreis (hp/s) */ heilt?: number;
  /** Schild: Pfeile und Töpfe richten nur diesen Anteil an */ schild?: number;
  boss?: boolean;
}
export const GEGNER: Record<GegTyp, GegDef> = {
  moorwicht: { name: 'Moorwicht', kurz: 'Viele, schwach, folgen dem Pfad.', hp: 30, tempo: 2.3, schaden: 5, radius: 0.5, kristall: 0.25, beute: [['feuerstein', 0.3]] },
  wolf: { name: 'Schattenwolf', kurz: 'Schnell, im Dunkeln verborgen. Licht macht ihn sichtbar.', hp: 45, tempo: 4.2, schaden: 7, verborgen: true, radius: 0.7, kristall: 0.5, beute: [['windrune', 0.35]] },
  troll: { name: 'Steintroll', kurz: 'Langsam und zäh. Später mit Kristallpanzer.', hp: 280, tempo: 1.25, schaden: 28, radius: 1.4, kristall: 4, beute: [['eisenerz', 0.6]] },
  drachling: { name: 'Drachling', kurz: 'Fliegt über Mauern, speit Feuer und setzt Gebäude in Brand.', hp: 95, tempo: 3.2, schaden: 16, flug: true, radius: 1.2, kristall: 3, beute: [['drachenschuppe', 0.5], ['feuerstein', 0.3]] },
  rochen: { name: 'Nebelrochen', kurz: 'Trägt Moorwichte über die Mauern.', hp: 130, tempo: 2.6, schaden: 10, flug: true, fracht: 3, radius: 1.6, kristall: 4, beute: [['windrune', 0.5]] },
  aschegeist: { name: 'Aschegeist', kurz: 'Schwebt tief über alles hinweg zu Höfen, Häusern und Minen und legt Feuer. Nach drei Bränden zerfällt er.', hp: 70, tempo: 3.8, schaden: 5, flug: true, wirtschaft: true, radius: 0.8, kristall: 2, beute: [['windrune', 0.4]] },
  steinwerfer: { name: 'Steinwerfer', kurz: 'Bleibt auf Abstand und wirft Felsbrocken auf Türme.', hp: 170, tempo: 1.5, schaden: 16, fern: 9, radius: 1.2, kristall: 3, beute: [['eisenerz', 0.45]] },
  schamane: { name: 'Moorschamane', kurz: 'Heilt die Wesen um sich herum.', hp: 140, tempo: 1.8, schaden: 6, heilt: 10, radius: 0.8, kristall: 3, beute: [['feuerstein', 0.4], ['drachenschuppe', 0.15]] },
  schildwaechter: { name: 'Borkenwächter', kurz: 'Trägt einen Schild aus Borke: Pfeile und Töpfe prallen fast ab, Strahlen und Blitze nicht.', hp: 260, tempo: 1.6, schaden: 20, schild: 0.3, radius: 1.2, kristall: 4, beute: [['eisenerz', 0.5]] },
  rissfuerst: { name: 'Rissfürst', kurz: 'Alle fünf Nächte. Ruft Wesen herbei und schützt sich mit einem Schild.', hp: 600, tempo: 1.0, schaden: 30, boss: true, radius: 2.4, kristall: 50, beute: [['feuerstein', 1, 2], ['windrune', 1, 2], ['eisenerz', 0.7, 2], ['drachenschuppe', 0.5, 2]] }
};
/** ab dieser Nacht tragen Trolle Kristallpanzer: nur panzerbrechende Waffen wirken voll */
export const PANZER_AB = 10;
export type Schwierigkeit = 'leicht' | 'normal' | 'schwer';
export const SCHWIERIGKEIT: Record<Schwierigkeit, { name: string; anzahl: number; wachstum: number; start: number }> = {
  leicht: { name: 'Leicht', anzahl: 0.75, wachstum: 0.11, start: 1.3 },
  normal: { name: 'Normal', anzahl: 1, wachstum: 0.14, start: 1 },
  schwer: { name: 'Schwer', anzahl: 1.25, wachstum: 0.18, start: 0.9 }
};

export type Wissen = 'krieg' | 'bau' | 'wirtschaft' | 'licht' | 'runen' | 'alchemie';
export const WISSEN_NAME: Record<Wissen, string> = { krieg: 'Kriegskunst', bau: 'Baukunst', wirtschaft: 'Wirtschaft', licht: 'Lichtkunde', runen: 'Runenkunde', alchemie: 'Alchemie' };
export interface Erfindung {
  name: string; zutaten: Partial<Record<Baustein, number>>; kristall: number; wirkung: string;
  /** Wissenszweig und Zeitalter, ab dem sie erfunden werden kann */ wissen: Wissen; ab: Zeitalter;
  braucht?: ErfId; /** Schlüsselerfindung: öffnet dieses Zeitalter */ zeitalter?: Zeitalter; geheim?: boolean;
}
const E = (wissen: Wissen, ab: Zeitalter, name: string, zutaten: Partial<Record<Baustein, number>>, kristall: number, wirkung: string, mehr: Partial<Erfindung> = {}): Erfindung => ({ wissen, ab, name, zutaten, kristall, wirkung, ...mehr });
export const ERFINDUNGEN: Record<ErfId, Erfindung> = {
  // ---- Zeitalter 1: Holz & Runen ----
  sprengpulver: E('alchemie', 1, 'Sprengpulver', { feuerstein: 4, windrune: 2 }, 30, 'Öffnet das Zeitalter Glut & Alchemie: Feuertopf-Schleuder, Schützenturm, Turmburg.', { zeitalter: 2 }),
  steinmetz: E('bau', 1, 'Steinmetzkunst', { feuerstein: 2 }, 15, 'Alle Gebäude lassen sich auf Stufe II ausbauen. Die Burg kann zur Steinfeste wachsen.'),
  leuchtfeuer: E('licht', 1, 'Leuchtfeuer', { feuerstein: 3 }, 10, 'Fackelmasten lassen sich zum Leuchtfeuer umrüsten: großer Lichtkreis, macht Schattenwölfe sichtbar.'),
  runenpfeile: E('krieg', 1, 'Runenpfeile', { windrune: 2 }, 20, 'Pfeile und Bolzen treffen härter und sehen Verborgenes in ihrer Reichweite.'),
  pflug: E('wirtschaft', 1, 'Eisenpflug', { feuerstein: 1 }, 10, 'Bauernhöfe bringen ein Drittel mehr Nahrung.'),
  axtschmiede: E('wirtschaft', 1, 'Axtschmiede', { feuerstein: 2 }, 12, 'Holzfäller und Steinbrüche bringen ein Viertel mehr.'),
  fischerei: E('wirtschaft', 1, 'Fischerei', { windrune: 1 }, 10, 'Fischerhütten an Teichen und Seen bringen Nahrung.'),
  dornenwall: E('bau', 1, 'Dornenwall', { feuerstein: 2, windrune: 1 }, 15, 'Bodenwesen, die an Mauern stehen, nehmen laufend Schaden.'),
  wachrune: E('runen', 1, 'Wachrune', { windrune: 1 }, 15, 'Die Burg schießt doppelt so schnell und vier Blöcke weiter.'),
  kraeuterkunde: E('alchemie', 1, 'Kräuterkunde', { feuerstein: 1, windrune: 1 }, 10, 'Am Morgen bessern sich 45 % statt 25 % der Schäden von selbst aus.'),
  // ---- Zeitalter 2: Glut & Alchemie ----
  uhrwerk: E('bau', 2, 'Uhrwerk', { eisenerz: 8, feuerstein: 8 }, 90, 'Öffnet das Zeitalter Uhrwerk & Dampf: Bolzen-Repetierer, Kanonenturm, Spiegel-Scheinwerfer, Dampfzitadelle.', { zeitalter: 3 }),
  stahlguss: E('bau', 2, 'Stahlguss', { eisenerz: 2 }, 20, 'Mauern halten doppelt so viel aus.'),
  festungsbau: E('bau', 2, 'Festungsbau', { eisenerz: 2, feuerstein: 2 }, 30, 'Die Burg kann zur Wehrburg wachsen. Zwei Türme mehr erlaubt.'),
  fangnetz: E('krieg', 2, 'Fangnetz', { windrune: 2, drachenschuppe: 1 }, 20, 'Getroffene Flieger werden für kurze Zeit langsamer.'),
  kriegstrommel: E('krieg', 2, 'Kriegstrommel', { eisenerz: 1, windrune: 2 }, 25, 'Alle Türme richten 15 % mehr Schaden an.'),
  glutkern: E('alchemie', 2, 'Glutkern', { feuerstein: 4, drachenschuppe: 1 }, 30, 'Feuertöpfe und Kanonen setzen Wesen in Brand.', { geheim: true }),
  brandoel: E('alchemie', 2, 'Brandöl', { feuerstein: 4 }, 25, 'Brennende Wesen nehmen die Hälfte mehr Schaden, und das Feuer hält länger.'),
  kornspeicher: E('wirtschaft', 2, 'Kornspeicher', { feuerstein: 2, eisenerz: 1 }, 20, 'Einwohner essen ein Viertel weniger. Die Bevölkerung wächst schneller.'),
  fernrohr: E('licht', 2, 'Fernrohr', { windrune: 2, eisenerz: 1 }, 20, 'Späher sehen doppelt so weit. Alle Türme reichen einen Block weiter.'),
  schuppenpanzer: E('bau', 2, 'Schuppenpanzer', { drachenschuppe: 2, eisenerz: 1 }, 25, 'Alle Gebäude halten ein Drittel mehr aus, Drachenfeuer richtet nur halben Schaden an.'),
  loeschtrupp: E('bau', 2, 'Löschtrupp', { windrune: 2 }, 20, 'Brände gehen doppelt so schnell aus und springen nicht mehr über.'),
  runenkreis: E('runen', 2, 'Runenkreis', { windrune: 3 }, 30, 'Türme verbrauchen ein Viertel weniger Runenkraft.'),
  // ---- Zeitalter 3: Uhrwerk & Dampf ----
  kristallspule: E('runen', 3, 'Kristallspule', { drachenschuppe: 8, windrune: 10, eisenerz: 6 }, 180, 'Öffnet das Zeitalter Blitz & Kristall: Kristall-Laser, Blitzspule, Kristall-Leuchtfeuer, Kristallzitadelle.', { zeitalter: 4 }),
  meisterbau: E('bau', 3, 'Meisterbau', { eisenerz: 4, feuerstein: 3 }, 50, 'Alle Gebäude lassen sich auf Stufe III ausbauen.'),
  dampfmaschine: E('wirtschaft', 3, 'Dampfmaschine', { eisenerz: 4 }, 40, 'Alle Arbeiter tragen die Hälfte mehr.'),
  zahnradgetriebe: E('krieg', 3, 'Zahnradgetriebe', { eisenerz: 3, windrune: 2 }, 40, 'Alle Türme feuern 20 % schneller.'),
  spiegelschliff: E('licht', 3, 'Spiegelschliff', { eisenerz: 2, windrune: 2 }, 35, 'Lichtkreise wachsen um drei Blöcke, Scheinwerfer leuchten breiter.'),
  sternenstaub: E('alchemie', 3, 'Sternenstaub', { windrune: 2, eisenerz: 2, drachenschuppe: 2 }, 60, 'Laser und Blitze richten die Hälfte mehr Schaden an, Lichtkreise wachsen.', { geheim: true }),
  bollwerk: E('bau', 3, 'Bollwerk', { eisenerz: 5 }, 45, 'Vier Türme mehr erlaubt, alle Gebäude halten 15 % mehr aus.'),
  alchemistenofen: E('alchemie', 3, 'Alchemistenofen', { feuerstein: 4, drachenschuppe: 2 }, 40, 'Kristallminen bringen die Hälfte mehr.'),
  runenglocke: E('runen', 3, 'Runenglocke', { windrune: 4, drachenschuppe: 1 }, 50, 'Jede Fähigkeit der Burg lässt sich zweimal je Nacht nutzen.'),
  // ---- Zeitalter 4: Blitz & Kristall ----
  kristallgitter: E('bau', 4, 'Kristallgitter', { drachenschuppe: 3, eisenerz: 3 }, 80, 'Alle Gebäude heilen sich nachts langsam selbst.'),
  resonanz: E('krieg', 4, 'Resonanz', { windrune: 5, drachenschuppe: 2 }, 90, 'Blitze springen auf drei weitere Wesen, Laser bekommen einen Strahl mehr.'),
  prismenlinse: E('licht', 4, 'Prismenlinse', { drachenschuppe: 2, windrune: 3 }, 70, 'Jedes Licht enthüllt Verborgenes und leuchtet vier Blöcke weiter.'),
  aetherspeicher: E('runen', 4, 'Ätherspeicher', { windrune: 4, eisenerz: 3 }, 80, 'Türme verbrauchen ein weiteres Viertel weniger Runenkraft. Der Kristallschild hält 25 Sekunden.'),
  sternenkorn: E('wirtschaft', 4, 'Sternenkorn', { drachenschuppe: 2, eisenerz: 2 }, 60, 'Höfe und Fischer bringen die Hälfte mehr, jedes Wohnhaus fasst zwei Einwohner mehr.'),
  himmelsschmiede: E('alchemie', 4, 'Himmelsschmiede', { eisenerz: 5, drachenschuppe: 3 }, 100, 'Alle Waffen durchschlagen Kristallpanzer und Borkenschilde.')
};
/** Schlüsselerfindungen brauchen so viele andere Erfindungen aus dem laufenden Zeitalter */
export const SCHLUESSEL_VORWISSEN: Record<number, number> = { 2: 2, 3: 4, 4: 4 };
export const BAUSTEIN_NAME: Record<Baustein, string> = { feuerstein: 'Feuerstein', windrune: 'Windrune', eisenerz: 'Eisenerz', drachenschuppe: 'Drachenschuppe' };

export const TAG_DAUER = 80, ABEND = 22, MORGEN_DAUER = 6;
/** Dauer des Umrüstens und Verschmelzens (s) */
export const UMBAU_DAUER = 8;
/** Zusammensetzung der Welle in Nacht n (ab 1), Anzahl mal Faktor der Schwierigkeit */
export function welle(n: number, faktor = 1): { typ: GegTyp; zahl: number }[] {
  const w: { typ: GegTyp; zahl: number }[] = [];
  const add = (typ: GegTyp, ab: number, zahl: number) => { if (n >= ab) { const z = Math.max(1, Math.round(zahl * faktor)); w.push({ typ, zahl: z }); } };
  add('moorwicht', 1, 6 + n * 4);
  add('wolf', 2, (n - 1) * 1.8);
  add('troll', 3, (n - 1) / 2);
  add('drachling', 4, n / 3);
  add('rochen', 6, (n - 3) / 3);
  add('aschegeist', 7, (n - 5) / 2.2);
  add('steinwerfer', 8, (n - 6) / 2.2);
  add('schamane', 9, (n - 7) / 4);
  add('schildwaechter', 11, (n - 9) / 2.2);
  if (n % 5 === 0) w.push({ typ: 'rissfuerst', zahl: 1 + Math.floor(n / 25) });
  return w;
}
/** Stärke der Wesen in Nacht n: wächst gleichmäßig, nach Nacht 20 schneller */
export const staerke = (n: number, wachstum = 0.16) => 1 + wachstum * (n - 1) + 0.012 * Math.pow(Math.max(0, n - 20), 1.4);
/** Nahrung, die ein Einwohner je Tag isst */
export const ESSEN = 3;
export const START: { res: Record<Res, number>; einwohner: number } = { res: { holz: 300, stein: 120, kristall: 25, nahrung: 45 }, einwohner: 12 };
/** Anteil des Schadens, der am Morgen von selbst ausgebessert wird */
export const MORGEN_REPARATUR = 0.25;
/** Nachwachsen gefällter Bäume: Setzling nach, voller Baum nach (Tagen) */
export const SETZLING_NACH = 3, BAUM_NACH = 6;
/** Gänge, bis ein Baum gefällt bzw. ein Felsen abgebaut ist */
export const BAUM_GAENGE = 3, FELS_GAENGE = 4;
/** Gelände ebnen: Stein je Block Höhenunterschied, größte Fläche (Seitenlänge) */
export const EBNEN_STEIN = 2, EBNEN_MAX = 16;
