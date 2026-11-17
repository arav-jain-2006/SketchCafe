import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../support/fixture.js';

// Exercise payment and order services together using the real test database.
// An unpaid order must be hidden; verification makes the same order visible.
test('Successful payment puts the order in the staff queue', t => {
  const { app, place, settle } = fixture(t);
  const order = place();
  assert.equal(app.orders.staffList().length, 0);
  settle(order);
  const queue = app.orders.staffList();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, order.id);
  assert.equal(queue[0].status, 'Paid');
});

// The order service and inbox must agree after staff mark a paid order Ready.
test('A Ready status creates a pickup notification', t => {
  const { app, place, settle } = fixture(t);
  const order = place();
  settle(order);
  app.orders.advance(order.id, 'Preparing');
  app.orders.advance(order.id, 'Ready');
  const messages = app.notifications.list(order.id);
  assert.equal(app.orders.staffList()[0].status, 'Ready');
  assert.ok(messages.some(message => message.status === 'Ready' && /pick it up/i.test(message.message)));
});
