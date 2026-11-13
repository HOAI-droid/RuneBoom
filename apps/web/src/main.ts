import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import {
  Spiel, t, setzeSprache, sprache, systemSprache, registriereSprache, SPRACHEN, type Sprache, DT, B, WR, CH, EBNEN_STEIN, BAUGRUPPEN, VOELKER, LEITSAETZE, OMEN, AKTE, ENDE_NACHT, RISSE, HAUPT_STUFEN, RES_NAMEN, STUFE_NAME, SCHWIERIGKEIT, runenkraft, WISSEN_NAME, TAG_DAUER as TAGD, FAEHIGKEIT_NAME, VERSCHMELZUNGEN, ZEITALTER_NAME, hoeheGeaendert, GEBAEUDE, BAULEISTE, ERFINDUNGEN, BAUSTEIN_NAME, GEGNER, TAG_DAUER, hoehe, neuerWeltcode,
  type GebTyp, type Geb, type Ruine, type Res, type Schwierigkeit, type Wissen, type Volk, type Baustein, type ErfId, type Spielstand
} from '@runeboom/core';
import { neuerRenderer, FABRIK, Beleuchtung, WeltAnsicht, Objekte, lichtkarteSetzen, ZEIT } from '@runeboom/render';
import { Klang } from './klang.ts';
import { EN } from './sprachen/en.ts';
import { FR } from './sprachen/fr.ts';
import { ES } from './sprachen/es.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SPEICHER = 'runeboom-spielstand-3', PLAETZE = 'runeboom-plaetze-1', VERSION = '0.7.1';
const RES_NAME: Record<Res, string> = RES_NAMEN;
const MEHRZAHL: Record<string, string> = { moorwicht: t('Moorwichte'), wolf: t('Schattenwölfe'), troll: t('Steintrolle'), drachling: t('Drachlinge'), rochen: t('Nebelrochen'), aschegeist: t('Aschegeister'), steinwerfer: t('Steinwerfer'), schamane: t('Moorschamanen'), schildwaechter: t('Borkenwächter'), rissfuerst: t('Rissfürsten') };
const kostenHtml = (k: Partial<Record<Res, number>>) => Object.entries(k).map(([r, n]) => `${Math.ceil(n as number)} ${t(RES_NAME[r as Res])}`).join(' · ');

// ================= Einstellungen =================
const EINST = 'runeboom-einstellungen-1';
const einst = { musik: 0.55, effekte: 0.7, grafik: 'hoch' as 'hoch' | 'mittel' | 'niedrig', einfuehrung: true, sprache: 'auto' as Sprache | 'auto', fps: false, karte: false, autoAufl: true, darstellung: 'auto' as 'auto' | 'webgpu' | 'webgl' };
try { Object.assign(einst, JSON.parse(localStorage.getItem(EINST) || '{}')); } catch { /* */ }
registriereSprache('en', EN); registriereSprache('fr', FR); registriereSprache('es', ES);
setzeSprache(einst.sprache === 'auto' ? systemSprache() : einst.sprache);
document.documentElement.lang = sprache();
const einstSpeichern = () => { try { localStorage.setItem(EINST, JSON.stringify(einst)); } catch { /* */ } };
// ================= Grundgerüst: Leinwand, Szene, Kamera =================
const canvas = $<HTMLCanvasElement>('leinwand');
/** WebGPU, wenn eingestellt und vom Gerät unterstützt, sonst WebGL */
const { renderer, weg: aktiverWeg } = await neuerRenderer(canvas, einst.darstellung, () => speichern());
const aktiveDarstellung = einst.darstellung;
const gpuWeg = () => aktiverWeg;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 4000);
const licht = new Beleuchtung(scene, 60);
const post = FABRIK.post(renderer, scene, camera, 0.5);
const controls = new MapControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
controls.minDistance = 22; controls.maxDistance = 900; controls.maxPolarAngle = 1.15; controls.minPolarAngle = 0.3;
function groesse(): void { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); post.groesse(w, h); }
addEventListener('resize', groesse); groesse();

const klang = new Klang(); klang.setzeLautstaerke(einst.musik, einst.effekte);
/** automatische Auflösung: sinkt die Bildrate, wird mit weniger Bildpunkten gezeichnet (bis 60 %), mit Luft wieder mehr */
const aufl = { faktor: 1, zeit: 0, bilder: 0, sperre: 0 };
const basisPixel = () => (einst.grafik === 'hoch' ? Math.min(devicePixelRatio || 1, 1.6) : 1);
function auflSetzen(f: number): void { aufl.faktor = f; renderer.setPixelRatio(basisPixel() * f); groesse(); }
function auflSchritt(roh: number): void {
  if (!einst.autoAufl) { if (aufl.faktor !== 1) auflSetzen(1); return; }
  if (roh > 0.25 || enth.aktiv) { aufl.zeit = 0; aufl.bilder = 0; return; } // Hintergrund oder Laden: nicht werten
  aufl.zeit += roh; aufl.bilder++; if (aufl.zeit < 1.5) return;
  const fps = aufl.bilder / aufl.zeit; aufl.sperre -= aufl.zeit; aufl.zeit = 0; aufl.bilder = 0;
  if (fps < 50 && aufl.faktor > 0.6) { auflSetzen(Math.max(0.6, aufl.faktor - 0.1)); aufl.sperre = 8; }
  else if (fps > 58 && aufl.faktor < 1 && aufl.sperre <= 0) { auflSetzen(Math.min(1, aufl.faktor + 0.05)); aufl.sperre = 4; }
}
function grafikSetzen(): void {
  const st = einst.grafik;
  renderer.setPixelRatio(basisPixel() * aufl.faktor); post.tilt = st === 'hoch';
  const schatten = st !== 'niedrig';
  if (renderer.shadowMap.enabled !== schatten) { renderer.shadowMap.enabled = schatten; scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true)); }); }
  licht.sun.shadow.mapSize.set(st === 'hoch' ? 2048 : 1024, st === 'hoch' ? 2048 : 1024); if (!FABRIK.gpu) { licht.sun.shadow.map?.dispose(); (licht.sun.shadow as any).map = null; }
  try { if (obj) obj.buergerMax = st === 'hoch' ? 150 : st === 'mittel' ? 70 : 25; } catch { /* beim Start noch nicht da */ }
  groesse();
}
grafikSetzen();
/** Lautstärke eines Geräuschs nach Entfernung zum Blickpunkt */
const naehe = (x: number, z: number) => Math.max(0, 1 - Math.hypot(x - controls.target.x, z - controls.target.z) / (40 + camera.position.distanceTo(controls.target) * 0.6));

// ================= Zustand =================
let spiel: Spiel | null = null, welt: WeltAnsicht | null = null, obj: Objekte | null = null;
let tempo = 1, werkzeug: { art: 'bau'; typ: GebTyp } | { art: 'spaeher' } | { art: 'ebnen' } | { art: 'feuerregen' } | null = null, gewaehlt: Geb | null = null, ruineGew: Ruine | null = null;
let sturzKamera = 0, fehlerGemeldet = 0, kegelZeit = 0, kegelWarAn = false, berichtPause = false;
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
  welt = new WeltAnsicht(scene, spiel.seed, spiel.erkundet); welt.nebelLagen = einst.grafik === 'hoch' ? 5 : 3; welt.detail = einst.grafik === 'hoch' ? 1 : einst.grafik === 'mittel' ? 0.8 : 0.6;
  const sp = spiel, wa = welt;
  welt.aenderungen = (cx, cz) => sp.dekoAenderungen(cx, cz, CH);
  welt.hoehen = (cx, cz) => { const out: [number, number, number][] = []; for (let x = cx * CH - 2; x < cx * CH + CH + 2; x++) for (let z = cz * CH - 2; z < cz * CH + CH + 2; z++) { const h = hoeheGeaendert(x, z); if (h !== undefined) out.push([x, z, h]); } return out; };
  welt.onUebersicht = () => { zeichneKartenGrund(); for (const k of [...sp.gefaellt.keys(), ...sp.abgebaut.keys()]) { const x = Math.floor(k / 2048) - 600, z = (k % 2048) - 600; wa.grobDeko(x, z, !sp.dekoZustand(x, z)); } };
  einfuehrungSchritt = einst.einfuehrung && !stand ? 0 : -1; spaeherGeschickt = false;
  obj = new Objekte(scene, spiel); obj.buergerMax = einst.grafik === 'hoch' ? 150 : einst.grafik === 'mittel' ? 70 : 25;
  lichtkarteSetzen(spiel.lichtquellen());
  const ziel = new THREE.Vector3(B.x + 0.5, 7, B.z + 16);
  controls.target.copy(ziel); camera.position.copy(ziel).add(new THREE.Vector3(56, 70, 74)); controls.update();
  anzeigeDunkel = spiel.dunkel();
  $('start').hidden = true; $('ende').hidden = true; $('hud').hidden = false;
  $('weltcode').textContent = code;
  baueLeiste(); setzeTempo(1); waehle(null); werkzeugSetzen(null);
  spiel.ereignisse.length = 0;
  melde(stand ? `${t('Willkommen zurück. Tag {a}.', { a: spiel.nacht })}` : t('Tag 1. Baue Türme vor dem Tor, bevor die Nacht kommt. Der Pfad zeigt, woher die Wesen kommen.'), 'info');
}
function aufraeumen(): void { berichtPause = false; $('bericht').hidden = true; $('hilfe').hidden = true; obj?.ende(); welt?.ende(); obj = null; welt = null; spiel = null; imMenue = false; imAbspann = false; }
function speichern(): void { if (!spiel || imMenue || spiel.phase === 'verloren' || spiel.phase === 'nacht') return; try { localStorage.setItem(SPEICHER, JSON.stringify(spiel.speichern())); } catch { /* Speicher nicht verfügbar */ } }
interface Platz { name: string; datum: number; stand: Spielstand }
function plaetze(): (Platz | null)[] { try { const p = JSON.parse(localStorage.getItem(PLAETZE) || '[]'); return [0, 1, 2].map((i) => p[i] || null); } catch { return [null, null, null]; } }
function platzSpeichern(i: number): boolean {
  if (!spiel || imMenue) return false;
  if (spiel.phase === 'nacht') { melde(t('In der Nacht lässt sich nicht speichern.'), 'schlecht'); return false; }
  const p = plaetze(); p[i] = { name: `${t('{a} · Tag {b}', { a: spiel.code, b: spiel.nacht })}`, datum: Date.now(), stand: spiel.speichern() };
  try { localStorage.setItem(PLAETZE, JSON.stringify(p)); melde(`${t('Gespeichert in Platz {a}.', { a: i + 1 })}`, 'gut'); return true; } catch { melde(t('Speichern nicht möglich.'), 'schlecht'); return false; }
}
function platzLoeschen(i: number): void { const p = plaetze(); p[i] = null; try { localStorage.setItem(PLAETZE, JSON.stringify(p)); } catch { /* */ } }
const standInfo = (st: Spielstand) => `${t('Tag {a} · {b} · {c} · {d}', { a: st.nacht, b: st.code, c: t(VOELKER[st.volk || 'glutborn'].name), d: t(SCHWIERIGKEIT[st.schwierigkeit || 'normal'].name) })}`;
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
  welt = new WeltAnsicht(scene, s.seed, s.erkundet); welt.nebelLagen = einst.grafik === 'hoch' ? 5 : 3; welt.detail = einst.grafik === 'hoch' ? 1 : einst.grafik === 'mittel' ? 0.8 : 0.6;
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
const enth = { aktiv: false, phase: 0, t: 0, start: 0 };
function enthuellen(): void {
  enth.aktiv = true; enth.phase = 0; enth.t = 0; enth.start = performance.now();
  const el = $('schleier'); el.hidden = false; el.classList.remove('auf'); el.style.setProperty('--r', '-30vmax');
  document.body.classList.add('verhuellt');
}
function enthuellungSchritt(dt: number): void {
  if (!enth.aktiv || !welt) return;
  enth.t += dt;
  const el = $('schleier');
  if (enth.phase === 0) {
    welt.planen(controls.target, camera.position.distanceTo(controls.target), camera);
    if (welt.bereit(controls.target, camera.position.distanceTo(controls.target), camera) || performance.now() - enth.start > 9000) {
      try { const r = renderer as unknown as { compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<void> }; if (r.compileAsync) void r.compileAsync(scene, camera).catch(() => { /* */ }); else renderer.compile(scene, camera); } catch { /* */ }
      enth.phase = 1; enth.t = 0; el.classList.add('auf'); document.body.classList.remove('verhuellt');
    }
    return;
  }
  const f = Math.min(1, enth.t / 2.6), e = 1 - Math.pow(1 - f, 3);
  el.style.setProperty('--r', `${t('{a}vmax', { a: -30 + e * 150 })}`);
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
    el.innerHTML = `<h2>${t('Neues Spiel')}</h2><p>${t('Jeder Weltcode ergibt genau eine Welt. Teile ihn, damit andere dieselbe Welt versuchen können.')}</p>
      <div class="feld"><label for="code">${t('Weltcode')}</label><input id="code" maxlength="24" spellcheck="false" autocomplete="off" value="${neuCode}"><button type="button" id="wuerfeln">${t('Neu würfeln')}</button></div>
      <div class="feld"><label>${t('Volk')}</label></div>
      <div class="stufen-wahl volk-wahl">${(Object.keys(VOELKER) as Volk[]).map((v) => `<button type="button" data-volk="${v}" aria-pressed="${v === neuVolk}" class="volk-${v}"><b>${t(VOELKER[v].name)}</b><small>${t(VOELKER[v].stoff)}. ${t(VOELKER[v].kurz)}</small><small class="staerken">${VOELKER[v].staerken.join(' · ')}</small></button>`).join('')}</div>
      <div class="feld"><label>${t('Schwierigkeit')}</label></div>
      <div class="stufen-wahl">${(Object.keys(SCHWIERIGKEIT) as Schwierigkeit[]).map((k) => `<button type="button" data-schwer="${k}" aria-pressed="${k === neuSchwer}"><b>${t(SCHWIERIGKEIT[k].name)}</b><small>${k === 'leicht' ? t('Kleinere Wellen, mehr Vorrat. Zum Kennenlernen.') : k === 'normal' ? t('Ab Nacht 10 wird es ernst.') : t('Große Wellen, wenig Vorrat. Jeder Fehler zählt.')}</small></button>`).join('')}</div>
      <label class="regler"><span><input type="checkbox" id="mit-einf" ${einst.einfuehrung ? 'checked' : ''}> ${t('Einführung zeigen')}</span></label>
      <div class="reihe"><button type="button" class="knopf haupt" id="los">${t('Welt betreten')}</button></div>`;
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
    el.innerHTML = `<h2>${t('Spielstände')}</h2><p>${t('Zu Beginn jedes Tages wird automatisch gespeichert. Im Spiel lässt sich über ☰ zusätzlich in einen der drei Plätze speichern.')}</p>
      <div class="platz"><b>${t('Automatisch')}</b><small>${auto && auto.phase !== 'verloren' ? standInfo(auto) : t('leer')}</small><div class="knoepfe2"><button type="button" class="haupt" data-laden="auto" ${auto && auto.phase !== 'verloren' ? '' : 'disabled'}>${t('Laden')}</button></div></div>
      ${plaetze().map((p, i) => `<div class="platz"><b>${t('Platz {a}', { a: i + 1 })}</b><small>${p ? `${standInfo(p.stand)} · ${new Date(p.datum).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : t('leer')}</small><div class="knoepfe2"><button type="button" class="haupt" data-laden="${i}" ${p ? '' : 'disabled'}>${t('Laden')}</button><button type="button" data-loeschen="${i}" ${p ? '' : 'disabled'}>${t('Löschen')}</button></div></div>`).join('')}`;
    el.querySelectorAll<HTMLButtonElement>('[data-laden]').forEach((b) => { b.onclick = () => { const k = b.dataset.laden!; const st = k === 'auto' ? geladen() : plaetze()[Number(k)]?.stand; if (st) starte(st.code, st, st.schwierigkeit); }; });
    el.querySelectorAll<HTMLButtonElement>('[data-loeschen]').forEach((b) => { b.onclick = () => { if (confirm(t('Diesen Spielstand wirklich löschen?'))) { platzLoeschen(Number(b.dataset.loeschen)); seite('plaetze'); } }; });
  }
  if (name === 'einst') {
    el.innerHTML = `<h2>${t('Einstellungen')}</h2>${einstellungenHtml()}`;
    einstellungenVerbinden(el, () => seite('einst'));
  }
  if (name === 'steuerung') {
    el.innerHTML = `<h2>${t('Steuerung')}</h2><div class="hilfe">
      <kbd>${t('Ziehen · Rad')}</kbd><span>${t('Karte verschieben (linke oder mittlere Maustaste) · zoomen; rechte Maustaste oder zwei Finger: drehen')}</span>
      <kbd>W A S D · Q E</kbd><span>${t('verschieben · drehen')}</span>
      <kbd>1 – 8 · H · F</kbd><span>${t('Gebäude wählen, Klick setzt es; Mauern durch Ziehen')}</span>
      <kbd>${t('Klick auf Gebäude')}</kbd><span>${t('Ausbauen (Stufe I–III), Umrüsten, Verschmelzen, Reparieren')}</span>
      <kbd>X · 9</kbd><span>${t('Späher in den Nebel (15 Holz) · Gelände ebnen')}</span>
      <kbd>T</kbd><span>${t('Erfindungsbaum')}</span>
      <kbd>M</kbd><span>${t('Karte ein- und ausblenden')}</span>
      <kbd>${t('N · Leertaste')}</kbd><span>${t('Nacht einläuten · Pause')}</span>
      <kbd>${t('Esc · Rechtsklick')}</kbd><span>${t('abbrechen')}</span></div>`;
  }
  el.hidden = false;
}
function einstellungenHtml(): string {
  return `<label class="regler">${t('Musik')} <input type="range" id="e-musik" min="0" max="1" step="0.05" value="${einst.musik}"></label>
    <label class="regler">${t('Klänge')} <input type="range" id="e-effekte" min="0" max="1" step="0.05" value="${einst.effekte}"></label>
    ${grafikHtml()}
    <div class="zeile"><span>${t('Sprache')}</span><span class="wahl">${(['auto', 'de', 'en', 'fr', 'es'] as const).map((l) => `<button type="button" data-sprache="${l}" aria-pressed="${einst.sprache === l}">${l === 'auto' ? t('Automatisch') : SPRACHEN[l]}</button>`).join('')}</span></div>
`;
}
const STUFE_TEXT: Record<string, string> = { hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig' };
function grafikHtml(): string {
  const weg = gpuWeg();
  return `<div class="zeile"><span>${t('Grafik')}</span><span class="wahl">${(['hoch', 'mittel', 'niedrig'] as const).map((g) => `<button type="button" data-grafik="${g}" aria-pressed="${einst.grafik === g}">${t(STUFE_TEXT[g])}</button>`).join('')}</span></div>
    <p>${t('Niedrig: ohne Schatten und Nachbearbeitung, für schwächere Geräte.')}</p>
    <div class="zeile"><span>${t('Darstellung')}</span><span class="wahl">${(['auto', 'webgpu', 'webgl'] as const).map((g) => `<button type="button" data-darstellung="${g}" aria-pressed="${einst.darstellung === g}">${g === 'auto' ? t('Automatisch') : g === 'webgpu' ? 'WebGPU' : 'WebGL'}</button>`).join('')}</span></div>
    <p>${t('Jetzt: {a}.', { a: weg })} ${einst.darstellung !== aktiveDarstellung ? t('Die Änderung gilt ab dem nächsten Start.') : ''}</p>
    <label class="regler"><span><input type="checkbox" id="e-aufl" ${einst.autoAufl ? 'checked' : ''}> ${t('Auflösung automatisch anpassen')}</span></label>
    <label class="regler"><span><input type="checkbox" id="e-fps" ${einst.fps ? 'checked' : ''}> ${t('Bildrate und Messwerte anzeigen')}</span></label>
    ${einst.fps ? `<div class="zeile"><span>${t('Zum Messen ausblenden')}</span><span class="wahl">${MESS_TEILE.map(([k, n]) => `<button type="button" data-aus="${k}" aria-pressed="${messAus.has(k)}">${t(n)}</button>`).join('')}</span></div>` : ''}`;
}
/** zum Messen ausblendbare Teile (nicht gespeichert) */
const MESS_TEILE: [string, string][] = [['nebel', 'Nebel'], ['schatten', 'Schatten'], ['nach', 'Nachbearbeitung'], ['wald', 'Ferner Wald'], ['kacheln', 'Kacheln']];
const messAus = new Set<string>();
function grafikVerbinden(p: HTMLElement, neu: () => void): void {
  p.querySelectorAll<HTMLButtonElement>('[data-grafik]').forEach((b) => { b.onclick = () => { einst.grafik = b.dataset.grafik as typeof einst.grafik; einstSpeichern(); grafikSetzen(); neu(); }; });
  p.querySelectorAll<HTMLButtonElement>('[data-darstellung]').forEach((b) => { b.onclick = () => { einst.darstellung = b.dataset.darstellung as typeof einst.darstellung; einstSpeichern(); neu(); }; });
  const au = p.querySelector<HTMLInputElement>('#e-aufl'); if (au) au.onchange = () => { einst.autoAufl = au.checked; einstSpeichern(); };
  const fp = p.querySelector<HTMLInputElement>('#e-fps'); if (fp) fp.onchange = () => { einst.fps = fp.checked; einstSpeichern(); $('fps').hidden = !einst.fps; if (!einst.fps) messAus.clear(); neu(); };
  p.querySelectorAll<HTMLButtonElement>('[data-aus]').forEach((b) => { b.onclick = () => { const k = b.dataset.aus!; if (messAus.has(k)) messAus.delete(k); else messAus.add(k); neu(); }; });
}
function einstellungenVerbinden(p: HTMLElement, neu: () => void): void {
  const m = p.querySelector<HTMLInputElement>('#e-musik')!, f = p.querySelector<HTMLInputElement>('#e-effekte')!;
  m.oninput = f.oninput = () => { einst.musik = Number(m.value); einst.effekte = Number(f.value); klang.setzeLautstaerke(einst.musik, einst.effekte); einstSpeichern(); };
  grafikVerbinden(p, neu);
  p.querySelectorAll<HTMLButtonElement>('[data-sprache]').forEach((b) => { b.onclick = () => { einst.sprache = b.dataset.sprache as typeof einst.sprache; einstSpeichern(); sprachWechsel(); neu(); }; });
}
/** Sprache wechseln: statische Texte, Leiste, offene Fenster neu */
function uebersetzeStatisch(wurzel: Element = document.body): void {
  const w = window as unknown as { __ursprung?: WeakMap<Node, string> }; const ursprung = (w.__ursprung ||= new WeakMap<Node, string>());
  const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  for (let n = gang.nextNode(); n; n = gang.nextNode()) {
    if (n.parentElement?.closest('[data-dynamisch], script, style')) continue;
    if (!ursprung.has(n)) ursprung.set(n, n.textContent || '');
    const o = ursprung.get(n)!, kern = o.replace(/\s+/g, ' ').trim(); if (!kern || !/[A-Za-zÄÖÜäöüß]{3}/.test(kern)) continue;
    n.textContent = o.replace(o.trim(), t(kern));
  }
  for (const el of wurzel.querySelectorAll<HTMLElement>('[title],[aria-label]')) for (const a of ['title', 'aria-label']) {
    const v = el.getAttribute(a); if (!v) continue; const k = `data-orig-${a}`; if (!el.hasAttribute(k)) el.setAttribute(k, v); el.setAttribute(a, t(el.getAttribute(k)!));
  }
}
function sprachWechsel(): void {
  setzeSprache(einst.sprache === 'auto' ? systemSprache() : einst.sprache); document.documentElement.lang = sprache();
  uebersetzeStatisch();
  if (spiel && !imMenue) { baueLeiste(); $('panel').dataset.html = ''; if (panelArt === 'geb') panelGeb(); baumZeichnen(true); }
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
// für Tests und Neugierige in der Konsole
(window as unknown as { runeboom: unknown }).runeboom = { bauwerkzeug: (typ: GebTyp) => werkzeugSetzen({ art: 'bau', typ }), leistung: () => ({ ...mess.letzt, aufl: aufl.faktor, weg: gpuWeg() }), get spiel() { return spiel; }, get obj() { return obj; }, camera, controls, get menueZeit() { return menueZeit; }, set menueZeit(v: number) { menueZeit = v; }, menueStopp: false };

// ================= Bauleiste =================
let gruppeOffen: string | null = null;
const GRUPPE_KURZ: Record<string, string> = { dorf: t('Häuser, Höfe, Außenposten'), rohstoffe: t('Sammeln und Verarbeiten'), abwehr: t('Türme, Mauern, Fallen'), wunder: t('Ein Bauwerk je Zeitalter') };
/** Warum lässt sich ein Typ gerade nicht bauen (ohne Ort)? */
function sperrGrund(typ: GebTyp): string {
  const s = spiel!, d = GEBAEUDE[typ];
  if (d.volk && d.volk !== s.volk) return t('Gehört zu einem anderen Volk.');
  if (d.braucht && !s.erfindungen.has(d.braucht)) return `${t('Braucht die Erfindung {a}.', { a: t(ERFINDUNGEN[d.braucht].name) })}`;
  if (d.abNacht && s.nacht < d.abNacht) return `${t('Erst ab Nacht {a}.', { a: d.abNacht })}`;
  if (d.wunder && s.zeitalter() < d.wunder) return `${t('Wunder des Zeitalters {a}.', { a: t(ZA_NAMEN[d.wunder]) })}`;
  if (d.wunder) { const w = s.wunderGewaehlt(d.wunder); if (w && w.typ !== typ) return `${t('Gewählt: {a}.', { a: t(GEBAEUDE[w.typ].name) })}`; if (w) return t('Steht schon.'); }
  if (Spiel.zaehltAlsTurm(typ) && s.turmZahl() >= s.turmGrenze()) return `${t('Turmgrenze {a} erreicht.', { a: s.turmGrenze() })}`;
  return '';
}
function baueLeiste(): void {
  const l = $('leiste'); l.innerHTML = '';
  const reihe = document.createElement('div'); reihe.className = 'gruppen';
  for (const gr of BAUGRUPPEN) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gruppe'; b.dataset.gruppe = gr.id;
    b.innerHTML = `<kbd>${gr.taste}</kbd><b>${t(gr.name)}</b><span>${t(GRUPPE_KURZ[gr.id])}</span>`;
    b.onclick = () => gruppeZeigen(gruppeOffen === gr.id ? null : gr.id);
    reihe.appendChild(b);
  }
  const sonder = (id: string, taste: string, name: string, info: string, tipp: string, fn: () => void) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gruppe sonder'; b.dataset.typ = id;
    b.innerHTML = `<kbd>${taste}</kbd><b>${name}</b><span>${info}</span>`; b.onclick = fn;
    b.onmouseenter = () => zeigeTipp(tipp); b.onmouseleave = () => { if (!werkzeug) zeigeTipp(null); };
    reihe.appendChild(b);
  };
  sonder('spaeher', 'X', t('Späher'), t('15 Holz'), t('<b>Späher</b> · Klick in den Nebel am Rand des Erkundeten deckt die Gegend auf.'), () => werkzeugSetzen(werkzeug?.art === 'spaeher' ? null : { art: 'spaeher' }));
  sonder('ebnen', '9', t('Ebnen'), `${t('{a} Stein je Stufe', { a: EBNEN_STEIN })}`, t('<b>Gelände ebnen</b> · Ziehe eine Fläche auf. Sie bekommt die Höhe des ersten Blocks.'), () => werkzeugSetzen(werkzeug?.art === 'ebnen' ? null : { art: 'ebnen' }));
  sonder('baum', 'T', t('Erfindungen'), '', t('<b>Erfindungsbaum</b> · Aus Bausteinen und Kristall entstehen Erfindungen.'), () => ($('baum').hidden ? zeigeWerkstatt() : baumZu()));
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
    b.innerHTML = `${d.taste ? `<kbd>${d.taste}</kbd>` : ''}<b>${t(d.name)}</b><span class="preis">${kostenHtml(d.kosten)}</span>`;
    b.onclick = () => { werkzeugSetzen(werkzeug?.art === 'bau' && werkzeug.typ === typ ? null : { art: 'bau', typ }); gruppeZeigen(null); };
    b.onmouseenter = () => { const g = sperrGrund(typ); zeigeTipp(`<b>${t(d.name)}</b> · ${t(d.kurz)}${g ? `<br><span class="grund">${g}</span>` : ''}`); };
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
  obj?.zeigeLinie(null);
  werkzeug = w;
  if (w?.art === 'bau' && spiel && !spiel.freigeschaltet(w.typ)) { melde(`${t('{a} braucht erst die Erfindung {b}.', { a: t(GEBAEUDE[w.typ].name), b: t(ERFINDUNGEN[GEBAEUDE[w.typ].braucht!].name) })}`, 'schlecht'); werkzeug = null; }
  if (!werkzeug || werkzeug.art !== 'bau') obj?.zeigeVorschau(null);
  if (werkzeug?.art !== 'ebnen') obj?.zeigeFlaeche(0, 0, 0, 0, 0, true, false);
  if (!werkzeug) zeigeTipp(null);
  if (werkzeug?.art === 'ebnen') zeigeTipp(t('<b>Ebnen</b> · Fläche aufziehen (bis 16 × 16). Esc oder Rechtsklick bricht ab.'));
  if (werkzeug?.art === 'spaeher') zeigeTipp(t('<b>Späher</b> · Klick in den Nebel. Esc oder Rechtsklick bricht ab.'));
  if (werkzeug?.art === 'feuerregen') zeigeTipp(t('<b>Feuerregen</b> · Klick auf die Stelle, die getroffen werden soll.'));
  canvas.style.cursor = werkzeug ? 'crosshair' : '';
  leisteAktualisieren();
}
function zeigeTipp(html: string | null): void {
  const t = $('tipp'); if (!html) { t.hidden = true; return; } t.innerHTML = html; t.hidden = false;
  // immer über der Bauleiste (auch wenn eine Gruppe aufgeklappt ist), nie dahinter
  const l = $('leiste'); if (!l.hidden) t.style.bottom = `${Math.max(84, innerHeight - l.getBoundingClientRect().top + 8)}px`;
}

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
  const quellName: Partial<Record<Res, string>> = { holz: t('Bäume'), stein: t('Felsen'), kristall: t('Kristalladern'), nahrung: t('Felder'), erz: t('Erzadern') };
  const zeilen: [string, string][] = [];
  const z = (a: string, b: string) => zeilen.push([a, b]);
  const rk = s.reparaturKosten(g), kaputt = g.hp < g.max - 0.5;
  // kurze Werte in zwei Spalten
  if (Spiel.hatStufen(g.typ)) z(t('Stufe'), `${t('{a} von III', { a: t(STUFE_NAME[g.stufe]) })}`);
  if (g.typ === 'haupt') { z(t('Stufe'), `${t(HAUPT_STUFEN[g.stufe - 1].name)} (${g.stufe}/6)`); z(t('Türme'), `${s.turmZahl()} / ${s.turmGrenze()}`); }
  const zweig = d.zweige?.find((x) => x.id === g.zweig); if (zweig) z(t('Zweig'), t(zweig.name));
  const k = s.kampf(g); if (k) z(t('Reichweite · Schaden'), `${Math.round(k.reichweite)} · ${Math.round(k.schaden)}${k.flaeche ? t(' Fläche') : ''}${k.ziele && k.ziele > 1 ? ` · ${t('{a} Ziele', { a: k.ziele })}` : ''}`);
  if (d.licht > 4) z(t('Lichtkreis'), `${t('{a} Blöcke', { a: d.licht + (zweig?.licht || 0) })}`);
  const soll = s.arbeiterZahl(g), zug = s.zugeteilt(g);
  if (soll) z(t('Arbeiter'), `<span${zug < soll ? t(' style="color:var(--rot)"') : ''}>${zug} / ${soll}</span>`);
  const arbW = s.arbeit(g); if (arbW) z(`${t('{a} · je Gang', { a: quellName[arbW.res] || t('Quellen') })}`, `${g.quellen} · ${Math.round(arbW.menge * 10) / 10} ${t(RES_NAME[arbW.res])}`);
  if (d.umwandeln) z(t('Verarbeitung'), `${kostenHtml(d.umwandeln.von)} → ${d.umwandeln.menge} ${t(RES_NAME[d.umwandeln.nach])}`);
  if (g.typ === 'haus') z(t('Wohnraum'), `${[0, 4, 7, 10][g.stufe] + (s.erfindungen.has('sternenkorn') ? 2 : 0) + (s.leitsatz('volk') ? 3 : 0)}`);
  const rkr = runenkraft(g.typ, g.stufe); if (rkr && Spiel.zaehltAlsTurm(g.typ)) z(t('Runenkraft'), `${t('{a} Kristall{b}', { a: Math.ceil(rkr * s.kraftFaktor()), b: s.phase === 'nacht' && !g.kraft ? t(' · <b style="color:var(--rot)">fehlt</b>') : '' })}`);
  if (g.brand > 0) z(t('<span style="color:var(--rot)">Brennt</span>'), `${Math.ceil(g.brand)} s`);
  if (g.typ === 'haupt' && s.faehigkeiten().length) z(t('Fähigkeiten'), s.faehigkeiten().map((n) => FAEHIGKEIT_NAME[n]).join(', '));
  // laufende Arbeit
  const fort = (t: number, dauer: number, farbe: string, text: string) => `<div class="zeile"><span>${text}</span><span>${Math.round((100 * t) / dauer)} %</span></div><div class="hp"><div style="width:${Math.round((100 * t) / dauer)}%;background:${farbe}"></div></div>`;
  let werk = '';
  if (g.umbau) werk = fort(g.umbau.t, g.umbau.dauer, 'var(--ember)', g.umbau.nach === 'haupt' ? `${t('Ausbau zur {a}', { a: HAUPT_STUFEN[(g.umbau.stufe || 2) - 1].name })}` : d.bauzeit && g.umbau.nach === g.typ && !g.umbau.stufe ? `${t('Bau (nur am Tag)')}` : g.umbau.stufe ? `${t('Ausbau auf Stufe {a}', { a: t(STUFE_NAME[g.umbau.stufe]) })}` : `${t('Umbau zu {a}', { a: t(GEBAEUDE[g.umbau.nach].name) })}`);
  else if (g.rep) werk = fort(g.rep.t, g.rep.dauer, 'var(--frost)', t('Reparatur'));
  // Aktionen als knappe Knöpfe: Titel, Kosten oder Grund
  const akt: string[] = [];
  const knopf = (tat: string, titel: string, kosten: string, grund: string, tipp: string, extra = '') => akt.push(`<button type="button" class="akt" data-tat="${tat}" ${extra} title="${tipp.replace(/"/g, '&quot;')}" ${grund ? 'disabled' : ''}><b>${titel}</b><small${grund ? t(' class="grund"') : ''}>${grund || kosten}</small></button>`);
  if (!g.umbau && !g.rep && kaputt) knopf('reparieren', t('Reparieren'), kostenHtml(rk), !tag ? t('nur am Tag') : s.fehlt(rk), t('Arbeiter bessern das Gebäude aus.'));
  const o = s.stufeOption(g);
  if (o && !g.umbau) knopf('stufe', `${t('Stufe {a}', { a: t(STUFE_NAME[o.stufe]) })}`, kostenHtml(o.kosten), o.grund || '', d.arbeit || d.umwandeln ? t('Mehr Arbeiter, mehr Ertrag, größerer Umkreis.') : g.typ === 'haus' ? t('Mehr Wohnraum.') : t('Mehr Schaden, Haltbarkeit und Reichweite.'));
  if (g.typ === 'haupt' && !g.umbau) { const st = s.hauptAusbau(); if (st) { const frei = !st.braucht || s.erfindungen.has(st.braucht); knopf('ausbau', `${t('Zur {a}', { a: t(st.name) })}`, kostenHtml(st.kosten), !frei ? `${t('braucht {a}', { a: t(ERFINDUNGEN[st.braucht!].name) })}` : !tag ? t('nur am Tag') : s.fehlt(st.kosten), `${t('{a} Haltbarkeit {b}, bis zu {c} Türme, Wohnraum {d}.', { a: t(st.kurz), b: st.hp, c: st.tuerme, d: st.wohnraum })}`); } }
  if (!g.umbau) for (const nach of s.umruestOptionen(g)) {
    const nd = GEBAEUDE[nach], frei = s.freigeschaltet(nach);
    const grund = !frei ? `${t('braucht {a}', { a: t(ERFINDUNGEN[nd.braucht!].name) })}` : nd.zeitalter === 5 && g.stufe < 3 ? t('erst Stufe III') : !tag ? t('nur am Tag') : s.fehlt(nd.kosten);
    if (nd.zweige) for (const zw of nd.zweige) knopf('umr', `${t(nd.name)}: ${t(zw.name)}`, kostenHtml(nd.kosten), grund, `${t(nd.kurz)} ${t(zw.kurz)}`, `data-nach="${nach}" data-zweig="${zw.id}"`);
    else knopf('umr', t(nd.name), kostenHtml(nd.kosten), grund, t(nd.kurz), `data-nach="${nach}"`);
  }
  if (!g.umbau) s.verschmelzOptionen(g).forEach((v, i) => { const nd = GEBAEUDE[v.ergebnis]; knopf('vs', `+ ${t(GEBAEUDE[v.partner.typ].name)} → ${s.entdeckt.has(v.ergebnis) ? nd.name : '???'}`, kostenHtml(nd.kosten), !tag ? t('nur am Tag') : s.fehlt(nd.kosten), t('Verschmelzen: Zwei benachbarte Türme werden zu einem neuen.'), `data-i="${i}"`); });
  if (g.typ !== 'haupt' && g.typ !== 'werkstatt') knopf('abreissen', t('Abreißen'), t('halbe Kosten zurück'), '', t('Gebäude abreißen.'));
  const html = `<button class="schliessen" type="button" aria-label="Schließen">×</button><h2>${t(d.name)}</h2><p class="kurz">${t(d.kurz)}</p>
    <div class="zeile"><span>${t('Haltbarkeit')}</span><span>${Math.ceil(g.hp)} / ${g.max}</span></div><div class="hp"><div style="width:${(100 * g.hp) / g.max}%"></div></div>
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
  const html = `<button class="schliessen" type="button" aria-label="Schließen">×</button><h2>${t('Trümmer: {a}', { a: t(d.name) })}</h2>
    <p>${t('Hier stand {a}{b}. Wiederaufbau kostet die Hälfte, Räumen macht den Platz frei.', { a: t(d.name), b: zw ? ` (${t(zw.name)})` : '' })}</p>
    <button type="button" class="aktion" data-tat="auf" ${tag && s.kannBezahlen(k) ? '' : 'disabled'}>${t('Wiederaufbauen · {a}{b}', { a: kostenHtml(k), b: !tag ? t(' (nur am Tag)') : '' })}</button>
    <button type="button" class="aktion" data-tat="raeumen">${t('Räumen')}</button>`;
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
const ZA_NAMEN = ['', t('Holz & Runen'), t('Glut & Alchemie'), t('Uhrwerk & Dampf'), t('Blitz & Kristall'), t('Äther & Sterne')];
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
  $('baum-za').textContent = `${t('Zeitalter {a} · {b} · {c} von {d} erfunden', { a: s.zeitalter(), b: t(s.zeitalterName()), c: s.erfindungen.size, d: Object.keys(ERFINDUNGEN).length })}`;
  $('baum-bst').innerHTML = (Object.keys(BAUSTEIN_NAME) as Baustein[]).map((b) => `<span><i class="${b}"></i>${t(BAUSTEIN_NAME[b])} ${s.bausteine[b]}</span>`).join('') + `<span><i class="kristall"></i>${t('Kristall {a}', { a: Math.floor(s.res.kristall) })}</span>`;
  document.querySelectorAll<HTMLButtonElement>('[data-reiter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.reiter === baumReiter)));
  let html = '';
  if (baumReiter === 'baum') {
    const z = s.zeitalter(); if (!baumZa) baumZa = z;
    const aus = (a: number) => (a !== baumZa ? t(' z-aus') : '');
    $('baum-za-reiter').innerHTML = [1, 2, 3, 4, 5].map((a) => `<button type="button" data-za="${a}" aria-pressed="${a === baumZa}">${a}</button>`).join('');
    $('baum-za-reiter').querySelectorAll<HTMLButtonElement>('[data-za]').forEach((b) => { b.onclick = () => { baumZa = Number(b.dataset.za); baumZeichnen(true); }; });
    html = `<div class="baum-gitter"><div></div>${[1, 2, 3, 4, 5].map((a) => `<div class="zkopf${aus(a)} ${a === z ? 'jetzt' : a > z ? 'zu' : ''}">${t(ZA_NAMEN[a])}<small>${a < z ? 'erreicht' : a === z ? t('jetziges Zeitalter') : t('noch verschlossen')}</small></div>`).join('')}`;
    for (const w of Object.keys(WISSEN_NAME) as Wissen[]) {
      html += `<div class="wkopf">${t(WISSEN_NAME[w])}</div>`;
      for (const a of [1, 2, 3, 4, 5]) {
        const ids = (Object.keys(ERFINDUNGEN) as ErfId[]).filter((i) => ERFINDUNGEN[i].wissen === w && ERFINDUNGEN[i].ab === a);
        html += `<div class="zelle${aus(a)}">${ids.map((id) => {
          const e = ERFINDUNGEN[id], st = erfStatus(id);
          if (st === 'geheim') return `<button type="button" class="ekarte geheim" data-erf="${id}" aria-pressed="${baumWahl === id}"><b>???</b><span>${t('geheimes Rezept')}</span></button>`;
          const zut = Object.entries(e.zutaten).map(([b, n]) => `<span class="${st !== 'fertig' && s.bausteine[b as Baustein] < (n as number) ? 'fehlt' : ''}"><i class="${b}"></i>${n}</span>`).join('') + `<span class="${st !== 'fertig' && s.res.kristall < s.erfKristall(id) ? 'fehlt' : ''}"><i class="kristall"></i>${s.erfKristall(id)}</span>`;
          return `<button type="button" class="ekarte ${st} ${e.zeitalter ? 'schluessel' : ''}" data-erf="${id}" aria-pressed="${baumWahl === id}"><b>${e.zeitalter ? '◆ ' : ''}${t(e.name)}${st === 'fertig' ? ' ✓' : ''}</b><span class="zut">${zut}</span></button>`;
        }).join('')}</div>`;
      }
    }
    html += '</div>';
  } else if (baumReiter === 'buch') {
    const LN = { fern: t('Fernkampf'), flaeche: t('Fläche'), licht: t('Licht') };
    html = `<div class="baum-liste"><p>${t('Zwei benachbarte Türme lassen sich am Tag verschmelzen. Was einmal gelungen ist, bleibt hier vermerkt.')}</p>${VERSCHMELZUNGEN.map((v) => { const bek = s.entdeckt.has(v.ergebnis); return `<div class="zeile"><span>${LN[v.a]} + ${LN[v.b]}</span><span>${bek ? `<b>${t(GEBAEUDE[v.ergebnis].name)}</b> · ${t(GEBAEUDE[v.ergebnis].kurz)}` : '???'}</span></div>`; }).join('')}</div>`;
  } else {
    html = `<div class="baum-liste"><p>${t('Bausteine gibt es nur als Beute besiegter Wesen. Verborgene Schattenwölfe brauchen Licht, Drachlinge treffen nur Pfeile und Blitze.')}</p>${(Object.keys(BAUSTEIN_NAME) as Baustein[]).map((bs) => `<div class="zeile"><span><i class="${bs}" style="width:8px;height:8px;display:inline-block;transform:rotate(45deg);border-radius:2px;margin-right:6px"></i>${t(BAUSTEIN_NAME[bs])}</span><span>${(Object.keys(GEGNER) as (keyof typeof GEGNER)[]).filter((gt) => GEGNER[gt].beute.some(([x]) => x === bs)).map((gt) => { const bt = GEGNER[gt].beute.find(([x]) => x === bs)!; return `${t(GEGNER[gt].name)} ${Math.round(100 * bt[1])} %${bt[2] ? ` (×${bt[2]})` : ''}`; }).join(' · ')}</span></div>`).join('')}
      <p>${t('Die Wesen der Wildnis:')}</p>${(Object.keys(GEGNER) as (keyof typeof GEGNER)[]).map((gt) => `<div class="zeile"><span>${t(GEGNER[gt].name)}</span><span>${t(GEGNER[gt].kurz)}</span></div>`).join('')}</div>`;
  }
  if (neu || html !== baumHtmlAlt) {
    baumHtmlAlt = html; $('baum-inhalt').innerHTML = html;
    $('baum-inhalt').querySelectorAll<HTMLButtonElement>('[data-erf]').forEach((b) => { b.onclick = () => { baumWahl = b.dataset.erf as ErfId; baumZeichnen(); }; });
  }
  // Einzelheiten der gewählten Erfindung
  const d = $('baum-detail');
  if (!baumWahl || baumReiter !== 'baum') { d.hidden = true; return; }
  const e = ERFINDUNGEN[baumWahl], st = erfStatus(baumWahl);
  const grund = st === 'fertig' ? '' : st === 'geheim' ? t('Ein geheimes Rezept. Es zeigt sich, sobald die richtigen Bausteine beisammen sind.') : s.vorwissenFehlt(baumWahl) || (st === 'fehlt' ? t('Es fehlen noch Bausteine oder Kristall.') : '');
  const dhtml = `<h3>${st === 'geheim' ? '???' : e.name}</h3><div class="baum-za">${t(WISSEN_NAME[e.wissen])} · ${t(ZA_NAMEN[e.ab])}${e.zeitalter ? ` · ${t('Schlüssel zu {a}', { a: t(ZA_NAMEN[e.zeitalter]) })}` : ''}</div>${st === 'geheim' ? '' : `<p>${t(e.wirkung)}</p>`}${grund ? `<p class="grund">${grund}</p>` : ''}${st === 'fertig' ? '<p>Erfunden.</p>' : st === 'geheim' ? '' : `<button type="button" class="aktion" id="erfinden" ${st === 'kann' ? '' : 'disabled'}>${t('Erfinden')}</button>`}`;
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
  m.className = `${t('meldung tafel {a}', { a: ton })}`; m.textContent = text; box.prepend(m);
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
let langDruck = 0;
canvas.addEventListener('pointerdown', (e) => {
  unten = { x: e.clientX, y: e.clientY, t: performance.now() };
  // langer Druck mit dem Finger öffnet das Gebäude (auch wenn die Karte verschoben würde)
  if (e.pointerType === 'touch' && !werkzeug) { clearTimeout(langDruck); const u0 = unten; langDruck = window.setTimeout(() => { if (unten !== u0 || !spiel) return; const p = bodenPunkt(u0.x, u0.y); if (p) { const g = spiel.gebAn(p.x, p.z); if (g) { waehle(g); navigator.vibrate?.(15); unten = null; } } }, 520); }
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
    zeigeTipp(`<b>${t('Ebnen')}</b> · ${t('{a} × {b} Blöcke auf Höhe {c}{d}{e}', { a: Math.abs(b[0] - a[0]) + 1, b: Math.abs(b[1] - a[1]) + 1, c: pr.ziel, d: pr.stein ? ` · ${t('{a} Stein', { a: pr.stein })}` : '', e: !pr.ok ? `<br><span class="grund">${pr.grund}</span>` : '' })}`);
    return;
  }
  if (!spiel || !werkzeug || werkzeug.art !== 'bau') return;
  const p = bodenPunkt(e.clientX, e.clientY); if (!p) { obj?.zeigeVorschau(null); return; }
  const typ = werkzeug.typ, [x0, z0] = GEBAEUDE[typ].w === 1 ? [Math.floor(p.x), Math.floor(p.z)] : ecke(typ, p);
  const pr = spiel.pruefe(typ, x0, z0), bezahlbar = spiel.kannBezahlen(GEBAEUDE[typ].kosten);
  obj?.zeigeVorschau(typ, x0, z0, pr.ok && bezahlbar, pr.ok ? pr.y : hoehe(x0 + 0.5, z0 + 0.5));
  if (unten?.mauer) { mauerZiel = [x0, z0]; const zug = linie(unten.mauer, mauerZiel);
    // Verlauf der Mauer auf dem Boden zeigen
    obj?.zeigeLinie(zug.map(([x, z]) => { const q = spiel!.pruefe(typ, x, z); return [x, q.ok ? q.y : hoehe(x + 0.5, z + 0.5), z, q.ok] as [number, number, number, boolean]; }));
  } else obj?.zeigeLinie(null);
  if (unten?.mauer) { const n = linie(unten.mauer, mauerZiel!).length; zeigeTipp(`<b>${t(GEBAEUDE[typ].name)}</b> · ${t('{a} Blöcke · {b}', { a: n, b: kostenHtml(Object.fromEntries(Object.entries(GEBAEUDE[typ].kosten).map(([k, v]) => [k, (v as number) * n]))) })}`); }
  else zeigeTipp(`<b>${t(GEBAEUDE[typ].name)}</b> · ${kostenHtml(GEBAEUDE[typ].kosten)}${!pr.ok ? `<br><span class="grund">${pr.grund}</span>` : !bezahlbar ? t('<br><span class="grund">Nicht genug Rohstoffe.</span>') : ''}`);
});
canvas.addEventListener('pointerup', (e) => {
  const u = unten; unten = null; controls.enabled = true;
  if (!u || !spiel || e.button !== 0) return;
  if (u.ebene && mauerZiel) { if (spiel.ebnen(u.ebene[0], u.ebene[1], mauerZiel[0], mauerZiel[1])) klang.spiele('hieb_stein'); mauerZiel = null; return; }
  if (u.mauer && mauerZiel) {
    const typ = werkzeug?.art === 'bau' ? werkzeug.typ : 'mauer';
    let n = 0; for (const [x, z] of linie(u.mauer, mauerZiel)) if (spiel.bauen(typ, x, z, true)) n++;
    if (!n) melde(`${t('Hier lässt sich {a} nicht bauen.', { a: t(GEBAEUDE[typ].name) })}`, 'schlecht'); else if (!e.shiftKey) werkzeugSetzen(null);
    mauerZiel = null; obj?.zeigeLinie(null); return;
  }
  if (Math.hypot(e.clientX - u.x, e.clientY - u.y) > 6 || performance.now() - u.t > 600) return;
  const p = bodenPunkt(e.clientX, e.clientY); if (!p) return;
  if (werkzeug?.art === 'bau') { const [x0, z0] = GEBAEUDE[werkzeug.typ].w === 1 ? [Math.floor(p.x), Math.floor(p.z)] : ecke(werkzeug.typ, p); if (spiel.bauen(werkzeug.typ, x0, z0) && !e.shiftKey) werkzeugSetzen(null); return; }
  if (werkzeug?.art === 'spaeher') { if (spiel.erkundetAn(p.x, p.z)) melde(t('Hier ist schon erkundet. Klick in den Nebel.'), 'info'); else if (spiel.spaeher(p.x, p.z)) { spaeherGeschickt = true; werkzeugSetzen(null); } return; }
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
  if (berichtPause && (k === 'enter' || k === ' ' || k === 'escape')) { e.preventDefault(); $('bericht').hidden = true; berichtPause = false; return; }
  if (k === 'f1' || k === '?') { e.preventDefault(); if ($('hilfe').hidden) zeigeHilfe(); else $('hilfe').hidden = true; }
  if (k === 'escape') { $('hilfe').hidden = true; gruppeZeigen(null); werkzeugSetzen(null); waehle(null); schliessePanel(); baumZu(); $('bericht').hidden = true; }
  if (k === '9') werkzeugSetzen(werkzeug?.art === 'ebnen' ? null : { art: 'ebnen' });
  const gr = BAUGRUPPEN.find((g) => g.taste.toLowerCase() === k); if (gr) gruppeZeigen(gruppeOffen === gr.id ? null : gr.id);
  if (k === 'x') werkzeugSetzen(werkzeug?.art === 'spaeher' ? null : { art: 'spaeher' });
  if (k === 't') $('baum').hidden ? zeigeWerkstatt() : baumZu();
  if (k === 'm') karteSetzen(!einst.karte);
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
  if (!spiel || !einst.karte) return;
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
  $('res').innerHTML = (['holz', 'stein', 'kristall', 'nahrung', 'erz', 'balken', 'stahl', 'linsen'] as Res[]).filter((r) => ['holz', 'stein', 'kristall', 'nahrung'].includes(r) || s.res[r] > 0).map((r) => `<span title="${t(RES_NAME[r])}"><i class="${r}"></i>${Math.floor(s.res[r])}</span>`).join('');
  const bed = s.arbeiterBedarf(), arb = s.arbeiter.length, essen = s.essen(), rk = s.runenkraftBedarf();
  $('bewohner').innerHTML = `<span>${t('Einwohner')} <b>${s.einwohner}</b> / ${s.wohnraum()}</span><span${arb < bed ? t(' class="warn"') : ''}>${t('Arbeiter')} <b>${arb}</b> / ${bed}</span><span${s.res.nahrung < essen ? t(' class="warn"') : ''}>${t('Essen je Tag')} <b>${essen}</b></span><span>${t('Türme')} <b>${s.turmZahl()}</b> / ${s.turmGrenze()}</span><span${s.res.kristall < rk ? t(' class="warn"') : ''}>${t('Runenkraft')} <b>${rk}</b></span>`;
  $('bausteine').innerHTML = (Object.keys(BAUSTEIN_NAME) as Baustein[]).map((b) => `<span class="${s.bausteine[b] ? '' : 'null'}" title="${t(BAUSTEIN_NAME[b])}"><i class="${b}"></i>${t(BAUSTEIN_NAME[b])} ${s.bausteine[b]}</span>`).join('');
  const u = $('uhr');
  u.classList.toggle('nacht', s.phase === 'nacht');
  $('zeitalter').textContent = t(s.zeitalterName());
  if (s.phase === 'tag') {
    u.dataset.html = '';
    const rest = Math.ceil(s.restTag()), mm = Math.floor(rest / 60), ss = String(rest % 60).padStart(2, '0');
    const vorschau = s.welleVorschau().map((w) => `${w.zahl} ${w.zahl === 1 ? t(GEGNER[w.typ].name) : t(MEHRZAHL[w.typ])}`).join(' · ');
    const om = s.omenFuer(s.nacht), akt = s.akt();
    const siegelInfo = akt.nr === 4 ? ` · ${t('Risse versiegelt {a} / {b}', { a: s.versiegelt.size, b: s.alleRisse().length })}` : '';
    u.innerHTML = `<div class="akt-zeile">${t('Akt {a} · {b} · Nacht {c} von {d}{e}', { a: akt.nr, b: t(akt.name), c: s.nacht, d: ENDE_NACHT, e: siegelInfo })}</div>${om ? `<div class="omen">${t('Omen heute Nacht:')} <b>${t(OMEN[om].name)}</b> · ${t(OMEN[om].kurz)}</div>` : ''}<div class="titel">${t('Tag {a}', { a: s.nacht })}</div><div class="balken"><div style="width:${(100 * s.zeit) / TAG_DAUER}%"></div></div>
      <div class="unter">${s.abend() ? `${t('Heute Nacht: {a}', { a: vorschau })}` : `${t('Ruhig. Nacht in {a}:{b}', { a: mm, b: ss })}`}</div><div><button type="button" id="einlaeuten">${t('Nacht einläuten')}</button>${s.beschaedigt().length ? ` <button type="button" id="allerep" ${s.kannBezahlen(s.alleReparaturKosten()) ? '' : 'disabled'}>${t('Alles reparieren · {a}', { a: kostenHtml(s.alleReparaturKosten()) })}</button>` : ''}</div>`;
    $('einlaeuten').onclick = () => s.nachtEinlaeuten();
    const ar = document.getElementById('allerep'); if (ar) ar.onclick = () => { if (s.alleReparieren()) klang.spiele('bau', 0.8); };
  } else if (s.phase === 'nacht') {
    const f = s.faehigkeiten();
    const om = s.omenFuer(s.nacht);
    const html = `<div class="akt-zeile">${t('Akt {a} · {b}', { a: s.akt().nr, b: t(s.akt().name) })}</div>${om ? `<div class="omen"><b>${t(OMEN[om].name)}</b></div>` : ''}<div class="titel">${t('Nacht {a}', { a: s.nacht })}</div><div class="unter">${t('Die Welle kommt · {a} Wesen unterwegs', { a: s.gegner.length })}</div>${f.length ? `<div class="faehig">${f.map((n) => `<button type="button" data-faehig="${n}" ${s.faehigkeitFrei(n) ? '' : 'disabled'}>${t(FAEHIGKEIT_NAME[n])}</button>`).join(' ')}</div>` : ''}`;
    if (u.dataset.html !== html) {
      u.dataset.html = html; u.innerHTML = html;
      u.querySelectorAll<HTMLButtonElement>('[data-faehig]').forEach((b) => { b.onclick = () => { const n = b.dataset.faehig!; if (n === 'feuerregen') werkzeugSetzen({ art: 'feuerregen' }); else if (s.faehigkeit(n)) klang.spiele('glocke', 0.8); }; });
    }
  } else if (s.phase === 'morgen') u.dataset.html = '', u.innerHTML = `<div class="titel">${t('Morgen')}</div><div class="unter">${t('Die Nacht ist überstanden')}</div>`;
  leisteAktualisieren(); einfuehrung();
  document.body.classList.toggle('panel-offen', !$('panel').hidden);
  if (s.leitsatzOffen && $('leitsatz').hidden && s.phase === 'tag' && !document.getElementById('leit-hinweis')) $('meldungen').insertAdjacentHTML('afterbegin', t('<button type="button" class="meldung tafel info" id="leit-hinweis">Ein Leitsatz wartet auf deine Wahl. Hier klicken.</button>'));
  const lh = document.getElementById('leit-hinweis'); if (lh) { if (!s.leitsatzOffen) lh.remove(); else lh.onclick = () => { lh.remove(); zeigeLeitsatz(); }; }
  if (panelArt === 'geb' && gewaehlt) { if (!s.gebaeude.includes(gewaehlt)) waehle(null); else panelGeb(); }
  if (panelArt === 'ruine') panelRuine();
  baumZeichnen();
  if (werkzeug?.art === 'feuerregen' && s.phase !== 'nacht') werkzeugSetzen(null);
}

// ================= Einführung =================
const SCHRITTE: { text: () => string; fertig: (s: Spiel) => boolean }[] = [
  { text: () => t('Stelle einen zweiten <b>Wachturm</b> an den Pfad (Taste 1 oder Bauleiste <b>Abwehr</b>). Der Pfad zeigt, woher die Wesen kommen.'), fertig: (s) => s.gebaeude.filter((g) => g.typ === 'wachturm').length >= 2 },
  { text: () => t('Mach Licht vor dem Tor: ein <b>Fackelmast</b> (Taste 3). Im Licht treffen Türme nachts weiter und besser.'), fertig: (s) => s.gebaeude.some((g) => g.typ === 'fackel') },
  { text: () => t('Deine Feste braucht Leute: Baue ein zweites <b>Wohnhaus</b> (Bauleiste <b>Dorf</b>). Wer Platz und Nahrung hat, zieht zu.'), fertig: (s) => s.gebaeude.filter((g) => g.typ === 'haus').length >= 2 },
  { text: () => t('Mehr Leute essen mehr: Ein zweiter <b>Bauernhof</b> (Taste H) sorgt für Nahrung. Oben siehst du Einwohner, Arbeiter und das Essen je Tag.'), fertig: (s) => s.gebaeude.filter((g) => g.typ === 'hof').length >= 2 },
  { text: () => t('Schicke einen <b>Späher</b> in den Nebel (Taste X) und klicke an den Rand des Erkundeten.'), fertig: () => spaeherGeschickt },
  { text: () => t('Bereit? <b>Nacht einläuten</b> (Taste N). Die leuchtende Linie zeigt den Weg der Welle. Am Morgen wartet der Bericht, bis du ihn bestätigst.'), fertig: (s) => s.phase !== 'tag' || s.nacht > 1 },
  { text: () => t('Wesen lassen Bausteine fallen. Öffne den <b>Erfindungsbaum</b> (Taste T) und erfinde etwas, zum Beispiel Steinmetzkunst.'), fertig: (s) => s.erfindungen.size >= 1 || s.nacht > 4 },
  { text: () => t('Goldene Pfeile zeigen, was sich verbessern lässt. Klicke ein Gebäude an und baue es auf <b>Stufe II</b> aus. Mit F1 öffnest du jederzeit die Hilfe.'), fertig: (s) => s.gebaeude.some((g) => g.stufe > 1) || s.nacht > 6 }
];
function einfuehrung(): void {
  const el = $('einfuehrung'); if (!spiel || einfuehrungSchritt < 0) { el.hidden = true; return; }
  while (einfuehrungSchritt < SCHRITTE.length && SCHRITTE[einfuehrungSchritt].fertig(spiel)) einfuehrungSchritt++;
  if (einfuehrungSchritt >= SCHRITTE.length) { einfuehrungSchritt = -1; el.hidden = true; return; }
  if (einfuehrungSchritt >= 6 && spiel.nacht < 2) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<div class="schritt">${t('Einführung {a} / {b}', { a: einfuehrungSchritt + 1, b: SCHRITTE.length })}</div><p>${SCHRITTE[einfuehrungSchritt].text()}</p><button type="button" id="ueberspringen">${t('Einführung ausblenden')}</button>`;
  $('ueberspringen').onclick = () => { einfuehrungSchritt = -1; einst.einfuehrung = false; einstSpeichern(); el.hidden = true; };
}
// ================= Einstellungen =================
function zeigeEinstellungen(): void {
  panelArt = 'einst'; const p = $('panel');
  p.innerHTML = `<button class="schliessen" type="button" aria-label="Schließen">×</button><h2>${t('Einstellungen')}</h2>
    <label class="regler">${t('Musik')} <input type="range" id="e-musik" min="0" max="1" step="0.05" value="${einst.musik}"></label>
    <label class="regler">${t('Klänge')} <input type="range" id="e-effekte" min="0" max="1" step="0.05" value="${einst.effekte}"></label>
    ${grafikHtml()}
    <h3 style="margin:6px 0 0;font-family:var(--display);color:var(--ember)">${t('Spielstand speichern')}</h3>
    ${plaetze().map((pl, i) => `<button type="button" class="aktion" data-platz="${i}">${t('Platz {a}{b}', { a: i + 1, b: pl ? ` · ${t('überschreibt {a}', { a: t(pl.name) })}` : t(' · leer') })}</button>`).join('')}
    <button type="button" class="aktion" id="e-einf">${t('Einführung neu zeigen')}</button>
    <button type="button" class="aktion" id="e-menue">${t('Speichern und zum Menü')}</button>`;
  p.hidden = false;
  p.querySelector<HTMLButtonElement>('.schliessen')!.onclick = schliessePanel;
  const m = $<HTMLInputElement>('e-musik'), f = $<HTMLInputElement>('e-effekte');
  m.oninput = f.oninput = () => { einst.musik = Number(m.value); einst.effekte = Number(f.value); klang.setzeLautstaerke(einst.musik, einst.effekte); einstSpeichern(); };
  grafikVerbinden(p, zeigeEinstellungen);
  p.querySelectorAll<HTMLButtonElement>('[data-platz]').forEach((b) => { b.onclick = () => { if (platzSpeichern(Number(b.dataset.platz))) zeigeEinstellungen(); }; });
  $('e-einf').onclick = () => { einst.einfuehrung = true; einstSpeichern(); einfuehrungSchritt = 0; schliessePanel(); einfuehrung(); };
  $('e-menue').onclick = () => { speichern(); schliessePanel(); zeigeStart(); };
}

// ================= Akte, Leitsätze, Abspann =================
function zeigeAkt(nr: number): void {
  const a = AKTE[nr - 1], el = $('akt');
  el.innerHTML = `<div class="akt-nr">${t('Akt {a}', { a: ['I', 'II', 'III', 'IV'][nr - 1] })}</div><h2>${t(a.name)}</h2><p>${t(a.text)}</p>`;
  el.hidden = false; el.classList.remove('weg'); void el.offsetWidth; el.classList.add('zeigen');
  klang.spiele('horn', 0.7);
  setTimeout(() => { el.classList.add('weg'); setTimeout(() => { el.hidden = true; el.classList.remove('zeigen', 'weg'); }, 1200); }, 6500);
}
function zeigeLeitsatz(): void {
  const s = spiel; if (!s || !s.leitsatzOffen) return;
  const z = s.leitsatzOffen, el = $('leitsatz');
  el.innerHTML = `<div class="akt-nr">${t('Neues Zeitalter · {a}', { a: t(ZA_NAMEN[z]) })}</div><h2>${t('Wähle einen Leitsatz')}</h2><p>${t('Die Wahl gilt für den Rest der Partie.')}</p>
    <div class="leit-wahl">${LEITSAETZE[z].map((l) => `<button type="button" data-leit="${l.id}"><b>${t(l.name)}</b><span>${t(l.kurz)}</span></button>`).join('')}</div>
    <button type="button" class="spaeter" id="leit-spaeter">${t('Später entscheiden')}</button>`;
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
    <div class="akt-nr">${s.sieg.versiegelt ? t('Alle Risse sind versiegelt') : t('Die letzte Nacht ist überstanden')}</div>
    <h1 class="titel">${t('rune')}<b>${t('BOOM')}</b></h1>
    <p class="sieg-text">${s.sieg.versiegelt ? `${t('Nach {a} Nächten ist die Wildnis gebannt. Die Feste der {b} wird in Liedern weiterleben.', { a: s.sieg.nacht, b: t(VOELKER[s.volk].name) })}` : `${t('Vierzig Nächte hat die Feste der {a} gehalten. {b} von {c} Rissen sind versiegelt.', { a: t(VOELKER[s.volk].name), b: s.versiegelt.size, c: s.alleRisse().length })}`}</p>
    <div class="stat">${zeile(t('Weltcode'), s.code)}${zeile(t('Volk · Schwierigkeit'), `${t(VOELKER[s.volk].name)} · ${t(SCHWIERIGKEIT[s.schwierigkeit].name)}`)}${zeile(t('Überstandene Nächte'), s.sieg.nacht)}${zeile(t('Besiegte Wesen'), s.besiegt)}${zeile(t('Gefallene Rissfürsten'), st.bosse)}${zeile(t('Erfindungen'), `${t('{a} von {b}', { a: s.erfindungen.size, b: Object.keys(ERFINDUNGEN).length })}`)}${zeile(t('Zeitalter'), ZA_NAMEN[s.zeitalter()])}${zeile(t('Meiste Einwohner'), st.maxEinwohner)}${zeile(t('Gebäude gebaut'), st.gebaut)}${zeile(t('Verlorene Gebäude'), st.zerstoert)}${zeile(t('Wunder'), st.wunder.join(', ') || 'keines')}${zeile(t('Versiegelte Risse'), `${s.versiegelt.size} / ${s.alleRisse().length}`)}</div>
    <div class="rolle"><div class="rolle-inhalt">
      <p><b>${t('runeBOOM · Die Feste der Erfinder')}</b></p><p>${t('Ein Spiel aus der Familie von overBOOM')}</p>
      <p>${t('Idee und Spielleitung')}<br><b>${t('HOAI-droid')}</b></p><p>${t('Welten, Wesen und Voxel')}<br>${t('prozedural aus deinem Weltcode')}</p>
      <p>${t('Musik und Klänge')}<br>${t('live im Browser erzeugt')}</p><p>${t('Danke fürs Spielen!')}</p></div></div>
    <div class="reihe"><button type="button" class="knopf haupt" id="sieg-menue">${t('Zum Hauptmenü')}</button><button type="button" class="knopf" id="sieg-neu">${t('Neue Welt')}</button></div></div>`;
  el.hidden = false; $('hud').hidden = true;
  $('sieg-menue').onclick = () => { imAbspann = false; el.hidden = true; zeigeStart(); };
  $('sieg-neu').onclick = () => { imAbspann = false; el.hidden = true; zeigeStart(); seite('neu'); };
}

// ================= Hilfe (F1) =================
function zeigeHilfe(): void {
  const el = $('hilfe');
  const karte = (titel: string, text: string) => `<div class="hkarte"><h3>${titel}</h3><p>${text}</p></div>`;
  el.innerHTML = `<div class="hilfe-kopf"><h2>${t('Hilfe')}</h2><button type="button" class="schliessen" id="hilfe-zu" aria-label="${t('Schließen')}">×</button></div>
    <div class="hilfe-gitter">
      ${karte(t('Tag und Nacht'), t('Am Tag ist es ruhig: bauen, sammeln, erfinden. Mit „Nacht einläuten“ kürzt du den Tag ab und bekommst etwas Kristall. In der Nacht kommt die Welle aus den Rissen. Am Morgen zeigt der Bericht, was geschah; das Spiel wartet, bis du ihn bestätigst.'))}
      ${karte(t('Rohstoffe'), t('Holzfäller, Steinbruch und Kristallmine sammeln im Umkreis. Erzmine, Sägewerk, Schmelze und Schleiferei veredeln zu Roherz, Balken, Stahl und Linsen. Rohstoffgebäude brauchen die Burg oder einen Außenposten in der Nähe.'))}
      ${karte(t('Bevölkerung'), t('Wohnhäuser geben Wohnraum, Höfe und Fischer Nahrung. Jeden Morgen essen alle; mit Vorrat und Platz zieht die Feste neue Leute an. Arbeitsgebäude brauchen Arbeiter aus der Bevölkerung.'))}
      ${karte(t('Licht'), t('Nachts sieht man ohne Licht nur Umrisse. Im Licht treffen Türme weiter und öfter. Leuchtfeuer und höhere Lichter machen verborgene Schattenwölfe sichtbar.'))}
      ${karte(t('Runenkraft und Turmgrenze'), t('Jeder Turm verbraucht in der Nacht Kristall. Fehlt er, feuern die äußeren Türme nur halb so schnell. Wie viele Türme erlaubt sind, bestimmt die Stufe der Burg.'))}
      ${karte(t('Erfinden'), t('Wesen lassen Bausteine fallen. Im Erfindungsbaum (T) werden daraus Erfindungen. Schlüsselerfindungen öffnen ein neues Zeitalter und brauchen Vorwissen. Bei jedem neuen Zeitalter wählst du einen Leitsatz.'))}
      ${karte(t('Ausbauen'), t('Klicke ein Gebäude an: Stufe II und III, Umrüsten mit zwei Zweigen, Verschmelzen mit dem Nachbarturm, Reparieren. Goldene Pfeile zeigen, was gerade geht. Je Zeitalter gibt es ein Wunder aus zweien.'))}
      ${karte(t('Die Partie'), t('40 Nächte in vier Akten. Alle fünf Nächte kommt ein Rissfürst, Omen kündigen besondere Nächte an. In Akt IV versiegeln Siegelsteine die Risse: Sind alle versiegelt oder ist die 40. Nacht überstanden, ist die Partie gewonnen.'))}
      ${karte(t('Tasten'), t('Ziehen: verschieben · Rad: zoomen · rechte Maustaste: drehen · Z R V B: Bauleiste · T: Erfindungsbaum · X: Späher · 9: Ebnen · N: Nacht · Leertaste: Pause · Umschalt + Klick: Auswahl behalten · F1: Hilfe'))}
    </div>`;
  el.hidden = false;
  $('hilfe-zu').onclick = () => { el.hidden = true; };
}

// ================= Bericht der Nacht =================
function zeigeBericht(b: import('@runeboom/core').Nachtbericht): void {
  const el = $('bericht');
  el.innerHTML = `<h2>${t('Bericht der {a}. Nacht', { a: b.nacht })}</h2>
    <div class="zeile"><span>${t('Besiegte Wesen')}</span><span>${b.besiegt}</span></div>
    <div class="zeile"><span>${t('Beute')}</span><span>${b.beute}</span></div>
    <div class="zeile"><span>${t('Schaden an Gebäuden')}</span><span>${b.schaden}</span></div>
    ${b.zerstoert.length ? `<div class="zeile"><span>${t('Zerstört')}</span><span style="color:var(--rot)">${[...new Set(b.zerstoert)].map((n) => `${b.zerstoert.filter((x) => x === n).length}× ${n}`).join(', ')}</span></div>` : ''}
    ${b.kraftFehlt ? `<div class="zeile"><span>${t('Runenkraft')}</span><span style="color:var(--rot)">${t('{a} Kristall fehlten', { a: b.kraftFehlt })}</span></div>` : ''}
    ${b.tuerme.length ? `<div class="zeile"><span>${t('Beste Türme')}</span><span></span></div><ol>${b.tuerme.map((tu) => `<li>${t('{a} · {b} Schaden', { a: t(tu.name), b: tu.schaden })}</li>`).join('')}</ol>` : ''}
    <button type="button" id="bericht-zu">${t('Weiter')}</button>`;
  el.hidden = false;
  berichtPause = true;
  $('bericht-zu').onclick = () => { el.hidden = true; berichtPause = false; };
}

// ================= Hauptschleife =================
let letzte = performance.now();
/** Messwerte: Bildrate, Rechenzeit von Spiel und Grafik, Zeichenaufrufe, Dreiecke */
const mess = { zeit: 0, bilder: 0, spiel: 0, bild: 0, aufrufe: 0, dreiecke: 0, letzt: { fps: 0, ms: 0, spiel: 0, bild: 0, aufrufe: 0, dreiecke: 0 } };
renderer.info.autoReset = false;
const zahl = (v: number, st = 1) => v.toLocaleString(sprache(), { maximumFractionDigits: st, minimumFractionDigits: st });
function messAnzeige(roh: number): void {
  mess.bilder++; mess.zeit += roh; mess.aufrufe += (renderer.info.render as { drawCalls?: number }).drawCalls ?? renderer.info.render.calls; mess.dreiecke += renderer.info.render.triangles;
  if (mess.zeit < 0.5) return;
  const n = mess.bilder, l = mess.letzt;
  Object.assign(l, { fps: n / mess.zeit, ms: (mess.zeit * 1000) / n, spiel: mess.spiel / n, bild: mess.bild / n, aufrufe: mess.aufrufe / n, dreiecke: mess.dreiecke / n });
  Object.assign(mess, { zeit: 0, bilder: 0, spiel: 0, bild: 0, aufrufe: 0, dreiecke: 0 });
  if (!einst.fps) return;
  $('fps').innerHTML = `<b>${Math.round(l.fps)} ${t('Bilder/s')}</b> · ${zahl(l.ms)} ms · ${gpuWeg()}<br>${t('Spiel')} ${zahl(l.spiel)} ms · ${t('Grafik')} ${zahl(l.bild)} ms<br>${Math.round(l.aufrufe)} ${t('Zeichenaufrufe')} · ${zahl(l.dreiecke / 1e6, 2)} ${t('Mio. Dreiecke')} · ${t('Auflösung')} ${Math.round(aufl.faktor * 100)} %`;
}
let schattenBild = 0; const schattenZiel = new THREE.Vector3(), schattenKamera = new THREE.Vector3();
/** Schatten nur jedes zweite Bild neu, außer die Kamera bewegt sich (sonst wandern sie sichtbar) */
function schattenPlanen(): void {
  const bewegt = schattenZiel.distanceToSquared(controls.target) > 1e-4 || schattenKamera.distanceToSquared(camera.position) > 1e-4;
  schattenZiel.copy(controls.target); schattenKamera.copy(camera.position);
  licht.sun.shadow.needsUpdate = bewegt || einst.grafik === 'hoch' && !!(++schattenBild & 1) || einst.grafik !== 'hoch' && schattenBild++ % 3 === 0;
}
licht.sun.shadow.autoUpdate = false;
function zeichnen(): void {
  const t0 = performance.now(); schattenPlanen();
  welt?.messSichtbar(!messAus.has('nebel'), !messAus.has('wald'), !messAus.has('kacheln'));
  const schatten = !messAus.has('schatten'); if (licht.sun.castShadow !== schatten) licht.sun.castShadow = schatten;
  if (einst.grafik === 'niedrig' || messAus.has('nach')) { renderer.toneMappingExposure = licht.werte.exp; renderer.render(scene, camera); } else post.render();
  mess.bild += performance.now() - t0;
}
renderer.setAnimationLoop(() => {
  const jetzt = performance.now(), roh = (jetzt - letzte) / 1000, dt = Math.min(0.1, roh); letzte = jetzt;
  messAnzeige(roh); renderer.info.reset(); auflSchritt(roh);
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
      zeichnen();
      return;
    }
    akku += (enth.aktiv && enth.phase === 0) || berichtPause ? 0 : dt * tempo; let n = 0; const ts = performance.now();
    // Ein Fehler in einem Takt darf nie das ganze Spiel anhalten: melden, weiterlaufen
    while (akku >= DT && n < 12) {
      try { spiel.schritt(); } catch (err) { console.error(err); if (performance.now() - fehlerGemeldet > 10000) { fehlerGemeldet = performance.now(); melde(t('Ein Fehler im Spielablauf wurde abgefangen. Das Spiel läuft weiter.'), 'schlecht'); } }
      akku -= DT; n++;
    }
    if (n >= 12) akku = 0;
    mess.spiel += performance.now() - ts;
    const ev = spiel.ereignisse.splice(0);
    let lichtNeu = false;
    for (const e of ev) {
      if (e.art === 'gebaut' || e.art === 'weg' || e.art === 'umgebaut') lichtNeu = true;
      if (e.art === 'umgebaut' && e.geb.typ !== 'mauer' && !GEBAEUDE[e.geb.typ].falle) klang.spiele('glocke', naehe(e.geb.x, e.geb.z) * 0.5);
      if (e.art === 'blitz') klang.spiele('blitz', naehe(e.punkte[0][0], e.punkte[0][2]) * 0.6);
      if (e.art === 'feuer') klang.spiele('feuer', naehe(e.x, e.z) * 0.5);
      if (e.art === 'brand') klang.spiele('feuer', naehe(e.geb.x, e.geb.z) * 0.6);
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
      if (e.art === 'versiegelt') klang.spiele('siegel', 1);
      if (e.art === 'sternschnuppe') klang.spiele('abgeliefert', naehe(e.x, e.z) * 0.5);
      if (e.art === 'falle') klang.spiele('falle', naehe(e.x, e.z));
      if (e.art === 'umgebaut' && GEBAEUDE[e.geb.typ].wunder && !e.geb.umbau) klang.spiele('wunder', 1);
      if (e.art === 'phase' && e.phase === 'nacht' && spiel.omenFuer(spiel.nacht)) klang.spiele('omen', 0.9);
      if (e.art === 'phase' && e.phase === 'nacht' && spiel.nacht % 5 === 0) setTimeout(() => klang.spiele('boss', 1), 9000);
      if (e.art === 'phase' && e.phase === 'gewonnen') { try { localStorage.removeItem(SPEICHER); } catch { /* */ } setTimeout(zeigeAbspann, 2500); }
      if (e.art === 'riss') klang.spiele('horn', 0.9);
      if (e.art === 'phase' && e.phase === 'tag') speichern();
      if (e.art === 'phase' && e.phase === 'verloren') { obj.einsturz(); sturzKamera = 0; klang.spiele('einsturz', 1); setTimeout(() => klang.spiele('einsturz', 0.9), 900); setTimeout(() => klang.spiele('explosion', 0.7), 2200); setTimeout(() => klang.spiele('einsturz', 1), 3300); }
      if (e.art === 'phase' && e.phase === 'verloren') { $('ende-text').textContent = `${t('Nach {a} überstandenen Nächten und {b} besiegten Wesen hat die Welt {c} gesiegt. Mit demselben Weltcode lässt sich genau diese Welt noch einmal versuchen.', { a: spiel.nacht - 1, b: spiel.besiegt, c: spiel.code })}`; setTimeout(() => { $('ende').hidden = false; }, 5600); try { localStorage.removeItem(SPEICHER); } catch { /* */ } }
    }
    obj.ereignisse(ev);
    kegelZeit -= dt;
    let kegelNeu = false;
    if (!lichtNeu && kegelZeit <= 0) { kegelZeit = 0.2; kegelNeu = anzeigeDunkel > 0.3 || kegelWarAn; kegelWarAn = anzeigeDunkel > 0.3; }
    if (lichtNeu || kegelNeu) lichtkarteSetzen(spiel.lichtquellen(), lichtNeu, anzeigeDunkel > 0.3);
    anzeigeDunkel += (spiel.dunkel() - anzeigeDunkel) * Math.min(1, dt * 1.5);
    licht.setze(anzeigeDunkel); post.setze(licht); welt.nebelFarbe(licht.werte.nebel);
    const wegStaerke = spiel.phase === 'tag' ? (spiel.abend() ? 1 : werkzeug ? 0.6 : 0.3) : 0;
    obj.bild(tempo ? dt * Math.min(tempo, 2) : 0, (x, z) => spiel!.licht(x, z), anzeigeDunkel > 0.5, camera, wegStaerke);
    { const h = spiel.haupt; let nah = 0; if (h) for (const g of spiel.gegner) if (Math.hypot(g.x - h.x - 6, g.z - h.z - 6) < 45) nah++; klang.stimmung(spiel.phase === 'nacht', nah / 25); }
    if (imAbspann) menueKamera(dt);
    else if (obj.sturzZeit >= 0 && obj.sturzZeit < 6 && spiel.haupt) { // Fall der Feste: langsam um die Burg, leichtes Beben
      const h = spiel.haupt, ziel = new THREE.Vector3(h.x + h.w / 2, h.y + 6, h.z + h.d / 2), tg = controls.target;
      tg.lerp(ziel, Math.min(1, dt * 1.5)); sturzKamera += dt;
      const off = camera.position.clone().sub(tg); off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.22);
      const soll = THREE.MathUtils.clamp(off.length() - dt * 6, 70, 400); off.setLength(soll);
      camera.position.copy(tg).add(off);
      if (obj.sturzZeit < 4.2) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35, 0));
      camera.lookAt(tg);
    } else { tastenBewegung(dt); controls.update(); }
    const tg = controls.target, cx = THREE.MathUtils.clamp(tg.x, -WR + 20, WR - 20), cz = THREE.MathUtils.clamp(tg.z, -WR + 20, WR - 20);
    if (cx !== tg.x || cz !== tg.z) { const d = new THREE.Vector3(cx - tg.x, 0, cz - tg.z); tg.add(d); camera.position.add(d); }
    const dist = camera.position.distanceTo(tg);
    licht.fog.far = 360 + dist * 2.4; licht.fog.near = licht.fog.far * 0.45;
    licht.folge(tg, camera);
    planZeit -= dt; if (planZeit <= 0) { welt.planen(tg, dist, camera); planZeit = 0.25; }
    uiZeit -= dt; if (uiZeit <= 0) { anzeige(); zeichneKarte(); uiZeit = 0.15; }
  } else controls.update();
  zeichnen();
});

/** Übersichtskarte ein- und ausblenden (gemerkt) */
function karteSetzen(an: boolean): void {
  einst.karte = an; einstSpeichern();
  $('karte').hidden = !an; document.body.classList.toggle('karte-an', an); $('karte-knopf').setAttribute('aria-pressed', String(an));
  if (an) zeichneKarte();
}
$('karte-knopf').onclick = () => karteSetzen(!einst.karte);

// ================= Start (am Ende, wenn alles definiert ist) =================
karteSetzen(einst.karte);
$('fps').hidden = !einst.fps;
uebersetzeStatisch();
zeigeStart();
