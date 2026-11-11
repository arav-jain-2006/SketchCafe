import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCredentials } from '../../src/app.js';
import { Problem } from '../../src/rules.js';
import { serverFixture } from '../support/http.js';

test('HTTP serves all client modules, checks origin, validates IDs and protects sessions', async t => {
  const { client } = await serverFixture(t);
  const browser = client();
  const page = await browser('/');
  assert.equal(page.status, 200);
  assert.match(page.data, /Sketch Café/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  for (const path of ['/ui.js', '/views.js', '/team.js', '/components.js', '/style.css']) {
    assert.equal((await browser(path)).status, 200);
  }
  assert.equal((await browser('/api/admin/feedback')).status, 401);
  assert.equal((await browser('/api/cart', { id: 1, quantity: 1 }, { Origin: 'https://external.invalid' })).status, 403);
  assert.equal((await browser('/api/cart', { id: '1; DROP TABLE items', quantity: 1 })).status, 400);
  assert.equal((await browser('/api/payment/verify', {})).status, 400);
  assert.equal((await browser('/api/item?id=missing')).status, 400);
  const signed = await browser('/api/login', { username: 'admin', password: demoCredentials.admin });
  assert.match(signed.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal(signed.data.password_hash, undefined);
  assert.equal((await browser('/api/session')).data.role, 'admin');
  await browser('/api/logout', {});
  assert.equal((await browser('/api/session')).data, null);
});

test('HTTP rejects unsupported media types, malformed JSON and oversized bodies', async t => {
  const { url } = await serverFixture(t);
  const send = (type, body) => fetch(url + '/api/cart', {
    method: 'POST', headers: { 'Content-Type': type }, body
  });
  assert.equal((await send('text/plain', '{}')).status, 415);
  assert.equal((await send('application/json', '{')).status, 400);
  assert.equal((await send('application/json', '[]')).status, 400);
  assert.equal((await send('application/json', JSON.stringify({ padding: 'a'.repeat(20000) }))).status, 413);
});

test('HTTP returns current menu and never serves arbitrary source files', async t => {
  const { client } = await serverFixture(t);
  const browser = client();
  assert.equal((await browser('/src/schema.sql')).status, 404);
  assert.equal((await browser('/api/menu', {})).status, 404);
  const menu = await browser('/api/menu?q=pesto');
  assert.equal(menu.data.items.length, 1);
  const item = await browser('/api/item?id=' + menu.data.items[0].id);
  assert.equal(item.data.name, 'Pesto Grilled Sandwich');
});

test('HTTP hides internal failures behind a stable JSON error response', async t => {
  const { app, client } = await serverFixture(t);
  app.catalog.list = () => { throw new Error('private database detail'); };
  t.mock.method(console, 'error', () => {});
  const failure = await client()('/api/menu');
  assert.equal(failure.status, 500);
  assert.equal(failure.data.error, 'Something went wrong. Please try again.');
  assert.equal(console.error.mock.callCount(), 1);
});

test('changing a password requires authentication and invalidates existing sessions', async t => {
  const { client } = await serverFixture(t);
  const first = client();
  const second = client();
  const original = { username: 'staff', password: demoCredentials.staff };
  const change = { current: original.password, password: 'UpdatedStaff!26' };
  assert.equal((await first('/api/password', change)).status, 401);
  await first('/api/login', original);
  await second('/api/login', original);
  assert.equal((await first('/api/password', change)).status, 200);
  assert.equal((await second('/api/staff/orders')).status, 401);
  assert.equal((await second('/api/login', original)).status, 401);
  assert.equal((await second('/api/login', { ...original, password: change.password })).status, 200);
});

test('login rate limiting rejects further attempts and resets at the next minute', async t => {
  const { app, client } = await serverFixture(t);
  const browser = client();
  let clock = 60000;
  t.mock.method(Date, 'now', () => clock);
  // Use a fast stub here so this case isolates the transport limiter from password hashing.
  const login = t.mock.method(app.auth, 'login', () => {
    throw new Problem(401, 'Invalid credentials');
  });
  for (let index = 0; index < 30; index++) {
    assert.equal((await browser('/api/login', {})).status, 401);
  }
  assert.equal((await browser('/api/login', {})).status, 429);
  assert.equal(login.mock.callCount(), 30);
  clock += 60000;
  assert.equal((await browser('/api/login', {})).status, 401);
  assert.equal(login.mock.callCount(), 31);
});
