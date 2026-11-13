import { rng, seedAusCode, type Rng } from './zufall.ts';
import { B, RISS, RISS2, WR, setzeSeed, spalte, deko, begehbar, amPfad, orte, hoehe } from './welt.ts';
import { Wegfeld } from './flow.ts';
import {
  GEBAEUDE, GEGNER, ERFINDUNGEN, welle, staerke, START, TAG_DAUER, ABEND, MORGEN_DAUER,
  type GebTyp, type GegTyp, type Res, type Baustein, type ErfId, type Kosten
} from './daten.ts';

/** Fester Simulationstakt (Sekunden) */
export const DT = 1 / 20;
/** Nebel-Raster: Zellen zu 8 × 8 Blöcken */
export const NZ = 8, NN = (2 * WR) / NZ;

export interface Geb { id: number; typ: GebTyp; x: number; z: number; w: number; d: number; y: number; hp: number; max: number; cd: number; faktor: number }
export interface Gegner { id: number; typ: GegTyp; x: number; z: number; y: number; hp: number; max: number; tempo: number; schaden: number; flug: boolean; verborgen: boolean; versatz: number; ziel: [number, number] | null; angriff: number; richtung: number; tot: boolean; seit: number }
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
  | { art: 'meldung'; text: string; ton?: 'gut' | 'schlecht' | 'info' };
export type Phase = 'tag' | 'nacht' | 'morgen' | 'verloren';

export interface Spielstand {
  v: 1; code: string; nacht: number; phase: Phase; zeit: number;
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
      const dk = deko(x, z, s);
      if (dk && dk.art !== 'gras') return { ok: false, grund: dk.art === 'baum' ? 'Hier steht ein Baum.' : 'Hier liegt ein Felsen.', y: 0 };
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
      for (const g of this.gebaeude) { const e = GEBAEUDE[g.typ].ertrag; if (e) this.res[e.res] += e.rate * g.faktor * DT; }
      if (this.zeit >= TAG_DAUER) this.starteNacht();
    } else if (this.phase === 'nacht') {
      while (this.spawn.length && this.spawn[0].t <= this.zeit) { const s = this.spawn.shift()!; this.erzeuge(s.typ, s.riss); }
      if (!this.spawn.length && !this.gegner.length && this.zeit > 3) this.starteMorgen();
    } else if (this.phase === 'morgen') {
      if (this.zeit >= MORGEN_DAUER) { this.phase = 'tag'; this.zeit = 0; this.nacht++; this.ereignisse.push({ art: 'phase', phase: 'tag' }); this.melde(`Tag ${this.nacht}. Bis zur Nacht bleibt Zeit zum Bauen.`, 'info'); }
    }
    this.bewegeGegner();
    this.tuerme();
    this.bewegeGeschosse();
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
    for (const g of this.gebaeude) g.hp = Math.min(g.max, g.hp + (g.max - g.hp) * 0.6);
    const b = Object.entries(this.beuteNacht).filter(([, n]) => (n as number) > 0).map(([k, n]) => `${Math.round(n as number)} ${k === 'kristall' ? 'Kristall' : ({ feuerstein: 'Feuerstein', windrune: 'Windrune', eisenerz: 'Eisenerz', drachenschuppe: 'Drachenschuppe' } as Record<string, string>)[k]}`).join(', ');
    this.ereignisse.push({ art: 'phase', phase: 'morgen' });
    this.melde(`Nacht ${this.nacht} überstanden. Beute: ${b || 'nichts'}. Schäden werden ausgebessert.`, 'gut');
  }

  private erzeuge(typ: GegTyp, riss: { x: number; z: number }): void {
    const d = GEGNER[typ], s = staerke(this.nacht);
    const a = this.r() * Math.PI * 2, x = riss.x + Math.cos(a) * 3, z = riss.z + Math.sin(a) * 3;
    this.gegner.push({ id: this.naechsteId++, typ, x, z, y: hoehe(x, z), hp: d.hp * s, max: d.hp * s, tempo: d.tempo * (0.9 + this.r() * 0.2), schaden: d.schaden * s, flug: !!d.flug, verborgen: !!d.verborgen, versatz: (this.r() - 0.5) * 0.7, ziel: null, angriff: 0, richtung: 0, tot: false, seit: 0 });
  }

  private bewegeGegner(): void {
    const h = this.haupt; if (!h) return;
    const hx = h.x + h.w / 2, hz = h.z + h.d / 2;
    for (const e of this.gegner) {
      e.seit += DT;
      if (e.flug) {
        const dx = hx - e.x, dz = hz - e.z, dist = Math.hypot(dx, dz);
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
      const sp = e.tempo * DT * (deko(Math.floor(e.x), Math.floor(e.z))?.art === 'baum' ? 0.75 : 1);
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
      g.cd = k.abklingen;
      const sy = g.y + (k.geschoss === 'pfeil' ? 10 : 12);
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
    const g: Geb = { id: this.naechsteId++, typ, x: x0, z: z0, w: def.w, d: def.d, y: p, hp: hp ?? max, max, cd: 0, faktor: this.faktor(typ, x0, z0) };
    for (let x = x0; x < x0 + def.w; x++) for (let z = z0; z < z0 + def.d; z++) this.belegt[this.bi(x, z)] = g.id;
    this.gebaeude.push(g);
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
    this.feldAlt = true; this.lichterNeu();
    this.ereignisse.push({ art: 'weg', geb: g, zerstoert });
  }
  private faktor(typ: GebTyp, x0: number, z0: number): number {
    const def = GEBAEUDE[typ]; if (!def.ertrag) return 0;
    const cx = x0 + def.w / 2, cz = z0 + def.d / 2; let n = 0;
    for (let x = Math.floor(cx - 8); x <= cx + 8; x++) for (let z = Math.floor(cz - 8); z <= cz + 8; z++) {
      if (Math.hypot(x - cx, z - cz) > 8) continue;
      const s = spalte(x, z); if (!s) continue;
      const dk = deko(x, z, s);
      if (typ === 'holz' && dk?.art === 'baum') n++;
      if (typ === 'stein' && (dk?.art === 'fels' || s.a === 'fels' || s.a === 'schnee')) n++;
    }
    if (typ === 'holz') return Math.min(1.4, 0.15 + n / 10);
    if (typ === 'stein') return Math.min(1.4, 0.4 + n / 14);
    return 1;
  }
  private lichterNeu(): void {
    const enth = (t: GebTyp) => t === 'leuchtfeuer';
    this.lichter = this.gebaeude.filter((g) => GEBAEUDE[g.typ].licht > 0).map((g) => ({ x: g.x + g.w / 2, z: g.z + g.d / 2, r: GEBAEUDE[g.typ].licht, enthuellt: enth(g.typ) }));
  }
  private feldNeu(): void {
    this.feldAlt = false;
    const h = this.haupt; if (!h) return;
    this.feld.setzeKosten((x, z) => {
      const s = spalte(x, z); if (!begehbar(s)) return Infinity;
      const g = this.belegt[this.bi(x, z)];
      if (g) return g === h.id ? 1 : 30;
      return amPfad(x, z, 1.5) ? 0.75 : deko(x, z, s)?.art === 'baum' ? 1.6 : 1;
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
    return { v: 1, code: this.code, nacht: this.nacht, phase: this.phase === 'verloren' ? 'verloren' : 'tag', zeit: this.phase === 'tag' ? this.zeit : 0,
      res: { ...this.res }, bausteine: { ...this.bausteine }, erfindungen: [...this.erfindungen],
      gebaeude: this.gebaeude.map((g) => ({ typ: g.typ, x: g.x, z: g.z, hp: g.hp })), erkundet: btoa(s), besiegt: this.besiegt };
  }
  private laden(st: Spielstand): void {
    this.nacht = st.nacht; this.phase = st.phase; this.zeit = st.zeit; this.res = { ...st.res }; this.bausteine = { ...st.bausteine };
    this.erfindungen = new Set(st.erfindungen); this.besiegt = st.besiegt || 0;
    const bin = atob(st.erkundet); for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); for (let k = 0; k < 8; k++) this.erkundet[i * 8 + k] = (b >> k) & 1; }
    for (const g of st.gebaeude) this.setze(g.typ, g.x, g.z, g.hp);
    this.ereignisse = this.ereignisse.filter((e) => e.art !== 'meldung');
  }
}
