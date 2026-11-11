import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../support/fixture.js';

test('a pending order starts with an empty notification inbox', t => {
  const { app, place } = fixture(t);
  assert.deepEqual(app.notifications.list(place().id), []);
});

test('the payment message identifies the reference and exact receipt amount', t => {
  const { app, place } = fixture(t);
  const order = place();
  app.notifications.record(order, 'Paid', 'DEMO-123');
  assert.match(app.notifications.list(order.id)[0].message, /DEMO-123 for ₹299\.00/);
});

test('ready messages include pickup instructions and retain chronological insertion order', t => {
  const { app, place } = fixture(t);
  const order = place();
  app.notifications.record(order, 'Preparing');
  app.notifications.record(order, 'Ready');
  const records = app.notifications.list(order.id);
  assert.deepEqual(records.map(row => row.status), ['Preparing', 'Ready']);
  assert.match(records[1].message, /Pick it up at Sketch Café/);
  assert.equal(records[1].created_at, '2026-11-10T18:45:00.000Z');
});

test('the inbox isolates orders and prevents duplicate status notifications', t => {
  const { app, place } = fixture(t);
  const first = place();
  const second = place();
  app.notifications.record(first, 'Ready');
  assert.throws(() => app.notifications.record(first, 'Ready'), /UNIQUE constraint/);
  assert.equal(app.notifications.list(first.id).length, 1);
  assert.deepEqual(app.notifications.list(second.id), []);
});
