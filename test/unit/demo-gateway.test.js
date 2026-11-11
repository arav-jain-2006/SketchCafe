import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoGateway } from '../../src/demo-gateway.js';
import { fixture, hasStatus, mobile } from '../support/fixture.js';

test('demo gateway keeps terminal outcomes immutable', t => {
  const { app, db, place } = fixture(t);
  const order = place();
  const { id } = app.payments.start(order.id, mobile);
  app.payments.demoOutcome(order.id, mobile, id, 'Failed');
  app.payments.demoOutcome(order.id, mobile, id, 'Succeeded');
  assert.equal(db.get('SELECT status FROM demo_gateway').status, 'Failed');
  assert.throws(() => app.payments.demoOutcome(order.id, mobile, id, 'Forged'), hasStatus(400));
});

test('starting a gateway attempt creates a distinct pending reference', t => {
  const { db } = fixture(t);
  const gateway = createDemoGateway(db);
  const first = gateway.start('order-one', 1200);
  assert.notEqual(first, gateway.start('order-one', 1200));
  assert.deepEqual({ ...gateway.verify(first) }, { order_id: 'order-one', amount: 1200, status: 'Pending' });
});

test('a successful outcome keeps the original reference amount and order', t => {
  const { db } = fixture(t);
  const gateway = createDemoGateway(db);
  const reference = gateway.start('order-two', 2400);
  gateway.simulate(reference, 'Succeeded');
  gateway.simulate(reference, 'Failed');
  assert.deepEqual({ ...gateway.verify(reference) }, { order_id: 'order-two', amount: 2400, status: 'Succeeded' });
});

test('verifying an unknown provider reference reports an upstream error', t => {
  const { db } = fixture(t);
  assert.throws(() => createDemoGateway(db).verify('unknown'), hasStatus(502));
});
