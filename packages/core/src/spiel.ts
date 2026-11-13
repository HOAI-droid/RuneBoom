import { matan2, mcos, mhypot, mpow, msin } from './rechnen.ts';
import { t as tr } from './sprache.ts';
import { rng, seedAusCode, type Rng } from './zufall.ts';
import { B, RISS, RISS2, RISSE, WR, setzeSeed, spalte, deko, begehbar, amPfad, orte, hoehe, setzeHoehe, hoehenListe, type Spalte, type Deko } from './welt.ts';
import { Wegfeld } from './flow.ts';
import { trockenerWeg } from './wege.ts';
import {
  GEBAEUDE, GEGNER, ERFINDUNGEN, HAUPT_STUFEN, VERSCHMELZUNGEN, PANZER_AB, UMBAU_DAUER, ZEITALTER_NAME, linie, welle, staerke, START, TAG_DAUER, ABEND, MORGEN_DAUER, MORGEN_REPARATUR, SETZLING_NACH, BAUM_NACH, BAUM_GAENGE, FELS_GAENGE, EBNEN_STEIN, EBNEN_MAX,
  STUFE_BRAUCHT, SCHLUESSEL_VORWISSEN, VOELKER, LEITSAETZE, OMEN, AKTE, ENDE_NACHT, aktVon,
  type Volk, type Omen, STUFE_WERT, STUFE_NAME, stufenKosten, runenkraft, SCHWIERIGKEIT, ESSEN, RES_NAMEN, BAUSTEIN_NAME, FAEHIGKEIT_NAME,
  type GebTyp, type GegTyp, type Res, type Baustein, type ErfId, type Kosten, type Kampf, type Zeitalter, type Schwierigkeit
} from './daten.ts';

/** längste Nacht (s): danach ziehen sich die übrigen Wesen zurück */
export const NACHT_MAX = 240;
/** Fester Simulationstakt (Sekunden) */
export const DT = 1 / 20;
/** Nebel-Raster: Zellen zu 8 × 8 Blöcken */
export const NZ = 8, NN = (2 * WR) / NZ;

export interface Geb { id: number; typ: GebTyp; x: number; z: number; w: number; d: number; y: number; hp: number; max: number; cd: number; quellen: number; rep?: { t: number; dauer: number; von: number }; zielen: number;
  zweig?: string; stufe: number; umbau?: { t: number; dauer: number; nach: GebTyp; zweig?: string; stufe?: number; kurz?: boolean }; strahlen: number[]; schild: number;
  /** brennt noch so viele Sekunden · danach eine Weile geschützt */ brand: number; brandSchutz?: number; /** hat in dieser Nacht Runenkraft */ kraft: boolean; /** Schaden in dieser Nacht */ leistung: number;
  /** Siegel: wartet auf die Nacht des Ansturms */ ritual?: boolean }
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
  | { art: 'bericht'; bericht: Nachtbericht }
  | { art: 'akt'; nr: number }
  | { art: 'leitsatz'; zeitalter: number }
  | { art: 'versiegelt'; x: number; z: number; name: string }
  | { art: 'sternschnuppe'; x: number; z: number }
  | { art: 'falle'; x: number; y: number; z: number; typ: string };
export interface Nachtbericht { nacht: number; besiegt: number; beute: string; schaden: number; zerstoert: string[]; tuerme: { name: string; schaden: number }[]; kraftFehlt: number; einwohner: number; wesen: number }
export type Phase = 'tag' | 'nacht' | 'morgen' | 'verloren' | 'gewonnen';
/**
 * Befehle: jede Handlung eines Spielers als kleiner Datensatz. Die Oberfläche ruft nur `befehl()` auf;
 * so lassen sich Partien aufzeichnen, wiederholen und später zwischen Mitspielern austauschen.
 */
export type Befehl =
  | { art: 'bauen'; typ: GebTyp; x: number; z: number; still?: boolean }
  | { art: 'abreissen'; geb: number }
  | { art: 'reparieren'; geb: number }
  | { art: 'umruesten'; geb: number; nach: GebTyp; zweig?: string }
  | { art: 'stufe'; geb: number }
  | { art: 'burg' }
  | { art: 'verschmelzen'; geb: number; partner: number }
  | { art: 'erfinden'; erf: ErfId }
  | { art: 'leitsatz'; id: string }
  | { art: 'spaeher'; x: number; z: number }
  | { art: 'ebnen'; x0: number; z0: number; x1: number; z1: number }
  | { art: 'nacht' }
  | { art: 'faehigkeit'; name: string; x?: number; z?: number }
  | { art: 'wiederaufbau'; ruine: number }
  | { art: 'raeumen'; ruine: number };

export interface Spielstand {
  v: 1 | 2 | 3 | 4; code: string; einwohner?: number; schwierigkeit?: Schwierigkeit;
  volk?: Volk; leitsaetze?: [number, string][]; leitsatzOffen?: number; versiegelt?: string[]; stat?: Statistik; nacht: number; phase: Phase; zeit: number; gefaellt?: [number, number][]; abgebaut?: [number, number][]; gaenge?: [number, number][]; hoehen?: [number, number][]; ruinen?: { typ: GebTyp; x: number; z: number; zweig?: string }[]; entdeckt?: GebTyp[];
  res: Record<Res, number>; bausteine: Record<Baustein, number>; erfindungen: ErfId[];
  gebaeude: { typ: GebTyp; x: number; z: number; hp: number; zweig?: string; stufe?: number; bau?: number; ritual?: boolean }[]; erkundet: string; besiegt: number;
}
export interface Statistik { bosse: number; gebaut: number; maxEinwohner: number; zerstoert: number; erfunden: number; wunder: string[] }

export const kostenText = (k: Kosten) => Object.entries(k).map(([r, n]) => `${Math.ceil(n as number)} ${tr(RES_NAMEN[r as Res])}`).join(', ');
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
  volk: Volk = 'glutborn';
  /** gewählter Leitsatz je Zeitalter · Zeitalter, für das noch gewählt werden muss */
  leitsaetze = new Map<number, string>(); leitsatzOffen = 0;
  versiegelt = new Set<string>();
  stat: Statistik = { bosse: 0, gebaut: 0, maxEinwohner: START.einwohner, zerstoert: 0, erfunden: 0, wunder: [] };
  private regenTakt = 0;
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
  /** Wege der Arbeiter um Wasser und Lava (nicht gespeichert, werden neu gesucht) */
  private wege = new Map<number, { zx: number; zz: number; p: [number, number][]; i: number }>();
  private laedt = false;
  private fallenIds = new Set<number>();
  private lichter: { x: number; z: number; r: number; enthuellt: boolean; kegel?: number; geb?: Geb }[] = [];

  constructor(code: string, stand?: Spielstand, opt: { schwierigkeit?: Schwierigkeit; volk?: Volk } = {}) {
    this.code = code; this.seed = seedAusCode(code);
    setzeSeed(this.seed);
    this.r = rng(this.seed ^ 0x5bd1e995);
    const xs = [B.x, ...RISSE.map((q) => q.x)], zs = [B.z, ...RISSE.map((q) => q.z)];
    const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 40, z0 = Math.min(...zs) - 60, z1 = Math.max(...zs) + 40;
    this.feld = new Wegfeld(x0, z0, x1 - x0, z1 - z0);
    if (stand) this.laden(stand);
    else {
      this.schwierigkeit = opt.schwierigkeit || 'normal'; this.volk = opt.volk || 'glutborn';
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
    if (t !== undefined) { if (t < -1e8) return 'weg'; const d = this.nacht - t; return d >= this.baumNach() ? null : d >= this.setzlingNach() ? 'setzling' : 'stumpf'; }
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
    let w = 0, e = false; const nebel = this.phase === 'nacht' && this.omenFuer(this.nacht) === 'nebelnacht';
    for (const l of this.lichter) {
      const d = mhypot(x - l.x, z - l.z); if (d >= l.r) continue;
      let v = 1 - d / l.r;
      if (nebel) { if (d >= l.r * 0.6) continue; v = 1 - d / (l.r * 0.6); }
      if (l.kegel && l.geb) { // Scheinwerfer: kleiner Kreis plus langer Kegel
        let da = matan2(x - l.x, z - l.z) - l.geb.zielen; da = matan2(msin(da), mcos(da));
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
    // Völker, Leitsätze, Wunder, Omen
    if (this.volk === 'glutborn' && (k.geschoss === 'topf' || k.brand)) { k.schaden *= 1.3; if (k.brand) k.brand *= 1.3; }
    if (this.volk === 'sturmweber') { k.reichweite *= 1.1; if (k.geschoss === 'blitz' || k.geschoss === 'aura') k.schaden *= 1.3; }
    if (this.leitsatz('licht')) k.reichweite += 1;
    if (this.leitsatz('sturm')) k.abklingen /= 1.1;
    if (E.has('himmelsauge')) k.reichweite += 2;
    if (E.has('aetherfeuer') && k.brand) k.brand *= 2;
    if (this.hatWunder('w_runenschmiede')) k.schaden *= 1.2;
    const lt = this.hatWunder('w_leuchtturm'); if (lt && g.typ !== 'haupt' && mhypot(lt.x + 3 - g.x - g.w / 2, lt.z + 3 - g.z - g.d / 2) < 40) k.reichweite += 2;
    if (this.phase === 'nacht' && this.omenFuer(this.nacht) === 'sturm' && (k.geschoss === 'blitz' || k.geschoss === 'aura')) k.schaden *= 2;
    if (!g.kraft && g.typ !== 'haupt' && this.phase === 'nacht') { k.abklingen *= 2; if (k.geschoss === 'strahl' || k.geschoss === 'aura') k.schaden *= 0.5; }
    return k;
  }
  /** Bonus auf die Haltbarkeit durch Erfindungen und Stufen */
  private hpFaktor(typ: GebTyp): number {
    const wall = typ === 'mauer' || typ === 'tor';
    return (wall && this.erfindungen.has('stahlguss') ? 2 : 1) * (wall && this.erfindungen.has('aetherwall') ? 3 : 1) * (wall && this.leitsatz('mauern') ? 1.5 : 1)
      * (this.erfindungen.has('schuppenpanzer') ? 4 / 3 : 1) * (this.erfindungen.has('bollwerk') ? 1.15 : 1) * (this.leitsatz('wall') ? 1.2 : 1);
  }
  private grundHp(g: { typ: GebTyp; stufe?: number }): number {
    const st = g.stufe || 1;
    return Math.round((g.typ === 'haupt' ? HAUPT_STUFEN[st - 1].hp : GEBAEUDE[g.typ].hp * STUFE_WERT.kraft[st]) * this.hpFaktor(g.typ));
  }
  // ---------------- Völker, Leitsätze, Wunder, Omen, Akte ----------------
  leitsatz(id: string): boolean { for (const v of this.leitsaetze.values()) if (v === id) return true; return false; }
  waehleLeitsatz(id: string): boolean {
    const z = this.leitsatzOffen; const opt = LEITSAETZE[z]?.find((l) => l.id === id); if (!opt) return false;
    this.leitsaetze.set(z, id); this.leitsatzOffen = 0;
    for (const g of this.gebaeude) { const f = g.hp / g.max; g.max = this.grundHp(g); g.hp = g.max * f; }
    this.lichterNeu(); this.verteileArbeiter();
    this.melde(tr('Leitsatz gewählt: {a}. {b}', { a: tr(opt.name), b: tr(opt.kurz) }), 'gut'); return true;
  }
  /** fertiges Wunder vorhanden? */
  hatWunder(typ: GebTyp): Geb | undefined { return this.gebaeude.find((g) => g.typ === typ && !g.umbau); }
  /** Wunder des Zeitalters schon gewählt (gebaut oder im Bau)? */
  wunderGewaehlt(z: number): Geb | undefined { return this.gebaeude.find((g) => GEBAEUDE[g.typ].wunder === z); }
  akt() { return aktVon(this.nacht); }
  /** Omen für Nacht n (fest aus dem Weltcode) */
  omenFuer(n: number): Omen | null {
    if (n < 4 || n % 5 === 0 || n > ENDE_NACHT) return null;
    const r = rng((this.seed ^ Math.imul(n, 0x9e3779b1)) >>> 0);
    if (r() > 0.3) return null;
    const liste = Object.keys(OMEN) as Omen[]; return liste[Math.floor(r() * liste.length)];
  }
  omenHeute(): Omen | null { return this.phase === 'nacht' || this.phase === 'tag' ? this.omenFuer(this.nacht) : null; }
  /** wie viele Tage voraus Omen sichtbar sind */
  omenVorlauf(): number { return this.hatWunder('w_sternwarte') || this.erfindungen.has('himmelsauge') ? 3 : 1; }
  omenVorschau(): { nacht: number; omen: Omen }[] { const out: { nacht: number; omen: Omen }[] = []; for (let n = this.nacht; n < this.nacht + this.omenVorlauf(); n++) { const o = this.omenFuer(n); if (o) out.push({ nacht: n, omen: o }); } return out; }
  /** Kristallkosten einer Erfindung (Sternwarte: −25 %) */
  erfKristall(id: ErfId): number { return Math.ceil(ERFINDUNGEN[id].kristall * (this.hatWunder('w_sternwarte') ? 0.75 : 1)); }
  /** Kosten der nächsten Ausbaustufe mit Wundern und Leitsätzen */
  stufenKostenJetzt(typ: GebTyp, stufe: number): Kosten {
    const k = stufenKosten(typ, stufe), f = (this.leitsatz('meister') ? 0.7 : 1) * (this.hatWunder('w_aetherquelle') ? 0.75 : 1);
    if (f < 1) for (const r of Object.keys(k) as Res[]) k[r] = Math.ceil(k[r]! * f);
    return k;
  }
  /** Arbeiter, die ein Gebäude braucht (Sammeln oder Verarbeitung) */
  arbeiterZahl(g: { typ: GebTyp; stufe: number }): number { const d = GEBAEUDE[g.typ]; const a = d.arbeit?.arbeiter || d.umwandeln?.arbeiter || 0; return a ? a + STUFE_WERT.arbeiter[g.stufe] : 0; }
  setzlingNach(): number { return this.volk === 'hainmar' ? 2 : SETZLING_NACH; }
  baumNach(): number { return this.volk === 'hainmar' ? 3 : BAUM_NACH; }

  // ---------------- Stufen, Bevölkerung, Turmgrenze, Runenkraft ----------------
  /** Lässt sich der Gebäudetyp in Stufen I–III ausbauen? */
  static hatStufen(typ: GebTyp): boolean { const d = GEBAEUDE[typ]; return !!d.stufen || (!!d.kampf && typ !== 'haupt') || linie(typ) === 'licht'; }
  /** nächste Stufe eines Gebäudes oder ein Grund, warum es nicht geht */
  stufeOption(g: Geb): { stufe: number; kosten: Kosten; grund?: string } | undefined {
    if (g.typ === 'haupt' || !Spiel.hatStufen(g.typ) || g.stufe >= 3) return undefined;
    const stufe = g.stufe + 1, kosten = this.stufenKostenJetzt(g.typ, stufe), b = STUFE_BRAUCHT[stufe];
    let grund: string | undefined;
    if (!this.erfindungen.has(b)) grund = tr('Braucht die Erfindung {a}.', { a: tr(ERFINDUNGEN[b].name) });
    else if (this.phase !== 'tag') grund = tr('Ausgebaut wird nur am Tag.');
    else if (g.umbau) grund = tr('Erst den laufenden Bau abwarten.');
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
    const f = Object.entries(k).filter(([r, n]) => this.res[r as Res] < (n as number)).map(([r, n]) => `${Math.ceil((n as number) - this.res[r as Res])} ${tr(RES_NAMEN[r as Res])}`);
    return f.length ? tr('Es fehlen {a}.', { a: f.join(tr(' und ')) }) : '';
  }
  /** Lässt sich das Gebäude jetzt verbessern (Stufe, Umrüsten, Burgausbau)? */
  verbesserbar(g: Geb): boolean {
    if (this.phase !== 'tag' || g.umbau) return false;
    if (g.typ === 'haupt') { const st = this.hauptAusbau(); return !!st && (!st.braucht || this.erfindungen.has(st.braucht)) && this.kannBezahlen(st.kosten); }
    const o = this.stufeOption(g); if (o && !o.grund) return true;
    return this.umruestOptionen(g).some((t) => this.freigeschaltet(t) && this.kannBezahlen(GEBAEUDE[t].kosten) && (GEBAEUDE[t].zeitalter !== 5 || g.stufe >= 3));
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
    if (E.has('sternenernte')) menge *= 1.3;
    if (this.leitsatz('meister')) menge *= 1.2;
    if (this.volk === 'hainmar' && (g.typ === 'holz' || g.typ === 'hof')) menge *= 1.3;
    return { res: a.res, menge, dauer: a.dauer, radius: a.radius + STUFE_WERT.radius[g.stufe], arbeiter: a.arbeiter + STUFE_WERT.arbeiter[g.stufe] };
  }
  /** Wohnraum für Einwohner: Burg und Wohnhäuser */
  wohnraum(): number {
    const h = this.haupt; let w = h ? HAUPT_STUFEN[h.stufe - 1].wohnraum : 0;
    for (const g of this.gebaeude) {
      if (g.typ === 'haus') w += STUFE_WERT.wohnraum[g.stufe] + (this.erfindungen.has('sternenkorn') ? 2 : 0) + (this.leitsatz('volk') ? 3 : 0);
      else if (GEBAEUDE[g.typ].wohnraum && !g.umbau) w += GEBAEUDE[g.typ].wohnraum!;
    }
    return w;
  }
  /** Arbeiter, die alle Gebäude zusammen bräuchten */
  arbeiterBedarf(): number { let n = 0; for (const g of this.gebaeude) n += this.arbeiterZahl(g); return n; }
  /** zugeteilte Arbeiter je Gebäude-Id */
  zugeteilt(g: Geb): number { let n = 0; for (const a of this.arbeiter) if (a.geb === g.id) n++; return n; }
  /** Einwohner ohne Arbeit (laufen in der Feste herum) */
  leerlauf(): number { return Math.max(0, this.einwohner - this.arbeiter.length); }
  /** Nahrung, die alle Einwohner je Tag essen */
  essen(): number { return Math.ceil(this.einwohner * ESSEN * (this.erfindungen.has('kornspeicher') ? 0.75 : 1) * (this.hatWunder('w_kornkammer') ? 0.7 : 1)); }
  /** Einwohner auf die Arbeitsgebäude verteilen: zuerst Nahrung, dann der Reihe nach */
  verteileArbeiter(): void {
    const liste = this.gebaeude.filter((g) => this.arbeiterZahl(g) > 0 && !Spiel.imBau(g));
    const essen = (g: Geb) => (GEBAEUDE[g.typ].arbeit?.res === 'nahrung' ? 1 : 0);
    liste.sort((a, b) => essen(b) - essen(a) || a.id - b.id);
    // erste Runde: jedem Gebäude einen, dann auffüllen
    const soll = new Map<number, number>(); let frei = this.einwohner;
    for (const runde of [1, 99]) for (const g of liste) { const max = Math.min(this.arbeiterZahl(g), runde), hat = soll.get(g.id) || 0, n = Math.max(0, Math.min(max - hat, frei)); soll.set(g.id, hat + n); frei -= n; }
    for (const g of liste) {
      const n = soll.get(g.id) || 0, jetzt = this.arbeiter.filter((a) => a.geb === g.id);
      for (const a of jetzt.slice(n)) { if (a.quelle >= 0) this.reserviert.delete(a.quelle); this.arbeiter = this.arbeiter.filter((o) => o !== a); }
      for (let i = jetzt.length; i < n; i++) this.arbeiter.push({ id: this.naechsteId++, geb: g.id, x: g.x + g.w / 2 + (i % 3), z: g.z + g.d + 0.5, y: g.y, zustand: this.phase === 'tag' ? 'warten' : 'drin', ziel: null, quelle: -1, t: i * 1.5, traegt: null, richtung: 0, ruhe: i * 1.2 });
    }
  }
  /** Türme, die nach der Burgstufe erlaubt sind */
  turmGrenze(): number { const h = this.haupt; return (h ? HAUPT_STUFEN[h.stufe - 1].tuerme : 6) + (this.erfindungen.has('festungsbau') ? 2 : 0) + (this.erfindungen.has('bollwerk') ? 4 : 0); }
  /** zählt für die Turmgrenze (keine Burg, Wunder, Außenposten) */
  static zaehltAlsTurm(typ: GebTyp): boolean { const d = GEBAEUDE[typ]; return !!d.kampf && typ !== 'haupt' && !d.wunder && typ !== 'aussenposten'; }
  turmZahl(): number { return this.gebaeude.filter((g) => Spiel.zaehltAlsTurm(g.typ)).length; }
  /** Kristall, den alle Türme in der kommenden Nacht als Runenkraft brauchen */
  runenkraftBedarf(): number {
    let n = 0; for (const g of this.gebaeude) if (Spiel.zaehltAlsTurm(g.typ)) n += runenkraft(g.typ, g.stufe);
    return Math.ceil(n * this.kraftFaktor());
  }
  kraftFaktor(): number {
    return (this.erfindungen.has('runenkreis') ? 0.75 : 1) * (this.erfindungen.has('aetherspeicher') ? 0.75 : 1) * (this.hatWunder('w_runenschmiede') ? 0.7 : 1) * (this.leitsatz('aether') ? 0.7 : 1);
  }
  /** Risse, die in Nacht n offen sind */
  offeneRisse(n = this.nacht): typeof RISSE { return RISSE.filter((q) => q.ab <= n && spalte(q.x, q.z) && !this.versiegelt.has(q.name)); }
  /** alle Risse, die es in dieser Welt gibt (für den Sieg) */
  alleRisse(): typeof RISSE { return RISSE.filter((q) => spalte(q.x, q.z)); }
  /** nächster unversiegelter, offener Riss nahe (x, z) */
  rissNahe(x: number, z: number, r: number) { return this.offeneRisse().find((q) => mhypot(q.x - x, q.z - z) < r); }
  ruineAn(x: number, z: number): Ruine | undefined { return this.ruinen.find((r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d); }
  welleVorschau() { return welle(this.nacht); }

  /** Kann typ mit linker oberer Ecke (x0, z0) gebaut werden? */
  pruefe(typ: GebTyp, x0: number, z0: number): { ok: boolean; grund?: string; y: number } {
    const def = GEBAEUDE[typ];
    if (!this.freigeschaltet(typ)) return { ok: false, grund: tr('Braucht die Erfindung {a}.', { a: tr(ERFINDUNGEN[def.braucht!].name) }), y: 0 };
    if (def.volk && def.volk !== this.volk) return { ok: false, grund: tr('Nur für das Volk der {a}.', { a: tr(VOELKER[def.volk].name) }), y: 0 };
    if (def.abNacht && this.nacht < def.abNacht) return { ok: false, grund: tr('Erst ab Nacht {a} (Akt {b}: {c}).', { a: def.abNacht, b: aktVon(def.abNacht).nr, c: tr(aktVon(def.abNacht).name) }), y: 0 };
    if (def.wunder) {
      if (this.zeitalter() < def.wunder) return { ok: false, grund: tr('Wunder des Zeitalters {a}.', { a: tr(ZEITALTER_NAME[def.wunder]) }), y: 0 };
      const w = this.wunderGewaehlt(def.wunder); if (w) return { ok: false, grund: tr('Für dieses Zeitalter steht schon ein Wunder: {a}.', { a: tr(GEBAEUDE[w.typ].name) }), y: 0 };
    }
    if (typ === 'siegel') {
      const q = this.rissNahe(x0 + 2, z0 + 2, 20); if (!q) return { ok: false, grund: tr('Ein Siegelstein muss nahe an einem offenen Riss stehen.'), y: 0 };
      if (this.gebaeude.some((g) => g.typ === 'siegel' && mhypot(g.x - q.x, g.z - q.z) < 24)) return { ok: false, grund: tr('An diesem Riss steht schon ein Siegelstein.'), y: 0 };
    }
    if (def.versorgt) {
      const cx = x0 + def.w / 2, cz = z0 + def.d / 2, h = this.haupt;
      const ok = (h && mhypot(h.x + 6 - cx, h.z + 6 - cz) < 52) || this.gebaeude.some((g) => g.typ === 'aussenposten' && mhypot(g.x + 2.5 - cx, g.z + 2.5 - cz) < 34);
      if (!ok) return { ok: false, grund: tr('Zu weit weg: Rohstoffgebäude brauchen die Burg oder einen Außenposten in der Nähe.'), y: 0 };
    }
    if (def.kampf && Spiel.zaehltAlsTurm(typ) && this.turmZahl() >= this.turmGrenze()) return { ok: false, grund: tr('Turmgrenze erreicht ({a}). Baue die Burg aus, um mehr Türme zu erlauben.', { a: this.turmGrenze() }), y: 0 };
    let lo = 99, hi = -99;
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) {
      const s = spalte(x, z);
      if (!s) return { ok: false, grund: tr('Hier ist kein Land.'), y: 0 };
      if (!this.erkundetAn(x, z)) return { ok: false, grund: tr('Noch im Nebel. Erst einen Späher schicken.'), y: 0 };
      if (!begehbar(s)) return { ok: false, grund: s.a === 'w' ? tr('Nicht im Wasser.') : s.a === 'l' ? tr('Nicht in der Lava.') : tr('Zu steil.'), y: 0 };
      if (this.belegt[this.bi(x, z)]) return { ok: false, grund: tr('Hier steht schon etwas.'), y: 0 };
      if (this.ruineAn(x, z)) return { ok: false, grund: tr('Hier liegt eine Ruine. Wähle sie, um sie wieder aufzubauen oder zu räumen.'), y: 0 };
      const dk = this.dekoJetzt(x, z, s);
      if (dk && dk.art !== 'gras') return { ok: false, grund: dk.art === 'baum' ? tr('Hier steht ein Baum. Ein Holzfäller kann ihn fällen.') : tr('Hier liegt ein Felsen.'), y: 0 };
      if (amPfad(x, z, 0) && typ !== 'mauer' && typ !== 'fackel') { /* auf dem Pfad erlaubt, blockiert ihn aber */ }
      lo = Math.min(lo, s.h); hi = Math.max(hi, s.h);
    }
    if (hi - lo > (typ === 'mauer' ? 2 : 1)) return { ok: false, grund: tr('Der Boden ist zu uneben.'), y: 0 };
    if (typ === 'fischer' && !this.quellen('fischer', x0 + def.w / 2, z0 + def.d / 2, GEBAEUDE.fischer.arbeit!.radius, false).length) return { ok: false, grund: tr('Eine Fischerhütte braucht Wasser in der Nähe.'), y: 0 };
    if (typ === 'kristall' && !orte().some((o) => o.typ === 'kristall' && mhypot(o.x - (x0 + 2), o.z - (z0 + 2)) < 10)) return { ok: false, grund: tr('Eine Kristallmine muss an einem Kristallfeld stehen.'), y: 0 };
    return { ok: true, y: hi + 1 };
  }

  // ---------------- Aktionen ----------------
  bauen(typ: GebTyp, x0: number, z0: number, still = false): boolean {
    const def = GEBAEUDE[typ];
    if (this.phase === 'verloren') return false;
    const p = this.pruefe(typ, x0, z0);
    if (!p.ok) { if (!still) this.melde(p.grund!, 'schlecht'); return false; }
    if (!this.kannBezahlen(def.kosten)) { if (!still) this.melde(tr('{a} kostet {b}. {c}', { a: tr(def.name), b: kostenText(def.kosten), c: this.fehlt(def.kosten) }), 'schlecht'); return false; }
    for (const [r, n] of Object.entries(def.kosten)) this.res[r as Res] -= n as number;
    const g = this.setze(typ, x0, z0);
    if (!def.bauzeit) this.bauBeginnen(g);
    return true;
  }
  /** Bauzeit eines neuen Gebäudes ohne eigene Bauzeit: je nach Grundfläche wenige Sekunden */
  static bauDauer(typ: GebTyp): number { const d = GEBAEUDE[typ]; return d.bauzeit ?? Math.min(12, 1.6 + d.w * d.d * 0.26); }
  /** Gebäude entsteht erst: kämpft nicht, arbeitet nicht, wird Schicht für Schicht sichtbar */
  private bauBeginnen(g: Geb): void { g.umbau = { t: 0, dauer: Spiel.bauDauer(g.typ), nach: g.typ, kurz: true }; this.verteileArbeiter(); }
  /** steht das Gebäude noch im Bau (neu gebaut, nicht umgerüstet)? */
  static imBau(g: Geb): boolean { return !!g.umbau && g.umbau.nach === g.typ && !g.umbau.stufe && (!!g.umbau.kurz || !!GEBAEUDE[g.typ].bauzeit); }
  abreissen(g: Geb): void {
    if (g.typ === 'haupt' || g.typ === 'werkstatt') { this.melde(tr('Das bleibt stehen.'), 'schlecht'); return; }
    for (const [r, n] of Object.entries(GEBAEUDE[g.typ].kosten)) this.res[r as Res] += Math.floor((n as number) * 0.5 * g.hp / g.max);
    this.entferne(g, false);
  }
  spaeher(x: number, z: number): boolean {
    if (this.erkundetAn(x, z)) return false;
    let nah = Infinity;
    for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) if (this.erkundet[i * NN + j]) nah = Math.min(nah, mhypot(-WR + (i + 0.5) * NZ - x, -WR + (j + 0.5) * NZ - z));
    if (nah > 64) { this.melde(tr('Zu weit: Späher kommen nur vom Rand des Erkundeten aus.'), 'schlecht'); return false; }
    if (this.res.holz < 15) { this.melde(tr('Ein Späher kostet 15 Holz.'), 'schlecht'); return false; }
    this.res.holz -= 15;
    this.aufdecken(x, z, this.erfindungen.has('fernrohr') ? 56 : 38);
    this.melde(tr('Ein Späher hat die Gegend erkundet.'), 'gut');
    return true;
  }
  erfinden(id: ErfId): boolean {
    const e = ERFINDUNGEN[id];
    if (this.erfindungen.has(id)) return false;
    if (e.braucht && !this.erfindungen.has(e.braucht)) { this.melde(tr('{a} braucht zuerst {b}.', { a: tr(e.name), b: tr(ERFINDUNGEN[e.braucht].name) }), 'schlecht'); return false; }
    const vor = this.vorwissenFehlt(id); if (vor) { this.melde(vor, 'schlecht'); return false; }
    const kr = this.erfKristall(id);
    const fehlt = Object.entries(e.zutaten).some(([b, n]) => this.bausteine[b as Baustein] < (n as number)) || this.res.kristall < kr;
    if (fehlt) { this.melde(tr('Für {a} fehlen noch Bausteine oder Kristall.', { a: tr(e.name) }), 'schlecht'); return false; }
    for (const [b, n] of Object.entries(e.zutaten)) this.bausteine[b as Baustein] -= n as number;
    this.res.kristall -= kr;
    this.erfindungen.add(id); this.stat.erfunden++;
    for (const g of this.gebaeude) { const f = g.hp / g.max; g.max = this.grundHp(g); g.hp = g.max * f; }
    this.lichterNeu(); this.verteileArbeiter();
    this.melde(tr('Erfunden: {a}. {b}', { a: tr(e.name), b: tr(e.wirkung) }), 'gut');
    if (e.zeitalter) {
      this.melde(tr('Ein neues Zeitalter beginnt: {a}.', { a: tr(ZEITALTER_NAME[e.zeitalter]) }), 'gut');
      if (LEITSAETZE[e.zeitalter] && !this.leitsaetze.has(e.zeitalter)) { this.leitsatzOffen = e.zeitalter; this.ereignisse.push({ art: 'leitsatz', zeitalter: e.zeitalter }); }
    }
    return true;
  }
  /** Grund, warum eine Erfindung noch nicht geht (Zeitalter, Vorwissen), sonst leer */
  vorwissenFehlt(id: ErfId): string {
    const e = ERFINDUNGEN[id];
    if (this.zeitalter() < e.ab) return tr('{a} gehört ins Zeitalter {b}.', { a: tr(e.name), b: tr(ZEITALTER_NAME[e.ab]) });
    if (e.braucht && !this.erfindungen.has(e.braucht)) return tr('Braucht zuerst {a}.', { a: tr(ERFINDUNGEN[e.braucht].name) });
    if (e.zeitalter) { const n = SCHLUESSEL_VORWISSEN[e.zeitalter] || 0, hat = [...this.erfindungen].filter((i) => ERFINDUNGEN[i].ab === e.ab && !ERFINDUNGEN[i].zeitalter).length; if (hat < n) return tr('Braucht erst {a} andere Erfindungen aus diesem Zeitalter ({b} von {c}).', { a: n, b: hat, c: n }); }
    return '';
  }
  nachtEinlaeuten(): void {
    if (this.phase !== 'tag') return;
    const bonus = Math.round(12 * this.restTag() / TAG_DAUER);
    if (bonus > 0) { this.res.kristall += bonus; this.melde(tr('Früh eingeläutet: +{a} Kristall.', { a: bonus }), 'gut'); }
    this.starteNacht();
  }

  // ---------------- Takt ----------------
  /** Takte seit Beginn dieser Partie (für das Befehlsprotokoll) */
  takt = 0;
  /** alle ausgeführten Befehle mit ihrem Takt (nicht gespeichert) */
  protokoll: { takt: number; b: Befehl }[] = [];
  /** einen Befehl ausführen; true, wenn er etwas bewirkt hat */
  befehl(b: Befehl): boolean {
    const geb = (id: number) => this.gebaeude.find((g) => g.id === id), ru = (id: number) => this.ruinen.find((r) => r.id === id);
    let ok = false;
    switch (b.art) {
      case 'bauen': ok = this.bauen(b.typ, b.x, b.z, b.still); break;
      case 'abreissen': { const g = geb(b.geb); if (g) { const n = this.gebaeude.length; this.abreissen(g); ok = this.gebaeude.length < n; } break; }
      case 'reparieren': { const g = geb(b.geb); ok = !!g && this.reparieren(g); break; }
      case 'umruesten': { const g = geb(b.geb); ok = !!g && this.umruesten(g, b.nach, b.zweig); break; }
      case 'stufe': { const g = geb(b.geb); ok = !!g && this.stufeAusbauen(g); break; }
      case 'burg': ok = this.hauptAusbauen(); break;
      case 'verschmelzen': { const g = geb(b.geb), p = geb(b.partner); ok = !!g && !!p && this.verschmelzen(g, p); break; }
      case 'erfinden': ok = this.erfinden(b.erf); break;
      case 'leitsatz': ok = this.waehleLeitsatz(b.id); break;
      case 'spaeher': ok = this.spaeher(b.x, b.z); break;
      case 'ebnen': ok = this.ebnen(b.x0, b.z0, b.x1, b.z1); break;
      case 'nacht': { const vor = this.phase; this.nachtEinlaeuten(); ok = vor === 'tag' && this.phase !== vor; break; }
      case 'faehigkeit': ok = this.faehigkeit(b.name, b.x, b.z); break;
      case 'wiederaufbau': { const r = ru(b.ruine); ok = !!r && this.wiederaufbauen(r); break; }
      case 'raeumen': { const r = ru(b.ruine); if (r) { this.raeumen(r); ok = true; } break; }
    }
    if (ok) this.protokoll.push({ takt: this.takt, b });
    return ok;
  }
  /** Prüfsumme des Spielstands: gleich auf allen Geräten, wenn dieselben Befehle zur selben Zeit kamen */
  pruefsumme(): number {
    let h = 2166136261 >>> 0;
    const mix = (v: number) => { h = Math.imul(h ^ (Math.round(v * 64) | 0), 16777619) >>> 0; };
    mix(this.takt); mix(this.nacht); mix(this.zeit);
    for (const r of Object.keys(this.res).sort()) mix(this.res[r as Res]);
    for (const g of this.gebaeude) { mix(g.id); mix(g.x); mix(g.z); mix(g.hp); }
    for (const e of this.gegner) { mix(e.id); mix(e.x); mix(e.z); mix(e.hp); }
    for (const a of this.arbeiter) { mix(a.x); mix(a.z); }
    return h;
  }
  schritt(): void {
    if (this.phase === 'verloren' || this.phase === 'gewonnen') return;
    this.takt++;
    this.zeit += DT;
    if (this.feldAlt) this.feldNeu();
    // kurze Bauten wachsen auch nachts weiter
    for (const g of this.gebaeude) if (g.umbau?.kurz) {
      g.umbau.t += DT;
      if (g.umbau.t >= g.umbau.dauer) { g.umbau = undefined; g.max = this.grundHp(g); g.hp = g.max; g.cd = 0; this.lichterNeu(); this.verteileArbeiter(); this.feldAlt = true; this.ereignisse.push({ art: 'umgebaut', geb: g }); }
    }
    if (this.phase === 'tag') {
      for (const g of this.gebaeude) if (g.rep) {
        g.rep.t += DT; const f = Math.min(1, g.rep.t / g.rep.dauer); g.hp = g.rep.von + (g.max - g.rep.von) * f;
        if (f >= 1) { g.rep = undefined; g.hp = g.max; this.ereignisse.push({ art: 'reparatur', geb: g, fertig: true }); }
      }
      for (const g of this.gebaeude) if (g.umbau && !g.umbau.kurz) {
        g.umbau.t += DT;
        if (g.umbau.t >= g.umbau.dauer) {
          const u = g.umbau; g.umbau = undefined;
          if (u.stufe) g.stufe = u.stufe; else { g.typ = u.nach; g.zweig = u.zweig; }
          g.max = this.grundHp(g); g.hp = g.max; g.cd = 0;
          this.lichterNeu(); this.verteileArbeiter(); this.ereignisse.push({ art: 'umgebaut', geb: g });
          if (GEBAEUDE[g.typ].wunder && !u.stufe && u.nach === g.typ) { this.stat.wunder.push(tr(GEBAEUDE[g.typ].name)); this.melde(tr('Ein Wunder ist vollendet: {a}!', { a: tr(GEBAEUDE[g.typ].name) }), 'gut'); continue; }
          if (g.typ === 'siegel' && !u.stufe) { this.melde(tr('Der Siegelstein steht. In der nächsten Nacht stürmt der Riss gegen ihn an. Hält er bis zum Morgen, ist der Riss versiegelt.'), 'info'); continue; }
          this.melde(g.typ === 'haupt' ? tr('Die Burg ist zur {a} gewachsen.', { a: tr(HAUPT_STUFEN[g.stufe - 1].name) }) : u.stufe ? tr('{a} Stufe {b} ist fertig.', { a: tr(GEBAEUDE[g.typ].name), b: tr(STUFE_NAME[g.stufe]) }) : tr('{a} ist fertig.', { a: tr(GEBAEUDE[g.typ].name) }), 'gut');
        }
      }
      this.verarbeiten();
      if (this.volk === 'hainmar') { this.regenTakt += DT; if (this.regenTakt >= 1) { this.regenTakt = 0; for (const g of this.gebaeude) if (g.hp < g.max && !g.rep) g.hp = Math.min(g.max, g.hp + g.max * 0.006); } }
      if (this.zeit >= TAG_DAUER) this.starteNacht();
    } else if (this.phase === 'nacht') {
      if (this.omenFuer(this.nacht) === 'sternenregen') { this.regenTakt += DT; if (this.regenTakt >= 6) { this.regenTakt = 0; const h = this.haupt; if (h) { const x = h.x + 6 + (this.r() - 0.5) * 60, z = h.z + 6 + (this.r() - 0.5) * 60; this.res.kristall += 4; this.beuteNacht.kristall = (this.beuteNacht.kristall || 0) + 4; this.ereignisse.push({ art: 'sternschnuppe', x, z }); } } }
      for (const g of this.gebaeude) if (g.schild > 0) g.schild -= DT;
      if (this.sturm > 0) this.sturm -= DT;
      if (this.erfindungen.has('kristallgitter')) for (const g of this.gebaeude) if (g.hp < g.max) g.hp = Math.min(g.max, g.hp + g.max * 0.005 * DT);
      while (this.spawn.length && this.spawn[0].t <= this.zeit) { const s = this.spawn.shift()!; this.erzeuge(s.typ, s.riss); }
      if (!this.spawn.length && !this.gegner.length && this.zeit > 3) this.starteMorgen();
      else if (this.zeit > NACHT_MAX && !this.spawn.length) {
        // Sicherheitsnetz: keine Nacht dauert ewig
        this.gegner = []; this.melde(tr('Der Morgen graut: Die übrigen Wesen ziehen sich in die Wildnis zurück.'), 'info'); this.starteMorgen();
      }
    } else if (this.phase === 'morgen') {
      if (this.zeit >= MORGEN_DAUER) {
        this.phase = 'tag'; this.zeit = 0; this.nacht++;
        this.tagesbeginn(); this.quellVersion++;
        // Bäume wachsen nach: Setzling, dann voller Baum
        for (const [k, t] of [...this.gefaellt]) { if (t < -1e8) continue; const d = this.nacht - t; if (d === this.setzlingNach() || d >= this.baumNach()) { const x = Math.floor(k / 2048) - 600, z = (k % 2048) - 600; if (d >= this.baumNach()) { this.gefaellt.delete(k); this.grundAlt.push([x, z]); this.feldAlt = true; } this.ereignisse.push({ art: 'deko', x, z }); } }
        this.ereignisse.push({ art: 'phase', phase: 'tag' }); this.melde(tr('Tag {a}. Bis zur Nacht bleibt Zeit zum Bauen.', { a: this.nacht }), 'info');
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
    const nachNaehe = [...this.gebaeude].sort((a, b) => mhypot(a.x - hx, a.z - hz) - mhypot(b.x - hx, b.z - hz));
    const m = (this.erfindungen.has('runenkreis') ? 0.75 : 1) * (this.erfindungen.has('aetherspeicher') ? 0.75 : 1);
    let rest = zahlt + 0.999;
    for (const g of nachNaehe) { const k = runenkraft(g.typ, g.stufe) * m; g.kraft = k <= rest; if (g.kraft) rest -= k; }
    if (this.kraftFehlt > 0) this.melde(tr('Zu wenig Kristall für die Runenkraft: {a} fehlen. Die äußeren Türme feuern heute nur halb so schnell.', { a: this.kraftFehlt }), 'schlecht');
    // neue Risse
    for (const q of RISSE) if (q.ab === this.nacht && spalte(q.x, q.z)) { this.melde(tr('Der {a} hat sich geöffnet! Von dort kommen nun auch Wesen.', { a: tr(q.name) }), 'schlecht'); this.ereignisse.push({ art: 'riss', x: q.x, z: q.z, name: q.name }); }
    const risse = this.offeneRisse();
    // Die Welle sucht die schwächste Seite: Risse mit wenig Abwehr am Weg bekommen mehr Wesen
    const gewicht = risse.map((q) => 1 / (1 + this.abwehrAmWeg(q) / 60));
    const summe = gewicht.reduce((a, b) => a + b, 0);
    // ein frisch geöffneter Riss schickt höchstens ein Drittel der Welle
    const anteil = gewicht.map((w, i) => Math.min(risse[i].ab === this.nacht && risse.length > 1 ? 0.33 : 1, Math.max(0.2, w / summe)));
    const wahl = () => { let x = this.r() * anteil.reduce((a, b) => a + b, 0); for (let i = 0; i < risse.length; i++) { x -= anteil[i]; if (x <= 0) return risse[i]; } return risse[risse.length - 1]; };
    const plan: { typ: GegTyp; t: number; riss: { x: number; z: number } }[] = [];
    const dauer = Math.min(60, 24 + this.nacht * 0.8), S = SCHWIERIGKEIT[this.schwierigkeit];
    const omen = this.omenFuer(this.nacht), akt = this.akt().nr;
    const bisher = RISSE.filter((q) => q.ab <= this.nacht && spalte(q.x, q.z)).length;
    let faktor = S.anzahl * [1, 1, 1.12, 1.25][akt - 1] * Math.sqrt(Math.max(1, risse.length) / Math.max(1, bisher)) * (omen === 'stille' ? 0.4 : 1);
    if (omen) this.melde(tr('Omen: {a}. {b}', { a: tr(OMEN[omen].name), b: tr(OMEN[omen].kurz) }), 'schlecht');
    // Siegelsteine rufen einen Ansturm ihres Risses hervor
    const ansturm: typeof risse = [];
    for (const g of this.gebaeude) if (g.typ === 'siegel' && !g.umbau) { const q = this.rissNahe(g.x + 2, g.z + 2, 24); if (q) { g.ritual = true; ansturm.push(q); this.melde(tr('Der {a} stürmt gegen den Siegelstein an!', { a: tr(q.name) }), 'schlecht'); } }
    for (const { typ, zahl } of welle(this.nacht, faktor)) for (let i = 0; i < Math.round(zahl * (1 + ansturm.length * 0.6 / Math.max(1, risse.length))); i++) {
      if (ansturm.length && i % 3 === 0 && typ !== 'rissfuerst') { plan.push({ typ, t: 2 + this.r() * dauer, riss: ansturm[i % ansturm.length] }); continue; }
      if (typ === 'rissfuerst') { const alt = risse.filter((q) => q.ab < this.nacht); const q = alt.length ? alt[Math.floor(this.r() * alt.length)] : risse[0]; plan.push({ typ, t: 12 + i * 8, riss: q }); continue; }
      plan.push({ typ, t: 2 + this.r() * dauer, riss: wahl() });
    }
    plan.sort((a, b) => a.t - b.t);
    this.spawn = plan;
    this.ereignisse.push({ art: 'phase', phase: 'nacht' });
    this.melde(tr('Nacht {a}: Die Wesen kommen!', { a: this.nacht }), 'schlecht');
    if (omen === 'stille') plan.push({ typ: 'rissfuerst', t: 8, riss: risse[0] });
    if (plan.some((p) => p.typ === 'rissfuerst')) this.melde(tr('Ein Rissfürst erhebt sich aus der Tiefe!'), 'schlecht');
    void faktor; faktor = 0;
  }
  /** Schaden je Sekunde, den die Türme entlang des Wegs von einem Riss anrichten könnten */
  private abwehrAmWeg(q: { x: number; z: number }): number {
    const weg: [number, number][] = []; let p: [number, number] | null = [q.x + 0.5, q.z + 0.5];
    for (let i = 0; i < 900 && p; i++) { if (i % 3 === 0) weg.push(p); p = this.feld.naechster(p[0], p[1]); }
    let n = 0;
    for (const g of this.gebaeude) {
      const k = this.kampf(g); if (!k || g.typ === 'haupt') continue;
      const cx = g.x + g.w / 2, cz = g.z + g.d / 2;
      if (weg.some(([x, z]) => mhypot(x - cx, z - cz) < k.reichweite)) n += k.schaden / Math.max(0.3, k.abklingen || 0.3);
    }
    return n;
  }
  private starteMorgen(): void {
    this.phase = 'morgen'; this.zeit = 0;
    const heil = this.erfindungen.has('kraeuterkunde') ? 0.45 : MORGEN_REPARATUR;
    for (const g of this.gebaeude) { g.hp = Math.min(g.max, g.hp + (g.max - g.hp) * heil); g.brand = 0; }
    const b = Object.entries(this.beuteNacht).filter(([, n]) => (n as number) > 0).map(([k, n]) => `${Math.round(n as number)} ${k === 'kristall' ? tr('Kristall') : tr(BAUSTEIN_NAME[k as Baustein])}`).join(', ');
    const tuerme = this.gebaeude.filter((g) => g.leistung > 0).sort((a, b) => b.leistung - a.leistung).slice(0, 5).map((g) => ({ name: tr(GEBAEUDE[g.typ].name) + (g.stufe > 1 ? ' ' + STUFE_NAME[g.stufe] : ''), schaden: Math.round(g.leistung) }));
    this.bericht = { nacht: this.nacht, besiegt: this.statBesiegt, beute: b || tr('nichts'), schaden: Math.round(this.statSchaden), zerstoert: this.statZerstoert, tuerme, kraftFehlt: this.kraftFehlt, einwohner: this.einwohner, wesen: this.statBesiegt };
    this.ereignisse.push({ art: 'phase', phase: 'morgen' });
    this.ereignisse.push({ art: 'bericht', bericht: this.bericht });
    this.melde(tr('Nacht {a} überstanden. Beute: {b}.', { a: this.nacht, b: b || tr('nichts') }), 'gut');
    if (this.hatWunder('w_aetherquelle')) this.res.kristall += 60;
    // Siegelsteine, die die Nacht überstanden haben, verschließen ihren Riss
    for (const g of this.gebaeude) if (g.typ === 'siegel' && g.ritual) {
      g.ritual = false; const q = this.rissNahe(g.x + 2, g.z + 2, 24);
      if (q) { this.versiegelt.add(q.name); this.ereignisse.push({ art: 'versiegelt', x: q.x, z: q.z, name: q.name }); this.melde(tr('Der {a} ist versiegelt! Von dort kommt nichts mehr.', { a: tr(q.name) }), 'gut'); }
    }
    const offen = this.alleRisse().filter((q) => !this.versiegelt.has(q.name)).length;
    if (offen === 0 || this.nacht >= ENDE_NACHT) this.siegen(offen === 0);
  }
  /** Ende der Partie: alle Risse versiegelt oder die letzte Nacht überstanden */
  sieg: { versiegelt: boolean; nacht: number } | null = null;
  private siegen(versiegelt: boolean): void {
    this.sieg = { versiegelt, nacht: this.nacht };
    this.phase = 'gewonnen'; this.ereignisse.push({ art: 'phase', phase: 'gewonnen' });
    this.melde(versiegelt ? tr('Alle Risse sind versiegelt. Die Wildnis ist besiegt!') : tr('Die letzte Nacht ist überstanden. Die Feste hat standgehalten!'), 'gut');
  }
  /** Neuer Tag: Einwohner essen, bei Überschuss und freiem Wohnraum wächst die Feste */
  private tagesbeginn(): void {
    const a = this.akt(); if (a.ab === this.nacht && a.nr > 1) { this.ereignisse.push({ art: 'akt', nr: a.nr }); this.melde(tr('Akt {a}: {b}. {c}', { a: a.nr, b: tr(a.name), c: tr(a.text) }), 'info'); }
    for (const o of this.omenVorschau()) this.melde(tr('Omen für Nacht {a}: {b}. {c}', { a: o.nacht, b: tr(OMEN[o.omen].name), c: tr(OMEN[o.omen].kurz) }), 'info');
    if (this.nacht === ENDE_NACHT) this.melde(tr('Die letzte Nacht bricht an. Halte stand!'), 'schlecht');
    for (const g of this.gebaeude) if (GEBAEUDE[g.typ].falle === 'spreng') g.cd = 0;
    for (const q of RISSE) if (q.ab === this.nacht && spalte(q.x, q.z)) this.melde(tr('Warnung: Heute Nacht öffnet sich der {a}. Die leuchtende Linie zeigt den neuen Weg.', { a: tr(q.name) }), 'schlecht');
    if (this.nacht % 5 === 0) this.melde(tr('Warnung: Heute Nacht kommt ein Rissfürst.'), 'schlecht');
    const bedarf = this.essen();
    if (this.res.nahrung >= bedarf) {
      this.res.nahrung -= bedarf;
      const platz = this.wohnraum() - this.einwohner;
      if (platz > 0 && this.res.nahrung >= ESSEN * 2) {
        const neu = Math.min(platz, Math.max(2, Math.round(this.einwohner * (this.erfindungen.has('kornspeicher') ? 0.3 : 0.2) * (this.leitsatz('volk') ? 1.5 : 1))), Math.floor(this.res.nahrung / ESSEN));
        if (neu > 0) { this.einwohner += neu; this.melde(tr('{a} neue Einwohner sind in die Feste gezogen (jetzt {b}).', { a: neu, b: this.einwohner }), 'gut'); }
      } else if (platz <= 0) this.melde(tr('Die Feste ist voll: Für mehr Einwohner braucht es Wohnhäuser.'), 'info');
    } else {
      const fehlt = bedarf - this.res.nahrung; this.res.nahrung = 0;
      const weg = Math.min(this.einwohner - 4, Math.max(1, Math.ceil(fehlt / ESSEN / 2)));
      if (weg > 0) { this.einwohner -= weg; this.melde(tr('Hunger! {a} Einwohner haben die Feste verlassen. Baue Bauernhöfe oder Fischerhütten.', { a: weg }), 'schlecht'); }
    }
    // ohne Wohnraum ziehen Einwohner nach und nach fort
    const ueber = this.einwohner - this.wohnraum();
    if (ueber > 0) { const weg = Math.ceil(ueber / 2); this.einwohner -= weg; this.melde(tr('{a} Einwohner ohne Dach haben die Feste verlassen.', { a: weg }), 'schlecht'); }
    this.stat.maxEinwohner = Math.max(this.stat.maxEinwohner, this.einwohner);
    this.verteileArbeiter();
  }
  private erzeuge(typ: GegTyp, riss: { x: number; z: number }): void {
    const omen = this.omenFuer(this.nacht), d = GEGNER[typ], s = staerke(this.nacht, SCHWIERIGKEIT[this.schwierigkeit].wachstum) * (omen === 'blutmond' ? 1.25 : 1);
    const a = this.r() * Math.PI * 2; let x = riss.x + mcos(a) * 3, z = riss.z + msin(a) * 3;
    if (!d.flug && this.feld.wert(x, z) === Infinity) { const p = this.erreichbarNahe(x, z); if (p) { x = p[0]; z = p[1]; } }
    this.gegner.push({ id: this.naechsteId++, typ, x, z, y: hoehe(x, z), hp: d.hp * s, max: d.hp * s, tempo: d.tempo * (0.9 + this.r() * 0.2) * (omen === 'blutmond' ? 1.2 : 1) * (omen === 'sturm' && d.flug ? 0.6 : 1), schaden: d.schaden * s, flug: !!d.flug, verborgen: !!d.verborgen, versatz: (this.r() - 0.5) * 0.7, ziel: null, angriff: 0, richtung: 0, tot: false, seit: 0, fracht: d.fracht || 0, brand: 0, brandDps: 0, langsam: 0, panzer: typ === 'troll' && this.nacht >= PANZER_AB, feuer: 0, nebenbei: 1 + this.r() * 2, bester: Infinity, stillstand: 0, wurf: 1 + this.r() * 2, zielGeb: 0, ruf: typ === 'aschegeist' ? 3 : typ === 'steinwerfer' ? 0 : 8, bossSchild: 0, schildGenutzt: false });
  }
  /** nächstes Gebäude der Wirtschaft (Ziel der Aschegeister) */
  private wirtschaftsZiel(x: number, z: number): Geb | undefined {
    let best: Geb | undefined, bd = Infinity;
    for (const g of this.gebaeude) if (WIRTSCHAFT.includes(g.typ)) { const d = mhypot(g.x + g.w / 2 - x, g.z + g.d / 2 - z); if (d < bd) { bd = d; best = g; } }
    return best;
  }
  /** Gebäude in Wurfweite (Steinwerfer): Türme zuerst */
  private wurfZiel(x: number, z: number, r: number): Geb | undefined {
    let best: Geb | undefined, bd = Infinity;
    for (const g of this.gebaeude) { if (g.typ === 'mauer') continue; const d = this.randAbstand(x, z, g) + (GEBAEUDE[g.typ].kampf ? 0 : 4); if (d < r && d < bd) { bd = d; best = g; } }
    return best;
  }
  /** Verarbeitung am Tag: Sägewerk, Schmelze, Schleiferei */
  private verarbeiten(): void {
    for (const g of this.gebaeude) {
      const u = GEBAEUDE[g.typ].umwandeln; if (!u || g.umbau) continue;
      const n = this.zugeteilt(g); if (!n) continue;
      let tempo = (n / this.arbeiterZahl(g)) * STUFE_WERT.ertrag[g.stufe] * (this.erfindungen.has('sternenernte') ? 2 : 1) * (this.volk === 'glutborn' && g.typ === 'schmelze' ? 2 : 1);
      tempo *= 1 + STUFE_WERT.arbeiter[g.stufe] * 0.25;
      g.cd += DT * tempo;
      if (g.cd >= u.dauer) {
        g.cd = 0;
        if (!this.kannBezahlen(u.von)) continue;
        for (const [r, m] of Object.entries(u.von)) this.res[r as Res] -= m as number;
        this.res[u.nach] += u.menge;
        this.ereignisse.push({ art: 'abgeliefert', x: g.x + g.w / 2, y: g.y + 2, z: g.z + g.d / 2, res: u.nach, menge: u.menge });
      }
    }
  }
  /** Gebäude fängt Feuer */
  zuende(g: Geb, dauer = 8): void {
    if (g.typ === 'mauer' || g.schild > 0 || (g.brandSchutz || 0) > 0) return;
    if (this.erfindungen.has('loeschtrupp')) dauer /= 2;
    if (this.volk === 'glutborn') dauer /= 2;
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
    for (let r = 1; r <= 40; r++) for (let a = 0; a < 16; a++) { const px = x + mcos(a / 16 * 6.283) * r, pz = z + msin(a / 16 * 6.283) * r; if (this.feld.wert(px, pz) < Infinity) return [Math.floor(px) + 0.5, Math.floor(pz) + 0.5]; }
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
      if (def.heilt) for (const o of this.gegner) if (o !== e && !o.tot && o.hp < o.max && Math.abs(o.x - e.x) < 7 && mhypot(o.x - e.x, o.z - e.z) < 7) { o.hp = Math.min(o.max, o.hp + def.heilt * DT * staerke(this.nacht, 0.08)); if (this.r() < DT * 0.6) this.ereignisse.push({ art: 'heilung', x: o.x, y: o.y + 1.5, z: o.z }); }
      if (def.boss) {
        if (e.bossSchild > 0) e.bossSchild -= DT;
        e.ruf -= DT;
        if (e.ruf <= 0) { e.ruf = 12; for (let i = 0; i < 2 + Math.floor(this.nacht / 10) * 2; i++) this.erzeuge(i % 2 && this.nacht >= 10 ? 'wolf' : 'moorwicht', { x: e.x + (this.r() - 0.5) * 4, z: e.z + (this.r() - 0.5) * 4 }); this.ereignisse.push({ art: 'abwurf', x: e.x, y: e.y + 3, z: e.z }); }
        if (!e.schildGenutzt && e.hp < e.max * 0.5) { e.schildGenutzt = true; e.bossSchild = 6; this.melde(tr('Der Rissfürst hüllt sich in einen Schild!'), 'schlecht'); }
      }
      const orgel = this.hatWunder('w_orgel');
      let tempo = e.tempo * (e.langsam > 0 ? 0.55 : 1) * (orgel && mhypot(e.x - hx, e.z - hz) < 45 ? 0.67 : 1);
      if (!e.flug) { // Fallen im Boden
        const f = this.gebAn(e.x, e.z), fa = f && GEBAEUDE[f.typ].falle;
        if (fa) {
          const st = (this.leitsatz('mauern') ? 2 : 1) * (this.erfindungen.has('aetherwall') ? 2 : 1);
          if (fa === 'dornen') { this.verletze(e, 10 * st * DT, true); tempo *= 0.6; }
          if (fa === 'oel') { tempo *= 0.35; if (e.brand > 0 || (f!.brand > 0)) { e.brand = 4; e.brandDps = 14 * st; } }
          if (fa === 'spreng' && f!.cd === 0) { f!.cd = 1; this.ereignisse.push({ art: 'explosion', x: e.x, y: e.y, z: e.z, r: 3 }); this.ereignisse.push({ art: 'falle', x: e.x, y: e.y, z: e.z, typ: 'spreng' }); for (const o of this.gegner) if (!o.flug && mhypot(o.x - e.x, o.z - e.z) < 3.2) this.verletze(o, 120 * st * staerke(this.nacht, 0.08), true); }
          if (e.tot) continue;
        }
      }
      // Steinwerfer: bleibt stehen, sobald ein Gebäude in Wurfweite ist
      if (def.fern) {
        e.wurf -= DT;
        if (e.wurf <= 0) {
          const g = this.wurfZiel(e.x, e.z, def.fern);
          if (g) {
            e.wurf = 3; e.zielGeb = g.id; e.ruf--; const gx = g.x + g.w / 2, gz = g.z + g.d / 2, d = mhypot(gx - e.x, gz - e.z);
            this.geschosse.push({ art: 'stein', x: e.x, y: e.y + 2, z: e.z, sx: e.x, sy: e.y + 2, sz: e.z, tx: gx, ty: g.y + 3, tz: gz, t: 0, dauer: 0.6 + d / 18, ziel: 0, zielGeb: g.id, schaden: e.schaden, flaeche: 0, trifft: true, bogen: 4 + d * 0.3, brand: 0, brechend: false, von: 0 });
            e.richtung = matan2(gx - e.x, gz - e.z);
          } else { e.wurf = 0.5; e.zielGeb = 0; }
        }
        // nach zehn Würfen rückt er weiter vor
        if (e.zielGeb && e.ruf > -10 && this.gebaeude.some((g) => g.id === e.zielGeb)) { e.stillstand = 0; e.angriff = 0.01; continue; }
      }
      // im Vorbeigehen: Gebäude in Reichweite schwächen, ohne stehen zu bleiben
      if (e.nebenbei <= 0) {
        e.nebenbei = e.flug ? 3.5 : 2.2;
        const g = this.gebNahe(e.x, e.z, e.flug ? 6 : 2);
        if (g && g.typ !== 'mauer' && g.typ !== 'haupt' && !GEBAEUDE[g.typ].falle && this.randAbstand(e.x, e.z, g) < (e.flug ? 6 : 1.8)) {
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
        const gx = g.x + g.w / 2, gz = g.z + g.d / 2, dx = gx - e.x, dz = gz - e.z, dist = mhypot(dx, dz);
        if (this.randAbstand(e.x, e.z, g) > 1.5) { e.x += (dx / dist) * tempo * DT; e.z += (dz / dist) * tempo * DT; e.richtung = matan2(dx, dz); }
        else { this.schlage(e, g); e.stillstand += DT; if (e.stillstand > 20) { e.tot = true; this.ereignisse.push({ art: 'tod', typ: e.typ, x: e.x, y: e.y, z: e.z }); continue; } }
        e.y = hoehe(e.x, e.z) + 3.5 + msin(e.seit * 3 + e.id) * 0.4;
        continue;
      }
      if (e.flug) {
        const dx = hx - e.x, dz = hz - e.z, dist = mhypot(dx, dz);
        if (e.fracht && dist < 18) { // Nebelrochen setzt Moorwichte hinter den Mauern ab
          for (let i = 0; i < e.fracht; i++) { this.erzeuge('moorwicht', { x: e.x + (this.r() - 0.5) * 2, z: e.z + (this.r() - 0.5) * 2 }); }
          this.ereignisse.push({ art: 'abwurf', x: e.x, y: e.y, z: e.z }); e.fracht = 0;
        }
        if (dist > 5) { e.x += (dx / dist) * tempo * DT; e.z += (dz / dist) * tempo * DT; e.richtung = matan2(dx, dz); }
        else this.schlage(e, h);
        e.y = hoehe(e.x, e.z) + 9 + msin(e.seit * 2 + e.id) * 0.6;
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
      if (!e.ziel || mhypot(e.ziel[0] - e.x, e.ziel[1] - e.z) < 0.25) e.ziel = this.feld.naechster(e.x, e.z);
      if (!e.ziel) { // am Hauptgebäude angekommen (oder eingeschlossen): nächstes Gebäude angreifen
        const g = this.gebNahe(e.x, e.z, 2) || h;
        if (this.randAbstand(e.x, e.z, g) < 2.2) this.schlage(e, g); continue;
      }
      const blocker0 = this.gebAn(e.ziel[0], e.ziel[1]), blocker = blocker0 && GEBAEUDE[blocker0.typ].falle ? undefined : blocker0;
      if (blocker && blocker.typ === 'mauer' && this.erfindungen.has('dornenwall')) this.verletze(e, 6 * DT, true);
      if (blocker) { this.schlage(e, blocker); e.richtung = matan2(e.ziel[0] - e.x, e.ziel[1] - e.z); continue; }
      const dx = e.ziel[0] - e.x, dz = e.ziel[1] - e.z, dist = mhypot(dx, dz) || 1;
      const sp0 = spalte(Math.floor(e.x), Math.floor(e.z));
      const sp = tempo * DT * (sp0?.a === 'w' ? 0.5 : this.dekoJetzt(Math.floor(e.x), Math.floor(e.z), sp0)?.art === 'baum' ? 0.75 : 1);
      // seitlicher Versatz, damit nicht alle auf einer Linie laufen
      const nx = -dz / dist, nz = dx / dist;
      e.x += (dx / dist) * Math.min(sp, dist) + nx * e.versatz * DT * 0.6;
      e.z += (dz / dist) * Math.min(sp, dist) + nz * e.versatz * DT * 0.6;
      e.richtung = matan2(dx, dz);
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
    return mhypot(dx, dz);
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
    if (g.schild > 0 || GEBAEUDE[g.typ].falle || !this.gebaeude.includes(g)) return;
    const ss = this.hatWunder('w_sternenschild'); if (ss && mhypot(ss.x + 3 - g.x - g.w / 2, ss.z + 3 - g.z - g.d / 2) < 40) n *= 0.7;
    g.hp -= n; this.statSchaden += n;
    if (!leise) this.ereignisse.push({ art: 'schaden', geb: g });
    if (g.hp <= 0) {
      if (g.typ === 'haupt') { this.phase = 'verloren'; this.ereignisse.push({ art: 'phase', phase: 'verloren' }); this.melde(tr('Die Feste ist gefallen – nach {a} überstandenen Nächten.', { a: this.nacht - 1 }), 'schlecht'); return; }
      this.entferne(g, true);
      if (g.typ !== 'mauer') { this.statZerstoert.push(tr(GEBAEUDE[g.typ].name)); this.stat.zerstoert++; }
      if (g.typ !== 'mauer') {
        const ru: Ruine = { id: this.naechsteId++, typ: g.typ, x: g.x, z: g.z, w: g.w, d: g.d, y: g.y, zweig: g.zweig };
        this.ruinen.push(ru); this.ereignisse.push({ art: 'ruine', ruine: ru, neu: true });
      }
      this.melde(tr('{a} wurde zerstört. Die Ruine lässt sich am Tag wieder aufbauen.', { a: tr(GEBAEUDE[g.typ].name) }), 'schlecht');
    }
  }

  private ziele(g: Geb, k: Kampf, anzahl: number): { e: Gegner; hell: boolean }[] {
    const nacht = this.phase === 'nacht', runen = this.erfindungen.has('runenpfeile') && k.geschoss === 'pfeil';
    const tx = g.x + g.w / 2, tz = g.z + g.d / 2, liste: { e: Gegner; hell: boolean; prio: number }[] = [];
    for (const e of this.gegner) {
      if (e.tot || (k.nurBoden && e.flug)) continue;
      const d = mhypot(e.x - tx, e.z - tz); if (d > k.reichweite) continue;
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
        for (const e of this.gegner) { const d = mhypot(e.x - g.x - 1, e.z - g.z - 1); if (d < bd) { bd = d; ziel = e; } }
        const soll = ziel ? matan2(ziel.x - g.x - 1, ziel.z - g.z - 1) : g.zielen + 0.4 * DT;
        let da = soll - g.zielen; da = matan2(msin(da), mcos(da)); g.zielen += Math.max(-1.4 * DT, Math.min(1.4 * DT, da));
      }
      const k = this.kampf(g); if (!k || g.umbau) { g.strahlen.length = 0; continue; }
      const tx = g.x + g.w / 2, tz = g.z + g.d / 2;
      const sy = g.y + (g.typ === 'haupt' ? 14 : k.geschoss === 'pfeil' ? 10 : 12);
      // Dauerwaffen: Strahl und Sturmkrone wirken jeden Takt
      if (k.geschoss === 'strahl') {
        const z = this.ziele(g, k, k.ziele || 1); g.strahlen = z.map((t) => t.e.id);
        if (z.length) g.zielen = matan2(z[0].e.x - tx, z[0].e.z - tz);
        for (const t of z) this.verletze(t.e, k.schaden * DT * (t.hell ? 1 : 0.6), true, g, 'strahl');
        continue;
      }
      if (k.geschoss === 'aura') {
        g.cd -= DT;
        let n = 0; for (const e of this.gegner) if (!e.tot && mhypot(e.x - tx, e.z - tz) < k.reichweite) { this.verletze(e, k.schaden * DT, true, g, 'blitz'); n++; }
        if (n && g.cd <= 0) { g.cd = 0.5; const pk: [number, number, number][] = [[tx, sy + 2, tz]]; const e = this.gegner.find((o) => !o.tot && mhypot(o.x - tx, o.z - tz) < k.reichweite); if (e) pk.push([e.x, e.y + 1, e.z]); this.ereignisse.push({ art: 'blitz', punkte: pk }); }
        continue;
      }
      g.cd -= DT; if (g.cd > 0) continue;
      const z = this.ziele(g, k, k.ziele || 1); if (!z.length) continue;
      g.cd = k.abklingen; g.zielen = matan2(z[0].e.x - tx, z[0].e.z - tz);
      this.ereignisse.push({ art: 'schuss', geb: g, x: tx, y: sy, z: tz, geschoss: k.geschoss === 'topf' ? 'topf' : 'pfeil' });
      if (k.geschoss === 'blitz') {
        const pk: [number, number, number][] = [[tx, sy + 2, tz]], getroffen = new Set<number>();
        let aktuell: Gegner | undefined = z[0].e;
        for (let i = 0; aktuell && i <= (k.kette || 0); i++) {
          getroffen.add(aktuell.id); pk.push([aktuell.x, aktuell.y + 1, aktuell.z]); this.verletze(aktuell, k.schaden * mpow(0.85, i), true, g, 'blitz');
          let naechst: Gegner | undefined, bd = 7;
          for (const e of this.gegner) { if (e.tot || getroffen.has(e.id)) continue; const d = mhypot(e.x - aktuell.x, e.z - aktuell.z); if (d < bd) { bd = d; naechst = e; } }
          aktuell = naechst;
        }
        this.ereignisse.push({ art: 'blitz', punkte: pk });
        continue;
      }
      for (const { e: best, hell } of z) {
        if (k.geschoss === 'pfeil') {
          const d = mhypot(best.x - tx, best.z - tz);
          this.geschosse.push({ art: 'pfeil', x: tx, y: sy, z: tz, sx: tx, sy, sz: tz, tx: best.x, ty: best.y + (best.flug ? 0 : 1), tz: best.z, t: 0, dauer: d / 30 + 0.05, ziel: best.id, schaden: k.schaden, flaeche: k.flaeche || 0, trifft: this.r() > (hell ? 0.05 : 0.38), bogen: d * 0.06, brand: k.brand || 0, brechend: !!k.panzerbrechend, von: g.id });
        } else {
          for (let s = 0; s < (k.salve || 1); s++) {
            const dauer = 1.25, vx = best.ziel ? (best.ziel[0] - best.x) : 0, vz = best.ziel ? (best.ziel[1] - best.z) : 0, vl = mhypot(vx, vz) || 1;
            const px = best.x + (vx / vl) * best.tempo * dauer, pz = best.z + (vz / vl) * best.tempo * dauer;
            const streu = (hell ? 0.6 : 2.2) + (k.salve ? 3 : 0);
            const zx = px + (this.r() - 0.5) * streu, zz = pz + (this.r() - 0.5) * streu;
            this.geschosse.push({ art: 'topf', x: tx, y: sy, z: tz, sx: tx, sy, sz: tz, tx: zx, ty: hoehe(zx, zz), tz: zz, t: -s * 0.12, dauer, ziel: 0, schaden: k.schaden, flaeche: k.flaeche!, trifft: true, bogen: 6 + mhypot(zx - tx, zz - tz) * 0.25, brand: k.brand || 0, brechend: !!k.panzerbrechend, von: g.id });
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
      p.x = p.sx + (p.tx - p.sx) * f; p.z = p.sz + (p.tz - p.sz) * f; p.y = p.sy + (p.ty - p.sy) * f + msin(Math.PI * f) * p.bogen;
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
          if (p.flaeche) for (const e of this.gegner) if (e !== z && !e.flug && mhypot(e.x - z.x, e.z - z.z) < p.flaeche) { e.brand = brandZeit; e.brandDps = p.brand || 4; }
        } else this.ereignisse.push({ art: 'fehl', x: p.tx, y: p.ty, z: p.tz });
      } else {
        this.ereignisse.push({ art: 'explosion', x: p.tx, y: p.ty, z: p.tz, r: p.flaeche });
        for (const e of this.gegner) { if ((e.flug && !GEGNER[e.typ].wirtschaft) || e.tot) continue; const d = mhypot(e.x - p.tx, e.z - p.tz); if (d < p.flaeche) { this.verletze(e, p.schaden * (1 - d / p.flaeche * 0.6), p.brechend, von, 'topf'); if (p.brand) { e.brand = brandZeit; e.brandDps = p.brand; } } }
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
    if (e.flug) { if (E.has('sternensegel')) n *= 1.4; if (this.volk === 'sturmweber') n *= 1.25; }
    const echt = Math.min(n, Math.max(0, e.hp));
    e.hp -= n; if (von) von.leistung += echt;
    if (e.hp > 0) return;
    e.tot = true; this.besiegt++; this.statBesiegt++;
    const d = GEGNER[e.typ];
    this.ereignisse.push({ art: 'tod', typ: e.typ, x: e.x, y: e.y, z: e.z });
    const kr = d.kristall * (0.6 + this.r() * 0.8) * (e.panzer ? 2 : 1);
    this.res.kristall += kr; this.beuteNacht.kristall = (this.beuteNacht.kristall || 0) + kr;
    const bf = (this.omenFuer(this.nacht) === 'blutmond' ? 2 : 1) * (this.leitsatz('ernte') ? 1.5 : 1);
    for (const [b, p0, anzahl] of d.beute) { const p = Math.min(1, p0 * bf); if (this.r() < p) { const k = anzahl || 1; this.bausteine[b] += k; this.beuteNacht[b] = (this.beuteNacht[b] || 0) + k; } }
    if (d.boss) this.stat.bosse++;
    if (d.boss) this.melde(tr('Der Rissfürst ist gefallen! Reiche Beute bleibt zurück.'), 'gut');
  }

  // ---------------- Umrüsten, Verschmelzen, Ausbau, Ruinen, Fähigkeiten ----------------
  umruestOptionen(g: Geb): GebTyp[] { return (Object.keys(GEBAEUDE) as GebTyp[]).filter((t) => GEBAEUDE[t].von === g.typ && (!GEBAEUDE[t].volk || GEBAEUDE[t].volk === this.volk)); }
  umruesten(g: Geb, nach: GebTyp, zweig?: string): boolean {
    const d = GEBAEUDE[nach];
    if (this.phase !== 'tag') { this.melde(tr('Umgerüstet wird nur am Tag.'), 'schlecht'); return false; }
    if (d.von !== g.typ || g.umbau) return false;
    if (!this.freigeschaltet(nach)) { this.melde(tr('{a} braucht die Erfindung {b}.', { a: tr(d.name), b: tr(ERFINDUNGEN[d.braucht!].name) }), 'schlecht'); return false; }
    if (d.zweige && !d.zweige.some((z) => z.id === zweig)) return false;
    if (d.zeitalter === 5 && g.stufe < 3) { this.melde(tr('Ins Zeitalter Äther & Sterne lassen sich nur Türme auf Stufe III umrüsten.'), 'schlecht'); return false; }
    if (!this.kannBezahlen(d.kosten)) { this.melde(tr('Für {a} fehlen Rohstoffe: {b}.', { a: tr(d.name), b: kostenText(d.kosten) }), 'schlecht'); return false; }
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
      if (mhypot(o.x + o.w / 2 - g.x - g.w / 2, o.z + o.d / 2 - g.z - g.d / 2) > 8.5) continue;
      const v = VERSCHMELZUNGEN.find((v) => (v.a === la && v.b === lb) || (v.a === lb && v.b === la)); if (!v) continue;
      if (this.zeitalter() < (GEBAEUDE[v.ergebnis].zeitalter || 1)) continue;
      out.push({ partner: o, ergebnis: v.ergebnis });
    }
    return out;
  }
  verschmelzen(g: Geb, partner: Geb): boolean {
    const opt = this.verschmelzOptionen(g).find((o) => o.partner === partner); if (!opt) return false;
    if (this.phase !== 'tag') { this.melde(tr('Verschmolzen wird nur am Tag.'), 'schlecht'); return false; }
    const d = GEBAEUDE[opt.ergebnis];
    // Fernkampf-Turm bleibt stehen, der Partner geht in ihm auf
    let ziel = g, weg = partner;
    if (linie(g.typ) !== 'fern' && linie(partner.typ) === 'fern') { ziel = partner; weg = g; }
    if (d.w !== ziel.w) { this.melde(tr('Diese beiden passen nicht zusammen.'), 'schlecht'); return false; }
    if (!this.kannBezahlen(d.kosten)) { this.melde(tr('Für {a} fehlen Rohstoffe: {b}.', { a: tr(d.name), b: kostenText(d.kosten) }), 'schlecht'); return false; }
    for (const [r, n] of Object.entries(d.kosten)) this.res[r as Res] -= n as number;
    this.entferne(weg, false);
    ziel.umbau = { t: 0, dauer: UMBAU_DAUER, nach: opt.ergebnis };
    if (!this.entdeckt.has(opt.ergebnis)) { this.entdeckt.add(opt.ergebnis); this.melde(tr('Neue Verbindung entdeckt: {a}. Sie steht jetzt im Rezeptbuch.', { a: tr(d.name) }), 'gut'); }
    this.ereignisse.push({ art: 'reparatur', geb: ziel, fertig: false });
    return true;
  }
  hauptAusbau(): typeof HAUPT_STUFEN[number] | undefined { const h = this.haupt; return h ? HAUPT_STUFEN[h.stufe] : undefined; }
  hauptAusbauen(): boolean {
    const h = this.haupt, st = this.hauptAusbau(); if (!h || !st) return false;
    if (this.phase !== 'tag') { this.melde(tr('Ausgebaut wird nur am Tag.'), 'schlecht'); return false; }
    if (h.umbau) return false;
    if (st.braucht && !this.erfindungen.has(st.braucht)) { this.melde(tr('Stufe {a} braucht die Erfindung {b}.', { a: st.stufe, b: tr(ERFINDUNGEN[st.braucht].name) }), 'schlecht'); return false; }
    if (!this.kannBezahlen(st.kosten)) { this.melde(tr('Für Stufe {a} fehlen Rohstoffe: {b}.', { a: st.stufe, b: kostenText(st.kosten) }), 'schlecht'); return false; }
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
    if (!this.faehigkeitFrei(name)) { this.melde(tr('Diese Fähigkeit ist in dieser Nacht schon verbraucht.'), 'schlecht'); return false; }
    this.genutzt.set(name, (this.genutzt.get(name) || 0) + 1);
    const hx = h.x + h.w / 2, hz = h.z + h.d / 2;
    if (name === 'feuerregen') for (let i = 0; i < 8; i++) { const a = this.r() * 6.283, d = Math.sqrt(this.r()) * 5, zx = x + mcos(a) * d, zz = z + msin(a) * d; this.geschosse.push({ art: 'topf', x: hx, y: h.y + 20, z: hz, sx: hx, sy: h.y + 20, sz: hz, tx: zx, ty: hoehe(zx, zz), tz: zz, t: -i * 0.15, dauer: 1.6, ziel: 0, schaden: 45, flaeche: 3, trifft: true, bogen: 14, brand: 6, brechend: true, von: 0 }); }
    if (name === 'notreparatur') for (const g of this.gebaeude) g.hp = Math.min(g.max, g.hp + g.max / 3);
    if (name === 'schild') h.schild = this.erfindungen.has('aetherspeicher') ? 25 : 15;
    if (name === 'sturmglocke') this.sturm = 12;
    if (name === 'dampfstoss') for (const e of this.gegner) {
      const dx = e.x - hx, dz = e.z - hz, d = mhypot(dx, dz); if (d > 20 || e.tot) continue;
      if (!e.flug) { const nx = e.x + (dx / (d || 1)) * 8, nz = e.z + (dz / (d || 1)) * 8; if (begehbar(spalte(Math.floor(nx), Math.floor(nz))) && !this.gebAn(nx, nz)) { e.x = nx; e.z = nz; e.y = hoehe(nx, nz); e.ziel = null; } }
      e.langsam = 4; this.verletze(e, 40, true);
    }
    this.ereignisse.push({ art: 'faehigkeit', name, x, z });
    return true;
  }
  wiederaufbauKosten(r: Ruine): Kosten { const k: Kosten = {}; for (const [res, n] of Object.entries(GEBAEUDE[r.typ].kosten)) k[res as Res] = Math.ceil((n as number) * 0.5); return k; }
  wiederaufbauen(r: Ruine): boolean {
    if (this.phase !== 'tag') { this.melde(tr('Wiederaufgebaut wird nur am Tag.'), 'schlecht'); return false; }
    if (GEBAEUDE[r.typ].kampf && this.turmZahl() >= this.turmGrenze()) { this.melde(tr('Turmgrenze erreicht ({a}). Baue die Burg aus.', { a: this.turmGrenze() }), 'schlecht'); return false; }
    const k = this.wiederaufbauKosten(r);
    if (!this.kannBezahlen(k)) { this.melde(tr('Für den Wiederaufbau fehlen Rohstoffe: {a}.', { a: kostenText(k) }), 'schlecht'); return false; }
    for (const [res, n] of Object.entries(k)) this.res[res as Res] -= n as number;
    this.ruinen = this.ruinen.filter((o) => o !== r); this.ereignisse.push({ art: 'ruine', ruine: r, neu: false });
    const g = this.setze(r.typ, r.x, r.z); g.zweig = r.zweig;
    if (!GEBAEUDE[r.typ].bauzeit) this.bauBeginnen(g);
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
    this.gebaeude.push(g); if (def.falle) this.fallenIds.add(g.id);
    if (def.arbeit && !this.laedt) this.verteileArbeiter();
    // auf einem Stumpf gebaut: dort wächst nichts mehr nach
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) { const k = Spiel.kachel(x, z); if (this.gefaellt.has(k)) this.gefaellt.set(k, -2e9); }
    if (def.sicht) this.aufdecken(x0 + def.w / 2, z0 + def.d / 2, def.sicht);
    this.feldAlt = true; this.lichterNeu(); this.quellVersion++;
    if (def.bauzeit && !this.laedt) { g.umbau = { t: 0, dauer: def.bauzeit, nach: typ }; }
    if (!this.laedt) this.stat.gebaut++;
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
      for (const o of orte()) if (o.typ === 'kristall' && mhypot(o.x - cx, o.z - cz) < r + 4) for (const [dx, dz] of [[-2, 0], [2, 1], [0, 2], [1, -2]]) out.push({ x: o.x + dx + 0.5, z: o.z + dz + 0.5, k: -1, d: mhypot(o.x + dx - cx, o.z + dz - cz), dauerhaft: true });
      return out.sort((a, b) => a.d - b.d);
    }
    if (typ === 'hof') { // Felder rund um den Hof: jede freie Graskachel im Umkreis
      for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) {
        const d = mhypot(x + 0.5 - cx, z + 0.5 - cz); if (d > r || d < 3.5) continue;
        const s = spalte(x, z); if (!s || s.a !== 'gras' || this.belegt[this.bi(x, z)] || amPfad(x, z, 1.5)) continue;
        const dk = this.dekoJetzt(x, z, s); if (dk && dk.art !== 'gras') continue;
        if ((x + z * 3) % 4) continue; // jede vierte Kachel: Furchen
        out.push({ x: x + 0.5, z: z + 0.5, k: -1, d, dauerhaft: true });
      }
      return out.sort((a, b) => a.d - b.d);
    }
    if (typ === 'fischer') { // Wasser mit Ufer daneben
      for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) {
        const d = mhypot(x + 0.5 - cx, z + 0.5 - cz); if (d > r) continue;
        const s = spalte(x, z); if (!s || s.a !== 'w' || (x + z) % 3) continue;
        if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => begehbar(spalte(x + dx, z + dz)))) continue;
        out.push({ x: x + 0.5, z: z + 0.5, k: -1, d, dauerhaft: true });
      }
      return out.sort((a, b) => a.d - b.d);
    }
    for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) {
      const d = mhypot(x + 0.5 - cx, z + 0.5 - cz); if (d > r) continue;
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
      const arb0 = this.arbeit(g);
      if (!arb0) { // Verarbeitung: Arbeiter stehen am Gebäude und werkeln
        const i = this.arbeiter.filter((o) => o.geb === g.id).indexOf(a), px = g.x + 0.5 + (i % 3) * 1.5, pz = g.z + g.d + 0.7;
        if (!tag) { a.zustand = 'drin'; continue; }
        const dx = px - a.x, dz = pz - a.z, d = mhypot(dx, dz);
        if (d > 0.3) { const sp = Math.min(d, 3 * DT); a.x += dx / d * sp; a.z += dz / d * sp; a.y = hoehe(a.x, a.z); a.richtung = matan2(dx, dz); a.zustand = 'hin'; }
        else { a.zustand = 'arbeit'; a.richtung = Math.PI; a.t += DT; if (Math.floor((a.t - DT) / 0.9) !== Math.floor(a.t / 0.9)) this.ereignisse.push({ art: 'hieb', x: a.x, y: a.y + 1, z: a.z - 0.8, res: g.typ === 'saegewerk' ? 'holz' : g.typ === 'schleiferei' ? 'kristall' : 'stein' }); }
        continue;
      }
      const arb = arb0;
      const hx = g.x + g.w / 2, hz = g.z + g.d + 0.6;
      // um Wasser und Lava herum: Wegpunkte folgen, der letzte ist das Ziel
      const gehe = (zx: number, zz: number, tempo: number): boolean => {
        let w = this.wege.get(a.id);
        if (!w || Math.abs(w.zx - zx) > 2 || Math.abs(w.zz - zz) > 2) { w = { zx, zz, p: trockenerWeg(a.x, a.z, zx, zz) || [], i: 0 }; this.wege.set(a.id, w); }
        const letzter = w.i >= w.p.length - 1, [tx, tz] = w.i < w.p.length ? w.p[w.i] : [zx, zz];
        const dx = tx - a.x, dz = tz - a.z, d = mhypot(dx, dz);
        if (d < (letzter ? 0.6 : 0.3)) { if (letzter) { this.wege.delete(a.id); return true; } w.i++; return false; }
        const sp = Math.min(d, tempo * DT); a.x += (dx / d) * sp; a.z += (dz / d) * sp; a.richtung = matan2(dx, dz); a.y = hoehe(a.x, a.z);
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
        const [zx, zz] = a.ziel!, dx = a.x - zx, dz = a.z - zz, d = mhypot(dx, dz) || 1;
        if (gehe(zx + (dx / d) * 0.9, zz + (dz / d) * 0.9, 3.2)) { a.zustand = 'arbeit'; a.t = 0; a.richtung = matan2(zx - a.x, zz - a.z); }
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
    if (bx - ax + 1 > EBNEN_MAX || bz - az + 1 > EBNEN_MAX) return { ok: false, grund: tr('Höchstens {a} × {b} Blöcke auf einmal.', { a: EBNEN_MAX, b: EBNEN_MAX }), stein: 0, ziel, kacheln: 0 };
    let stein = 0, kacheln = 0;
    for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) {
      const s = spalte(x, z);
      if (!s) return { ok: false, grund: tr('Hier ist kein Land.'), stein, ziel, kacheln };
      if (!this.erkundetAn(x, z)) return { ok: false, grund: tr('Noch im Nebel.'), stein, ziel, kacheln };
      if (s.a === 'w' || s.a === 'l') return { ok: false, grund: tr('Wasser und Lava lassen sich nicht ebnen.'), stein, ziel, kacheln };
      if (this.belegt[this.bi(x, z)]) return { ok: false, grund: tr('Auf der Fläche steht ein Gebäude.'), stein, ziel, kacheln };
      const d = Math.abs(s.h - ziel); if (d) { stein += d * EBNEN_STEIN; kacheln++; }
    }
    if (!kacheln) return { ok: false, grund: tr('Die Fläche ist schon eben.'), stein: 0, ziel, kacheln };
    if (ziel >= 14) return { ok: false, grund: tr('Zu hoch: oben auf den Bergen lässt sich nicht bauen.'), stein, ziel, kacheln };
    if (this.res.stein < stein) return { ok: false, grund: tr('Nicht genug Stein ({a} nötig).', { a: stein }), stein, ziel, kacheln };
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
    this.melde(tr('Gelände geebnet: {a} Blöcke, {b} Stein.', { a: p.kacheln, b: p.stein }), 'gut');
    return true;
  }
  // ---------------- Reparieren ----------------
  reparaturKosten(g: Geb): Kosten {
    const def = GEBAEUDE[g.typ], basis = def.reparatur || Object.fromEntries(Object.entries(def.kosten).map(([r, n]) => [r, (n as number) * 0.5])), f = Math.max(0, 1 - g.hp / g.max);
    const k: Kosten = {}; for (const [r, n] of Object.entries(basis)) { const v = Math.ceil((n as number) * f); if (v > 0) k[r as Res] = v; }
    return k;
  }
  reparieren(g: Geb, still = false): boolean {
    if (this.phase !== 'tag') { if (!still) this.melde(tr('Repariert wird nur am Tag.'), 'schlecht'); return false; }
    if (g.rep || g.hp >= g.max - 0.5) return false;
    const k = this.reparaturKosten(g);
    if (!this.kannBezahlen(k)) { if (!still) this.melde(tr('Für die Reparatur fehlen Rohstoffe: {a}.', { a: kostenText(k) }), 'schlecht'); return false; }
    for (const [r, n] of Object.entries(k)) this.res[r as Res] -= n as number;
    const f = 1 - g.hp / g.max; g.rep = { t: 0, dauer: 3 + 10 * f, von: g.hp };
    this.ereignisse.push({ art: 'reparatur', geb: g, fertig: false });
    return true;
  }
  beschaedigt(): Geb[] { return this.gebaeude.filter((g) => !g.rep && g.hp < g.max - 0.5); }
  alleReparaturKosten(): Kosten { const k: Kosten = {}; for (const g of this.beschaedigt()) for (const [r, n] of Object.entries(this.reparaturKosten(g))) k[r as Res] = (k[r as Res] || 0) + (n as number); return k; }
  alleReparieren(): number { let n = 0; for (const g of this.beschaedigt().sort((a, b) => (a.typ === 'haupt' ? -1 : 0) - (b.typ === 'haupt' ? -1 : 0))) if (this.reparieren(g, true)) n++; if (!n) this.melde(this.phase !== 'tag' ? tr('Repariert wird nur am Tag.') : tr('Nichts zu reparieren oder nicht genug Rohstoffe.'), 'schlecht'); return n; }
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
    this.lichter = this.gebaeude.filter((g) => GEBAEUDE[g.typ].licht > 0 && !Spiel.imBau(g)).map((g) => {
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
      F.kosten[k] = g && G[k] !== Infinity && !this.fallenIds.has(g) ? (g === h.id ? 1 : 30) : G[k];
    }
    const q: [number, number][] = [];
    for (let x = h.x - 1; x <= h.x + h.w; x++) for (let z = h.z - 1; z <= h.z + h.d; z++) q.push([x, z]);
    this.feld.berechne(q);
  }
  aufdecken(x: number, z: number, r: number): void {
    let neu = false;
    for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) {
      const cx = -WR + (i + 0.5) * NZ, cz = -WR + (j + 0.5) * NZ;
      if (mhypot(cx - x, cz - z) <= r && !this.erkundet[i * NN + j]) { this.erkundet[i * NN + j] = 1; neu = true; }
    }
    if (neu) this.ereignisse.push({ art: 'erkundet' });
  }
  melde(text: string, ton: 'gut' | 'schlecht' | 'info' = 'info'): void { this.ereignisse.push({ art: 'meldung', text, ton }); }

  // ---------------- Speichern ----------------
  speichern(): Spielstand {
    let s = ''; for (let i = 0; i < this.erkundet.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) b |= this.erkundet[i + k] << k; s += String.fromCharCode(b); }
    return { v: 4, volk: this.volk, leitsaetze: [...this.leitsaetze], leitsatzOffen: this.leitsatzOffen, versiegelt: [...this.versiegelt], stat: this.stat, einwohner: this.einwohner, schwierigkeit: this.schwierigkeit, gefaellt: [...this.gefaellt], abgebaut: [...this.abgebaut], gaenge: [...this.gaenge], hoehen: hoehenListe(), code: this.code, nacht: this.nacht, phase: this.phase === 'verloren' ? 'verloren' : 'tag', zeit: this.phase === 'tag' ? this.zeit : 0,
      res: { ...this.res }, bausteine: { ...this.bausteine }, erfindungen: [...this.erfindungen],
      gebaeude: this.gebaeude.map((g) => ({ typ: g.typ, x: g.x, z: g.z, hp: g.hp, zweig: g.zweig, stufe: g.stufe, bau: Spiel.imBau(g) ? g.umbau!.t : undefined, ritual: g.ritual })), erkundet: btoa(s), besiegt: this.besiegt,
      ruinen: this.ruinen.map((r) => ({ typ: r.typ, x: r.x, z: r.z, zweig: r.zweig })), entdeckt: [...this.entdeckt] };
  }
  private laden(st: Spielstand): void {
    this.laedt = true;
    this.nacht = st.nacht; this.phase = st.phase; this.zeit = st.zeit; this.res = Object.assign({ holz: 0, stein: 0, kristall: 0, nahrung: 0 }, st.res); this.bausteine = { ...st.bausteine };
    this.einwohner = st.einwohner ?? START.einwohner; this.schwierigkeit = st.schwierigkeit || 'normal';
    this.volk = st.volk || 'glutborn'; this.leitsaetze = new Map(st.leitsaetze || []); this.leitsatzOffen = st.leitsatzOffen || 0;
    this.versiegelt = new Set(st.versiegelt || []); if (st.stat) this.stat = { ...this.stat, ...st.stat };
    this.erfindungen = new Set(st.erfindungen); this.besiegt = st.besiegt || 0;
    this.gefaellt = new Map(st.gefaellt || []); this.abgebaut = new Map(st.abgebaut || []); this.gaenge = new Map(st.gaenge || []);
    for (const [k, h] of st.hoehen || []) setzeHoehe(Math.floor(k / 2048) - 600, (k % 2048) - 600, h);
    const bin = atob(st.erkundet); for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); for (let k = 0; k < 8; k++) this.erkundet[i * 8 + k] = (b >> k) & 1; }
    this.entdeckt = new Set(st.entdeckt || []);
    for (const g of st.gebaeude) { if (!GEBAEUDE[g.typ]) continue; const n = this.setze(g.typ, g.x, g.z); n.zweig = g.zweig; n.stufe = g.stufe || 1; n.max = this.grundHp(n); n.hp = Math.min(n.max, g.hp); n.ritual = g.ritual; if (g.bau !== undefined) n.umbau = { t: g.bau, dauer: Spiel.bauDauer(g.typ), nach: g.typ, kurz: !GEBAEUDE[g.typ].bauzeit }; }
    for (const r of st.ruinen || []) { const d = GEBAEUDE[r.typ]; if (d) this.ruinen.push({ id: this.naechsteId++, typ: r.typ, x: r.x, z: r.z, w: d.w, d: d.d, y: this.pruefeRoh(r.typ, r.x, r.z), zweig: r.zweig }); }
    this.laedt = false;
    this.lichterNeu(); this.verteileArbeiter();
    this.ereignisse = this.ereignisse.filter((e) => e.art !== 'meldung');
  }
}
