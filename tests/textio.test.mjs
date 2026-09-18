// Testet den Textimport gegen das Format der bisherigen Trainingsnotiz.
// Aufruf: node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkoutText, workoutsToText } from '../js/textio.js';

const NOTIZ = `Training Fitko
21.05.2026
Abductor Leg Extension Oberschenkel
45 kg x 15
55 kg x 15
65 kg x 15 -

Oberarme zu sich ziehen
35 kg x 12
45 kg x 10
50 kg x 15 -

Arme hoch auf Bank
8 kg x 15
10 kg x 15
12 kg x 15

Triceps hoch
15 kg x 15
20 kg x 13

Seated Dip Arme gerade nach unten
40 kg x 15
60 kg x 15
80 kg x 15

Waden
160 kg x 15`;

test('liest die Notiz im bisherigen Format', () => {
  const { workouts, warnings } = parseWorkoutText(NOTIZ);

  assert.equal(workouts.length, 1);
  const w = workouts[0];
  assert.equal(w.date, '2026-05-21');
  assert.equal(w.name, 'Training Fitko', 'Titel vor dem Datum wird zum Namen');
  assert.equal(w.exercises.length, 6);
  assert.deepEqual(w.exercises.map((e) => e.name), [
    'Abductor Leg Extension Oberschenkel',
    'Oberarme zu sich ziehen',
    'Arme hoch auf Bank',
    'Triceps hoch',
    'Seated Dip Arme gerade nach unten',
    'Waden',
  ]);
  assert.deepEqual(warnings, [], 'keine Zeile bleibt unverstanden');
});

test('übernimmt Gewicht und Wiederholungen je Satz', () => {
  const [w] = parseWorkoutText(NOTIZ).workouts;
  const plain = (name) => w.exercises.find((e) => e.name === name)
    .sets.map((s) => [s.weight, s.reps]);

  assert.deepEqual(plain('Abductor Leg Extension Oberschenkel'),
    [[45, 15], [55, 15], [65, 15]], 'nachgestellter Strich stört nicht');
  assert.deepEqual(plain('Oberarme zu sich ziehen'), [[35, 12], [45, 10], [50, 15]]);
  assert.deepEqual(plain('Triceps hoch'), [[15, 15], [20, 13]]);
  assert.deepEqual(plain('Waden'), [[160, 15]]);
});

test('importierte Sätze gelten als absolviert', () => {
  const [w] = parseWorkoutText(NOTIZ).workouts;
  assert.ok(w.exercises.every((e) => e.sets.every((s) => s.done)));
  assert.equal(w.status, 'done');
});

test('trennt mehrere Trainings an den Datumszeilen', () => {
  const { workouts } = parseWorkoutText(`21.05.2026 Oberkörper
Latzug
50 kg x 12

28.05.2026 Beine
Beinpresse
100 kg x 10
120 kg x 8`);

  assert.equal(workouts.length, 2);
  assert.deepEqual(workouts.map((w) => [w.date, w.name]),
    [['2026-05-21', 'Oberkörper'], ['2026-05-28', 'Beine']]);
  assert.equal(workouts[1].exercises[0].sets.length, 2);
});

test('versteht auch Sätze in einer Zeile', () => {
  const { workouts } = parseWorkoutText(`2026-05-21 Test
Beinpresse 80x12, 80x12, 90x10
Latzug 3x10 @ 55`);

  const [beinpresse, latzug] = workouts[0].exercises;
  assert.deepEqual(beinpresse.sets.map((s) => [s.weight, s.reps]),
    [[80, 12], [80, 12], [90, 10]]);
  assert.equal(latzug.sets.length, 3);
  assert.deepEqual(latzug.sets.map((s) => [s.weight, s.reps]), [[55, 10], [55, 10], [55, 10]]);
});

test('Übungsnamen mit Zahl werden nicht als Satz gelesen', () => {
  const { workouts } = parseWorkoutText(`21.05.2026
45-Grad Beinpresse
100 kg x 10`);

  assert.equal(workouts[0].exercises.length, 1);
  assert.equal(workouts[0].exercises[0].name, '45-Grad Beinpresse');
  assert.equal(workouts[0].exercises[0].sets.length, 1);
});

test('meldet Sätze ohne Übung, statt sie zu verschlucken', () => {
  const { workouts, warnings } = parseWorkoutText(`21.05.2026
45 kg x 15`);

  assert.equal(workouts[0].exercises[0].name, 'Übung');
  assert.equal(workouts[0].exercises[0].sets.length, 1);
  assert.match(warnings[0], /ohne vorangehende Übung/);
});

test('nimmt Notizzeilen auf', () => {
  const { workouts } = parseWorkoutText(`21.05.2026
Latzug
50 kg x 12
# Notiz: Schulter zwickt`);

  assert.equal(workouts[0].note, 'Schulter zwickt');
});

test('Export lässt sich wieder einlesen', () => {
  const original = parseWorkoutText(NOTIZ).workouts;
  const roundTrip = parseWorkoutText(workoutsToText(original)).workouts;

  assert.equal(roundTrip.length, original.length);
  assert.deepEqual(
    roundTrip[0].exercises.map((e) => [e.name, e.sets.map((s) => [s.weight, s.reps])]),
    original[0].exercises.map((e) => [e.name, e.sets.map((s) => [s.weight, s.reps])]),
  );
  assert.equal(roundTrip[0].date, original[0].date);
});

test('Export nutzt das gewohnte Layout', () => {
  const [w] = parseWorkoutText(NOTIZ).workouts;
  const text = workoutsToText([w]);

  assert.ok(text.startsWith('21.05.2026 Training Fitko'), text.slice(0, 60));
  assert.ok(text.includes('Abductor Leg Extension Oberschenkel\n45 kg x 15\n55 kg x 15\n65 kg x 15'));
});
