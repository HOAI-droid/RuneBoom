# CLAUDE.md – runeBOOM

Episches Fantasy-Tower-Defense im Voxelstil. Name: **runeBOOM · Die Feste der Erfinder** (kurz runeBOOM).
Schwesterprojekt von overBOOM (https://github.com/HOAI-droid/overBOOM); Technik und Grafikstil
orientieren sich an dessen Zweig `grafik`.

- Oberfläche, Commit-Nachrichten, README und Releases auf **Deutsch**.
- Konzeptbuch: `docs/konzeptbuch.html` (eigenständige Seite, Three.js 0.170 vom CDN). Wird bei
  Konzeptänderungen mitgepflegt.

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
- **Nebel** über Unerkundetem; Späher/Außenposten decken auf; einmal erspäht bleibt sichtbar.
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
  leichter Tilt-Shift. **Keine Umrisslinien.**
- Kamera schräg von oben, frei drehbar und zoombar, auf allen Geräten.
- Wasser- und Lavabecken leicht abgesenkt und animiert (Lava nach `render/src/lava.ts` aus overBOOM).
- Große Welt: Kacheln 32 × 32, im Web Worker gebaut, Detailstufen (nah fein, fern Übersicht), ferne Kacheln
  freigeben; Lichter später über eine Lichtkarte statt echter Lichtquellen.

## Technik (geplant)

Gerüst wie overBOOM: TypeScript, Three.js, Simulation (`core`) ohne DOM und mit Seed getrennt von der Grafik;
Tauri (Windows/Mac/Linux, Steam), Capacitor (iOS/Android), UWP-Hülle (Xbox), Browser (GitHub Pages).

## Stufenplan

- [x] Konzept und Stilentwürfe (`docs/konzeptbuch.html`)
- [ ] Prototyp: Tag-Nacht-Zyklus, Bauen, ein Turm, eine Welle, Nebel, Weltcode
