import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus, time } from '../support/fixture.js';

test('authentication uses salted hashes, role isolation and idle expiration', t => {
  let clock = time;
  const { app, db } = fixture(t, { time: () => clock });
  const employee = app.auth.createAccount('barista', 'password123', 'staff');
  assert.equal(employee.password_hash, undefined);
  assert.notEqual(db.get('SELECT password_hash FROM employees').password_hash, 'password123');
  assert.throws(() => app.auth.login({ username: 'barista', password: 'wrong' }), hasStatus(401));
  const { token } = app.auth.login({ username: 'barista', password: 'password123' });
  assert.notEqual(db.get('SELECT token_hash FROM sessions').token_hash, token);
  assert.equal(app.auth.requireRole(token, 'staff').username, 'barista');
  assert.throws(() => app.auth.requireRole(token, 'admin'), hasStatus(403));
  clock += 30 * 60000;
  assert.equal(app.auth.user(token), null);
});

test('account deactivation, reactivation, reset, change and logout invalidate sessions', t => {
  const { app } = fixture(t);
  const employee = app.auth.saveStaff(null, { username: 'barista', password: 'initial-pass' });
  const login = password => app.auth.login({ username: 'barista', password }).token;
  const first = login('initial-pass');
  app.auth.saveStaff(employee.id, { username: 'barista', active: false });
  assert.equal(app.auth.user(first), null);
  assert.throws(() => login('initial-pass'), hasStatus(401));
  app.auth.saveStaff(employee.id, { username: 'barista', active: true, password: 'reset-password' });
  assert.throws(() => login('initial-pass'), hasStatus(401));
  const second = login('reset-password');
  assert.throws(() => app.auth.changePassword(employee.id, 'wrong', 'changed-password'), hasStatus(403));
  app.auth.changePassword(employee.id, 'reset-password', 'changed-password');
  assert.equal(app.auth.user(second), null);
  const third = login('changed-password');
  app.auth.logout(third);
  assert.equal(app.auth.user(third), null);
});

test('username uniqueness ignores case and accounts have independent password salts', t => {
  const { app, db } = fixture(t);
  app.auth.createAccount('server-one', 'shared-pass', 'staff');
  app.auth.createAccount('server-two', 'shared-pass', 'staff');
  assert.throws(() => app.auth.createAccount('SERVER-ONE', 'shared-pass', 'staff'), hasStatus(409));
  const hashes = db.all('SELECT password_hash FROM employees').map(row => row.password_hash);
  assert.equal(new Set(hashes).size, 2);
});

test('an active session refreshes the idle deadline', t => {
  let clock = time;
  const { app } = fixture(t, { time: () => clock });
  app.auth.createAccount('barista', 'password123', 'staff');
  const { token } = app.auth.login({ username: 'barista', password: 'password123' });
  clock += 29 * 60000;
  assert.equal(app.auth.user(token).role, 'staff');
  clock += 29 * 60000;
  assert.equal(app.auth.user(token).role, 'staff');
});

test('staff administration cannot modify the administrator account', t => {
  const { app } = fixture(t);
  const admin = app.auth.createAccount('manager', 'password123', 'admin');
  assert.deepEqual(app.auth.staff(), []);
  assert.throws(() => app.auth.saveStaff(admin.id, { username: 'manager', active: false }), hasStatus(404));
});
