// Minimale DOM-Helfer. Bewusst kein Framework: die App soll ohne Build-Schritt
// laufen und direkt als statische Seite (z. B. GitHub Pages) deploybar sein.

/**
 * h('div.card', { onclick }, ...kinder)
 * Tag-String unterstützt `tag.klasse1.klasse2` und `tag#id`.
 */
export function h(spec, props = null, ...children) {
  const [head, ...classes] = String(spec).split('.');
  const [tag, id] = head.split('#');
  const node = document.createElement(tag || 'div');
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(' ');

  if (props && (typeof props !== 'object' || props.nodeType || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = [node.className, value].filter(Boolean).join(' ');
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'value') node.value = value;
    else if (key === 'checked' || key === 'disabled' || key === 'hidden') node[key] = Boolean(value);
    else node.setAttribute(key, value === true ? '' : value);
  }

  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(node, child);
    else node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
}

let toastTimer = null;

export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('toast--on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--on'), 2200);
}

export function confirmAction(message) {
  return window.confirm(message);
}

/** Kurzes haptisches Feedback, sofern das Gerät es unterstützt. */
export function buzz(ms = 8) {
  navigator.vibrate?.(ms);
}
