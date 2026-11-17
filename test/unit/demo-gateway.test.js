import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../support/fixture.js';
import { createDemoGateway } from '../../src/demo-gateway.js';

// A payment reference is generated.
test("Create a demo payment request", t => {
  const { db, place } = fixture(t);
  const order = place();
  assert.match(createDemoGateway(db).start(order.id, order.total), /^DEMO-/);
});

// The result is Pending.
test("Read a new demo request", t => {
  const { db, place } = fixture(t);
  const order = place();
  const gateway = createDemoGateway(db);
  const ref = gateway.start(order.id, order.total);
  assert.equal(gateway.verify(ref).status, 'Pending');
});

// The result is Succeeded.
test("Simulate payment success", t => {
  const { db, place } = fixture(t);
  const order = place();
  const gateway = createDemoGateway(db);
  const ref = gateway.start(order.id, order.total);
  gateway.simulate(ref, 'Succeeded');
  assert.equal(gateway.verify(ref).status, 'Succeeded');
});

// The result is Failed.
test("Simulate payment failure", t => {
  const { db, place } = fixture(t);
  const order = place();
  const gateway = createDemoGateway(db);
  const ref = gateway.start(order.id, order.total);
  gateway.simulate(ref, 'Failed');
  assert.equal(gateway.verify(ref).status, 'Failed');
});
