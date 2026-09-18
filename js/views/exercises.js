// Maschinen-/Übungsliste und Fortschritt pro Übung.

import { h, confirmAction } from '../dom.js';
import { getState } from '../store.js';
import { refresh } from '../router.js';
import {
  allExerciseNames, exerciseHistory, rememberExercise, deleteCatalogEntry,
  formatDate, formatWeight, summarizeSets,
} from '../model.js';

export function renderList() {
  const body = h('div');
  const names = allExerciseNames();

  const input = h('input', {
    type: 'text',
    placeholder: 'Neue Maschine anlegen …',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } },
  });

  function add() {
    const name = input.value.trim();
    if (!name) return;
    rememberExercise(name);
    input.value = '';
    refresh();
  }

  body.append(h('div.card',
    h('div.row', { style: { gap: '8px' } },
      h('div.grow', input),
      h('button.btn.btn--sm', { type: 'button', onclick: add }, 'Anlegen'))));

  if (!names.length) {
    body.append(h('div.empty',
      h('h2', 'Noch keine Übungen'),
      h('p', 'Maschinen landen automatisch hier, sobald du sie im Training benutzt.')));
    return { title: 'Übungen', body };
  }

  const search = h('input', {
    type: 'text',
    placeholder: 'Suchen …',
    oninput: () => paint(),
  });

  const list = h('div');

  function paint() {
    const q = search.value.trim().toLowerCase();
    const hits = names.filter((n) => !q || n.toLowerCase().includes(q));
    list.replaceChildren(...hits.map((name) => {
      const history = exerciseHistory(name);
      const best = history.reduce((m, e) => Math.max(m, e.topWeight), 0);
      const catalogEntry = getState().catalog.find((c) => c.name.toLowerCase() === name.toLowerCase());
      const unused = history.length === 0;

      return h('div.card',
        h('div.row',
          h('a.grow', {
            href: `#/uebung/${encodeURIComponent(name)}`,
            style: { color: 'inherit', textDecoration: 'none', minWidth: '0' },
          },
            h('div.strong.truncate', name),
            h('div.small.dim', history.length
              ? `${history.length}× trainiert · Bestwert ${formatWeight(best)}`
              : 'noch nicht trainiert')),
          unused && catalogEntry
            ? h('button.btn.btn--sm.btn--danger', {
                type: 'button',
                onclick: () => {
                  if (!confirmAction(`„${name}“ aus der Liste entfernen?`)) return;
                  deleteCatalogEntry(catalogEntry.id);
                  refresh();
                },
              }, 'Löschen')
            : h('span.dim', '›'),
        ));
    }));
  }

  paint();
  body.append(h('div.section-title', `${names.length} Übungen`), search, list);
  return { title: 'Übungen', body };
}

export function renderDetail({ name }) {
  const history = exerciseHistory(name);
  const body = h('div');

  if (!history.length) {
    body.append(h('div.empty',
      h('h2', name),
      h('p', 'Für diese Übung gibt es noch keine Einträge.')));
    return { title: name, back: '#/uebungen', body };
  }

  const best = history.reduce((m, e) => Math.max(m, e.topWeight), 0);
  const maxVolume = history.reduce((m, e) => Math.max(m, e.volume), 0) || 1;

  body.append(h('div.card',
    h('div.row.row--between',
      h('span.dim.small', 'Bestes Gewicht'),
      h('span.strong', formatWeight(best))),
    h('div.row.row--between', { style: { marginTop: '4px' } },
      h('span.dim.small', 'Einheiten'),
      h('span.strong', String(history.length))),
    h('div.row.row--between', { style: { marginTop: '4px' } },
      h('span.dim.small', 'Zuletzt'),
      h('span.strong', formatDate(history[0].date))),
  ));

  body.append(
    h('div.section-title', 'Volumen je Einheit'),
    h('div.card',
      h('div.bars', ...history.slice(0, 12).reverse().map((entry) => h('div.bar',
        h('span.dim', formatDate(entry.date).replace(/^\w+,?\s*/, '')),
        h('div.bar__track', h('div.bar__fill', {
          style: { width: `${Math.max(3, Math.round((entry.volume / maxVolume) * 100))}%` },
        })),
        h('span.dim', formatWeight(entry.volume)),
      )))),
  );

  body.append(h('div.section-title', 'Alle Einträge'));
  history.forEach((entry) => body.append(
    h('a.card.card--tap', { href: `#/training/${entry.workoutId}` },
      h('div.row.row--between',
        h('div.grow',
          h('div.strong.small', formatDate(entry.date)),
          h('div.small.dim.truncate', entry.workoutName)),
        h('span.badge', formatWeight(entry.topWeight))),
      h('div.small.dim', { style: { marginTop: '6px' } }, summarizeSets(entry.sets)),
    )));

  return { title: name, back: '#/uebungen', body };
}
