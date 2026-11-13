## runeBOOM 0.7 · Flüssiger

**Jetzt auch als App für Mac, Windows und Linux** – oder weiterhin direkt im Browser: <https://hoai-droid.github.io/RuneBoom/>

### Herunterladen

| System | Datei |
|---|---|
| macOS (Apple Silicon und Intel) | `runeBOOM-mac.dmg` |
| Windows 10/11 | `runeBOOM-windows-setup.exe` (oder `runeBOOM-windows.msi`) |
| Linux | `runeBOOM-linux.AppImage` (ausführbar machen und starten) oder `runeBOOM-linux.deb` |

Die Apps sind noch nicht signiert:
- **macOS:** Beim ersten Start Rechtsklick auf die App → „Öffnen“. Meldet macOS „beschädigt“, hilft im Terminal einmal
  `xattr -cr /Applications/runeBOOM.app`.
- **Windows:** Bei der SmartScreen-Warnung auf „Weitere Informationen“ → „Trotzdem ausführen“ klicken.

### Neu in 0.7

- **WebGPU:** Wo Browser oder App es können (Mac ab macOS 26, Windows, iPhone/iPad ab iOS 26, viele Android-Geräte), zeichnet
  runeBOOM über WebGPU. Überall sonst, etwa unter Linux und auf dem Steam Deck, wie bisher über WebGL. Umschaltbar unter
  Einstellungen → Darstellung (Automatisch, WebGPU, WebGL), wirksam ab dem nächsten Start.
- **Flüssiger auf allen Geräten:**
  - Boden und Pflanzen einer Kachel in einem Netz, halb so viele Zeichenaufrufe
  - der ferne Wald wird nur gezeichnet, wo man hinschaut, und wirft keine unnötigen Schatten mehr
  - Bodennebel mit weniger, dafür dichteren Schichten, über erkundetem Land fast ohne Rechenarbeit
  - Nachbearbeitung in vier statt sechs Durchgängen
  - Schatten nur bei Bewegung jedes Bild neu
  - die Lichtkarte malt Scheinwerfer nur nachts nach
- **Automatische Auflösung:** Sinkt die Bildrate unter 50, zeichnet das Spiel mit weniger Bildpunkten (bis 60 %). Hat es wieder Luft, geht es zurück. Abschaltbar.
- **Messwerte:** Die Bildrate-Anzeige zeigt jetzt auch die Rechenzeit von Spiel und Grafik, Zeichenaufrufe, Dreiecke, Auflösung und den Zeichenweg (WebGPU oder WebGL).
- **Schmalere Bauleiste:** Späher, Ebnen und Erfindungen stehen in einer eigenen unteren Zeile.

---|---|
| macOS (Apple Silicon und Intel) | `runeBOOM-mac.dmg` |
| Windows 10/11 | `runeBOOM-windows-setup.exe` (oder `runeBOOM-windows.msi`) |
| Linux | `runeBOOM-linux.AppImage` (ausführbar machen und starten) oder `runeBOOM-linux.deb` |

Die Apps sind noch nicht signiert:
- **macOS:** Beim ersten Start Rechtsklick auf die App → „Öffnen“. Meldet macOS „beschädigt“, hilft im Terminal einmal
  `xattr -cr /Applications/runeBOOM.app`.
- **Windows:** Bei der SmartScreen-Warnung auf „Weitere Informationen“ → „Trotzdem ausführen“ klicken.

### Neu in 0.6

- **Vier Sprachen:** Deutsch, Englisch, Französisch, Spanisch. Standard ist die Sprache des Systems, umschaltbar in den Einstellungen.
  Auch der Untertitel wird übersetzt.
- **Laden ohne Aufbau-Flackern:** Die Welt wird im Hintergrund vollständig gebaut und dann von der Mitte zu den Rändern eingeblendet.
- **Mehr Zeit am Tag:** Der Tag dauert 2:20 statt 1:20. „Nacht einläuten“ kürzt ihn weiterhin ab.
- **Der Bericht der Nacht hält das Spiel an,** bis er bestätigt wird.
- **Neue Einführung** in acht Schritten für Dorf, Nahrung, Erfindungsbaum und Ausbaustufen.
- **Hilfe-Fenster (F1)** mit allen Regeln auf einen Blick.
- **Bedienung mit dem Finger:** größere Knöpfe, langer Druck öffnet ein Gebäude.
- **Leistung:** Bildrate-Anzeige in den Einstellungen, weniger Rechenarbeit auf mittlerer und niedriger Grafikstufe.
- **Eigene Klänge** für Rissfürst, Siegel, Omen, Wunder, Fallen, Blitze und Feuer.
- **Lesbarerer Erfindungsbaum,** der die ganze Bildschirmhöhe nutzt.
- **Das Gebäudefenster verdeckt Karte und Tempo nicht mehr.**

---

## runeBOOM 0.7 · Smoother (English)

Play in your browser: <https://hoai-droid.github.io/RuneBoom/> or download the app for Mac, Windows or Linux.

- WebGPU where available (macOS 26, Windows, iOS 26, many Android devices), WebGL everywhere else. Choose under Settings → Renderer.
- Smoother everywhere: fewer draw calls, a lighter ground fog, fewer post-processing passes, smarter shadow and light-map updates.
- Automatic resolution keeps the frame rate up; the frame-rate display now shows game and graphics timings, draw calls and triangles.
- Narrower build bar: scout, level terrain and inventions moved to their own row.

The apps are not signed yet. On macOS right-click → Open (or run `xattr -cr /Applications/runeBOOM.app`), on Windows choose “More info” → “Run anyway”.
