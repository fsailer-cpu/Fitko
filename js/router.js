// Hash-Routing. Ein Hash statt History-API, damit die App auch als
// statische Datei unter beliebigem Pfad funktioniert (GitHub Pages,
// lokal, vom Homescreen aus).

const routes = [];
let renderTarget = null;
let onRendered = null;

export function defineRoute(pattern, view) {
  // '/training/:id' -> /^\/training\/([^/]+)$/ plus die Namen der Parameter
  const names = [];
  const source = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/:(\w+)/g, (_, name) => { names.push(name); return '/([^/]+)'; });
  routes.push({ regex: new RegExp(`^${source}$`), names, view });
}

function currentPath() {
  const hash = location.hash.replace(/^#/, '');
  return hash || '/';
}

function resolve(path) {
  for (const route of routes) {
    const match = route.regex.exec(path);
    if (match) {
      const params = {};
      route.names.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
      return { view: route.view, params };
    }
  }
  return null;
}

export function refresh() {
  const path = currentPath();
  const hit = resolve(path);
  if (!hit) { location.hash = '#/'; return; }

  let result;
  try {
    result = hit.view(hit.params) || {};
  } catch (err) {
    console.error('Ansicht konnte nicht gerendert werden', err);
    result = { title: 'Fehler', body: errorBox(err) };
  }

  renderTarget.replaceChildren(result.body || document.createTextNode(''));
  window.scrollTo(0, 0);
  onRendered?.(result, path);
}

function errorBox(err) {
  const div = document.createElement('div');
  div.className = 'empty';
  div.innerHTML = '<h2>Da ist etwas schiefgelaufen</h2>';
  const p = document.createElement('p');
  p.className = 'small';
  p.textContent = String(err && err.message ? err.message : err);
  div.append(p);
  return div;
}

/** Titel der Kopfzeile nachträglich ändern (z. B. beim Umbenennen). */
export function setTitle(title) {
  onRendered?.({ title, back: document.getElementById('backBtn').dataset.href || '' }, currentPath());
}

export function start({ target, afterRender }) {
  renderTarget = target;
  onRendered = afterRender;
  window.addEventListener('hashchange', refresh);
  refresh();
}
