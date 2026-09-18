// Backup, Import aus der alten Textdatei und Einstellungen.
// Die Daten liegen nur auf dem Gerät – deshalb ist der Export hier prominent.

import { h, toast, confirmAction } from '../dom.js';
import { getState, mutate, exportState, importState, resetAll } from '../store.js';
import { refresh } from '../router.js';
import { parseWorkoutText, workoutsToText } from '../textio.js';
import { sortedWorkouts, todayISO } from '../model.js';

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function render() {
  const body = h('div');
  const state = getState();

  /* Sicherung */

  body.append(
    h('div.section-title', 'Sicherung'),
    h('div.card',
      h('p.small.dim', { style: { marginTop: '0' } },
        'Alle Daten liegen ausschließlich auf diesem iPhone. Es gibt keinen ' +
        'Server und keine Synchronisierung. Lade dir regelmäßig eine Sicherung ' +
        'herunter (z. B. in iCloud Drive), sonst sind die Daten weg, wenn du ' +
        'die Website-Daten löschst oder das Gerät wechselst.'),
      h('div.stack',
        h('button.btn.btn--block', {
          type: 'button',
          onclick: () => {
            download(`fitko-backup-${todayISO()}.json`,
              JSON.stringify(exportState(), null, 2), 'application/json');
            toast('Sicherung erstellt');
          },
        }, '⭳ Sicherung (JSON) herunterladen'),
        h('button.btn.btn--ghost.btn--block', {
          type: 'button',
          onclick: () => {
            const text = workoutsToText(sortedWorkouts());
            download(`fitko-trainings-${todayISO()}.txt`, text, 'text/plain');
            toast('Textdatei erstellt');
          },
        }, '⭳ Als Textdatei herunterladen'),
      )),
  );

  /* Wiederherstellen */

  const jsonFile = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    onchange: async () => {
      const file = jsonFile.files?.[0];
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        const mode = confirmAction(
          'OK = bestehende Daten ersetzen\nAbbrechen = Sicherung dazumischen')
          ? 'replace' : 'merge';
        importState(raw, mode);
        toast('Sicherung eingespielt');
        refresh();
      } catch (err) {
        toast('Datei konnte nicht gelesen werden');
        console.error(err);
      } finally {
        jsonFile.value = '';
      }
    },
  });

  body.append(
    h('div.section-title', 'Wiederherstellen'),
    h('div.card',
      h('label.field', { style: { marginBottom: '0' } },
        h('span', 'Sicherungsdatei (JSON) auswählen'), jsonFile)),
  );

  /* Textimport */

  const textArea = h('textarea', {
    placeholder: '17.09.2026 Oberkörper\nBeinpresse 80x12, 80x12, 90x10\nLatzug 3x10 @ 55',
    style: { minHeight: '140px', fontFamily: 'ui-monospace, monospace', fontSize: '14px' },
  });
  const report = h('div.small.dim');

  body.append(
    h('div.section-title', 'Alte Textdatei übernehmen'),
    h('div.card',
      h('p.small.dim', { style: { marginTop: '0' } },
        'Füge den Inhalt deiner bisherigen Trainings-Textdatei ein. Erkannt werden ' +
        'Datumszeilen sowie Sätze wie „80x12“, „80 kg x 12“ oder „3x10 @ 55“.'),
      textArea,
      h('button.btn.btn--ghost.btn--block', {
        type: 'button',
        style: { marginTop: '10px' },
        onclick: () => {
          const { workouts, warnings } = parseWorkoutText(textArea.value);
          if (!workouts.length) { toast('Nichts erkannt'); return; }
          const sets = workouts.reduce((n, w) =>
            n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
          if (!confirmAction(`${workouts.length} Trainings mit ${sets} Sätzen übernehmen?`)) return;
          mutate((s) => s.workouts.push(...workouts));
          report.replaceChildren(
            h('p', `${workouts.length} Trainings importiert.`),
            ...warnings.slice(0, 10).map((w) => h('div', `⚠︎ ${w}`)),
            warnings.length > 10 ? h('div', `… und ${warnings.length - 10} weitere Hinweise`) : null,
          );
          toast('Import fertig');
        },
      }, 'Text einlesen'),
      report),
  );

  /* Einstellungen */

  const stepSelect = h('select', { 'aria-label': 'Schrittweite' },
    ...[0.5, 1, 1.25, 2.5, 5].map((v) =>
      h('option', { value: String(v), selected: Number(state.settings.weightStep) === v }, `${v} kg`)));
  stepSelect.addEventListener('change', () => {
    mutate((s) => { s.settings.weightStep = Number(stepSelect.value); });
    toast('Schrittweite gespeichert');
  });

  body.append(
    h('div.section-title', 'Einstellungen'),
    h('div.card',
      h('label.field', { style: { marginBottom: '0' } },
        h('span', 'Schrittweite der Gewichts-Tasten'), stepSelect)),
  );

  /* Status + Zurücksetzen */

  const workoutCount = state.workouts.length;
  const setCount = state.workouts.reduce((n, w) =>
    n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);

  body.append(
    h('div.section-title', 'Bestand'),
    h('div.card.small.dim',
      h('div.row.row--between', h('span', 'Trainings'), h('span.strong', String(workoutCount))),
      h('div.row.row--between', h('span', 'Sätze'), h('span.strong', String(setCount))),
      h('div.row.row--between', h('span', 'Vorlagen'), h('span.strong', String(state.templates.length))),
      h('div.row.row--between', h('span', 'Übungen'), h('span.strong', String(state.catalog.length))),
    ),
    h('button.btn.btn--danger.btn--block', {
      type: 'button',
      style: { marginTop: '10px' },
      onclick: () => {
        if (!confirmAction('Wirklich ALLE Daten auf diesem Gerät löschen?')) return;
        if (!confirmAction('Letzte Warnung: Es gibt kein Zurück ohne Sicherung.')) return;
        resetAll();
        toast('Alles gelöscht');
        location.hash = '#/';
      },
    }, 'Alle Daten löschen'),
  );

  return { title: 'Daten', body };
}
