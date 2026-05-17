# START HERE — Befehl für Claude Code

Entpacke dieses Paket, öffne ein Terminal **im Ordner `cruise-control/`**,
starte Claude Code und kopiere diesen Prompt rein:

---

> Lies `BUILD_SPEC.md` und `ASSETS_HINWEIS.md` vollständig — das sind die
> verbindlichen Quellen. `gameflow.json` ist die komplette Spiel-Logik samt
> aller Dialoge, `hotspots.json` ist noch leer und wird NICHT von dir befüllt.
>
> Mach in dieser Reihenfolge:
>
> 0. Die Bilder fehlen im Paket. Die Original-Assets liegen im Ordner
>    `../cruise control/` (oder ich sage dir wo). Kopiere und benenne sie
>    gemäß `ASSETS_HINWEIS.md` nach `assets/` um. Erst danach weiter.
>
> 1. **Zuerst** den Hotspot-Editor (`tools/hotspot-editor.html`) per lokalem
>    Dev-Server lauffähig machen, sodass die Bilder aus `assets/` wirklich
>    laden (das ist beim file://-Öffnen gescheitert). Lege ein einfaches
>    Start-Script an und sag mir die exakte URL. Den Editor darfst du
>    reparieren/verbessern — aber die Hotspots zeichne ICH selbst darin.
>    Stopp dann und warte, bis ich dir die fertige `hotspots.json` gebe.
> 2. Parallel das Spiel bauen nach `BUILD_SPEC.md` (Tech-Stack §1, State
>    Machine §4, Dialog-System §5, TTS §5, Puzzle-Logik §6). Alle Dialoge
>    wortgleich aus `gameflow.json`. Assets sind final, nicht neu generieren.
> 3. Debug-Toggle Taste `H` einbauen (zeigt Hotspot-Rechtecke über der Szene),
>    damit ich meine gezeichneten Hotspots verifizieren kann.
> 4. Sobald ich `hotspots.json` geliefert habe: einbinden und beide Figuren
>    komplett durchspielen gegen die Akzeptanzkriterien in §10.
>
> Frag nach, wenn etwas in der Spec unklar ist, statt zu raten.

---

Danach: Editor-URL aus Claude Code im Browser öffnen, deine Hotspots zeichnen,
`hotspots.json` exportieren, in den `cruise-control/`-Ordner legen, Claude Code
sagen „hotspots.json ist da, mach weiter".
