// Startbildschirm: laufendes Training + Verlauf aller absolvierten Trainings.

import { h } from '../dom.js';
import {
  activeWorkout, sortedWorkouts, formatDate, formatDuration,
  workoutVolume, workoutSetCount, formatWeight,
} from '../model.js';

function workoutCard(w) {
  const { total, done } = workoutSetCount(w);
  const volume = workoutVolume(w);
  return h('a.card.card--tap', { href: `#/training/${w.id}` },
    h('div.row.row--between',
      h('div.grow',
        h('div.strong.truncate', w.name),
        h('div.small.dim', formatDate(w.date)),
      ),
      w.status === 'active' ? h('span.badge.badge--warn', 'läuft') : null,
    ),
    h('hr.divider'),
    h('div.row.small.dim',
      h('span.grow', `${w.exercises.length} Übungen · ${done}/${total} Sätze`),
      h('span', `${formatWeight(volume)} Volumen`),
    ),
    w.sourceName ? h('div.small.dim', { style: { marginTop: '6px' } }, `Vorlage: ${w.sourceName}`) : null,
  );
}

export function render() {
  const active = activeWorkout();
  const finished = sortedWorkouts().filter((w) => w.status !== 'active');
  const body = h('div');

  if (active) {
    body.append(
      h('div.section-title', 'Läuft gerade'),
      workoutCard(active),
      h('a.btn.btn--block', { href: `#/training/${active.id}` }, 'Training fortsetzen'),
    );
  } else {
    body.append(h('a.btn.btn--block', { href: '#/neu' }, '＋ Neues Training starten'));
  }

  if (!finished.length && !active) {
    body.append(h('div.empty',
      h('h2', 'Noch keine Trainings'),
      h('p', 'Starte dein erstes Training. Jedes weitere kannst du dann ' +
             'per Knopfdruck aus einem alten übernehmen und anpassen.'),
    ));
    return { title: 'Fitko', body };
  }

  if (finished.length) {
    const total = finished.reduce((sum, w) => sum + workoutVolume(w, false), 0);
    body.append(
      h('div.section-title', `Verlauf · ${finished.length} Trainings`),
      h('div.card.small.dim',
        h('div.row.row--between',
          h('span', 'Gesamtvolumen'),
          h('span.strong', { style: { color: 'var(--text)' } }, formatWeight(total)),
        ),
        finished[0].finishedAt && finished[0].startedAt
          ? h('div.row.row--between', { style: { marginTop: '4px' } },
              h('span', 'Letzte Dauer'),
              h('span', formatDuration(finished[0].finishedAt - finished[0].startedAt) || '–'))
          : null,
      ),
      ...finished.map(workoutCard),
    );
  }

  return { title: 'Fitko', body };
}
