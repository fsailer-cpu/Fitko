// "Neues Training": leer starten, oder ein altes Training bzw. eine Vorlage
// als Ausgangspunkt nehmen. Das ist der Kern des Ablaufs – Maschinen, Gewichte
// und Wiederholungen werden übernommen und lassen sich danach frei ändern.

import { h, toast } from '../dom.js';
import { getState } from '../store.js';
import {
  sortedWorkouts, startWorkout, lastFinishedWorkout,
  formatDate, summarizeExercise,
} from '../model.js';

function begin(source, name) {
  const w = startWorkout({ source, name });
  toast(source ? `Übernommen aus „${source.name}“` : 'Training gestartet');
  location.hash = `#/training/${w.id}`;
}

function sourceCard(source, subtitle, badge) {
  const preview = source.exercises.slice(0, 4);
  return h('button.card.card--tap', { type: 'button', onclick: () => begin(source) },
    h('div.row.row--between',
      h('div.grow',
        h('div.strong.truncate', source.name),
        h('div.small.dim', subtitle),
      ),
      badge ? h('span.badge', badge) : null,
    ),
    preview.length ? h('hr.divider') : null,
    ...preview.map((ex) => h('div.row.small',
      h('span.grow.truncate', ex.name || 'Ohne Namen'),
      h('span.dim', summarizeExercise(ex)),
    )),
    source.exercises.length > preview.length
      ? h('div.small.dim', { style: { marginTop: '6px' } },
          `+ ${source.exercises.length - preview.length} weitere`)
      : null,
  );
}

export function render() {
  const body = h('div');
  const state = getState();
  const last = lastFinishedWorkout();
  const history = sortedWorkouts().filter((w) => w.status !== 'active' && w.id !== last?.id);

  body.append(
    h('div.section-title', 'Von vorne'),
    h('button.btn.btn--ghost.btn--block', {
      type: 'button',
      onclick: () => begin(null, 'Training'),
    }, 'Leeres Training starten'),
  );

  if (last) {
    body.append(
      h('div.section-title', 'Letztes Training wiederholen'),
      sourceCard(last, formatDate(last.date), 'zuletzt'),
    );
  }

  if (state.templates.length) {
    body.append(h('div.section-title', 'Vorlagen'));
    state.templates
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .forEach((tpl) => body.append(
        sourceCard(tpl, `${tpl.exercises.length} Übungen`, 'Vorlage'),
      ));
  }

  if (history.length) {
    body.append(h('div.section-title', 'Älteres Training als Vorlage'));

    const filter = h('input', {
      type: 'text',
      placeholder: 'Training suchen …',
      oninput: () => {
        const q = filter.value.trim().toLowerCase();
        list.replaceChildren(...cardsFor(q));
      },
    });

    const cardsFor = (q) => {
      const hits = history.filter((w) => !q
        || w.name.toLowerCase().includes(q)
        || w.exercises.some((ex) => (ex.name || '').toLowerCase().includes(q)));
      if (!hits.length) return [h('p.dim.small', { style: { padding: '8px 4px' } }, 'Kein Treffer.')];
      return hits.slice(0, 30).map((w) => sourceCard(w, formatDate(w.date)));
    };

    const list = h('div', ...cardsFor(''));
    body.append(filter, list);
  }

  if (!last && !state.templates.length && !history.length) {
    body.append(h('p.dim.small', { style: { padding: '12px 4px' } },
      'Sobald du dein erstes Training abgeschlossen hast, erscheint es hier ' +
      'als Vorlage für das nächste.'));
  }

  return { title: 'Neues Training', body };
}
