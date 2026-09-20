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

/** Sekunden als mm:ss, Minuten laufen bei langen Zeiten einfach weiter. */
export function formatSeconds(total) {
  const n = Math.max(0, Math.round(Number(total) || 0));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

/** Liest "1:30", "01:30" oder "90" als Sekunden. */
export function parseSeconds(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return 0;
  const parts = raw.split(':');
  if (parts.length === 1) return Math.max(0, Math.round(Number(parts[0]) || 0));
  const min = Math.max(0, Math.round(Number(parts[0]) || 0));
  const sec = Math.max(0, Math.round(Number(parts[1]) || 0));
  return min * 60 + sec;
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

/**
 * Ein Satz. `effort` hält fest, wie er sich angefühlt hat:
 * 'limit'   – am Limit, mehr ging nicht        (in der Textdatei: -)
 * 'reserve' – noch Luft, nächstes Mal zulegen  (in der Textdatei: +)
 * null      – nicht beurteilt
 */
export function makeSet(weight = 0, reps = 10, effort = null, seconds = 0) {
  return {
    id: uid(),
    weight: Number(weight) || 0,
    reps: Number(reps) || 0,
    // Nur bei Übungen mit kind === 'time' relevant.
    seconds: Number(seconds) || 0,
    done: false,
    effort: EFFORTS.includes(effort) ? effort : null,
  };
}

export const EFFORTS = ['limit', 'reserve'];

/** Reihenfolge beim Durchtippen des Knopfes. */
export const EFFORT_CYCLE = [null, 'limit', 'reserve'];

export const EFFORT_SIGN = { limit: '−', reserve: '+' };

export const EFFORT_LABEL = {
  limit: 'am Limit',
  reserve: 'noch Reserven',
};

/** Das Zeichen, wie es in der Textdatei steht. */
export const EFFORT_TEXT = { limit: '-', reserve: '+' };

export function nextEffort(effort) {
  const i = EFFORT_CYCLE.indexOf(effort ?? null);
  return EFFORT_CYCLE[(i + 1) % EFFORT_CYCLE.length];
}

/**
 * `kind` bestimmt, was je Satz gezählt wird:
 * 'reps' – Wiederholungen (Standard)
 * 'time' – Haltedauer in Sekunden, angezeigt als mm:ss (Plank & Co.)
 * Das Gewicht bleibt in beiden Fällen ein normales Gewichtsfeld; bei
 * Halteübungen trägt man dort sein Körpergewicht bzw. Zusatzgewicht ein.
 */
export function makeExercise(name = '', sets = null, kind = 'reps') {
  const timed = kind === 'time';
  return {
    id: uid(),
    name,
    kind: timed ? 'time' : 'reps',
    note: '',
    sets: sets && sets.length ? sets : [timed ? makeSet(0, 0, null, 60) : makeSet(0, 10)],
  };
}

export function isTimed(exercise) {
  return exercise?.kind === 'time';
}

export const TIME_STEP = 5;

/** Gesamtvolumen (Gewicht × Wiederholungen) über alle gewerteten Sätze. */
export function volumeOf(exercise, onlyDone = false) {
  // Halteübungen haben kein sinnvolles kg-Volumen (85 kg × 90 s wäre keine
  // mit Wiederholungen vergleichbare Zahl). Sie werden über die Haltezeit
  // ausgewiesen und bleiben hier außen vor.
  if (isTimed(exercise)) return 0;
  return exercise.sets.reduce((sum, s) => {
    if (onlyDone && !s.done) return sum;
    return sum + (Number(s.weight) || 0) * (Number(s.reps) || 0);
  }, 0);
}

/** Summe der Haltedauer einer Übung in Sekunden. */
export function holdTimeOf(exercise, onlyDone = false) {
  if (!isTimed(exercise)) return 0;
  return exercise.sets.reduce((sum, s) => {
    if (onlyDone && !s.done) return sum;
    return sum + (Number(s.seconds) || 0);
  }, 0);
}

export function workoutHoldTime(workout, onlyDone = false) {
  return workout.exercises.reduce((sum, ex) => sum + holdTimeOf(ex, onlyDone), 0);
}

export function hasTimedExercise(workout) {
  return workout.exercises.some(isTimed);
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
export function summarizeSets(sets, kind = 'reps') {
  if (!sets.length) return '–';
  const mark = (s) => (s.effort ? ` ${EFFORT_SIGN[s.effort]}` : '');
  const weights = sets.map((s) => Number(s.weight) || 0);
  const sameWeight = weights.every((w) => w === weights[0]);
  const marks = sets.map(mark).filter(Boolean).join('');

  if (kind === 'time') {
    const secs = sets.map((s) => Number(s.seconds) || 0);
    const sameTime = secs.every((x) => x === secs[0]);
    if (sameWeight && sameTime) {
      return `${sets.length} × ${formatSeconds(secs[0])} @ ${formatWeight(weights[0])}${marks}`;
    }
    return sets.map((s) => `${formatSeconds(s.seconds)}${mark(s)}`).join(' · ');
  }

  const reps = sets.map((s) => Number(s.reps) || 0);
  const sameReps = reps.every((r) => r === reps[0]);
  if (sameWeight && sameReps) {
    return `${sets.length} × ${reps[0]} @ ${formatWeight(weights[0])}${marks}`;
  }
  return sets.map((s) => `${s.reps}×${formatWeight(s.weight)}${mark(s)}`).join(' · ');
}

/** Bequemer Aufruf, wenn die Übung selbst vorliegt. */
export function summarizeExercise(exercise) {
  return summarizeSets(exercise.sets, exercise.kind);
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
      kind: ex.kind === 'time' ? 'time' : 'reps',
      note: ex.note || '',
      sets: ex.sets.map((s) => makeSet(s.weight, s.reps, null, s.seconds)),
    }));
  }
  mutate((s) => {
    s.workouts.forEach((other) => {
      // Es gibt immer nur ein laufendes Training.
      if (other.status === 'active') finalize(other);
    });
    s.workouts.push(w);
  });
  w.exercises.forEach((ex) => rememberExercise(ex.name, ex.kind));
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
      kind: ex.kind === 'time' ? 'time' : 'reps',
      note: ex.note || '',
      // Die Beurteilung (Limit/Reserve) gilt für die damalige Leistung und
      // wird bewusst nicht mitkopiert.
      sets: ex.sets.map((s) => ({
        id: uid(),
        weight: s.weight,
        reps: s.reps,
        seconds: Number(s.seconds) || 0,
        done: false,
        effort: null,
      })),
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
export function rememberExercise(name, kind = null) {
  const clean = (name || '').trim();
  if (!clean) return;
  const entry = getState().catalog.find((c) => c.name.toLowerCase() === clean.toLowerCase());
  if (!entry) {
    mutate((s) => s.catalog.push({
      id: uid(), name: clean, group: '', kind: kind === 'time' ? 'time' : 'reps',
    }));
    return;
  }
  if (kind && entry.kind !== kind) mutate(() => { entry.kind = kind; });
}

/** Die zuletzt für diesen Namen benutzte Art – Katalog, sonst 'reps'. */
export function catalogKind(name) {
  const clean = (name || '').trim().toLowerCase();
  const entry = getState().catalog.find((c) => c.name.toLowerCase() === clean);
  return entry?.kind === 'time' ? 'time' : 'reps';
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
  let fallback = null;
  for (const w of sortedWorkouts()) {
    if (w.id === excludeWorkoutId) continue;
    const ex = w.exercises.find((e) => (e.name || '').trim().toLowerCase() === key);
    if (!ex || !ex.sets.length) continue;
    // Eine geplante, aber ausgelassene Übung ist keine Leistung. Sie dient
    // nur als Rückfall, falls es gar keinen absolvierten Eintrag gibt.
    if (ex.sets.some((s) => s.done)) return { workout: w, exercise: ex };
    fallback = fallback || { workout: w, exercise: ex };
  }
  return fallback;
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
          kind: ex.kind === 'time' ? 'time' : 'reps',
          topWeight: Math.max(0, ...ex.sets.map((s) => Number(s.weight) || 0)),
          topSeconds: Math.max(0, ...ex.sets.map((s) => Number(s.seconds) || 0)),
          volume: volumeOf(ex),
          holdTime: holdTimeOf(ex),
        })));
}
