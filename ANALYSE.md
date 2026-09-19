# Analyse: Trainings-App fürs iPhone

Ausgangslage: Das Training wird heute in einer Textdatei mitgeschrieben. Gesucht
ist eine App, die alle Trainings speichert und aus einem alten Training per
Knopfdruck ein neues erzeugt, bei dem Maschine, Gewicht und Wiederholungen
angepasst werden können.

**Kurzfassung:** Machbar, und zwar gut. Umgesetzt ist Variante B (installierbare
Web-App), weil sie ohne Mac, ohne Apple-Entwicklerkonto und ohne App-Store-Prüfung
sofort auf dem iPhone landet. Der Umstieg auf eine native App bleibt offen, weil
das Datenmodell portierbar ist.

## 1. Die drei realistischen Wege

### A) Native iOS-App (Swift / SwiftUI + SwiftData)

| | |
|---|---|
| Voraussetzungen | Mac mit Xcode; für dauerhafte Installation ein Apple-Entwicklerkonto (ca. 99 € pro Jahr) |
| Ohne Entwicklerkonto | Per Xcode aufs eigene Gerät geladene Builds laufen nur 7 Tage und müssen dann neu installiert werden |
| Stärken | HealthKit, Apple Watch, Widgets, Live-Aktivitäten, iCloud-Sync zwischen Geräten, bestmögliches Bedienerlebnis |
| Schwächen | Höchster Aufwand, Mac nötig, Store-Prüfung bei Verteilung, Jahresgebühr |

Sinnvoll, sobald Uhr, Health-Anbindung oder Sync über mehrere Geräte wirklich
gebraucht werden.

### B) Installierbare Web-App (PWA) — **umgesetzt**

| | |
|---|---|
| Voraussetzungen | Irgendein HTTPS-Hosting für statische Dateien; Installation über Safari → Teilen → *Zum Home-Bildschirm* |
| Stärken | Kein Mac, kein Entwicklerkonto, keine Store-Prüfung, keine Gebühren; Vollbild ohne Safari-Leiste; funktioniert offline; Updates sind ein `git push` |
| Schwächen | Kein HealthKit, keine Apple Watch; Daten liegen im Browser-Speicher des Geräts und brauchen manuelle Sicherungen; Web-Push nur eingeschränkt |

Für den beschriebenen Zweck — Sätze mitschreiben, letztes Training übernehmen,
Zahlen anpassen — deckt das die Anforderungen vollständig ab.

### C) Fertige App aus dem Store (Strong, Hevy, Gymshark Workout …)

Kein Entwicklungsaufwand, viele Funktionen, Vorlagen-Mechanik ist Standard. Dafür
Abo-Kosten für die interessanten Teile, das Datenmodell ist fremdbestimmt und der
Trainingsverlauf liegt bei einem Anbieter. Als Vergleichsmaßstab nützlich, als
Antwort auf „kann ich das selbst bauen" nicht.

### Empfehlung

Variante B jetzt, Variante A als möglicher zweiter Schritt. Der Export als JSON
liefert den vollständigen Datenbestand, aus dem sich eine spätere native App
befüllen lässt. Nichts an dieser Entscheidung ist eine Sackgasse.

## 2. Datenmodell

Drei Ebenen, die genau der Realität im Studio entsprechen:

```
Training (Datum, Name, Notiz, Status)
  └── Übung (Name der Maschine, Notiz)
        └── Satz (Gewicht, Wiederholungen, erledigt, Beurteilung)
```

Eine Übung hat eine **Art**: `reps` zählt Wiederholungen, `time` zählt die
Haltedauer in Sekunden (Plank & Co.). Das Gewichtsfeld gilt in beiden Fällen
gleich — bei Halteübungen steht dort das Körpergewicht bzw. das Zusatzgewicht.
Die Art wird im Übungskatalog mitgeführt, damit dieselbe Maschine beim nächsten
Mal nicht neu umgestellt werden muss.

Wichtig dabei: ein Zeit-Satz fließt **nicht** ins kg-Volumen. 85 kg × 90 s wäre
keine mit Wiederholungen vergleichbare Zahl und würde jede Summe im Verlauf
unbrauchbar machen. Halteübungen werden stattdessen über die **Haltezeit**
ausgewiesen — im Training als eigene Zeile, in der Übungsübersicht als
„Längste Zeit" und „Haltezeit je Einheit".

Die **Beurteilung** je Satz ist dreiwertig: *am Limit* (in der Textdatei `-`),
*noch Reserven* (`+`) oder offen. Sie ist bewusst ein eigenes Feld und nicht
Teil der Notiz, weil sie die Grundlage für die Entscheidung „nächstes Mal mehr
Gewicht" ist und damit später auswertbar bleiben soll. Beim Übernehmen eines
Trainings als Vorlage wird sie zurückgesetzt — sie beschreibt eine konkrete
vergangene Leistung, keine Planung.

Dazu zwei Nebenlisten:

- **Vorlagen** – benannte Trainingspläne („Push A", „Beine"), gleich aufgebaut
  wie ein Training.
- **Übungskatalog** – alle je benutzten Maschinennamen, füttert die
  Autovervollständigung beim Eintragen.

Die JSON-Sicherung enthält genau diese Struktur, ist also auch mit bloßem Auge
lesbar und in jede andere Software überführbar.

### Warum der Satz die kleinste Einheit ist

Eine Textzeile wie `Beinpresse 80x12, 80x12, 90x10` ist für Menschen gut lesbar,
für Auswertungen aber wertlos: Bestwerte, Volumenverlauf und der Hinweis „letztes
Mal 90 kg" setzen voraus, dass Gewicht und Wiederholungen je Satz getrennt
vorliegen. Deshalb sind sie eigene Felder — und der Textexport erzeugt aus ihnen
wieder die gewohnte Zeile.

### Warum Vorlagen kopiert und nicht verknüpft werden

Ein neues Training aus einem alten erzeugt eine **vollständige Kopie**, keine
Referenz. Das ist bewusst so:

- Ein abgeschlossenes Training ist ein historischer Beleg. Würde eine spätere
  Gewichtsänderung auf das alte Training durchschlagen, wäre der Verlauf wertlos.
- Die Kopie darf sofort und beliebig verändert werden — Maschine tauschen, Satz
  löschen, Gewicht erhöhen — ohne Rückwirkung auf irgendetwas.

Vermerkt wird lediglich, woraus kopiert wurde (`sourceName`), als Orientierung im
Verlauf.

## 3. Bedienung im Studio

Zwischen zwei Sätzen bedient man ein Telefon einhändig, verschwitzt, oft ohne
Brille. Daraus folgen die konkreten Entscheidungen:

- **± Tasten statt Tastatur.** Gewicht in einstellbaren Schritten (Standard
  2,5 kg), Wiederholungen in Einerschritten. Direkte Eingabe bleibt möglich.
- **Alle Tippziele mindestens 44 px**, Eingabefelder mit 16 px Schriftgröße —
  darunter zoomt Safari beim Antippen automatisch hinein.
- **Ein großer Haken je Satz.** Erledigt/offen ist die einzige Zustandsänderung,
  die man mitten in der Übung braucht.
- **„Letztes Mal"-Zeile** direkt unter dem Maschinennamen, plus Knopf
  *↻ wie zuletzt*, der genau diese Sätze übernimmt.
- **Kein Neuaufbau der Seite beim Tippen.** Die Ansicht aktualisiert gezielt
  einzelne Elemente, damit der Cursor im Feld bleibt.
- **Dunkles Design**, weil es im Studio weniger blendet und weniger Akku zieht.

## 4. Technik und ihre Begründung

| Entscheidung | Grund |
|---|---|
| Kein Framework, kein Build-Schritt | Die App besteht aus Dateien, die ein Browser direkt lädt. Sie lässt sich in fünf Jahren noch öffnen und ändern, ohne eine Werkzeugkette wiederherzustellen. |
| `localStorage` statt IndexedDB | Der gesamte Datenbestand ist klein (ein Trainingsjahr liegt im Bereich weniger hundert Kilobyte). Synchrones Lesen und Schreiben macht den Code deutlich einfacher. |
| Service Worker mit „Netz zuerst" | Offline läuft die App aus dem Cache; online kommen Aktualisierungen sofort an, ohne dass man Caches von Hand leeren muss. |
| Hash-Routing (`#/training/…`) | Funktioniert unter jedem Pfad und auf jedem Hoster, ohne Server-Konfiguration für Rewrites. |
| Eine einzige Schreiboperation (`mutate`) | Jede Änderung geht durch eine Funktion, die speichert und die Ansicht benachrichtigt. Kein Zustand kann ungespeichert verlorengehen. |

## 5. Risiken und offene Punkte

**Datenverlust ist das reale Risiko.** Browser-Speicher auf iOS ist nicht
garantiert dauerhaft: „Website-Daten löschen" räumt ihn ab, ein Gerätewechsel
nimmt ihn nicht mit, und Safari räumt Speicher von Seiten auf, die lange nicht
benutzt werden. Deshalb ist der Export in der App prominent platziert. Wer das
nicht von Hand machen will, braucht Variante A mit iCloud oder eine
Server-Komponente — beides deutlich mehr Aufwand.

**Kein Sync zwischen Geräten.** Ein Training auf dem iPhone erscheint nicht auf
dem iPad. Für einen einzelnen Nutzer mit einem Gerät ist das kein Problem; sonst
wäre ein kleiner Server oder iCloud nötig.

**Keine Apple Watch und kein HealthKit.** Technisch für Web-Apps nicht erreichbar.

**Der Textimport ist auf die vorhandene Notiz zugeschnitten.** Er liest genau
das bisher benutzte Layout (Datumszeile, Übungsname auf eigener Zeile, darunter
je Zeile ein Satz `45 kg x 15`, nachgestellte Striche werden ignoriert) und
zusätzlich die verbreiteten Einzeiler `80x12` und `3x10 @ 55`. Zeilen, die zu
nichts passen, werden nicht verschluckt, sondern nach dem Import aufgelistet.
Das nachgestellte `-` bzw. `+` wird als Beurteilung des Satzes übernommen und
beim Export wieder genauso geschrieben.

## 6. Mögliche nächste Schritte

Nach Nutzen sortiert, keiner davon ist Voraussetzung für den Alltagsbetrieb:

1. **QR-Codes an Maschinen** – ein optionales Code-Feld je Maschine, einmal
   zugeordnet, danach scannen statt suchen. Braucht vorher die Information,
   was in den Codes des Studios tatsächlich steht.
2. **Pausentimer** zwischen den Sätzen, mit Ton und Vibration.
3. **Automatische Sicherung**: Erinnerung, wenn die letzte Sicherung älter als
   zwei Wochen ist.
4. **Persönliche Bestleistungen** hervorheben, wenn ein Satz den bisherigen
   Bestwert einer Maschine übertrifft.
5. **Übungsgruppen** (Brust, Rücken, Beine) für Auswertungen nach Muskelgruppe.
6. **Geschätztes 1RM** je Übung (Epley-Formel) als zusätzliche Fortschrittskurve.
7. **Sync**, falls ein zweites Gerät dazukommt — dann wird ein Server nötig.

## 7. Prüfung

Zwei Ebenen, beide über `npm test`:

- `tests/textio.test.mjs` prüft den Parser gegen die reale Trainingsnotiz:
  Titelzeile, Datum, sechs Übungen mit ihren Sätzen, nachgestellte Striche,
  mehrere Trainings in einer Datei, Übungsnamen die mit einer Zahl beginnen,
  die Beurteilungen `-` und `+`, und den Rundlauf Export → Import. 15 Tests.
- `tests/time.test.mjs` prüft die Halteübungen: mm:ss lesen und schreiben,
  dass Zeit nicht ins kg-Volumen fließt, die Haltezeit-Summen, und dass ein
  Datum nicht als Zeitangabe missverstanden wird. 9 Tests.
- `tests/e2e.mjs` spielt den gesamten Ablauf in einem echten Browser mit
  iPhone-Abmessungen durch: Training anlegen, Maschinen hinzufügen, Gewicht per
  Taste und per Eingabe ändern, Sätze ergänzen, abhaken und beurteilen,
  Training abschließen,
  daraus ein neues Training erzeugen und prüfen, dass die Werte übernommen und
  die Haken zurückgesetzt sind; dazu Reihenfolge ändern, löschen, Textimport der
  echten Notiz, Umschalten auf Zeit samt Übernahme in ein Folgetraining, und
  Datenerhalt nach Neustart. 28 Schritte.

Alles grün.
