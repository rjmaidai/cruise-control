# CRUISE CONTROL — BUILD SPEC (Briefing für Claude Code)

> Diese Datei ist die **einzige Quelle der Wahrheit** für die Implementierung.
> `gameflow.json` = Inhalt & Logik. `hotspots.json` = Klickflächen. Assets = final.
> Nichts davon neu erfinden, nichts neu generieren.

---

## 0. Was das ist

Ein **Point-and-Click-Adventure** im Pixelart-Stil. Zwei spielbare Figuren
(Arthur / Beat) mit komplett getrennten Dialogpfaden. 4 Räume + Startscreen +
2 Endbilder. **Alle Dialoge werden gesprochen** (Browser-TTS) und gleichzeitig
als Text angezeigt.

Trockene, leicht kaputte Comedy. Die synthetische Stimme ist **Absicht**, kein Bug.

---

## 1. Tech-Stack (verbindlich)

- **Vanilla HTML/CSS/JS**, ein Vite-Projekt ODER eine einzige `index.html` —
  keine schwere Engine, kein React nötig. Phaser ist erlaubt, aber nicht
  erforderlich; ein simpler DOM/Canvas-Renderer reicht (Szene = Hintergrundbild +
  absolut positionierte Hotspots + Dialog-Overlay).
- **Sprache:** `window.speechSynthesis` (Web Speech API). Kein externer Dienst.
- **Kein Backend.** Läuft als statische Seite, auch via `file://`.
- Assets werden **relativ** geladen (`assets/...`). Struktur unten nicht ändern.

---

## 2. Verzeichnisstruktur (Eingang)

```
cruise-control/
  gameflow.json            ← Logik + alle Dialoge (READ THIS FIRST)
  hotspots.json            ← vom Hotspot-Editor exportiert (Klickflächen)
  hotspots.schema.json     ← Format-Referenz für hotspots.json
  assets/
    start.png
    levels/   prolog.png kapitel1.png kapitel2.png kapitel3.png
    intro/    prolog.png kapitel1.png kapitel2.png kapitel3.png
    winner/   arthur.png beat.png
    characters/ sheet1.png sheet2.png sheet3.png   (nur Referenz, nicht im Spiel)
  tools/
    hotspot-editor.html    ← Autoren-Tool: muss lokal SERVIERT werden (s. §3a)
  docs/gamebible.docx      ← Originalquelle (Referenz, JSON hat Vorrang)
```

**Bauziel:** (a) ein lauffähiges Spiel in `cruise-control/` und (b) der
Hotspot-Editor läuft per lokalem Dev-Server, damit der Autor die Hotspots
selbst zeichnen kann (§3a). `docs/` unangetastet lassen. Der Editor in
`tools/` darf repariert/verbessert werden, das Zeichnen bleibt beim Autor.

---

## 3. Datenfluss & Hotspot-Workflow

1. Beim Start `gameflow.json` und `hotspots.json` laden (fetch).
2. Für jeden Screen: Hintergrund aus `screen.background`.
3. Hotspot-Geometrie kommt **ausschließlich** aus `hotspots.json`
   (`screens[screenId]` → Array `{id,label,kind,x,y,w,h}`, normalisiert 0–1,
   Ursprung oben-links). Auf die angezeigte Bildfläche skalieren.
4. Hotspot-Verhalten kommt aus `gameflow.json` (gematcht über `id`).

### 3a. Hotspots definiert der AUTOR selbst — du baust nur das Werkzeug

`hotspots.json` ist absichtlich **leer** (Platzhalter). Du (Claude Code)
generierst die Koordinaten **NICHT** automatisch. Der Autor zeichnet sie
selbst. Deine Aufgabe ist, dass das reibungslos geht:

1. Es liegt ein Hotspot-Editor bei: `tools/hotspot-editor.html`. Er ist
   funktionsfähig, scheitert aber an `file://` (relative Bildpfade laden
   nicht, wenn man die Datei nur doppelklickt — genau dieses Problem ist
   beim Autor schon aufgetreten).
2. **Richte einen lokalen Dev-Server ein** (z.B. `vite`, `python -m
   http.server`, o.ä.) mit Projektwurzel = `cruise-control/`, sodass
   `tools/hotspot-editor.html` über `http://localhost:…/tools/hotspot-editor.html`
   läuft und die Bilder aus `assets/` **tatsächlich laden**. Lege dafür ein
   `npm run editor`-Script (oder Äquivalent) an und dokumentiere den Befehl.
3. Prüfe den Editor real: alle 5 Screens laden ihr Bild, Zeichnen +
   Export funktionieren. Falls nötig, den Editor reparieren/verbessern
   (Pfad-Auflösung, UX) — er ist Teil des Projekts, kein heiliges Artefakt.
   Optional darf der Editor auch in eine Dev-Route der App integriert werden,
   solange der Autor weiterhin frei Rechtecke zieht und nach `hotspots.json`
   exportiert.
4. **Du füllst `hotspots.json` nicht.** Der Autor öffnet den laufenden Editor,
   zeichnet die Hotspots, exportiert `hotspots.json` und legt sie in die
   Projektwurzel. Danach baust/testest du das Spiel damit.
5. Damit der Autor verifizieren kann: im Spiel einen **Debug-Toggle** (Taste
   `H`) einbauen, der alle Hotspot-Rechtecke + Labels über der Szene
   einblendet.

> **Reihenfolge:** Erst Editor lauffähig servieren und dem Autor melden
> „Editor läuft unter <URL>, bitte Hotspots zeichnen + hotspots.json
> exportieren". Spielbau kann parallel laufen; finaler Spieltest erst
> NACHDEM die echte `hotspots.json` vom Autor da ist.

Grobe Lage der Objekte (nur zum Editor-Testen, NICHT als finale Koordinaten):
> - **start.png** — Arthur: Figur links (buntes Hemd, Handy). Beat: Figur rechts (Tarnkleidung, Sonnenbrille).
> - **prolog.png** — Grenzbeamter: am Schalter links. Scanner: Metalldetektor-Bogen Mitte. Snackautomat: rechts. Sitzbank: unten rechts.
> - **kapitel1.png** — Luca: lehnt links an der Treppe (Leopardenhemd). Handtuch: blau-weiß gestreift am Whirlpool-Rand rechts. Whirlpool: rechts Mitte. Cocktailbar: oben rechts (Neon "COCKTAILS"). VIP-Ausgang: oben rechts Treppe/Plattform.
> - **kapitel2.png** — Kellner: große Figur rechts (weiße Uniform). Telefon: schwarzes Wandtelefon links. Brotkorb: Wagen unten links. Captain: sitzt hinten am Tisch (Special Wine).
> - **kapitel3.png** — Captain: Figur links vorn (Mütze, pinker Drink). DJ Luca: Bühne hinten Mitte ("DJ LUCA"). Whirlpool: rechts mit Flamingo.

---

## 4. State Machine

Globaler State:
```
character : "arthur" | "beat"      (gesetzt im Startscreen)
screen    : aktueller Screen-id
flags     : Set<string>            (z.B. "prolog_solved")
inventory : Set<itemId>            (z.B. "handtuch")
activeItem: itemId | null          (für use-with)
ending    : "arthur" | "beat" | null
```

Screen-Ablauf: `start → prolog → kapitel1 → kapitel2 → kapitel3 → win`
(siehe `meta.screen_order`). Bei `win` Klick → zurück zu `start`, State reset.

### Effekte (in `result.effects` / `use_actions[].effects`)
| Effekt | Wirkung |
|---|---|
| `set_flag: X` | `flags.add(X)` |
| `unlock_hotspot: X` | Hotspot X wird ab jetzt nutzbar (Exit klickbar etc.) |
| `give_item: X` | `inventory.add(X)`, Item erscheint im Inventar-Bar |
| `remove_item: X` | aus Inventar entfernen |
| `goto: X` | Screenwechsel zu X (vorher ggf. Intro-Tafel) |
| `ending: X` | `ending = X` setzen (bestimmt Endbild) |

### Hotspot-Kinds (Feld `kind`)
- `select` — nur Startscreen. Klick: `set_character` + `goto`.
- `npc` — Klick öffnet Dialog (siehe §5). Telefon ist auch `npc`.
- `item` — Klick: `take` → `give_item`. Danach Hotspot verschwinden lassen
  (`consume_hotspot_after_take`) bzw. erst verfügbar nach `available_after_flag`.
- `target` — kein Direktklick-Effekt; nur gültiges Ziel für `use(item,target)`.
- `exit` — Klick: wenn `locked_until_flag` gesetzt & Flag fehlt →
  `locked_feedback`-Spruch (sprechen+anzeigen), KEIN Wechsel.
  Sonst `goto`.
- `flavor` — Klick: Spruch aus `screen.flavor[id][character]` (sprechen+anzeigen),
  sonst keine Wirkung.

---

## 5. Dialog-System

Pfad: `screen.dialogues[character]` für den NPC (Zuordnung via `_hotspot`,
sonst der einzige `npc` mit Dialog im Screen).

Ablauf:
1. `entry[]` der Reihe nach abspielen (Zeile = Text unten + TTS).
2. `options[]` als anklickbare Liste zeigen (Label).
3. Option gewählt → `lines[]` abspielen.
4. `result`:
   - `none` → zurück zur Optionsliste (Spieler kann andere wählen). Nichts ändert sich.
   - `solve` → `effects` ausführen, Dialog schließen.
5. Option mit `branch_on_flag` (nur kapitel1 / Beat / SCHWEIGEN):
   Flag gesetzt → `if_true` benutzen, sonst `if_false`.
6. Dialog nur öffnen wenn `requires_flag` (falls vorhanden) erfüllt ist
   (z.B. Telefon erst nach `telefon_klingelt`).

### Spezielle Optionen
- `id:"SCHWEIGEN"` — nur sichtbar wenn `character==="beat"`. Repräsentiert
  Beats Spezialfähigkeit. Sonst wie normale Option.
- `id:"ENDE"` — nur sichtbar wenn `character==="arthur"`. Arthurs „Gespräch
  sofort beenden".
- Alle anderen Optionen sind für beide sichtbar (sind aber ohnehin pro
  `character`-Block getrennt definiert).

### Sprecher / TTS
- `speaker:"*"` → **Regiezeile**: kursiv anzeigen, KEIN Name, NICHT sprechen.
- `speaker:"Arthur"|"Beat"` → Stimme aus `characters[x].tts`.
- NPC-Namen → Stimme aus `npc_voices[name]`.
- Pro Zeile: `utterance.lang/pitch/rate` aus dem jeweiligen Profil setzen.
- Nächste Zeile erst nach `utterance.onend` (oder Klick „weiter"/Skip).
- TTS-Toggle oben rechts (Default AN). Bei AUS nur Text, normales Timing
  (Zeile per Klick weiter).
- Voice-Auswahl: erste `getVoices()` mit `lang` startet mit `de`; sonst
  irgendeine; `voiceschanged`-Event abwarten (Chrome lädt async).

---

## 6. Puzzle-Logik pro Raum (Kurzreferenz — Details im JSON)

**Prolog:** Dialog Grenzbeamter. Beat: `SCHWEIGEN` löst. Arthur: `A` löst.
→ `prolog_solved`, Scanner frei → kapitel1.

**Kapitel 1 (Partydeck):**
- Beat: Dialoge bringen nichts. `take handtuch` → `use(handtuch,whirlpool)`
  → Flag `whirlpool_overflow` → Dialog Luca, `SCHWEIGEN` verzweigt jetzt auf
  `solve` → Armband, `armband_erhalten`, VIP-Ausgang frei.
- Arthur: Dialog Luca, Option `A` → Armband direkt → VIP-Ausgang frei.
- VIP-Ausgang → kapitel2.

**Kapitel 2 (Dinner):**
- Erster Klick auf Kellner ODER Captain → `first_interaction`
  (Kellner: „Private Veranstaltung", Telefon klingelt, Telefon-Hotspot frei).
- Telefon anklicken → Dialog. Beat: Option `C` (Homepage). Arthur: Option `ENDE`.
  → `telefon_geloest`, Brotkorb verfügbar.
- `take brot` → `use(brot,kellner)` (braucht `telefon_geloest`)
  → `kellner_isst`, Captain frei.
- Captain → kapitel3.

**Kapitel 3 (Finale):** Dialog Captain. Beat: `C` (anschreien). Arthur:
`B` (erklären). → `ending`, `goto win`.

**Win:** `endings[ending].background` zeigen + Caption. Klick → `start`.

---

## 7. Screen-Übergänge / Intro-Tafeln

Vor `prolog`, `kapitel1`, `kapitel2`, `kapitel3`: zuerst
`screen.intro_card` als Vollbild zeigen (Klick oder ~2.5 s → Raum).
`start` und `win` haben keine Intro-Tafel.

---

## 8. UI-Layout

- **Bühne:** Hintergrund zentriert, Seitenverhältnis erhalten (Letterbox,
  nicht verzerren). Hotspots als unsichtbare Klickflächen darüber; bei
  Hover dezenter Cursor-Wechsel + optional Label-Tooltip (`label`).
  Kein sichtbarer Rahmen um Hotspots im fertigen Spiel.
- **Dialogbox:** unten, untertitel-artig. Sprecher fett, dann Zeile.
  Regiezeilen kursiv/gedimmt. Optionsliste darüber oder darunter.
- **Inventar:** schmale Leiste (oben oder unten). Item-Klick = `activeItem`,
  Cursor zeigt Item; Klick auf `target`/Hotspot löst `use` aus; Rechtsklick/ESC
  hebt Auswahl auf. (Icons: einfache Platzhalter ok, `icon_hint` im JSON.)
- **TTS-Toggle:** oben rechts, persistent.
- Stil an der Spiel-DNA: Neon/CRT, dunkel, pixelig. Kein Corporate-Glatt.

---

## 9. Reihenfolge der Umsetzung (empfohlen)

1. Loader: `gameflow.json` + `hotspots.json`, State-Objekt, Screen-Router.
2. Renderer: Hintergrund + skalierte Hotspots aus `hotspots.json`.
3. Startscreen (character select) → prolog.
4. Dialog-Engine (entry/options/lines/result, `none` vs `solve`, branch/requires).
5. TTS-Layer (Stimmprofile, Queue, Toggle, Regiezeilen stumm).
6. Inventar + `use(item,target)`.
7. Restliche Räume + Effekte verdrahten.
8. Intro-Tafeln + Win + Replay-Reset.
9. Durchspielen **beide** Figuren komplett (siehe §10).

---

## 10. Akzeptanzkriterien (muss durchlaufen)

- [ ] Beide Figuren von Start bis Win **ohne Sackgasse** durchspielbar.
- [ ] Jede gesprochene Zeile: Text **und** Stimme; Regiezeilen stumm.
- [ ] Falsche Optionen (`none`) ändern nichts und führen zurück zur Auswahl.
- [ ] Beat-`SCHWEIGEN` in kapitel1 verzweigt korrekt am Flag `whirlpool_overflow`.
- [ ] Gesperrte Exits geben den `locked_feedback`-Spruch, wechseln NICHT.
- [ ] `use(handtuch,whirlpool)` und `use(brot,kellner)` funktionieren mit
      korrekten Vorbedingungs-Flags.
- [ ] Endbild entspricht gewählter Figur. Replay setzt State sauber zurück.
- [ ] Spiel startet auch wenn einzelne Hotspots in `hotspots.json` fehlen
      (Warnung statt Crash).
- [ ] TTS-Toggle aus → Spiel bleibt voll spielbar (Text-Timing per Klick).

---

## 11. Nicht tun

- Keine Assets neu generieren, filtern, skalieren-einbrennen.
- Keine Hotspot-Koordinaten in den Code schreiben.
- Dialogtext **wortgleich** aus `gameflow.json` übernehmen (Umlaute: das JSON
  nutzt teils `ae/oe/ue` — beim Anzeigen so lassen ODER konsistent zurück­mappen,
  aber Bedeutung/Wortlaut nicht ändern).
- Keine zusätzlichen Räume/Optionen erfinden.
