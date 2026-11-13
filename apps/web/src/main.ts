import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import {
  Spiel, DT, B, WR, CH, EBNEN_STEIN, hoeheGeaendert, GEBAEUDE, BAULEISTE, ERFINDUNGEN, BAUSTEIN_NAME, GEGNER, TAG_DAUER, hoehe, neuerWeltcode,
  type GebTyp, type Geb, type Res, type Baustein, type ErfId, type Spielstand
} from '@runeboom/core';
import { neuerRenderer, Beleuchtung, Nachbearbeitung, WeltAnsicht, Objekte, lichtkarteSetzen, ZEIT } from '@runeboom/render';
import { Klang } from './klang.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SPEICHER = 'runeboom-spielstand-1';
const RES_NAME: Record<Res, string> = { holz: 'Holz', stein: 'Stein', kristall: 'Kristall' };
const MEHRZAHL: Record<string, string> = { moorwicht: 'Moorwichte', wolf: 'Schattenwölfe', troll: 'Steintrolle', drachling: 'Drachlinge' };
const kostenHtml = (k: Partial<Record<Res, number>>) => Object.entries(k).map(([r, n]) => `${n} ${RES_NAME[r as Res]}`).join(' · ');

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
let tempo = 1, werkzeug: { art: 'bau'; typ: GebTyp } | { art: 'spaeher' } | { art: 'ebnen' } | null = null, gewaehlt: Geb | null = null;
let anzeigeDunkel = 0, akku = 0, planZeit = 0, uiZeit = 0;
let panelArt: 'geb' | 'werkstatt' | 'einst' | null = null;
let einfuehrungSchritt = -1, spaeherGeschickt = false;

function starte(code: string, stand?: Spielstand): void {
  aufraeumen();
  $('laden').hidden = false; klang.start();
  spiel = new Spiel(code, stand);
  welt = new WeltAnsicht(scene, spiel.seed, spiel.erkundet);
  const sp = spiel, wa = welt;
  welt.aenderungen = (cx, cz) => sp.dekoAenderungen(cx, cz, CH);
  welt.hoehen = (cx, cz) => { const out: [number, number, number][] = []; for (let x = cx * CH - 2; x < cx * CH + CH + 2; x++) for (let z = cz * CH - 2; z < cz * CH + CH + 2; z++) { const h = hoeheGeaendert(x, z); if (h !== undefined) out.push([x, z, h]); } return out; };
  welt.onUebersicht = () => { zeichneKartenGrund(); $('laden').hidden = true; for (const k of [...sp.gefaellt.keys(), ...sp.abgebaut.keys()]) { const x = Math.floor(k / 2048) - 600, z = (k % 2048) - 600; wa.grobDeko(x, z, !sp.dekoZustand(x, z)); } };
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
function aufraeumen(): void { obj?.ende(); welt?.ende(); obj = null; welt = null; spiel = null; }
function speichern(): void { if (!spiel || spiel.phase === 'verloren' || spiel.phase === 'nacht') return; try { localStorage.setItem(SPEICHER, JSON.stringify(spiel.speichern())); } catch { /* Speicher nicht verfügbar */ } }
function geladen(): Spielstand | null { try { const s = localStorage.getItem(SPEICHER); return s ? JSON.parse(s) : null; } catch { return null; } }

// ================= Startmenü =================
const codeFeld = $<HTMLInputElement>('code');
codeFeld.value = neuerWeltcode();
$('wuerfeln').onclick = () => { codeFeld.value = neuerWeltcode(); };
$('neu').onclick = () => starte(codeFeld.value.trim().toUpperCase() || neuerWeltcode());
function zeigeStart(): void {
  aufraeumen(); $('hud').hidden = true; $('ende').hidden = true; $('start').hidden = false;
  const s = geladen(); const w = $('weiter');
  if (s && s.phase !== 'verloren') { w.hidden = false; w.textContent = `Fortsetzen · Tag ${s.nacht} · ${s.code}`; w.onclick = () => starte(s.code, s); } else w.hidden = true;
}
$('zummenue').onclick = zeigeStart;
$('nochmal').onclick = () => { const c = $('weltcode').textContent || neuerWeltcode(); starte(c); };
$('menue').onclick = () => (panelArt === 'einst' ? schliessePanel() : zeigeEinstellungen());
zeigeStart();
// für Tests und Neugierige in der Konsole
(window as unknown as { runeboom: unknown }).runeboom = { get spiel() { return spiel; }, camera, controls };

// ================= Bauleiste =================
function baueLeiste(): void {
  const l = $('leiste'); l.innerHTML = '';
  for (const typ of BAULEISTE) {
    const d = GEBAEUDE[typ], b = document.createElement('button');
    b.type = 'button'; b.className = 'bau'; b.dataset.typ = typ;
    b.innerHTML = `<kbd>${d.taste}</kbd><b>${d.name}</b><span class="preis">${kostenHtml(d.kosten)}</span>`;
    b.onclick = () => werkzeugSetzen(werkzeug?.art === 'bau' && werkzeug.typ === typ ? null : { art: 'bau', typ });
    b.onmouseenter = () => zeigeTipp(`<b>${d.name}</b> · ${d.kurz}${d.braucht && !spiel?.erfindungen.has(d.braucht) ? `<br><span class="grund">Braucht die Erfindung ${ERFINDUNGEN[d.braucht].name}.</span>` : ''}`);
    b.onmouseleave = () => zeigeTipp(null);
    l.appendChild(b);
  }
  l.insertAdjacentHTML('beforeend', '<div class="trenner"></div>');
  const sp = document.createElement('button'); sp.type = 'button'; sp.className = 'bau sonder'; sp.dataset.typ = 'spaeher';
  sp.innerHTML = '<kbd>X</kbd><b>Späher</b><span class="preis">15 Holz</span>';
  sp.onclick = () => werkzeugSetzen(werkzeug?.art === 'spaeher' ? null : { art: 'spaeher' });
  sp.onmouseenter = () => zeigeTipp('<b>Späher</b> · Klick in den Nebel am Rand des Erkundeten deckt die Gegend auf.'); sp.onmouseleave = () => zeigeTipp(null);
  const ws = document.createElement('button'); ws.type = 'button'; ws.className = 'bau sonder';
  ws.innerHTML = '<kbd>T</kbd><b>Werkstatt</b><span class="preis">Erfindungen</span>';
  ws.onclick = () => (panelArt === 'werkstatt' ? schliessePanel() : zeigeWerkstatt());
  const eb = document.createElement('button'); eb.type = 'button'; eb.className = 'bau sonder'; eb.dataset.typ = 'ebnen';
  eb.innerHTML = `<kbd>9</kbd><b>Ebnen</b><span class="preis">${EBNEN_STEIN} Stein je Stufe</span>`;
  eb.onclick = () => werkzeugSetzen(werkzeug?.art === 'ebnen' ? null : { art: 'ebnen' });
  eb.onmouseenter = () => zeigeTipp('<b>Gelände ebnen</b> · Ziehe eine Fläche auf. Sie bekommt die Höhe des ersten Blocks. Bäume und Felsen darauf verschwinden.'); eb.onmouseleave = () => zeigeTipp(null);
  l.append(sp, eb, ws);
}
function leisteAktualisieren(): void {
  if (!spiel) return;
  for (const b of $('leiste').querySelectorAll<HTMLButtonElement>('.bau')) {
    const typ = b.dataset.typ as GebTyp | 'spaeher' | 'ebnen' | undefined; if (!typ) continue;
    const aktiv = typ === 'spaeher' || typ === 'ebnen' ? werkzeug?.art === typ : werkzeug?.art === 'bau' && werkzeug.typ === typ;
    b.setAttribute('aria-pressed', String(!!aktiv));
    if (typ === 'ebnen') continue;
    if (typ === 'spaeher') { b.classList.toggle('teuer', spiel.res.holz < 15); continue; }
    b.classList.toggle('gesperrt', !spiel.freigeschaltet(typ));
    b.classList.toggle('teuer', !spiel.kannBezahlen(GEBAEUDE[typ].kosten));
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
  canvas.style.cursor = werkzeug ? 'crosshair' : '';
  leisteAktualisieren();
}
function zeigeTipp(html: string | null): void { const t = $('tipp'); if (!html) { t.hidden = true; return; } t.innerHTML = html; t.hidden = false; }

// ================= Auswahl und Werkstatt =================
function schliessePanel(): void { $('panel').hidden = true; panelArt = null; }
function waehle(g: Geb | null): void {
  gewaehlt = g; obj?.waehle(g);
  if (!g) { if (panelArt === 'geb') schliessePanel(); return; }
  if (g.typ === 'werkstatt') { zeigeWerkstatt(); return; }
  panelArt = 'geb'; panelGeb();
}
function panelGeb(): void {
  const g = gewaehlt; if (!g || !spiel) return;
  const d = GEBAEUDE[g.typ], p = $('panel');
  const quellName = { holz: 'Bäume', stein: 'Felsen und Fels', kristall: 'Kristalladern' } as Record<Res, string>;
  const ertrag = d.arbeit ? `<div class="zeile"><span>${quellName[d.arbeit.res]} in Reichweite</span><span>${g.quellen}</span></div><div class="zeile"><span>Je Gang</span><span>${d.arbeit.menge} ${RES_NAME[d.arbeit.res]}</span></div>` : '';
  const rk = spiel.reparaturKosten(g), kaputt = g.hp < g.max - 0.5;
  const rep = g.rep ? `<div class="zeile"><span>Reparatur</span><span>${Math.round((100 * g.rep.t) / g.rep.dauer)} %</span></div><div class="hp"><div style="width:${(100 * g.rep.t) / g.rep.dauer}%;background:var(--frost)"></div></div>`
    : kaputt ? `<button type="button" class="aktion" id="reparieren" ${spiel.phase === 'tag' && spiel.kannBezahlen(rk) ? '' : 'disabled'}>Reparieren · ${kostenHtml(rk)}${spiel.phase !== 'tag' ? ' (nur am Tag)' : ''}</button>` : '';
  const kampf = d.kampf ? `<div class="zeile"><span>Reichweite · Schaden</span><span>${d.kampf.reichweite} · ${d.kampf.schaden}${d.kampf.flaeche ? ' (Fläche)' : ''}</span></div>` : '';
  const lichtZ = d.licht > 4 ? `<div class="zeile"><span>Lichtkreis</span><span>${d.licht} Blöcke</span></div>` : '';
  p.innerHTML = `<button class="schliessen" type="button" aria-label="Schließen">×</button><h2>${d.name}</h2><p>${d.kurz}</p>
    <div class="zeile"><span>Haltbarkeit</span><span>${Math.ceil(g.hp)} / ${g.max}</span></div><div class="hp"><div style="width:${(100 * g.hp) / g.max}%"></div></div>
    ${ertrag}${kampf}${lichtZ}${rep}
    ${g.typ !== 'haupt' ? '<button type="button" class="aktion" id="abreissen">Abreißen (halbe Kosten zurück)</button>' : ''}`;
  p.hidden = false;
  p.querySelector<HTMLButtonElement>('.schliessen')!.onclick = () => waehle(null);
  const a = p.querySelector<HTMLButtonElement>('#abreissen'); if (a) a.onclick = () => { spiel!.abreissen(g); waehle(null); };
  const rb = p.querySelector<HTMLButtonElement>('#reparieren'); if (rb) rb.onclick = () => { if (spiel!.reparieren(g)) { klang.spiele('bau', 0.8); panelGeb(); } };
}
function zeigeWerkstatt(): void {
  if (!spiel) return;
  panelArt = 'werkstatt'; obj?.waehle(spiel.gebaeude.find((g) => g.typ === 'werkstatt') || null);
  const p = $('panel'), s = spiel;
  const karten = (Object.keys(ERFINDUNGEN) as ErfId[]).map((id) => {
    const e = ERFINDUNGEN[id], fertig = s.erfindungen.has(id);
    const zut = Object.entries(e.zutaten).map(([b, n]) => `<span class="${s.bausteine[b as Baustein] < (n as number) && !fertig ? 'fehlt' : ''}"><i class="${b}"></i>${n} ${BAUSTEIN_NAME[b as Baustein]}</span>`).join('')
      + `<span class="${s.res.kristall < e.kristall && !fertig ? 'fehlt' : ''}"><i class="kristall"></i>${e.kristall} Kristall</span>`;
    const kann = !fertig && Object.entries(e.zutaten).every(([b, n]) => s.bausteine[b as Baustein] >= (n as number)) && s.res.kristall >= e.kristall;
    return `<div class="rezept ${fertig ? 'fertig' : ''}"><h3>${e.name}${fertig ? ' · erfunden' : ''}</h3><p>${e.wirkung}</p><div class="zutaten">${zut}</div>${fertig ? '' : `<button type="button" class="aktion" data-erf="${id}" ${kann ? '' : 'disabled'}>Erfinden</button>`}</div>`;
  }).join('');
  p.innerHTML = `<button class="schliessen" type="button" aria-label="Schließen">×</button><h2>Erfinderwerkstatt</h2><p>Bausteine lassen die Wesen fallen. Zusammen mit Kristall entstehen daraus Erfindungen.</p>${karten}`;
  p.hidden = false;
  p.querySelector<HTMLButtonElement>('.schliessen')!.onclick = () => { schliessePanel(); obj?.waehle(null); };
  p.querySelectorAll<HTMLButtonElement>('[data-erf]').forEach((b) => { b.onclick = () => { if (s.erfinden(b.dataset.erf as ErfId)) { zeigeWerkstatt(); leisteAktualisieren(); } }; });
}

// ================= Meldungen =================
function melde(text: string, ton: 'gut' | 'schlecht' | 'info' = 'info'): void {
  const box = $('meldungen'), m = document.createElement('div');
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
  if (e.button === 0 && werkzeug?.art === 'bau' && werkzeug.typ === 'mauer') {
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
  const typ = werkzeug.typ, [x0, z0] = typ === 'mauer' ? [Math.floor(p.x), Math.floor(p.z)] : ecke(typ, p);
  const pr = spiel.pruefe(typ, x0, z0), bezahlbar = spiel.kannBezahlen(GEBAEUDE[typ].kosten);
  obj?.zeigeVorschau(typ, x0, z0, pr.ok && bezahlbar, pr.ok ? pr.y : hoehe(x0 + 0.5, z0 + 0.5));
  if (unten?.mauer) { mauerZiel = [x0, z0]; zeigeTipp(`<b>Mauer</b> · ${linie(unten.mauer, mauerZiel).length} Blöcke · ${linie(unten.mauer, mauerZiel).length * (GEBAEUDE.mauer.kosten.stein || 0)} Stein`); }
  else zeigeTipp(`<b>${GEBAEUDE[typ].name}</b> · ${kostenHtml(GEBAEUDE[typ].kosten)}${!pr.ok ? `<br><span class="grund">${pr.grund}</span>` : !bezahlbar ? '<br><span class="grund">Nicht genug Rohstoffe.</span>' : ''}`);
});
canvas.addEventListener('pointerup', (e) => {
  const u = unten; unten = null; controls.enabled = true;
  if (!u || !spiel || e.button !== 0) return;
  if (u.ebene && mauerZiel) { if (spiel.ebnen(u.ebene[0], u.ebene[1], mauerZiel[0], mauerZiel[1])) klang.spiele('hieb_stein'); mauerZiel = null; return; }
  if (u.mauer && mauerZiel) {
    let n = 0; for (const [x, z] of linie(u.mauer, mauerZiel)) if (spiel.bauen('mauer', x, z, true)) n++;
    if (!n) melde('Hier lässt sich keine Mauer bauen.', 'schlecht');
    mauerZiel = null; return;
  }
  if (Math.hypot(e.clientX - u.x, e.clientY - u.y) > 6 || performance.now() - u.t > 600) return;
  const p = bodenPunkt(e.clientX, e.clientY); if (!p) return;
  if (werkzeug?.art === 'bau') { const [x0, z0] = werkzeug.typ === 'mauer' ? [Math.floor(p.x), Math.floor(p.z)] : ecke(werkzeug.typ, p); spiel.bauen(werkzeug.typ, x0, z0); return; }
  if (werkzeug?.art === 'spaeher') { if (spiel.erkundetAn(p.x, p.z)) melde('Hier ist schon erkundet. Klick in den Nebel.', 'info'); else if (spiel.spaeher(p.x, p.z)) { spaeherGeschickt = true; werkzeugSetzen(null); } return; }
  waehle(spiel.gebAn(p.x, p.z) || null);
});

// ================= Tastatur =================
const tasten = new Set<string>();
addEventListener('keydown', (e) => {
  if (!spiel || (e.target as HTMLElement).tagName === 'INPUT') return;
  const k = e.key.toLowerCase(); tasten.add(k);
  const typ = BAULEISTE.find((t) => GEBAEUDE[t].taste === e.key);
  if (typ) werkzeugSetzen(werkzeug?.art === 'bau' && werkzeug.typ === typ ? null : { art: 'bau', typ });
  if (k === 'escape') { werkzeugSetzen(null); waehle(null); schliessePanel(); }
  if (k === '9') werkzeugSetzen(werkzeug?.art === 'ebnen' ? null : { art: 'ebnen' });
  if (k === 'x') werkzeugSetzen(werkzeug?.art === 'spaeher' ? null : { art: 'spaeher' });
  if (k === 't') panelArt === 'werkstatt' ? schliessePanel() : zeigeWerkstatt();
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
  $('res').innerHTML = (['holz', 'stein', 'kristall'] as Res[]).map((r) => `<span title="${RES_NAME[r]}"><i class="${r}"></i>${Math.floor(s.res[r])}</span>`).join('');
  $('bausteine').innerHTML = (Object.keys(BAUSTEIN_NAME) as Baustein[]).map((b) => `<span class="${s.bausteine[b] ? '' : 'null'}" title="${BAUSTEIN_NAME[b]}"><i class="${b}"></i>${BAUSTEIN_NAME[b]} ${s.bausteine[b]}</span>`).join('');
  const u = $('uhr');
  u.classList.toggle('nacht', s.phase === 'nacht');
  if (s.phase === 'tag') {
    const rest = Math.ceil(s.restTag()), mm = Math.floor(rest / 60), ss = String(rest % 60).padStart(2, '0');
    const vorschau = s.welleVorschau().map((w) => `${w.zahl} ${w.zahl === 1 ? GEGNER[w.typ].name : MEHRZAHL[w.typ]}`).join(' · ');
    u.innerHTML = `<div class="titel">Tag ${s.nacht}</div><div class="balken"><div style="width:${(100 * s.zeit) / TAG_DAUER}%"></div></div>
      <div class="unter">${s.abend() ? `Heute Nacht: ${vorschau}` : `Ruhig. Nacht in ${mm}:${ss}`}</div><div><button type="button" id="einlaeuten">Nacht einläuten</button>${s.beschaedigt().length ? ` <button type="button" id="allerep" ${s.kannBezahlen(s.alleReparaturKosten()) ? '' : 'disabled'}>Alles reparieren · ${kostenHtml(s.alleReparaturKosten())}</button>` : ''}</div>`;
    $('einlaeuten').onclick = () => s.nachtEinlaeuten();
    const ar = document.getElementById('allerep'); if (ar) ar.onclick = () => { if (s.alleReparieren()) klang.spiele('bau', 0.8); };
  } else if (s.phase === 'nacht') {
    u.innerHTML = `<div class="titel">Nacht ${s.nacht}</div><div class="unter">Die Welle kommt · ${s.gegner.length} Wesen unterwegs</div>`;
  } else if (s.phase === 'morgen') u.innerHTML = `<div class="titel">Morgen</div><div class="unter">Die Nacht ist überstanden</div>`;
  leisteAktualisieren(); einfuehrung();
  if (panelArt === 'geb' && gewaehlt) { if (!s.gebaeude.includes(gewaehlt)) waehle(null); else panelGeb(); }
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
    <button type="button" class="aktion" id="e-einf">Einführung neu zeigen</button>
    <button type="button" class="aktion" id="e-menue">Speichern und zum Menü</button>`;
  p.hidden = false;
  p.querySelector<HTMLButtonElement>('.schliessen')!.onclick = schliessePanel;
  const m = $<HTMLInputElement>('e-musik'), f = $<HTMLInputElement>('e-effekte');
  m.oninput = f.oninput = () => { einst.musik = Number(m.value); einst.effekte = Number(f.value); klang.setzeLautstaerke(einst.musik, einst.effekte); einstSpeichern(); };
  p.querySelectorAll<HTMLButtonElement>('[data-grafik]').forEach((b) => { b.onclick = () => { einst.grafik = b.dataset.grafik as typeof einst.grafik; einstSpeichern(); grafikSetzen(); zeigeEinstellungen(); }; });
  $('e-einf').onclick = () => { einst.einfuehrung = true; einstSpeichern(); einfuehrungSchritt = 0; schliessePanel(); einfuehrung(); };
  $('e-menue').onclick = () => { speichern(); schliessePanel(); zeigeStart(); };
}

// ================= Hauptschleife =================
let letzte = performance.now();
renderer.setAnimationLoop(() => {
  const jetzt = performance.now(), dt = Math.min(0.1, (jetzt - letzte) / 1000); letzte = jetzt;
  ZEIT.value += dt;
  if (spiel && welt && obj) {
    akku += dt * tempo; let n = 0;
    while (akku >= DT && n < 12) { spiel.schritt(); akku -= DT; n++; }
    if (n >= 12) akku = 0;
    const ev = spiel.ereignisse.splice(0);
    let lichtNeu = false;
    for (const e of ev) {
      if (e.art === 'gebaut' || e.art === 'weg') lichtNeu = true;
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
      if (e.art === 'phase' && e.phase === 'tag') speichern();
      if (e.art === 'phase' && e.phase === 'verloren') { $('ende-text').textContent = `Nach ${spiel.nacht - 1} überstandenen Nächten und ${spiel.besiegt} besiegten Wesen hat die Welt ${spiel.code} gesiegt. Mit demselben Weltcode lässt sich genau diese Welt noch einmal versuchen.`; setTimeout(() => { $('ende').hidden = false; }, 1600); try { localStorage.removeItem(SPEICHER); } catch { /* */ } }
    }
    obj.ereignisse(ev);
    if (lichtNeu) lichtkarteSetzen(spiel.lichtquellen());
    anzeigeDunkel += (spiel.dunkel() - anzeigeDunkel) * Math.min(1, dt * 1.5);
    licht.setze(anzeigeDunkel); post.setze(licht); welt.nebelFarbe(licht.werte.nebel);
    const wegStaerke = spiel.phase === 'tag' ? (spiel.abend() ? 1 : werkzeug ? 0.6 : 0.3) : 0;
    obj.bild(tempo ? dt * Math.min(tempo, 2) : 0, (x, z) => spiel!.licht(x, z), anzeigeDunkel > 0.5, camera, wegStaerke);
    { const h = spiel.haupt; let nah = 0; if (h) for (const g of spiel.gegner) if (Math.hypot(g.x - h.x - 6, g.z - h.z - 6) < 45) nah++; klang.stimmung(spiel.phase === 'nacht', nah / 25); }
    tastenBewegung(dt);
    controls.update();
    const tg = controls.target, cx = THREE.MathUtils.clamp(tg.x, -WR + 20, WR - 20), cz = THREE.MathUtils.clamp(tg.z, -WR + 20, WR - 20);
    if (cx !== tg.x || cz !== tg.z) { const d = new THREE.Vector3(cx - tg.x, 0, cz - tg.z); tg.add(d); camera.position.add(d); }
    const dist = camera.position.distanceTo(tg);
    licht.fog.far = 360 + dist * 2.4; licht.fog.near = licht.fog.far * 0.45;
    licht.folge(tg, camera);
    planZeit -= dt; if (planZeit <= 0) { welt.planen(tg, dist, camera); planZeit = 0.25; }
    uiZeit -= dt; if (uiZeit <= 0) { anzeige(); zeichneKarte(); uiZeit = 0.15; }
  } else {
    // Menü: langsamer Flug über einer leeren Szene
    controls.update();
  }
  if (einst.grafik === 'niedrig') { renderer.toneMappingExposure = licht.werte.exp; renderer.render(scene, camera); } else post.render();
});
