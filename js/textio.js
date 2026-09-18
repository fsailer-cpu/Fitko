// Import/Export im Klartext – damit die bisherige Trainings-Textdatei
// übernommen werden kann und die Daten jederzeit wieder in genau dieser
// Form herauskommen.
//
// Gelesenes Format (so wie die Notiz bisher geführt wurde):
//
//   Training Fitko            <- Titel vor dem ersten Datum, optional
//   21.05.2026                <- Datumszeile startet ein Training
//   Abductor Leg Extension    <- Zeile ohne Zahlen: Name der Übung
//   45 kg x 15                <- Zeile mit Zahl am Anfang: ein Satz
//   55 kg x 15
//   65 kg x 15 -              <- nachgestellte Striche werden ignoriert
//
//   Oberarme zu sich ziehen   <- Leerzeilen trennen nur optisch
//   35 kg x 12
//
// Zusätzlich verstanden, weil verbreitet:
//   Beinpresse 80x12, 80x12, 90x10     (Name und Sätze in einer Zeile)
//   Latzug 3x10 @ 55                   (drei Sätze à 10 Wdh mit 55 kg)
//   # Notiz: Schulter zwickt

import { uid, todayISO } from './model.js';

const DATE_DE = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s*$|^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+(.*)$/;
const DATE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})\s*$|^(\d{4})-(\d{1,2})-(\d{1,2})\s+(.*)$/;

const pad = (n) => String(n).padStart(2, '0');
const num = (s) => Number(String(s).replace(',', '.'));

/** Erkennt eine Datumszeile und trennt einen eventuellen Namen dahinter ab. */
function parseDate(line) {
  let m = DATE_DE.exec(line);
  if (m) {
    const [d, mo, y, rest] = m[1] ? [m[1], m[2], m[3], ''] : [m[4], m[5], m[6], m[7] || ''];
    const year = y.length === 2 ? `20${y}` : y;
    return { iso: `${year}-${pad(mo)}-${pad(d)}`, rest: rest.trim() };
  }
  m = DATE_ISO.exec(line);
  if (m) {
    const [y, mo, d, rest] = m[1] ? [m[1], m[2], m[3], ''] : [m[4], m[5], m[6], m[7] || ''];
    return { iso: `${y}-${pad(mo)}-${pad(d)}`, rest: rest.trim() };
  }
  return null;
}

/** Ein einzelner Satz-Ausdruck. Liefert null, wenn nichts passt. */
function parseSetChunk(chunk) {
  // "3x10 @ 55" -> drei Sätze à 10 Wdh mit 55 kg
  let m = /^(\d+)\s*[x×*]\s*(\d+)\s*@\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?$/i.exec(chunk);
  if (m) {
    const count = Math.min(20, Number(m[1]));
    return Array.from({ length: count }, () =>
      ({ id: uid(), weight: num(m[3]), reps: Number(m[2]), done: true }));
  }

  // "45 kg x 15", "80x12", "80 × 12 Wdh"
  m = /^(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*[x×*]\s*(\d+)\s*(?:wdh\.?|wiederholungen)?$/i.exec(chunk);
  if (m) return [{ id: uid(), weight: num(m[1]), reps: Number(m[2]), done: true }];

  // nur ein Gewicht
  m = /^(\d+(?:[.,]\d+)?)\s*kg$/i.exec(chunk);
  if (m) return [{ id: uid(), weight: num(m[1]), reps: 0, done: true }];

  // nur Wiederholungen
  m = /^(\d+)\s*(?:wdh\.?|wiederholungen)$/i.exec(chunk);
  if (m) return [{ id: uid(), weight: 0, reps: Number(m[1]), done: true }];

  return null;
}

/**
 * Liest alle Satz-Ausdrücke aus einem Textstück. Was nicht als Satz
 * durchgeht, kommt unverändert als `leftovers` zurück, damit nichts
 * stillschweigend verlorengeht.
 */
function parseSets(text) {
  const sets = [];
  const leftovers = [];
  for (const part of text.split(/[,;]+/)) {
    const raw = part.trim();
    if (!raw) continue;
    // Nachgestellte Striche sind in der bisherigen Datei bloße Markierungen.
    const chunk = raw.replace(/[\s\-–—]+$/, '').replace(/\s+/g, ' ').trim();
    if (!chunk) continue;
    const parsed = parseSetChunk(chunk);
    if (parsed) sets.push(...parsed);
    else leftovers.push(raw);
  }
  return { sets, leftovers };
}

/** Entscheidet, was eine Zeile ist: Datum, Satz, Übungsname oder Notiz. */
function classify(line) {
  if (/^#\s*notiz\s*:/i.test(line)) {
    return { kind: 'note', text: line.replace(/^#\s*notiz\s*:\s*/i, '').trim() };
  }

  const bare = line.replace(/^[#*\-–•]\s*/, '').trim();
  if (!bare) return { kind: 'blank' };

  const date = parseDate(bare);
  if (date) return { kind: 'date', iso: date.iso, name: date.rest };

  // Beginnt die Zeile mit einer Zahl, ist sie ein Satz – nicht ein Name.
  if (/^\d/.test(bare)) {
    const { sets, leftovers } = parseSets(bare);
    if (sets.length) return { kind: 'sets', sets, leftovers };
  }

  // Name gefolgt von Sätzen in derselben Zeile.
  const idx = bare.search(/\d/);
  if (idx > 0) {
    const name = bare.slice(0, idx).trim().replace(/[:\-–]\s*$/, '').trim();
    const { sets, leftovers } = parseSets(bare.slice(idx));
    if (name && sets.length) return { kind: 'exercise', name, sets, leftovers };
  }

  return { kind: 'exercise', name: bare, sets: [], leftovers: [] };
}

function newWorkout(name, date) {
  return {
    id: uid(),
    name: name || 'Training',
    date: date || todayISO(),
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    status: 'done',
    sourceId: null,
    sourceName: null,
    note: '',
    exercises: [],
  };
}

/**
 * Liest einen kompletten Text und liefert fertige Trainings zurück.
 * Alles, was nicht eindeutig war, steht in `warnings`.
 */
export function parseWorkoutText(text) {
  const lines = text.split(/\r?\n/);
  const workouts = [];
  const warnings = [];

  // Zeilen vor dem ersten Datum sind der Titel der Datei, kein Training.
  const firstDate = lines.findIndex((l) => {
    const c = classify(l.trim());
    return c.kind === 'date';
  });
  let title = '';
  if (firstDate > 0) {
    title = lines.slice(0, firstDate).map((l) => l.trim()).filter(Boolean).join(' ').trim();
  }

  let workout = null;
  let exercise = null;

  const ensureWorkout = () => {
    if (!workout) {
      workout = newWorkout(title, null);
      workouts.push(workout);
    }
    return workout;
  };

  lines.forEach((rawLine, i) => {
    if (firstDate > 0 && i < firstDate) return; // Titelzeilen überspringen
    const line = rawLine.trim();
    if (!line) return;

    const item = classify(line);
    const where = `Zeile ${i + 1}`;

    switch (item.kind) {
      case 'blank':
        return;

      case 'date':
        workout = newWorkout(item.name || title, item.iso);
        workouts.push(workout);
        exercise = null;
        return;

      case 'note':
        ensureWorkout();
        workout.note = workout.note ? `${workout.note}\n${item.text}` : item.text;
        return;

      case 'sets': {
        ensureWorkout();
        if (!exercise) {
          warnings.push(`${where}: Sätze ohne vorangehende Übung – „Übung" angelegt`);
          exercise = { id: uid(), name: 'Übung', note: '', sets: [] };
          workout.exercises.push(exercise);
        }
        exercise.sets.push(...item.sets);
        if (item.leftovers.length) {
          warnings.push(`${where}: nicht verstanden – ${item.leftovers.join(' / ')}`);
        }
        return;
      }

      case 'exercise':
      default: {
        ensureWorkout();
        exercise = { id: uid(), name: item.name, note: '', sets: [...(item.sets || [])] };
        workout.exercises.push(exercise);
        if (item.leftovers?.length) {
          warnings.push(`${where}: nicht verstanden – ${item.leftovers.join(' / ')}`);
        }
      }
    }
  });

  // Übungen ohne einen einzigen Satz sind fast immer falsch gelesene Zeilen.
  workouts.forEach((w) => {
    w.exercises.forEach((ex) => {
      if (!ex.sets.length) {
        warnings.push(`„${ex.name}“ hat keine Sätze`);
        ex.sets.push({ id: uid(), weight: 0, reps: 0, done: false });
      }
    });
  });

  return { workouts: workouts.filter((w) => w.exercises.length), warnings };
}

const weightText = (kg) => {
  const n = Number(kg) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const dateText = (iso) => {
  const [y, m, d] = String(iso).split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

/**
 * Gegenrichtung, im selben Format – der Export lässt sich also wieder
 * einlesen.
 */
export function workoutsToText(workouts) {
  return workouts.map((w) => {
    const blocks = w.exercises.map((ex) => [
      ex.name || 'Übung',
      ...ex.sets.map((s) => `${weightText(s.weight)} kg x ${s.reps}`),
    ].join('\n'));
    const head = w.name && w.name !== 'Training'
      ? `${dateText(w.date)} ${w.name}`
      : dateText(w.date);
    const note = w.note ? [`# Notiz: ${w.note.replace(/\n/g, ' ')}`] : [];
    return [head, '', ...blocks.flatMap((b) => [b, '']), ...note].join('\n').trimEnd();
  }).join('\n\n');
}
