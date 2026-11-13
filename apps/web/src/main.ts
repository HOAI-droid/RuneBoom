import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import {
  Spiel, DT, B, WR, CH, EBNEN_STEIN, BAUGRUPPEN, VOELKER, LEITSAETZE, OMEN, AKTE, ENDE_NACHT, RISSE, HAUPT_STUFEN, RES_NAMEN, STUFE_NAME, SCHWIERIGKEIT, runenkraft, WISSEN_NAME, TAG_DAUER as TAGD, FAEHIGKEIT_NAME, VERSCHMELZUNGEN, ZEITALTER_NAME, hoeheGeaendert, GEBAEUDE, BAULEISTE, ERFINDUNGEN, BAUSTEIN_NAME, GEGNER, TAG_DAUER, hoehe, neuerWeltcode,
  type GebTyp, type Geb, type Ruine, type Res, type Schwierigkeit, type Wissen, type Volk, type Baustein, type ErfId, type Spielstand
} from '@runeboom/core';
import { neuerRenderer, Beleuchtung, Nachbearbeitung, WeltAnsicht, Objekte, lichtkarteSetzen, ZEIT } from '@runeboom/render';
import { Klang } from './klang.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SPEICHER = 'runeboom-spielstand-3', PLAETZE = 'runeboom-plaetze-1', VERSION = '0.5.0';
const RES_NAME: Record<Res, string> = RES_NAMEN;
const MEHRZAHL: Record<string, string> = { moorwicht: 'Moorwichte', wolf: 'Schattenwölfe', troll: 'Steintrolle', drachling: 'Drachlinge', rochen: 'Nebelrochen', aschegeist: 'Aschegeister', steinwerfer: 'Steinwerfer', schamane: 'Moorschamanen', schildwaechter: 'Borkenwächter', rissfuerst: 'Rissfürsten' };
const kostenHtml = (k: Partial<Record<Res, number>>) => Object.entries(k).map(([r, n]) => `${Math.ceil(n as number)} ${RES_NAME[r as Res]}`).join(' · ');

// ================= Grundgerüst: Leinwand, Szene, Kamera =================
const canvas = $<HTMLCanvasElement>('leinwand');
const renderer = neuerRenderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 4000);
const licht = new Beleuchtung(scene, 60);
const post = new Nachbearbeitung(renderer, scene, camera, 0.5);
const controls = new MapControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
controls.minDistance = 22; controls.maxDistance = 900; controls.maxPolarAngle = 1.15; controls.minPolarAngle = 0.3;
function groesse(): void { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); post.groesse(w, h); }
addEventListener('resize', groesse); groesse();

// ================= Einstellungen =================
const EINST = 'runeboom-einstellungen-1';
const einst = { musik: 0.55, effekte: 0.7, grafik: 'hoch' as 'hoch' | 'mittel' | 'niedrig', einfuehrung: true };
try { Object.assign(einst, JSON.parse(localStorage.getItem(EINST) || '{}')); } catch { /* */ }
const einstSpeichern = () => { try { localStorage.setItem(EINST, JSON.stringify(einst)); } catch { /* */ } };
const klang = new Klang(); klang.setzeLautstaerke(einst.musik, einst.effekte);
function grafikSetzen(): void {
  const st = einst.grafik;
  renderer.setPixelRatio(st === 'hoch' ? Math.min(devicePixelRatio || 1, 1.6) : 1);
  const schatten = st !== 'niedrig';
  if (renderer.shadowMap.enabled !== schatten) { renderer.shadowMap.enabled = schatten; scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true)); }); }
  licht.sun.shadow.mapSize.set(st === 'hoch' ? 2048 : 1024, st === 'hoch' ? 2048 : 1024); licht.sun.shadow.map?.dispose(); (licht.sun.shadow as any).map = null;
  groesse();
}
grafikSetzen();
/** Lautstärke eines Geräuschs nach Entfernung zum Blickpunkt */
const naehe = (x: number, z: number) => Math.max(0, 1 - Math.hypot(x - controls.target.x, z - controls.target.z) / (40 + camera.position.distanceTo(controls.target) * 0.6));

// ================= Zustand =================
let spiel: Spiel | null = null, welt: WeltAnsicht | null = null, obj: Objekte | null = null;
let tempo = 1, werkzeug: { art: 'bau'; typ: GebTyp } | { art: 'spaeher' } | { art: 'ebnen' } | { art: 'feuerregen' } | null = null, gewaehlt: Geb | null = null, ruineGew: Ruine | null = null;
let fehlerGemeldet = 0, kegelZeit = 0;
let anzeigeDunkel = 0, akku = 0, planZeit = 0, uiZeit = 0;
let panelArt: 'geb' | 'werkstatt' | 'einst' | 'ruine' | null = null;
/** Panel nur neu schreiben, wenn sich der Inhalt ändert (sonst gehen Klicks verloren) */
function panelSetzen(html: string): boolean { const p = $('panel'); if (p.dataset.html === html && !p.hidden) return false; p.dataset.html = html; p.innerHTML = html; p.hidden = false; return true; }
let einfuehrungSchritt = -1, spaeherGeschickt = false;

function starte(code: string, stand?: Spielstand, schwierigkeit: Schwierigkeit = 'normal', volk: Volk = 'glutborn'): void {
  aufraeumen(); imMenue = false; $('start').hidden = true;
  enthuellen(); klang.start();
  spiel = new Spiel(code, stand, { schwierigkeit, volk });
  $('sieg').hidden = true;
  welt = new WeltAnsicht(scene, spiel.seed, spiel.erkundet);
  const sp = spiel, wa = welt;
  welt.aenderungen = (cx, cz) => sp.dekoAenderungen(cx, cz, CH);
  welt.hoehen = (cx, cz) => { const out: [number, number, number][] = []; for (let x = cx * CH - 2; x < cx * CH + CH + 2; x++) for (let z = cz * CH - 2; z < cz * CH + CH + 2; z++) { const h = hoeheGeaendert(x, z); if (h !== undefined) out.push([x, z, h]); } return out; };
  welt.onUebersicht = () => { zeichneKartenGrund(); for (const k of [...sp.gefaellt.keys(), ...sp.abgebaut.keys()]) { const x = Math.floor(k / 2048) - 600, z = (k % 2048) - 600; wa.grobDeko(x, z, !sp.dekoZustand(x, z)); } };
  einfuehrungSchritt = einst.einfuehrung && !stand ? 0 : -1; spaeherGeschickt = false;
  obj = new Objekte(scene, spiel);
  lichtkarteSetzen(spiel.lichtquellen());
  const ziel = new THREE.Vector3(B.x + 0.5, 7, B.z + 16);
  controls.target.copy(ziel); camera.position.copy(ziel).add(new THREE.Vector3(56, 70, 74)); controls.update();
  anzeigeDunkel = spiel.dunkel();
  $('start').hidden = true; $('ende').hidden = true; $('hud').hidden = false;
  $('weltcode').textContent = code;
  baueLeiste(); setzeTempo(1); waehle(null); werkzeugSetzen(null);
  spiel.ereignisse.length = 0;
  melde(stand ? `Willkommen zurück. Tag ${spiel.nacht}.` : 'Tag 1. Baue Türme vor dem Tor, bevor die Nacht kommt. Der Pfad zeigt, woher die Wesen kommen.', 'info');
}
function aufraeumen(): void { obj?.ende(); welt?.ende(); obj = null; welt = null; spiel = null; imMenue = false; imAbspann = false; }
function speichern(): void { if (!spiel || imMenue || spiel.phase === 'verloren' || spiel.phase === 'nacht') return; try { localStorage.setItem(SPEICHER, JSON.stringify(spiel.speichern())); } catch { /* Speicher nicht verfügbar */ } }
interface Platz { name: string; datum: number; stand: Spielstand }
function plaetze(): (Platz | null)[] { try { const p = JSON.parse(localStorage.getItem(PLAETZE) || '[]'); return [0, 1, 2].map((i) => p[i] || null); } catch { return [null, null, null]; } }
function platzSpeichern(i: number): boolean {
  if (!spiel || imMenue) return false;
  if (spiel.phase === 'nacht') { melde('In der Nacht lässt sich nicht speichern.', 'schlecht'); return false; }
  const p = plaetze(); p[i] = { name: `${spiel.code} · Tag ${spiel.nacht}`, datum: Date.now(), stand: spiel.speichern() };
  try { localStorage.setItem(PLAETZE, JSON.stringify(p)); melde(`Gespeichert in Platz ${i + 1}.`, 'gut'); return true; } catch { melde('Speichern nicht möglich.', 'schlecht'); return false; }
}
function platzLoeschen(i: number): void { const p = plaetze(); p[i] = null; try { localStorage.setItem(PLAETZE, JSON.stringify(p)); } catch { /* */ } }
const standInfo = (st: Spielstand) => `Tag ${st.nacht} · ${st.code} · ${VOELKER[st.volk || 'glutborn'].name} · ${SCHWIERIGKEIT[st.schwierigkeit || 'normal'].name}`;
function geladen(): Spielstand | null { try { const s = localStorage.getItem(SPEICHER); return s ? JSON.parse(s) : null; } catch { return null; } }

// ================= Hauptmenü mit lebender Welt =================
let imMenue = false, imAbspann = false, menueZeit = 0, neuSchwer: Schwierigkeit = 'normal', neuVolk: Volk = 'glutborn', neuCode = neuerWeltcode();
/** Feste für den Hintergrund des Menüs: echte Welt, ausgebaut, voller Leben */
function baueMenueWelt(): void {
  const code = 'NEBELKRAKE-4127';
  const s = new Spiel(code, undefined, { schwierigkeit: 'leicht', volk: 'sturmweber' });
  s.res.holz = s.res.stein = s.res.kristall = 99999; s.res.nahrung = 9999;
  for (const id of ['steinmetz', 'sprengpulver', 'leuchtfeuer', 'meisterbau'] as ErfId[]) s.erfindungen.add(id);
  s.aufdecken(B.x, B.z, 140);
  const ring = (typ: GebTyp, r: number, n: number, a0 = 0, a1 = Math.PI) => { for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / n, p = s.findePlatz(typ, Math.round(B.x + Math.cos(a) * r), Math.round(B.z + 6 + Math.sin(a) * r), 4); if (p) s.bauen(typ, p[0], p[1], true); } };
  ring('wachturm', 20, 4, 0.3, 2.8); ring('feuertopf', 28, 2, 0.8, 2.3); ring('fackel', 15, 5, 0.2, 2.9);
  ring('haus', 24, 6, 3.5, 5.9); ring('hof', 40, 2, 3.7, 5.6); ring('haus', 33, 4, 3.4, 6.1);
  for (const g of s.gebaeude) { if (GEBAEUDE[g.typ].kampf && g.typ !== 'haupt') { g.stufe = 2 + (g.id % 2); if (g.typ === 'wachturm' && g.id % 3 === 0) { g.typ = 'schuetzenturm'; g.zweig = 'weit'; } } if (g.typ === 'haus') g.stufe = 1 + (g.id % 3); if (g.typ === 'fackel' && g.id % 2) g.typ = 'leuchtfeuer'; }
  const h = s.haupt!; h.stufe = 4;
  s.einwohner = 70; s.verteileArbeiter();
  s.ereignisse.length = 0;
  spiel = s;
  welt = new WeltAnsicht(scene, s.seed, s.erkundet);
  const wa = welt;
  welt.aenderungen = (cx, cz) => s.dekoAenderungen(cx, cz, CH);
  welt.hoehen = () => [];
  welt.onUebersicht = () => { void wa; };
  obj = new Objekte(scene, s); obj.zeigePfeile = false;
  lichtkarteSetzen(s.lichtquellen());
  imMenue = true; menueZeit = 0;
  enthuellen();
}
// ================= Enthüllung: erst alles laden, dann von der Mitte her einblenden =================
const enth = { aktiv: false, phase: 0, t: 0 };
function enthuellen(): void {
  enth.aktiv = true; enth.phase = 0; enth.t = 0;
  const el = $('schleier'); el.hidden = false; el.classList.remove('auf'); el.style.setProperty('--r', '-30vmax');
  document.body.classList.add('verhuellt');
}
function enthuellungSchritt(dt: number): void {
  if (!enth.aktiv || !welt) return;
  enth.t += dt;
  const el = $('schleier');
  if (enth.phase === 0) {
    welt.planen(controls.target, camera.position.distanceTo(controls.target), camera);
    if (welt.bereit(controls.target, camera.position.distanceTo(controls.target), camera) || enth.t > 15) {
      try { renderer.compile(scene, camera); } catch { /* */ }
      enth.phase = 1; enth.t = 0; el.classList.add('auf'); document.body.classList.remove('verhuellt');
    }
    return;
  }
  const f = Math.min(1, enth.t / 2.6), e = 1 - Math.pow(1 - f, 3);
  el.style.setProperty('--r', `${-30 + e * 150}vmax`);
  if (f >= 1) { enth.aktiv = false; el.hidden = true; }
}
function menueKamera(dt: number): void {
  menueZeit += dt;
  if ((window as unknown as { runeboom: { menueStopp: boolean } }).runeboom.menueStopp) return;
  const a = menueZeit * 0.035 + 0.6, r = 92, ziel = new THREE.Vector3(B.x, 9, B.z + 4);
  controls.target.copy(ziel); camera.position.set(ziel.x + Math.cos(a) * r, 52 + Math.sin(menueZeit * 0.05) * 6, ziel.z + Math.sin(a) * r); camera.lookAt(ziel);
}
function seite(name: string | null): void {
  const el = $('seite');
  document.querySelectorAll<HTMLButtonElement>('[data-seite]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.seite === name)));
  if (!name) { el.hidden = true; return; }
  klang.start();
  if (name === 'neu') {
    el.innerHTML = `<h2>Neues Spiel</h2><p>Jeder Weltcode ergibt genau eine Welt. Teile ihn, damit andere dieselbe Welt versuchen können.</p>
      <div class="feld"><label for="code">Weltcode</label><input id="code" maxlength="24" spellcheck="false" autocomplete="off" value="${neuCode}"><button type="button" id="wuerfeln">Neu würfeln</button></div>
      <div class="feld"><label>Volk</label></div>
      <div class="stufen-wahl volk-wahl">${(Object.keys(VOELKER) as Volk[]).map((v) => `<button type="button" data-volk="${v}" aria-pressed="${v === neuVolk}" class="volk-${v}"><b>${VOELKER[v].name}</b><small>${VOELKER[v].stoff}. ${VOELKER[v].kurz}</small><small class="staerken">${VOELKER[v].staerken.join(' · ')}</small></button>`).join('')}</div>
      <div class="feld"><label>Schwierigkeit</label></div>
      <div class="stufen-wahl">${(Object.keys(SCHWIERIGKEIT) as Schwierigkeit[]).map((k) => `<button type="button" data-schwer="${k}" aria-pressed="${k === neuSchwer}"><b>${SCHWIERIGKEIT[k].name}</b><small>${k === 'leicht' ? 'Kleinere Wellen, mehr Vorrat. Zum Kennenlernen.' : k === 'normal' ? 'Ab Nacht 10 wird es ernst.' : 'Große Wellen, wenig Vorrat. Jeder Fehler zählt.'}</small></button>`).join('')}</div>
      <label class="regler"><span><input type="checkbox" id="mit-einf" ${einst.einfuehrung ? 'checked' : ''}> Einführung zeigen</span></label>
      <div class="reihe"><button type="button" class="knopf haupt" id="los">Welt betreten</button></div>`;
    const c = $<HTMLInputElement>('code');
    c.oninput = () => { neuCode = c.value; };
    $('wuerfeln').onclick = () => { neuCode = c.value = neuerWeltcode(); };
    el.querySelectorAll<HTMLButtonElement>('[data-schwer]').forEach((b) => { b.onclick = () => { neuSchwer = b.dataset.schwer as Schwierigkeit; seite('neu'); }; });
    el.querySelectorAll<HTMLButtonElement>('[data-volk]').forEach((b) => { b.onclick = () => { neuVolk = b.dataset.volk as Volk; seite('neu'); }; });
    $<HTMLInputElement>('mit-einf').onchange = (e) => { einst.einfuehrung = (e.target as HTMLInputElement).checked; einstSpeichern(); };
    $('los').onclick = () => starte(c.value.trim().toUpperCase() || neuerWeltcode(), undefined, neuSchwer, neuVolk);
  }
  if (name === 'plaetze') {
    const auto = geladen();
    el.innerHTML = `<h2>Spielstände</h2><p>Zu Beginn jedes Tages wird automatisch gespeichert. Im Spiel lässt sich über ☰ zusätzlich in einen der drei Plätze speichern.</p>
      <div class="platz"><b>Automatisch</b><small>${auto && auto.phase !== 'verloren' ? standInfo(auto) : 'leer'}</small><div class="knoepfe2"><button type="button" class="haupt" data-laden="auto" ${auto && auto.phase !== 'verloren' ? '' : 'disabled'}>Laden</button></div></div>
      ${plaetze().map((p, i) => `<div class="platz"><b>Platz ${i + 1}</b><small>${p ? `${standInfo(p.stand)} · ${new Date(p.datum).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : 'leer'}</small><div class="knoepfe2"><button type="button" class="haupt" data-laden="${i}" ${p ? '' : 'disabled'}>Laden</button><button type="button" data-loeschen="${i}" ${p ? '' : 'disabled'}>Löschen</button></div></div>`).join('')}`;
    el.querySelectorAll<HTMLButtonElement>('[data-laden]').forEach((b) => { b.onclick = () => { const k = b.dataset.laden!; const st = k === 'auto' ? geladen() : plaetze()[Number(k)]?.stand; if (st) starte(st.code, st, st.schwierigkeit); }; });
    el.querySelectorAll<HTMLButtonElement>('[data-loeschen]').forEach((b) => { b.onclick = () => { if (confirm('Diesen Spielstand wirklich löschen?')) { platzLoeschen(Number(b.dataset.loeschen)); seite('plaetze'); } }; });
  }
  if (name === 'einst') {
    el.innerHTML = `<h2>Einstellungen</h2>${einstellungenHtml()}`;
    einstellungenVerbinden(el, () => seite('einst'));
  }
  if (name === 'steuerung') {
    el.innerHTML = `<h2>Steuerung</h2><div class="hilfe">
      <kbd>Ziehen · Rad</kbd><span>Karte verschieben (linke oder mittlere Maustaste) · zoomen; rechte Maustaste oder zwei Finger: drehen</span>
      <kbd>W A S D · Q E</kbd><span>verschieben · drehen</span>
      <kbd>1 – 8 · H · F</kbd><span>Gebäude wählen, Klick setzt es; Mauern durch Ziehen</span>
      <kbd>Klick auf Gebäude</kbd><span>Ausbauen (Stufe I–III), Umrüsten, Verschmelzen, Reparieren</span>
      <kbd>X · 9</kbd><span>Späher in den Nebel (15 Holz) · Gelände ebnen</span>
      <kbd>T</kbd><span>Erfindungsbaum</span>
      <kbd>N · Leertaste</kbd><span>Nacht einläuten · Pause</span>
      <kbd>Esc · Rechtsklick</kbd><span>abbrechen</span></div>`;
  }
  el.hidden = false;
}
function einstellungenHtml(): string {
  return `<label class="regler">Musik <input type="range" id="e-musik" min="0" max="1" step="0.05" value="${einst.musik}"></label>
    <label class="regler">Klänge <input type="range" id="e-effekte" min="0" max="1" step="0.05" value="${einst.effekte}"></label>
    <div class="zeile"><span>Grafik</span><span class="wahl">${(['hoch', 'mittel', 'niedrig'] as const).map((g) => `<button type="button" data-grafik="${g}" aria-pressed="${einst.grafik === g}">${g[0].toUpperCase() + g.slice(1)}</button>`).join('')}</span></div>
    <p>Niedrig: ohne Schatten und Nachbearbeitung, für schwächere Geräte.</p>`;
}
function einstellungenVerbinden(p: HTMLElement, neu: () => void): void {
  const m = p.querySelector<HTMLInputElement>('#e-musik')!, f = p.querySelector<HTMLInputElement>('#e-effekte')!;
  m.oninput = f.oninput = () => { einst.musik = Number(m.value); einst.effekte = Number(f.value); klang.setzeLautstaerke(einst.musik, einst.effekte); einstSpeichern(); };
  p.querySelectorAll<HTMLButtonElement>('[data-grafik]').forEach((b) => { b.onclick = () => { einst.grafik = b.dataset.grafik as typeof einst.grafik; einstSpeichern(); grafikSetzen(); neu(); }; });
}
document.querySelectorAll<HTMLButtonElement>('[data-seite]').forEach((b) => { b.onclick = () => seite(b.getAttribute('aria-pressed') === 'true' ? null : b.dataset.seite!); });
function zeigeStart(): void {
  aufraeumen(); $('hud').hidden = true; $('ende').hidden = true; $('baum').hidden = true; $('bericht').hidden = true; $('start').hidden = false;
  $('version').textContent = VERSION;
  const s = geladen(); const w = $('weiter');
  if (s && s.phase !== 'verloren') { w.hidden = false; $('weiter-info').textContent = standInfo(s); w.onclick = () => starte(s.code, s, s.schwierigkeit); } else w.hidden = true;
  seite(null);
  baueMenueWelt();
}
$('zummenue').onclick = zeigeStart;
$('nochmal').onclick = () => { const c = $('weltcode').textContent || neuerWeltcode(); starte(c, undefined, spiel?.schwierigkeit); };
$('menue').onclick = () => (panelArt === 'einst' ? schliessePanel() : zeigeEinstellungen());
zeigeStart();
// für Tests und Neugierige in der Konsole
(window as unknown as { runeboom: unknown }).runeboom = { get spiel() { return spiel; }, get obj() { return obj; }, camera, controls, get menueZeit() { return menueZeit; }, set menueZeit(v: number) { menueZeit = v; }, menueStopp: false };

// ================= Bauleiste =================
let gruppeOffen: string | null = null;
const GRUPPE_KURZ: Record<string, string> = { dorf: 'Häuser, Höfe, Außenposten', rohstoffe: 'Sammeln und Verarbeiten', abwehr: 'Türme, Mauern, Fallen', wunder: 'Ein Bauwerk je Zeitalter' };
/** Warum lässt sich ein Typ gerade nicht bauen (ohne Ort)? */
function sperrGrund(typ: GebTyp): string {
  const s = spiel!, d = GEBAEUDE[typ];
  if (d.volk && d.volk !== s.volk) return 'Gehört zu einem anderen Volk.';
  if (d.braucht && !s.erfindungen.has(d.braucht)) return `Braucht die Erfindung ${ERFINDUNGEN[d.braucht].name}.`;
  if (d.abNacht && s.nacht < d.abNacht) return `Erst ab Nacht ${d.abNacht}.`;
  if (d.wunder && s.zeitalter() < d.wunder) return `Wunder des Zeitalters ${ZA_NAMEN[d.wunder]}.`;
  if (d.wunder) { const w = s.wunderGewaehlt(d.wunder); if (w && w.typ !== typ) return `Gewählt: ${GEBAEUDE[w.typ].name}.`; if (w) return 'Steht schon.'; }
  if (Spiel.zaehltAlsTurm(typ) && s.turmZahl() >= s.turmGrenze()) return `Turmgrenze ${s.turmGrenze()} erreicht.`;
  return '';
}
function baueLeiste(): void {
  const l = $('leiste'); l.innerHTML = '';
  const reihe = document.createElement('div'); reihe.className = 'gruppen';
  for (const gr of BAUGRUPPEN) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gruppe'; b.dataset.gruppe = gr.id;
    b.innerHTML = `<kbd>${gr.taste}</kbd><b>${gr.name}</b><span>${GRUPPE_KURZ[gr.id]}</span>`;
    b.onclick = () => gruppeZeigen(gruppeOffen === gr.id ? null : gr.id);
    reihe.appendChild(b);
  }
  reihe.insertAdjacentHTML('beforeend', '<div class="trenner"></div>');
  const sonder = (id: string, taste: string, name: string, info: string, tipp: string, fn: () => void) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gruppe sonder'; b.dataset.typ = id;
    b.innerHTML = `<kbd>${taste}</kbd><b>${name}</b><span>${info}</span>`; b.onclick = fn;
    b.onmouseenter = () => zeigeTipp(tipp); b.onmouseleave = () => { if (!werkzeug) zeigeTipp(null); };
    reihe.appendChild(b);
  };
  sonder('spaeher', 'X', 'Späher', '15 Holz', '<b>Späher</b> · Klick in den Nebel am Rand des Erkundeten deckt die Gegend auf.', () => werkzeugSetzen(werkzeug?.art === 'spaeher' ? null : { art: 'spaeher' }));
  sonder('ebnen', '9', 'Ebnen', `${EBNEN_STEIN} Stein je Stufe`, '<b>Gelände ebnen</b> · Ziehe eine Fläche auf. Sie bekommt die Höhe des ersten Blocks.', () => werkzeugSetzen(werkzeug?.art === 'ebnen' ? null : { art: 'ebnen' }));
  sonder('baum', 'T', 'Erfindungen', 'Erfindungsbaum', '<b>Erfindungsbaum</b> · Aus Bausteinen und Kristall entstehen Erfindungen.', () => ($('baum').hidden ? zeigeWerkstatt() : baumZu()));
  const auf = document.createElement('div'); auf.className = 'aufklapp tafel'; auf.id = 'aufklapp'; auf.hidden = true;
  l.append(auf, reihe);
}
function gruppeZeigen(id: string | null): void {
  gruppeOffen = id; const auf = $('aufklapp');
  if (!id || !spiel) { auf.hidden = true; leisteAktualisieren(); return; }
  const gr = BAUGRUPPEN.find((g) => g.id === id)!;
  auf.innerHTML = '';
  for (const typ of gr.typen) {
    const d = GEBAEUDE[typ]; if (d.volk && d.volk !== spiel.volk) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bau'; b.dataset.typ = typ;
    b.innerHTML = `${d.taste ? `<kbd>${d.taste}</kbd>` : ''}<b>${d.name}</b><span class="preis">${kostenHtml(d.kosten)}</span>`;
    b.onclick = () => { werkzeugSetzen(werkzeug?.art === 'bau' && werkzeug.typ === typ ? null : { art: 'bau', typ }); gruppeZeigen(null); };
    b.onmouseenter = () => { const g = sperrGrund(typ); zeigeTipp(`<b>${d.name}</b> · ${d.kurz}${g ? `<br><span class="grund">${g}</span>` : ''}`); };
    b.onmouseleave = () => { if (!werkzeug) zeigeTipp(null); };
    auf.appendChild(b);
  }
  auf.hidden = false; leisteAktualisieren();
}
function leisteAktualisieren(): void {
  if (!spiel) return;
  for (const b of $('leiste').querySelectorAll<HTMLButtonElement>('.bau')) {
    const typ = b.dataset.typ as GebTyp;
    b.setAttribute('aria-pressed', String(werkzeug?.art === 'bau' && werkzeug.typ === typ));
    b.classList.toggle('gesperrt', !!sperrGrund(typ));
    b.classList.toggle('teuer', !spiel.kannBezahlen(GEBAEUDE[typ].kosten));
  }
  for (const b of $('leiste').querySelectorAll<HTMLButtonElement>('.gruppe')) {
    const id = b.dataset.gruppe, t = b.dataset.typ;
    const an = id ? gruppeOffen === id || (werkzeug?.art === 'bau' && BAUGRUPPEN.find((g) => g.id === id)!.typen.includes(werkzeug.typ)) : t === 'baum' ? !$('baum').hidden : werkzeug?.art === t;
    b.setAttribute('aria-pressed', String(!!an));
    if (t === 'spaeher') b.classList.toggle('teuer', spiel.res.holz < 15);
  }
}
function werkzeugSetzen(w: typeof werkzeug): void {
  werkzeug = w;
  if (w?.art === 'bau' && spiel && !spiel.freigeschaltet(w.typ)) { melde(`${GEBAEUDE[w.typ].name} braucht erst die Erfindung ${ERFINDUNGEN[GEBAEUDE[w.typ].braucht!].name}.`, 'schlecht'); werkzeug = null; }
  if (!werkzeug || werkzeug.art !== 'bau') obj?.zeigeVorschau(null);
  if (werkzeug?.art !== 'ebnen') obj?.zeigeFlaeche(0, 0, 0, 0, 0, true, false);
  if (!werkzeug) zeigeTipp(null);
  if (werkzeug?.art === 'ebnen') zeigeTipp('<b>Ebnen</b> · Fläche aufziehen (bis 16 × 16). Esc oder Rechtsklick bricht ab.');
  if (werkzeug?.art === 'spaeher') zeigeTipp('<b>Späher</b> · Klick in den Nebel. Esc oder Rechtsklick bricht ab.');
  if (werkzeug?.art === 'feuerregen') zeigeTipp('<b>Feuerregen</b> · Klick auf die Stelle, die getroffen werden soll.');
  canvas.style.cursor = werkzeug ? 'crosshair' : '';
  leisteAktualisieren();
}
function zeigeTipp(html: string | null): void { const t = $('tipp'); if (!html) { t.hidden = true; return; } t.innerHTML = html; t.hidden = false; }

// ================= Auswahl und Werkstatt =================
function schliessePanel(): void { $('panel').hidden = true; $('panel').dataset.html = ''; panelArt = null; ruineGew = null; }
function waehle(g: Geb | null): void {
  gewaehlt = g; obj?.waehle(g); $('panel').dataset.html = '';
  if (!g) { if (panelArt === 'geb') schliessePanel(); return; }
  ruineGew = null;
  if (g.typ === 'werkstatt') { zeigeWerkstatt(); return; }
  panelArt = 'geb'; panelGeb();
}
function panelGeb(): void {
  const g = gewaehlt; if (!g || !spiel) return;
  const s = spiel, d = GEBAEUDE[g.typ], tag = s.phase === 'tag';
  const quellName: Partial<Record<Res, string>> = { holz: 'Bäume', stein: 'Felsen', kristall: 'Kristalladern', nahrung: 'Felder', erz: 'Erzadern' };
  const zeilen: [string, string][] = [];
  const z = (a: string, b: string) => zeilen.push([a, b]);
  const rk = s.reparaturKosten(g), kaputt = g.hp < g.max - 0.5;
  // kurze Werte in zwei Spalten
  if (Spiel.hatStufen(g.typ)) z('Stufe', `${STUFE_NAME[g.stufe]} von III`);
  if (g.typ === 'haupt') { z('Stufe', `${HAUPT_STUFEN[g.stufe - 1].name} (${g.stufe}/6)`); z('Türme', `${s.turmZahl()} / ${s.turmGrenze()}`); }
  const zweig = d.zweige?.find((x) => x.id === g.zweig); if (zweig) z('Zweig', zweig.name);
  const k = s.kampf(g); if (k) z('Reichweite · Schaden', `${Math.round(k.reichweite)} · ${Math.round(k.schaden)}${k.flaeche ? ' Fläche' : ''}${k.ziele && k.ziele > 1 ? ` · ${k.ziele} Ziele` : ''}`);
  if (d.licht > 4) z('Lichtkreis', `${d.licht + (zweig?.licht || 0)} Blöcke`);
  const soll = s.arbeiterZahl(g), zug = s.zugeteilt(g);
  if (soll) z('Arbeiter', `<span${zug < soll ? ' style="color:var(--rot)"' : ''}>${zug} / ${soll}</span>`);
  const arbW = s.arbeit(g); if (arbW) z(`${quellName[arbW.res] || 'Quellen'} · je Gang`, `${g.quellen} · ${Math.round(arbW.menge * 10) / 10} ${RES_NAME[arbW.res]}`);
  if (d.umwandeln) z('Verarbeitung', `${kostenHtml(d.umwandeln.von)} → ${d.umwandeln.menge} ${RES_NAME[d.umwandeln.nach]}`);
  if (g.typ === 'haus') z('Wohnraum', `${[0, 4, 7, 10][g.stufe] + (s.erfindungen.has('sternenkorn') ? 2 : 0) + (s.leitsatz('volk') ? 3 : 0)}`);
  const rkr = runenkraft(g.typ, g.stufe); if (rkr && Spiel.zaehltAlsTurm(g.typ)) z('Runenkraft', `${Math.ceil(rkr * s.kraftFaktor())} Kristall${s.phase === 'nacht' && !g.kraft ? ' · <b style="color:var(--rot)">fehlt</b>' : ''}`);
  if (g.brand > 0) z('<span style="color:var(--rot)">Brennt</span>', `${Math.ceil(g.brand)} s`);
  if (g.typ === 'haupt' && s.faehigkeiten().length) z('Fähigkeiten', s.faehigkeiten().map((n) => FAEHIGKEIT_NAME[n]).join(', '));
  // laufende Arbeit
  const fort = (t: number, dauer: number, farbe: string, text: string) => `<div class="zeile"><span>${text}</span><span>${Math.round((100 * t) / dauer)} %</span></div><div class="hp"><div style="width:${Math.round((100 * t) / dauer)}%;background:${farbe}"></div></div>`;
  let werk = '';
  if (g.umbau) werk = fort(g.umbau.t, g.umbau.dauer, 'var(--ember)', g.umbau.nach === 'haupt' ? `Ausbau zur ${HAUPT_STUFEN[(g.umbau.stufe || 2) - 1].name}` : d.bauzeit && g.umbau.nach === g.typ && !g.umbau.stufe ? `Bau (nur am Tag)` : g.umbau.stufe ? `Ausbau auf Stufe ${STUFE_NAME[g.umbau.stufe]}` : `Umbau zu ${GEBAEUDE[g.umbau.nach].name}`);
  else if (g.rep) werk = fort(g.rep.t, g.rep.dauer, 'var(--frost)', 'Reparatur');
  // Aktionen als knappe Knöpfe: Titel, Kosten oder Grund
  const akt: string[] = [];
  const knopf = (tat: string, titel: string, kosten: string, grund: string, tipp: string, extra = '') => akt.push(`<button type="button" class="akt" data-tat="${tat}" ${extra} title="${tipp.replace(/"/g, '&quot;')}" ${grund ? 'disabled' : ''}><b>${titel}</b><small${grund ? ' class="grund"' : ''}>${grund || kosten}</small></button>`);
  if (!g.umbau && !g.rep && kaputt) knopf('reparieren', 'Reparieren', kostenHtml(rk), !tag ? 'nur am Tag' : s.fehlt(rk), 'Arbeiter bessern das Gebäude aus.');
  const o = s.stufeOption(g);
  if (o && !g.umbau) knopf('stufe', `Stufe ${STUFE_NAME[o.stufe]}`, kostenHtml(o.kosten), o.grund || '', d.arbeit || d.umwandeln ? 'Mehr Arbeiter, mehr Ertrag, größerer Umkreis.' : g.typ === 'haus' ? 'Mehr Wohnraum.' : 'Mehr Schaden, Haltbarkeit und Reichweite.');
  if (g.typ === 'haupt' && !g.umbau) { const st = s.hauptAusbau(); if (st) { const frei = !st.braucht || s.erfindungen.has(st.braucht); knopf('ausbau', `Zur ${st.name}`, kostenHtml(st.kosten), !frei ? `braucht ${ERFINDUNGEN[st.braucht!].name}` : !tag ? 'nur am Tag' : s.fehlt(st.kosten), `${st.kurz} Haltbarkeit ${st.hp}, bis zu ${st.tuerme} Türme, Wohnraum ${st.wohnraum}.`); } }
  if (!g.umbau) for (const nach of s.umruestOptionen(g)) {
    const nd = GEBAEUDE[nach], frei = s.freigeschaltet(nach);
    const grund = !frei ? `braucht ${ERFINDUNGEN[nd.braucht!].name}` : nd.zeitalter === 5 && g.stufe < 3 ? 'erst Stufe III' : !tag ? 'nur am Tag' : s.fehlt(nd.kosten);
    if (nd.zweige) for (const zw of nd.zweige) knopf('umr', `${nd.name}: ${zw.name}`, kostenHtml(nd.kosten), grund, `${nd.kurz} ${zw.kurz}`, `data-nach="${nach}" data-zweig="${zw.id}"`);
    else knopf('umr', nd.name, kostenHtml(nd.kosten), grund, nd.kurz, `data-nach="${nach}"`);
  }
  if (!g.umbau) s.verschmelzOptionen(g).forEach((v, i) => { const nd = GEBAEUDE[v.ergebnis]; knopf('vs', `+ ${GEBAEUDE[v.partner.typ].name} → ${s.entdeckt.has(v.ergebnis) ? nd.name : '???'}`, kostenHtml(nd.kosten), !tag ? 'nur am Tag' : s.fehlt(nd.kosten), 'Verschmelzen: Zwei benachbarte Türme werden zu einem neuen.', `data-i="${i}"`); });
  if (g.typ !== 'haupt' && g.typ !== 'werkstatt') knopf('abreissen', 'Abreißen', 'halbe Kosten zurück', '', 'Gebäude abreißen.');
  const html = `<button class="schliessen" type="button" aria-label="Schließen">×</button><h2>${d.name}</h2><p class="kurz">${d.kurz}</p>
    <div class="zeile"><span>Haltbarkeit</span><span>${Math.ceil(g.hp)} / ${g.max}</span></div><div class="hp"><div style="width:${(100 * g.hp) / g.max}%"></div></div>
    <div class="werte">${zeilen.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>${werk}
    ${akt.length ? `<div class="aktionen">${akt.join('')}</div>` : ''}`;
  if (!panelSetzen(html)) return;
  const p = $('panel');
  p.querySelector<HTMLButtonElement>('.schliessen')!.onclick = () => waehle(null);
  p.querySelectorAll<HTMLButtonElement>('[data-tat]').forEach((b) => {
    b.onclick = () => {
      const t = b.dataset.tat;
      if (t === 'abreissen') { s.abreissen(g); waehle(null); return; }
      if (t === 'reparieren' && s.reparieren(g)) klang.spiele('bau', 0.8);
      if (t === 'umr' && s.umruesten(g, b.dataset.nach as GebTyp, b.dataset.zweig)) klang.spiele('bau', 0.8);
      if (t === 'vs') { const v = s.verschmelzOptionen(g)[Number(b.dataset.i)]; if (v && s.verschmelzen(g, v.partner)) { klang.spiele('bau', 0.8); if (!s.gebaeude.includes(g)) { const zz = s.gebaeude.find((x) => x.umbau?.nach === v.ergebnis); waehle(zz || null); return; } } }
      if (t === 'ausbau' && s.hauptAusbauen()) klang.spiele('bau', 0.8);
      if (t === 'stufe' && s.stufeAusbauen(g)) klang.spiele('bau', 0.8);
      panelGeb();
    };
  });
}
function panelRuine(): void {
  const r = ruineGew; if (!r || !spiel) return;
  if (!spiel.ruinen.includes(r)) { schliessePanel(); return; }
  const s = spiel, d = GEBAEUDE[r.typ], k = s.wiederaufbauKosten(r), tag = s.phase === 'tag';
  const zw = d.zweige?.find((z) => z.id === r.zweig);
  const html = `<button class="schliessen" type="button" aria-label="Schließen">×</button><h2>Trümmer: ${d.name}</h2>
    <p>Hier stand ${d.name}${zw ? ` (${zw.name})` : ''}. Wiederaufbau kostet die Hälfte, Räumen macht den Platz frei.</p>
    <button type="button" class="aktion" data-tat="auf" ${tag && s.kannBezahlen(k) ? '' : 'disabled'}>Wiederaufbauen · ${kostenHtml(k)}${!tag ? ' (nur am Tag)' : ''}</button>
    <button type="button" class="aktion" data-tat="raeumen">Räumen</button>`;
  if (!panelSetzen(html)) return;
  const p = $('panel');
  p.querySelector<HTMLButtonElement>('.schliessen')!.onclick = schliessePanel;
  p.querySelectorAll<HTMLButtonElement>('[data-tat]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.tat === 'auf') { if (s.wiederaufbauen(r)) { klang.spiele('bau'); schliessePanel(); } }
      else { s.raeumen(r); schliessePanel(); }
    };
  });
}
// ================= Erfindungsbaum =================
let baumReiter: 'baum' | 'buch' | 'beute' = 'baum', baumWahl: ErfId | null = null, baumZa = 0;
const ZA_NAMEN = ['', 'Holz & Runen', 'Glut & Alchemie', 'Uhrwerk & Dampf', 'Blitz & Kristall', 'Äther & Sterne'];
function baumZu(): void { $('baum').hidden = true; $('baum-detail').hidden = true; obj?.waehle(null); if (panelArt === 'werkstatt') panelArt = null; }
function zeigeWerkstatt(): void {
  if (!spiel) return;
  schliessePanel(); panelArt = 'werkstatt'; $('baum').hidden = false;
  baumZeichnen(true);
}
function erfStatus(id: ErfId): 'fertig' | 'kann' | 'fehlt' | 'zu' | 'geheim' {
  const s = spiel!, e = ERFINDUNGEN[id];
  if (s.erfindungen.has(id)) return 'fertig';
  const hat = Object.entries(e.zutaten).every(([b, n]) => s.bausteine[b as Baustein] >= (n as number));
  if (e.geheim && !hat) return 'geheim';
  if (s.vorwissenFehlt(id)) return 'zu';
  return hat && s.res.kristall >= s.erfKristall(id) ? 'kann' : 'fehlt';
}
let baumHtmlAlt = '';
function baumZeichnen(neu = false): void {
  const s = spiel; if (!s || $('baum').hidden) return;
  $('baum-za').textContent = `Zeitalter ${s.zeitalter()} · ${s.zeitalterName()} · ${s.erfindungen.size} von ${Object.keys(ERFINDUNGEN).length} erfunden`;
  $('baum-bst').innerHTML = (Object.keys(BAUSTEIN_NAME) as Baustein[]).map((b) => `<span><i class="${b}"></i>${BAUSTEIN_NAME[b]} ${s.bausteine[b]}</span>`).join('') + `<span><i class="kristall"></i>Kristall ${Math.floor(s.res.kristall)}</span>`;
  document.querySelectorAll<HTMLButtonElement>('[data-reiter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.reiter === baumReiter)));
  let html = '';
  if (baumReiter === 'baum') {
    const z = s.zeitalter(); if (!baumZa) baumZa = z;
    const aus = (a: number) => (a !== baumZa ? ' z-aus' : '');
    $('baum-za-reiter').innerHTML = [1, 2, 3, 4, 5].map((a) => `<button type="button" data-za="${a}" aria-pressed="${a === baumZa}">${a}</button>`).join('');
    $('baum-za-reiter').querySelectorAll<HTMLButtonElement>('[data-za]').forEach((b) => { b.onclick = () => { baumZa = Number(b.dataset.za); baumZeichnen(true); }; });
    html = `<div class="baum-gitter"><div></div>${[1, 2, 3, 4, 5].map((a) => `<div class="zkopf${aus(a)} ${a === z ? 'jetzt' : a > z ? 'zu' : ''}">${ZA_NAMEN[a]}<small>${a < z ? 'erreicht' : a === z ? 'jetziges Zeitalter' : 'noch verschlossen'}</small></div>`).join('')}`;
    for (const w of Object.keys(WISSEN_NAME) as Wissen[]) {
      html += `<div class="wkopf">${WISSEN_NAME[w]}</div>`;
      for (const a of [1, 2, 3, 4, 5]) {
        const ids = (Object.keys(ERFINDUNGEN) as ErfId[]).filter((i) => ERFINDUNGEN[i].wissen === w && ERFINDUNGEN[i].ab === a);
        html += `<div class="zelle${aus(a)}">${ids.map((id) => {
          const e = ERFINDUNGEN[id], st = erfStatus(id);
          if (st === 'geheim') return `<button type="button" class="ekarte geheim" data-erf="${id}" aria-pressed="${baumWahl === id}"><b>???</b><span>geheimes Rezept</span></button>`;
          const zut = Object.entries(e.zutaten).map(([b, n]) => `<span class="${st !== 'fertig' && s.bausteine[b as Baustein] < (n as number) ? 'fehlt' : ''}"><i class="${b}"></i>${n}</span>`).join('') + `<span class="${st !== 'fertig' && s.res.kristall < s.erfKristall(id) ? 'fehlt' : ''}"><i class="kristall"></i>${s.erfKristall(id)}</span>`;
          return `<button type="button" class="ekarte ${st} ${e.zeitalter ? 'schluessel' : ''}" data-erf="${id}" aria-pressed="${baumWahl === id}"><b>${e.zeitalter ? '◆ ' : ''}${e.name}${st === 'fertig' ? ' ✓' : ''}</b><span class="zut">${zut}</span></button>`;
        }).join('')}</div>`;
      }
    }
    html += '</div>';
  } else if (baumReiter === 'buch') {
    const LN = { fern: 'Fernkampf', flaeche: 'Fläche', licht: 'Licht' };
    html = `<div class="baum-liste"><p>Zwei benachbarte Türme lassen sich am Tag verschmelzen. Was einmal gelungen ist, bleibt hier vermerkt.</p>${VERSCHMELZUNGEN.map((v) => { const bek = s.entdeckt.has(v.ergebnis); return `<div class="zeile"><span>${LN[v.a]} + ${LN[v.b]}</span><span>${bek ? `<b>${GEBAEUDE[v.ergebnis].name}</b> · ${GEBAEUDE[v.ergebnis].kurz}` : '???'}</span></div>`; }).join('')}</div>`;
  } else {
    html = `<div class="baum-liste"><p>Bausteine gibt es nur als Beute besiegter Wesen. Verborgene Schattenwölfe brauchen Licht, Drachlinge treffen nur Pfeile und Blitze.</p>${(Object.keys(BAUSTEIN_NAME) as Baustein[]).map((bs) => `<div class="zeile"><span><i class="${bs}" style="width:8px;height:8px;display:inline-block;transform:rotate(45deg);border-radius:2px;margin-right:6px"></i>${BAUSTEIN_NAME[bs]}</span><span>${(Object.keys(GEGNER) as (keyof typeof GEGNER)[]).filter((t) => GEGNER[t].beute.some(([x]) => x === bs)).map((t) => { const bt = GEGNER[t].beute.find(([x]) => x === bs)!; return `${GEGNER[t].name} ${Math.round(100 * bt[1])} %${bt[2] ? ` (×${bt[2]})` : ''}`; }).join(' · ')}</span></div>`).join('')}
      <p>Die Wesen der Wildnis:</p>${(Object.keys(GEGNER) as (keyof typeof GEGNER)[]).map((t) => `<div class="zeile"><span>${GEGNER[t].name}</span><span>${GEGNER[t].kurz}</span></div>`).join('')}</div>`;
  }
  if (neu || html !== baumHtmlAlt) {
    baumHtmlAlt = html; $('baum-inhalt').innerHTML = html;
    $('baum-inhalt').querySelectorAll<HTMLButtonElement>('[data-erf]').forEach((b) => { b.onclick = () => { baumWahl = b.dataset.erf as ErfId; baumZeichnen(); }; });
  }
  // Einzelheiten der gewählten Erfindung
  const d = $('baum-detail');
  if (!baumWahl || baumReiter !== 'baum') { d.hidden = true; return; }
  const e = ERFINDUNGEN[baumWahl], st = erfStatus(baumWahl);
  const grund = st === 'fertig' ? '' : st === 'geheim' ? 'Ein geheimes Rezept. Es zeigt sich, sobald die richtigen Bausteine beisammen sind.' : s.vorwissenFehlt(baumWahl) || (st === 'fehlt' ? 'Es fehlen noch Bausteine oder Kristall.' : '');
  const dhtml = `<h3>${st === 'geheim' ? '???' : e.name}</h3><div class="baum-za">${WISSEN_NAME[e.wissen]} · ${ZA_NAMEN[e.ab]}${e.zeitalter ? ` · Schlüssel zu ${ZA_NAMEN[e.zeitalter]}` : ''}</div>${st === 'geheim' ? '' : `<p>${e.wirkung}</p>`}${grund ? `<p class="grund">${grund}</p>` : ''}${st === 'fertig' ? '<p>Erfunden.</p>' : st === 'geheim' ? '' : `<button type="button" class="aktion" id="erfinden" ${st === 'kann' ? '' : 'disabled'}>Erfinden</button>`}`;
  if (d.dataset.html !== dhtml || d.hidden) {
    d.dataset.html = dhtml; d.innerHTML = dhtml; d.hidden = false;
    const k = document.getElementById('erfinden'); if (k) k.onclick = () => { if (s.erfinden(baumWahl!)) { klang.spiele('glocke', 0.8); baumZeichnen(true); leisteAktualisieren(); } };
  }
}
document.querySelectorAll<HTMLButtonElement>('[data-reiter]').forEach((b) => { b.onclick = () => { baumReiter = b.dataset.reiter as typeof baumReiter; baumZeichnen(true); }; });
$('baum-zu').onclick = baumZu;

// ================= Meldungen =================
function melde(text: string, ton: 'gut' | 'schlecht' | 'info' = 'info'): void {
  const box = $('meldungen');
  // gleiche Meldung kurz hintereinander: nur zählen statt doppelt zeigen
  const alt = [...box.children].find((c) => (c as HTMLElement).dataset.text === text && !c.classList.contains('aus')) as HTMLElement | undefined;
  if (alt) { const n = Number(alt.dataset.n || 1) + 1; alt.dataset.n = String(n); alt.textContent = `${text} (×${n})`; return; }
  const m = document.createElement('div'); m.dataset.text = text;
  m.className = `meldung tafel ${ton}`; m.textContent = text; box.prepend(m);
  while (box.children.length > 4) box.lastElementChild!.remove();
  setTimeout(() => m.classList.add('aus'), 4800); setTimeout(() => m.remove(), 5500);
}

// ================= Tempo =================
function setzeTempo(t: number): void { tempo = t; document.querySelectorAll<HTMLButtonElement>('[data-tempo]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.tempo) === t))); }
document.querySelectorAll<HTMLButtonElement>('[data-tempo]').forEach((b) => { b.onclick = () => setzeTempo(Number(b.dataset.tempo)); });

// ================= Zeiger: Boden treffen, bauen, wählen, Späher =================
const ray = new THREE.Raycaster();
function bodenPunkt(cx: number, cy: number): THREE.Vector3 | null {
  ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  const o = ray.ray.origin, d = ray.ray.direction; if (d.y >= -0.01) return null;
  let t = Math.max(0, (o.y - 40) / -d.y); const p = new THREE.Vector3();
  for (let i = 0; i < 3000; i++, t += 0.5) {
    p.copy(o).addScaledVector(d, t);
    if (Math.abs(p.x) > WR || Math.abs(p.z) > WR) { if (p.y < 0) return null; continue; }
    const h = hoehe(p.x, p.z); if (p.y <= h) return p;
    if (p.y < -30) return null;
  }
  return null;
}
function ecke(typ: GebTyp, p: THREE.Vector3): [number, number] { const d = GEBAEUDE[typ]; return [Math.round(p.x - d.w / 2), Math.round(p.z - d.d / 2)]; }
function linie(a: [number, number], b: [number, number]): [number, number][] {
  const dx = b[0] - a[0], dz = b[1] - a[1], n = Math.max(Math.abs(dx), Math.abs(dz)), out: [number, number][] = [];
  for (let i = 0; i <= n; i++) out.push([Math.round(a[0] + (dx * i) / (n || 1)), Math.round(a[1] + (dz * i) / (n || 1))]);
  return out;
}
let unten: { x: number; y: number; t: number; mauer?: [number, number]; ebene?: [number, number] } | null = null;
let mauerZiel: [number, number] | null = null;
let rechts: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => { if (e.button === 2) rechts = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); if (werkzeug && rechts && Math.hypot(e.clientX - rechts.x, e.clientY - rechts.y) < 6) werkzeugSetzen(null); });
canvas.addEventListener('pointerdown', (e) => {
  unten = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (e.button === 0 && werkzeug?.art === 'bau' && GEBAEUDE[werkzeug.typ].w === 1) {
    const p = bodenPunkt(e.clientX, e.clientY); if (p) { unten.mauer = [Math.floor(p.x), Math.floor(p.z)]; controls.enabled = false; }
  }
  if (e.button === 0 && werkzeug?.art === 'ebnen') { const p = bodenPunkt(e.clientX, e.clientY); if (p) { unten.ebene = [Math.floor(p.x), Math.floor(p.z)]; mauerZiel = unten.ebene; controls.enabled = false; } }
});
canvas.addEventListener('pointermove', (e) => {
  if (spiel && werkzeug?.art === 'ebnen') {
    const p = bodenPunkt(e.clientX, e.clientY); if (!p) return;
    const a: [number, number] = unten?.ebene || [Math.floor(p.x), Math.floor(p.z)], b: [number, number] = [Math.floor(p.x), Math.floor(p.z)];
    if (unten?.ebene) mauerZiel = b;
    const pr = spiel.ebnenPruefen(a[0], a[1], b[0], b[1]);
    obj?.zeigeFlaeche(a[0], a[1], b[0], b[1], pr.ziel + 1, pr.ok);
    zeigeTipp(`<b>Ebnen</b> · ${Math.abs(b[0] - a[0]) + 1} × ${Math.abs(b[1] - a[1]) + 1} Blöcke auf Höhe ${pr.ziel}${pr.stein ? ` · ${pr.stein} Stein` : ''}${!pr.ok ? `<br><span class="grund">${pr.grund}</span>` : ''}`);
    return;
  }
  if (!spiel || !werkzeug || werkzeug.art !== 'bau') return;
  const p = bodenPunkt(e.clientX, e.clientY); if (!p) { obj?.zeigeVorschau(null); return; }
  const typ = werkzeug.typ, [x0, z0] = GEBAEUDE[typ].w === 1 ? [Math.floor(p.x), Math.floor(p.z)] : ecke(typ, p);
  const pr = spiel.pruefe(typ, x0, z0), bezahlbar = spiel.kannBezahlen(GEBAEUDE[typ].kosten);
  obj?.zeigeVorschau(typ, x0, z0, pr.ok && bezahlbar, pr.ok ? pr.y : hoehe(x0 + 0.5, z0 + 0.5));
  if (unten?.mauer) { mauerZiel = [x0, z0]; const n = linie(unten.mauer, mauerZiel).length; zeigeTipp(`<b>${GEBAEUDE[typ].name}</b> · ${n} Blöcke · ${kostenHtml(Object.fromEntries(Object.entries(GEBAEUDE[typ].kosten).map(([k, v]) => [k, (v as number) * n])))}`); }
  else zeigeTipp(`<b>${GEBAEUDE[typ].name}</b> · ${kostenHtml(GEBAEUDE[typ].kosten)}${!pr.ok ? `<br><span class="grund">${pr.grund}</span>` : !bezahlbar ? '<br><span class="grund">Nicht genug Rohstoffe.</span>' : ''}`);
});
canvas.addEventListener('pointerup', (e) => {
  const u = unten; unten = null; controls.enabled = true;
  if (!u || !spiel || e.button !== 0) return;
  if (u.ebene && mauerZiel) { if (spiel.ebnen(u.ebene[0], u.ebene[1], mauerZiel[0], mauerZiel[1])) klang.spiele('hieb_stein'); mauerZiel = null; return; }
  if (u.mauer && mauerZiel) {
    const typ = werkzeug?.art === 'bau' ? werkzeug.typ : 'mauer';
    let n = 0; for (const [x, z] of linie(u.mauer, mauerZiel)) if (spiel.bauen(typ, x, z, true)) n++;
    if (!n) melde(`Hier lässt sich ${GEBAEUDE[typ].name} nicht bauen.`, 'schlecht'); else if (!e.shiftKey) werkzeugSetzen(null);
    mauerZiel = null; return;
  }
  if (Math.hypot(e.clientX - u.x, e.clientY - u.y) > 6 || performance.now() - u.t > 600) return;
  const p = bodenPunkt(e.clientX, e.clientY); if (!p) return;
  if (werkzeug?.art === 'bau') { const [x0, z0] = GEBAEUDE[werkzeug.typ].w === 1 ? [Math.floor(p.x), Math.floor(p.z)] : ecke(werkzeug.typ, p); if (spiel.bauen(werkzeug.typ, x0, z0) && !e.shiftKey) werkzeugSetzen(null); return; }
  if (werkzeug?.art === 'spaeher') { if (spiel.erkundetAn(p.x, p.z)) melde('Hier ist schon erkundet. Klick in den Nebel.', 'info'); else if (spiel.spaeher(p.x, p.z)) { spaeherGeschickt = true; werkzeugSetzen(null); } return; }
  if (werkzeug?.art === 'feuerregen') { if (spiel.faehigkeit('feuerregen', p.x, p.z)) klang.spiele('horn', 0.6); werkzeugSetzen(null); return; }
  const g = spiel.gebAn(p.x, p.z);
  if (!g) { const ru = spiel.ruineAn(p.x, p.z); if (ru) { waehle(null); ruineGew = ru; panelArt = 'ruine'; $('panel').dataset.html = ''; panelRuine(); return; } }
  waehle(g || null);
});

// ================= Tastatur =================
const tasten = new Set<string>();
addEventListener('keydown', (e) => {
  if (!spiel || imMenue || (e.target as HTMLElement).tagName === 'INPUT') return;
  const k = e.key.toLowerCase(); tasten.add(k);
  const typ = BAULEISTE.find((t) => GEBAEUDE[t].taste?.toLowerCase() === k);
  if (typ) werkzeugSetzen(werkzeug?.art === 'bau' && werkzeug.typ === typ ? null : { art: 'bau', typ });
  if (k === 'escape') { gruppeZeigen(null); werkzeugSetzen(null); waehle(null); schliessePanel(); baumZu(); $('bericht').hidden = true; }
  if (k === '9') werkzeugSetzen(werkzeug?.art === 'ebnen' ? null : { art: 'ebnen' });
  const gr = BAUGRUPPEN.find((g) => g.taste.toLowerCase() === k); if (gr) gruppeZeigen(gruppeOffen === gr.id ? null : gr.id);
  if (k === 'x') werkzeugSetzen(werkzeug?.art === 'spaeher' ? null : { art: 'spaeher' });
  if (k === 't') $('baum').hidden ? zeigeWerkstatt() : baumZu();
  if (k === 'n') spiel.nachtEinlaeuten();
  if (k === ' ') { e.preventDefault(); setzeTempo(tempo === 0 ? 1 : 0); }
  if (k === 'delete' && gewaehlt) { spiel.abreissen(gewaehlt); waehle(null); }
});
addEventListener('keyup', (e) => tasten.delete(e.key.toLowerCase()));
addEventListener('blur', () => tasten.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) speichern(); });
function tastenBewegung(dt: number): void {
  const vor = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize(), rechts = new THREE.Vector3(-vor.z, 0, vor.x);
  const v = new THREE.Vector3(), sp = camera.position.distanceTo(controls.target) * 0.9 * dt;
  if (tasten.has('w') || tasten.has('arrowup')) v.add(vor); if (tasten.has('s') || tasten.has('arrowdown')) v.sub(vor);
  if (tasten.has('d') || tasten.has('arrowright')) v.add(rechts); if (tasten.has('a') || tasten.has('arrowleft')) v.sub(rechts);
  if (v.lengthSq()) { v.normalize().multiplyScalar(sp); controls.target.add(v); camera.position.add(v); }
  const dreh = (tasten.has('q') ? 1 : 0) - (tasten.has('e') ? 1 : 0);
  if (dreh) { const off = camera.position.clone().sub(controls.target); off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dreh * dt * 1.4); camera.position.copy(controls.target).add(off); }
}

// ================= Übersichtskarte =================
const mk = $<HTMLCanvasElement>('minikarte'), mx = mk.getContext('2d')!;
const kartenGrund = document.createElement('canvas'); kartenGrund.width = kartenGrund.height = 256;
function zeichneKartenGrund(): void { welt?.kartenBild(kartenGrund.getContext('2d')!); }
const ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), -7), hit = new THREE.Vector3();
function zeichneKarte(): void {
  if (!spiel) return;
  const s = 256 / (2 * WR); mx.drawImage(kartenGrund, 0, 0);
  for (const g of spiel.gebaeude) { mx.fillStyle = g.typ === 'haupt' ? '#ffe2a0' : '#ebe3d2'; mx.fillRect((g.x + WR) * s - 0.5, (g.z + WR) * s - 0.5, Math.max(1.5, g.w * s), Math.max(1.5, g.d * s)); }
  mx.fillStyle = '#ff5a4a'; for (const e of spiel.gegner) if (spiel.erkundetAn(e.x, e.z)) mx.fillRect((e.x + WR) * s - 1, (e.z + WR) * s - 1, 2, 2);
  mx.strokeStyle = '#ffffff'; mx.lineWidth = 1.2; mx.beginPath();
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], i) => {
    ray.setFromCamera(new THREE.Vector2(a, b), camera); if (!ray.ray.intersectPlane(ebene, hit) || hit.distanceTo(controls.target) > 1500) hit.copy(controls.target);
    const px = (hit.x + WR) * s, pz = (hit.z + WR) * s; if (i) mx.lineTo(px, pz); else mx.moveTo(px, pz);
  });
  mx.closePath(); mx.stroke();
}
$('karte').addEventListener('click', (e) => {
  const r = mk.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 2 * WR - WR, z = ((e.clientY - r.top) / r.height) * 2 * WR - WR;
  const d = new THREE.Vector3(x - controls.target.x, 0, z - controls.target.z); controls.target.add(d); camera.position.add(d);
});

// ================= Anzeige oben =================
function anzeige(): void {
  if (!spiel) return;
  const s = spiel;
  $('res').innerHTML = (['holz', 'stein', 'kristall', 'nahrung', 'erz', 'balken', 'stahl', 'linsen'] as Res[]).filter((r) => ['holz', 'stein', 'kristall', 'nahrung'].includes(r) || s.res[r] > 0).map((r) => `<span title="${RES_NAME[r]}"><i class="${r}"></i>${Math.floor(s.res[r])}</span>`).join('');
  const bed = s.arbeiterBedarf(), arb = s.arbeiter.length, essen = s.essen(), rk = s.runenkraftBedarf();
  $('bewohner').innerHTML = `<span>Einwohner <b>${s.einwohner}</b> / ${s.wohnraum()}</span><span${arb < bed ? ' class="warn"' : ''}>Arbeiter <b>${arb}</b> / ${bed}</span><span${s.res.nahrung < essen ? ' class="warn"' : ''}>Essen je Tag <b>${essen}</b></span><span>Türme <b>${s.turmZahl()}</b> / ${s.turmGrenze()}</span><span${s.res.kristall < rk ? ' class="warn"' : ''}>Runenkraft <b>${rk}</b></span>`;
  $('bausteine').innerHTML = (Object.keys(BAUSTEIN_NAME) as Baustein[]).map((b) => `<span class="${s.bausteine[b] ? '' : 'null'}" title="${BAUSTEIN_NAME[b]}"><i class="${b}"></i>${BAUSTEIN_NAME[b]} ${s.bausteine[b]}</span>`).join('');
  const u = $('uhr');
  u.classList.toggle('nacht', s.phase === 'nacht');
  $('zeitalter').textContent = s.zeitalterName();
  if (s.phase === 'tag') {
    u.dataset.html = '';
    const rest = Math.ceil(s.restTag()), mm = Math.floor(rest / 60), ss = String(rest % 60).padStart(2, '0');
    const vorschau = s.welleVorschau().map((w) => `${w.zahl} ${w.zahl === 1 ? GEGNER[w.typ].name : MEHRZAHL[w.typ]}`).join(' · ');
    const om = s.omenFuer(s.nacht), akt = s.akt();
    const siegelInfo = akt.nr === 4 ? ` · Risse versiegelt ${s.versiegelt.size} / ${s.alleRisse().length}` : '';
    u.innerHTML = `<div class="akt-zeile">Akt ${akt.nr} · ${akt.name} · Nacht ${s.nacht} von ${ENDE_NACHT}${siegelInfo}</div>${om ? `<div class="omen">Omen heute Nacht: <b>${OMEN[om].name}</b> · ${OMEN[om].kurz}</div>` : ''}<div class="titel">Tag ${s.nacht}</div><div class="balken"><div style="width:${(100 * s.zeit) / TAG_DAUER}%"></div></div>
      <div class="unter">${s.abend() ? `Heute Nacht: ${vorschau}` : `Ruhig. Nacht in ${mm}:${ss}`}</div><div><button type="button" id="einlaeuten">Nacht einläuten</button>${s.beschaedigt().length ? ` <button type="button" id="allerep" ${s.kannBezahlen(s.alleReparaturKosten()) ? '' : 'disabled'}>Alles reparieren · ${kostenHtml(s.alleReparaturKosten())}</button>` : ''}</div>`;
    $('einlaeuten').onclick = () => s.nachtEinlaeuten();
    const ar = document.getElementById('allerep'); if (ar) ar.onclick = () => { if (s.alleReparieren()) klang.spiele('bau', 0.8); };
  } else if (s.phase === 'nacht') {
    const f = s.faehigkeiten();
    const om = s.omenFuer(s.nacht);
    const html = `<div class="akt-zeile">Akt ${s.akt().nr} · ${s.akt().name}</div>${om ? `<div class="omen"><b>${OMEN[om].name}</b></div>` : ''}<div class="titel">Nacht ${s.nacht}</div><div class="unter">Die Welle kommt · ${s.gegner.length} Wesen unterwegs</div>${f.length ? `<div class="faehig">${f.map((n) => `<button type="button" data-faehig="${n}" ${s.faehigkeitFrei(n) ? '' : 'disabled'}>${FAEHIGKEIT_NAME[n]}</button>`).join(' ')}</div>` : ''}`;
    if (u.dataset.html !== html) {
      u.dataset.html = html; u.innerHTML = html;
      u.querySelectorAll<HTMLButtonElement>('[data-faehig]').forEach((b) => { b.onclick = () => { const n = b.dataset.faehig!; if (n === 'feuerregen') werkzeugSetzen({ art: 'feuerregen' }); else if (s.faehigkeit(n)) klang.spiele('glocke', 0.8); }; });
    }
  } else if (s.phase === 'morgen') u.dataset.html = '', u.innerHTML = `<div class="titel">Morgen</div><div class="unter">Die Nacht ist überstanden</div>`;
  leisteAktualisieren(); einfuehrung();
  document.body.classList.toggle('panel-offen', !$('panel').hidden);
  if (s.leitsatzOffen && $('leitsatz').hidden && s.phase === 'tag' && !document.getElementById('leit-hinweis')) $('meldungen').insertAdjacentHTML('afterbegin', '<button type="button" class="meldung tafel info" id="leit-hinweis">Ein Leitsatz wartet auf deine Wahl. Hier klicken.</button>');
  const lh = document.getElementById('leit-hinweis'); if (lh) { if (!s.leitsatzOffen) lh.remove(); else lh.onclick = () => { lh.remove(); zeigeLeitsatz(); }; }
  if (panelArt === 'geb' && gewaehlt) { if (!s.gebaeude.includes(gewaehlt)) waehle(null); else panelGeb(); }
  if (panelArt === 'ruine') panelRuine();
  baumZeichnen();
  if (werkzeug?.art === 'feuerregen' && s.phase !== 'nacht') werkzeugSetzen(null);
}

// ================= Einführung =================
const SCHRITTE: { text: string; fertig: (s: Spiel) => boolean }[] = [
  { text: 'Stelle einen zweiten <b>Wachturm</b> an den Pfad (Taste 1). Der Pfad zeigt, woher die Wesen kommen.', fertig: (s) => s.gebaeude.filter((g) => g.typ === 'wachturm').length >= 2 },
  { text: 'Mach Licht vor dem Tor: ein <b>Fackelmast</b> (Taste 3). Im Licht treffen Türme nachts weiter und besser.', fertig: (s) => s.gebaeude.some((g) => g.typ === 'fackel') },
  { text: 'Schicke einen <b>Späher</b> in den Nebel (Taste X) und klicke an den Rand des Erkundeten.', fertig: () => spaeherGeschickt },
  { text: 'Bereit? <b>Nacht einläuten</b> (Taste N). Die leuchtende Linie zeigt den Weg der Welle.', fertig: (s) => s.phase !== 'tag' || s.nacht > 1 },
  { text: 'Gut gehalten! Wähle ein beschädigtes Gebäude: Arbeiter <b>reparieren</b> es am Tag gegen Rohstoffe. Aus Beute entstehen in der <b>Werkstatt</b> (Taste T) Erfindungen.', fertig: (s) => s.nacht > 2 }
];
function einfuehrung(): void {
  const el = $('einfuehrung'); if (!spiel || einfuehrungSchritt < 0) { el.hidden = true; return; }
  while (einfuehrungSchritt < SCHRITTE.length && SCHRITTE[einfuehrungSchritt].fertig(spiel)) einfuehrungSchritt++;
  if (einfuehrungSchritt >= SCHRITTE.length) { einfuehrungSchritt = -1; el.hidden = true; return; }
  if (einfuehrungSchritt === 4 && spiel.nacht < 2) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<div class="schritt">Einführung ${einfuehrungSchritt + 1} / ${SCHRITTE.length}</div><p>${SCHRITTE[einfuehrungSchritt].text}</p><button type="button" id="ueberspringen">Einführung ausblenden</button>`;
  $('ueberspringen').onclick = () => { einfuehrungSchritt = -1; einst.einfuehrung = false; einstSpeichern(); el.hidden = true; };
}
// ================= Einstellungen =================
function zeigeEinstellungen(): void {
  panelArt = 'einst'; const p = $('panel');
  p.innerHTML = `<button class="schliessen" type="button" aria-label="Schließen">×</button><h2>Einstellungen</h2>
    <label class="regler">Musik <input type="range" id="e-musik" min="0" max="1" step="0.05" value="${einst.musik}"></label>
    <label class="regler">Klänge <input type="range" id="e-effekte" min="0" max="1" step="0.05" value="${einst.effekte}"></label>
    <div class="zeile"><span>Grafik</span><span class="wahl">${(['hoch', 'mittel', 'niedrig'] as const).map((g) => `<button type="button" data-grafik="${g}" aria-pressed="${einst.grafik === g}">${g[0].toUpperCase() + g.slice(1)}</button>`).join('')}</span></div>
    <p>Niedrig: ohne Schatten und Nachbearbeitung, für schwächere Geräte.</p>
    <h3 style="margin:6px 0 0;font-family:var(--display);color:var(--ember)">Spielstand speichern</h3>
    ${plaetze().map((pl, i) => `<button type="button" class="aktion" data-platz="${i}">Platz ${i + 1}${pl ? ` · überschreibt ${pl.name}` : ' · leer'}</button>`).join('')}
    <button type="button" class="aktion" id="e-einf">Einführung neu zeigen</button>
    <button type="button" class="aktion" id="e-menue">Speichern und zum Menü</button>`;
  p.hidden = false;
  p.querySelector<HTMLButtonElement>('.schliessen')!.onclick = schliessePanel;
  const m = $<HTMLInputElement>('e-musik'), f = $<HTMLInputElement>('e-effekte');
  m.oninput = f.oninput = () => { einst.musik = Number(m.value); einst.effekte = Number(f.value); klang.setzeLautstaerke(einst.musik, einst.effekte); einstSpeichern(); };
  p.querySelectorAll<HTMLButtonElement>('[data-grafik]').forEach((b) => { b.onclick = () => { einst.grafik = b.dataset.grafik as typeof einst.grafik; einstSpeichern(); grafikSetzen(); zeigeEinstellungen(); }; });
  p.querySelectorAll<HTMLButtonElement>('[data-platz]').forEach((b) => { b.onclick = () => { if (platzSpeichern(Number(b.dataset.platz))) zeigeEinstellungen(); }; });
  $('e-einf').onclick = () => { einst.einfuehrung = true; einstSpeichern(); einfuehrungSchritt = 0; schliessePanel(); einfuehrung(); };
  $('e-menue').onclick = () => { speichern(); schliessePanel(); zeigeStart(); };
}

// ================= Akte, Leitsätze, Abspann =================
function zeigeAkt(nr: number): void {
  const a = AKTE[nr - 1], el = $('akt');
  el.innerHTML = `<div class="akt-nr">Akt ${['I', 'II', 'III', 'IV'][nr - 1]}</div><h2>${a.name}</h2><p>${a.text}</p>`;
  el.hidden = false; el.classList.remove('weg'); void el.offsetWidth; el.classList.add('zeigen');
  klang.spiele('horn', 0.7);
  setTimeout(() => { el.classList.add('weg'); setTimeout(() => { el.hidden = true; el.classList.remove('zeigen', 'weg'); }, 1200); }, 6500);
}
function zeigeLeitsatz(): void {
  const s = spiel; if (!s || !s.leitsatzOffen) return;
  const z = s.leitsatzOffen, el = $('leitsatz');
  el.innerHTML = `<div class="akt-nr">Neues Zeitalter · ${ZA_NAMEN[z]}</div><h2>Wähle einen Leitsatz</h2><p>Die Wahl gilt für den Rest der Partie.</p>
    <div class="leit-wahl">${LEITSAETZE[z].map((l) => `<button type="button" data-leit="${l.id}"><b>${l.name}</b><span>${l.kurz}</span></button>`).join('')}</div>
    <button type="button" class="spaeter" id="leit-spaeter">Später entscheiden</button>`;
  el.hidden = false;
  el.querySelectorAll<HTMLButtonElement>('[data-leit]').forEach((b) => { b.onclick = () => { if (s.waehleLeitsatz(b.dataset.leit!)) { el.hidden = true; klang.spiele('glocke', 0.8); } }; });
  $('leit-spaeter').onclick = () => { el.hidden = true; };
}
function zeigeAbspann(): void {
  const s = spiel; if (!s || !s.sieg) return;
  imAbspann = true; menueZeit = 0;
  const st = s.stat, el = $('sieg');
  const zeile = (a: string, b: string | number) => `<div class="zeile"><span>${a}</span><b>${b}</b></div>`;
  el.innerHTML = `<div class="abspann">
    <div class="akt-nr">${s.sieg.versiegelt ? 'Alle Risse sind versiegelt' : 'Die letzte Nacht ist überstanden'}</div>
    <h1 class="titel">rune<b>BOOM</b></h1>
    <p class="sieg-text">${s.sieg.versiegelt ? `Nach ${s.sieg.nacht} Nächten ist die Wildnis gebannt. Die Feste der ${VOELKER[s.volk].name} wird in Liedern weiterleben.` : `Vierzig Nächte hat die Feste der ${VOELKER[s.volk].name} gehalten. ${s.versiegelt.size} von ${s.alleRisse().length} Rissen sind versiegelt.`}</p>
    <div class="stat">${zeile('Weltcode', s.code)}${zeile('Volk · Schwierigkeit', `${VOELKER[s.volk].name} · ${SCHWIERIGKEIT[s.schwierigkeit].name}`)}${zeile('Überstandene Nächte', s.sieg.nacht)}${zeile('Besiegte Wesen', s.besiegt)}${zeile('Gefallene Rissfürsten', st.bosse)}${zeile('Erfindungen', `${s.erfindungen.size} von ${Object.keys(ERFINDUNGEN).length}`)}${zeile('Zeitalter', ZA_NAMEN[s.zeitalter()])}${zeile('Meiste Einwohner', st.maxEinwohner)}${zeile('Gebäude gebaut', st.gebaut)}${zeile('Verlorene Gebäude', st.zerstoert)}${zeile('Wunder', st.wunder.join(', ') || 'keines')}${zeile('Versiegelte Risse', `${s.versiegelt.size} / ${s.alleRisse().length}`)}</div>
    <div class="rolle"><div class="rolle-inhalt">
      <p><b>runeBOOM · Die Feste der Erfinder</b></p><p>Ein Spiel aus der Familie von overBOOM</p>
      <p>Idee und Spielleitung<br><b>HOAI-droid</b></p><p>Welten, Wesen und Voxel<br>prozedural aus deinem Weltcode</p>
      <p>Musik und Klänge<br>live im Browser erzeugt</p><p>Danke fürs Spielen!</p></div></div>
    <div class="reihe"><button type="button" class="knopf haupt" id="sieg-menue">Zum Hauptmenü</button><button type="button" class="knopf" id="sieg-neu">Neue Welt</button></div></div>`;
  el.hidden = false; $('hud').hidden = true;
  $('sieg-menue').onclick = () => { imAbspann = false; el.hidden = true; zeigeStart(); };
  $('sieg-neu').onclick = () => { imAbspann = false; el.hidden = true; zeigeStart(); seite('neu'); };
}

// ================= Bericht der Nacht =================
function zeigeBericht(b: import('@runeboom/core').Nachtbericht): void {
  const el = $('bericht');
  el.innerHTML = `<h2>Bericht der ${b.nacht}. Nacht</h2>
    <div class="zeile"><span>Besiegte Wesen</span><span>${b.besiegt}</span></div>
    <div class="zeile"><span>Beute</span><span>${b.beute}</span></div>
    <div class="zeile"><span>Schaden an Gebäuden</span><span>${b.schaden}</span></div>
    ${b.zerstoert.length ? `<div class="zeile"><span>Zerstört</span><span style="color:var(--rot)">${[...new Set(b.zerstoert)].map((n) => `${b.zerstoert.filter((x) => x === n).length}× ${n}`).join(', ')}</span></div>` : ''}
    ${b.kraftFehlt ? `<div class="zeile"><span>Runenkraft</span><span style="color:var(--rot)">${b.kraftFehlt} Kristall fehlten</span></div>` : ''}
    ${b.tuerme.length ? `<div class="zeile"><span>Beste Türme</span><span></span></div><ol>${b.tuerme.map((t) => `<li>${t.name} · ${t.schaden} Schaden</li>`).join('')}</ol>` : ''}
    <button type="button" id="bericht-zu">Weiter</button>`;
  el.hidden = false;
  $('bericht-zu').onclick = () => { el.hidden = true; };
  setTimeout(() => { el.hidden = true; }, 25000);
}

// ================= Hauptschleife =================
let letzte = performance.now();
renderer.setAnimationLoop(() => {
  const jetzt = performance.now(), dt = Math.min(0.1, (jetzt - letzte) / 1000); letzte = jetzt;
  ZEIT.value += dt;
  if (spiel && welt && obj) {
    enthuellungSchritt(dt);
    if (imMenue) { // Menü: die Feste lebt, Tag und Nacht wechseln langsam, keine Wellen
      if (spiel.phase !== 'tag' || spiel.zeit > TAGD - 12) { spiel.phase = 'tag'; spiel.zeit = 5; }
      try { spiel.schritt(); } catch (err) { console.error(err); }
      obj.ereignisse(spiel.ereignisse.splice(0).filter((e) => e.art !== 'meldung'));
      const d = 0.5 - 0.5 * Math.cos(menueZeit * 2 * Math.PI / 70);
      licht.setze(Math.min(1, d * 1.15)); post.setze(licht); welt.nebelFarbe(licht.werte.nebel);
      obj.bild(dt, (x, z) => spiel!.licht(x, z), d > 0.5, camera, 0);
      menueKamera(enth.aktiv && enth.phase === 0 ? 0 : dt);
      const dist = camera.position.distanceTo(controls.target);
      licht.fog.far = 360 + dist * 2.4; licht.fog.near = licht.fog.far * 0.45; licht.folge(controls.target, camera);
      planZeit -= dt; if (planZeit <= 0) { welt.planen(controls.target, dist, camera); planZeit = 0.25; }
      if (einst.grafik === 'niedrig') { renderer.toneMappingExposure = licht.werte.exp; renderer.render(scene, camera); } else post.render();
      return;
    }
    akku += enth.aktiv && enth.phase === 0 ? 0 : dt * tempo; let n = 0;
    // Ein Fehler in einem Takt darf nie das ganze Spiel anhalten: melden, weiterlaufen
    while (akku >= DT && n < 12) {
      try { spiel.schritt(); } catch (err) { console.error(err); if (performance.now() - fehlerGemeldet > 10000) { fehlerGemeldet = performance.now(); melde('Ein Fehler im Spielablauf wurde abgefangen. Das Spiel läuft weiter.', 'schlecht'); } }
      akku -= DT; n++;
    }
    if (n >= 12) akku = 0;
    const ev = spiel.ereignisse.splice(0);
    let lichtNeu = false;
    for (const e of ev) {
      if (e.art === 'gebaut' || e.art === 'weg' || e.art === 'umgebaut') lichtNeu = true;
      if (e.art === 'umgebaut') klang.spiele('glocke', naehe(e.geb.x, e.geb.z) * 0.5);
      if (e.art === 'blitz') klang.spiele('treffer', naehe(e.punkte[0][0], e.punkte[0][2]) * 0.5);
      if (e.art === 'feuer') klang.spiele('wurf', naehe(e.x, e.z) * 0.4);
      if (e.art === 'ruine' && e.neu) klang.spiele('einsturz', naehe(e.ruine.x, e.ruine.z));
      if (e.art === 'gelaende') { for (let cx = Math.floor((e.x0 - 1) / CH); cx <= Math.floor((e.x1 + 1) / CH); cx++) for (let cz = Math.floor((e.z0 - 1) / CH); cz <= Math.floor((e.z1 + 1) / CH); cz++) welt.kachelNeu(cx, cz); for (let x = e.x0; x <= e.x1; x++) for (let z = e.z0; z <= e.z1; z++) welt.grobDeko(x, z, false); }
      if (e.art === 'deko') { welt.kachelNeu(Math.floor(e.x / CH), Math.floor(e.z / CH)); welt.grobDeko(e.x, e.z, !spiel.dekoZustand(e.x, e.z)); }
      if (e.art === 'schuss') klang.spiele(e.geschoss === 'pfeil' ? 'sehne' : 'wurf', naehe(e.x, e.z) * 0.8);
      if (e.art === 'treffer') klang.spiele('treffer', naehe(e.x, e.z) * 0.7);
      if (e.art === 'explosion') klang.spiele('explosion', naehe(e.x, e.z));
      if (e.art === 'hieb') klang.spiele(e.res === 'holz' ? 'hieb_holz' : e.res === 'stein' ? 'hieb_stein' : 'hieb_kristall', naehe(e.x, e.z) * 0.6);
      if (e.art === 'abgeliefert') klang.spiele('abgeliefert', naehe(e.x, e.z) * 0.6);
      if (e.art === 'gebaut') klang.spiele('bau', naehe(e.geb.x, e.geb.z));
      if (e.art === 'weg' && e.zerstoert) klang.spiele('einsturz', naehe(e.geb.x, e.geb.z));
      if (e.art === 'tod') klang.spiele('tod', naehe(e.x, e.z) * 0.6);
      if (e.art === 'reparatur') klang.spiele(e.fertig ? 'glocke' : 'reparatur', naehe(e.geb.x, e.geb.z) * (e.fertig ? 0.3 : 0.8));
      if (e.art === 'phase' && e.phase === 'nacht') klang.spiele('horn');
      if (e.art === 'phase' && e.phase === 'morgen') klang.spiele('glocke', 0.8);
      if (e.art === 'erkundet') { welt.nebelAktualisieren(); zeichneKartenGrund(); }
      if (e.art === 'meldung') melde(e.text, e.ton);
      if (e.art === 'bericht') zeigeBericht(e.bericht);
      if (e.art === 'akt') zeigeAkt(e.nr);
      if (e.art === 'leitsatz') zeigeLeitsatz();
      if (e.art === 'versiegelt') klang.spiele('glocke', 1);
      if (e.art === 'sternschnuppe') klang.spiele('abgeliefert', naehe(e.x, e.z) * 0.5);
      if (e.art === 'falle') klang.spiele('explosion', naehe(e.x, e.z));
      if (e.art === 'phase' && e.phase === 'gewonnen') { try { localStorage.removeItem(SPEICHER); } catch { /* */ } setTimeout(zeigeAbspann, 2500); }
      if (e.art === 'riss') klang.spiele('horn', 0.9);
      if (e.art === 'phase' && e.phase === 'tag') speichern();
      if (e.art === 'phase' && e.phase === 'verloren') { $('ende-text').textContent = `Nach ${spiel.nacht - 1} überstandenen Nächten und ${spiel.besiegt} besiegten Wesen hat die Welt ${spiel.code} gesiegt. Mit demselben Weltcode lässt sich genau diese Welt noch einmal versuchen.`; setTimeout(() => { $('ende').hidden = false; }, 1600); try { localStorage.removeItem(SPEICHER); } catch { /* */ } }
    }
    obj.ereignisse(ev);
    kegelZeit -= dt;
    if (!lichtNeu && kegelZeit <= 0) { kegelZeit = 0.2; lichtNeu = spiel.gebaeude.some((g) => GEBAEUDE[g.typ].kegel); }
    if (lichtNeu) lichtkarteSetzen(spiel.lichtquellen());
    anzeigeDunkel += (spiel.dunkel() - anzeigeDunkel) * Math.min(1, dt * 1.5);
    licht.setze(anzeigeDunkel); post.setze(licht); welt.nebelFarbe(licht.werte.nebel);
    const wegStaerke = spiel.phase === 'tag' ? (spiel.abend() ? 1 : werkzeug ? 0.6 : 0.3) : 0;
    obj.bild(tempo ? dt * Math.min(tempo, 2) : 0, (x, z) => spiel!.licht(x, z), anzeigeDunkel > 0.5, camera, wegStaerke);
    { const h = spiel.haupt; let nah = 0; if (h) for (const g of spiel.gegner) if (Math.hypot(g.x - h.x - 6, g.z - h.z - 6) < 45) nah++; klang.stimmung(spiel.phase === 'nacht', nah / 25); }
    if (imAbspann) menueKamera(dt); else { tastenBewegung(dt); controls.update(); }
    const tg = controls.target, cx = THREE.MathUtils.clamp(tg.x, -WR + 20, WR - 20), cz = THREE.MathUtils.clamp(tg.z, -WR + 20, WR - 20);
    if (cx !== tg.x || cz !== tg.z) { const d = new THREE.Vector3(cx - tg.x, 0, cz - tg.z); tg.add(d); camera.position.add(d); }
    const dist = camera.position.distanceTo(tg);
    licht.fog.far = 360 + dist * 2.4; licht.fog.near = licht.fog.far * 0.45;
    licht.folge(tg, camera);
    planZeit -= dt; if (planZeit <= 0) { welt.planen(tg, dist, camera); planZeit = 0.25; }
    uiZeit -= dt; if (uiZeit <= 0) { anzeige(); zeichneKarte(); uiZeit = 0.15; }
  } else controls.update();
  if (einst.grafik === 'niedrig') { renderer.toneMappingExposure = licht.werte.exp; renderer.render(scene, camera); } else post.render();
});
