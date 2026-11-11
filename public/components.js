/**
 * Normalize the children shared by initial rendering and updates.
 * Views use null/undefined/false for absent controls and arrays for repeated rows.
 * Keep zero and empty strings as valid content, and turn strings into text nodes
 * so descriptions and customer messages cannot inject markup.
 */
function childNodes(children) {
  return children.flat(Infinity)
    .filter(child => child != null && child !== false)
    .map(child => child instanceof Node ? child : document.createTextNode(String(child)));
}

/**
 * Construct an element with attributes, event callbacks and normalized children.
 * A true attribute enables HTML flags such as required. False and null omit them.
 * Pass ARIA values as strings when the literal value "false" is meaningful.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...childNodes(children));
  return node;
}

// Native replaceChildren converts null to visible text. Apply the same rules as el().
export function replace(node, ...children) {
  node.replaceChildren(...childNodes(children));
}

// Prices arrive in paise. Both the displayed timestamp and default report date use IST.
export const money = value => '₹' + (value / 100).toFixed(2);
export const dateTime = value => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
export const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
// Wrap each input in its label so the visible wording is also the accessible name.
export const input = (label, name, attrs = {}) => el('label', {}, label, el('input', { name, ...attrs }));
export const select = (label, name, options, value) => el('label', {}, label,
  el('select', { name }, options.map(([id, text]) => el('option', { value: id, selected: String(id) === String(value) }, text))));
export const textarea = (label, name, attrs = {}) => el('label', {}, label, el('textarea', { name, rows: 3, ...attrs }));
export const button = (text, onclick, secondary = false) => el('button',
  { type: 'button', onclick, class: secondary ? 'secondary' : null }, text);
export const badge = (text, warn = false) => el('span', { class: 'badge' + (warn ? ' warn' : '') }, text);
export const card = (...children) => el('section', { class: 'card stack' }, ...children);
export const title = (heading, subtitle) => el('div', {}, el('h1', {}, heading), el('p', { class: 'muted' }, subtitle));
export const note = (message, kind = 'notice') => el('p', { class: kind, role: kind === 'error' ? 'alert' : 'status' }, message);
export const mobileInput = (value = '') => input('Mobile number', 'phone',
  { type: 'tel', autocomplete: 'tel', value, placeholder: '9876543210', maxlength: 15, required: true });

// Without a body this is a GET. With a body, send JSON on the same origin so
// the browser attaches its HttpOnly cart and session cookies automatically.
export async function api(path, body) {
  const options = body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  };
  const response = await fetch('/api/' + path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

/**
 * Build a validated form with inline feedback. The callback receives named
 * string values from FormData and converts them to the endpoint's expected types.
 * Disable submit during the write and release it whether the request succeeds or fails.
 */
export function form(fields, submit, action, className = 'stack') {
  const error = note('', 'error');
  const send = el('button', { type: 'submit' }, submit);
  return el('form', { class: className, onsubmit: async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    error.textContent = '';
    send.disabled = true;
    try { await action(values); }
    catch (failure) { error.textContent = failure.message; }
    finally { send.disabled = false; }
  } }, fields, el('div', {}, send), error);
}

// Use the same feedback and pending behavior for actions that have no form fields.
export function actionButton(text, action, error, secondary = false) {
  return button(text, async event => {
    const control = event.currentTarget;
    control.disabled = true;
    error.textContent = '';
    try { await action(); }
    catch (failure) { error.textContent = failure.message; }
    finally { control.disabled = false; }
  }, secondary);
}

// Display order snapshots using the stored unit price, even when the current menu changes.
export function lines(order) {
  return el('div', {}, order.lines.map(line => el('div', { class: 'row line' },
    el('span', {}, line.quantity + ' × ' + line.name), el('strong', {}, money(line.quantity * line.unit_price)))));
}
