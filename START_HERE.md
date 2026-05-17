# START HERE — Cruise Control mit Claude Code bauen

## Schritt 1 — Stimmen einfügen
Entpacke dein `cruise_control_stimmen.zip` (die 68 MP3s aus dem
Generator) in den Ordner:

    cruise-control/assets/voice/

Es müssen danach 68 .mp3-Dateien dort liegen (Namen wie
`prolog__beat__entry__01__grenzbeamter.mp3`). Nichts umbenennen.

## Schritt 2 — Ordner in Claude Code laden
Das ganze `cruise-control/`-Verzeichnis hochladen / als Projekt öffnen.
(Klein, < 5 MB inkl. Bilder und Stimmen.)

## Schritt 3 — Diesen Prompt in Claude Code einfügen

---

> Lies `BUILD_SPEC.md` UND `VOICE_INTEGRATION.md` vollständig — beide sind
> verbindlich. `gameflow.json` = komplette Spiel-Logik + alle Dialoge.
> `hotspots.json` = Klickflächen (schon befüllt; via Taste H im Spiel
> sichtbar, ich justiere bei Bedarf nach). Assets in `assets/` sind final
> (die .png sind WebP-kodiert — Pfade NICHT ändern). Die echten Stimmen
> liegen in `assets/voice/` und werden laut `VOICE_INTEGRATION.md` über
> `src/voice_manifest.json` pro Dialogzeile abgespielt; Browser-TTS nur
> als Fallback für nicht aufgenommene Zeilen.
>
> Bau das Spiel als statische Seite, die per Doppelklick auf `index.html`
> ohne Server läuft (file://-tauglich: gameflow/hotspots/manifest als
> Daten einbinden, Bilder + MP3s relativ referenzieren — kein fetch das
> file:// bricht). Halte dich an die Akzeptanzkriterien in
> BUILD_SPEC §10 und teste beide Figuren komplett durch (Headless-Sim
> oder manuell). Debug-Toggle Taste H für Hotspot-Rechtecke einbauen.
>
> Frag nach wenn etwas in den Specs unklar ist, statt zu raten. Fang an.

---

## Schritt 4 — testen
Claude Code liefert `index.html`. Doppelklick → spielen.
Falls Stimmen stumm bleiben: prüfen ob die 68 MP3s wirklich in
`assets/voice/` liegen und die Namen unverändert sind.

Alles für den Bau Nötige liegt in diesem Ordner:
- BUILD_SPEC.md, VOICE_INTEGRATION.md  (Anleitung)
- gameflow.json  (Logik + Dialoge)
- hotspots.json, hotspots.schema.json  (Klickflächen)
- assets/  (Bilder + voice/)
- src/voice_manifest.json  (Audio-Zuordnung)
