// Benannte Vorlagen verwalten ("Push A", "Beine", …).

import { h, toast, confirmAction } from '../dom.js';
import { getState } from '../store.js';
import { refresh } from '../router.js';
import {
  deleteTemplate, renameTemplate, startWorkout, summarizeSets,
  sortedWorkouts, saveAsTemplate, formatDate,
} from '../model.js';

export function render() {
  const body = h('div');
  const templates = [...getState().templates].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  if (!templates.length) {
    body.append(h('div.empty',
      h('h2', 'Noch keine Vorlagen'),
      h('p', 'Eine Vorlage ist ein gespeicherter Trainingsplan mit Maschinen, ' +
             'Startgewichten und Wiederholungen. Du kannst jedes abgeschlossene ' +
             'Training unten als Vorlage sichern.')));
  }

  templates.forEach((tpl) => {
    body.append(h('div.card',
      h('div.row.row--between',
        h('div.grow',
          h('div.strong.truncate', tpl.name),
          h('div.small.dim', `${tpl.exercises.length} Übungen`)),
      ),
      h('hr.divider'),
      ...tpl.exercises.slice(0, 6).map((ex) => h('div.row.small',
        h('span.grow.truncate', ex.name || 'Ohne Namen'),
        h('span.dim', summarizeSets(ex.sets)))),
      tpl.exercises.length > 6
        ? h('div.small.dim', { style: { marginTop: '4px' } }, `+ ${tpl.exercises.length - 6} weitere`)
        : null,
      h('div.row', { style: { marginTop: '12px', gap: '8px' } },
        h('button.btn.btn--sm.grow', {
          type: 'button',
          onclick: () => {
            const w = startWorkout({ source: tpl });
            location.hash = `#/training/${w.id}`;
          },
        }, 'Training starten'),
        h('button.btn.btn--sm.btn--ghost', {
          type: 'button',
          onclick: () => {
            const name = window.prompt('Neuer Name:', tpl.name);
            if (!name?.trim()) return;
            renameTemplate(tpl.id, name.trim());
            refresh();
          },
        }, 'Umbenennen'),
        h('button.btn.btn--sm.btn--danger', {
          type: 'button',
          onclick: () => {
            if (!confirmAction(`Vorlage „${tpl.name}“ löschen?`)) return;
            deleteTemplate(tpl.id);
            refresh();
          },
        }, 'Löschen'),
      ),
    ));
  });

  const candidates = sortedWorkouts().filter((w) => w.exercises.length);
  if (candidates.length) {
    const select = h('select', { 'aria-label': 'Training auswählen' },
      ...candidates.slice(0, 50).map((w) =>
        h('option', { value: w.id }, `${w.name} – ${formatDate(w.date)}`)));

    body.append(
      h('div.section-title', 'Aus Training erzeugen'),
      h('div.card',
        h('label.field', h('span', 'Training'), select),
        h('button.btn.btn--ghost.btn--block', {
          type: 'button',
          onclick: () => {
            const source = candidates.find((w) => w.id === select.value);
            if (!source) return;
            const name = window.prompt('Name der Vorlage:', source.name);
            if (!name?.trim()) return;
            saveAsTemplate(source, name.trim());
            toast('Vorlage angelegt');
            refresh();
          },
        }, 'Als Vorlage speichern'),
      ));
  }

  return { title: 'Vorlagen', body };
}
