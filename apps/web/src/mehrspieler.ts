/**
 * Mehrspieler (klassischer Koop, 2–4 Spieler): eine Welt, eine Burg, je Spieler eine Himmelsrichtung.
 *
 * Gleichlauf: Jedes Gerät rechnet dieselbe Partie (feste Rechnung, siehe rechnen.ts). Der Gastgeber ist die Uhr:
 * er rechnet im eigenen Takt, führt alle Befehle aus (auch die der Gäste) und schickt laufend „bis Takt n,
 * mit diesen Befehlen“. Gäste rechnen genau bis dorthin nach. Prüfsummen zeigen Abweichungen; dann wird am
 * nächsten Tag neu abgeglichen. Kommt jemand dazu (nur am Tag), laden alle denselben Spielstand neu.
 *
 * Verbindung: WebRTC über trystero (Treffpunkt über öffentliche Nostr-Relais, kein eigener Server).
 * Für Tests im selben Browser: BroadcastChannel (Adresse mit ?netz=lokal).
 */
import { SEITEN, t, type Befehl, type Seite, type Spiel, type Spielstand } from '@runeboom/core';

type Nachricht =
  | { t: 'hallo'; id: string; name: string; v: string }
  | { t: 'gastgeber'; v: string }
  | { t: 'warte'; text: string }
  | { t: 'basis'; ep: number; stand: Spielstand }
  | { t: 'lauf'; ep: number; bis: number; b: { takt: number; b: Befehl }[]; tempo: number; pruef?: [number, number][]; leute: Leute[] }
  | { t: 'befehl'; b: Befehl }
  | { t: 'antwort'; text: string; ton: 'gut' | 'schlecht' | 'info' }
  | { t: 'wunsch'; tempo: number; bericht: boolean }
  | { t: 'abweichung'; ep: number }
  | { t: 'tschuess' };
export interface Leute { id: string; name: string; seite: Seite; da: boolean; tempo: number }

interface Netz { ich: string; senden(m: Nachricht, an?: string): void; ende(): void }
interface NetzOhr { nachricht(m: Nachricht, von: string): void; kommt(peer: string): void; geht(peer: string): void }

/** öffentliche Relais, über die sich die Geräte finden (die Partie selbst läuft direkt von Gerät zu Gerät) */
const APP = 'runeboom-koop-1';

async function verbinden(raum: string, ohr: NetzOhr): Promise<Netz> {
  const lokal = new URLSearchParams(location.search).get('netz') === 'lokal';
  if (lokal || typeof RTCPeerConnection === 'undefined') {
    const ich = Math.random().toString(36).slice(2, 10), kanal = new BroadcastChannel(`${APP}-${raum}`), bekannt = new Set<string>();
    kanal.onmessage = (e) => {
      const { von, an, m, art } = e.data as { von: string; an?: string; m?: Nachricht; art?: 'da' | 'weg' };
      if (von === ich || (an && an !== ich)) return;
      if (art === 'da') { if (!bekannt.has(von)) { bekannt.add(von); kanal.postMessage({ von: ich, art: 'da' }); ohr.kommt(von); } return; }
      if (art === 'weg') { if (bekannt.delete(von)) ohr.geht(von); return; }
      if (!bekannt.has(von)) { bekannt.add(von); ohr.kommt(von); }
      if (m) ohr.nachricht(m, von);
    };
    kanal.postMessage({ von: ich, art: 'da' });
    const weg = () => kanal.postMessage({ von: ich, art: 'weg' });
    addEventListener('pagehide', weg);
    return { ich, senden: (m, an) => kanal.postMessage({ von: ich, an, m }), ende: () => { weg(); removeEventListener('pagehide', weg); kanal.close(); } };
  }
  const { joinRoom, selfId } = await import('trystero/nostr');
  const room = joinRoom({ appId: APP }, raum);
  const kanal = room.makeAction<string>('m', { onMessage: (d, k) => { try { ohr.nachricht(JSON.parse(d) as Nachricht, k.peerId); } catch { /* kaputte Nachricht */ } } });
  room.onPeerJoin = (p) => ohr.kommt(p);
  room.onPeerLeave = (p) => ohr.geht(p);
  return { ich: selfId, senden: (m, an) => { kanal.send(JSON.stringify(m), an ? { target: an } : undefined).catch(() => { /* Gegenüber fort */ }); }, ende: () => { void room.leave(); } };
}

/** dauerhafte Kennung dieses Spielers (damit man nach einem Abbruch auf seine Seite zurückkehrt) */
export function spielerKennung(): string {
  const p = new URLSearchParams(location.search).get('spieler'); if (p) return p;
  try { let k = localStorage.getItem('runeboom-spieler-id'); if (!k) { k = 'S' + Math.random().toString(36).slice(2, 10); localStorage.setItem('runeboom-spieler-id', k); } return k; } catch { return 'S' + Math.random().toString(36).slice(2, 10); }
}
export function neuerRaumcode(): string {
  const z = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += z[Math.floor(Math.random() * z.length)];
  return s.slice(0, 3) + '-' + s.slice(3);
}

export interface KoopRahmen {
  /** aktuelle Partie (oder null, solange der Gast noch wartet) */
  spiel(): Spiel | null;
  /** alle laden diesen Stand neu; erstes = Gast betritt die Welt zum ersten Mal */
  neuerStand(stand: Spielstand, erstes: boolean): void;
  melde(text: string, ton: 'gut' | 'schlecht' | 'info'): void;
  /** Verbindungszustand für die Anzeige */
  zustand(text: string): void;
}

export class Koop {
  rolle: 'gastgeber' | 'gast';
  raum: string; ich: string; name: string;
  /** wirksames Tempo (0 = Pause), vom Gastgeber festgelegt */
  tempo = 1;
  leute: Leute[] = [];
  private netz: Netz | null = null;
  private ep = 0;
  private wunschTempo = 1; private bericht = false;
  // Gastgeber
  private gaeste = new Map<string, { id: string; name: string; tempo: number; bericht: boolean }>();
  private wartend = new Map<string, { id: string; name: string }>();
  private gesendet = 0; private pruefOffen: [number, number][] = []; private abgleichNoetig = false; private letzterLauf = 0;
  // Gast
  private gastgeber: string | null = null;
  private folge: { takt: number; b: Befehl }[] = []; private bis = 0; private pruefe = new Map<number, number>(); private abweichungGemeldet = -1;
  private hatBasis = false;

  constructor(rolle: 'gastgeber' | 'gast', raum: string, name: string, private rahmen: KoopRahmen, private version: string) {
    this.rolle = rolle; this.raum = raum; this.name = name || (rolle === 'gastgeber' ? t('Gastgeber') : t('Gast')); this.ich = spielerKennung();
  }
  get gast(): boolean { return this.rolle === 'gast'; }
  /** Raum öffnen bzw. beitreten */
  async start(): Promise<void> {
    this.rahmen.zustand(t('Verbinde …'));
    this.netz = await verbinden(this.raum, { nachricht: (m, v) => this.nachricht(m, v), kommt: (p) => this.kommt(p), geht: (p) => this.geht(p) });
    if (this.rolle === 'gastgeber') {
      const s = this.rahmen.spiel()!;
      if (!s.spieler.some((p) => p.id === this.ich)) s.befehl({ art: 'beitritt', id: this.ich, name: this.name, seite: freieSeite(s) });
      s.ansicht = this.ich; this.gesendet = s.protokoll.length;
      this.rahmen.zustand(t('Raum offen: {a}', { a: this.raum }));
    } else this.rahmen.zustand(t('Suche den Gastgeber …'));
    this.leuteNeu();
  }
  ende(): void { this.netz?.senden({ t: 'tschuess' }); this.netz?.ende(); this.netz = null; }

  // ---------------- von der Oberfläche ----------------
  /** Befehl des eigenen Spielers */
  befehl(b: Befehl): boolean {
    const s = this.rahmen.spiel(); if (!s) return false;
    const mit = { ...b, spieler: this.ich } as Befehl;
    if (this.rolle === 'gastgeber') return s.befehl(mit);
    // Gast: vorab prüfen, was sich prüfen lässt (eigene Kasse), dann an den Gastgeber
    this.netz?.senden({ t: 'befehl', b: mit }, this.gastgeber || undefined);
    return true;
  }
  wunsch(tempo: number, bericht: boolean): void {
    if (tempo === this.wunschTempo && bericht === this.bericht) return;
    this.wunschTempo = tempo; this.bericht = bericht;
    if (this.rolle === 'gast') this.netz?.senden({ t: 'wunsch', tempo, bericht }, this.gastgeber || undefined);
    else this.tempoNeu();
  }

  // ---------------- Gastgeber ----------------
  /** nach jedem Takt (Gastgeber): Prüfsummen sammeln, Beitritte am Tag annehmen */
  nachSchritt(s: Spiel): void {
    if (this.rolle !== 'gastgeber') return;
    if (s.takt % 100 === 0) this.pruefOffen.push([s.takt, s.pruefsumme()]);
  }
  /** einmal je Bild (Gastgeber): Lauf verschicken */
  senden(s: Spiel): void {
    if (this.rolle !== 'gastgeber' || !this.netz) return;
    if (s.phase === 'tag' && (this.wartend.size || this.abgleichNoetig)) { this.abgleich(s); return; }
    const neu = s.protokoll.slice(this.gesendet); this.gesendet = s.protokoll.length;
    const jetzt = performance.now();
    if (!neu.length && !this.pruefOffen.length && jetzt - this.letzterLauf < 50) return;
    this.letzterLauf = jetzt;
    this.netz.senden({ t: 'lauf', ep: this.ep, bis: s.takt, b: neu, tempo: this.tempo, pruef: this.pruefOffen.length ? this.pruefOffen : undefined, leute: this.leute });
    this.pruefOffen = [];
  }
  /** alle laden denselben Stand (bei Beitritt oder nach einer Abweichung) */
  private abgleich(s: Spiel): void {
    for (const [peer, w] of this.wartend) {
      if (!s.befehl({ art: 'beitritt', id: w.id, name: w.name, seite: freieSeite(s, w.id) })) { this.netz!.senden({ t: 'warte', text: t('Die Feste ist voll (höchstens 4 Spieler).') }, peer); continue; }
      this.gaeste.set(peer, { id: w.id, name: w.name, tempo: 1, bericht: false });
    }
    this.wartend.clear(); this.abgleichNoetig = false;
    const stand = s.speichern(); this.ep++;
    this.netz!.senden({ t: 'basis', ep: this.ep, stand });
    this.rahmen.neuerStand(stand, false); // auch der Gastgeber rechnet ab hier aus demselben Stand
    const n = this.rahmen.spiel()!; n.ansicht = this.ich; this.gesendet = n.protokoll.length; this.pruefOffen = [];
    this.leuteNeu();
  }
  private tempoNeu(): void {
    const w = [{ tempo: this.wunschTempo, bericht: this.bericht }, ...this.gaeste.values()];
    this.tempo = w.some((x) => x.tempo === 0 || x.bericht) ? 0 : Math.min(...w.map((x) => x.tempo));
    this.leuteNeu();
  }
  private leuteNeu(): void {
    const s = this.rahmen.spiel(); if (!s || this.rolle !== 'gastgeber') return;
    const da = new Map([[this.ich, this.wunschTempo], ...[...this.gaeste.values()].map((g) => [g.id, g.tempo] as [string, number])]);
    this.leute = s.spieler.map((p) => ({ ...p, da: da.has(p.id), tempo: da.get(p.id) ?? 1 }));
  }

  // ---------------- Netz ----------------
  private kommt(peer: string): void {
    if (this.rolle === 'gast') this.netz?.senden({ t: 'hallo', id: this.ich, name: this.name, v: this.version }, peer);
    else this.netz?.senden({ t: 'gastgeber', v: this.version }, peer);
  }
  private geht(peer: string): void {
    if (this.rolle === 'gastgeber') {
      const g = this.gaeste.get(peer); this.wartend.delete(peer);
      if (g) { this.gaeste.delete(peer); this.rahmen.melde(t('{a} hat die Partie verlassen. Die Türme dieser Seite kämpfen weiter.', { a: g.name }), 'info'); this.tempoNeu(); }
    } else if (peer === this.gastgeber) {
      this.gastgeber = null; this.tempo = 0;
      this.rahmen.melde(t('Die Verbindung zum Gastgeber ist weg. Die Partie ruht.'), 'schlecht'); this.rahmen.zustand(t('Gastgeber fort'));
    }
  }
  private nachricht(m: Nachricht, von: string): void {
    if (this.rolle === 'gastgeber') this.alsGastgeber(m, von); else this.alsGast(m, von);
  }
  private alsGastgeber(m: Nachricht, von: string): void {
    const s = this.rahmen.spiel(); if (!s) return;
    switch (m.t) {
      case 'hallo': {
        if (m.v !== this.version) { this.netz!.senden({ t: 'warte', text: t('Andere Fassung ({a}). Beide brauchen dieselbe Version.', { a: this.version }) }, von); return; }
        const zurueck = s.spieler.some((p) => p.id === m.id);
        if (!zurueck && s.spieler.length + this.wartend.size >= 4) { this.netz!.senden({ t: 'warte', text: t('Die Feste ist voll (höchstens 4 Spieler).') }, von); return; }
        this.wartend.set(von, { id: m.id, name: (m.name || t('Gast')).slice(0, 20) });
        this.rahmen.melde(zurueck ? t('{a} kehrt zurück.', { a: m.name }) : t('{a} möchte mitspielen.', { a: m.name }), 'info');
        if (s.phase !== 'tag') this.netz!.senden({ t: 'warte', text: t('Beitreten geht nur am Tag. Gleich bei Sonnenaufgang geht es los.') }, von);
        break;
      }
      case 'befehl': {
        const g = this.gaeste.get(von); if (!g) return;
        const b = { ...m.b, spieler: g.id } as Befehl;
        if (b.art === 'beitritt') return;
        const vor = s.ereignisse.length, ok = s.befehl(b);
        // Meldungen dieses Befehls gehören dem Gast, nicht dem Gastgeber
        const neu = s.ereignisse.splice(vor), meld = neu.filter((e) => e.art === 'meldung');
        s.ereignisse.push(...neu.filter((e) => e.art !== 'meldung'));
        if (!ok) { const e = meld[0]; this.netz!.senden({ t: 'antwort', text: e && e.art === 'meldung' ? e.text : t('Das geht gerade nicht.'), ton: 'schlecht' }, von); }
        break;
      }
      case 'wunsch': { const g = this.gaeste.get(von); if (g) { g.tempo = m.tempo; g.bericht = m.bericht; this.tempoNeu(); } break; }
      case 'abweichung': if (m.ep === this.ep) { this.abgleichNoetig = true; } break;
      case 'tschuess': this.geht(von); break;
    }
  }
  private alsGast(m: Nachricht, von: string): void {
    switch (m.t) {
      case 'gastgeber':
        if (this.gastgeber && this.gastgeber !== von) return;
        this.gastgeber = von;
        if (m.v !== this.version) { this.rahmen.zustand(t('Andere Fassung beim Gastgeber ({a}).', { a: m.v })); return; }
        this.rahmen.zustand(t('Verbunden. Warte auf die Welt …'));
        this.netz!.senden({ t: 'hallo', id: this.ich, name: this.name, v: this.version }, von);
        break;
      case 'warte': this.rahmen.zustand(m.text); if (this.hatBasis) this.rahmen.melde(m.text, 'info'); break;
      case 'basis':
        if (von !== this.gastgeber) return;
        this.ep = m.ep; this.folge = []; this.bis = 0; this.pruefe.clear();
        this.rahmen.neuerStand(m.stand, !this.hatBasis); this.hatBasis = true;
        { const s = this.rahmen.spiel(); if (s) s.ansicht = this.ich; }
        this.rahmen.zustand(t('Im Raum {a}', { a: this.raum }));
        break;
      case 'lauf':
        if (von !== this.gastgeber || m.ep !== this.ep || !this.hatBasis) return;
        this.folge.push(...m.b); this.bis = m.bis; this.tempo = m.tempo; this.leute = m.leute;
        for (const [k, v] of m.pruef || []) this.pruefe.set(k, v);
        break;
      case 'antwort': this.rahmen.melde(m.text, m.ton); break;
      case 'tschuess': if (von === this.gastgeber) this.geht(von); break;
    }
  }
  /** Gast: so weit rechnen, wie der Gastgeber vorgibt. Gibt die Zahl der Takte zurück. */
  nachrechnen(s: Spiel, fehler: (e: unknown) => void): number {
    if (this.rolle !== 'gast' || !this.hatBasis) return 0;
    const rueckstand = this.bis - s.takt, max = rueckstand > 200 ? 400 : rueckstand > 20 ? 6 : 3;
    let n = 0;
    for (;;) {
      while (this.folge.length && this.folge[0].takt <= s.takt) {
        const { b } = this.folge.shift()!, vor = s.ereignisse.length;
        try { s.befehl(b); } catch (e) { fehler(e); }
        // Meldungen fremder Befehle nicht zeigen
        if (b.spieler !== this.ich) { const rest = s.ereignisse.splice(vor).filter((e) => e.art !== 'meldung'); s.ereignisse.push(...rest); }
      }
      if (s.takt >= this.bis || n >= max) break;
      try { s.schritt(); } catch (e) { fehler(e); }
      n++;
      const soll = this.pruefe.get(s.takt);
      if (soll !== undefined) {
        this.pruefe.delete(s.takt);
        if (soll !== s.pruefsumme() && this.abweichungGemeldet !== this.ep) { this.abweichungGemeldet = this.ep; this.netz?.senden({ t: 'abweichung', ep: this.ep }, this.gastgeber || undefined); console.warn('runeBOOM: Abweichung bei Takt', s.takt); }
      }
    }
    return n;
  }
  /** Rückstand des Gasts in Takten (für die Anzeige) */
  rueckstand(s: Spiel): number { return this.rolle === 'gast' ? Math.max(0, this.bis - s.takt) : 0; }
}

function freieSeite(s: Spiel, id?: string): Seite {
  const da = s.spieler.find((p) => p.id === id); if (da) return da.seite;
  return SEITEN.find((x) => !s.spieler.some((p) => p.seite === x)) || 'sued';
}
