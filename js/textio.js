// Import/Export im Klartext – damit die bisherige Textdatei nicht verloren
// geht und die Daten jederzeit wieder in lesbarer Form herauskommen.
//
// Erwartetes Textformat (tolerant gelesen):
//
//   17.09.2026 Oberkörper
//   Beinpresse 80x12, 80x12, 90x10
//   Latzug 3x10 @ 55
//   Bankdrücken 60 kg x 8
//   # Notiz: Schulter zwickt
//
// Eine Zeile, die mit einem Datum beginnt, startet ein neues Training.
// Alle folgenden Zeilen sind Übungen: Name, dann die Sätze.

import { uid, todayISO, formatDate, formatWeight } from './model.js';

const DATE_PATTERNS = [
  // 17.09.2026 / 17.9.26
  /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/,
  // 2026-09-17
  /^(\d{4})-(\d{1,2})-(\d{1,2})\b/,
];

function parseDate(line) {
  let m = DATE_PATTERNS[0].exec(line);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return {
      iso: `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`,
      rest: line.slice(m[0].length).trim(),
    };
  }
  m = DATE_PATTERNS[1].exec(line);
  if (m) {
    return {
      iso: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`,
      rest: line.slice(m[0].length).trim(),
    };
  }
  return null;
}

const num = (s) => Number(String(s).replace(',', '.'));

/** Zerlegt den Satzteil einer Übungszeile, z. B. "80x12, 80x12, 3x10 @ 55". */
function parseSets(text) {
  const sets = [];
  for (const raw of text.split(/[,;]+/)) {
    const chunk = raw.trim().replace(/\s+/g, ' ');
    if (!chunk) continue;

    // "3x10 @ 55" oder "3 x 10 @ 55 kg" -> 3 Sätze à 10 Wdh mit 55 kg
    let m = /^(\d+)\s*[x×*]\s*(\d+)\s*@\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?$/i.exec(chunk);
    if (m) {
      const count = Math.min(20, Number(m[1]));
      for (let i = 0; i < count; i += 1) {
        sets.push({ id: uid(), weight: num(m[3]), reps: Number(m[2]), done: true });
      }
      continue;
    }

    // "80x12", "80 kg x 12", "80×12"
    m = /^(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*[x×*]\s*(\d+)\s*(?:wdh\.?)?$/i.exec(chunk);
    if (m) {
      sets.push({ id: uid(), weight: num(m[1]), reps: Number(m[2]), done: true });
      continue;
    }

    // nur ein Gewicht: "60 kg"
    m = /^(\d+(?:[.,]\d+)?)\s*kg$/i.exec(chunk);
    if (m) {
      sets.push({ id: uid(), weight: num(m[1]), reps: 0, done: true });
      continue;
    }

    // nur Wiederholungen: "12 Wdh"
    m = /^(\d+)\s*(?:wdh\.?|wiederholungen)$/i.exec(chunk);
    if (m) {
      sets.push({ id: uid(), weight: 0, reps: Number(m[1]), done: true });
    }
  }
  return sets;
}

/** Trennt "Beinpresse 80x12, 80x12" in Name und Sätze. */
function parseExerciseLine(line) {
  const match = /[\d]/.exec(line);
  if (!match) return { name: line.trim(), sets: [] };

  const name = line.slice(0, match.index).trim().replace(/[:\-–]\s*$/, '');
  const sets = parseSets(line.slice(match.index));
  if (!name) return { name: line.trim(), sets: [] };
  return { name, sets };
}

/**
 * Liest einen kompletten Text und liefert Trainings zurück.
 * Zeilen, die zu nichts passen, landen in `warnings`.
 */
export function parseWorkoutText(text) {
  const workouts = [];
  const warnings = [];
  let current = null;

  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;

    if (/^#\s*notiz\s*:/i.test(line)) {
      if (current) current.note = `${current.note ? `${current.note}\n` : ''}${line.replace(/^#\s*notiz\s*:\s*/i, '')}`;
      return;
    }

    const stripped = line.replace(/^[#*\-–]\s*/, '');
    const date = parseDate(stripped);
    if (date) {
      current = {
        id: uid(),
        name: date.rest || 'Training',
        date: date.iso,
        createdAt: Date.now(),
        startedAt: null,
        finishedAt: null,
        status: 'done',
        sourceId: null,
        sourceName: null,
        note: '',
        exercises: [],
      };
      workouts.push(current);
      return;
    }

    if (!current) {
      current = {
        id: uid(), name: 'Importiertes Training', date: todayISO(),
        createdAt: Date.now(), startedAt: null, finishedAt: null,
        status: 'done', sourceId: null, sourceName: null, note: '', exercises: [],
      };
      workouts.push(current);
    }

    const { name, sets } = parseExerciseLine(stripped);
    if (!name) { warnings.push(`Zeile ${i + 1}: „${line}“ nicht verstanden`); return; }
    if (!sets.length) warnings.push(`Zeile ${i + 1}: keine Sätze erkannt in „${line}“`);
    current.exercises.push({
      id: uid(),
      name,
      note: '',
      sets: sets.length ? sets : [{ id: uid(), weight: 0, reps: 0, done: false }],
    });
  });

  return { workouts, warnings };
}

/** Gegenrichtung: alle Trainings als lesbare Textdatei. */
export function workoutsToText(workouts) {
  return workouts.map((w) => {
    const head = `${formatDate(w.date)} – ${w.name}`;
    const lines = w.exercises.map((ex) => {
      const sets = ex.sets.map((s) => `${formatWeight(s.weight).replace(' kg', '')}x${s.reps}`).join(', ');
      return `${ex.name || 'Übung'}: ${sets}`;
    });
    if (w.note) lines.push(`# Notiz: ${w.note.replace(/\n/g, ' ')}`);
    return [head, ...lines].join('\n');
  }).join('\n\n');
}
