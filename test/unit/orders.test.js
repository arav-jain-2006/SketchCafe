import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus, customer, mobile } from '../support/fixture.js';

test('orders reject invalid checkout, snapshot prices and replay the same cart safely', t => {
  const { app, itemId, itemData } = fixture(t);
  assert.throws(() => app.orders.place(null, customer), hasStatus(409));
  const { id } = app.cart.change(null, itemId, 2);
  assert.throws(() => app.orders.place(id, { ...customer, phone: 'bad' }), hasStatus(400));
  const order = app.orders.place(id, customer);
  app.catalog.saveItem(itemId, { ...itemData, price: 100 });
  assert.equal(app.orders.place(id, customer).id, order.id);
  assert.equal(app.orders.track(order.id, mobile).total, 29900);
  assert.equal(app.orders.track(order.id, mobile).lines[0].unit_price, 14950);
  assert.throws(() => app.orders.track(order.id, '9876543211'), hasStatus(404));
  assert.equal(app.cart.view(id).lines.length, 0);
  assert.notEqual(app.cart.change(id, itemId, 1, true).id, id);
});

test('orders and notifications enforce ordered stages and a single message per transition', t => {
  const { app, place, settle } = fixture(t);
  const order = place();
  assert.throws(() => app.orders.advance(order.id, 'Preparing'), hasStatus(404));
  settle(order);
  assert.throws(() => app.orders.advance(order.id, 'Ready'), hasStatus(409));
  for (const status of ['Preparing', 'Ready', 'Ready', 'Completed']) app.orders.advance(order.id, status);
  assert.throws(() => app.orders.advance(order.id, 'Preparing'), hasStatus(409));
  const tracked = app.orders.track(order.id, mobile);
  assert.deepEqual(tracked.history.map(event => event.status), ['Pending Payment', 'Paid', 'Preparing', 'Ready', 'Completed']);
  assert.deepEqual(app.notifications.list(order.id).map(event => event.status), ['Paid', 'Preparing', 'Ready', 'Completed']);
  assert.match(tracked.notifications[0].message, /Receipt DEMO/);
  assert.match(tracked.notifications[2].message, /Pick it up/);
});

test('checkout cannot replay someone else’s phone against a consumed cart', t => {
  const { app, itemId } = fixture(t);
  const { id } = app.cart.change(null, itemId, 1);
  app.orders.place(id, customer);
  assert.throws(() => app.orders.place(id, { ...customer, phone: '9876543211' }), hasStatus(409));
});

test('tracking normalizes the code and phone and omits the private cart token', t => {
  const { app, place } = fixture(t);
  const order = place();
  const result = app.orders.track(order.id.toLowerCase(), '+91 ' + mobile);
  assert.equal(result.status, 'Pending Payment');
  assert.equal(result.cart_id, undefined);
  assert.equal(result.receipt, null);
});

test('staff history filters completed paid orders by status and IST date', t => {
  const { app, place, settle } = fixture(t);
  const order = place();
  settle(order);
  for (const stage of ['Preparing', 'Ready', 'Completed']) app.orders.advance(order.id, stage);
  assert.equal(app.orders.staffList({ status: 'Completed', date: '2026-11-11' })[0].id, order.id);
  assert.deepEqual(app.orders.staffList({ date: '2026-11-10' }), []);
  assert.deepEqual(app.orders.staffList({ active: true }), []);
});
