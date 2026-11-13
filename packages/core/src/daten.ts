/** Spielwerte: Gebäude, Wesen, Erfindungen, Wellen. Alles an einem Ort, damit sich das Gleichgewicht leicht einstellen lässt. */
export type Res = 'holz' | 'stein' | 'kristall';
export type Baustein = 'feuerstein' | 'windrune' | 'eisenerz' | 'drachenschuppe';
export type Kosten = Partial<Record<Res, number>>;
export type GebTyp = 'haupt' | 'werkstatt' | 'wachturm' | 'feuertopf' | 'fackel' | 'leuchtfeuer' | 'mauer' | 'holz' | 'stein' | 'kristall';
export type ErfId = 'sprengpulver' | 'leuchtfeuer' | 'runenpfeile' | 'stahlguss';

export interface Kampf { reichweite: number; schaden: number; abklingen: number; flaeche?: number; nurBoden?: boolean; geschoss: 'pfeil' | 'topf' }
export interface GebDef {
  name: string; kurz: string; w: number; d: number; hp: number; kosten: Kosten;
  licht: number; sicht: number; braucht?: ErfId; baubar: boolean; taste?: string;
  kampf?: Kampf; ertrag?: { res: Res; rate: number };
}
export const GEBAEUDE: Record<GebTyp, GebDef> = {
  haupt: { name: 'Hauptgebäude', kurz: 'Das Herz der Feste. Wehrt sich schwach selbst. Fällt es, ist die Partie verloren.', w: 12, d: 12, hp: 1500, kosten: {}, licht: 15, sicht: 60, baubar: false,
    kampf: { reichweite: 11, schaden: 6, abklingen: 1.1, geschoss: 'pfeil' } },
  werkstatt: { name: 'Erfinderwerkstatt', kurz: 'Hier entstehen aus Bausteinen Erfindungen.', w: 7, d: 6, hp: 400, kosten: {}, licht: 7, sicht: 12, baubar: false },
  wachturm: { name: 'Wachturm', kurz: 'Holz & Runen. Schießt Pfeile auf Boden und Luft.', w: 5, d: 5, hp: 320, kosten: { holz: 40, stein: 10 }, licht: 4, sicht: 18, baubar: true, taste: '1',
    kampf: { reichweite: 13, schaden: 10, abklingen: 0.9, geschoss: 'pfeil' } },
  feuertopf: { name: 'Feuertopf-Schleuder', kurz: 'Glut & Alchemie. Wirft Feuertöpfe mit Flächenschaden, nur auf Bodenziele.', w: 5, d: 5, hp: 360, kosten: { holz: 60, stein: 40, kristall: 10 }, licht: 5, sicht: 18, braucht: 'sprengpulver', baubar: true, taste: '2',
    kampf: { reichweite: 17, schaden: 30, abklingen: 2.6, flaeche: 2.8, nurBoden: true, geschoss: 'topf' } },
  fackel: { name: 'Fackelmast', kurz: 'Kleiner Lichtkreis. Im Licht treffen Türme nachts besser und weiter.', w: 2, d: 2, hp: 80, kosten: { holz: 15 }, licht: 10, sicht: 10, baubar: true, taste: '3' },
  leuchtfeuer: { name: 'Leuchtfeuer', kurz: 'Großer Lichtkreis, macht auch Schattenwölfe sichtbar.', w: 5, d: 5, hp: 260, kosten: { holz: 30, stein: 30, kristall: 10 }, licht: 19, sicht: 22, braucht: 'leuchtfeuer', baubar: true, taste: '4' },
  mauer: { name: 'Mauer', kurz: 'Hält Bodenwesen auf. Ziehen zum Bauen einer Reihe.', w: 1, d: 1, hp: 160, kosten: { stein: 3 }, licht: 0, sicht: 0, baubar: true, taste: '5' },
  holz: { name: 'Holzfäller', kurz: 'Am Tag Holz. Je mehr Bäume in der Nähe, desto mehr.', w: 5, d: 6, hp: 200, kosten: { holz: 30 }, licht: 3, sicht: 12, baubar: true, taste: '6', ertrag: { res: 'holz', rate: 1.1 } },
  stein: { name: 'Steinbruch', kurz: 'Am Tag Stein. Felsen in der Nähe helfen.', w: 4, d: 4, hp: 200, kosten: { holz: 40 }, licht: 3, sicht: 12, baubar: true, taste: '7', ertrag: { res: 'stein', rate: 0.7 } },
  kristall: { name: 'Kristallmine', kurz: 'Am Tag Kristall. Nur an einem Kristallfeld.', w: 4, d: 4, hp: 200, kosten: { holz: 40, stein: 30 }, licht: 4, sicht: 12, baubar: true, taste: '8', ertrag: { res: 'kristall', rate: 0.35 } }
};
export const BAULEISTE: GebTyp[] = ['wachturm', 'feuertopf', 'fackel', 'leuchtfeuer', 'mauer', 'holz', 'stein', 'kristall'];

export type GegTyp = 'moorwicht' | 'wolf' | 'troll' | 'drachling';
export interface GegDef { name: string; hp: number; tempo: number; schaden: number; flug?: boolean; verborgen?: boolean; radius: number; kristall: number; beute: [Baustein, number][] }
export const GEGNER: Record<GegTyp, GegDef> = {
  moorwicht: { name: 'Moorwicht', hp: 30, tempo: 2.3, schaden: 5, radius: 0.5, kristall: 0.25, beute: [['feuerstein', 0.3]] },
  wolf: { name: 'Schattenwolf', hp: 45, tempo: 4.2, schaden: 7, verborgen: true, radius: 0.7, kristall: 0.5, beute: [['windrune', 0.35]] },
  troll: { name: 'Steintroll', hp: 280, tempo: 1.25, schaden: 28, radius: 1.4, kristall: 4, beute: [['eisenerz', 0.6]] },
  drachling: { name: 'Drachling', hp: 95, tempo: 3.2, schaden: 16, flug: true, radius: 1.2, kristall: 3, beute: [['drachenschuppe', 0.5], ['feuerstein', 0.3]] }
};

export interface Erfindung { name: string; zutaten: Partial<Record<Baustein, number>>; kristall: number; wirkung: string }
export const ERFINDUNGEN: Record<ErfId, Erfindung> = {
  sprengpulver: { name: 'Sprengpulver', zutaten: { feuerstein: 2, windrune: 1 }, kristall: 15, wirkung: 'Schaltet die Feuertopf-Schleuder frei.' },
  leuchtfeuer: { name: 'Leuchtfeuer', zutaten: { feuerstein: 3 }, kristall: 10, wirkung: 'Schaltet das Leuchtfeuer frei: großer Lichtkreis, macht Schattenwölfe sichtbar.' },
  runenpfeile: { name: 'Runenpfeile', zutaten: { windrune: 2 }, kristall: 20, wirkung: 'Wachtürme treffen härter und sehen Verborgenes in ihrer Reichweite.' },
  stahlguss: { name: 'Stahlguss', zutaten: { eisenerz: 2 }, kristall: 20, wirkung: 'Mauern halten doppelt so viel aus.' }
};
export const BAUSTEIN_NAME: Record<Baustein, string> = { feuerstein: 'Feuerstein', windrune: 'Windrune', eisenerz: 'Eisenerz', drachenschuppe: 'Drachenschuppe' };

export const TAG_DAUER = 80, ABEND = 22, MORGEN_DAUER = 6;
/** Zusammensetzung der Welle in Nacht n (ab 1) */
export function welle(n: number): { typ: GegTyp; zahl: number }[] {
  const w: { typ: GegTyp; zahl: number }[] = [{ typ: 'moorwicht', zahl: 6 + n * 4 }];
  if (n >= 2) w.push({ typ: 'wolf', zahl: Math.round((n - 1) * 1.6) });
  if (n >= 3) w.push({ typ: 'troll', zahl: Math.floor((n - 1) / 2) });
  if (n >= 4) w.push({ typ: 'drachling', zahl: Math.floor(n / 3) });
  return w;
}
export const staerke = (n: number) => 1 + 0.14 * (n - 1);
export const START: { res: Record<Res, number> } = { res: { holz: 130, stein: 40, kristall: 10 } };
