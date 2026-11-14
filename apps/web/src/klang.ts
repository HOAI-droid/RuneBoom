/**
 * Klänge und Musik (WebAudio).
 * Geräusche: Aufnahmen aus Kenneys „RPG sounds“ (CC0), mehrere Fassungen mit leicht wechselnder Tonhöhe, dazu erzeugte Klänge.
 * Musik: Instrumente aus FluidR3 GM (Frank Wen, CC BY 3.0); ein Komponist setzt je Volk laufend neue Stücke aus Motiven,
 * Tonleitern und Akkordfolgen zusammen. Schichten: Tag, Abend, Nacht, Kampf; eigenes Motiv für den Rissfürsten.
 * Alles läuft über einen gemeinsamen Hall. Fehlen die Dateien (Einzeldatei-Vorschau), spielen erzeugte Klänge.
 */
type Ton = 'schlag' | 'sehne' | 'treffer' | 'explosion' | 'hieb_holz' | 'hieb_stein' | 'hieb_kristall' | 'bau' | 'einsturz' | 'horn' | 'glocke' | 'tod' | 'abgeliefert' | 'klick' | 'reparatur' | 'wurf' | 'boss' | 'siegel' | 'omen' | 'wunder' | 'falle' | 'blitz' | 'feuer';
type Instrument = 'flute' | 'pan_flute' | 'orchestral_harp' | 'kalimba' | 'woodblock' | 'string_ensemble_1' | 'tubular_bells' | 'dulcimer' | 'celesta' | 'french_horn' | 'trombone' | 'taiko_drum' | 'timpani' | 'contrabass' | 'choir_aahs' | 'cello';
export type MusikVolk = 'glutborn' | 'hainmar' | 'sturmweber';

/** Wesenszug der Musik je Volk */
interface Profil {
  grund: number; leiter: number[]; bpm: number; melodie: Instrument[]; begleitung: Instrument; flaeche: Instrument; bass: Instrument;
  schlag: Instrument; schmuck: Instrument; folgen: number[][]; rhythmen: number[][]; arpeggio: boolean;
}
const PROFILE: Record<MusikVolk, Profil> = {
  // Glutborn: schwer und feurig, phrygisch-dominant, Horn, Taiko, Hackbrett wie Funken
  glutborn: { grund: 50, leiter: [0, 1, 4, 5, 7, 8, 10], bpm: 78, melodie: ['french_horn', 'dulcimer'], begleitung: 'cello', flaeche: 'string_ensemble_1', bass: 'contrabass', schlag: 'taiko_drum', schmuck: 'tubular_bells',
    folgen: [[0, 1, 0, 6], [0, 5, 6, 0], [0, 3, 1, 0], [0, 6, 5, 1]], rhythmen: [[3, 1, 2, 2], [2, 2, 4], [1, 1, 2, 4], [4, 2, 2], [3, 3, 2]], arpeggio: false },
  // Hainmar: weit und ruhig, Fünfton-Melodien, Flöten, Harfe, Kalimba, Holz
  hainmar: { grund: 55, leiter: [0, 2, 4, 5, 7, 9, 11], bpm: 68, melodie: ['flute', 'pan_flute'], begleitung: 'orchestral_harp', flaeche: 'string_ensemble_1', bass: 'cello', schlag: 'woodblock', schmuck: 'kalimba',
    folgen: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 4, 5, 3], [5, 3, 0, 4]], rhythmen: [[2, 2, 4], [3, 1, 4], [4, 4], [2, 1, 1, 4], [6, 2]], arpeggio: true },
  // Sturmweber: luftig und erhaben, lydisch, Streicher, Celesta, Glocken
  sturmweber: { grund: 51, leiter: [0, 2, 4, 6, 7, 9, 11], bpm: 90, melodie: ['celesta', 'dulcimer'], begleitung: 'orchestral_harp', flaeche: 'string_ensemble_1', bass: 'contrabass', schlag: 'timpani', schmuck: 'tubular_bells',
    folgen: [[0, 1, 4, 0], [0, 4, 1, 5], [3, 1, 0, 4], [0, 5, 1, 4]], rhythmen: [[1, 1, 2, 2, 2], [2, 2, 2, 2], [3, 1, 2, 2], [1, 1, 1, 1, 4]], arpeggio: true }
};
const PENTA = [0, 1, 2, 4, 5]; // Stufen, die Hainmar-Melodien bevorzugen

export class Klang {
  private ctx: AudioContext | null = null;
  private haupt!: GainNode; private musik!: GainNode; private effekte!: GainNode; private hall!: ConvolverNode; private hallSend!: GainNode;
  private rauschen!: AudioBuffer;
  private zuletzt = new Map<string, number>(); private hiebe: number[] = [];
  lautMusik = 0.55; lautEffekte = 0.7;
  private nacht = false; private dichte = 0; private abendZeit = false; private bossNacht = false;
  private volk: MusikVolk = 'glutborn'; private zuf = 7;
  // Aufnahmen
  private geraeusche = new Map<string, AudioBuffer>();
  private instrumente = new Map<Instrument, { midi: number; buf: AudioBuffer }[]>();
  private mitAufnahmen = false;
  // Komponist
  private naechsterTakt = 0; private takt = 0; private folge: number[] = [0, 0, 0, 0]; private motiv: { stufe: number; laenge: number }[] = []; private motivB: { stufe: number; laenge: number }[] = [];

  /** muss aus einer Nutzeraktion heraus aufgerufen werden */
  start(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    try { this.ctx = new AudioContext(); } catch { return; }
    const c = this.ctx;
    this.haupt = c.createGain(); this.haupt.gain.value = 0.9; this.haupt.connect(c.destination);
    const komp = c.createDynamicsCompressor(); komp.threshold.value = -16; komp.ratio.value = 3.5; komp.knee.value = 12; komp.connect(this.haupt);
    this.musik = c.createGain(); this.musik.connect(komp); this.effekte = c.createGain(); this.effekte.connect(komp);
    // gemeinsamer Hall: erzeugte Raumantwort (2,6 s, warm)
    this.hall = c.createConvolver(); this.hall.buffer = this.raum(2.6); this.hallSend = c.createGain(); this.hallSend.gain.value = 0.32;
    const hallFilter = c.createBiquadFilter(); hallFilter.type = 'lowpass'; hallFilter.frequency.value = 4200;
    this.hallSend.connect(this.hall); this.hall.connect(hallFilter); hallFilter.connect(komp);
    this.setzeLautstaerke(this.lautMusik, this.lautEffekte);
    this.rauschen = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.rauschen.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.naechsterTakt = c.currentTime + 0.3; this.neueStuecke();
    setInterval(() => this.planeMusik(), 120);
    void this.ladeAufnahmen();
  }
  setzeLautstaerke(m: number, e: number): void {
    this.lautMusik = m; this.lautEffekte = e;
    if (!this.ctx) return;
    this.musik.gain.setTargetAtTime(m * 0.55, this.ctx.currentTime, 0.1); this.effekte.gain.setTargetAtTime(e, this.ctx.currentTime, 0.1);
  }
  /** nacht, Dichte der Wesen nahe der Burg (0–1), Abend, Nacht mit Rissfürst */
  stimmung(nacht: boolean, dichte: number, abend = false, boss = false): void {
    this.nacht = nacht; this.dichte = Math.max(0, Math.min(1, dichte)); this.abendZeit = abend; this.bossNacht = boss;
    // im Kampf tritt die Musik zurück, damit Pfeile, Treffer und Einschläge zu hören sind
    if (this.ctx) this.musik.gain.setTargetAtTime(this.lautMusik * 0.55 * (nacht ? 0.7 - this.dichte * 0.25 : 1), this.ctx.currentTime, 0.6);
  }
  setzeVolk(v: string): void { if ((v === 'glutborn' || v === 'hainmar' || v === 'sturmweber') && v !== this.volk) { this.volk = v; this.neueStuecke(); } }

  private raum(dauer: number): AudioBuffer {
    const c = this.ctx!, n = Math.floor(c.sampleRate * dauer), b = c.createBuffer(2, n, c.sampleRate);
    for (let k = 0; k < 2; k++) { const d = b.getChannelData(k); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 80 ? i / 80 : 1); } }
    return b;
  }
  private async ladeAufnahmen(): Promise<void> {
    const c = this.ctx!; const basis = new URL('klang/', document.baseURI).href;
    const holen = async (datei: string) => { const r = await fetch(basis + datei); if (!r.ok) throw new Error(datei); return c.decodeAudioData(await r.arrayBuffer()); };
    try {
      const liste = await (await fetch(basis + 'instrumente.json')).json() as Record<Instrument, number[]>;
      const g = ['chop', 'topf1', 'topf2', 'topf3', 'klick', 'riegel', 'tuer1', 'tuer2', 'tuer3', 'tuer4', 'knarr1', 'knarr2', 'schritt1', 'schritt2', 'schritt3', 'muenzen1', 'muenzen2', 'leder', 'blatt', 'klinge', 'schnitt'];
      await Promise.all(g.map(async (n) => { try { this.geraeusche.set(n, await holen(`g_${n}.mp3`)); } catch { /* fehlt */ } }));
      await Promise.all((Object.keys(liste) as Instrument[]).map(async (inst) => {
        const toene: { midi: number; buf: AudioBuffer }[] = [];
        for (const m of liste[inst]) { try { toene.push({ midi: m, buf: await holen(`i_${inst}_${m}.mp3`) }); } catch { /* fehlt */ } }
        if (toene.length) this.instrumente.set(inst, toene);
      }));
      this.mitAufnahmen = this.instrumente.size >= 8;
    } catch { this.mitAufnahmen = false; }
  }

  // ---------- Bausteine ----------
  private osz(typ: OscillatorType, f: number, t: number, dauer: number, laut: number, ziel: AudioNode, f2?: number, angriff = 0.005): OscillatorNode {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = typ; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dauer);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(laut, t + angriff); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g); g.connect(ziel); o.start(t); o.stop(t + dauer + 0.05);
    return o;
  }
  private rausch(t: number, dauer: number, laut: number, ziel: AudioNode, filter: BiquadFilterType, f: number, f2?: number, q = 1): void {
    const c = this.ctx!, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.rauschen; s.loop = true; fl.type = filter; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dauer);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(laut, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    s.connect(fl); fl.connect(g); g.connect(ziel); s.start(t, Math.random()); s.stop(t + dauer + 0.05);
  }
  /** Ziel mit Hall-Anteil */
  private mitHall(ziel: AudioNode, anteil: number): AudioNode {
    const c = this.ctx!, g = c.createGain(), s = c.createGain(); s.gain.value = anteil; g.connect(ziel); g.connect(s); s.connect(this.hallSend); return g;
  }
  /** Aufnahme abspielen: Tonhöhe leicht verändert, Lautstärke, optional Tiefpass */
  private aufnahme(name: string, t: number, laut: number, ziel: AudioNode, rate = 1, tief = 0): boolean {
    const b = this.geraeusche.get(name); if (!b) return false;
    const c = this.ctx!, s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; s.playbackRate.value = rate * (0.94 + Math.random() * 0.12); g.gain.value = laut;
    let n: AudioNode = s; if (tief) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = tief; s.connect(f); n = f; }
    n.connect(g); g.connect(ziel); s.start(t); return true;
  }
  private eins<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

  // ---------- Geräusche ----------
  /** laut: 0..1 (z. B. nach Entfernung zur Kamera) */
  spiele(ton: Ton, laut = 1): void {
    const c = this.ctx; if (!c || laut < 0.03 || this.lautEffekte <= 0) return;
    const jetzt = c.currentTime, abst = ton === 'sehne' || ton === 'treffer' ? 0.06 : ton === 'schlag' ? 0.25 : ton.startsWith('hieb') ? 0.09 : 0.04;
    if ((this.zuletzt.get(ton) || 0) > jetzt - abst) return; this.zuletzt.set(ton, jetzt);
    // viele Arbeiter: höchstens fünf Hiebe je Sekunde, ferne leiser
    if (ton.startsWith('hieb')) { this.hiebe = this.hiebe.filter((x) => x > jetzt - 1); if (this.hiebe.length >= 5) return; this.hiebe.push(jetzt); laut *= 0.75; }
    const t = jetzt + 0.01, v = laut, z = this.mitHall(this.effekte, ton === 'explosion' || ton === 'einsturz' || ton === 'horn' || ton === 'glocke' || ton === 'boss' ? 0.55 : 0.28);
    const A = (n: string, l: number, r = 1, tief = 0, dt = 0) => this.aufnahme(n, t + dt, l * v, z, r, tief);
    switch (ton) {
      case 'hieb_holz': if (!A('chop', 0.55, 0.95, 5200)) { this.osz('square', 520, t, 0.03, 0.08 * v, z, 300); this.rausch(t, 0.08, 0.12 * v, z, 'lowpass', 900); } else this.osz('sine', 160, t, 0.09, 0.06 * v, z, 90); break;
      case 'hieb_stein': if (!A('klick', 0.45, 0.8, 4000)) this.rausch(t, 0.07, 0.15 * v, z, 'bandpass', 2600, undefined, 2); A(this.eins(['topf2', 'topf3']), 0.22, 0.5, 2600); this.rausch(t, 0.05, 0.06 * v, z, 'lowpass', 1200); break;
      case 'hieb_kristall': if (!A('topf1', 0.3, 1.7)) this.osz('sine', 1760 + Math.random() * 300, t, 0.5, 0.08 * v, z); this.osz('sine', 2093 + Math.random() * 400, t, 0.6, 0.03 * v, z); break;
      case 'bau': { const n = ['tuer1', 'tuer2', 'tuer3', 'tuer4']; if (!A(this.eins(n), 0.42, 1.25, 3800)) { for (let i = 0; i < 3; i++) this.osz('square', 260 - i * 30, t + i * 0.12, 0.05, 0.1 * v, z, 160); } else { A(this.eins(n), 0.36, 1.35, 3800, 0.2); A(this.eins(n), 0.3, 1.3, 3800, 0.42); } break; }
      case 'reparatur': if (!A(this.eins(['tuer2', 'tuer3']), 0.32, 1.5, 4200)) this.osz('square', 1200, t, 0.03, 0.05 * v, z, 700); else A('riegel', 0.15, 1.1, 0, 0.12); break;
      case 'abgeliefert': if (!A(this.eins(['muenzen1', 'muenzen2', 'leder']), 0.28, 1)) { this.osz('sine', 880, t, 0.12, 0.03 * v, z); this.osz('sine', 1320, t + 0.05, 0.12, 0.02 * v, z); } break;
      case 'klick': if (!A('blatt', 0.35, 1.2)) this.osz('triangle', 660, t, 0.05, 0.06 * v, z); break;
      // Kampf: deutlich hörbar über der Musik
      case 'sehne': this.osz('triangle', 300 + Math.random() * 70, t, 0.22, 0.3 * v, z, 120); this.osz('sine', 600 + Math.random() * 80, t, 0.12, 0.12 * v, z, 300); A('klinge', 0.32, 1.7, 7000); this.rausch(t + 0.02, 0.25, 0.1 * v, z, 'bandpass', 1800, 700, 1.4); break;
      case 'treffer': A('schnitt', 0.5, 0.9, 6000); A('klick', 0.35, 0.65, 3000); this.rausch(t, 0.08, 0.18 * v, z, 'bandpass', 1400, undefined, 1.5); this.osz('sine', 140, t, 0.1, 0.18 * v, z, 70); break;
      case 'schlag': A(this.eins(['tuer1', 'tuer2', 'tuer3', 'tuer4']), 0.55, 0.62, 2200); A('knarr2', 0.18, 0.8, 1800); this.osz('sine', 90, t, 0.18, 0.25 * v, z, 45); break;
      case 'explosion': this.rausch(t, 1.2, 0.75 * v, z, 'lowpass', 1600, 70); this.osz('sine', 72, t, 1.0, 0.8 * v, z, 28); A('tuer4', 0.5, 0.45, 1500); this.rausch(t, 0.05, 0.25 * v, z, 'highpass', 2500); break;
      case 'einsturz': this.rausch(t, 1.8, 0.45 * v, z, 'lowpass', 900, 60); this.osz('sine', 52, t, 1.4, 0.38 * v, z, 28); A('knarr1', 0.5, 0.55, 2500); A(this.eins(['tuer1', 'tuer4']), 0.5, 0.6, 1800, 0.25); A(this.eins(['tuer2', 'tuer3']), 0.4, 0.5, 1500, 0.6); break;
      case 'horn': if (!this.note('french_horn', 50, t, 2.6, 0.55 * v, z) || !this.note('trombone', 38, t, 2.6, 0.45 * v, z)) for (const [f, l] of [[110, 0.16], [165, 0.1], [220, 0.06]] as [number, number][]) this.osz('sawtooth', f, t, 2.4, l * v, this.filter(z, 900), f * 0.99, 0.5); break;
      case 'glocke': if (!this.note('tubular_bells', 72, t, 3, 0.4 * v, z)) for (const [f, l] of [[523, 0.12], [784, 0.07], [1046, 0.05], [1568, 0.03]] as [number, number][]) this.osz('sine', f, t, 2.6, l * v, z); break;
      case 'tod': this.rausch(t, 0.35, 0.22 * v, z, 'bandpass', 600, 180, 2); A('leder', 0.4, 0.7, 2500, 0.05); this.osz('sawtooth', 160 + Math.random() * 60, t, 0.32, 0.08 * v, this.filter(z, 700), 70); break;
      case 'wurf': this.rausch(t, 0.45, 0.22 * v, z, 'bandpass', 400, 1400, 1.2); A('klinge', 0.2, 0.8, 3000); break;
      case 'boss': if (!this.note('timpani', 36, t, 2, 0.8 * v, z)) this.rausch(t, 2.4, 0.18 * v, z, 'lowpass', 300, 80); this.note('trombone', 38, t + 0.2, 3, 0.5 * v, z); this.note('trombone', 39, t + 1.4, 2.4, 0.45 * v, z);
        for (const [f, l] of [[55, 0.22], [82, 0.12]] as [number, number][]) this.osz('sawtooth', f, t, 3.2, l * v, this.filter(z, 380), f * 0.92, 0.6); break;
      case 'siegel': for (const [m, d] of [[67, 0], [72, 0.25], [76, 0.5], [79, 0.75], [84, 1]] as [number, number][]) if (!this.note('celesta', m, t + d, 2.4, 0.4 * v, z)) this.osz('sine', 440 * Math.pow(2, (m - 69) / 12), t + d, 3, 0.07 * v, z); this.note('choir_aahs', 55, t, 4, 0.35 * v, z); break;
      case 'omen': this.note('choir_aahs', 58, t, 3.2, 0.4 * v, z); this.note('choir_aahs', 61, t + 0.3, 3, 0.3 * v, z); this.osz('sine', 233, t, 2.8, 0.05 * v, this.filter(z, 1200), 220, 0.8); this.rausch(t, 2.6, 0.03 * v, z, 'bandpass', 900, 2400, 4); break;
      case 'wunder': for (let i = 0; i < 6; i++) if (!this.note('orchestral_harp', [60, 64, 67, 72, 76, 79][i], t + i * 0.12, 2.4, 0.45 * v, z)) this.osz('triangle', [262, 330, 392, 523, 659, 784][i], t + i * 0.14, 2.6 - i * 0.2, 0.07 * v, z); this.note('string_ensemble_1', 48, t, 3.4, 0.4 * v, z); this.note('tubular_bells', 72, t + 0.8, 3, 0.35 * v, z); break;
      case 'falle': this.rausch(t, 0.4, 0.4 * v, z, 'lowpass', 2200, 200); if (!A('riegel', 0.6, 0.6)) this.osz('square', 140, t, 0.12, 0.12 * v, z, 60); break;
      case 'blitz': this.rausch(t, 0.3, 0.38 * v, z, 'highpass', 2600); this.osz('sawtooth', 1400, t, 0.1, 0.12 * v, z, 300); this.rausch(t + 0.05, 1.4, 0.35 * v, z, 'lowpass', 420, 60); break;
      case 'feuer': this.rausch(t, 0.6, 0.1 * v, z, 'bandpass', 900, 500, 1.5); this.rausch(t, 0.4, 0.04 * v, z, 'highpass', 3500); break;
    }
  }
  private filter(ziel: AudioNode, f: number): BiquadFilterNode { const fl = this.ctx!.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; fl.connect(ziel); return fl; }

  // ---------- Instrumente ----------
  /** Note eines Instruments spielen (nächstliegender Ton, Tonhöhe angepasst); false, wenn keine Aufnahme da ist */
  private note(inst: Instrument, midi: number, t: number, dauer: number, laut: number, ziel: AudioNode): boolean {
    const toene = this.instrumente.get(inst); if (!toene) return false;
    let best = toene[0]; for (const x of toene) if (Math.abs(x.midi - midi) < Math.abs(best.midi - midi)) best = x;
    const c = this.ctx!, s = c.createBufferSource(), g = c.createGain();
    s.buffer = best.buf; s.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
    const ende = Math.min(dauer, best.buf.duration / s.playbackRate.value);
    g.gain.setValueAtTime(laut, t); g.gain.setValueAtTime(laut, t + Math.max(0.02, ende - 0.3)); g.gain.linearRampToValueAtTime(0.0001, t + ende);
    s.connect(g); g.connect(ziel); s.start(t); s.stop(t + ende + 0.05);
    return true;
  }

  // ---------- Komponist ----------
  private zufall(): number { this.zuf = (this.zuf * 16807) % 2147483647; return this.zuf / 2147483647; }
  /** neue Akkordfolge und neue Motive (alle acht Takte und beim Volkswechsel) */
  private neueStuecke(): void {
    const P = PROFILE[this.volk];
    this.folge = P.folgen[Math.floor(this.zufall() * P.folgen.length)];
    const motiv = () => {
      const out: { stufe: number; laenge: number }[] = []; const r = P.rhythmen[Math.floor(this.zufall() * P.rhythmen.length)];
      let s = Math.floor(this.zufall() * 3) + 2;
      for (const l of [...r, ...P.rhythmen[Math.floor(this.zufall() * P.rhythmen.length)]]) {
        s = Math.max(0, Math.min(9, s + Math.round((this.zufall() - 0.5) * 4)));
        if (this.volk === 'hainmar') s = PENTA.includes(s % 7) ? s : s + 1;
        out.push({ stufe: s, laenge: l });
      }
      return out;
    };
    this.motiv = motiv(); this.motivB = motiv();
  }
  private ton(stufe: number, grund: number): number { const L = PROFILE[this.volk].leiter, o = Math.floor(stufe / L.length); return grund + L[((stufe % L.length) + L.length) % L.length] + 12 * o; }
  private planeMusik(): void {
    const c = this.ctx; if (!c) return;
    if (this.lautMusik <= 0) { this.naechsterTakt = c.currentTime + 0.1; return; }
    while (this.naechsterTakt < c.currentTime + 0.6) {
      const P = PROFILE[this.volk], bpm = P.bpm * (this.nacht ? (this.dichte > 0.4 ? 1.18 : 1.08) : this.abendZeit ? 0.9 : 1);
      const achtel = 60 / bpm / 2;
      this.spieleTakt(this.naechsterTakt, achtel, this.takt);
      this.naechsterTakt += achtel * 8; this.takt++;
      if (this.takt % 8 === 0) this.neueStuecke();
    }
  }
  private spieleTakt(t0: number, e: number, n: number): void {
    const P = PROFILE[this.volk], m = this.mitHall(this.musik, 0.45);
    if (!this.mitAufnahmen) { this.taktErzeugt(t0, e, n); return; }
    const stufe = this.folge[n % 4] + (this.nacht ? 0 : 0), grund = P.grund, akk = [stufe, stufe + 2, stufe + 4];
    const d = this.dichte, nacht = this.nacht, abend = this.abendZeit && !nacht;
    // Fläche und Bass
    for (const s of akk) this.note(nacht ? 'choir_aahs' : P.flaeche, this.ton(s, grund + (nacht ? 0 : 12)), t0, e * 8, nacht ? 0.13 : 0.1, m);
    this.note(P.bass, this.ton(stufe, grund - 12), t0, e * 4, 0.32, m);
    if (!abend) this.note(P.bass, this.ton(stufe + (n % 2 ? 4 : 0), grund - 12), t0 + e * 4, e * 4, 0.24, m);
    // Begleitung: gebrochene Akkorde (Harfe) oder ruhige Schläge (Cello)
    if (!nacht || d < 0.5) {
      if (P.arpeggio) { const muster = [0, 1, 2, 1, 0, 2, 1, 2]; for (let i = 0; i < 8; i += abend ? 2 : 1) this.note(P.begleitung, this.ton(akk[muster[i]], grund + 12), t0 + i * e, e * 3, 0.14, m); }
      else for (const i of abend ? [0] : [0, 3, 6]) this.note(P.begleitung, this.ton(akk[i % 3], grund), t0 + i * e, e * 3, 0.2, m);
    }
    // Melodie: Motiv A, A', B, A in Phrasen zu zwei Takten; nachts tiefer und sparsamer
    const phrase = Math.floor(n / 2) % 4, halb = n % 2, mot = phrase === 2 ? this.motivB : this.motiv;
    const verschiebe = phrase === 1 ? 1 : phrase === 2 ? 2 : 0, inst = P.melodie[phrase === 2 ? 1 : 0];
    if (!(nacht && d > 0.6) && !(abend && n % 4 === 3)) {
      let pos = 0; const lagen = nacht ? 0 : 12;
      for (const [i, note] of mot.entries()) {
        const start = pos; pos += note.laenge; if (Math.floor(start / 8) !== halb) continue;
        if (nacht && i % 2 === 1) continue;
        const s = note.stufe + verschiebe + (phrase === 1 && i === mot.length - 1 ? -1 : 0);
        this.note(inst, this.ton(s, grund + lagen), t0 + (start % 8) * e, note.laenge * e * 1.1, nacht ? 0.22 : 0.3, m);
      }
    }
    // Schmuck: Glocke oder Kalimba am Phrasenende
    if (n % 4 === 3 && !nacht) this.note(P.schmuck, this.ton(stufe + 4, grund + 24), t0 + e * 6, e * 4, 0.16, m);
    // Schlagwerk: tags leicht, nachts und im Kampf stärker
    if (!abend) {
      const hits = nacht ? (d > 0.6 ? [0, 2, 3, 4, 6, 7] : d > 0.25 ? [0, 3, 4, 6] : [0, 4]) : P.schlag === 'woodblock' ? [0, 3, 6] : [0];
      for (const i of hits) this.note(nacht ? (P.schlag === 'woodblock' ? 'taiko_drum' : P.schlag) : P.schlag, P.schlag === 'woodblock' && !nacht ? 72 : i % 4 === 0 ? 36 : 42, t0 + i * e, e * 2, (nacht ? 0.35 + d * 0.3 : 0.12) * (i % 4 === 0 ? 1 : 0.6), m);
    }
    // Kampf: Blechbläser-Stöße
    if (nacht && d > 0.45 && n % 2 === 0) { this.note('trombone', this.ton(stufe, grund - 12), t0, e * 3, 0.3 * d, m); this.note('french_horn', this.ton(stufe + 2, grund), t0 + e * 4, e * 3, 0.25 * d, m); }
    // Rissfürst: eigenes, tiefes Motiv (Halbton-Schritt) über allem
    if (nacht && this.bossNacht && n % 4 === 0) { this.note('trombone', grund - 12, t0, e * 4, 0.35, m); this.note('trombone', grund - 11, t0 + e * 4, e * 4, 0.35, m); this.note('timpani', 36, t0, e * 2, 0.5, m); }
  }
  /** Rückfall ohne Aufnahmen: erzeugte Klänge (wie bis 0.7) */
  private taktErzeugt(t0: number, e: number, n: number): void {
    const P = PROFILE[this.volk], m = this.musik, hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
    const stufe = this.folge[n % 4], akk = [stufe, stufe + 2, stufe + 4].map((s) => this.ton(s, P.grund + 12));
    for (const k of akk) this.flaeche(hz(k - 12), t0, e * 8, 0.03, m);
    if (!this.nacht) for (let i = 0; i < 8; i++) this.osz('triangle', hz(akk[[0, 1, 2, 1, 0, 2, 1, 2][i]]), t0 + i * e, 0.9, 0.05, this.filter(m, 2200));
    else { for (const i of [0, 4]) this.trommel(t0 + i * e, 0.3, m); for (let i = 0; i < 8; i++) this.osz('sawtooth', hz(akk[0] - 24), t0 + i * e, e * 0.9, 0.04, this.filter(m, 500)); }
  }
  private flaeche(f: number, t: number, dauer: number, laut: number, ziel: AudioNode): void {
    const c = this.ctx!, fl = this.filter(ziel, 1100), g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(laut, t + dauer * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dauer); g.connect(fl);
    for (const d of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(g); o.start(t); o.stop(t + dauer + 0.05); }
  }
  private trommel(t: number, laut: number, ziel: AudioNode, f = 70): void { this.osz('sine', f * 1.8, t, 0.35, laut, ziel, f * 0.6); this.rausch(t, 0.05, laut * 0.3, ziel, 'lowpass', 600); }
}
