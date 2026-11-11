import test from 'node:test';
import assert from 'node:assert/strict';
import { field, integer, inr, phone } from '../../src/rules.js';
import { hasStatus, mobile } from '../support/fixture.js';

test('validation normalizes +91, preserves paise and rejects invalid fields', () => {
  assert.equal(phone(' +91 9876543210 '), mobile);
  assert.throws(() => phone('1234567890'), hasStatus(400));
  assert.throws(() => integer(1.25, 'Count', 1, 99), hasStatus(400));
  assert.throws(() => field([], 'Name', 30), hasStatus(400));
  assert.equal(inr(14950), '₹149.50');
});

test('required text is trimmed and blank optional text is accepted', () => {
  assert.equal(field('  Latte  ', 'Name', 10), 'Latte');
  assert.equal(field(undefined, 'Comment', 500, 0), '');
});

test('text boundaries reject missing, oversized and non-string values', () => {
  for (const value of [undefined, '   ', 'too long', 2]) {
    assert.throws(() => field(value, 'Name', 5), hasStatus(400));
  }
});

test('whole numbers accept both boundaries and reject strings or unsafe integers', () => {
  assert.equal(integer(1, 'Quantity', 1, 99), 1);
  assert.equal(integer(99, 'Quantity', 1, 99), 99);
  for (const value of ['2', 0, 100, Infinity]) {
    assert.throws(() => integer(value, 'Quantity', 1, 99), hasStatus(400));
  }
});

test('mobile validation rejects foreign prefixes and extra digits', () => {
  for (const value of ['+1 9876543210', '98765432100', '5876543210']) {
    assert.throws(() => phone(value), hasStatus(400));
  }
});
