import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus, mobile, customer } from '../support/fixture.js';

// Two current-menu Lattes create an INR 140 Pending Payment order.
test("Place a valid order", t => {
  const { place } = fixture(t);
  const order = place();
  assert.equal(order.total, 14000);
  assert.equal(order.status, 'Pending Payment');
});

// An empty-cart error is returned.
test("Place an order with an empty cart", t => {
  const { app, place } = fixture(t);
  assert.throws(() => app.orders.place(null, customer), hasStatus(409));
});

// A phone validation error is returned.
test("Place an order with an invalid phone", t => {
  const { app, itemId, place } = fixture(t);
  const { id } = app.cart.change(null, itemId, 1, true);
  assert.throws(() => app.orders.place(id, { name: 'Asha', phone: '123' }), hasStatus(400));
});

// The current order status is returned.
test("Track an order", t => {
  const { app, place } = fixture(t);
  const order = place();
  assert.equal(app.orders.track(order.id, mobile).status, 'Pending Payment');
});

// The order status becomes Preparing.
test("Mark a paid order Preparing", t => {
  const { app, place, settle } = fixture(t);
  const order = place();
  settle(order);
  assert.equal(app.orders.advance(order.id, 'Preparing').status, 'Preparing');
});
