// Persistenz + zentraler App-State.
// Alles liegt lokal auf dem Gerät (localStorage), es gibt keinen Server.

const STORAGE_KEY = 'fitko.state.v1';
const SCHEMA_VERSION = 1;

const listeners = new Set();

function emptyState() {
  return {
    version: SCHEMA_VERSION,
    workouts: [],   // abgeschlossene und laufende Trainings
    templates: [],  // benannte Vorlagen
    catalog: [],    // {id, name, group} – Maschinen/Übungen
    settings: { weightStep: 2.5, unit: 'kg' },
  };
}

let state = emptyState();

/** Hebt alte Datenstände auf das aktuelle Schema. */
function migrate(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings || {}) },
    workouts: Array.isArray(raw.workouts) ? raw.workouts : [],
    templates: Array.isArray(raw.templates) ? raw.templates : [],
    catalog: Array.isArray(raw.catalog) ? raw.catalog : [],
    version: SCHEMA_VERSION,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = migrate(raw ? JSON.parse(raw) : null);
  } catch (err) {
    console.error('State konnte nicht gelesen werden', err);
    state = emptyState();
  }
  return state;
}

export function getState() {
  return state;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('State konnte nicht gespeichert werden', err);
    return false;
  }
}

/**
 * Einzige erlaubte Schreiboperation: mutiert den State, speichert ihn und
 * benachrichtigt die Views. `fn` bekommt den State und darf ihn direkt ändern.
 */
export function mutate(fn) {
  fn(state);
  const ok = persist();
  listeners.forEach((l) => l(state));
  return ok;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Vollständiger Datenstand als Objekt – für Backups. */
export function exportState() {
  return JSON.parse(JSON.stringify(state));
}

/** Backup einspielen. `mode` ist 'replace' oder 'merge'. */
export function importState(raw, mode = 'replace') {
  const incoming = migrate(raw);
  if (mode === 'replace') {
    return mutate((s) => {
      Object.assign(s, incoming);
    });
  }
  return mutate((s) => {
    const byId = new Map(s.workouts.map((w) => [w.id, w]));
    incoming.workouts.forEach((w) => byId.set(w.id, w));
    s.workouts = [...byId.values()];

    const tplById = new Map(s.templates.map((t) => [t.id, t]));
    incoming.templates.forEach((t) => tplById.set(t.id, t));
    s.templates = [...tplById.values()];

    const names = new Set(s.catalog.map((c) => c.name.toLowerCase()));
    incoming.catalog.forEach((c) => {
      if (!names.has(c.name.toLowerCase())) {
        s.catalog.push(c);
        names.add(c.name.toLowerCase());
      }
    });
  });
}

export function resetAll() {
  return mutate((s) => Object.assign(s, emptyState()));
}
