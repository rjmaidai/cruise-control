# CRUISE CONTROL

Point-and-Click-Adventure (Arthur / Beat). Pixelart, neon, trockene Comedy,
synthetische Stimmen via Web Speech API. Vollständige Spec in `BUILD_SPEC.md`,
komplette Logik + Dialoge in `gameflow.json`.

## Schnellstart (lokal)

Voraussetzung: Node.js (kommt bei macOS oft mit, sonst `brew install node`).

```bash
# 1. Spiel + Editor in einem Server (port 8000)
node serve.mjs

# Spiel:           http://localhost:8000/index.html
# Hotspot-Editor:  http://localhost:8000/tools/hotspot-editor.html
```

Ohne Node: `python3 -m http.server 8000` aus diesem Ordner tut's auch.

## Bedienung

| Aktion | Eingabe |
|---|---|
| Hotspot klicken | Maus |
| Inventar-Item auswählen | Klick im Inventar |
| Item wieder abwählen | Rechtsklick / `Esc` |
| Dialogzeile weiter | Klick / `Leertaste` / `Enter` |
| Sprachausgabe an/aus | `T` oder Button oben rechts |
| **Hotspot-Debug-Overlay** | **`H`** |

## Workflow: Hotspots zeichnen

1. `node serve.mjs` starten.
2. `http://localhost:8000/tools/hotspot-editor.html` öffnen.
3. Pro Screen die Rechtecke ziehen, im Dialog den Hotspot wählen.
   Ziel: jeder Screen-Tab **grün**.
4. „hotspots.json exportieren" → die Datei in den Projektordner legen
   (`hotspots.json` ersetzen).
5. Spiel neu laden, mit `H` verifizieren, dass die Boxen passen.

## Struktur

```
cruise-control/
├── BUILD_SPEC.md            ← verbindliche Spec
├── gameflow.json            ← Logik + alle Dialoge (READ FIRST)
├── hotspots.json            ← Klickflächen (vom Editor exportiert)
├── hotspots.schema.json     ← Format-Referenz
├── index.html               ← Spiel-Entry
├── serve.mjs                ← Dev-Server (Node, zero-deps)
├── package.json             ← `npm run dev | editor | game`
├── src/
│   ├── game.js              ← komplette Engine (Loader, State, Dialog, TTS …)
│   └── style.css
├── tools/
│   └── hotspot-editor.html  ← Autoren-Tool
└── assets/
    ├── start.png
    ├── levels/   prolog · kapitel1 · kapitel2 · kapitel3 .png
    ├── intro/    prolog · kapitel1 · kapitel2 · kapitel3 .png
    └── winner/   arthur · beat .png
```

Die PNGs sind teilweise WebP-kodiert (Endung bleibt `.png`) — Browser
sniffen den Inhalt, das passt.

## Akzeptanzkriterien

Siehe `BUILD_SPEC.md` §10. Kurz: beide Figuren von Start bis Win
durchspielbar, falsche Optionen ändern nichts, gesperrte Exits geben
`locked_feedback`, `use(handtuch,whirlpool)` und `use(brot,kellner)`
mit korrekten Vorbedingungen, Endbild passt zur Figur, Replay setzt
sauber zurück.
