import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus, mobile } from '../support/fixture.js';

test('payments cover pending, failure, retry, verified success and replay', t => {
  const { app, db, place, settle } = fixture(t);
  const order = place();
  const { id } = app.payments.start(order.id, mobile);
  assert.equal(app.payments.start(order.id, mobile).id, id);
  assert.equal(app.payments.verify(order.id, mobile, id).status, 'Pending');
  assert.equal(settle(order, 'Failed').status, 'Failed');
  assert.deepEqual(app.orders.staffList(), []);
  assert.equal(app.orders.track(order.id, mobile).status, 'Pending Payment');
  const retry = app.payments.start(order.id, mobile);
  assert.notEqual(retry.id, id);
  app.payments.demoOutcome(order.id, mobile, retry.id, 'Succeeded');
  assert.equal(app.orders.staffList().length, 0);
  assert.equal(app.payments.verify(order.id, mobile, retry.id).status, 'Succeeded');
  assert.equal(app.payments.verify(order.id, mobile, retry.id).status, 'Succeeded');
  assert.equal(app.orders.staffList().length, 1);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM payments').n, 2);
  assert.equal(app.orders.track(order.id, mobile).receipt.amount, 29900);
});

test('payments reject mismatched provider data and preserve state on provider errors', t => {
  const gateway = {
    start: () => 'fake-provider-ref',
    verify: () => ({ order_id: 'other', amount: 29900, status: 'Succeeded' })
  };
  const { app, place } = fixture(t, { gateway });
  const order = place();
  const { id } = app.payments.start(order.id, mobile);
  assert.throws(() => app.payments.verify(order.id, mobile, id), hasStatus(502));
  gateway.verify = () => { throw new Error('provider unavailable'); };
  assert.throws(() => app.payments.verify(order.id, mobile, id), /unavailable/);
  assert.equal(app.orders.track(order.id, mobile).attempt, 'Pending');
  assert.equal(app.orders.track(order.id, mobile).status, 'Pending Payment');
});

test('payment verification rolls back when the notification write fails', t => {
  const { app, place } = fixture(t);
  const order = place();
  const attempt = app.payments.start(order.id, mobile);
  app.payments.demoOutcome(order.id, mobile, attempt.id, 'Succeeded');
  const record = app.notifications.record;
  app.notifications.record = () => { throw new Error('Write failed'); };
  assert.throws(() => app.payments.verify(order.id, mobile, attempt.id), /Write failed/);
  const tracked = app.orders.track(order.id, mobile);
  assert.equal(tracked.status, 'Pending Payment');
  assert.equal(tracked.attempt, 'Pending');
  assert.equal(tracked.receipt, null);
  assert.deepEqual(tracked.history.map(event => event.status), ['Pending Payment']);
  app.notifications.record = record;
  assert.equal(app.payments.verify(order.id, mobile, attempt.id).status, 'Succeeded');
});

test('attempt IDs are scoped to the original order and phone', t => {
  const { app, place } = fixture(t);
  const first = place();
  const other = place();
  const attempt = app.payments.start(first.id, mobile);
  assert.throws(() => app.payments.verify(other.id, mobile, attempt.id), hasStatus(404));
  assert.throws(() => app.payments.demoOutcome(first.id, '9876543211', attempt.id, 'Succeeded'), hasStatus(404));
});

test('verification rejects a successful result with the wrong amount', t => {
  const gateway = {
    start: () => 'wrong-amount',
    verify: () => ({ order_id: id, amount: 1, status: 'Succeeded' })
  };
  const { app, place } = fixture(t, { gateway });
  const { id } = place();
  const attempt = app.payments.start(id, mobile);
  assert.throws(() => app.payments.verify(id, mobile, attempt.id), hasStatus(502));
  assert.equal(app.orders.track(id, mobile).receipt, null);
});

test('paid orders cannot start another charge', t => {
  const { app, place, settle } = fixture(t);
  const order = place();
  settle(order);
  assert.throws(() => app.payments.start(order.id, mobile), hasStatus(409));
});
