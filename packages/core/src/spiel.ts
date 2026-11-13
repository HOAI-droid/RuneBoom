import { rng, seedAusCode, type Rng } from './zufall.ts';
import { B, RISS, RISS2, RISSE, WR, setzeSeed, spalte, deko, begehbar, amPfad, orte, hoehe, setzeHoehe, hoehenListe, type Spalte, type Deko } from './welt.ts';
import { Wegfeld } from './flow.ts';
import {
  GEBAEUDE, GEGNER, ERFINDUNGEN, HAUPT_STUFEN, VERSCHMELZUNGEN, PANZER_AB, UMBAU_DAUER, ZEITALTER_NAME, linie, welle, staerke, START, TAG_DAUER, ABEND, MORGEN_DAUER, MORGEN_REPARATUR, SETZLING_NACH, BAUM_NACH, BAUM_GAENGE, FELS_GAENGE, EBNEN_STEIN, EBNEN_MAX,
  STUFE_BRAUCHT, SCHLUESSEL_VORWISSEN, STUFE_WERT, STUFE_NAME, stufenKosten, runenkraft, SCHWIERIGKEIT, ESSEN, RES_NAMEN, BAUSTEIN_NAME, FAEHIGKEIT_NAME,
  type GebTyp, type GegTyp, type Res, type Baustein, type ErfId, type Kosten, type Kampf, type Zeitalter, type Schwierigkeit
} from './daten.ts';

/** längste Nacht (s): danach ziehen sich die übrigen Wesen zurück */
export const NACHT_MAX = 240;
/** Fester Simulationstakt (Sekunden) */
export const DT = 1 / 20;
/** Nebel-Raster: Zellen zu 8 × 8 Blöcken */
export const NZ = 8, NN = (2 * WR) / NZ;

export interface Geb { id: number; typ: GebTyp; x: number; z: number; w: number; d: number; y: number; hp: number; max: number; cd: number; quellen: number; rep?: { t: number; dauer: number; von: number }; zielen: number;
  zweig?: string; stufe: number; umbau?: { t: number; dauer: number; nach: GebTyp; zweig?: string; stufe?: number }; strahlen: number[]; schild: number;
  /** brennt noch so viele Sekunden · danach eine Weile geschützt */ brand: number; brandSchutz?: number; /** hat in dieser Nacht Runenkraft */ kraft: boolean; /** Schaden in dieser Nacht */ leistung: number }
/** Trümmer eines zerstörten Gebäudes: lässt sich günstig wieder aufbauen */
export interface Ruine { id: number; typ: GebTyp; x: number; z: number; w: number; d: number; y: number; zweig?: string }
/** Arbeiter: holt Rohstoffe am Tag, nachts im Haus */
export interface Arbeiter { id: number; geb: number; x: number; z: number; y: number; zustand: 'warten' | 'hin' | 'arbeit' | 'zurueck' | 'heim' | 'drin'; ziel: [number, number] | null; quelle: number; t: number; traegt: Res | null; richtung: number; ruhe: number }
/** Zustand gefällter Bäume und abgebauter Felsen */
export type DekoZustand = 'stumpf' | 'setzling' | 'weg';
export interface Gegner { id: number; typ: GegTyp; x: number; z: number; y: number; hp: number; max: number; tempo: number; schaden: number; flug: boolean; verborgen: boolean; versatz: number; ziel: [number, number] | null; angriff: number; richtung: number; tot: boolean; seit: number; fracht: number; bester: number; stillstand: number;
  brand: number; brandDps: number; langsam: number; panzer: boolean; feuer: number; nebenbei: number;
  /** Steinwerfer: Abklingzeit · Ziel; Rissfürst: Ruf-Abklingzeit · Schild */ wurf: number; zielGeb: number; ruf: number; bossSchild: number; schildGenutzt: boolean }
export interface Geschoss { brand: number; brechend: boolean; von: number; zielGeb?: number; art: 'pfeil' | 'topf' | 'stein'; x: number; y: number; z: number; sx: number; sy: number; sz: number; tx: number; ty: number; tz: number; t: number; dauer: number; ziel: number; schaden: number; flaeche: number; trifft: boolean; bogen: number }
export type Ereignis =
  | { art: 'tod'; typ: GegTyp; x: number; y: number; z: number }
  | { art: 'treffer'; x: number; y: number; z: number }
  | { art: 'fehl'; x: number; y: number; z: number }
  | { art: 'explosion'; x: number; y: number; z: number; r: number }
  | { art: 'gebaut'; geb: Geb }
  | { art: 'weg'; geb: Geb; zerstoert: boolean }
  | { art: 'schaden'; geb: Geb }
  | { art: 'erkundet' }
  | { art: 'phase'; phase: Phase }
  | { art: 'meldung'; text: string; ton?: 'gut' | 'schlecht' | 'info' }
  | { art: 'deko'; x: number; z: number }
  | { art: 'hieb'; x: number; y: number; z: number; res: Res }
  | { art: 'abgeliefert'; x: number; y: number; z: number; res: Res; menge: number }
  | { art: 'abwurf'; x: number; y: number; z: number }
  | { art: 'reparatur'; geb: Geb; fertig: boolean }
  | { art: 'schuss'; geb: Geb; x: number; y: number; z: number; geschoss: 'pfeil' | 'topf' }
  | { art: 'gelaende'; x0: number; z0: number; x1: number; z1: number }
  | { art: 'umgebaut'; geb: Geb }
  | { art: 'blitz'; punkte: [number, number, number][] }
  | { art: 'feuer'; x: number; y: number; z: number; tx: number; ty: number; tz: number }
  | { art: 'ruine'; ruine: Ruine; neu: boolean }
  | { art: 'faehigkeit'; name: string; x: number; z: number }
  | { art: 'brand'; geb: Geb }
  | { art: 'heilung'; x: number; y: number; z: number }
  | { art: 'riss'; x: number; z: number; name: string }
  | { art: 'bericht'; bericht: Nachtbericht };
export interface Nachtbericht { nacht: number; besiegt: number; beute: string; schaden: number; zerstoert: string[]; tuerme: { name: string; schaden: number }[]; kraftFehlt: number; einwohner: number; wesen: number }
export type Phase = 'tag' | 'nacht' | 'morgen' | 'verloren';

export interface Spielstand {
  v: 1 | 2 | 3; code: string; einwohner?: number; schwierigkeit?: Schwierigkeit; nacht: number; phase: Phase; zeit: number; gefaellt?: [number, number][]; abgebaut?: [number, number][]; gaenge?: [number, number][]; hoehen?: [number, number][]; ruinen?: { typ: GebTyp; x: number; z: number; zweig?: string }[]; entdeckt?: GebTyp[];
  res: Record<Res, number>; bausteine: Record<Baustein, number>; erfindungen: ErfId[];
  gebaeude: { typ: GebTyp; x: number; z: number; hp: number; zweig?: string; stufe?: number }[]; erkundet: string; besiegt: number;
}

export const kostenText = (k: Kosten) => Object.entries(k).map(([r, n]) => `${Math.ceil(n as number)} ${RES_NAMEN[r as Res]}`).join(', ');
/** Gebäude, die Aschegeister angreifen */
const WIRTSCHAFT: GebTyp[] = ['holz', 'stein', 'kristall', 'hof', 'fischer', 'haus'];
const HOLZBAU: GebTyp[] = ['holz', 'hof', 'fischer', 'haus'];

export class Spiel {
  readonly code: string;
  readonly seed: number;
  nacht = 1;                // die kommende bzw. laufende Nacht
  phase: Phase = 'tag';
  zeit = 0;                 // Sekunden in der Phase
  res: Record<Res, number> = { ...START.res };
  einwohner = START.einwohner;
  schwierigkeit: Schwierigkeit = 'normal';
  /** Bericht der letzten Nacht */
  bericht: Nachtbericht | null = null;
  /** Sturmglocke: Türme feuern doppelt so schnell (s) */
  sturm = 0;
  private statSchaden = 0; private statBesiegt = 0; private statZerstoert: string[] = []; private kraftFehlt = 0;
  bausteine: Record<Baustein, number> = { feuerstein: 0, windrune: 0, eisenerz: 0, drachenschuppe: 0 };
  erfindungen = new Set<ErfId>();
  gebaeude: Geb[] = [];
  gegner: Gegner[] = [];
  geschosse: Geschoss[] = [];
  ereignisse: Ereignis[] = [];
  erkundet = new Uint8Array(NN * NN);
  besiegt = 0;
  arbeiter: Arbeiter[] = [];
  /** Kachel → Tag, an dem der Baum gefällt wurde (gerodet = für immer frei) */
  gefaellt = new Map<number, number>();
  /** Kachel → wie oft ein Felsen schon abgebaut wurde */
  abgebaut = new Map<number, number>();
  /** Kachel → Gänge an einem Baum, der noch steht */
  gaenge = new Map<number, number>();
  ruinen: Ruine[] = [];
  /** entdeckte Verschmelzungen (Rezeptbuch) */
  entdeckt = new Set<GebTyp>();
  /** in dieser Nacht schon genutzte Fähigkeiten (Anzahl) */
  genutzt = new Map<string, number>();
  private reserviert = new Set<number>();
  feldVersion = 0;
  private wegCache: { version: number; wege: [number, number][][] } | null = null;
  beuteNacht: Partial<Record<Baustein | 'kristall', number>> = {};
  private belegt = new Int32Array(2 * WR * 2 * WR);
  private naechsteId = 1;
  private r: Rng;
  private feld: Wegfeld;
  private feldAlt = true;
  private spawn: { typ: GegTyp; t: number; riss: { x: number; z: number } }[] = [];
  private brandTakt = 0;
  private grund: Float32Array | null = null; private grundAlt: [number, number][] = [];
  private laedt = false;
  private lichter: { x: number; z: number; r: number; enthuellt: boolean; kegel?: number; geb?: Geb }[] = [];

  constructor(code: string, stand?: Spielstand, opt: { schwierigkeit?: Schwierigkeit } = {}) {
    this.code = code; this.seed = seedAusCode(code);
    setzeSeed(this.seed);
    this.r = rng(this.seed ^ 0x5bd1e995);
    const xs = [B.x, ...RISSE.map((q) => q.x)], zs = [B.z, ...RISSE.map((q) => q.z)];
    const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 40, z0 = Math.min(...zs) - 60, z1 = Math.max(...zs) + 40;
    this.feld = new Wegfeld(x0, z0, x1 - x0, z1 - z0);
    if (stand) this.laden(stand);
    else {
      this.schwierigkeit = opt.schwierigkeit || 'normal';
      const f = SCHWIERIGKEIT[this.schwierigkeit].start;
      for (const k of Object.keys(this.res) as Res[]) this.res[k] = Math.round(START.res[k] * f);
      this.setze('haupt', B.x - 6, B.z - 6);
      this.setze('werkstatt', B.x + 9, B.z - 4);
      this.setze('wachturm', B.x + 3, B.z + 8);
      this.aufdecken(B.x, B.z + 8, 64);
      const hz = this.findePlatz('holz', B.x - 26, B.z - 8, 18); if (hz) this.setze('holz', hz[0], hz[1]);
      const st = this.findePlatz('stein', B.x + 20, B.z - 22, 18); if (st) this.setze('stein', st[0], st[1]);
      const hf = this.findePlatz('hof', B.x - 12, B.z - 22, 20); if (hf) this.setze('hof', hf[0], hf[1]);
      const hs = this.findePlatz('haus', B.x - 14, B.z + 4, 14); if (hs) this.setze('haus', hs[0], hs[1]);
      this.verteileArbeiter();
    }
  }

  // ---------------- Abfragen ----------------
  get haupt(): Geb | undefined { return this.gebaeude.find((g) => g.typ === 'haupt'); }
  istNacht(): boolean { return this.phase === 'nacht'; }
  /** 0 = Tag, 1 = tiefe Nacht; weich am Abend und am Morgen */
  dunkel(): number {
    if (this.phase === 'nacht') return Math.min(1, 0.55 + this.zeit / 6);
    if (this.phase === 'morgen') return Math.max(0, 1 - this.zeit / MORGEN_DAUER);
    if (this.phase === 'tag') return Math.max(0, (this.zeit - (TAG_DAUER - 8)) / 8) * 0.55;
    return 1;
  }
  abend(): boolean { return this.phase === 'tag' && this.zeit >= TAG_DAUER - ABEND; }
  restTag(): number { return Math.max(0, TAG_DAUER - this.zeit); }
  erkundetAn(x: number, z: number): boolean { const i = Math.floor((x + WR) / NZ), j = Math.floor((z + WR) / NZ); return i >= 0 && j >= 0 && i < NN && j < NN && this.erkundet[i * NN + j] === 1; }
  gebAn(x: number, z: number): Geb | undefined { const id = this.belegt[this.bi(x, z)]; return id ? this.gebaeude.find((g) => g.id === id) : undefined; }
  private bi(x: number, z: number): number { const i = Math.floor(x) + WR, j = Math.floor(z) + WR; return i < 0 || j < 0 || i >= 2 * WR || j >= 2 * WR ? 0 : j * 2 * WR + i; }
  static kachel(x: number, z: number): number { return (Math.floor(x) + 600) * 2048 + (Math.floor(z) + 600); }
  /** Bewuchs jetzt: berücksichtigt gefällte Bäume und abgebaute Felsen */
  dekoZustand(x: number, z: number): DekoZustand | null {
    const k = Spiel.kachel(x, z), t = this.gefaellt.get(k);
    if (t !== undefined) { if (t < -1e8) return 'weg'; const d = this.nacht - t; return d >= BAUM_NACH ? null : d >= SETZLING_NACH ? 'setzling' : 'stumpf'; }
    if ((this.abgebaut.get(k) || 0) >= FELS_GAENGE) return 'weg';
    return null;
  }
  dekoJetzt(x: number, z: number, s: Spalte | null = spalte(x, z)): Deko {
    const d = deko(x, z, s); if (!d || d.art === 'gras') return d;
    return this.dekoZustand(x, z) ? null : d;
  }
  /** Änderungen für eine Kachel (für die Grafik): Kachelschlüssel → Zustand */
  dekoAenderungen(cx: number, cz: number, ch: number): [number, number, DekoZustand][] {
    const out: [number, number, DekoZustand][] = [];
    const add = (k: number) => { const x = Math.floor(k / 2048) - 600, z = (k % 2048) - 600; if (Math.floor(x / ch) !== cx || Math.floor(z / ch) !== cz) return; const zs = this.dekoZustand(x, z); if (zs) out.push([x, z, zs]); };
    for (const k of this.gefaellt.keys()) add(k); for (const k of this.abgebaut.keys()) add(k);
    return out;
  }
  /** Helligkeit 0..1 durch Lichtquellen an (x, z) */
  licht(x: number, z: number): { wert: number; enthuellt: boolean } {
    let w = 0, e = false;
    for (const l of this.lichter) {
      const d = Math.hypot(x - l.x, z - l.z); if (d >= l.r) continue;
      let v = 1 - d / l.r;
      if (l.kegel && l.geb) { // Scheinwerfer: kleiner Kreis plus langer Kegel
        let da = Math.atan2(x - l.x, z - l.z) - l.geb.zielen; da = Math.atan2(Math.sin(da), Math.cos(da));
        v = Math.abs(da) < l.kegel ? Math.max(0.35, 1 - d / l.r) : d < 6 ? 1 - d / 6 : 0;
      }
      if (v > w) w = v; if (l.enthuellt && v > 0.05) e = true;
    }
    return { wert: w, enthuellt: e };
  }
  lichtquellen() { return this.lichter; }
  kannBezahlen(k: Kosten): boolean { return Object.entries(k).every(([r, n]) => this.res[r as Res] >= (n as number)); }
  freigeschaltet(typ: GebTyp): boolean { const b = GEBAEUDE[typ].braucht; return !b || this.erfindungen.has(b); }
  /** Zeitalter: höchste Schlüsselerfindung */
  zeitalter(): Zeitalter { let z: Zeitalter = 1; for (const id of this.erfindungen) { const a = ERFINDUNGEN[id].zeitalter; if (a && a > z) z = a; } return z; }
  zeitalterName(): string { return ZEITALTER_NAME[this.zeitalter()]; }
  /** Kampfwerte mit Zweig und Erfindungen */
  kampf(g: Geb): Kampf | undefined {
    const def = GEBAEUDE[g.typ]; if (!def.kampf) return undefined;
    const E = this.erfindungen;
    const k: Kampf = { ...def.kampf, ...(def.zweige?.find((z) => z.id === g.zweig)?.kampf || {}) };
    if (k.geschoss === 'pfeil' && E.has('runenpfeile')) k.schaden *= 1.6;
    if ((k.geschoss === 'strahl' || k.geschoss === 'blitz' || k.geschoss === 'aura') && E.has('sternenstaub')) k.schaden *= 1.5;
    if (k.geschoss === 'topf' && E.has('glutkern') && !k.brand) k.brand = 8;
    if (g.typ === 'haupt') { k.reichweite += (g.stufe - 1) * 2; if (E.has('wachrune')) { k.abklingen /= 2; k.reichweite += 4; } }
    else { k.schaden *= STUFE_WERT.kraft[g.stufe]; k.reichweite += STUFE_WERT.reichweite[g.stufe]; }
    if (E.has('kriegstrommel')) k.schaden *= 1.15;
    if (E.has('zahnradgetriebe')) k.abklingen /= 1.2;
    if (E.has('fernrohr')) k.reichweite += 1;
    if (E.has('resonanz')) { if (k.geschoss === 'blitz') k.kette = (k.kette || 0) + 3; if (k.geschoss === 'strahl') k.ziele = (k.ziele || 1) + 1; }
    if (E.has('himmelsschmiede')) k.panzerbrechend = true;
    if (this.sturm > 0) k.abklingen /= 2;
    if (!g.kraft && g.typ !== 'haupt' && this.phase === 'nacht') { k.abklingen *= 2; if (k.geschoss === 'strahl' || k.geschoss === 'aura') k.schaden *= 0.5; }
    return k;
  }
  /** Bonus auf die Haltbarkeit durch Erfindungen und Stufen */
  private hpFaktor(typ: GebTyp): number { return (typ === 'mauer' && this.erfindungen.has('stahlguss') ? 2 : 1) * (this.erfindungen.has('schuppenpanzer') ? 4 / 3 : 1) * (this.erfindungen.has('bollwerk') ? 1.15 : 1); }
  private grundHp(g: { typ: GebTyp; stufe?: number }): number {
    const st = g.stufe || 1;
    return Math.round((g.typ === 'haupt' ? HAUPT_STUFEN[st - 1].hp : GEBAEUDE[g.typ].hp * STUFE_WERT.kraft[st]) * this.hpFaktor(g.typ));
  }
  // ---------------- Stufen, Bevölkerung, Turmgrenze, Runenkraft ----------------
  /** Lässt sich der Gebäudetyp in Stufen I–III ausbauen? */
  static hatStufen(typ: GebTyp): boolean { const d = GEBAEUDE[typ]; return !!d.stufen || (!!d.kampf && typ !== 'haupt') || linie(typ) === 'licht'; }
  /** nächste Stufe eines Gebäudes oder ein Grund, warum es nicht geht */
  stufeOption(g: Geb): { stufe: number; kosten: Kosten; grund?: string } | undefined {
    if (g.typ === 'haupt' || !Spiel.hatStufen(g.typ) || g.stufe >= 3) return undefined;
    const stufe = g.stufe + 1, kosten = stufenKosten(g.typ, stufe), b = STUFE_BRAUCHT[stufe];
    let grund: string | undefined;
    if (!this.erfindungen.has(b)) grund = `Braucht die Erfindung ${ERFINDUNGEN[b].name}.`;
    else if (this.phase !== 'tag') grund = 'Ausgebaut wird nur am Tag.';
    else if (g.umbau) grund = 'Erst den laufenden Bau abwarten.';
    else if (!this.kannBezahlen(kosten)) grund = this.fehlt(kosten);
    return { stufe, kosten, grund };
  }
  stufeAusbauen(g: Geb): boolean {
    const o = this.stufeOption(g); if (!o) return false;
    if (o.grund) { this.melde(o.grund, 'schlecht'); return false; }
    for (const [r, n] of Object.entries(o.kosten)) this.res[r as Res] -= n as number;
    g.umbau = { t: 0, dauer: UMBAU_DAUER, nach: g.typ, zweig: g.zweig, stufe: o.stufe }; g.rep = undefined;
    this.ereignisse.push({ art: 'reparatur', geb: g, fertig: false });
    return true;
  }
  /** „Es fehlen 39 Stein“ */
  fehlt(k: Kosten): string {
    const f = Object.entries(k).filter(([r, n]) => this.res[r as Res] < (n as number)).map(([r, n]) => `${Math.ceil((n as number) - this.res[r as Res])} ${RES_NAMEN[r as Res]}`);
    return f.length ? `Es fehlen ${f.join(' und ')}.` : '';
  }
  /** Lässt sich das Gebäude jetzt verbessern (Stufe, Umrüsten, Burgausbau)? */
  verbesserbar(g: Geb): boolean {
    if (this.phase !== 'tag' || g.umbau) return false;
    if (g.typ === 'haupt') { const st = this.hauptAusbau(); return !!st && (!st.braucht || this.erfindungen.has(st.braucht)) && this.kannBezahlen(st.kosten); }
    const o = this.stufeOption(g); if (o && !o.grund) return true;
    return this.umruestOptionen(g).some((t) => this.freigeschaltet(t) && this.kannBezahlen(GEBAEUDE[t].kosten));
  }
  /** Arbeitswerte eines Gebäudes mit Stufe und Erfindungen */
  arbeit(g: { typ: GebTyp; stufe: number }): { res: Res; menge: number; dauer: number; radius: number; arbeiter: number } | undefined {
    const a = GEBAEUDE[g.typ].arbeit; if (!a) return undefined;
    const E = this.erfindungen;
    let menge = a.menge * STUFE_WERT.ertrag[g.stufe];
    if (g.typ === 'hof' && E.has('pflug')) menge *= 4 / 3;
    if ((g.typ === 'holz' || g.typ === 'stein') && E.has('axtschmiede')) menge *= 1.25;
    if (g.typ === 'kristall' && E.has('alchemistenofen')) menge *= 1.5;
    if ((g.typ === 'hof' || g.typ === 'fischer') && E.has('sternenkorn')) menge *= 1.5;
    if (E.has('dampfmaschine')) menge *= 1.5;
    return { res: a.res, menge, dauer: a.dauer, radius: a.radius + STUFE_WERT.radius[g.stufe], arbeiter: a.arbeiter + STUFE_WERT.arbeiter[g.stufe] };
  }
  /** Wohnraum für Einwohner: Burg und Wohnhäuser */
  wohnraum(): number {
    const h = this.haupt; let w = h ? HAUPT_STUFEN[h.stufe - 1].wohnraum : 0;
    for (const g of this.gebaeude) if (g.typ === 'haus') w += STUFE_WERT.wohnraum[g.stufe] + (this.erfindungen.has('sternenkorn') ? 2 : 0);
    return w;
  }
  /** Arbeiter, die alle Gebäude zusammen bräuchten */
  arbeiterBedarf(): number { let n = 0; for (const g of this.gebaeude) n += this.arbeit(g)?.arbeiter || 0; return n; }
  /** zugeteilte Arbeiter je Gebäude-Id */
  zugeteilt(g: Geb): number { let n = 0; for (const a of this.arbeiter) if (a.geb === g.id) n++; return n; }
  /** Einwohner ohne Arbeit (laufen in der Feste herum) */
  leerlauf(): number { return Math.max(0, this.einwohner - this.arbeiter.length); }
  /** Nahrung, die alle Einwohner je Tag essen */
  essen(): number { return Math.ceil(this.einwohner * ESSEN * (this.erfindungen.has('kornspeicher') ? 0.75 : 1)); }
  /** Einwohner auf die Arbeitsgebäude verteilen: zuerst Nahrung, dann der Reihe nach */
  verteileArbeiter(): void {
    const liste = this.gebaeude.filter((g) => GEBAEUDE[g.typ].arbeit);
    liste.sort((a, b) => (GEBAEUDE[b.typ].arbeit!.res === 'nahrung' ? 1 : 0) - (GEBAEUDE[a.typ].arbeit!.res === 'nahrung' ? 1 : 0) || a.id - b.id);
    // erste Runde: jedem Gebäude einen, dann auffüllen
    const soll = new Map<number, number>(); let frei = this.einwohner;
    for (const runde of [1, 99]) for (const g of liste) { const max = Math.min(this.arbeit(g)!.arbeiter, runde), hat = soll.get(g.id) || 0, n = Math.max(0, Math.min(max - hat, frei)); soll.set(g.id, hat + n); frei -= n; }
    for (const g of liste) {
      const n = soll.get(g.id) || 0, jetzt = this.arbeiter.filter((a) => a.geb === g.id);
      for (const a of jetzt.slice(n)) { if (a.quelle >= 0) this.reserviert.delete(a.quelle); this.arbeiter = this.arbeiter.filter((o) => o !== a); }
      for (let i = jetzt.length; i < n; i++) this.arbeiter.push({ id: this.naechsteId++, geb: g.id, x: g.x + g.w / 2 + (i % 3), z: g.z + g.d + 0.5, y: g.y, zustand: this.phase === 'tag' ? 'warten' : 'drin', ziel: null, quelle: -1, t: i * 1.5, traegt: null, richtung: 0, ruhe: i * 1.2 });
    }
  }
  /** Türme, die nach der Burgstufe erlaubt sind */
  turmGrenze(): number { const h = this.haupt; return (h ? HAUPT_STUFEN[h.stufe - 1].tuerme : 6) + (this.erfindungen.has('festungsbau') ? 2 : 0) + (this.erfindungen.has('bollwerk') ? 4 : 0); }
  turmZahl(): number { return this.gebaeude.filter((g) => GEBAEUDE[g.typ].kampf && g.typ !== 'haupt').length; }
  /** Kristall, den alle Türme in der kommenden Nacht als Runenkraft brauchen */
  runenkraftBedarf(): number {
    let n = 0; for (const g of this.gebaeude) n += runenkraft(g.typ, g.stufe);
    if (this.erfindungen.has('runenkreis')) n *= 0.75; if (this.erfindungen.has('aetherspeicher')) n *= 0.75;
    return Math.ceil(n);
  }
  /** Risse, die in Nacht n offen sind */
  offeneRisse(n = this.nacht): typeof RISSE { return RISSE.filter((q) => q.ab <= n && spalte(q.x, q.z)); }
  ruineAn(x: number, z: number): Ruine | undefined { return this.ruinen.find((r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d); }
  welleVorschau() { return welle(this.nacht); }

  /** Kann typ mit linker oberer Ecke (x0, z0) gebaut werden? */
  pruefe(typ: GebTyp, x0: number, z0: number): { ok: boolean; grund?: string; y: number } {
    const def = GEBAEUDE[typ];
    if (!this.freigeschaltet(typ)) return { ok: false, grund: `Braucht die Erfindung ${ERFINDUNGEN[def.braucht!].name}.`, y: 0 };
    if (def.kampf && this.turmZahl() >= this.turmGrenze()) return { ok: false, grund: `Turmgrenze erreicht (${this.turmGrenze()}). Baue die Burg aus, um mehr Türme zu erlauben.`, y: 0 };
    let lo = 99, hi = -99;
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) {
      const s = spalte(x, z);
      if (!s) return { ok: false, grund: 'Hier ist kein Land.', y: 0 };
      if (!this.erkundetAn(x, z)) return { ok: false, grund: 'Noch im Nebel. Erst einen Späher schicken.', y: 0 };
      if (!begehbar(s)) return { ok: false, grund: s.a === 'w' ? 'Nicht im Wasser.' : s.a === 'l' ? 'Nicht in der Lava.' : 'Zu steil.', y: 0 };
      if (this.belegt[this.bi(x, z)]) return { ok: false, grund: 'Hier steht schon etwas.', y: 0 };
      if (this.ruineAn(x, z)) return { ok: false, grund: 'Hier liegt eine Ruine. Wähle sie, um sie wieder aufzubauen oder zu räumen.', y: 0 };
      const dk = this.dekoJetzt(x, z, s);
      if (dk && dk.art !== 'gras') return { ok: false, grund: dk.art === 'baum' ? 'Hier steht ein Baum. Ein Holzfäller kann ihn fällen.' : 'Hier liegt ein Felsen.', y: 0 };
      if (amPfad(x, z, 0) && typ !== 'mauer' && typ !== 'fackel') { /* auf dem Pfad erlaubt, blockiert ihn aber */ }
      lo = Math.min(lo, s.h); hi = Math.max(hi, s.h);
    }
    if (hi - lo > (typ === 'mauer' ? 2 : 1)) return { ok: false, grund: 'Der Boden ist zu uneben.', y: 0 };
    if (typ === 'fischer' && !this.quellen('fischer', x0 + def.w / 2, z0 + def.d / 2, GEBAEUDE.fischer.arbeit!.radius, false).length) return { ok: false, grund: 'Eine Fischerhütte braucht Wasser in der Nähe.', y: 0 };
    if (typ === 'kristall' && !orte().some((o) => o.typ === 'kristall' && Math.hypot(o.x - (x0 + 2), o.z - (z0 + 2)) < 10)) return { ok: false, grund: 'Eine Kristallmine muss an einem Kristallfeld stehen.', y: 0 };
    return { ok: true, y: hi + 1 };
  }

  // ---------------- Aktionen ----------------
  bauen(typ: GebTyp, x0: number, z0: number, still = false): boolean {
    const def = GEBAEUDE[typ];
    if (this.phase === 'verloren') return false;
    const p = this.pruefe(typ, x0, z0);
    if (!p.ok) { if (!still) this.melde(p.grund!, 'schlecht'); return false; }
    if (!this.kannBezahlen(def.kosten)) { if (!still) this.melde(`${def.name} kostet ${kostenText(def.kosten)}. ${this.fehlt(def.kosten)}`, 'schlecht'); return false; }
    for (const [r, n] of Object.entries(def.kosten)) this.res[r as Res] -= n as number;
    this.setze(typ, x0, z0);
    return true;
  }
  abreissen(g: Geb): void {
    if (g.typ === 'haupt' || g.typ === 'werkstatt') { this.melde('Das bleibt stehen.', 'schlecht'); return; }
    for (const [r, n] of Object.entries(GEBAEUDE[g.typ].kosten)) this.res[r as Res] += Math.floor((n as number) * 0.5 * g.hp / g.max);
    this.entferne(g, false);
  }
  spaeher(x: number, z: number): boolean {
    if (this.erkundetAn(x, z)) return false;
    let nah = Infinity;
    for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) if (this.erkundet[i * NN + j]) nah = Math.min(nah, Math.hypot(-WR + (i + 0.5) * NZ - x, -WR + (j + 0.5) * NZ - z));
    if (nah > 64) { this.melde('Zu weit: Späher kommen nur vom Rand des Erkundeten aus.', 'schlecht'); return false; }
    if (this.res.holz < 15) { this.melde('Ein Späher kostet 15 Holz.', 'schlecht'); return false; }
    this.res.holz -= 15;
    this.aufdecken(x, z, this.erfindungen.has('fernrohr') ? 56 : 38);
    this.melde('Ein Späher hat die Gegend erkundet.', 'gut');
    return true;
  }
  erfinden(id: ErfId): boolean {
    const e = ERFINDUNGEN[id];
    if (this.erfindungen.has(id)) return false;
    if (e.braucht && !this.erfindungen.has(e.braucht)) { this.melde(`${e.name} braucht zuerst ${ERFINDUNGEN[e.braucht].name}.`, 'schlecht'); return false; }
    const vor = this.vorwissenFehlt(id); if (vor) { this.melde(vor, 'schlecht'); return false; }
    const fehlt = Object.entries(e.zutaten).some(([b, n]) => this.bausteine[b as Baustein] < (n as number)) || this.res.kristall < e.kristall;
    if (fehlt) { this.melde(`Für ${e.name} fehlen noch Bausteine oder Kristall.`, 'schlecht'); return false; }
    for (const [b, n] of Object.entries(e.zutaten)) this.bausteine[b as Baustein] -= n as number;
    this.res.kristall -= e.kristall;
    this.erfindungen.add(id);
    for (const g of this.gebaeude) { const f = g.hp / g.max; g.max = this.grundHp(g); g.hp = g.max * f; }
    this.lichterNeu(); this.verteileArbeiter();
    this.melde(`Erfunden: ${e.name}. ${e.wirkung}`, 'gut');
    if (e.zeitalter) this.melde(`Ein neues Zeitalter beginnt: ${ZEITALTER_NAME[e.zeitalter]}.`, 'gut');
    return true;
  }
  /** Grund, warum eine Erfindung noch nicht geht (Zeitalter, Vorwissen), sonst leer */
  vorwissenFehlt(id: ErfId): string {
    const e = ERFINDUNGEN[id];
    if (this.zeitalter() < e.ab) return `${e.name} gehört ins Zeitalter ${ZEITALTER_NAME[e.ab]}.`;
    if (e.braucht && !this.erfindungen.has(e.braucht)) return `Braucht zuerst ${ERFINDUNGEN[e.braucht].name}.`;
    if (e.zeitalter) { const n = SCHLUESSEL_VORWISSEN[e.zeitalter] || 0, hat = [...this.erfindungen].filter((i) => ERFINDUNGEN[i].ab === e.ab && !ERFINDUNGEN[i].zeitalter).length; if (hat < n) return `Braucht erst ${n} andere Erfindungen aus diesem Zeitalter (${hat} von ${n}).`; }
    return '';
  }
  nachtEinlaeuten(): void {
    if (this.phase !== 'tag') return;
    const bonus = Math.round(12 * this.restTag() / TAG_DAUER);
    if (bonus > 0) { this.res.kristall += bonus; this.melde(`Früh eingeläutet: +${bonus} Kristall.`, 'gut'); }
    this.starteNacht();
  }

  // ---------------- Takt ----------------
  schritt(): void {
    if (this.phase === 'verloren') return;
    this.zeit += DT;
    if (this.feldAlt) this.feldNeu();
    if (this.phase === 'tag') {
      for (const g of this.gebaeude) if (g.rep) {
        g.rep.t += DT; const f = Math.min(1, g.rep.t / g.rep.dauer); g.hp = g.rep.von + (g.max - g.rep.von) * f;
        if (f >= 1) { g.rep = undefined; g.hp = g.max; this.ereignisse.push({ art: 'reparatur', geb: g, fertig: true }); }
      }
      for (const g of this.gebaeude) if (g.umbau) {
        g.umbau.t += DT;
        if (g.umbau.t >= g.umbau.dauer) {
          const u = g.umbau; g.umbau = undefined;
          if (u.stufe) g.stufe = u.stufe; else { g.typ = u.nach; g.zweig = u.zweig; }
          g.max = this.grundHp(g); g.hp = g.max; g.cd = 0;
          this.lichterNeu(); this.verteileArbeiter(); this.ereignisse.push({ art: 'umgebaut', geb: g });
          this.melde(g.typ === 'haupt' ? `Die Burg ist zur ${HAUPT_STUFEN[g.stufe - 1].name} gewachsen.` : u.stufe ? `${GEBAEUDE[g.typ].name} Stufe ${STUFE_NAME[g.stufe]} ist fertig.` : `${GEBAEUDE[g.typ].name} ist fertig.`, 'gut');
        }
      }
      if (this.zeit >= TAG_DAUER) this.starteNacht();
    } else if (this.phase === 'nacht') {
      for (const g of this.gebaeude) if (g.schild > 0) g.schild -= DT;
      if (this.sturm > 0) this.sturm -= DT;
      if (this.erfindungen.has('kristallgitter')) for (const g of this.gebaeude) if (g.hp < g.max) g.hp = Math.min(g.max, g.hp + g.max * 0.005 * DT);
      while (this.spawn.length && this.spawn[0].t <= this.zeit) { const s = this.spawn.shift()!; this.erzeuge(s.typ, s.riss); }
      if (!this.spawn.length && !this.gegner.length && this.zeit > 3) this.starteMorgen();
      else if (this.zeit > NACHT_MAX && !this.spawn.length) {
        // Sicherheitsnetz: keine Nacht dauert ewig
        this.gegner = []; this.melde('Der Morgen graut: Die übrigen Wesen ziehen sich in die Wildnis zurück.', 'info'); this.starteMorgen();
      }
    } else if (this.phase === 'morgen') {
      if (this.zeit >= MORGEN_DAUER) {
        this.phase = 'tag'; this.zeit = 0; this.nacht++;
        this.tagesbeginn(); this.quellVersion++;
        // Bäume wachsen nach: Setzling, dann voller Baum
        for (const [k, t] of [...this.gefaellt]) { if (t < -1e8) continue; const d = this.nacht - t; if (d === SETZLING_NACH || d >= BAUM_NACH) { const x = Math.floor(k / 2048) - 600, z = (k % 2048) - 600; if (d >= BAUM_NACH) { this.gefaellt.delete(k); this.grundAlt.push([x, z]); this.feldAlt = true; } this.ereignisse.push({ art: 'deko', x, z }); } }
        this.ereignisse.push({ art: 'phase', phase: 'tag' }); this.melde(`Tag ${this.nacht}. Bis zur Nacht bleibt Zeit zum Bauen.`, 'info');
      }
    }
    this.braende();
    this.bewegeGegner();
    this.tuerme();
    this.bewegeGeschosse();
    this.arbeiterSchritt();
  }

  private starteNacht(): void {
    this.phase = 'nacht'; this.zeit = 0; this.beuteNacht = {}; this.genutzt.clear(); this.sturm = 0;
    this.statSchaden = 0; this.statBesiegt = 0; this.statZerstoert = [];
    for (const g of this.gebaeude) g.leistung = 0;
    // Runenkraft: Türme verbrauchen Kristall. Was fehlt, schwächt die äußersten Türme
    const bedarf = this.runenkraftBedarf(), zahlt = Math.min(bedarf, Math.floor(this.res.kristall));
    this.res.kristall -= zahlt; this.kraftFehlt = bedarf - zahlt;
    const h = this.haupt, hx = h ? h.x + h.w / 2 : B.x, hz = h ? h.z + h.d / 2 : B.z;
    const nachNaehe = [...this.gebaeude].sort((a, b) => Math.hypot(a.x - hx, a.z - hz) - Math.hypot(b.x - hx, b.z - hz));
    const m = (this.erfindungen.has('runenkreis') ? 0.75 : 1) * (this.erfindungen.has('aetherspeicher') ? 0.75 : 1);
    let rest = zahlt + 0.999;
    for (const g of nachNaehe) { const k = runenkraft(g.typ, g.stufe) * m; g.kraft = k <= rest; if (g.kraft) rest -= k; }
    if (this.kraftFehlt > 0) this.melde(`Zu wenig Kristall für die Runenkraft: ${this.kraftFehlt} fehlen. Die äußeren Türme feuern heute nur halb so schnell.`, 'schlecht');
    // neue Risse
    for (const q of RISSE) if (q.ab === this.nacht && spalte(q.x, q.z)) { this.melde(`Der ${q.name} hat sich geöffnet! Von dort kommen nun auch Wesen.`, 'schlecht'); this.ereignisse.push({ art: 'riss', x: q.x, z: q.z, name: q.name }); }
    const risse = this.offeneRisse();
    // Die Welle sucht die schwächste Seite: Risse mit wenig Abwehr am Weg bekommen mehr Wesen
    const gewicht = risse.map((q) => 1 / (1 + this.abwehrAmWeg(q) / 60));
    const summe = gewicht.reduce((a, b) => a + b, 0);
    // ein frisch geöffneter Riss schickt höchstens ein Drittel der Welle
    const anteil = gewicht.map((w, i) => Math.min(risse[i].ab === this.nacht && risse.length > 1 ? 0.33 : 1, Math.max(0.2, w / summe)));
    const wahl = () => { let x = this.r() * anteil.reduce((a, b) => a + b, 0); for (let i = 0; i < risse.length; i++) { x -= anteil[i]; if (x <= 0) return risse[i]; } return risse[risse.length - 1]; };
    const plan: { typ: GegTyp; t: number; riss: { x: number; z: number } }[] = [];
    const dauer = Math.min(60, 24 + this.nacht * 0.8), S = SCHWIERIGKEIT[this.schwierigkeit];
    for (const { typ, zahl } of welle(this.nacht, S.anzahl)) for (let i = 0; i < zahl; i++) {
      if (typ === 'rissfuerst') { const alt = risse.filter((q) => q.ab < this.nacht); const q = alt.length ? alt[Math.floor(this.r() * alt.length)] : risse[0]; plan.push({ typ, t: 12 + i * 8, riss: q }); continue; }
      plan.push({ typ, t: 2 + this.r() * dauer, riss: wahl() });
    }
    plan.sort((a, b) => a.t - b.t);
    this.spawn = plan;
    this.ereignisse.push({ art: 'phase', phase: 'nacht' });
    this.melde(`Nacht ${this.nacht}: Die Wesen kommen!`, 'schlecht');
    if (plan.some((p) => p.typ === 'rissfuerst')) this.melde('Ein Rissfürst erhebt sich aus der Tiefe!', 'schlecht');
  }
  /** Schaden je Sekunde, den die Türme entlang des Wegs von einem Riss anrichten könnten */
  private abwehrAmWeg(q: { x: number; z: number }): number {
    const weg: [number, number][] = []; let p: [number, number] | null = [q.x + 0.5, q.z + 0.5];
    for (let i = 0; i < 900 && p; i++) { if (i % 3 === 0) weg.push(p); p = this.feld.naechster(p[0], p[1]); }
    let n = 0;
    for (const g of this.gebaeude) {
      const k = this.kampf(g); if (!k || g.typ === 'haupt') continue;
      const cx = g.x + g.w / 2, cz = g.z + g.d / 2;
      if (weg.some(([x, z]) => Math.hypot(x - cx, z - cz) < k.reichweite)) n += k.schaden / Math.max(0.3, k.abklingen || 0.3);
    }
    return n;
  }
  private starteMorgen(): void {
    this.phase = 'morgen'; this.zeit = 0;
    const heil = this.erfindungen.has('kraeuterkunde') ? 0.45 : MORGEN_REPARATUR;
    for (const g of this.gebaeude) { g.hp = Math.min(g.max, g.hp + (g.max - g.hp) * heil); g.brand = 0; }
    const b = Object.entries(this.beuteNacht).filter(([, n]) => (n as number) > 0).map(([k, n]) => `${Math.round(n as number)} ${k === 'kristall' ? 'Kristall' : BAUSTEIN_NAME[k as Baustein]}`).join(', ');
    const tuerme = this.gebaeude.filter((g) => g.leistung > 0).sort((a, b) => b.leistung - a.leistung).slice(0, 5).map((g) => ({ name: GEBAEUDE[g.typ].name + (g.stufe > 1 ? ' ' + STUFE_NAME[g.stufe] : ''), schaden: Math.round(g.leistung) }));
    this.bericht = { nacht: this.nacht, besiegt: this.statBesiegt, beute: b || 'nichts', schaden: Math.round(this.statSchaden), zerstoert: this.statZerstoert, tuerme, kraftFehlt: this.kraftFehlt, einwohner: this.einwohner, wesen: this.statBesiegt };
    this.ereignisse.push({ art: 'phase', phase: 'morgen' });
    this.ereignisse.push({ art: 'bericht', bericht: this.bericht });
    this.melde(`Nacht ${this.nacht} überstanden. Beute: ${b || 'nichts'}.`, 'gut');
  }
  /** Neuer Tag: Einwohner essen, bei Überschuss und freiem Wohnraum wächst die Feste */
  private tagesbeginn(): void {
    for (const q of RISSE) if (q.ab === this.nacht && spalte(q.x, q.z)) this.melde(`Warnung: Heute Nacht öffnet sich der ${q.name}. Die leuchtende Linie zeigt den neuen Weg.`, 'schlecht');
    if (this.nacht % 5 === 0) this.melde('Warnung: Heute Nacht kommt ein Rissfürst.', 'schlecht');
    const bedarf = this.essen();
    if (this.res.nahrung >= bedarf) {
      this.res.nahrung -= bedarf;
      const platz = this.wohnraum() - this.einwohner;
      if (platz > 0 && this.res.nahrung >= ESSEN * 2) {
        const neu = Math.min(platz, Math.max(2, Math.round(this.einwohner * (this.erfindungen.has('kornspeicher') ? 0.3 : 0.2))), Math.floor(this.res.nahrung / ESSEN));
        if (neu > 0) { this.einwohner += neu; this.melde(`${neu} neue Einwohner sind in die Feste gezogen (jetzt ${this.einwohner}).`, 'gut'); }
      } else if (platz <= 0) this.melde('Die Feste ist voll: Für mehr Einwohner braucht es Wohnhäuser.', 'info');
    } else {
      const fehlt = bedarf - this.res.nahrung; this.res.nahrung = 0;
      const weg = Math.min(this.einwohner - 4, Math.max(1, Math.ceil(fehlt / ESSEN / 2)));
      if (weg > 0) { this.einwohner -= weg; this.melde(`Hunger! ${weg} Einwohner haben die Feste verlassen. Baue Bauernhöfe oder Fischerhütten.`, 'schlecht'); }
    }
    // ohne Wohnraum ziehen Einwohner nach und nach fort
    const ueber = this.einwohner - this.wohnraum();
    if (ueber > 0) { const weg = Math.ceil(ueber / 2); this.einwohner -= weg; this.melde(`${weg} Einwohner ohne Dach haben die Feste verlassen.`, 'schlecht'); }
    this.verteileArbeiter();
  }
  private erzeuge(typ: GegTyp, riss: { x: number; z: number }): void {
    const d = GEGNER[typ], s = staerke(this.nacht, SCHWIERIGKEIT[this.schwierigkeit].wachstum);
    const a = this.r() * Math.PI * 2; let x = riss.x + Math.cos(a) * 3, z = riss.z + Math.sin(a) * 3;
    if (!d.flug && this.feld.wert(x, z) === Infinity) { const p = this.erreichbarNahe(x, z); if (p) { x = p[0]; z = p[1]; } }
    this.gegner.push({ id: this.naechsteId++, typ, x, z, y: hoehe(x, z), hp: d.hp * s, max: d.hp * s, tempo: d.tempo * (0.9 + this.r() * 0.2), schaden: d.schaden * s, flug: !!d.flug, verborgen: !!d.verborgen, versatz: (this.r() - 0.5) * 0.7, ziel: null, angriff: 0, richtung: 0, tot: false, seit: 0, fracht: d.fracht || 0, brand: 0, brandDps: 0, langsam: 0, panzer: typ === 'troll' && this.nacht >= PANZER_AB, feuer: 0, nebenbei: 1 + this.r() * 2, bester: Infinity, stillstand: 0, wurf: 1 + this.r() * 2, zielGeb: 0, ruf: typ === 'aschegeist' ? 3 : typ === 'steinwerfer' ? 0 : 8, bossSchild: 0, schildGenutzt: false });
  }
  /** nächstes Gebäude der Wirtschaft (Ziel der Aschegeister) */
  private wirtschaftsZiel(x: number, z: number): Geb | undefined {
    let best: Geb | undefined, bd = Infinity;
    for (const g of this.gebaeude) if (WIRTSCHAFT.includes(g.typ)) { const d = Math.hypot(g.x + g.w / 2 - x, g.z + g.d / 2 - z); if (d < bd) { bd = d; best = g; } }
    return best;
  }
  /** Gebäude in Wurfweite (Steinwerfer): Türme zuerst */
  private wurfZiel(x: number, z: number, r: number): Geb | undefined {
    let best: Geb | undefined, bd = Infinity;
    for (const g of this.gebaeude) { if (g.typ === 'mauer') continue; const d = this.randAbstand(x, z, g) + (GEBAEUDE[g.typ].kampf ? 0 : 4); if (d < r && d < bd) { bd = d; best = g; } }
    return best;
  }
  /** Gebäude fängt Feuer */
  zuende(g: Geb, dauer = 8): void {
    if (g.typ === 'mauer' || g.schild > 0 || (g.brandSchutz || 0) > 0) return;
    if (this.erfindungen.has('loeschtrupp')) dauer /= 2;
    if (g.brand <= 0) this.ereignisse.push({ art: 'brand', geb: g });
    g.brand = Math.max(g.brand, dauer);
  }
  /** Brände: Schaden, Übergreifen auf Nachbarn, Ausgehen */
  private braende(): void {
    this.brandTakt += DT; const takt = this.brandTakt >= 1; if (takt) this.brandTakt = 0;
    for (const g of this.gebaeude) {
      if ((g.brandSchutz || 0) > 0) g.brandSchutz! -= DT;
      if (g.brand <= 0) continue;
      g.brand -= DT; if (g.brand <= 0) g.brandSchutz = 30;
      this.beschaedige(g, g.max * 0.008 * DT * (HOLZBAU.includes(g.typ) ? 1.5 : 1), true);
      if (takt && !this.erfindungen.has('loeschtrupp')) for (const o of this.gebaeude) {
        if (o === g || o.brand > 0 || o.typ === 'mauer') continue;
        if (this.randAbstand(o.x + o.w / 2, o.z + o.d / 2, g) - Math.max(o.w, o.d) / 2 < 1.5 && this.r() < (HOLZBAU.includes(o.typ) ? 0.1 : 0.04)) this.zuende(o, 6);
      }
    }
  }

  /** nächste Kachel, von der aus die Feste erreichbar ist */
  private erreichbarNahe(x: number, z: number): [number, number] | null {
    for (let r = 1; r <= 40; r++) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a / 16 * 6.283) * r, pz = z + Math.sin(a / 16 * 6.283) * r; if (this.feld.wert(px, pz) < Infinity) return [Math.floor(px) + 0.5, Math.floor(pz) + 0.5]; }
    return null;
  }
  private bewegeGegner(): void {
    const h = this.haupt; if (!h) return;
    const hx = h.x + h.w / 2, hz = h.z + h.d / 2;
    for (const e of this.gegner) {
      e.seit += DT;
      if (e.brand > 0) { e.brand -= DT; this.verletze(e, e.brandDps * DT, true); if (e.tot) continue; }
      if (e.langsam > 0) e.langsam -= DT;
      if (e.feuer > 0) e.feuer -= DT;
      e.nebenbei -= DT;
      const def = GEGNER[e.typ];
      if (def.heilt) for (const o of this.gegner) if (o !== e && !o.tot && o.hp < o.max && Math.abs(o.x - e.x) < 7 && Math.hypot(o.x - e.x, o.z - e.z) < 7) { o.hp = Math.min(o.max, o.hp + def.heilt * DT * staerke(this.nacht, 0.08)); if (this.r() < DT * 0.6) this.ereignisse.push({ art: 'heilung', x: o.x, y: o.y + 1.5, z: o.z }); }
      if (def.boss) {
        if (e.bossSchild > 0) e.bossSchild -= DT;
        e.ruf -= DT;
        if (e.ruf <= 0) { e.ruf = 12; for (let i = 0; i < 2 + Math.floor(this.nacht / 10) * 2; i++) this.erzeuge(i % 2 && this.nacht >= 10 ? 'wolf' : 'moorwicht', { x: e.x + (this.r() - 0.5) * 4, z: e.z + (this.r() - 0.5) * 4 }); this.ereignisse.push({ art: 'abwurf', x: e.x, y: e.y + 3, z: e.z }); }
        if (!e.schildGenutzt && e.hp < e.max * 0.5) { e.schildGenutzt = true; e.bossSchild = 6; this.melde('Der Rissfürst hüllt sich in einen Schild!', 'schlecht'); }
      }
      const tempo = e.tempo * (e.langsam > 0 ? 0.55 : 1);
      // Steinwerfer: bleibt stehen, sobald ein Gebäude in Wurfweite ist
      if (def.fern) {
        e.wurf -= DT;
        if (e.wurf <= 0) {
          const g = this.wurfZiel(e.x, e.z, def.fern);
          if (g) {
            e.wurf = 3; e.zielGeb = g.id; e.ruf--; const gx = g.x + g.w / 2, gz = g.z + g.d / 2, d = Math.hypot(gx - e.x, gz - e.z);
            this.geschosse.push({ art: 'stein', x: e.x, y: e.y + 2, z: e.z, sx: e.x, sy: e.y + 2, sz: e.z, tx: gx, ty: g.y + 3, tz: gz, t: 0, dauer: 0.6 + d / 18, ziel: 0, zielGeb: g.id, schaden: e.schaden, flaeche: 0, trifft: true, bogen: 4 + d * 0.3, brand: 0, brechend: false, von: 0 });
            e.richtung = Math.atan2(gx - e.x, gz - e.z);
          } else { e.wurf = 0.5; e.zielGeb = 0; }
        }
        // nach zehn Würfen rückt er weiter vor
        if (e.zielGeb && e.ruf > -10 && this.gebaeude.some((g) => g.id === e.zielGeb)) { e.stillstand = 0; e.angriff = 0.01; continue; }
      }
      // im Vorbeigehen: Gebäude in Reichweite schwächen, ohne stehen zu bleiben
      if (e.nebenbei <= 0) {
        e.nebenbei = e.flug ? 3.5 : 2.2;
        const g = this.gebNahe(e.x, e.z, e.flug ? 6 : 2);
        if (g && g.typ !== 'mauer' && g.typ !== 'haupt' && this.randAbstand(e.x, e.z, g) < (e.flug ? 6 : 1.8)) {
          let n = e.schaden * (e.flug ? 0.9 : 0.5);
          if (e.typ === 'drachling') { e.feuer = 1.3; if (this.erfindungen.has('schuppenpanzer')) n *= 0.5; const [gx, gz] = [g.x + g.w / 2, g.z + g.d / 2]; this.ereignisse.push({ art: 'feuer', x: e.x, y: e.y, z: e.z, tx: gx, ty: g.y + 4, tz: gz }); }
          if (e.typ === 'drachling' && this.r() < 0.25) this.zuende(g);
          if (e.typ !== 'rochen') this.beschaedige(g, n, false, e.typ + '-nebenbei');
        }
      }
      if (e.flug && def.wirtschaft) {
        // Aschegeist: tief über alles hinweg zum nächsten Hof, Haus oder zur Mine
        let g = this.gebaeude.find((o) => o.id === e.zielGeb);
        if (!g) { g = this.wirtschaftsZiel(e.x, e.z) || h; e.zielGeb = g.id; }
        const gx = g.x + g.w / 2, gz = g.z + g.d / 2, dx = gx - e.x, dz = gz - e.z, dist = Math.hypot(dx, dz);
        if (this.randAbstand(e.x, e.z, g) > 1.5) { e.x += (dx / dist) * tempo * DT; e.z += (dz / dist) * tempo * DT; e.richtung = Math.atan2(dx, dz); }
        else { this.schlage(e, g); e.stillstand += DT; if (e.stillstand > 20) { e.tot = true; this.ereignisse.push({ art: 'tod', typ: e.typ, x: e.x, y: e.y, z: e.z }); continue; } }
        e.y = hoehe(e.x, e.z) + 3.5 + Math.sin(e.seit * 3 + e.id) * 0.4;
        continue;
      }
      if (e.flug) {
        const dx = hx - e.x, dz = hz - e.z, dist = Math.hypot(dx, dz);
        if (e.fracht && dist < 18) { // Nebelrochen setzt Moorwichte hinter den Mauern ab
          for (let i = 0; i < e.fracht; i++) { this.erzeuge('moorwicht', { x: e.x + (this.r() - 0.5) * 2, z: e.z + (this.r() - 0.5) * 2 }); }
          this.ereignisse.push({ art: 'abwurf', x: e.x, y: e.y, z: e.z }); e.fracht = 0;
        }
        if (dist > 5) { e.x += (dx / dist) * tempo * DT; e.z += (dz / dist) * tempo * DT; e.richtung = Math.atan2(dx, dz); }
        else this.schlage(e, h);
        e.y = hoehe(e.x, e.z) + 9 + Math.sin(e.seit * 2 + e.id) * 0.6;
        continue;
      }
      // Fortschritt prüfen: wer lange nicht näher kommt und nichts angreift, verirrt sich
      const w = this.feld.wert(e.x, e.z);
      if (w < e.bester - 0.5) { e.bester = w; e.stillstand = 0; } else if (e.angriff === 0) e.stillstand += DT;
      if (e.stillstand > 25 || w === Infinity && e.seit > 8) {
        const p = w === Infinity ? this.erreichbarNahe(e.x, e.z) : null;
        if (p && e.stillstand < 40) { e.x = p[0]; e.z = p[1]; e.ziel = null; e.stillstand += 5; }
        else { e.tot = true; this.ereignisse.push({ art: 'tod', typ: e.typ, x: e.x, y: e.y, z: e.z }); continue; }
      }
      // am Ziel einer Kachel? dann nächste wählen
      if (!e.ziel || Math.hypot(e.ziel[0] - e.x, e.ziel[1] - e.z) < 0.25) e.ziel = this.feld.naechster(e.x, e.z);
      if (!e.ziel) { // am Hauptgebäude angekommen (oder eingeschlossen): nächstes Gebäude angreifen
        const g = this.gebNahe(e.x, e.z, 2) || h;
        if (this.randAbstand(e.x, e.z, g) < 2.2) this.schlage(e, g); continue;
      }
      const blocker = this.gebAn(e.ziel[0], e.ziel[1]);
      if (blocker && blocker.typ === 'mauer' && this.erfindungen.has('dornenwall')) this.verletze(e, 6 * DT, true);
      if (blocker) { this.schlage(e, blocker); e.richtung = Math.atan2(e.ziel[0] - e.x, e.ziel[1] - e.z); continue; }
      const dx = e.ziel[0] - e.x, dz = e.ziel[1] - e.z, dist = Math.hypot(dx, dz) || 1;
      const sp0 = spalte(Math.floor(e.x), Math.floor(e.z));
      const sp = tempo * DT * (sp0?.a === 'w' ? 0.5 : this.dekoJetzt(Math.floor(e.x), Math.floor(e.z), sp0)?.art === 'baum' ? 0.75 : 1);
      // seitlicher Versatz, damit nicht alle auf einer Linie laufen
      const nx = -dz / dist, nz = dx / dist;
      e.x += (dx / dist) * Math.min(sp, dist) + nx * e.versatz * DT * 0.6;
      e.z += (dz / dist) * Math.min(sp, dist) + nz * e.versatz * DT * 0.6;
      e.richtung = Math.atan2(dx, dz);
      e.y = hoehe(e.x, e.z); e.angriff = 0;
    }
    if (this.gegner.some((e) => e.tot)) this.gegner = this.gegner.filter((e) => !e.tot);
  }
  private gebNahe(x: number, z: number, r: number): Geb | undefined {
    let best: Geb | undefined, bd = Infinity;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { const g = this.gebAn(x + dx, z + dz); if (g) { const d = this.randAbstand(x, z, g); if (d < bd) { bd = d; best = g; } } }
    return best;
  }
  /** Abstand eines Punkts zum Rand eines Gebäudes (0 = innen) */
  randAbstand(x: number, z: number, g: Geb): number {
    const dx = Math.max(g.x - x, 0, x - (g.x + g.w)), dz = Math.max(g.z - z, 0, z - (g.z + g.d));
    return Math.hypot(dx, dz);
  }
  private schlage(e: Gegner, g: Geb): void {
    e.angriff += DT;
    if (e.angriff < 0.8) return;
    e.angriff = 0;
    let n = e.schaden * 0.8;
    if (e.typ === 'drachling') { e.feuer = 1.0; if (this.erfindungen.has('schuppenpanzer')) n *= 0.5; this.ereignisse.push({ art: 'feuer', x: e.x, y: e.y, z: e.z, tx: g.x + g.w / 2, ty: g.y + 3, tz: g.z + g.d / 2 }); if (this.r() < 0.35) this.zuende(g); }
    if (e.typ === 'aschegeist' && this.r() < 0.6 && g.brand <= 0 && !(g.brandSchutz! > 0)) {
      this.zuende(g); e.ruf--; e.zielGeb = 0;
      // nach drei Bränden zerfällt der Aschegeist
      if (e.ruf <= 0) { e.tot = true; this.ereignisse.push({ art: 'tod', typ: e.typ, x: e.x, y: e.y, z: e.z }); }
    }
    this.beschaedige(g, n, false, e.typ);
  }
  schadenVon: Record<string, number> = {};
  private beschaedige(g: Geb, n: number, leise = false, von = leise ? 'feuer' : '?'): void {
    this.schadenVon[von] = (this.schadenVon[von] || 0) + n;
    if (g.schild > 0 || !this.gebaeude.includes(g)) return;
    g.hp -= n; this.statSchaden += n;
    if (!leise) this.ereignisse.push({ art: 'schaden', geb: g });
    if (g.hp <= 0) {
      if (g.typ === 'haupt') { this.phase = 'verloren'; this.ereignisse.push({ art: 'phase', phase: 'verloren' }); this.melde(`Die Feste ist gefallen – nach ${this.nacht - 1} überstandenen Nächten.`, 'schlecht'); return; }
      this.entferne(g, true);
      if (g.typ !== 'mauer') this.statZerstoert.push(GEBAEUDE[g.typ].name);
      if (g.typ !== 'mauer') {
        const ru: Ruine = { id: this.naechsteId++, typ: g.typ, x: g.x, z: g.z, w: g.w, d: g.d, y: g.y, zweig: g.zweig };
        this.ruinen.push(ru); this.ereignisse.push({ art: 'ruine', ruine: ru, neu: true });
      }
      this.melde(`${GEBAEUDE[g.typ].name} wurde zerstört. Die Ruine lässt sich am Tag wieder aufbauen.`, 'schlecht');
    }
  }

  private ziele(g: Geb, k: Kampf, anzahl: number): { e: Gegner; hell: boolean }[] {
    const nacht = this.phase === 'nacht', runen = this.erfindungen.has('runenpfeile') && k.geschoss === 'pfeil';
    const tx = g.x + g.w / 2, tz = g.z + g.d / 2, liste: { e: Gegner; hell: boolean; prio: number }[] = [];
    for (const e of this.gegner) {
      if (e.tot || (k.nurBoden && e.flug)) continue;
      const d = Math.hypot(e.x - tx, e.z - tz); if (d > k.reichweite) continue;
      const l = this.licht(e.x, e.z), hell = !nacht || l.wert > 0.15;
      if (e.verborgen && nacht && !l.enthuellt && !runen && d > 4 && l.wert < 0.3) continue;
      if (!hell && d > k.reichweite * 0.6) continue;
      liste.push({ e, hell, prio: this.feld.wert(e.x, e.z) + d * 0.2 });
    }
    liste.sort((a, b) => a.prio - b.prio);
    return liste.slice(0, anzahl);
  }
  private tuerme(): void {
    for (const g of this.gebaeude) {
      // Scheinwerfer drehen sich und folgen dem nächsten Wesen
      const def = GEBAEUDE[g.typ];
      if (def.kegel) {
        let ziel: Gegner | null = null, bd = def.licht;
        for (const e of this.gegner) { const d = Math.hypot(e.x - g.x - 1, e.z - g.z - 1); if (d < bd) { bd = d; ziel = e; } }
        const soll = ziel ? Math.atan2(ziel.x - g.x - 1, ziel.z - g.z - 1) : g.zielen + 0.4 * DT;
        let da = soll - g.zielen; da = Math.atan2(Math.sin(da), Math.cos(da)); g.zielen += Math.max(-1.4 * DT, Math.min(1.4 * DT, da));
      }
      const k = this.kampf(g); if (!k || g.umbau) { g.strahlen.length = 0; continue; }
      const tx = g.x + g.w / 2, tz = g.z + g.d / 2;
      const sy = g.y + (g.typ === 'haupt' ? 14 : k.geschoss === 'pfeil' ? 10 : 12);
      // Dauerwaffen: Strahl und Sturmkrone wirken jeden Takt
      if (k.geschoss === 'strahl') {
        const z = this.ziele(g, k, k.ziele || 1); g.strahlen = z.map((t) => t.e.id);
        if (z.length) g.zielen = Math.atan2(z[0].e.x - tx, z[0].e.z - tz);
        for (const t of z) this.verletze(t.e, k.schaden * DT * (t.hell ? 1 : 0.6), true, g, 'strahl');
        continue;
      }
      if (k.geschoss === 'aura') {
        g.cd -= DT;
        let n = 0; for (const e of this.gegner) if (!e.tot && Math.hypot(e.x - tx, e.z - tz) < k.reichweite) { this.verletze(e, k.schaden * DT, true, g, 'blitz'); n++; }
        if (n && g.cd <= 0) { g.cd = 0.5; const pk: [number, number, number][] = [[tx, sy + 2, tz]]; const e = this.gegner.find((o) => !o.tot && Math.hypot(o.x - tx, o.z - tz) < k.reichweite); if (e) pk.push([e.x, e.y + 1, e.z]); this.ereignisse.push({ art: 'blitz', punkte: pk }); }
        continue;
      }
      g.cd -= DT; if (g.cd > 0) continue;
      const z = this.ziele(g, k, k.ziele || 1); if (!z.length) continue;
      g.cd = k.abklingen; g.zielen = Math.atan2(z[0].e.x - tx, z[0].e.z - tz);
      this.ereignisse.push({ art: 'schuss', geb: g, x: tx, y: sy, z: tz, geschoss: k.geschoss === 'topf' ? 'topf' : 'pfeil' });
      if (k.geschoss === 'blitz') {
        const pk: [number, number, number][] = [[tx, sy + 2, tz]], getroffen = new Set<number>();
        let aktuell: Gegner | undefined = z[0].e;
        for (let i = 0; aktuell && i <= (k.kette || 0); i++) {
          getroffen.add(aktuell.id); pk.push([aktuell.x, aktuell.y + 1, aktuell.z]); this.verletze(aktuell, k.schaden * Math.pow(0.85, i), true, g, 'blitz');
          let naechst: Gegner | undefined, bd = 7;
          for (const e of this.gegner) { if (e.tot || getroffen.has(e.id)) continue; const d = Math.hypot(e.x - aktuell.x, e.z - aktuell.z); if (d < bd) { bd = d; naechst = e; } }
          aktuell = naechst;
        }
        this.ereignisse.push({ art: 'blitz', punkte: pk });
        continue;
      }
      for (const { e: best, hell } of z) {
        if (k.geschoss === 'pfeil') {
          const d = Math.hypot(best.x - tx, best.z - tz);
          this.geschosse.push({ art: 'pfeil', x: tx, y: sy, z: tz, sx: tx, sy, sz: tz, tx: best.x, ty: best.y + (best.flug ? 0 : 1), tz: best.z, t: 0, dauer: d / 30 + 0.05, ziel: best.id, schaden: k.schaden, flaeche: k.flaeche || 0, trifft: this.r() > (hell ? 0.05 : 0.38), bogen: d * 0.06, brand: k.brand || 0, brechend: !!k.panzerbrechend, von: g.id });
        } else {
          for (let s = 0; s < (k.salve || 1); s++) {
            const dauer = 1.25, vx = best.ziel ? (best.ziel[0] - best.x) : 0, vz = best.ziel ? (best.ziel[1] - best.z) : 0, vl = Math.hypot(vx, vz) || 1;
            const px = best.x + (vx / vl) * best.tempo * dauer, pz = best.z + (vz / vl) * best.tempo * dauer;
            const streu = (hell ? 0.6 : 2.2) + (k.salve ? 3 : 0);
            const zx = px + (this.r() - 0.5) * streu, zz = pz + (this.r() - 0.5) * streu;
            this.geschosse.push({ art: 'topf', x: tx, y: sy, z: tz, sx: tx, sy, sz: tz, tx: zx, ty: hoehe(zx, zz), tz: zz, t: -s * 0.12, dauer, ziel: 0, schaden: k.schaden, flaeche: k.flaeche!, trifft: true, bogen: 6 + Math.hypot(zx - tx, zz - tz) * 0.25, brand: k.brand || 0, brechend: !!k.panzerbrechend, von: g.id });
          }
        }
      }
    }
  }
  private bewegeGeschosse(): void {
    for (const p of this.geschosse) {
      p.t += DT; if (p.t < 0) continue;
      if (p.art === 'pfeil' && p.ziel) { const z = this.gegner.find((e) => e.id === p.ziel); if (z) { p.tx = z.x; p.ty = z.y + (z.flug ? 0 : 1); p.tz = z.z; } }
      const f = Math.min(1, p.t / p.dauer);
      p.x = p.sx + (p.tx - p.sx) * f; p.z = p.sz + (p.tz - p.sz) * f; p.y = p.sy + (p.ty - p.sy) * f + Math.sin(Math.PI * f) * p.bogen;
      if (f < 1) continue;
      const von = p.von ? this.gebaeude.find((g) => g.id === p.von) : undefined, brandZeit = this.erfindungen.has('brandoel') ? 5 : 3;
      if (p.art === 'stein') {
        const g = this.gebaeude.find((o) => o.id === p.zielGeb);
        this.ereignisse.push({ art: 'explosion', x: p.tx, y: p.ty, z: p.tz, r: 1 });
        if (g) this.beschaedige(g, p.schaden, false, 'steinwerfer');
      } else if (p.art === 'pfeil') {
        const z = this.gegner.find((e) => e.id === p.ziel);
        if (z && p.trifft) {
          this.ereignisse.push({ art: 'treffer', x: z.x, y: z.y + 1, z: z.z }); this.verletze(z, p.schaden, p.brechend, von, 'pfeil');
          if (p.brand) { z.brand = brandZeit; z.brandDps = p.brand; }
          if (z.flug && this.erfindungen.has('fangnetz')) z.langsam = 2.5;
          if (p.flaeche) for (const e of this.gegner) if (e !== z && !e.flug && Math.hypot(e.x - z.x, e.z - z.z) < p.flaeche) { e.brand = brandZeit; e.brandDps = p.brand || 4; }
        } else this.ereignisse.push({ art: 'fehl', x: p.tx, y: p.ty, z: p.tz });
      } else {
        this.ereignisse.push({ art: 'explosion', x: p.tx, y: p.ty, z: p.tz, r: p.flaeche });
        for (const e of this.gegner) { if ((e.flug && !GEGNER[e.typ].wirtschaft) || e.tot) continue; const d = Math.hypot(e.x - p.tx, e.z - p.tz); if (d < p.flaeche) { this.verletze(e, p.schaden * (1 - d / p.flaeche * 0.6), p.brechend, von, 'topf'); if (p.brand) { e.brand = brandZeit; e.brandDps = p.brand; } } }
      }
      p.dauer = -1;
    }
    this.geschosse = this.geschosse.filter((p) => p.dauer > 0);
  }
  private verletze(e: Gegner, n: number, brechend = false, von?: Geb, art?: 'pfeil' | 'topf' | 'strahl' | 'blitz'): void {
    if (e.tot || e.bossSchild > 0) return;
    const def = GEGNER[e.typ], E = this.erfindungen;
    if (def.schild && (art === 'pfeil' || art === 'topf') && !E.has('himmelsschmiede')) n *= def.schild;
    if (e.panzer && !brechend && !E.has('himmelsschmiede')) n *= 0.4;
    if (e.brand > 0 && E.has('brandoel')) n *= 1.5;
    const echt = Math.min(n, Math.max(0, e.hp));
    e.hp -= n; if (von) von.leistung += echt;
    if (e.hp > 0) return;
    e.tot = true; this.besiegt++; this.statBesiegt++;
    const d = GEGNER[e.typ];
    this.ereignisse.push({ art: 'tod', typ: e.typ, x: e.x, y: e.y, z: e.z });
    const kr = d.kristall * (0.6 + this.r() * 0.8) * (e.panzer ? 2 : 1);
    this.res.kristall += kr; this.beuteNacht.kristall = (this.beuteNacht.kristall || 0) + kr;
    for (const [b, p, anzahl] of d.beute) if (this.r() < p) { const k = anzahl || 1; this.bausteine[b] += k; this.beuteNacht[b] = (this.beuteNacht[b] || 0) + k; }
    if (d.boss) this.melde('Der Rissfürst ist gefallen! Reiche Beute bleibt zurück.', 'gut');
  }

  // ---------------- Umrüsten, Verschmelzen, Ausbau, Ruinen, Fähigkeiten ----------------
  umruestOptionen(g: Geb): GebTyp[] { return (Object.keys(GEBAEUDE) as GebTyp[]).filter((t) => GEBAEUDE[t].von === g.typ); }
  umruesten(g: Geb, nach: GebTyp, zweig?: string): boolean {
    const d = GEBAEUDE[nach];
    if (this.phase !== 'tag') { this.melde('Umgerüstet wird nur am Tag.', 'schlecht'); return false; }
    if (d.von !== g.typ || g.umbau) return false;
    if (!this.freigeschaltet(nach)) { this.melde(`${d.name} braucht die Erfindung ${ERFINDUNGEN[d.braucht!].name}.`, 'schlecht'); return false; }
    if (d.zweige && !d.zweige.some((z) => z.id === zweig)) return false;
    if (!this.kannBezahlen(d.kosten)) { this.melde(`Für ${d.name} fehlen Rohstoffe: ${kostenText(d.kosten)}.`, 'schlecht'); return false; }
    for (const [r, n] of Object.entries(d.kosten)) this.res[r as Res] -= n as number;
    g.umbau = { t: 0, dauer: UMBAU_DAUER, nach, zweig }; g.rep = undefined;
    this.ereignisse.push({ art: 'reparatur', geb: g, fertig: false });
    return true;
  }
  /** benachbarte Türme, mit denen g verschmelzen kann */
  verschmelzOptionen(g: Geb): { partner: Geb; ergebnis: GebTyp }[] {
    const la = linie(g.typ); if (!la || GEBAEUDE[g.typ].fusion) return [];
    const out: { partner: Geb; ergebnis: GebTyp }[] = [];
    for (const o of this.gebaeude) {
      if (o === g || GEBAEUDE[o.typ].fusion) continue;
      const lb = linie(o.typ); if (!lb) continue;
      if (Math.hypot(o.x + o.w / 2 - g.x - g.w / 2, o.z + o.d / 2 - g.z - g.d / 2) > 8.5) continue;
      const v = VERSCHMELZUNGEN.find((v) => (v.a === la && v.b === lb) || (v.a === lb && v.b === la)); if (!v) continue;
      if (this.zeitalter() < (GEBAEUDE[v.ergebnis].zeitalter || 1)) continue;
      out.push({ partner: o, ergebnis: v.ergebnis });
    }
    return out;
  }
  verschmelzen(g: Geb, partner: Geb): boolean {
    const opt = this.verschmelzOptionen(g).find((o) => o.partner === partner); if (!opt) return false;
    if (this.phase !== 'tag') { this.melde('Verschmolzen wird nur am Tag.', 'schlecht'); return false; }
    const d = GEBAEUDE[opt.ergebnis];
    // Fernkampf-Turm bleibt stehen, der Partner geht in ihm auf
    let ziel = g, weg = partner;
    if (linie(g.typ) !== 'fern' && linie(partner.typ) === 'fern') { ziel = partner; weg = g; }
    if (d.w !== ziel.w) { this.melde('Diese beiden passen nicht zusammen.', 'schlecht'); return false; }
    if (!this.kannBezahlen(d.kosten)) { this.melde(`Für ${d.name} fehlen Rohstoffe: ${kostenText(d.kosten)}.`, 'schlecht'); return false; }
    for (const [r, n] of Object.entries(d.kosten)) this.res[r as Res] -= n as number;
    this.entferne(weg, false);
    ziel.umbau = { t: 0, dauer: UMBAU_DAUER, nach: opt.ergebnis };
    if (!this.entdeckt.has(opt.ergebnis)) { this.entdeckt.add(opt.ergebnis); this.melde(`Neue Verbindung entdeckt: ${d.name}. Sie steht jetzt im Rezeptbuch.`, 'gut'); }
    this.ereignisse.push({ art: 'reparatur', geb: ziel, fertig: false });
    return true;
  }
  hauptAusbau(): typeof HAUPT_STUFEN[number] | undefined { const h = this.haupt; return h ? HAUPT_STUFEN[h.stufe] : undefined; }
  hauptAusbauen(): boolean {
    const h = this.haupt, st = this.hauptAusbau(); if (!h || !st) return false;
    if (this.phase !== 'tag') { this.melde('Ausgebaut wird nur am Tag.', 'schlecht'); return false; }
    if (h.umbau) return false;
    if (st.braucht && !this.erfindungen.has(st.braucht)) { this.melde(`Stufe ${st.stufe} braucht die Erfindung ${ERFINDUNGEN[st.braucht].name}.`, 'schlecht'); return false; }
    if (!this.kannBezahlen(st.kosten)) { this.melde(`Für Stufe ${st.stufe} fehlen Rohstoffe: ${kostenText(st.kosten)}.`, 'schlecht'); return false; }
    for (const [r, n] of Object.entries(st.kosten)) this.res[r as Res] -= n as number;
    h.umbau = { t: 0, dauer: UMBAU_DAUER * 1.5, nach: 'haupt', stufe: st.stufe }; h.rep = undefined;
    this.ereignisse.push({ art: 'reparatur', geb: h, fertig: false });
    return true;
  }
  faehigkeiten(): string[] { const h = this.haupt; return h ? HAUPT_STUFEN.slice(1, h.stufe).map((s) => s.faehigkeit) : []; }
  /** Fähigkeit in dieser Nacht noch nutzbar? (Runenglocke: zweimal) */
  faehigkeitFrei(name: string): boolean { return (this.genutzt.get(name) || 0) < (this.erfindungen.has('runenglocke') ? 2 : 1); }
  faehigkeit(name: string, x = 0, z = 0): boolean {
    const h = this.haupt; if (!h || this.phase !== 'nacht' || !this.faehigkeiten().includes(name)) return false;
    if (!this.faehigkeitFrei(name)) { this.melde('Diese Fähigkeit ist in dieser Nacht schon verbraucht.', 'schlecht'); return false; }
    this.genutzt.set(name, (this.genutzt.get(name) || 0) + 1);
    const hx = h.x + h.w / 2, hz = h.z + h.d / 2;
    if (name === 'feuerregen') for (let i = 0; i < 8; i++) { const a = this.r() * 6.283, d = Math.sqrt(this.r()) * 5, zx = x + Math.cos(a) * d, zz = z + Math.sin(a) * d; this.geschosse.push({ art: 'topf', x: hx, y: h.y + 20, z: hz, sx: hx, sy: h.y + 20, sz: hz, tx: zx, ty: hoehe(zx, zz), tz: zz, t: -i * 0.15, dauer: 1.6, ziel: 0, schaden: 45, flaeche: 3, trifft: true, bogen: 14, brand: 6, brechend: true, von: 0 }); }
    if (name === 'notreparatur') for (const g of this.gebaeude) g.hp = Math.min(g.max, g.hp + g.max / 3);
    if (name === 'schild') h.schild = this.erfindungen.has('aetherspeicher') ? 25 : 15;
    if (name === 'sturmglocke') this.sturm = 12;
    if (name === 'dampfstoss') for (const e of this.gegner) {
      const dx = e.x - hx, dz = e.z - hz, d = Math.hypot(dx, dz); if (d > 20 || e.tot) continue;
      if (!e.flug) { const nx = e.x + (dx / (d || 1)) * 8, nz = e.z + (dz / (d || 1)) * 8; if (begehbar(spalte(Math.floor(nx), Math.floor(nz))) && !this.gebAn(nx, nz)) { e.x = nx; e.z = nz; e.y = hoehe(nx, nz); e.ziel = null; } }
      e.langsam = 4; this.verletze(e, 40, true);
    }
    this.ereignisse.push({ art: 'faehigkeit', name, x, z });
    return true;
  }
  wiederaufbauKosten(r: Ruine): Kosten { const k: Kosten = {}; for (const [res, n] of Object.entries(GEBAEUDE[r.typ].kosten)) k[res as Res] = Math.ceil((n as number) * 0.5); return k; }
  wiederaufbauen(r: Ruine): boolean {
    if (this.phase !== 'tag') { this.melde('Wiederaufgebaut wird nur am Tag.', 'schlecht'); return false; }
    if (GEBAEUDE[r.typ].kampf && this.turmZahl() >= this.turmGrenze()) { this.melde(`Turmgrenze erreicht (${this.turmGrenze()}). Baue die Burg aus.`, 'schlecht'); return false; }
    const k = this.wiederaufbauKosten(r);
    if (!this.kannBezahlen(k)) { this.melde(`Für den Wiederaufbau fehlen Rohstoffe: ${kostenText(k)}.`, 'schlecht'); return false; }
    for (const [res, n] of Object.entries(k)) this.res[res as Res] -= n as number;
    this.ruinen = this.ruinen.filter((o) => o !== r); this.ereignisse.push({ art: 'ruine', ruine: r, neu: false });
    const g = this.setze(r.typ, r.x, r.z); g.zweig = r.zweig;
    return true;
  }
  raeumen(r: Ruine): void { this.ruinen = this.ruinen.filter((o) => o !== r); this.ereignisse.push({ art: 'ruine', ruine: r, neu: false }); }

  // ---------------- Gebäude intern ----------------
  private setze(typ: GebTyp, x0: number, z0: number, hp?: number): Geb {
    const def = GEBAEUDE[typ];
    const p = this.pruefeRoh(typ, x0, z0);
    const max = this.grundHp({ typ, stufe: 1 });
    const g: Geb = { id: this.naechsteId++, typ, x: x0, z: z0, w: def.w, d: def.d, y: p, hp: hp ?? max, max, cd: 0, quellen: this.quellenZahl(typ, x0, z0), zielen: 0, stufe: 1, strahlen: [], schild: 0, brand: 0, kraft: true, leistung: 0 };
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) this.belegt[this.bi(x, z)] = g.id;
    this.gebaeude.push(g);
    if (def.arbeit && !this.laedt) this.verteileArbeiter();
    // auf einem Stumpf gebaut: dort wächst nichts mehr nach
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) { const k = Spiel.kachel(x, z); if (this.gefaellt.has(k)) this.gefaellt.set(k, -2e9); }
    if (def.sicht) this.aufdecken(x0 + def.w / 2, z0 + def.d / 2, def.sicht);
    this.feldAlt = true; this.lichterNeu(); this.quellVersion++;
    this.ereignisse.push({ art: 'gebaut', geb: g });
    return g;
  }
  private pruefeRoh(typ: GebTyp, x0: number, z0: number): number {
    const def = GEBAEUDE[typ]; let hi = 0;
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) hi = Math.max(hi, spalte(x, z)?.h ?? 6);
    return hi + 1;
  }
  private entferne(g: Geb, zerstoert: boolean): void {
    for (let x = g.x; x < g.x + g.w; x++) for (let z = g.z; z < g.z + g.d; z++) this.belegt[this.bi(x, z)] = 0;
    this.gebaeude = this.gebaeude.filter((o) => o !== g);
    for (const a of this.arbeiter) if (a.geb === g.id && a.quelle >= 0) this.reserviert.delete(a.quelle);
    this.arbeiter = this.arbeiter.filter((a) => a.geb !== g.id);
    if (GEBAEUDE[g.typ].arbeit) this.verteileArbeiter();
    this.feldAlt = true; this.lichterNeu(); this.quellVersion++;
    this.ereignisse.push({ art: 'weg', geb: g, zerstoert });
  }
  /** Wie viele Rohstoffquellen liegen in Reichweite? (Anzeige) */
  quellenZahl(typ: GebTyp, x0: number, z0: number): number {
    const def = GEBAEUDE[typ]; if (!def.arbeit) return 0;
    const g = this.gebaeude.find((o) => o.x === x0 && o.z === z0 && o.typ === typ);
    return this.quellen(typ, x0 + def.w / 2, z0 + def.d / 2, this.arbeit({ typ, stufe: g?.stufe || 1 })!.radius, false).length;
  }
  /** Rohstoffquellen um (cx, cz), nach Abstand sortiert */
  private quellVersion = 0;
  private quellCache = new Map<string, { v: number; liste: { x: number; z: number; k: number; d: number; dauerhaft: boolean }[] }>();
  private quellen(typ: GebTyp, cx: number, cz: number, r: number, frei: boolean): { x: number; z: number; k: number; d: number; dauerhaft: boolean }[] {
    const key = `${typ}|${cx}|${cz}|${r}`; let c = this.quellCache.get(key);
    if (!c || c.v !== this.quellVersion) {
      if (this.quellCache.size > 400) this.quellCache.clear();
      c = { v: this.quellVersion, liste: this.quellenRoh(typ, cx, cz, r) }; this.quellCache.set(key, c);
    }
    return frei ? c.liste.filter((q) => q.k < 0 || !this.reserviert.has(q.k)) : c.liste;
  }
  private quellenRoh(typ: GebTyp, cx: number, cz: number, r: number): { x: number; z: number; k: number; d: number; dauerhaft: boolean }[] {
    const out: { x: number; z: number; k: number; d: number; dauerhaft: boolean }[] = [];
    if (typ === 'kristall') {
      for (const o of orte()) if (o.typ === 'kristall' && Math.hypot(o.x - cx, o.z - cz) < r + 4) for (const [dx, dz] of [[-2, 0], [2, 1], [0, 2], [1, -2]]) out.push({ x: o.x + dx + 0.5, z: o.z + dz + 0.5, k: -1, d: Math.hypot(o.x + dx - cx, o.z + dz - cz), dauerhaft: true });
      return out.sort((a, b) => a.d - b.d);
    }
    if (typ === 'hof') { // Felder rund um den Hof: jede freie Graskachel im Umkreis
      for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz); if (d > r || d < 3.5) continue;
        const s = spalte(x, z); if (!s || s.a !== 'gras' || this.belegt[this.bi(x, z)] || amPfad(x, z, 1.5)) continue;
        const dk = this.dekoJetzt(x, z, s); if (dk && dk.art !== 'gras') continue;
        if ((x + z * 3) % 4) continue; // jede vierte Kachel: Furchen
        out.push({ x: x + 0.5, z: z + 0.5, k: -1, d, dauerhaft: true });
      }
      return out.sort((a, b) => a.d - b.d);
    }
    if (typ === 'fischer') { // Wasser mit Ufer daneben
      for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz); if (d > r) continue;
        const s = spalte(x, z); if (!s || s.a !== 'w' || (x + z) % 3) continue;
        if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => begehbar(spalte(x + dx, z + dz)))) continue;
        out.push({ x: x + 0.5, z: z + 0.5, k: -1, d, dauerhaft: true });
      }
      return out.sort((a, b) => a.d - b.d);
    }
    for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz); if (d > r) continue;
      const s = spalte(x, z); if (!s) continue;
      const k = Spiel.kachel(x, z);
      const dk = this.dekoJetzt(x, z, s);
      if (typ === 'holz' && dk?.art === 'baum') out.push({ x: x + 0.5, z: z + 0.5, k, d, dauerhaft: false });
      if (typ === 'stein' && dk?.art === 'fels') out.push({ x: x + 0.5, z: z + 0.5, k, d, dauerhaft: false });
      if (typ === 'stein' && (s.a === 'fels' || s.a === 'schnee') && !this.gebAn(x, z)) out.push({ x: x + 0.5, z: z + 0.5, k: -1, d: d + 6, dauerhaft: true });
    }
    return out.sort((a, b) => a.d - b.d);
  }
  /** Arbeiter: hin zur Quelle, arbeiten, Rohstoff zurücktragen; nachts ins Haus */
  private arbeiterSchritt(): void {
    const tag = this.phase === 'tag';
    for (const a of this.arbeiter) {
      const g = this.gebaeude.find((o) => o.id === a.geb); if (!g) continue;
      const arb = this.arbeit(g)!;
      const hx = g.x + g.w / 2, hz = g.z + g.d + 0.6;
      const gehe = (zx: number, zz: number, tempo: number): boolean => {
        const dx = zx - a.x, dz = zz - a.z, d = Math.hypot(dx, dz);
        if (d < 0.6) return true;
        const sp = Math.min(d, tempo * DT); a.x += (dx / d) * sp; a.z += (dz / d) * sp; a.richtung = Math.atan2(dx, dz); a.y = hoehe(a.x, a.z);
        return false;
      };
      if (!tag) { if (a.zustand !== 'drin') { if (a.quelle >= 0) { this.reserviert.delete(a.quelle); a.quelle = -1; } a.traegt = null; a.zustand = gehe(hx, hz, 3.2) ? 'drin' : 'heim'; } continue; }
      if (a.zustand === 'drin' || a.zustand === 'heim') a.zustand = 'warten';
      if (a.zustand === 'warten') {
        a.ruhe -= DT; if (a.ruhe > 0) { gehe(hx, hz, 2); continue; }
        // nächste freie Quelle im Umkreis, sonst weiter draußen (längere Wege)
        const qs = this.quellen(g.typ, hx, g.z + g.d / 2, arb.radius, true);
        // Höfe und Fischer verteilen sich auf ihre Plätze, statt alle auf denselben zu gehen
        const q = (qs.length && (g.typ === 'hof' || g.typ === 'fischer') ? qs[Math.floor(this.r() * Math.min(qs.length, 12))] : qs[0]) || this.quellen(g.typ, hx, g.z + g.d / 2, arb.radius * 1.6, true)[0];
        if (!q) { a.ruhe = 3; continue; }
        a.ziel = [q.x, q.z]; a.quelle = q.k; if (q.k >= 0) this.reserviert.add(q.k); a.zustand = 'hin';
      } else if (a.zustand === 'hin') {
        // nicht ganz auf die Kachel, sondern daneben stehen
        const [zx, zz] = a.ziel!, dx = a.x - zx, dz = a.z - zz, d = Math.hypot(dx, dz) || 1;
        if (gehe(zx + (dx / d) * 0.9, zz + (dz / d) * 0.9, 3.2)) { a.zustand = 'arbeit'; a.t = 0; a.richtung = Math.atan2(zx - a.x, zz - a.z); }
      } else if (a.zustand === 'arbeit') {
        const vor = a.t; a.t += DT;
        if (Math.floor(vor / 0.7) !== Math.floor(a.t / 0.7)) this.ereignisse.push({ art: 'hieb', x: a.ziel![0], y: a.y + 1, z: a.ziel![1], res: arb.res });
        if (a.t >= arb.dauer) {
          if (a.quelle >= 0) {
            const x = Math.floor(a.ziel![0]), z = Math.floor(a.ziel![1]);
            let weg = false;
            if (arb.res === 'holz') { const n = (this.gaenge.get(a.quelle) || 0) + 1; if (n >= BAUM_GAENGE) { this.gaenge.delete(a.quelle); this.gefaellt.set(a.quelle, this.nacht); weg = true; } else this.gaenge.set(a.quelle, n); }
            else { const n = (this.abgebaut.get(a.quelle) || 0) + 1; this.abgebaut.set(a.quelle, n); weg = n >= FELS_GAENGE; }
            if (weg) { this.ereignisse.push({ art: 'deko', x, z }); this.feldAlt = true; this.quellVersion++; this.grundAlt.push([x, z]); }
            this.reserviert.delete(a.quelle); a.quelle = -1;
          }
          a.traegt = arb.res; a.zustand = 'zurueck';
        }
      } else if (a.zustand === 'zurueck') {
        if (gehe(hx, hz, 3.0)) {
          const menge = arb.menge;
          this.res[arb.res] += menge; this.ereignisse.push({ art: 'abgeliefert', x: a.x, y: a.y, z: a.z, res: arb.res, menge });
          a.traegt = null; a.zustand = 'warten'; a.ruhe = 0.6; if (this.r() < 0.2) g.quellen = this.quellenZahl(g.typ, g.x, g.z);
        }
      }
    }
  }
  // ---------------- Gelände ebnen ----------------
  /** Fläche (x0,z0)–(x1,z1) auf die Höhe der Startkachel bringen: Kosten, Gründe */
  ebnenPruefen(x0: number, z0: number, x1: number, z1: number, zielH?: number): { ok: boolean; grund?: string; stein: number; ziel: number; kacheln: number } {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
    const start = spalte(x0, z0); const ziel = zielH ?? (start ? start.h : 6);
    if (bx - ax + 1 > EBNEN_MAX || bz - az + 1 > EBNEN_MAX) return { ok: false, grund: `Höchstens ${EBNEN_MAX} × ${EBNEN_MAX} Blöcke auf einmal.`, stein: 0, ziel, kacheln: 0 };
    let stein = 0, kacheln = 0;
    for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) {
      const s = spalte(x, z);
      if (!s) return { ok: false, grund: 'Hier ist kein Land.', stein, ziel, kacheln };
      if (!this.erkundetAn(x, z)) return { ok: false, grund: 'Noch im Nebel.', stein, ziel, kacheln };
      if (s.a === 'w' || s.a === 'l') return { ok: false, grund: 'Wasser und Lava lassen sich nicht ebnen.', stein, ziel, kacheln };
      if (this.belegt[this.bi(x, z)]) return { ok: false, grund: 'Auf der Fläche steht ein Gebäude.', stein, ziel, kacheln };
      const d = Math.abs(s.h - ziel); if (d) { stein += d * EBNEN_STEIN; kacheln++; }
    }
    if (!kacheln) return { ok: false, grund: 'Die Fläche ist schon eben.', stein: 0, ziel, kacheln };
    if (ziel >= 14) return { ok: false, grund: 'Zu hoch: oben auf den Bergen lässt sich nicht bauen.', stein, ziel, kacheln };
    if (this.res.stein < stein) return { ok: false, grund: `Nicht genug Stein (${stein} nötig).`, stein, ziel, kacheln };
    return { ok: true, stein, ziel, kacheln };
  }
  ebnen(x0: number, z0: number, x1: number, z1: number): boolean {
    if (this.phase === 'verloren') return false;
    const p = this.ebnenPruefen(x0, z0, x1, z1);
    if (!p.ok) { this.melde(p.grund!, 'schlecht'); return false; }
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
    this.res.stein -= p.stein;
    for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) {
      const s = spalte(x, z)!; if (s.h !== p.ziel) setzeHoehe(x, z, p.ziel);
      const dk = deko(x, z, s), k = Spiel.kachel(x, z);
      if (dk?.art === 'baum') { this.gefaellt.set(k, -2e9); this.gaenge.delete(k); }
      if (dk?.art === 'fels') this.abgebaut.set(k, 99);
    }
    this.feldAlt = true; this.quellVersion++; this.grund = null;
    for (const a of this.arbeiter) a.y = hoehe(a.x, a.z);
    this.ereignisse.push({ art: 'gelaende', x0: ax, z0: az, x1: bx, z1: bz });
    this.melde(`Gelände geebnet: ${p.kacheln} Blöcke, ${p.stein} Stein.`, 'gut');
    return true;
  }
  // ---------------- Reparieren ----------------
  reparaturKosten(g: Geb): Kosten {
    const def = GEBAEUDE[g.typ], basis = def.reparatur || Object.fromEntries(Object.entries(def.kosten).map(([r, n]) => [r, (n as number) * 0.5])), f = Math.max(0, 1 - g.hp / g.max);
    const k: Kosten = {}; for (const [r, n] of Object.entries(basis)) { const v = Math.ceil((n as number) * f); if (v > 0) k[r as Res] = v; }
    return k;
  }
  reparieren(g: Geb, still = false): boolean {
    if (this.phase !== 'tag') { if (!still) this.melde('Repariert wird nur am Tag.', 'schlecht'); return false; }
    if (g.rep || g.hp >= g.max - 0.5) return false;
    const k = this.reparaturKosten(g);
    if (!this.kannBezahlen(k)) { if (!still) this.melde(`Für die Reparatur fehlen Rohstoffe: ${kostenText(k)}.`, 'schlecht'); return false; }
    for (const [r, n] of Object.entries(k)) this.res[r as Res] -= n as number;
    const f = 1 - g.hp / g.max; g.rep = { t: 0, dauer: 3 + 10 * f, von: g.hp };
    this.ereignisse.push({ art: 'reparatur', geb: g, fertig: false });
    return true;
  }
  beschaedigt(): Geb[] { return this.gebaeude.filter((g) => !g.rep && g.hp < g.max - 0.5); }
  alleReparaturKosten(): Kosten { const k: Kosten = {}; for (const g of this.beschaedigt()) for (const [r, n] of Object.entries(this.reparaturKosten(g))) k[r as Res] = (k[r as Res] || 0) + (n as number); return k; }
  alleReparieren(): number { let n = 0; for (const g of this.beschaedigt().sort((a, b) => (a.typ === 'haupt' ? -1 : 0) - (b.typ === 'haupt' ? -1 : 0))) if (this.reparieren(g, true)) n++; if (!n) this.melde(this.phase !== 'tag' ? 'Repariert wird nur am Tag.' : 'Nichts zu reparieren oder nicht genug Rohstoffe.', 'schlecht'); return n; }
  // ---------------- Weg der Welle ----------------
  /** Wege der Wesen von den aktiven Rissen zur Feste (für die Vorschau) */
  wegVorschau(): [number, number][][] {
    if (this.feldAlt) this.feldNeu();
    if (this.wegCache && this.wegCache.version === this.feldVersion) return this.wegCache.wege;
    const wege: [number, number][][] = [];
    for (const r of this.offeneRisse()) {
      const w: [number, number][] = []; let p: [number, number] | null = [r.x + 0.5, r.z + 0.5];
      for (let i = 0; i < 900 && p; i++) { w.push(p); p = this.feld.naechster(p[0], p[1]); }
      wege.push(w);
    }
    this.wegCache = { version: this.feldVersion, wege };
    return wege;
  }
  /** freien Bauplatz für typ nahe (x, z) suchen (spiralförmig) */
  findePlatz(typ: GebTyp, x: number, z: number, r: number): [number, number] | null {
    let best: [number, number] | null = null, bestWert = -1;
    const schritt = r > 12 ? 2 : 1;
    for (let d = 0; d <= r; d += schritt) for (let dx = -d; dx <= d; dx += schritt) for (const dz of [-d, d]) for (const [ax, az] of [[dx, dz], [dz, dx]]) {
      const x0 = x + ax, z0 = z + az; if (!this.pruefe(typ, x0, z0).ok) continue;
      const w = this.quellenZahl(typ, x0, z0) - d * 0.2; if (w > bestWert) { bestWert = w; best = [x0, z0]; }
    }
    return best;
  }
  private lichterNeu(): void {
    const E = this.erfindungen, plus = (E.has('sternenstaub') ? 4 : 0) + (E.has('prismenlinse') ? 4 : 0);
    this.lichter = this.gebaeude.filter((g) => GEBAEUDE[g.typ].licht > 0).map((g) => {
      const d = GEBAEUDE[g.typ], st = g.typ === 'haupt' ? HAUPT_STUFEN[g.stufe - 1] : null, gross = d.licht > 6 || g.typ === 'haupt';
      const r = (st ? st.licht : d.licht + (gross ? STUFE_WERT.licht[g.stufe] : 0)) + (gross ? plus + (E.has('spiegelschliff') ? 3 : 0) : 0);
      return { x: g.x + g.w / 2, z: g.z + g.d / 2, r, enthuellt: !!d.enthuellt || (g.typ === 'haupt' && g.stufe >= 5) || (gross && E.has('prismenlinse')), kegel: d.kegel ? d.kegel * (E.has('spiegelschliff') ? 1.35 : 1) : undefined, geb: d.kegel ? g : undefined };
    });
  }
  private feldNeu(): void {
    this.feldAlt = false; this.feldVersion++;
    const h = this.haupt; if (!h) return;
    // Grundkosten des Geländes zwischenspeichern, nur geänderte Kacheln neu rechnen
    const F = this.feld, W = F.w, D = F.d;
    const grundK = (x: number, z: number) => {
      const s = spalte(x, z); if (!s || s.a === 'l' || s.h >= 14) return Infinity;
      if (s.a === 'w') return 3.5;
      return amPfad(x, z, 1.5) ? 0.75 : this.dekoJetzt(x, z, s)?.art === 'baum' ? 1.6 : 1;
    };
    if (!this.grund) { this.grund = new Float32Array(W * D); for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) this.grund[j * W + i] = grundK(F.x0 + i, F.z0 + j); }
    else for (const [x, z] of this.grundAlt) { const i = F.idx(x, z); if (i >= 0) this.grund[i] = grundK(x, z); }
    this.grundAlt.length = 0;
    const G = this.grund;
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, g = this.belegt[this.bi(F.x0 + i, F.z0 + j)];
      F.kosten[k] = g && G[k] !== Infinity ? (g === h.id ? 1 : 30) : G[k];
    }
    const q: [number, number][] = [];
    for (let x = h.x - 1; x <= h.x + h.w; x++) for (let z = h.z - 1; z <= h.z + h.d; z++) q.push([x, z]);
    this.feld.berechne(q);
  }
  aufdecken(x: number, z: number, r: number): void {
    let neu = false;
    for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) {
      const cx = -WR + (i + 0.5) * NZ, cz = -WR + (j + 0.5) * NZ;
      if (Math.hypot(cx - x, cz - z) <= r && !this.erkundet[i * NN + j]) { this.erkundet[i * NN + j] = 1; neu = true; }
    }
    if (neu) this.ereignisse.push({ art: 'erkundet' });
  }
  melde(text: string, ton: 'gut' | 'schlecht' | 'info' = 'info'): void { this.ereignisse.push({ art: 'meldung', text, ton }); }

  // ---------------- Speichern ----------------
  speichern(): Spielstand {
    let s = ''; for (let i = 0; i < this.erkundet.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) b |= this.erkundet[i + k] << k; s += String.fromCharCode(b); }
    return { v: 3, einwohner: this.einwohner, schwierigkeit: this.schwierigkeit, gefaellt: [...this.gefaellt], abgebaut: [...this.abgebaut], gaenge: [...this.gaenge], hoehen: hoehenListe(), code: this.code, nacht: this.nacht, phase: this.phase === 'verloren' ? 'verloren' : 'tag', zeit: this.phase === 'tag' ? this.zeit : 0,
      res: { ...this.res }, bausteine: { ...this.bausteine }, erfindungen: [...this.erfindungen],
      gebaeude: this.gebaeude.map((g) => ({ typ: g.typ, x: g.x, z: g.z, hp: g.hp, zweig: g.zweig, stufe: g.stufe })), erkundet: btoa(s), besiegt: this.besiegt,
      ruinen: this.ruinen.map((r) => ({ typ: r.typ, x: r.x, z: r.z, zweig: r.zweig })), entdeckt: [...this.entdeckt] };
  }
  private laden(st: Spielstand): void {
    this.laedt = true;
    this.nacht = st.nacht; this.phase = st.phase; this.zeit = st.zeit; this.res = Object.assign({ holz: 0, stein: 0, kristall: 0, nahrung: 0 }, st.res); this.bausteine = { ...st.bausteine };
    this.einwohner = st.einwohner ?? START.einwohner; this.schwierigkeit = st.schwierigkeit || 'normal';
    this.erfindungen = new Set(st.erfindungen); this.besiegt = st.besiegt || 0;
    this.gefaellt = new Map(st.gefaellt || []); this.abgebaut = new Map(st.abgebaut || []); this.gaenge = new Map(st.gaenge || []);
    for (const [k, h] of st.hoehen || []) setzeHoehe(Math.floor(k / 2048) - 600, (k % 2048) - 600, h);
    const bin = atob(st.erkundet); for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); for (let k = 0; k < 8; k++) this.erkundet[i * 8 + k] = (b >> k) & 1; }
    this.entdeckt = new Set(st.entdeckt || []);
    for (const g of st.gebaeude) { if (!GEBAEUDE[g.typ]) continue; const n = this.setze(g.typ, g.x, g.z); n.zweig = g.zweig; n.stufe = g.stufe || 1; n.max = this.grundHp(n); n.hp = Math.min(n.max, g.hp); }
    for (const r of st.ruinen || []) { const d = GEBAEUDE[r.typ]; if (d) this.ruinen.push({ id: this.naechsteId++, typ: r.typ, x: r.x, z: r.z, w: d.w, d: d.d, y: this.pruefeRoh(r.typ, r.x, r.z), zweig: r.zweig }); }
    this.laedt = false;
    this.lichterNeu(); this.verteileArbeiter();
    this.ereignisse = this.ereignisse.filter((e) => e.art !== 'meldung');
  }
}
