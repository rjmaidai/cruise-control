# WICHTIG — Bilder fehlen absichtlich

Dieses Paket enthält **keine Bilder** (damit es klein genug für den Upload
ist). Die Assets hast du bereits lokal aus dem ursprünglichen Download
`cruise_control.zip`.

## Was du einmalig tun musst

Lege neben die Textdateien einen Ordner `assets/` mit dieser Struktur an
und kopiere deine vorhandenen PNGs aus `cruise control/` dort hinein
(Dateien dabei umbenennen, klein geschrieben, keine Leerzeichen):

```
cruise-control/
├── START_HERE.md   BUILD_SPEC.md   gameflow.json   hotspots.json …
├── tools/hotspot-editor.html
└── assets/
    ├── start.png                 ←  Startbildschirm/Startbildschirm.PNG
    ├── levels/
    │   ├── prolog.png            ←  Levels/Prolog.PNG
    │   ├── kapitel1.png          ←  Levels/Kapitel1.PNG
    │   ├── kapitel2.png          ←  Levels/Kapitel2.PNG
    │   └── kapitel3.png          ←  Levels/Kapitel3.PNG
    ├── intro/
    │   ├── prolog.png            ←  IntroTafeln/IntroTafel_Prolog.PNG
    │   ├── kapitel1.png          ←  IntroTafeln/IntroTafel_Kapitel1.PNG
    │   ├── kapitel2.png          ←  IntroTafeln/IntroTafel_Kapitel2.PNG
    │   └── kapitel3.png          ←  IntroTafeln/IntroTafel_Kapitel3.PNG
    └── winner/
        ├── arthur.png            ←  WinnerScreens/Arthur Wins.PNG
        └── beat.png              ←  WinnerScreens/Beat Wins.PNG
```

(Die `characters/`-Sheets sind nur Referenz und werden im Spiel nicht
gebraucht — kannst du weglassen.)

## Schneller: Claude Code macht das Umbenennen

Du kannst auch einfach den ganzen originalen `cruise control`-Ordner neben
dieses Paket legen und Claude Code im START-Prompt sagen:

> „Die Original-Assets liegen im Ordner `../cruise control/`. Kopiere und
> benenne sie gemäß `ASSETS_HINWEIS.md` nach `assets/` um, bevor du startest."

Dann musst du selbst gar nichts verschieben.
