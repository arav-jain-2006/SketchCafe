import { el, note } from './components.js';
import { menuPage, trackPage, supportPage } from './views.js';
import { teamPage } from './team.js';

const app = document.querySelector('#app');
const pages = { menu: menuPage, track: trackPage, support: supportPage, team: teamPage };
// Keep the current order, credentials and selected team tab in memory for this browser tab.
const state = { order: null, tracking: null, teamTab: '', payment: null };
let page = '';
let lifecycle;

// Every route owns its polling timers. Abort the old route before starting a new one.
async function render() {
  lifecycle?.abort();
  lifecycle = new AbortController();
  const { signal } = lifecycle;
  // Hash routes work on the single HTML entry point and preserve browser Back/Forward behavior.
  page = Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : 'menu';
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#' + page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  app.setAttribute('aria-busy', 'true');
  app.replaceChildren(el('p', {}, 'Loading…'));
  try {
    const view = await pages[page]({ state, signal, refresh: render, go });
    // An older request may finish after navigation. Only the current view can replace the page.
    if (!signal.aborted) app.replaceChildren(view);
  } catch (error) {
    if (!signal.aborted) app.replaceChildren(note(error.message, 'error'));
  } finally {
    if (!signal.aborted) app.removeAttribute('aria-busy');
  }
}

// Navigating to the current route refreshes it without adding another history entry.
function go(target) {
  if (location.hash === '#' + target) return render();
  location.hash = target;
}

window.addEventListener('hashchange', () => {
  window.scrollTo(0, 0);
  render();
});
// Move keyboard focus to the content without changing the route hash.
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  app.focus();
});
render();
