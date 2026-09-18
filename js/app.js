// Einstiegspunkt: Routen registrieren, Chrome (Titel, Zurück, Tabs) pflegen.

import { load } from './store.js';
import { defineRoute, start, refresh } from './router.js';
import * as history from './views/history.js';
import * as newWorkout from './views/new.js';
import * as workout from './views/workout.js';
import * as templates from './views/templates.js';
import * as exercises from './views/exercises.js';
import * as data from './views/data.js';

load();

defineRoute('/', history.render);
defineRoute('/neu', newWorkout.render);
defineRoute('/training/:id', workout.render);
defineRoute('/vorlagen', templates.render);
defineRoute('/uebungen', exercises.renderList);
defineRoute('/uebung/:name', exercises.renderDetail);
defineRoute('/daten', data.render);

const titleEl = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const tabbar = document.getElementById('tabbar');

backBtn.addEventListener('click', () => {
  const target = backBtn.dataset.href;
  if (target) location.hash = target;
  else window.history.back();
});

function afterRender(result, path) {
  titleEl.textContent = result.title || 'Fitko';
  document.title = result.title ? `${result.title} · Fitko` : 'Fitko';

  backBtn.hidden = !result.back;
  backBtn.dataset.href = result.back || '';

  tabbar.querySelectorAll('a').forEach((a) => {
    const tab = a.dataset.tab;
    const match = tab === '/' ? path === '/' : path.startsWith(tab);
    if (match) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

start({ target: document.getElementById('view'), afterRender });

// Zwei Tabs bzw. Fenster derselben App halten sich gegenseitig aktuell.
window.addEventListener('storage', (e) => {
  if (e.key === 'fitko.state.v1') { load(); refresh(); }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) =>
      console.warn('Service Worker nicht registriert', err));
  });
}
