import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus, mobile } from '../support/fixture.js';

// The review is saved.
test("Review a completed order", t => {
  const { app, place, settle } = fixture(t);
  const order = place();
  settle(order);
  for (const status of ['Preparing', 'Ready', 'Completed']) app.orders.advance(order.id, status);
  app.feedback.review({ orderId: order.id, phone: mobile, rating: 5, comment: 'Great' });
  assert.equal(app.feedback.list().reviews[0].rating, 5);
});

// An order-completion error is returned.
test("Review an incomplete order", t => {
  const { app, place } = fixture(t);
  const order = place();
  assert.throws(() => app.feedback.review({ orderId: order.id, phone: mobile, rating: 5, comment: '' }), hasStatus(409));
});

// A rating validation error is returned.
test("Submit an invalid rating", t => {
  const { app, place, settle } = fixture(t);
  const order = place();
  settle(order);
  for (const status of ['Preparing', 'Ready', 'Completed']) app.orders.advance(order.id, status);
  assert.throws(() => app.feedback.review({ orderId: order.id, phone: mobile, rating: 6, comment: '' }), hasStatus(400));
});

// An Open support request is saved.
test("Send a support request", t => {
  const { app } = fixture(t);
  const id = app.feedback.request({ phone: mobile, message: 'Opening hours?' });
  assert.equal(app.feedback.lookup(id, mobile).status, 'Open');
});

// A message validation error is returned.
test("Send an empty support message", t => {
  const { app } = fixture(t);
  assert.throws(() => app.feedback.request({ phone: mobile, message: '' }), hasStatus(400));
});

// The request status becomes Resolved.
test("Resolve a support request", t => {
  const { app } = fixture(t);
  const id = app.feedback.request({ phone: mobile, message: 'Opening hours?' });
  app.feedback.resolve(id, 'Open at 9');
  assert.equal(app.feedback.lookup(id, mobile).status, 'Resolved');
});
