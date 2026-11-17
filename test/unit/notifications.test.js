import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, customer } from '../support/fixture.js';

// No notifications are returned.
test("View an empty inbox", t => {
  const { app, place } = fixture(t);
  assert.deepEqual(app.notifications.list(place().id), []);
});

// The message contains DEMO-123.
test("Create a payment message", t => {
  const { app, place } = fixture(t);
  const order = place();
  app.notifications.record(order, 'Paid', 'DEMO-123');
  assert.match(app.notifications.list(order.id)[0].message, /DEMO-123/);
});

// A Preparing notification is recorded.
test("Create a Preparing message", t => {
  const { app, place } = fixture(t);
  const order = place();
  app.notifications.record(order, 'Preparing');
  assert.equal(app.notifications.list(order.id)[0].status, 'Preparing');
});

// The message tells the customer to collect the order.
test("Create a Ready message", t => {
  const { app, place } = fixture(t);
  const order = place();
  app.notifications.record(order, 'Ready');
  assert.match(app.notifications.list(order.id)[0].message, /Pick it up/);
});
