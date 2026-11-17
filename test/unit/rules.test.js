import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus, mobile } from '../support/fixture.js';
import { phone, field, integer } from '../../src/rules.js';

// The valid mobile number is accepted.
test("Validate a mobile number", t => {
  const {  } = fixture(t);
  assert.equal(phone(mobile), mobile);
});

// A validation error is returned.
test("Reject a short mobile number", t => {
  const {  } = fixture(t);
  assert.throws(() => phone('123'), hasStatus(400));
});

// The result is Asha.
test("Trim a text field", t => {
  const {  } = fixture(t);
  assert.equal(field('  Asha  ', 'Name', 70), 'Asha');
});

// A whole-number error is returned.
test("Reject a fractional quantity", t => {
  const {  } = fixture(t);
  assert.throws(() => integer(1.5, 'Quantity', 1, 99), hasStatus(400));
});
