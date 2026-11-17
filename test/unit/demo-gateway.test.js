import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../support/fixture.js';
import { createDemoGateway } from '../../src/demo-gateway.js';

// A payment reference is generated.
test("Create a demo payment request", t => {
  const { db } = fixture(t);
  assert.match(createDemoGateway(db).start('A', 1200), /^DEMO-/);
});

// The result is Pending.
test("Read a new demo request", t => {
  const { db } = fixture(t);
  const gateway = createDemoGateway(db);
  const ref = gateway.start('A', 1200);
  assert.equal(gateway.verify(ref).status, 'Pending');
});

// The result is Succeeded.
test("Simulate payment success", t => {
  const { db } = fixture(t);
  const gateway = createDemoGateway(db);
  const ref = gateway.start('A', 1200);
  gateway.simulate(ref, 'Succeeded');
  assert.equal(gateway.verify(ref).status, 'Succeeded');
});

// The result is Failed.
test("Simulate payment failure", t => {
  const { db } = fixture(t);
  const gateway = createDemoGateway(db);
  const ref = gateway.start('A', 1200);
  gateway.simulate(ref, 'Failed');
  assert.equal(gateway.verify(ref).status, 'Failed');
});
