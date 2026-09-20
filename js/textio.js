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
//   65 kg x 15 -              <- - am Limit, + noch Reserven
//
//   Oberarme zu sich ziehen   <- Leerzeilen trennen nur optisch
//   35 kg x 12
//
// Zusätzlich verstanden, weil verbreitet:
//   Beinpresse 80x12, 80x12, 90x10     (Name und Sätze in einer Zeile)
//   Latzug 3x10 @ 55                   (drei Sätze à 10 Wdh mit 55 kg)
//   85 kg x 01:30                      (Haltedauer statt Wiederholungen)
//   # Notiz: Schulter zwickt

import { uid, todayISO, EFFORT_TEXT, formatSeconds, parseSeconds } from './model.js';

const DATE_DE = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s*$|^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+(.*)$/;
const DATE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})\s*$|^(\d{4})-(\d{1,2})-(\d{1,2})\s+(.*)$/;

const pad = (n) => String(n).padStart(2, '0');
const num = (s) => Number(String(s).replace(',', '.'));

// "28.05." – Tag und Monat ohne Jahr, wie in der Notiz üblich.
const DATE_SHORT = /^(\d{1,2})\.(\d{1,2})\.\s*$|^(\d{1,2})\.(\d{1,2})\.\s+(.*)$/;

/**
 * Datumszeile ohne Jahr. Das Jahr kommt aus der zuletzt gelesenen
 * vollständigen Datumsangabe; wird der Monat kleiner, ist ein Jahreswechsel
 * dazwischen.
 */
function parseShortDate(line, prev) {
  const m = DATE_SHORT.exec(line);
  if (!m) return null;
  const [d, mo, rest] = m[1] ? [m[1], m[2], ''] : [m[3], m[4], m[5] || ''];
  const month = Number(mo);
  let year = prev ? prev.year : new Date().getFullYear();
  if (prev && month < prev.month) year += 1;
  return {
    iso: `${year}-${pad(mo)}-${pad(d)}`,
    rest: rest.trim(),
    year,
    month,
  };
}

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

/**
 * Trennt die Beurteilung am Zeilenende ab: "-" heißt am Limit, "+" heißt
 * noch Reserven. Ein einzelner Gedankenstrich ohne Bedeutung sieht genauso
 * aus – er wird gleich behandelt, weil das die Schreibweise der Notiz ist.
 */
function splitEffort(text) {
  const m = /^(.*?)\s*([-–—+]|\bo)\s*$/i.exec(text);
  if (!m || !m[1].trim()) return { body: text.trim(), effort: null };
  if (m[2] === '+') return { body: m[1].trim(), effort: 'reserve' };
  // "o" markiert den Satz als gelaufen, aber ohne Wertung.
  if (/^o$/i.test(m[2])) return { body: m[1].trim(), effort: null };
  return { body: m[1].trim(), effort: 'limit' };
}

/**
 * Manche Zeilen tragen hinter dem Satz noch eine Bemerkung
 * ("40 kg x 8 - 45 kg zuvor"). Trennt den Satz vom Kommentar ab,
 * damit weder der eine noch der andere verlorengeht.
 */
function splitComment(chunk) {
  const m = /^(\d+(?:[.,]\d+)?\s*(?:kg)?\s*[x×*]\s*(?:\d{1,3}:[0-5]?\d|\d+))\s*[-–—]?\s+(\S.*)$/i
    .exec(chunk);
  if (!m) return { body: chunk, comment: '' };
  return { body: m[1].trim(), comment: m[2].trim() };
}

/** Ein einzelner Satz-Ausdruck. Liefert null, wenn nichts passt. */
function parseSetChunk(chunk, effort = null) {
  // "3x10 @ 55" -> drei Sätze à 10 Wdh mit 55 kg
  let m = /^(\d+)\s*[x×*]\s*(\d+)\s*@\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?$/i.exec(chunk);
  if (m) {
    const count = Math.min(20, Number(m[1]));
    return Array.from({ length: count }, (_, i) => ({
      id: uid(),
      weight: num(m[3]),
      reps: Number(m[2]),
      done: true,
      // Die Beurteilung gilt dem zuletzt genannten Satz.
      effort: i === count - 1 ? effort : null,
    }));
  }

  // "85 kg x 01:30" – Haltedauer statt Wiederholungen
  m = /^(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*[x×*]\s*(\d{1,3}:[0-5]?\d)$/i.exec(chunk);
  if (m) {
    return [{
      id: uid(), weight: num(m[1]), reps: 0,
      seconds: parseSeconds(m[2]), done: true, effort, timed: true,
    }];
  }

  // "3 x 01:30 @ 85" – mehrere Halte-Sätze
  m = /^(\d+)\s*[x×*]\s*(\d{1,3}:[0-5]?\d)\s*@\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?$/i.exec(chunk);
  if (m) {
    const count = Math.min(20, Number(m[1]));
    return Array.from({ length: count }, (_, i) => ({
      id: uid(), weight: num(m[3]), reps: 0, seconds: parseSeconds(m[2]),
      done: true, effort: i === count - 1 ? effort : null, timed: true,
    }));
  }

  // "1:20 x 3" – Haltedauer, dann Anzahl der Sätze
  m = /^(\d{1,3}:[0-5]?\d)\s*[x×*]\s*(\d+)$/.exec(chunk);
  if (m) {
    const count = Math.min(20, Number(m[2]));
    return Array.from({ length: count }, (_, i) => ({
      id: uid(), weight: 0, reps: 0, seconds: parseSeconds(m[1]),
      done: true, effort: i === count - 1 ? effort : null, timed: true,
    }));
  }

  // "01:30" oder "90 s" allein
  m = /^(\d{1,3}:[0-5]?\d)$/.exec(chunk) || /^(\d+)\s*(?:s|sek|sec)$/i.exec(chunk);
  if (m) {
    return [{
      id: uid(), weight: 0, reps: 0,
      seconds: parseSeconds(m[1]), done: true, effort, timed: true,
    }];
  }

  // "3x 20" – ohne kg-Angabe und mit kleiner erster Zahl sind das
  // drei Sätze à 20 Wiederholungen, nicht 3 kg für 20 Wiederholungen.
  m = /^(\d{1,2})\s*[x×*]\s*(\d+)$/.exec(chunk);
  if (m && Number(m[1]) <= 10 && Number(m[2]) >= 10) {
    const count = Number(m[1]);
    return Array.from({ length: count }, (_, i) => ({
      id: uid(), weight: 0, reps: Number(m[2]), seconds: 0,
      done: true, effort: i === count - 1 ? effort : null, guessed: chunk,
    }));
  }

  // "45 kg x 15", "80x12", "80 × 12 Wdh"
  m = /^(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*[x×*]\s*(\d+)\s*(?:wdh\.?|wiederholungen)?$/i.exec(chunk);
  if (m) return [{ id: uid(), weight: num(m[1]), reps: Number(m[2]), done: true, effort }];

  // nur ein Gewicht
  m = /^(\d+(?:[.,]\d+)?)\s*kg$/i.exec(chunk);
  if (m) return [{ id: uid(), weight: num(m[1]), reps: 0, done: true, effort }];

  // nur Wiederholungen
  m = /^(\d+)\s*(?:wdh\.?|wiederholungen)$/i.exec(chunk);
  if (m) return [{ id: uid(), weight: 0, reps: Number(m[1]), done: true, effort }];

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
  const comments = [];
  // Nur an Kommas trennen, die NICHT zwischen zwei Ziffern stehen –
  // sonst zerfällt "17,5 kg x 15" in "17" und "5 kg x 15".
  for (const part of text.split(/(?<!\d)[;,]|[;,](?!\d)/)) {
    const raw = part.trim();
    if (!raw) continue;
    const { body, effort } = splitEffort(raw.replace(/\s+/g, ' '));
    const chunk = body.trim();
    if (!chunk) continue;

    let parsed = parseSetChunk(chunk, effort);
    if (parsed) {
      sets.push(...parsed);
      continue;
    }

    // Zweiter Versuch: Satz plus nachgestellte Bemerkung.
    const split = splitComment(chunk);
    if (split.comment) {
      parsed = parseSetChunk(split.body, effort);
      if (parsed) {
        sets.push(...parsed);
        comments.push(split.comment);
        continue;
      }
    }
    leftovers.push(raw);
  }
  return { sets, leftovers, comments };
}

/** Entscheidet, was eine Zeile ist: Datum, Satz, Übungsname oder Notiz. */
function classify(line, lastDate = null) {
  if (/^#\s*notiz\s*:/i.test(line)) {
    return { kind: 'note', text: line.replace(/^#\s*notiz\s*:\s*/i, '').trim() };
  }

  const bare = line.replace(/^[#*\-–•]\s*/, '').trim();
  if (!bare) return { kind: 'blank' };

  const date = parseDate(bare);
  if (date) {
    const [y, mo] = date.iso.split('-');
    return { kind: 'date', iso: date.iso, name: date.rest, year: Number(y), month: Number(mo) };
  }

  const short = parseShortDate(bare, lastDate);
  if (short) {
    return {
      kind: 'date', iso: short.iso, name: short.rest, year: short.year, month: short.month,
    };
  }

  // Beginnt die Zeile mit einer Zahl, ist sie ein Satz – nicht ein Name.
  if (/^\d/.test(bare)) {
    const { sets, leftovers, comments } = parseSets(bare);
    if (sets.length) return { kind: 'sets', sets, leftovers, comments };
  }

  // Name gefolgt von Sätzen in derselben Zeile.
  const idx = bare.search(/\d/);
  if (idx > 0) {
    const name = bare.slice(0, idx).trim().replace(/[:\-–]\s*$/, '').trim();
    const { sets, leftovers, comments } = parseSets(bare.slice(idx));
    if (name && sets.length) return { kind: 'exercise', name, sets, leftovers, comments };
  }

  return { kind: 'exercise', name: bare, sets: [], leftovers: [], comments: [] };
}

/**
 * Ein "nein" hinter dem Übungsnamen heißt: stand im Plan, wurde aber nicht
 * gemacht. Der Name wird bereinigt, damit es dieselbe Maschine bleibt wie
 * ohne den Zusatz; die Sätze bleiben unabgehakt und zählen nicht mit.
 */
function splitSkipped(name) {
  const m = /^(.*?)\s+nein\s*$/i.exec(name);
  if (!m || !m[1].trim()) return { name: name.trim(), skipped: false };
  return { name: m[1].trim(), skipped: true };
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
  const firstDate = lines.findIndex((l) => classify(l.trim()).kind === 'date');
  let title = '';
  if (firstDate > 0) {
    title = lines.slice(0, firstDate).map((l) => l.trim()).filter(Boolean).join(' ').trim();
  }

  let workout = null;
  let exercise = null;
  // Stand des zuletzt gelesenen Datums, damit "28.05." sein Jahr erbt.
  let lastDate = null;

  const addComments = (list, name) => {
    if (!list?.length) return;
    const text = `${name}: ${list.join(' / ')}`;
    workout.note = workout.note ? `${workout.note}\n${text}` : text;
  };

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

    const item = classify(line, lastDate);
    const where = `Zeile ${i + 1}`;

    switch (item.kind) {
      case 'blank':
        return;

      case 'date':
        lastDate = { year: item.year, month: item.month };
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
        addComments(item.comments, exercise.name);
        if (item.leftovers.length) {
          warnings.push(`${where}: nicht verstanden – ${item.leftovers.join(' / ')}`);
        }
        return;
      }

      case 'exercise':
      default: {
        ensureWorkout();
        const { name, skipped } = splitSkipped(item.name);
        exercise = {
          id: uid(), name, skipped, note: '', sets: [...(item.sets || [])],
        };
        workout.exercises.push(exercise);
        addComments(item.comments, exercise.name);
        if (item.leftovers?.length) {
          warnings.push(`${where}: nicht verstanden – ${item.leftovers.join(' / ')}`);
        }
      }
    }
  });

  workouts.forEach((w) => {
    w.exercises.forEach((ex) => {
      // Übungen ohne einen einzigen Satz sind fast immer falsch gelesene Zeilen.
      if (!ex.sets.length) {
        warnings.push(`„${ex.name}“ hat keine Sätze`);
        ex.sets.push({ id: uid(), weight: 0, reps: 0, seconds: 0, done: false, effort: null });
      }
      // Eine Übung gilt als Halteübung, sobald ein Satz eine Zeit trägt.
      ex.kind = ex.sets.some((set) => set.timed) ? 'time' : 'reps';
      // Eine gedeutete Zeile wird einmal je Übung gemeldet, nicht je Satz.
      const guessed = ex.sets.find((set) => set.guessed);
      if (guessed) {
        warnings.push(`„${ex.name}“: „${guessed.guessed}“ gelesen als `
          + `${ex.sets.length} × ${guessed.reps} Wiederholungen ohne Gewicht`);
      }
      ex.sets.forEach((set) => {
        set.seconds = Number(set.seconds) || 0;
        if (ex.skipped) set.done = false;
        delete set.guessed;
        delete set.timed;
      });
      delete ex.skipped;
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
      ...ex.sets.map((s) => {
        const mark = EFFORT_TEXT[s.effort] ? ` ${EFFORT_TEXT[s.effort]}` : '';
        const amount = ex.kind === 'time' ? formatSeconds(s.seconds) : s.reps;
        return `${weightText(s.weight)} kg x ${amount}${mark}`;
      }),
    ].join('\n'));
    const head = w.name && w.name !== 'Training'
      ? `${dateText(w.date)} ${w.name}`
      : dateText(w.date);
    const note = w.note ? [`# Notiz: ${w.note.replace(/\n/g, ' ')}`] : [];
    return [head, '', ...blocks.flatMap((b) => [b, '']), ...note].join('\n').trimEnd();
  }).join('\n\n');
}
