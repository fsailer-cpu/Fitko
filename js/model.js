// Fachlogik rund um Trainings, Vorlagen und Übungen.
// Reine Funktionen bzw. kleine Helfer auf dem State – keine DOM-Zugriffe.

import { getState, mutate } from './store.js';

export function uid() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Formatierung                                                        */
/* ------------------------------------------------------------------ */

const DAY_FMT = new Intl.DateTimeFormat('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : DAY_FMT.format(d);
}

export function formatWeight(kg) {
  if (kg === null || kg === undefined || kg === '') return '–';
  const n = Number(kg);
  if (!Number.isFinite(n)) return '–';
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} kg`;
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/* ------------------------------------------------------------------ */
/* Sätze und Übungen                                                   */
/* ------------------------------------------------------------------ */

export function makeSet(weight = 0, reps = 10) {
  return { id: uid(), weight: Number(weight) || 0, reps: Number(reps) || 0, done: false };
}

export function makeExercise(name = '', sets = null) {
  return {
    id: uid(),
    name,
    note: '',
    sets: sets && sets.length ? sets : [makeSet(0, 10)],
  };
}

/** Gesamtvolumen (Gewicht × Wiederholungen) über alle gewerteten Sätze. */
export function volumeOf(exercise, onlyDone = false) {
  return exercise.sets.reduce((sum, s) => {
    if (onlyDone && !s.done) return sum;
    return sum + (Number(s.weight) || 0) * (Number(s.reps) || 0);
  }, 0);
}

export function workoutVolume(workout, onlyDone = false) {
  return workout.exercises.reduce((sum, ex) => sum + volumeOf(ex, onlyDone), 0);
}

export function workoutSetCount(workout) {
  const total = workout.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const done = workout.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
  return { total, done };
}

/** Kurzfassung à la "3 × 80 kg" bzw. "80/80/90 kg" für Listen. */
export function summarizeSets(sets) {
  if (!sets.length) return '–';
  const weights = sets.map((s) => Number(s.weight) || 0);
  const reps = sets.map((s) => Number(s.reps) || 0);
  const sameWeight = weights.every((w) => w === weights[0]);
  const sameReps = reps.every((r) => r === reps[0]);
  if (sameWeight && sameReps) return `${sets.length} × ${reps[0]} @ ${formatWeight(weights[0])}`;
  return sets.map((s) => `${s.reps}×${formatWeight(s.weight)}`).join(' · ');
}

/* ------------------------------------------------------------------ */
/* Trainings                                                           */
/* ------------------------------------------------------------------ */

export function getWorkout(id) {
  return getState().workouts.find((w) => w.id === id) || null;
}

/** Trainings absteigend nach Datum (neueste zuerst). */
export function sortedWorkouts() {
  return [...getState().workouts].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

export function activeWorkout() {
  return getState().workouts.find((w) => w.status === 'active') || null;
}

export function lastFinishedWorkout() {
  return sortedWorkouts().find((w) => w.status === 'done') || null;
}

function blankWorkout(name) {
  return {
    id: uid(),
    name: name || 'Training',
    date: todayISO(),
    createdAt: Date.now(),
    startedAt: Date.now(),
    finishedAt: null,
    status: 'active',
    sourceId: null,
    sourceName: null,
    note: '',
    exercises: [],
  };
}

/**
 * Legt ein neues Training an. `source` ist optional ein altes Training oder
 * eine Vorlage; dessen Übungen werden mit Gewichten und Wiederholungen
 * übernommen, die Haken aber zurückgesetzt.
 */
export function startWorkout({ source = null, name = null } = {}) {
  const w = blankWorkout(name || source?.name || 'Training');
  if (source) {
    w.sourceId = source.id;
    w.sourceName = source.name;
    w.note = source.note || '';
    w.exercises = source.exercises.map((ex) => ({
      id: uid(),
      name: ex.name,
      note: ex.note || '',
      sets: ex.sets.map((s) => makeSet(s.weight, s.reps)),
    }));
  }
  mutate((s) => {
    s.workouts.forEach((other) => {
      // Es gibt immer nur ein laufendes Training.
      if (other.status === 'active') finalize(other);
    });
    s.workouts.push(w);
  });
  w.exercises.forEach((ex) => rememberExercise(ex.name));
  return w;
}

function finalize(workout) {
  workout.status = 'done';
  workout.finishedAt = workout.finishedAt || Date.now();
}

export function finishWorkout(id) {
  return mutate((s) => {
    const w = s.workouts.find((x) => x.id === id);
    if (w) finalize(w);
  });
}

export function reopenWorkout(id) {
  return mutate((s) => {
    s.workouts.forEach((w) => {
      if (w.status === 'active') finalize(w);
    });
    const w = s.workouts.find((x) => x.id === id);
    if (w) {
      w.status = 'active';
      w.finishedAt = null;
    }
  });
}

export function deleteWorkout(id) {
  return mutate((s) => {
    s.workouts = s.workouts.filter((w) => w.id !== id);
  });
}

/** Änderungen an einem Training: `fn` bekommt das Training zum Mutieren. */
export function updateWorkout(id, fn) {
  return mutate((s) => {
    const w = s.workouts.find((x) => x.id === id);
    if (w) fn(w);
  });
}

/* ------------------------------------------------------------------ */
/* Vorlagen                                                            */
/* ------------------------------------------------------------------ */

export function getTemplate(id) {
  return getState().templates.find((t) => t.id === id) || null;
}

/** Speichert ein Training als benannte Vorlage (Haken werden verworfen). */
export function saveAsTemplate(workout, name) {
  const tpl = {
    id: uid(),
    name: name || workout.name,
    createdAt: Date.now(),
    note: workout.note || '',
    exercises: workout.exercises.map((ex) => ({
      id: uid(),
      name: ex.name,
      note: ex.note || '',
      sets: ex.sets.map((s) => ({ id: uid(), weight: s.weight, reps: s.reps, done: false })),
    })),
  };
  mutate((s) => s.templates.push(tpl));
  return tpl;
}

export function deleteTemplate(id) {
  return mutate((s) => {
    s.templates = s.templates.filter((t) => t.id !== id);
  });
}

export function renameTemplate(id, name) {
  return mutate((s) => {
    const t = s.templates.find((x) => x.id === id);
    if (t) t.name = name;
  });
}

/* ------------------------------------------------------------------ */
/* Übungs-/Maschinenkatalog                                            */
/* ------------------------------------------------------------------ */

/** Nimmt einen Übungsnamen in den Katalog auf, falls noch nicht vorhanden. */
export function rememberExercise(name) {
  const clean = (name || '').trim();
  if (!clean) return;
  const exists = getState().catalog.some((c) => c.name.toLowerCase() === clean.toLowerCase());
  if (exists) return;
  mutate((s) => s.catalog.push({ id: uid(), name: clean, group: '' }));
}

export function deleteCatalogEntry(id) {
  return mutate((s) => {
    s.catalog = s.catalog.filter((c) => c.id !== id);
  });
}

/** Alle je benutzten Übungsnamen (Katalog + Trainings), alphabetisch. */
export function allExerciseNames() {
  const names = new Map();
  getState().catalog.forEach((c) => names.set(c.name.toLowerCase(), c.name));
  getState().workouts.forEach((w) =>
    w.exercises.forEach((ex) => {
      const key = (ex.name || '').trim().toLowerCase();
      if (key) names.set(key, ex.name.trim());
    }));
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'de'));
}

/**
 * Die zuletzt absolvierte Leistung an einer Maschine – Grundlage für den
 * Hinweis "letztes Mal: …" direkt beim Eintragen.
 */
export function lastPerformance(name, excludeWorkoutId = null) {
  const key = (name || '').trim().toLowerCase();
  if (!key) return null;
  for (const w of sortedWorkouts()) {
    if (w.id === excludeWorkoutId) continue;
    const ex = w.exercises.find((e) => (e.name || '').trim().toLowerCase() === key);
    if (ex && ex.sets.length) return { workout: w, exercise: ex };
  }
  return null;
}

/** Verlauf einer Übung über alle Trainings – für die Fortschrittsansicht. */
export function exerciseHistory(name) {
  const key = (name || '').trim().toLowerCase();
  return sortedWorkouts()
    .flatMap((w) =>
      w.exercises
        .filter((e) => (e.name || '').trim().toLowerCase() === key)
        .map((ex) => ({
          workoutId: w.id,
          date: w.date,
          workoutName: w.name,
          sets: ex.sets,
          topWeight: Math.max(0, ...ex.sets.map((s) => Number(s.weight) || 0)),
          volume: volumeOf(ex),
        })));
}
