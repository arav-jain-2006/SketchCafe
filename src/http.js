import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { field, integer, Problem, requireValue } from './rules.js';
import { validateDate } from './reports.js';

// Prevent caching of guest or employee data and limit where pages can load resources.
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https:; object-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'"
};

// Explicit allowlist keeps source files, tests and the database outside the public root.
const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/style.css', ['style.css', 'text/css']],
  ['/coffee-art.svg', ['coffee-art.svg', 'image/svg+xml']],
  ['/ui.js', ['ui.js', 'text/javascript']],
  ['/views.js', ['views.js', 'text/javascript']],
  ['/team.js', ['team.js', 'text/javascript']],
  ['/components.js', ['components.js', 'text/javascript']]
]);

// Both cookies are opaque IDs. SameSite restricts cross-site use and HttpOnly keeps them out of browser scripts.
function cookie(name, value, maxAge) {
  return name + '=' + value + '; Path=/; HttpOnly; SameSite=Strict' +
    (maxAge === undefined ? '' : '; Max-Age=' + maxAge);
}

/**
 * Read a bounded JSON object. The API accepts named fields only, so arrays and
 * primitives fail before they can reach feature services.
 */
async function jsonBody(request) {
  requireValue(request.headers['content-type']?.split(';')[0].trim() === 'application/json',
    'Send an application/json request.', 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size <= 16384) chunks.push(chunk);
    else break;
  }
  requireValue(size <= 16384, 'Request is too large.', 413);
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Problem(400, 'The request is not valid JSON.'); }
  requireValue(data && typeof data === 'object' && !Array.isArray(data), 'Send a JSON object.');
  return data;
}

/**
 * Translate HTTP input to service calls and service results back to JSON.
 * Each route registers its required role so permissions are enforced centrally.
 */
export function createHttpServer(app) {
  const { auth, cart, catalog, feedback, orders, payments, reports } = app;
  const id = data => integer(data.id, 'ID', 1);
  const maybeId = data => data.id == null ? null : id(data);
  const tracked = d => orders.track(d.orderId, d.phone);
  const roles = new Map();
  const routes = new Map();
  // Bind authorization at route registration and enforce it before invoking the handler.
  const route = (method, path, handle, role) => {
    const key = method + ' /api/' + path;
    routes.set(key, handle);
    if (role) roles.set(key, role);
  };
  const post = (path, handle, role) => route('POST', path, handle, role);
  const get = (path, handle, role) => route('GET', path, handle, role);

  // Public menu and cart routes use bounded query strings and an opaque cart cookie.
  get('menu', ({ query }) => catalog.list(query.get('q')?.slice(0, 100) ?? '', query.get('category') ?? ''));
  get('item', ({ query }) => catalog.item(id({ id: Number(query.get('id')) })));
  get('cart', ({ cookies }) => cart.view(cookies.sketch_cart));
  post('cart', ({ data, cookies, response }) => {
    const result = cart.change(cookies.sketch_cart, id(data), data.quantity, data.add === true);
    response.setHeader('Set-Cookie', cookie('sketch_cart', result.id, 604800));
    return result.cart;
  });
  // Checkout returns the tracking read model. The mobile number stays in request bodies, never the URL.
  post('order', ({ data, cookies }) => {
    const order = orders.place(cookies.sketch_cart, data);
    return orders.track(order.id, order.phone);
  });
  post('track', ({ data }) => tracked(data));
  // A simulated outcome and verification are distinct actions. Verification decides what the café can trust.
  post('payment/start', ({ data }) => payments.start(data.orderId, data.phone));
  post('payment/demo', ({ data }) => {
    payments.demoOutcome(data.orderId, data.phone, field(data.attemptId, 'Payment attempt', 36, 36), data.outcome);
    return { ok: true };
  });
  post('payment/verify', ({ data }) => payments.verify(data.orderId, data.phone,
    field(data.attemptId, 'Payment attempt', 36, 36)));
  // Guest feedback uses the same ownership checks as tracking. General support can omit the order code.
  post('review', ({ data }) => { feedback.review(data); return tracked(data); });
  post('support', ({ data }) => ({ id: feedback.request(data) }));
  post('support/lookup', ({ data }) => feedback.lookup(id(data), data.phone));

  // Employee auth endpoints set, replace or clear the session cookie. The token is never in the JSON response.
  get('session', ({ token }) => auth.user(token));
  post('login', ({ data, token, response }) => {
    const result = auth.login(data);
    auth.logout(token);
    response.setHeader('Set-Cookie', cookie('sketch_session', result.token));
    return result.user;
  });
  post('logout', ({ token, response }) => {
    auth.logout(token);
    response.setHeader('Set-Cookie', cookie('sketch_session', '', 0));
    return { ok: true };
  });
  post('password', ({ data, person, response }) => {
    auth.changePassword(person.id, data.current, data.password);
    response.setHeader('Set-Cookie', cookie('sketch_session', '', 0));
    return { ok: true };
  }, 'employee');

  // Staff routes expose the verified queue, status transitions and a narrow availability update.
  get('staff/orders', ({ query }) => {
    const date = query.get('date') ?? '';
    if (date) validateDate(date);
    const status = query.get('status') ?? '';
    requireValue(['', 'Paid', 'Preparing', 'Ready', 'Completed'].includes(status), 'Choose a valid status.');
    return { orders: orders.staffList({ date, status, active: query.get('active') === '1' }), daily: reports.daily() };
  }, 'staff');
  post('staff/status', ({ data }) => orders.advance(field(data.orderId, 'Order code', 20),
    field(data.status, 'Status', 20)), 'staff');
  post('staff/availability', ({ data }) => {
    catalog.setAvailability(id(data), data.available);
    return { ok: true };
  }, 'staff');

  // Admin routes manage menu and employee records and read sales or feedback.
  post('admin/category', ({ data }) => ({ id: catalog.saveCategory(maybeId(data), data) }), 'admin');
  post('admin/category/remove', ({ data }) => { catalog.removeCategory(id(data)); return { ok: true }; }, 'admin');
  post('admin/item', ({ data }) => ({ id: catalog.saveItem(maybeId(data), data) }), 'admin');
  post('admin/item/remove', ({ data }) => { catalog.archiveItem(id(data)); return { ok: true }; }, 'admin');
  get('admin/staff', () => auth.staff(), 'admin');
  post('admin/staff', ({ data }) => auth.saveStaff(maybeId(data), data), 'admin');
  get('admin/reports', ({ query }) => reports.sales(query.get('from'), query.get('to')), 'admin');
  get('admin/feedback', () => feedback.list(), 'admin');
  post('admin/feedback/resolve', ({ data }) => { feedback.resolve(id(data), data.response); return { ok: true }; }, 'admin');

  // Fixed-minute counters limit credential and ownership guessing. The local demo keys them by client address.
  const limits = new Map();
  function limit(key, max) {
    const minute = Math.floor(Date.now() / 60000);
    const state = limits.get(key);
    if (!state || state.minute !== minute) limits.set(key, { minute, count: 0 });
    requireValue(++limits.get(key).count <= max, 'Too many attempts. Try again in a minute.', 429);
    if (limits.size > 100) {
      for (const [ip, window] of limits) if (window.minute !== minute) limits.delete(ip);
    }
  }

  return createServer(async (request, response) => {
    const send = (status, body, type = 'application/json') => {
      response.writeHead(status, { ...headers, 'Content-Type': type + '; charset=utf-8' });
      response.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    try {
      // Reject non-local Host headers and cross-origin targets even though the listener is on loopback.
      requireValue(/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host ?? ''),
        'Open the app on localhost.', 403);
      const origin = 'http://' + request.headers.host;
      const url = new URL(request.url, origin);
      requireValue(url.origin === origin, 'Invalid request origin.', 403);
      // Serve only known static paths before dispatching JSON endpoints.
      if (request.method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        return send(200, readFileSync(new URL('../public/' + file, import.meta.url)), type);
      }
      const key = request.method + ' ' + url.pathname;
      const handler = routes.get(key);
      requireValue(handler, 'This page or action could not be found.', 404);
      const cookies = Object.fromEntries((request.headers.cookie ?? '').split(';')
        .map(entry => entry.trim().split('=')).filter(parts => parts.length === 2));
      const token = cookies.sketch_session;
      const role = roles.get(key);
      const context = { cookies, token, query: url.searchParams, response };
      if (request.method === 'POST') {
        requireValue(!request.headers.origin || request.headers.origin === origin, 'Cross-site request refused.', 403);
        if (url.pathname === '/api/login') limit('login:' + request.socket.remoteAddress, 30);
        if (url.pathname === '/api/track' || url.pathname.startsWith('/api/payment/') ||
            ['/api/review', '/api/support', '/api/support/lookup'].includes(url.pathname)) {
          limit('customer:' + request.socket.remoteAddress, 300);
        }
        context.data = await jsonBody(request);
      }
      // Load the current session before protected actions, so deactivation takes effect on the next request.
      if (role) context.person = auth.requireRole(token, role);
      return send(200, handler(context));
    } catch (error) {
      // Return expected validation errors. Log unexpected failures without exposing their details.
      if (!(error instanceof Problem)) console.error(error);
      return send(error instanceof Problem ? error.status : 500,
        { error: error instanceof Problem ? error.message : 'Something went wrong. Please try again.' });
    }
  });
}
