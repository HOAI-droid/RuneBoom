/**
 * Klänge und Musik, ganz im Browser erzeugt (WebAudio, keine Dateien, offline).
 * Tag: ruhig und warm (Laute, Flöte, Streicherfläche). Nacht: Trommeln, tiefe Streicher, Horn;
 * je mehr Wesen nah sind, desto dichter.
 */
type Ton = 'sehne' | 'treffer' | 'explosion' | 'hieb_holz' | 'hieb_stein' | 'hieb_kristall' | 'bau' | 'einsturz' | 'horn' | 'glocke' | 'tod' | 'abgeliefert' | 'klick' | 'reparatur' | 'wurf' | 'boss' | 'siegel' | 'omen' | 'wunder' | 'falle' | 'blitz' | 'feuer';

export class Klang {
  private ctx: AudioContext | null = null;
  private haupt!: GainNode; private musik!: GainNode; private effekte!: GainNode;
  private rauschen!: AudioBuffer;
  private zuletzt = new Map<string, number>();
  lautMusik = 0.55; lautEffekte = 0.7;
  private naechsterSchlag = 0; private schlag = 0; private nacht = false; private dichte = 0; private zuf = 7;
  private melodieStufe = 0;

  /** muss aus einer Nutzeraktion heraus aufgerufen werden */
  start(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    try { this.ctx = new AudioContext(); } catch { return; }
    const c = this.ctx;
    this.haupt = c.createGain(); this.haupt.gain.value = 0.9; this.haupt.connect(c.destination);
    const komp = c.createDynamicsCompressor(); komp.threshold.value = -14; komp.ratio.value = 4; komp.connect(this.haupt);
    this.musik = c.createGain(); this.musik.connect(komp); this.effekte = c.createGain(); this.effekte.connect(komp);
    this.setzeLautstaerke(this.lautMusik, this.lautEffekte);
    this.rauschen = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.rauschen.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.naechsterSchlag = c.currentTime + 0.2;
    setInterval(() => this.planeMusik(), 100);
  }
  setzeLautstaerke(m: number, e: number): void {
    this.lautMusik = m; this.lautEffekte = e;
    if (!this.ctx) return;
    this.musik.gain.setTargetAtTime(m * 0.5, this.ctx.currentTime, 0.1); this.effekte.gain.setTargetAtTime(e, this.ctx.currentTime, 0.1);
  }
  stimmung(nacht: boolean, dichte: number): void { this.nacht = nacht; this.dichte = Math.max(0, Math.min(1, dichte)); }

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

  // ---------- Geräusche ----------
  /** laut: 0..1 (z. B. nach Entfernung zur Kamera) */
  spiele(ton: Ton, laut = 1): void {
    const c = this.ctx; if (!c || laut < 0.03 || this.lautEffekte <= 0) return;
    const jetzt = c.currentTime, abst = ton === 'sehne' || ton === 'treffer' ? 0.05 : ton.startsWith('hieb') ? 0.08 : 0.04;
    if ((this.zuletzt.get(ton) || 0) > jetzt - abst) return; this.zuletzt.set(ton, jetzt);
    const t = jetzt + 0.01, z = this.effekte, v = laut;
    switch (ton) {
      case 'sehne': this.osz('triangle', 330 + Math.random() * 60, t, 0.16, 0.18 * v, z, 140); this.rausch(t, 0.05, 0.08 * v, z, 'bandpass', 2400, undefined, 3); break;
      case 'treffer': this.rausch(t, 0.06, 0.16 * v, z, 'highpass', 1800); this.osz('square', 180, t, 0.04, 0.05 * v, z, 90); break;
      case 'explosion': this.rausch(t, 0.9, 0.5 * v, z, 'lowpass', 1400, 90); this.osz('sine', 70, t, 0.7, 0.5 * v, z, 32); break;
      case 'hieb_holz': this.osz('square', 520, t, 0.03, 0.08 * v, z, 300); this.rausch(t, 0.08, 0.12 * v, z, 'lowpass', 900); break;
      case 'hieb_stein': this.rausch(t, 0.07, 0.15 * v, z, 'bandpass', 2600, undefined, 2); this.osz('square', 900, t, 0.025, 0.04 * v, z); break;
      case 'hieb_kristall': this.osz('sine', 1760 + Math.random() * 300, t, 0.5, 0.08 * v, z); this.osz('sine', 2640, t, 0.3, 0.04 * v, z); break;
      case 'bau': for (let i = 0; i < 3; i++) { this.osz('square', 260 - i * 30, t + i * 0.12, 0.05, 0.1 * v, z, 160); this.rausch(t + i * 0.12, 0.05, 0.08 * v, z, 'lowpass', 700); } break;
      case 'einsturz': this.rausch(t, 1.4, 0.45 * v, z, 'lowpass', 900, 70); this.osz('sine', 55, t, 1.0, 0.35 * v, z, 30); break;
      case 'horn': for (const [f, l] of [[110, 0.16], [165, 0.1], [220, 0.06]] as [number, number][]) { const o = this.osz('sawtooth', f, t, 2.4, l * v, this.filter(z, 900), f * 0.99, 0.5); o.detune.value = Math.random() * 8; } break;
      case 'glocke': for (const [f, l] of [[523, 0.12], [784, 0.07], [1046, 0.05], [1568, 0.03]] as [number, number][]) this.osz('sine', f, t, 2.6, l * v, z); break;
      case 'tod': this.rausch(t, 0.18, 0.1 * v, z, 'bandpass', 700, 300, 2); break;
      case 'abgeliefert': this.osz('sine', 880, t, 0.12, 0.03 * v, z); this.osz('sine', 1320, t + 0.05, 0.12, 0.02 * v, z); break;
      case 'klick': this.osz('triangle', 660, t, 0.05, 0.06 * v, z); break;
      case 'reparatur': this.osz('square', 1200, t, 0.03, 0.05 * v, z, 700); break;
      case 'wurf': this.rausch(t, 0.35, 0.12 * v, z, 'bandpass', 500, 1500, 1); break;
      // ---- neu in 0.6 ----
      case 'boss': for (const [f, l] of [[55, 0.3], [82, 0.18], [110, 0.1]] as [number, number][]) this.osz('sawtooth', f, t, 3.2, l * v, this.filter(z, 420), f * 0.92, 0.6); this.rausch(t, 2.4, 0.18 * v, z, 'lowpass', 300, 80); break;
      case 'siegel': for (const [f, l, d] of [[392, 0.1, 0], [523, 0.08, 0.25], [659, 0.07, 0.5], [784, 0.06, 0.75], [1046, 0.05, 1]] as [number, number, number][]) this.osz('sine', f, t + d, 3, l * v, z); this.osz('triangle', 196, t, 4, 0.06 * v, z); break;
      case 'omen': this.osz('sine', 233, t, 2.8, 0.08 * v, this.filter(z, 1200), 220, 0.8); this.osz('sine', 349, t + 0.3, 2.4, 0.05 * v, z, 330, 0.8); this.rausch(t, 2.6, 0.04 * v, z, 'bandpass', 900, 2400, 4); break;
      case 'wunder': for (let i = 0; i < 6; i++) this.osz('triangle', [262, 330, 392, 523, 659, 784][i], t + i * 0.14, 2.6 - i * 0.2, 0.07 * v, z); this.osz('sine', 131, t, 3, 0.1 * v, z); break;
      case 'falle': this.rausch(t, 0.4, 0.4 * v, z, 'lowpass', 2200, 200); this.osz('square', 140, t, 0.12, 0.12 * v, z, 60); break;
      case 'blitz': this.rausch(t, 0.25, 0.2 * v, z, 'highpass', 3000); this.osz('sawtooth', 1400, t, 0.08, 0.05 * v, z, 300); break;
      case 'feuer': this.rausch(t, 0.6, 0.1 * v, z, 'bandpass', 900, 500, 1.5); break;
    }
  }
  private filter(ziel: AudioNode, f: number): BiquadFilterNode { const fl = this.ctx!.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; fl.connect(ziel); return fl; }

  // ---------- Musik ----------
  private zufall(): number { this.zuf = (this.zuf * 16807) % 2147483647; return this.zuf / 2147483647; }
  private planeMusik(): void {
    const c = this.ctx; if (!c || this.lautMusik <= 0) { if (c) this.naechsterSchlag = c.currentTime + 0.1; return; }
    const bpm = this.nacht ? 96 : 76, achtel = 60 / bpm / 2;
    while (this.naechsterSchlag < c.currentTime + 0.4) { this.spieleAchtel(this.naechsterSchlag, achtel, this.schlag); this.naechsterSchlag += achtel; this.schlag++; }
  }
  private spieleAchtel(t: number, achtel: number, n: number): void {
    const m = this.musik, takt = Math.floor(n / 8), pos = n % 8;
    // D-Dorisch am Tag, D-Äolisch in der Nacht; Akkordfolge über vier Takte
    const tagAkk = [[62, 65, 69], [60, 64, 67], [55, 59, 62], [62, 65, 69]], nachtAkk = [[62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 60, 64]];
    const akk = (this.nacht ? nachtAkk : tagAkk)[takt % 4];
    const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
    if (!this.nacht) {
      // Streicherfläche je Takt
      if (pos === 0) for (const k of akk) this.flaeche(hz(k - 12), t, achtel * 8, 0.035, m);
      // Laute: gebrochener Akkord
      const muster = [0, 1, 2, 1, 0, 2, 1, 2], ton = akk[muster[pos]];
      this.laute(hz(ton), t, 0.06, m);
      // Flöte: ruhige Melodie, nicht in jedem Takt
      if ((pos === 0 || pos === 3 || pos === 6) && takt % 8 >= 2 && this.zufall() < 0.7) {
        const leiter = [62, 64, 65, 67, 69, 71, 72, 74, 76];
        this.melodieStufe = Math.max(0, Math.min(leiter.length - 1, this.melodieStufe + Math.round((this.zufall() - 0.5) * 3)));
        this.floete(hz(leiter[this.melodieStufe] + 12), t, achtel * (pos === 6 ? 2 : 3), 0.045, m);
      }
    } else {
      const d = this.dichte;
      // Trommeln: dumpfe Schläge, mit der Dichte mehr
      if (pos === 0 || pos === 4) this.trommel(t, 0.32, m);
      if (d > 0.25 && (pos === 3 || pos === 7)) this.trommel(t, 0.18, m, 90);
      if (d > 0.6 && pos % 2 === 1) this.trommel(t, 0.1, m, 140);
      // tiefe Streicher: Achtel auf dem Grundton
      this.osz('sawtooth', hz(akk[0] - 24), t, achtel * 0.9, 0.05, this.filter(m, 500));
      if (pos === 0) { for (const k of akk) this.flaeche(hz(k - 12), t, achtel * 8, 0.03, m); if (takt % 2 === 0) this.osz('sawtooth', hz(akk[0] - 12), t, achtel * 7, 0.05 + d * 0.04, this.filter(m, 700 + d * 600), undefined, 0.4); }
      if (d > 0.4 && (pos === 2 || pos === 6)) this.osz('triangle', hz(akk[(pos / 2) % 3] + 12), t, achtel, 0.03 * d, m);
    }
  }
  private laute(f: number, t: number, laut: number, ziel: AudioNode): void { this.osz('triangle', f, t, 0.9, laut, this.filter(ziel, 2200)); this.osz('sine', f * 2, t, 0.4, laut * 0.3, ziel); }
  private floete(f: number, t: number, dauer: number, laut: number, ziel: AudioNode): void {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(laut, t + 0.08); g.gain.setValueAtTime(laut, t + dauer * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g); g.connect(ziel); o.start(t); lfo.start(t); o.stop(t + dauer + 0.05); lfo.stop(t + dauer + 0.05);
    this.rausch(t, 0.06, laut * 0.3, ziel, 'bandpass', f * 2, undefined, 4);
  }
  private flaeche(f: number, t: number, dauer: number, laut: number, ziel: AudioNode): void {
    const c = this.ctx!, fl = this.filter(ziel, 1100), g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(laut, t + dauer * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dauer); g.connect(fl);
    for (const d of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(g); o.start(t); o.stop(t + dauer + 0.05); }
  }
  private trommel(t: number, laut: number, ziel: AudioNode, f = 70): void { this.osz('sine', f * 1.8, t, 0.35, laut, ziel, f * 0.6); this.rausch(t, 0.05, laut * 0.3, ziel, 'lowpass', 600); }
}
