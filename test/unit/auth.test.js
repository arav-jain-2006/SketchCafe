import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus } from '../support/fixture.js';

// Login succeeds and returns a staff user.
test("Login with valid credentials", t => {
  const { app } = fixture(t);
  app.auth.createAccount('barista', 'password123', 'staff');
  assert.equal(app.auth.login({ username: 'barista', password: 'password123' }).user.role, 'staff');
});

// An incorrect-credentials error is returned.
test("Login with an incorrect password", t => {
  const { app } = fixture(t);
  app.auth.createAccount('barista', 'password123', 'staff');
  assert.throws(() => app.auth.login({ username: 'barista', password: 'wrong' }), hasStatus(401));
});

// A validation message is returned.
test("Login with empty fields", t => {
  const { app } = fixture(t);
  assert.throws(() => app.auth.login({ username: '', password: '' }), hasStatus(400));
});

// An incorrect-credentials error is returned.
test("Login with an unregistered username", t => {
  const { app } = fixture(t);
  assert.throws(() => app.auth.login({ username: 'unknown', password: 'password123' }), hasStatus(401));
});

// Login is refused.
test("Login with an inactive account", t => {
  const { app } = fixture(t);
  const user = app.auth.createAccount('barista', 'password123', 'staff');
  app.auth.saveStaff(user.id, { username: 'barista', active: false });
  assert.throws(() => app.auth.login({ username: 'barista', password: 'password123' }), hasStatus(401));
});

// The session is closed.
test("Log out of an account", t => {
  const { app } = fixture(t);
  app.auth.createAccount('barista', 'password123', 'staff');
  const { token } = app.auth.login({ username: 'barista', password: 'password123' });
  app.auth.logout(token);
  assert.equal(app.auth.user(token), null);
});
