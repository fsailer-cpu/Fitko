# Fitko – Trainingstagebuch

Ersetzt die Trainings-Textdatei durch eine App, die du auf dem iPhone-Homescreen
installierst. Kernablauf: **altes Training auswählen → als Vorlage übernehmen →
Maschine, Gewicht und Wiederholungen anpassen → abhaken.**

Die Analyse der Umsetzungsvarianten und die Begründung der Architektur stehen in
[ANALYSE.md](ANALYSE.md).

## Was die App kann

- **Trainings protokollieren** – beliebig viele Übungen, je Übung beliebig viele
  Sätze mit Gewicht und Wiederholungen, dazu Notizen und Datum.
- **Aus einem alten Training ein neues machen** – das letzte Training, eine
  benannte Vorlage oder ein beliebiges Training aus dem Verlauf wird kopiert,
  inklusive aller Gewichte und Wiederholungen. Die Haken sind zurückgesetzt,
  alles andere lässt sich frei ändern.
- **Anpassen ohne Tippen** – ± Tasten für Gewicht (Schrittweite einstellbar,
  Standard 2,5 kg) und Wiederholungen; die Zahl lässt sich auch direkt eingeben.
- **„Letztes Mal"-Hinweis** – bei jeder Maschine steht, was du dort zuletzt
  geschafft hast, plus ein Knopf, der genau diese Sätze übernimmt.
- **Zeit statt Wiederholungen** – für Plank und ähnliche Halteübungen: ein Tipp
  auf die Spaltenüberschrift „Wdh." stellt die Übung auf **mm:ss** um, die
  ± Tasten gehen dann in 5-Sekunden-Schritten. Das Gewichtsfeld bleibt
  unverändert — dort trägst du dein Körpergewicht ein, bei Zusatzgewicht
  einfach mehr. Die App merkt sich die Art je Maschine, „Plank" ist beim
  nächsten Mal automatisch wieder eine Zeitübung.
- **Limit oder Reserve je Satz** – der ±-Knopf hält fest, ob du am Limit warst
  (**−**) oder noch Luft hattest und nächstes Mal zulegen kannst (**+**). Die
  Markierung wird aus der Textdatei übernommen und auch wieder so exportiert.
  Sie gilt der damaligen Leistung und wird deshalb beim Übernehmen als Vorlage
  bewusst nicht mitkopiert.
- **Fortschritt je Maschine** – Bestwert, Anzahl Einheiten und Volumen-Verlauf.
- **Offline** – funktioniert ohne Netz, auch im Keller-Fitnessstudio.
- **Sicherung** – Export als JSON (vollständig) und als Textdatei (lesbar);
  Import einer JSON-Sicherung und Übernahme der bisherigen Textdatei.

## Auf dem iPhone installieren

1. Die App irgendwo statisch hosten (siehe unten) und die URL in **Safari** öffnen
   – nicht in Chrome, nur Safari darf auf dem Homescreen installieren.
2. **Teilen** (Pfeil-Symbol) → **Zum Home-Bildschirm**.
3. Die App startet danach im Vollbild ohne Safari-Leiste und läuft offline.

Wichtig: Die Daten liegen ausschließlich auf dem Gerät. Lade dir unter **Daten →
Sicherung** regelmäßig eine JSON-Datei herunter (z. B. in iCloud Drive). Ohne
Sicherung sind die Trainings weg, wenn du die Website-Daten löschst oder das
Gerät wechselst.

## Hosting

Es ist eine statische Seite – kein Server, kein Build-Schritt. Alles, was HTTPS
ausliefert, genügt.

**GitHub Pages:** Der Workflow in `.github/workflows/pages.yml` veröffentlicht
den Stand des Branches automatisch. In den Repository-Einstellungen unter
*Settings → Pages* als Quelle *GitHub Actions* wählen. Bei einem privaten
Repository ist GitHub Pages kostenpflichtig – Alternativen sind Netlify,
Cloudflare Pages oder Vercel (alle mit kostenlosem Tarif für statische Seiten).

## Lokal entwickeln

```bash
npm start          # http://localhost:8080
npm test           # Parser-Tests + End-to-End-Test im Browser
npm run test:unit  # nur die Parser-Tests, ohne Browser
npm run icons      # Icons neu erzeugen (benötigt python3)
```

`npm run test:unit` läuft ohne weitere Abhängigkeiten. Für den
End-to-End-Test einmalig `npm install` ausführen (installiert Playwright).

## Aufbau

```
index.html            Gerüst: Kopfzeile, Ansichtsbereich, Tab-Leiste
css/app.css           Gesamtes Styling (dunkel, iPhone-Safe-Areas, 44-px-Ziele)
js/app.js             Einstiegspunkt: Routen, Kopfzeile, Service-Worker
js/router.js          Hash-Routing
js/store.js           Persistenz in localStorage, einzige Schreiboperation
js/model.js           Fachlogik: Trainings, Vorlagen, Übungen, Auswertung
js/textio.js          Import/Export im Klartext
js/dom.js             Kleine DOM-Helfer statt Framework
js/views/             Je Bildschirm eine Datei
sw.js                 Service Worker für den Offline-Betrieb
tools/make-icons.py   Erzeugt die App-Icons ohne externe Bibliotheken
tests/textio.test.mjs Prüft den Parser gegen die bisherige Trainingsnotiz
tests/e2e.mjs         Durchspielt den kompletten Ablauf im echten Browser
```

## Format für den Textimport

Unter **Daten → Alte Textdatei übernehmen** lässt sich der Inhalt der bisherigen
Notiz einfügen. Gelesen wird genau das bisher verwendete Layout:

```
Training Fitko
21.05.2026
Abductor Leg Extension Oberschenkel
45 kg x 15
55 kg x 15
65 kg x 15 -

Oberarme zu sich ziehen
35 kg x 12
45 kg x 10
```

Die Regeln:

- Zeilen **vor dem ersten Datum** sind der Titel der Datei und werden zum Namen
  der Trainings.
- Eine **Datumszeile** (`21.05.2026` oder `2026-05-21`) startet ein neues
  Training; steht dahinter noch Text, wird das der Name.
- Eine Zeile, die **nicht mit einer Zahl beginnt**, ist der Name einer Übung.
- Eine Zeile wie `45 kg x 15` ist ein **Satz** der zuletzt genannten Übung.
- Ein **nachgestelltes `-` oder `+`** ist die Beurteilung des Satzes:
  `-` heißt am Limit, `+` heißt noch Reserven.
- Steht statt der Wiederholungen eine **Zeit** (`85 kg x 01:30`, `01:45` oder
  `90 s`), wird die Übung als Halteübung geführt. Auch `3 x 01:30 @ 85` geht.
- Leerzeilen trennen nur optisch und werden übersprungen.

Zusätzlich verstanden, weil verbreitet: `Beinpresse 80x12, 80x12, 90x10` (Name
und Sätze in einer Zeile) und `Latzug 3x10 @ 55` (drei Sätze à 10 Wiederholungen
mit 55 kg). Zeilen, die zu nichts passen, werden nicht verschluckt, sondern
nach dem Import als Hinweis aufgelistet.

Der Textexport erzeugt wieder genau dieses Layout, lässt sich also erneut
einlesen.
