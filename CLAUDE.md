# CLAUDE.md – runeBOOM

Episches Fantasy-Tower-Defense im Voxelstil. Name: **runeBOOM · Die Feste der Erfinder** (kurz runeBOOM).
Schwesterprojekt von overBOOM (https://github.com/HOAI-droid/overBOOM); Technik und Grafikstil
orientieren sich an dessen Zweig `grafik`.

- Oberfläche, Commit-Nachrichten, README und Releases auf **Deutsch**.
- Konzeptbuch: `docs/konzeptbuch.html` (eigenständige Seite, Three.js 0.170 vom CDN). Wird bei
  Konzeptänderungen mitgepflegt. Projektseite (DE/EN): `docs/index.html`, Bilder in `docs/bilder/`.

## Festgelegte Entscheidungen (Konzept)

- Genre: Tower Defense mit Basisbau auf offener Karte (Mauern, Türme, Gebäude, Wirtschaft), **kein Held**.
- Tagesablauf: **Tag ruhig** (sammeln, bauen, forschen, Späher), **Nacht = Welle**, Morgen = Erfinden.
- Fortschritt über **Erfindungen** (2–3 Bausteine fusionieren, offene + geheime Rezepte), Türme/Gebäude
  einzeln umrüsten → Altes steht neben Neuem. Rezeptbuch bleibt (Wissen, keine Stärke).
- Zeitalter (Fantasy, nicht Menschheitsgeschichte): Holz & Runen, Glut & Alchemie, Uhrwerk & Dampf, Blitz & Kristall.
  Je Turm und Zeitalter zwei Zweige; benachbarte Türme verschmelzbar.
- Völker (wählbar, 3): **Glutborn** (Basalt, Kupfer, Glut → Plasma), **Hainmar** (lebendes Holz, Harz → Sonnenstrahl),
  **Sturmweber** (Marmor, Messing, Wind → Blitz).
- Wesen: Moorwicht, Steintroll, Schattenwolf (verborgen), Drachling (Flieger), Nebelrochen (Flieger). Flieger
  schweben über dem Boden und werfen Schatten.
- Modi: **Weltreise** (Regionen 256 × 256, 5–20 Min.) und **Stammfeste** (1024 × 1024, nicht endlos, speichern/fortsetzen).
- Welt prozedural aus **Weltcode** (z. B. NEBELKRAKE-4127), deterministisch, offline teilbar.
- **Nebel** über Unerkundetem als Bodennebel (ca. 7–8 m hoch), der in Schwaden zieht und mal dichter, mal dünner ist: Gelände und Wesen verborgen, Baumkronen und Bergkuppen ragen heraus. Späher/Außenposten decken auf; einmal erspäht bleibt sichtbar.
- **Licht:** nachts sieht man ohne Licht nur Umrisse/Augen; Leuchttürme geben Bonus auf Reichweite und
  Treffsicherheit; höhere Stufe erkennt Verborgenes besser (Fackelmast, Leuchtfeuer, Spiegel-Scheinwerfer,
  Kristall-Leuchtfeuer).
- Singleplayer zuerst. Stimmung episch mit fantasievollen Wesen.

## Grafik

- Ein Block ≈ 1 m. Boden in ganzen Blöcken, Türme/Gebäude/Bäume in halben Voxeln, Menschen ca. 1,8 Blöcke
  in Achtel-Voxeln, Wesen in Viertel- bis Fünftel-Voxeln.
- Licht: Tag = goldene Stunde, Nacht = Mondlicht mit leuchtenden Fenstern, Fackeln, Runen, Kristallen.
  Leuchtflächen gedämpft, **keine schwebenden Lichtpunkte/Teilchen**.
- Nachbearbeitung wie overBOOM `grafik`: weiche Schatten, Bloom, warme Lichter/kühle Schatten, Vignette,
  leichter Tilt-Shift. **Keine Umrisslinien.** Lichtkegel von Scheinwerfern nur als Hauch sichtbar, die Aufhellung der angestrahlten Flächen trägt die Wirkung.
- Kamera schräg von oben, frei drehbar und zoombar, auf allen Geräten.
- Wasser- und Lavabecken leicht abgesenkt und animiert (Lava nach `render/src/lava.ts` aus overBOOM).
- Große Welt: Kacheln 32 × 32, im Web Worker gebaut, Detailstufen (nah fein, fern Übersicht), ferne Kacheln
  freigeben; Lichter später über eine Lichtkarte statt echter Lichtquellen.

## Technik

Gerüst wie overBOOM: TypeScript, Three.js, Vite; Simulation (`packages/core`) ohne DOM, nur mit Seed (`rng`, `h3`),
fester Takt `DT = 1/20`, läuft in Node (`npm test`). Später: Tauri (Windows/Mac/Linux, Steam), Capacitor
(iOS/Android), UWP-Hülle (Xbox). Browser über GitHub Pages (`.github/workflows/pages.yml`).

```
packages/core/src/
  zufall.ts    h3, rng, noise, fbm, Weltcode ↔ Seed
  welt.ts      Welt 1024 × 1024: spalte(), deko() (Bäume/Felsen, gleich für Grafik und Simulation), orte(), begehbar()
  daten.ts     Spielwerte: GEBAEUDE, GEGNER, ERFINDUNGEN, welle(n), Tagesdauer
  flow.ts      Wegfeld (Dijkstra) im Ausschnitt Feste ↔ Risse; Gebäude teuer, aber passierbar (Angriff)
  spiel.ts     Spiel: Phasen Tag/Nacht/Morgen, Bauen, Ertrag, Wesen, Türme, Geschosse, Licht, Nebel, Speichern
packages/render/src/
  voxel.ts     Grid + meshVoxels (Umgebungsverdeckung je Ecke; Töpfe fest/leuchtend/Lampe)
  modelle.ts   alle Voxel-Modelle (halbe Voxel; Menschen Achtel, Wesen eigene Maßstäbe)
  chunk.ts     Kachel und Übersicht bauen (läuft im Worker welt.worker.ts, eingebunden mit ?worker&inline)
  grafik.ts    Materialien, Lichtkarte (1024² R8, nachts als Eigenleuchten), Wasser/Lava, Himmel, Tag↔Nacht, Nachbearbeitung
  weltansicht.ts Kacheln nachladen/freigeben, Übersicht (ausgeblendet unter feinen Kacheln), Bodennebel
  objekte.ts   Gebäude (Klone), Wesen/Arbeiter (InstancedMesh), Geschosse, Trümmer, Bauvorschau, Reichweiten
apps/web/      index.html (Oberfläche, Stil wie Konzeptbuch), src/main.ts (Hauptschleife, Eingabe, Menü)
```

- `window.runeboom.spiel` gibt in der Konsole Zugriff auf die laufende Partie (für Tests).
- Einzeldatei-Fassung für eine Vorschau: `npm run build:artifact` → `dist-single/runeboom.html`.
- Spielstand: `localStorage` `runeboom-spielstand-3` (automatisch zu Beginn jedes Tages, nachts nicht) und `runeboom-plaetze-1` (3 Plätze).
- Gleichgewicht prüfen: `node --experimental-strip-types tools/balance.ts WELTCODE NÄCHTE` (Bot, Schwierigkeit als 4. Parameter in `botPartie`).

## Stufenplan

- [x] Konzept und Stilentwürfe (`docs/konzeptbuch.html`)
- [x] Prototyp 0.1: Weltcode, Nebel/Späher, Tag-Nacht, Bauen (8 Gebäude), Licht, 4 Wesen, 4 Erfindungen, Speichern
- [x] 0.2 Leben in der Feste: grober Wald für die ganze Welt (Instanzen, unter feinen Kacheln ausgeblendet), Arbeiter
  (`Spiel.arbeiter`, Bäume fällen → `gefaellt`, Setzling nach 3, Baum nach 6 Tagen; Felsen 3× abbaubar → `abgebaut`),
  Kachel wird nach Änderung im Worker neu gebaut, Bogenschützen/Pfeile/Spuren/Brandflecken, Lebensbalken, Reparieren
  (nur am Tag, `reparieren()`, Morgen bessert nur 25 % aus), Wegvorschau (`wegVorschau()`), Nebelrochen mit Fracht,
  Klänge und Musik (`apps/web/src/klang.ts`, WebAudio), Einführung, Einstellungen (Lautstärke, Grafik hoch/mittel/niedrig),
  Start mit 250 Holz/120 Stein/25 Kristall + Holzfäller + Steinbruch, mittlere Maustaste verschiebt
- [x] 0.2.1: Arbeitsumkreis 32 (sonst ×1,6 weiter), Baum 3 Gänge (`gaenge`), Felsen 4 Gänge, Arbeiter schneller;
  Gelände ebnen (`ebnen()`, Höhen in `welt.ts` `setzeHoehe`, gespeichert, an den Worker übergeben; Kachelwände bis zum tiefsten Nachbarn)
- [x] 0.3 Zeitalter: Zeitalter über Schlüsselerfindungen (`zeitalter()`), Linien mit `von`/`zweige` (`umruesten()`, Dauer `UMBAU_DAUER`),
  `VERSCHMELZUNGEN` (`verschmelzen()`, `entdeckt` = Rezeptbuch), `HAUPT_STUFEN` mit Fähigkeiten (`faehigkeit()`, je Nacht einmal),
  Ruinen (`ruinen`, `wiederaufbauen()`/`raeumen()`), Wesen greifen im Vorbeigehen an (`nebenbei`), Panzer ab Nacht `PANZER_AB`,
  geheime Erfindungen, Bot `tools/balance.ts` im Test.
  Robustheit: Wasser watbar (Kosten 3,5), Entstehen nur an erreichbaren Stellen, Festhänge-Erkennung (`bester`/`stillstand`),
  `NACHT_MAX` beendet jede Nacht, `spiel.schritt()` in `main.ts` per try/catch abgesichert. **Eine Runde darf nie das Spiel anhalten.**
- [x] 0.4 Wachstum: Bevölkerung (`einwohner`, `wohnraum()`, `essen()`, `verteileArbeiter()`, Nahrung als Rohstoff, Haus/Hof/Fischer),
  Stufen I–III (`stufeOption()`/`stufeAusbauen()`, `STUFE_WERT`), Burg in 6 Stufen (`HAUPT_STUFEN`, `burg()` in modelle.ts), Turmgrenze,
  Runenkraft (`runenkraft()`, `g.kraft`), 37 Erfindungen mit `wissen`/`ab` und `SCHLUESSEL_VORWISSEN`, Risse aus `RISSE` (welt.ts),
  Welle gegen die schwächste Seite (`abwehrAmWeg`), neue Wesen + Rissfürst, Feuer (`zuende()`, `braende()`), Schwierigkeit, Nachtbericht.
  Hauptmenü über lebender Feste (`baueMenueWelt()`), Spielstände (Auto + 3 Plätze), Erfindungsbaum als eigene Ansicht.
  Wegfeld nutzt zwischengespeicherte Geländekosten (`grund`), Rohstoffquellen sind zwischengespeichert (`quellVersion`).
- [x] 0.5 Die lange Partie: 40 Nächte in vier Akten (`AKTE`, `ENDE_NACHT`), Siegel in Akt IV (`versiegelt`, `g.ritual`), Sieg mit Abspann
  (`phase 'gewonnen'`, `sieg`, `stat`), Völker (`VOELKER`, `volk`, Farbtausch `VOLK_FARBEN` über `Grid.tausch`), fünftes Zeitalter,
  Omen (`omenFuer()`), Wunder (`wunder`, eines aus zwei je Zeitalter, `bauzeit`), Leitsätze (`LEITSAETZE`, `leitsatzOffen`),
  Außenposten (Versorgung: `versorgt`), Verarbeitung (`umwandeln`, `verarbeiten()`), Fallen (`falle`, begehbar über `fallenIds`), Tor.
  Bauleiste in Gruppen (`BAUGRUPPEN`), Abwahl nach dem Setzen, Fenster ohne Scrollen. Projektseite DE/EN: `docs/index.html`.
- [x] 0.6 Sprachen und Apps: `t()` in `packages/core/src/sprache.ts` (deutscher Text = Schlüssel, `{a}`-Platzhalter), Tabellen
  `apps/web/src/sprachen/{en,fr,es}.ts`, `tools/texte_sammeln.ts` sammelt alle Schlüssel, Test `sprachen.test.ts` prüft Vollständigkeit.
  **Neue Texte immer in `t('…')` bzw. `tr('…')` einpacken und in allen drei Tabellen ergänzen.** Statische HTML-Texte übersetzt
  `uebersetzeStatisch()` (Elemente mit `data-dynamisch` ausgenommen). Enthüllung beim Laden (`enthuellen()`, `WeltAnsicht.bereit()`),
  Tag 140 s, Pause beim Nachtbericht, Einführung 8 Schritte, Hilfe F1, Touch (langer Druck), Bildrate, Klänge.
  Desktop-Apps: `src-tauri/` (Tauri 2, `frontendDist: ../dist`), Action `.github/workflows/apps.yml` baut Mac/Windows/Linux und legt ein
  Release `v<version>` mit festen Dateinamen an (`runeBOOM-mac.dmg`, `runeBOOM-windows-setup.exe`, `runeBOOM-linux.AppImage`, `.deb`);
  Release-Text aus `RELEASE_NOTES.md`. Version steht in `package.json`, `src-tauri/Cargo.toml` und `src-tauri/tauri.conf.json`.
- [x] 0.7 Flüssiger: Three.js 0.187, **WebGPU mit WebGL-Rückfall** (`neuerRenderer(canvas, einst.darstellung)` per Top-Level-await,
  Build-Ziel es2022). Alle eigenen Materialien entstehen über `FABRIK` in `grafik.ts` (WebGL-Shader); `knoten.ts` (nur bei WebGPU
  geladen) ersetzt sie durch TSL-Fassungen und die Nachbearbeitung durch `RenderPipeline`. **Neue Shader immer in beiden Fassungen.**
  Leistung: Kachel = ein Netz je Material (`vereine()` in chunk.ts), grober Wald in Bereichen 256 × 256 ohne Schatten, Nebel 5/3 Schichten
  (`nebelLagen`, frühes `discard` über Erkundetem), Nachbearbeitung Szene → Bloom → Tilt waagrecht → Abschluss (Tilt senkrecht, Farbe,
  Vignette, ACES, sRGB), Schatten `autoUpdate = false` (`schattenPlanen()`), Lichtkarte mit festem Teil, Scheinwerfer nur nachts,
  automatische Auflösung (`auflSchritt()`), Messwerte in der Bildrate-Anzeige und `window.runeboom.leistung()`.
  Bauleiste: Gruppen oben, Späher/Ebnen/Erfindungen in eigener Zeile (Raster 12 Spalten).
  Testen: Im Testbrowser stellt WebGPU keine Leinwand dar (Gerät geht verloren). Leinwand per Init-Skript auf eine Textur umleiten
  (`GPUCanvasContext.configure/getCurrentTexture` ersetzen), dann laufen WebGPU-Shader echt; Bilder über `darstellung: 'knoten-webgl'`
  (TSL über die WebGL-Schiene, nur für Tests).
- [x] 0.7.1 Lebendige Figuren: Scharen mit Gliedern (`Bauplan` je Modell ordnet Voxel nach Lage Beinen/Armen/Flügeln/Schwanz zu,
  Gelenk `p`, je Glied eigene InstancedMeshes; `setze(…, Regung)` mit `phase`, `gang`, `hieb`, `flug`). Gangphase der Wesen wächst mit dem
  Weg (`gangVon`, `SCHRITT`). **Neue Wesen brauchen einen Bauplan.** Menschen meiden Wasser/Lava: `wege.ts` (`trocken`, `trockenerWeg`:
  gerade Linie, sonst A* im Ausschnitt, geglättet), Arbeiter in `spiel.ts` (`wege`, nicht gespeichert), Bürger in `objekte.ts`.
  Kacheln in Stufen: 2 = alles bis `nahRadius()`, 1 = Boden + Kristalle/Risse (Maske 128, grober Wald sichtbar, keine Schatten).
  Messschalter (`messAus`), Leuchtbeeren auf der Krone.
- [ ] 0.8 Apps und Klang (festgelegt): **nur Querformat** (Apps gesperrt, Browser: Hinweis „Bitte quer halten“ + Pause),
  **neue Klänge** (Aufnahmen aus freien Bibliotheken, mehrere Fassungen je Geräusch, gemeinsamer Hall, ferne Arbeiter leiser/seltener),
  **Musik je Volk**, laufend neu zusammengesetzt aus Motiven (Glutborn: Trommeln, Blech, Amboss · Hainmar: Flöten, Harfe, Holz ·
  Sturmweber: Streicher, Glocken, Hackbrett), Schichten Tag/Abend/Nacht/Kampf, Themen für Rissfürst und Sieg,
  **Gamepad-Steuerung**, **Jahreszeiten über die 40 Nächte** (Frühling bis Winter), **Tiere am Tag** (nur wenn es kaum Bildrate kostet),
  **Apps für Android und iPhone/iPad** (Capacitor) und **Xbox** (WebView2/Microsoft Store). Steam vorerst nicht.
  **Mauerverlauf sichtbar:** beim Ziehen einer Mauer erscheint die Linie auf dem Boden, damit man den Verlauf vor dem Bauen sieht.
  **Befehlsschicht** als Grundlage für späteren Mehrspieler: jede Spieleraktion als Befehl, überall gleiche Rechnung (eigene sin/cos …),
  Prüfsumme des Spielstands; ermöglicht auch Wiederholungen und Tests. Mehrspieler-Modell (lieber miteinander) noch offen.
  Bewusst noch nicht: Wetter, Bestiarium, Erfolge, Weltcode des Tages, Barrierefreiheit.
- [ ] später: Steam · Weltreise · Mehrspieler · 1.0 Veröffentlichung
- Titelbilder: `docs/bilder/runeboom-titel-quer.jpg` (README, GitHub) und `runeboom-titel-hoch.jpg` (später Apps/Stores)
