// Halteübungen: Zeit statt Wiederholungen (Plank & Co.).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSeconds, parseSeconds, makeExercise, makeSet, isTimed,
  volumeOf, holdTimeOf, summarizeSets,
} from '../js/model.js';
import { parseWorkoutText, workoutsToText } from '../js/textio.js';

test('formatiert und liest mm:ss', () => {
  assert.equal(formatSeconds(90), '01:30');
  assert.equal(formatSeconds(0), '00:00');
  assert.equal(formatSeconds(75), '01:15');
  assert.equal(formatSeconds(3600), '60:00', 'Minuten laufen weiter, keine Stunden');

  assert.equal(parseSeconds('01:30'), 90);
  assert.equal(parseSeconds('1:30'), 90);
  assert.equal(parseSeconds('90'), 90, 'nackte Zahl sind Sekunden');
  assert.equal(parseSeconds(''), 0);
  assert.equal(parseSeconds('Unsinn'), 0);
});

test('eine Halteübung startet mit einer brauchbaren Zeit', () => {
  const ex = makeExercise('Plank', null, 'time');
  assert.ok(isTimed(ex));
  assert.equal(ex.sets.length, 1);
  assert.equal(ex.sets[0].seconds, 60);
});

test('Zeit-Sätze zählen nicht ins kg-Volumen', () => {
  const plank = makeExercise('Plank', [makeSet(85, 0, null, 90)], 'time');
  const presse = makeExercise('Beinpresse', [makeSet(100, 10)]);

  assert.equal(volumeOf(plank), 0, '85 kg × 90 s wäre keine vergleichbare Zahl');
  assert.equal(volumeOf(presse), 1000);
  assert.equal(holdTimeOf(plank), 90);
  assert.equal(holdTimeOf(presse), 0);
});

test('Haltezeit zählt nur erledigte Sätze, wenn verlangt', () => {
  const plank = makeExercise('Plank', [
    makeSet(85, 0, null, 90),
    makeSet(85, 0, null, 60),
  ], 'time');
  plank.sets[0].done = true;

  assert.equal(holdTimeOf(plank, true), 90);
  assert.equal(holdTimeOf(plank, false), 150);
});

test('Zusammenfassung zeigt Zeiten statt Wiederholungen', () => {
  const sets = [makeSet(85, 0, null, 90), makeSet(85, 0, null, 90)];
  assert.equal(summarizeSets(sets, 'time'), '2 × 01:30 @ 85 kg');

  sets[1].seconds = 75;
  assert.equal(summarizeSets(sets, 'time'), '01:30 · 01:15');

  sets[1].effort = 'limit';
  assert.equal(summarizeSets(sets, 'time'), '01:30 · 01:15 −');
});

test('liest Halteübungen aus dem Text', () => {
  const { workouts, warnings } = parseWorkoutText(`19.09.2026 Core
Plank
85 kg x 01:30
85 kg x 01:15 -

Beinpresse
100 kg x 10`);

  const [plank, presse] = workouts[0].exercises;
  assert.equal(plank.kind, 'time');
  assert.deepEqual(plank.sets.map((s) => [s.weight, s.seconds, s.effort]),
    [[85, 90, null], [85, 75, 'limit']]);
  assert.equal(presse.kind, 'reps', 'eine Übung ohne Zeit bleibt bei Wiederholungen');
  assert.equal(presse.sets[0].seconds, 0);
  assert.deepEqual(warnings, []);
});

test('versteht auch "3 x 01:30 @ 85", "01:30" und "90 s"', () => {
  const { workouts } = parseWorkoutText(`19.09.2026
Plank A
3 x 01:30 @ 85
Plank B
01:45
Plank C
90 s`);

  const [a, b, c] = workouts[0].exercises;
  assert.equal(a.sets.length, 3);
  assert.deepEqual(a.sets.map((s) => [s.weight, s.seconds]), [[85, 90], [85, 90], [85, 90]]);
  assert.equal(a.kind, 'time');
  assert.equal(b.sets[0].seconds, 105);
  assert.equal(c.sets[0].seconds, 90);
});

test('Export schreibt mm:ss und liest sich wieder ein', () => {
  const original = parseWorkoutText(`19.09.2026 Core
Plank
85 kg x 01:30
85 kg x 01:15 -
Beinpresse
100 kg x 10 +`).workouts;

  const text = workoutsToText(original);
  assert.ok(text.includes('85 kg x 01:30'), text);
  assert.ok(text.includes('85 kg x 01:15 -'), text);
  assert.ok(text.includes('100 kg x 10 +'), text);

  const shape = (ws) => ws[0].exercises.map((e) =>
    [e.name, e.kind, e.sets.map((s) => [s.weight, s.reps, s.seconds, s.effort])]);
  assert.deepEqual(shape(parseWorkoutText(text).workouts), shape(original));
});

test('ein Datum wird nicht als Zeit missverstanden', () => {
  const { workouts } = parseWorkoutText(`21.05.2026
Latzug
50 kg x 12`);

  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].date, '2026-05-21');
  assert.equal(workouts[0].exercises[0].kind, 'reps');
});
