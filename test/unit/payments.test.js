import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, mobile } from '../support/fixture.js';

// A pending payment attempt is created.
test("Start a payment", t => {
  const { app, place } = fixture(t);
  const order = place();
  assert.equal(app.payments.start(order.id, mobile).status, 'Pending');
});

// Payment is verified successfully.
test("Verify a successful demo payment", t => {
  const { app, place } = fixture(t);
  const order = place();
  const attempt = app.payments.start(order.id, mobile);
  app.payments.demoOutcome(order.id, mobile, attempt.id, 'Succeeded');
  assert.equal(app.payments.verify(order.id, mobile, attempt.id).status, 'Succeeded');
});

// The payment result is Failed.
test("Verify a failed demo payment", t => {
  const { app, place } = fixture(t);
  const order = place();
  const attempt = app.payments.start(order.id, mobile);
  app.payments.demoOutcome(order.id, mobile, attempt.id, 'Failed');
  assert.equal(app.payments.verify(order.id, mobile, attempt.id).status, 'Failed');
});

// The payment result remains Pending.
test("Verify a pending payment", t => {
  const { app, place } = fixture(t);
  const order = place();
  const attempt = app.payments.start(order.id, mobile);
  assert.equal(app.payments.verify(order.id, mobile, attempt.id).status, 'Pending');
});
