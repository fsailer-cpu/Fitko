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
npm test           # End-to-End-Test im Browser (benötigt playwright)
npm run icons      # Icons neu erzeugen (benötigt python3)
```

Für `npm test` einmalig `npm install` ausführen.

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
tests/e2e.mjs         Durchspielt den kompletten Ablauf im echten Browser
```

## Format für den Textimport

Unter **Daten → Alte Textdatei übernehmen** lässt sich der Inhalt der bisherigen
Datei einfügen. Erkannt wird:

```
17.09.2026 Oberkörper
Beinpresse 80x12, 80x12, 90x10
Latzug 3x10 @ 55
Bankdrücken 60 kg x 8
# Notiz: Schulter zwickt
```

- Eine Zeile, die mit einem Datum beginnt (`17.09.2026` oder `2026-09-17`),
  startet ein neues Training; der Rest der Zeile ist der Name.
- `80x12` heißt 80 kg mit 12 Wiederholungen.
- `3x10 @ 55` heißt drei Sätze à 10 Wiederholungen mit 55 kg.

Weicht deine Datei davon ab, lässt sich der Parser in `js/textio.js` anpassen.
