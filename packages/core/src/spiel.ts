import { rng, seedAusCode, type Rng } from './zufall.ts';
import { B, RISS, RISS2, WR, setzeSeed, spalte, deko, begehbar, amPfad, orte, hoehe, setzeHoehe, hoehenListe, type Spalte, type Deko } from './welt.ts';
import { Wegfeld } from './flow.ts';
import {
  GEBAEUDE, GEGNER, ERFINDUNGEN, welle, staerke, START, TAG_DAUER, ABEND, MORGEN_DAUER, MORGEN_REPARATUR, SETZLING_NACH, BAUM_NACH, BAUM_GAENGE, FELS_GAENGE, EBNEN_STEIN, EBNEN_MAX,
  type GebTyp, type GegTyp, type Res, type Baustein, type ErfId, type Kosten
} from './daten.ts';

/** Fester Simulationstakt (Sekunden) */
export const DT = 1 / 20;
/** Nebel-Raster: Zellen zu 8 × 8 Blöcken */
export const NZ = 8, NN = (2 * WR) / NZ;

export interface Geb { id: number; typ: GebTyp; x: number; z: number; w: number; d: number; y: number; hp: number; max: number; cd: number; quellen: number; rep?: { t: number; dauer: number; von: number }; zielen: number }
/** Arbeiter: holt Rohstoffe am Tag, nachts im Haus */
export interface Arbeiter { id: number; geb: number; x: number; z: number; y: number; zustand: 'warten' | 'hin' | 'arbeit' | 'zurueck' | 'heim' | 'drin'; ziel: [number, number] | null; quelle: number; t: number; traegt: Res | null; richtung: number; ruhe: number }
/** Zustand gefällter Bäume und abgebauter Felsen */
export type DekoZustand = 'stumpf' | 'setzling' | 'weg';
export interface Gegner { id: number; typ: GegTyp; x: number; z: number; y: number; hp: number; max: number; tempo: number; schaden: number; flug: boolean; verborgen: boolean; versatz: number; ziel: [number, number] | null; angriff: number; richtung: number; tot: boolean; seit: number; fracht: number }
export interface Geschoss { art: 'pfeil' | 'topf'; x: number; y: number; z: number; sx: number; sy: number; sz: number; tx: number; ty: number; tz: number; t: number; dauer: number; ziel: number; schaden: number; flaeche: number; trifft: boolean; bogen: number }
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
  | { art: 'gelaende'; x0: number; z0: number; x1: number; z1: number };
export type Phase = 'tag' | 'nacht' | 'morgen' | 'verloren';

export interface Spielstand {
  v: 1 | 2; code: string; nacht: number; phase: Phase; zeit: number; gefaellt?: [number, number][]; abgebaut?: [number, number][]; gaenge?: [number, number][]; hoehen?: [number, number][];
  res: Record<Res, number>; bausteine: Record<Baustein, number>; erfindungen: ErfId[];
  gebaeude: { typ: GebTyp; x: number; z: number; hp: number }[]; erkundet: string; besiegt: number;
}

const kostenText = (k: Kosten) => Object.entries(k).map(([r, n]) => `${n} ${({ holz: 'Holz', stein: 'Stein', kristall: 'Kristall' } as Record<string, string>)[r]}`).join(', ');

export class Spiel {
  readonly code: string;
  readonly seed: number;
  nacht = 1;                // die kommende bzw. laufende Nacht
  phase: Phase = 'tag';
  zeit = 0;                 // Sekunden in der Phase
  res: Record<Res, number> = { ...START.res };
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
  private lichter: { x: number; z: number; r: number; enthuellt: boolean }[] = [];

  constructor(code: string, stand?: Spielstand) {
    this.code = code; this.seed = seedAusCode(code);
    setzeSeed(this.seed);
    this.r = rng(this.seed ^ 0x5bd1e995);
    const x0 = Math.min(B.x, RISS.x, RISS2.x) - 70, x1 = Math.max(B.x, RISS.x, RISS2.x) + 40;
    const z0 = Math.min(B.z, RISS.z, RISS2.z) - 70, z1 = Math.max(B.z, RISS.z, RISS2.z) + 40;
    this.feld = new Wegfeld(x0, z0, x1 - x0, z1 - z0);
    if (stand) this.laden(stand);
    else {
      this.setze('haupt', B.x - 6, B.z - 6);
      this.setze('werkstatt', B.x + 9, B.z - 4);
      this.setze('wachturm', B.x + 3, B.z + 8);
      this.aufdecken(B.x, B.z + 8, 64);
      const hz = this.findePlatz('holz', B.x - 26, B.z - 8, 18); if (hz) this.setze('holz', hz[0], hz[1]);
      const st = this.findePlatz('stein', B.x + 20, B.z - 22, 18); if (st) this.setze('stein', st[0], st[1]);
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
    for (const l of this.lichter) { const d = Math.hypot(x - l.x, z - l.z); if (d < l.r) { const v = 1 - d / l.r; if (v > w) w = v; if (l.enthuellt && v > 0.05) e = true; } }
    return { wert: w, enthuellt: e };
  }
  lichtquellen() { return this.lichter; }
  kannBezahlen(k: Kosten): boolean { return Object.entries(k).every(([r, n]) => this.res[r as Res] >= (n as number)); }
  freigeschaltet(typ: GebTyp): boolean { const b = GEBAEUDE[typ].braucht; return !b || this.erfindungen.has(b); }
  welleVorschau() { return welle(this.nacht); }

  /** Kann typ mit linker oberer Ecke (x0, z0) gebaut werden? */
  pruefe(typ: GebTyp, x0: number, z0: number): { ok: boolean; grund?: string; y: number } {
    const def = GEBAEUDE[typ];
    if (!this.freigeschaltet(typ)) return { ok: false, grund: `Braucht die Erfindung ${ERFINDUNGEN[def.braucht!].name}.`, y: 0 };
    let lo = 99, hi = -99;
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) {
      const s = spalte(x, z);
      if (!s) return { ok: false, grund: 'Hier ist kein Land.', y: 0 };
      if (!this.erkundetAn(x, z)) return { ok: false, grund: 'Noch im Nebel. Erst einen Späher schicken.', y: 0 };
      if (!begehbar(s)) return { ok: false, grund: s.a === 'w' ? 'Nicht im Wasser.' : s.a === 'l' ? 'Nicht in der Lava.' : 'Zu steil.', y: 0 };
      if (this.belegt[this.bi(x, z)]) return { ok: false, grund: 'Hier steht schon etwas.', y: 0 };
      const dk = this.dekoJetzt(x, z, s);
      if (dk && dk.art !== 'gras') return { ok: false, grund: dk.art === 'baum' ? 'Hier steht ein Baum. Ein Holzfäller kann ihn fällen.' : 'Hier liegt ein Felsen.', y: 0 };
      if (amPfad(x, z, 0) && typ !== 'mauer' && typ !== 'fackel') { /* auf dem Pfad erlaubt, blockiert ihn aber */ }
      lo = Math.min(lo, s.h); hi = Math.max(hi, s.h);
    }
    if (hi - lo > (typ === 'mauer' ? 2 : 1)) return { ok: false, grund: 'Der Boden ist zu uneben.', y: 0 };
    if (typ === 'kristall' && !orte().some((o) => o.typ === 'kristall' && Math.hypot(o.x - (x0 + 2), o.z - (z0 + 2)) < 10)) return { ok: false, grund: 'Eine Kristallmine muss an einem Kristallfeld stehen.', y: 0 };
    return { ok: true, y: hi + 1 };
  }

  // ---------------- Aktionen ----------------
  bauen(typ: GebTyp, x0: number, z0: number, still = false): boolean {
    const def = GEBAEUDE[typ];
    if (this.phase === 'verloren') return false;
    const p = this.pruefe(typ, x0, z0);
    if (!p.ok) { if (!still) this.melde(p.grund!, 'schlecht'); return false; }
    if (!this.kannBezahlen(def.kosten)) { if (!still) this.melde(`Nicht genug Rohstoffe: ${def.name} kostet ${kostenText(def.kosten)}.`, 'schlecht'); return false; }
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
    this.aufdecken(x, z, 38);
    this.melde('Ein Späher hat die Gegend erkundet.', 'gut');
    return true;
  }
  erfinden(id: ErfId): boolean {
    const e = ERFINDUNGEN[id];
    if (this.erfindungen.has(id)) return false;
    const fehlt = Object.entries(e.zutaten).some(([b, n]) => this.bausteine[b as Baustein] < (n as number)) || this.res.kristall < e.kristall;
    if (fehlt) { this.melde(`Für ${e.name} fehlen noch Bausteine oder Kristall.`, 'schlecht'); return false; }
    for (const [b, n] of Object.entries(e.zutaten)) this.bausteine[b as Baustein] -= n as number;
    this.res.kristall -= e.kristall;
    this.erfindungen.add(id);
    if (id === 'stahlguss') for (const g of this.gebaeude) if (g.typ === 'mauer') { g.max *= 2; g.hp *= 2; }
    this.lichterNeu();
    this.melde(`Erfunden: ${e.name}. ${e.wirkung}`, 'gut');
    return true;
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
      if (this.zeit >= TAG_DAUER) this.starteNacht();
    } else if (this.phase === 'nacht') {
      while (this.spawn.length && this.spawn[0].t <= this.zeit) { const s = this.spawn.shift()!; this.erzeuge(s.typ, s.riss); }
      if (!this.spawn.length && !this.gegner.length && this.zeit > 3) this.starteMorgen();
    } else if (this.phase === 'morgen') {
      if (this.zeit >= MORGEN_DAUER) {
        this.phase = 'tag'; this.zeit = 0; this.nacht++;
        // Bäume wachsen nach: Setzling, dann voller Baum
        for (const [k, t] of [...this.gefaellt]) { if (t < -1e8) continue; const d = this.nacht - t; if (d === SETZLING_NACH || d >= BAUM_NACH) { const x = Math.floor(k / 2048) - 600, z = (k % 2048) - 600; if (d >= BAUM_NACH) this.gefaellt.delete(k); this.ereignisse.push({ art: 'deko', x, z }); } }
        this.ereignisse.push({ art: 'phase', phase: 'tag' }); this.melde(`Tag ${this.nacht}. Bis zur Nacht bleibt Zeit zum Bauen.`, 'info');
      }
    }
    this.bewegeGegner();
    this.tuerme();
    this.bewegeGeschosse();
    this.arbeiterSchritt();
  }

  private starteNacht(): void {
    this.phase = 'nacht'; this.zeit = 0; this.beuteNacht = {};
    const plan: { typ: GegTyp; t: number; riss: { x: number; z: number } }[] = [];
    const risse = [RISS, ...(this.nacht >= 5 ? [RISS2] : [])];
    if (this.nacht === 5) this.melde('Im Osten hat sich ein zweiter Riss geöffnet!', 'schlecht');
    for (const { typ, zahl } of welle(this.nacht)) for (let i = 0; i < zahl; i++) plan.push({ typ, t: 2 + this.r() * 24, riss: risse[i % risse.length] });
    plan.sort((a, b) => a.t - b.t);
    this.spawn = plan;
    this.ereignisse.push({ art: 'phase', phase: 'nacht' });
    this.melde(`Nacht ${this.nacht}: Die Wesen kommen!`, 'schlecht');
  }
  private starteMorgen(): void {
    this.phase = 'morgen'; this.zeit = 0;
    for (const g of this.gebaeude) g.hp = Math.min(g.max, g.hp + (g.max - g.hp) * MORGEN_REPARATUR);
    const b = Object.entries(this.beuteNacht).filter(([, n]) => (n as number) > 0).map(([k, n]) => `${Math.round(n as number)} ${k === 'kristall' ? 'Kristall' : ({ feuerstein: 'Feuerstein', windrune: 'Windrune', eisenerz: 'Eisenerz', drachenschuppe: 'Drachenschuppe' } as Record<string, string>)[k]}`).join(', ');
    this.ereignisse.push({ art: 'phase', phase: 'morgen' });
    this.melde(`Nacht ${this.nacht} überstanden. Beute: ${b || 'nichts'}. Kleine Schäden sind ausgebessert, den Rest können Arbeiter reparieren.`, 'gut');
  }

  private erzeuge(typ: GegTyp, riss: { x: number; z: number }): void {
    const d = GEGNER[typ], s = staerke(this.nacht);
    const a = this.r() * Math.PI * 2, x = riss.x + Math.cos(a) * 3, z = riss.z + Math.sin(a) * 3;
    this.gegner.push({ id: this.naechsteId++, typ, x, z, y: hoehe(x, z), hp: d.hp * s, max: d.hp * s, tempo: d.tempo * (0.9 + this.r() * 0.2), schaden: d.schaden * s, flug: !!d.flug, verborgen: !!d.verborgen, versatz: (this.r() - 0.5) * 0.7, ziel: null, angriff: 0, richtung: 0, tot: false, seit: 0, fracht: d.fracht || 0 });
  }

  private bewegeGegner(): void {
    const h = this.haupt; if (!h) return;
    const hx = h.x + h.w / 2, hz = h.z + h.d / 2;
    for (const e of this.gegner) {
      e.seit += DT;
      if (e.flug) {
        const dx = hx - e.x, dz = hz - e.z, dist = Math.hypot(dx, dz);
        if (e.fracht && dist < 18) { // Nebelrochen setzt Moorwichte hinter den Mauern ab
          for (let i = 0; i < e.fracht; i++) { this.erzeuge('moorwicht', { x: e.x + (this.r() - 0.5) * 2, z: e.z + (this.r() - 0.5) * 2 }); }
          this.ereignisse.push({ art: 'abwurf', x: e.x, y: e.y, z: e.z }); e.fracht = 0;
        }
        if (dist > 5) { e.x += (dx / dist) * e.tempo * DT; e.z += (dz / dist) * e.tempo * DT; e.richtung = Math.atan2(dx, dz); }
        else this.schlage(e, h);
        e.y = hoehe(e.x, e.z) + 9 + Math.sin(e.seit * 2 + e.id) * 0.6;
        continue;
      }
      // am Ziel einer Kachel? dann nächste wählen
      if (!e.ziel || Math.hypot(e.ziel[0] - e.x, e.ziel[1] - e.z) < 0.25) e.ziel = this.feld.naechster(e.x, e.z);
      if (!e.ziel) { // am Hauptgebäude angekommen (oder eingeschlossen): nächstes Gebäude angreifen
        const g = this.gebNahe(e.x, e.z, 2) || h;
        if (this.randAbstand(e.x, e.z, g) < 2.2) this.schlage(e, g); continue;
      }
      const blocker = this.gebAn(e.ziel[0], e.ziel[1]);
      if (blocker) { this.schlage(e, blocker); e.richtung = Math.atan2(e.ziel[0] - e.x, e.ziel[1] - e.z); continue; }
      const dx = e.ziel[0] - e.x, dz = e.ziel[1] - e.z, dist = Math.hypot(dx, dz) || 1;
      const sp = e.tempo * DT * (this.dekoJetzt(Math.floor(e.x), Math.floor(e.z))?.art === 'baum' ? 0.75 : 1);
      // seitlicher Versatz, damit nicht alle auf einer Linie laufen
      const nx = -dz / dist, nz = dx / dist;
      e.x += (dx / dist) * Math.min(sp, dist) + nx * e.versatz * DT * 0.6;
      e.z += (dz / dist) * Math.min(sp, dist) + nz * e.versatz * DT * 0.6;
      e.richtung = Math.atan2(dx, dz);
      e.y = hoehe(e.x, e.z);
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
    g.hp -= e.schaden * 0.8;
    this.ereignisse.push({ art: 'schaden', geb: g });
    if (g.hp <= 0) {
      if (g.typ === 'haupt') { this.phase = 'verloren'; this.ereignisse.push({ art: 'phase', phase: 'verloren' }); this.melde(`Die Feste ist gefallen – nach ${this.nacht - 1} überstandenen Nächten.`, 'schlecht'); return; }
      this.entferne(g, true);
      this.melde(`${GEBAEUDE[g.typ].name} wurde zerstört.`, 'schlecht');
    }
  }

  private tuerme(): void {
    const nacht = this.phase === 'nacht', runen = this.erfindungen.has('runenpfeile');
    for (const g of this.gebaeude) {
      const k = GEBAEUDE[g.typ].kampf; if (!k) continue;
      g.cd -= DT; if (g.cd > 0) continue;
      const tx = g.x + g.w / 2, tz = g.z + g.d / 2;
      let best: Gegner | null = null, bestD = Infinity, bestLicht = true;
      for (const e of this.gegner) {
        if (e.tot || (k.nurBoden && e.flug)) continue;
        const d = Math.hypot(e.x - tx, e.z - tz); if (d > k.reichweite) continue;
        const l = this.licht(e.x, e.z), hell = !nacht || l.wert > 0.15;
        if (e.verborgen && nacht && !l.enthuellt && !(runen && g.typ === 'wachturm') && d > 4 && l.wert < 0.3) continue;
        if (!hell && d > k.reichweite * 0.6) continue;
        // bevorzugt: wer dem Hauptgebäude am nächsten ist
        const prio = this.feld.wert(e.x, e.z) + d * 0.2;
        if (prio < bestD) { bestD = prio; best = e; bestLicht = hell; }
      }
      if (!best) continue;
      g.cd = k.abklingen; g.zielen = Math.atan2(best.x - tx, best.z - tz);
      const sy = g.y + (k.geschoss === 'pfeil' ? 10 : 12);
      this.ereignisse.push({ art: 'schuss', geb: g, x: tx, y: sy, z: tz, geschoss: k.geschoss });
      if (k.geschoss === 'pfeil') {
        const d = Math.hypot(best.x - tx, best.z - tz);
        const schaden = k.schaden * (runen ? 1.6 : 1);
        this.geschosse.push({ art: 'pfeil', x: tx, y: sy, z: tz, sx: tx, sy, sz: tz, tx: best.x, ty: best.y + (best.flug ? 0 : 1), tz: best.z, t: 0, dauer: d / 30 + 0.05, ziel: best.id, schaden, flaeche: 0, trifft: this.r() > (bestLicht ? 0.05 : 0.38), bogen: d * 0.06 });
      } else {
        const dauer = 1.25, vx = best.ziel ? (best.ziel[0] - best.x) : 0, vz = best.ziel ? (best.ziel[1] - best.z) : 0, vl = Math.hypot(vx, vz) || 1;
        const px = best.x + (vx / vl) * best.tempo * dauer, pz = best.z + (vz / vl) * best.tempo * dauer;
        const streu = bestLicht ? 0.6 : 2.2;
        const zx = px + (this.r() - 0.5) * streu, zz = pz + (this.r() - 0.5) * streu;
        this.geschosse.push({ art: 'topf', x: tx, y: sy, z: tz, sx: tx, sy, sz: tz, tx: zx, ty: hoehe(zx, zz), tz: zz, t: 0, dauer, ziel: 0, schaden: k.schaden, flaeche: k.flaeche!, trifft: true, bogen: 6 + Math.hypot(zx - tx, zz - tz) * 0.25 });
      }
    }
  }
  private bewegeGeschosse(): void {
    for (const p of this.geschosse) {
      p.t += DT;
      if (p.art === 'pfeil' && p.ziel) { const z = this.gegner.find((e) => e.id === p.ziel); if (z) { p.tx = z.x; p.ty = z.y + (z.flug ? 0 : 1); p.tz = z.z; } }
      const f = Math.min(1, p.t / p.dauer);
      p.x = p.sx + (p.tx - p.sx) * f; p.z = p.sz + (p.tz - p.sz) * f; p.y = p.sy + (p.ty - p.sy) * f + Math.sin(Math.PI * f) * p.bogen;
      if (f < 1) continue;
      if (p.art === 'pfeil') {
        const z = this.gegner.find((e) => e.id === p.ziel);
        if (z && p.trifft) { this.ereignisse.push({ art: 'treffer', x: z.x, y: z.y + 1, z: z.z }); this.verletze(z, p.schaden); }
        else this.ereignisse.push({ art: 'fehl', x: p.tx, y: p.ty, z: p.tz });
      } else {
        this.ereignisse.push({ art: 'explosion', x: p.tx, y: p.ty, z: p.tz, r: p.flaeche });
        for (const e of this.gegner) { if (e.flug || e.tot) continue; const d = Math.hypot(e.x - p.tx, e.z - p.tz); if (d < p.flaeche) this.verletze(e, p.schaden * (1 - d / p.flaeche * 0.6)); }
      }
      p.dauer = -1;
    }
    this.geschosse = this.geschosse.filter((p) => p.dauer > 0);
  }
  private verletze(e: Gegner, n: number): void {
    if (e.tot) return;
    e.hp -= n;
    if (e.hp > 0) return;
    e.tot = true; this.besiegt++;
    const d = GEGNER[e.typ];
    this.ereignisse.push({ art: 'tod', typ: e.typ, x: e.x, y: e.y, z: e.z });
    const kr = d.kristall * (0.6 + this.r() * 0.8);
    this.res.kristall += kr; this.beuteNacht.kristall = (this.beuteNacht.kristall || 0) + kr;
    for (const [b, p] of d.beute) if (this.r() < p) { this.bausteine[b]++; this.beuteNacht[b] = (this.beuteNacht[b] || 0) + 1; }
  }

  // ---------------- Gebäude intern ----------------
  private setze(typ: GebTyp, x0: number, z0: number, hp?: number): Geb {
    const def = GEBAEUDE[typ];
    const p = this.pruefeRoh(typ, x0, z0);
    const max = def.hp * (typ === 'mauer' && this.erfindungen.has('stahlguss') ? 2 : 1);
    const g: Geb = { id: this.naechsteId++, typ, x: x0, z: z0, w: def.w, d: def.d, y: p, hp: hp ?? max, max, cd: 0, quellen: this.quellenZahl(typ, x0, z0), zielen: 0 };
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) this.belegt[this.bi(x, z)] = g.id;
    this.gebaeude.push(g);
    const arb = def.arbeit; if (arb) for (let i = 0; i < arb.arbeiter; i++) this.arbeiter.push({ id: this.naechsteId++, geb: g.id, x: x0 + def.w / 2 + i, z: z0 + def.d + 0.5, y: p, zustand: 'warten', ziel: null, quelle: -1, t: i * 1.5, traegt: null, richtung: 0, ruhe: i * 1.5 });
    // auf einem Stumpf gebaut: dort wächst nichts mehr nach
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) { const k = Spiel.kachel(x, z); if (this.gefaellt.has(k)) this.gefaellt.set(k, -2e9); }
    if (def.sicht) this.aufdecken(x0 + def.w / 2, z0 + def.d / 2, def.sicht);
    this.feldAlt = true; this.lichterNeu();
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
    this.feldAlt = true; this.lichterNeu();
    this.ereignisse.push({ art: 'weg', geb: g, zerstoert });
  }
  /** Wie viele Rohstoffquellen liegen in Reichweite? (Anzeige) */
  quellenZahl(typ: GebTyp, x0: number, z0: number): number {
    const def = GEBAEUDE[typ]; if (!def.arbeit) return 0;
    return this.quellen(typ, x0 + def.w / 2, z0 + def.d / 2, def.arbeit.radius, false).length;
  }
  /** Rohstoffquellen um (cx, cz), nach Abstand sortiert */
  private quellen(typ: GebTyp, cx: number, cz: number, r: number, frei: boolean): { x: number; z: number; k: number; d: number; dauerhaft: boolean }[] {
    const out: { x: number; z: number; k: number; d: number; dauerhaft: boolean }[] = [];
    if (typ === 'kristall') {
      for (const o of orte()) if (o.typ === 'kristall' && Math.hypot(o.x - cx, o.z - cz) < r + 4) for (const [dx, dz] of [[-2, 0], [2, 1], [0, 2], [1, -2]]) out.push({ x: o.x + dx + 0.5, z: o.z + dz + 0.5, k: -1, d: Math.hypot(o.x + dx - cx, o.z + dz - cz), dauerhaft: true });
      return out.sort((a, b) => a.d - b.d);
    }
    for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let z = Math.floor(cz - r); z <= cz + r; z++) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz); if (d > r) continue;
      const s = spalte(x, z); if (!s) continue;
      const k = Spiel.kachel(x, z); if (frei && this.reserviert.has(k)) continue;
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
      const def = GEBAEUDE[g.typ], arb = def.arbeit!;
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
        const q = this.quellen(g.typ, hx, g.z + g.d / 2, arb.radius, true)[0] || this.quellen(g.typ, hx, g.z + g.d / 2, arb.radius * 1.6, true)[0];
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
            if (weg) { this.ereignisse.push({ art: 'deko', x, z }); this.feldAlt = true; }
            this.reserviert.delete(a.quelle); a.quelle = -1;
          }
          a.traegt = arb.res; a.zustand = 'zurueck';
        }
      } else if (a.zustand === 'zurueck') {
        if (gehe(hx, hz, 3.0)) {
          const menge = arb.menge * (a.quelle === -1 && arb.res === 'stein' && !a.ziel ? 1 : 1);
          this.res[arb.res] += menge; this.ereignisse.push({ art: 'abgeliefert', x: a.x, y: a.y, z: a.z, res: arb.res, menge });
          a.traegt = null; a.zustand = 'warten'; a.ruhe = 0.6; if (Math.random() < 0.2) g.quellen = this.quellenZahl(g.typ, g.x, g.z);
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
    this.feldAlt = true;
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
    for (const r of [RISS, ...(this.nacht >= 5 ? [RISS2] : [])]) {
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
    for (let d = 0; d <= r; d++) for (let dx = -d; dx <= d; dx++) for (const dz of [-d, d]) for (const [ax, az] of [[dx, dz], [dz, dx]]) {
      const x0 = x + ax, z0 = z + az; if (!this.pruefe(typ, x0, z0).ok) continue;
      const w = this.quellenZahl(typ, x0, z0) - d * 0.2; if (w > bestWert) { bestWert = w; best = [x0, z0]; }
    }
    return best;
  }
  private lichterNeu(): void {
    const enth = (t: GebTyp) => t === 'leuchtfeuer';
    this.lichter = this.gebaeude.filter((g) => GEBAEUDE[g.typ].licht > 0).map((g) => ({ x: g.x + g.w / 2, z: g.z + g.d / 2, r: GEBAEUDE[g.typ].licht, enthuellt: enth(g.typ) }));
  }
  private feldNeu(): void {
    this.feldAlt = false; this.feldVersion++;
    const h = this.haupt; if (!h) return;
    this.feld.setzeKosten((x, z) => {
      const s = spalte(x, z); if (!begehbar(s)) return Infinity;
      const g = this.belegt[this.bi(x, z)];
      if (g) return g === h.id ? 1 : 30;
      return amPfad(x, z, 1.5) ? 0.75 : this.dekoJetzt(x, z, s)?.art === 'baum' ? 1.6 : 1;
    });
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
    return { v: 2, gefaellt: [...this.gefaellt], abgebaut: [...this.abgebaut], gaenge: [...this.gaenge], hoehen: hoehenListe(), code: this.code, nacht: this.nacht, phase: this.phase === 'verloren' ? 'verloren' : 'tag', zeit: this.phase === 'tag' ? this.zeit : 0,
      res: { ...this.res }, bausteine: { ...this.bausteine }, erfindungen: [...this.erfindungen],
      gebaeude: this.gebaeude.map((g) => ({ typ: g.typ, x: g.x, z: g.z, hp: g.hp })), erkundet: btoa(s), besiegt: this.besiegt };
  }
  private laden(st: Spielstand): void {
    this.nacht = st.nacht; this.phase = st.phase; this.zeit = st.zeit; this.res = { ...st.res }; this.bausteine = { ...st.bausteine };
    this.erfindungen = new Set(st.erfindungen); this.besiegt = st.besiegt || 0;
    this.gefaellt = new Map(st.gefaellt || []); this.abgebaut = new Map(st.abgebaut || []); this.gaenge = new Map(st.gaenge || []);
    for (const [k, h] of st.hoehen || []) setzeHoehe(Math.floor(k / 2048) - 600, (k % 2048) - 600, h);
    const bin = atob(st.erkundet); for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); for (let k = 0; k < 8; k++) this.erkundet[i * 8 + k] = (b >> k) & 1; }
    for (const g of st.gebaeude) this.setze(g.typ, g.x, g.z, g.hp);
    this.ereignisse = this.ereignisse.filter((e) => e.art !== 'meldung');
  }
}
