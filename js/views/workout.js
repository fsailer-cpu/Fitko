// Der Trainings-Editor. Hier werden Maschine, Gewicht und Wiederholungen
// eingetragen und angepasst. Die Ansicht aktualisiert gezielt einzelne
// Knoten statt neu zu rendern, damit der Fokus in Eingabefeldern erhalten
// bleibt, während getippt wird.

import { h, toast, confirmAction, buzz } from '../dom.js';
import { getState } from '../store.js';
import { refresh, setTitle } from '../router.js';
import {
  getWorkout, updateWorkout, finishWorkout, reopenWorkout, deleteWorkout,
  saveAsTemplate, startWorkout, makeSet, makeExercise, rememberExercise, allExerciseNames,
  lastPerformance, summarizeSets, formatDate, formatWeight,
  workoutVolume, workoutSetCount, nextEffort, EFFORT_SIGN, EFFORT_LABEL,
} from '../model.js';

const DATALIST_ID = 'bekannte-uebungen';

function step() {
  return Number(getState().settings.weightStep) || 2.5;
}

/* ------------------------------------------------------------------ */
/* Satz-Zeile                                                          */
/* ------------------------------------------------------------------ */

function numberStepper({ value, stepBy, min = 0, decimals = 2, onchange, label }) {
  const input = h('input', {
    type: 'number',
    inputmode: 'decimal',
    step: stepBy,
    min,
    value,
    'aria-label': label,
    onchange: () => commit(Number(input.value)),
  });

  const round = (n) => Number(Math.max(min, n).toFixed(decimals));

  function commit(next) {
    const val = Number.isFinite(next) ? round(next) : min;
    input.value = String(val);
    onchange(val);
  }

  const bump = (delta) => () => {
    buzz();
    commit(round((Number(input.value) || 0) + delta));
  };

  return h('div.stepper',
    h('button', { type: 'button', 'aria-label': `${label} verringern`, onclick: bump(-stepBy) }, '−'),
    input,
    h('button', { type: 'button', 'aria-label': `${label} erhöhen`, onclick: bump(stepBy) }, '+'),
  );
}

function setRow(workoutId, ex, set, index, onStructureChange, onTotals) {
  const row = h('div.setrow', { class: set.done ? 'setrow--done' : '' });

  const doneBtn = h('button.setdone', {
    type: 'button',
    'aria-pressed': String(Boolean(set.done)),
    'aria-label': `Satz ${index + 1} erledigt`,
    onclick: () => {
      buzz(12);
      updateWorkout(workoutId, (w) => {
        const s = findSet(w, ex.id, set.id);
        if (s) s.done = !s.done;
      });
      const now = findSet(getWorkout(workoutId), ex.id, set.id);
      doneBtn.setAttribute('aria-pressed', String(Boolean(now?.done)));
      row.classList.toggle('setrow--done', Boolean(now?.done));
      onTotals();
    },
  }, '✓');

  const effortBtn = h('button.seteffort', {
    type: 'button',
    onclick: () => {
      buzz();
      updateWorkout(workoutId, (w) => {
        const s = findSet(w, ex.id, set.id);
        if (s) s.effort = nextEffort(s.effort);
      });
      paintEffort();
    },
  });

  function paintEffort() {
    const now = findSet(getWorkout(workoutId), ex.id, set.id);
    const effort = now?.effort ?? null;
    effortBtn.textContent = effort ? EFFORT_SIGN[effort] : '·';
    effortBtn.dataset.effort = effort || '';
    effortBtn.setAttribute('aria-label',
      `Satz ${index + 1}: ${effort ? EFFORT_LABEL[effort] : 'nicht beurteilt'}`);
    effortBtn.title = effort ? EFFORT_LABEL[effort] : 'Wie war der Satz?';
  }
  paintEffort();

  row.append(
    h('button.setrow__no', {
      type: 'button',
      title: 'Satz löschen',
      'aria-label': `Satz ${index + 1} löschen`,
      onclick: () => {
        if (ex.sets.length <= 1) { toast('Mindestens ein Satz muss bleiben'); return; }
        updateWorkout(workoutId, (w) => {
          const e = w.exercises.find((x) => x.id === ex.id);
          if (e) e.sets = e.sets.filter((s) => s.id !== set.id);
        });
        onStructureChange();
      },
    }, String(index + 1)),
    numberStepper({
      value: set.weight,
      stepBy: step(),
      decimals: 2,
      label: 'Gewicht',
      onchange: (val) => {
        updateWorkout(workoutId, (w) => {
          const s = findSet(w, ex.id, set.id);
          if (s) s.weight = val;
        });
        onTotals();
      },
    }),
    numberStepper({
      value: set.reps,
      stepBy: 1,
      decimals: 0,
      label: 'Wiederholungen',
      onchange: (val) => {
        updateWorkout(workoutId, (w) => {
          const s = findSet(w, ex.id, set.id);
          if (s) s.reps = Math.round(val);
        });
        onTotals();
      },
    }),
    doneBtn,
    effortBtn,
  );
  return row;
}

function findSet(workout, exId, setId) {
  return workout?.exercises.find((e) => e.id === exId)?.sets.find((s) => s.id === setId) || null;
}

/* ------------------------------------------------------------------ */
/* Übungs-Block                                                        */
/* ------------------------------------------------------------------ */

function exerciseCard(workoutId, exId, rerenderExercise, onTotals, moveExercise) {
  const workout = getWorkout(workoutId);
  const ex = workout.exercises.find((e) => e.id === exId);
  if (!ex) return h('div');

  const index = workout.exercises.indexOf(ex);
  const card = h('div.card.exercise');

  const nameInput = h('input', {
    type: 'text',
    list: DATALIST_ID,
    placeholder: 'Maschine / Übung',
    value: ex.name,
    'aria-label': 'Maschine oder Übung',
    oninput: () => updateWorkout(workoutId, (w) => {
      const e = w.exercises.find((x) => x.id === exId);
      if (e) e.name = nameInput.value;
    }),
    onchange: () => {
      rememberExercise(nameInput.value);
      rerenderExercise();
    },
  });

  const iconBtn = (label, symbol, onclick, disabled = false) =>
    h('button.iconbtn', { type: 'button', 'aria-label': label, title: label, onclick, disabled }, symbol);

  const total = workout.exercises.length;

  card.append(
    h('div.exercise__head',
      h('span.dim.small', { style: { minWidth: '16px' } }, String(index + 1)),
      h('div.grow', nameInput),
      iconBtn('Nach oben schieben', '↑', () => moveExercise(exId, -1), index === 0),
      iconBtn('Nach unten schieben', '↓', () => moveExercise(exId, +1), index === total - 1),
      iconBtn('Übung entfernen', '✕', () => {
        if (!confirmAction(`„${ex.name || 'Übung'}“ aus dem Training entfernen?`)) return;
        updateWorkout(workoutId, (w) => {
          w.exercises = w.exercises.filter((x) => x.id !== exId);
        });
        moveExercise(null, 0);
      }),
    ),
  );

  const previous = lastPerformance(ex.name, workoutId);
  if (previous) {
    card.append(h('p.exercise__hint',
      `Letztes Mal (${formatDate(previous.workout.date)}): ${summarizeSets(previous.exercise.sets)}`));
  }

  const list = h('div.setlist');
  const header = h('div.sethead',
    h('span', '#'),
    h('span', 'Gewicht'),
    h('span', 'Wdh.'),
    h('span', { 'aria-label': 'erledigt' }, '✓'),
    h('span', { 'aria-label': 'Gefühl' }, '±'),
  );

  const paint = () => {
    const fresh = getWorkout(workoutId).exercises.find((e) => e.id === exId);
    list.replaceChildren(
      ...fresh.sets.map((s, i) => setRow(workoutId, fresh, s, i, paint, onTotals)),
    );
    onTotals();
  };
  paint();

  card.append(header, list);

  card.append(h('div.row', { style: { marginTop: '10px', gap: '8px' } },
    h('button.btn.btn--sm.btn--ghost.grow', {
      type: 'button',
      onclick: () => {
        const fresh = getWorkout(workoutId).exercises.find((e) => e.id === exId);
        const lastSet = fresh.sets[fresh.sets.length - 1];
        updateWorkout(workoutId, (w) => {
          const e = w.exercises.find((x) => x.id === exId);
          if (e) e.sets.push(makeSet(lastSet?.weight ?? 0, lastSet?.reps ?? 10));
        });
        paint();
      },
    }, '＋ Satz'),
    previous ? h('button.btn.btn--sm.btn--ghost', {
      type: 'button',
      title: 'Sätze vom letzten Mal übernehmen',
      onclick: () => {
        updateWorkout(workoutId, (w) => {
          const e = w.exercises.find((x) => x.id === exId);
          if (e) e.sets = previous.exercise.sets.map((s) => makeSet(s.weight, s.reps));
        });
        paint();
        toast('Sätze vom letzten Mal übernommen');
      },
    }, '↻ wie zuletzt') : null,
  ));

  return card;
}

/* ------------------------------------------------------------------ */
/* Ansicht                                                             */
/* ------------------------------------------------------------------ */

export function render({ id }) {
  const workout = getWorkout(id);
  if (!workout) {
    return {
      title: 'Training',
      back: '#/',
      body: h('div.empty', h('h2', 'Training nicht gefunden'),
        h('a.btn.btn--ghost', { href: '#/' }, 'Zum Verlauf')),
    };
  }

  const body = h('div');
  const isActive = workout.status === 'active';

  body.append(h('datalist', { id: DATALIST_ID },
    ...allExerciseNames().map((n) => h('option', { value: n }))));

  /* Kopfdaten */

  const nameInput = h('input', {
    type: 'text',
    value: workout.name,
    'aria-label': 'Name des Trainings',
    oninput: () => {
      updateWorkout(id, (w) => { w.name = nameInput.value; });
      setTitle(nameInput.value || 'Training');
    },
  });
  const dateInput = h('input', {
    type: 'date',
    value: workout.date,
    'aria-label': 'Datum',
    onchange: () => updateWorkout(id, (w) => { w.date = dateInput.value; }),
  });
  const noteInput = h('textarea', {
    placeholder: 'Notiz (Gefühl, Schmerzen, Trainer-Hinweise …)',
    'aria-label': 'Notiz',
    oninput: () => updateWorkout(id, (w) => { w.note = noteInput.value; }),
  });
  noteInput.value = workout.note || '';

  body.append(h('div.card',
    h('label.field', h('span', 'Training'), nameInput),
    h('label.field', h('span', 'Datum'), dateInput),
    h('label.field', { style: { marginBottom: '0' } }, h('span', 'Notiz'), noteInput),
    workout.sourceName
      ? h('p.small.dim', { style: { margin: '10px 0 0' } }, `Übernommen aus „${workout.sourceName}“`)
      : null,
  ));

  /* Übungen */

  const totals = h('div.card.small.dim');
  const exercisesBox = h('div');

  const paintTotals = () => {
    const w = getWorkout(id);
    if (!w) return;
    const { total, done } = workoutSetCount(w);
    totals.replaceChildren(
      h('div.row.row--between',
        h('span', 'Sätze erledigt'),
        h('span.strong', { style: { color: 'var(--text)' } }, `${done} / ${total}`)),
      h('div.row.row--between', { style: { marginTop: '4px' } },
        h('span', 'Volumen (erledigt)'),
        h('span.strong', { style: { color: 'var(--text)' } }, formatWeight(workoutVolume(w, true)))),
    );
  };

  const paintExercises = () => {
    const w = getWorkout(id);
    const move = (exId, delta) => {
      if (exId) {
        updateWorkout(id, (wk) => {
          const from = wk.exercises.findIndex((e) => e.id === exId);
          const to = from + delta;
          if (from < 0 || to < 0 || to >= wk.exercises.length) return;
          const [moved] = wk.exercises.splice(from, 1);
          wk.exercises.splice(to, 0, moved);
        });
      }
      paintExercises();
    };

    exercisesBox.replaceChildren(
      ...w.exercises.map((ex) =>
        exerciseCard(id, ex.id, paintExercises, paintTotals, move)),
    );
    if (!w.exercises.length) {
      exercisesBox.append(h('p.dim.small', { style: { padding: '4px' } },
        'Noch keine Übung. Füge unten die erste Maschine hinzu.'));
    }
    paintTotals();
  };

  body.append(
    h('div.section-title', 'Übungen'),
    h('p.small.dim', { style: { margin: '-4px 4px 8px' } },
      '✓ = erledigt. ± = wie war der Satz: − am Limit, + noch Reserven. ' +
      'Satznummer antippen löscht den Satz.'),
    exercisesBox,
  );
  paintExercises();

  /* Übung hinzufügen */

  const addInput = h('input', {
    type: 'text',
    list: DATALIST_ID,
    placeholder: 'Maschine hinzufügen …',
    'aria-label': 'Maschine hinzufügen',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); addExercise(); } },
  });

  function addExercise() {
    const name = addInput.value.trim();
    const prev = name ? lastPerformance(name, id) : null;
    updateWorkout(id, (w) => {
      w.exercises.push(makeExercise(
        name,
        prev ? prev.exercise.sets.map((s) => makeSet(s.weight, s.reps)) : null,
      ));
    });
    if (name) rememberExercise(name);
    addInput.value = '';
    paintExercises();
    if (prev) toast('Werte vom letzten Mal übernommen');
  }

  body.append(h('div.card',
    h('div.row', { style: { gap: '8px' } },
      h('div.grow', addInput),
      h('button.btn.btn--sm', { type: 'button', onclick: addExercise }, 'Hinzufügen')),
  ));

  /* Zusammenfassung + Aktionen */

  body.append(h('div.section-title', 'Zusammenfassung'), totals);
  paintTotals();

  const actions = h('div.stack', { style: { marginTop: '10px' } });

  if (isActive) {
    actions.append(h('button.btn.btn--block', {
      type: 'button',
      onclick: () => {
        finishWorkout(id);
        toast('Training abgeschlossen');
        location.hash = '#/';
      },
    }, '✓ Training abschließen'));
  } else {
    actions.append(h('button.btn.btn--ghost.btn--block', {
      type: 'button',
      onclick: () => { reopenWorkout(id); toast('Training wieder geöffnet'); refresh(); },
    }, 'Training wieder öffnen'));
  }

  actions.append(
    h('button.btn.btn--ghost.btn--block', {
      type: 'button',
      onclick: () => {
        const next = startWorkout({ source: getWorkout(id) });
        toast('Neues Training aus dieser Vorlage');
        location.hash = `#/training/${next.id}`;
      },
    }, '↻ Neues Training mit diesen Werten'),
    h('button.btn.btn--ghost.btn--block', {
      type: 'button',
      onclick: () => {
        const name = window.prompt('Name der Vorlage:', workout.name);
        if (!name) return;
        saveAsTemplate(getWorkout(id), name.trim());
        toast('Als Vorlage gespeichert');
      },
    }, 'Als benannte Vorlage speichern'),
    h('button.btn.btn--danger.btn--block', {
      type: 'button',
      onclick: () => {
        if (!confirmAction(`„${workout.name}“ endgültig löschen?`)) return;
        deleteWorkout(id);
        location.hash = '#/';
      },
    }, 'Training löschen'),
  );

  body.append(actions);

  return {
    title: workout.name || 'Training',
    back: '#/',
    body,
  };
}
