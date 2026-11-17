import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHttpServer } from '../../src/http.js';
import { fixture } from '../support/fixture.js';

// Listen on an available local port with an isolated database. No demo data file
// or running application is changed. Register cleanup for the local listener.
async function localServer(t, app) {
  const server = createHttpServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return 'http://127.0.0.1:' + server.address().port;
}

// Check authorization through the public request boundary, not only a hidden tab.
test('A guest cannot open the staff order queue', async t => {
  const { app } = fixture(t);
  const base = await localServer(t, app);
  const response = await fetch(base + '/api/staff/orders');
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /sign in/i);
});

// A valid staff session may use staff functions but must not read admin accounts.
test('A staff account cannot open administrator features', async t => {
  const { app } = fixture(t);
  app.auth.createAccount('barista', 'password123', 'staff');
  const base = await localServer(t, app);
  const login = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'barista', password: 'password123' })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base + '/api/staff/orders', { headers: { Cookie: cookie } })).status, 200);
  const response = await fetch(base + '/api/admin/staff', { headers: { Cookie: cookie } });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /role/i);
});
