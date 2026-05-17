# VOICE INTEGRATION — Nachtrag zu BUILD_SPEC.md

Es gibt jetzt **echte Sprachaufnahmen** (ElevenLabs). Sie ersetzen die
Browser-TTS-Roboterstimme komplett.

## Dateien

- Die 68 MP3s liegen in `assets/voice/` (der Nutzer entpackt sein
  `cruise_control_stimmen.zip` dort hinein).
- `src/voice_manifest.json` ist die Zuordnungstabelle. Jeder Eintrag:
  `{ file, speaker, screen, block, unit, seq, text, jsonpath }`.
- Der `file`-Name ist exakt der Dateiname in `assets/voice/`.

## Wie die Engine die Audios benutzt

1. Beim Start zusätzlich `src/voice_manifest.json` laden.
2. Eine Lookup-Map bauen: **Schlüssel = exakter `text` der Dialogzeile
   (getrimmt)** → Wert = `assets/voice/<file>`.
   - Robuster Schlüssel: `speaker + "||" + text.trim()` (verhindert
     Kollisionen, falls zwei Figuren denselben Satz sagen).
3. Beim Abspielen einer Dialogzeile (`{speaker, line}`):
   - Schlüssel `speaker + "||" + line.trim()` in der Map suchen.
   - **Treffer:** das MP3 per `new Audio(path)` abspielen. Nächste Zeile
     erst nach `audio.onended` (oder Klick/Skip). KEIN TTS.
   - **Kein Treffer** (z.B. Flavor-/Locked-Sätze, die nicht aufgenommen
     wurden): wie bisher Browser-TTS als Fallback. Regiezeilen
     (`speaker === "*"`) bleiben stumm.
4. TTS-Toggle oben rechts steuert jetzt: AN = Audio/TTS spielen,
   AUS = nur Text, Zeilen per Klick weiter. Verhalten sonst unverändert.
5. MP3s relativ laden (`assets/voice/...`) — funktioniert auch via
   `file://`, kein Server nötig.

## Wichtig

- Wortlaut der Aufnahmen == `text` im Manifest == `line` in
  `gameflow.json`. Beim Matchen exakt vergleichen (nur `.trim()`),
  nichts umschreiben.
- Fehlt eine einzelne MP3: still auf TTS zurückfallen, NICHT crashen,
  einmal `console.warn` mit dem fehlenden Schlüssel.
- Der Rest von `BUILD_SPEC.md` (State Machine, Hotspots, Puzzles, Screens)
  gilt unverändert. Dies hier betrifft nur die Audioausgabe.
