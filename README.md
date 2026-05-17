# CRUISE CONTROL — Production Package

Fertig vorbereitetes Paket für den Bau des Spiels mit **Claude Code**.
Alles ist so abgelegt, dass Claude Code nicht raten muss.

```
cruise-control/
├── BUILD_SPEC.md          ← das Briefing. Claude Code zuerst hierauf ansetzen.
├── gameflow.json          ← komplette Logik + ALLE Dialoge (maschinenlesbar)
├── hotspots.json          ← Klickflächen (DU füllst die — siehe Schritt 1)
├── hotspots.schema.json   ← Format-Referenz
├── tools/
│   └── hotspot-editor.html  ← dein Autoren-Tool
├── assets/                ← finale Pixelart (nicht verändern)
└── docs/gamebible.docx    ← Originalquelle (Referenz; JSON hat Vorrang)
```

---

## Schritt 1 — Hotspots zeichnen (du, ~15 Min)

1. `tools/hotspot-editor.html` im Browser öffnen (Doppelklick reicht,
   kein Server nötig).
2. Oben die 5 Screens durchklicken: **start, prolog, kapitel1, kapitel2,
   kapitel3**. (Win-Screen braucht keine Hotspots — Klick = überall.)
3. Pro Screen die Liste rechts abarbeiten: mit der Maus ein Rechteck über
   das Objekt **ziehen**, im Dialog den passenden Hotspot wählen. Box
   anklicken = auswählen, **Entf** = löschen.
4. Ziel: jeder Screen-Tab oben ist **grün ●** (alle Pflicht-Hotspots gesetzt).
5. **„hotspots.json exportieren"** klicken und die heruntergeladene Datei
   in den `cruise-control/`-Ordner legen (die Platzhalter-Datei ersetzen).

> Koordinaten sind normalisiert (0–1) → das Spiel skaliert sie automatisch,
> egal in welcher Auflösung. Du kannst jederzeit die Datei wieder „laden",
> nachjustieren und neu exportieren, **ohne dass Code geändert werden muss**.

---

## Schritt 2 — An Claude Code übergeben

Claude Code im `cruise-control/`-Ordner starten und sinngemäß sagen:

> „Lies `BUILD_SPEC.md` und baue das Spiel daraus. `gameflow.json` ist die
> Logik-/Dialogquelle, `hotspots.json` liefert die Klickflächen. Assets sind
> final. Halte dich an die Akzeptanzkriterien in §10 und teste beide Figuren
> komplett durch."

Das war's. `BUILD_SPEC.md` enthält Tech-Stack, State Machine, Dialog-System,
TTS-Regeln, Puzzle-Logik und eine Checkliste.

---

## Was schon drinsteckt (damit nichts verloren geht)

- **Komplette Dialoge** beider Figuren, wortgleich aus deiner Game-Bibel,
  inkl. aller Sackgassen-Antworten (`result: none`) und Lösungspfade.
- **Sprache:** pro Figur/NPC ein TTS-Profil (Arthur hoch & schnell, Beat
  tief & langsam). Text + Stimme gleichzeitig, abschaltbar. Regieanweisungen
  werden angezeigt, aber nicht gesprochen.
- **Puzzle-Verzweigungen** sauber modelliert — inkl. dem Trick, dass Beats
  `SCHWEIGEN` bei Luca erst nach dem übergelaufenen Whirlpool funktioniert.
- **Voice-Future-Proofing:** pro Dialogzeile kann später ein echtes Audio-File
  TTS überschreiben — Architektur ist im Spec vorgesehen.

Anmerkung zu Umlauten: `gameflow.json` schreibt teilweise `ae/oe/ue` (robust
über alle TTS-Engines). Wortlaut und Bedeutung sind 1:1 deine Texte.
