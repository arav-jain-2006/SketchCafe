import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus, customer } from '../support/fixture.js';

test('cart accumulates, sets and removes quantities using integer prices', t => {
  const { app, itemId } = fixture(t);
  const { id } = app.cart.change(null, itemId, 2, true);
  assert.equal(app.cart.change(id, itemId, 1, true).cart.total, 44850);
  assert.equal(app.cart.change(id, itemId, 4).cart.lines[0].subtotal, 59800);
  assert.throws(() => app.cart.change(id, itemId, 100), hasStatus(400));
  assert.deepEqual(app.cart.change(id, itemId, 0).cart, { lines: [], total: 0 });
});

test('cart refuses a newly unavailable item but allows removing it', t => {
  const { app, itemId } = fixture(t);
  const { id } = app.cart.change(null, itemId, 2);
  app.catalog.setAvailability(itemId, false);
  assert.throws(() => app.cart.change(id, itemId, 3), hasStatus(409));
  assert.throws(() => app.orders.place(id, customer), hasStatus(409));
  assert.equal(app.cart.change(id, itemId, 0).cart.total, 0);
});

test('different cart IDs cannot see each other’s items', t => {
  const { app, itemId } = fixture(t);
  const first = app.cart.change(null, itemId, 1).id;
  const second = app.cart.change(null, itemId, 3).id;
  assert.notEqual(first, second);
  assert.equal(app.cart.view(first).lines[0].quantity, 1);
  assert.equal(app.cart.view(second).lines[0].quantity, 3);
  assert.deepEqual(app.cart.view('unknown'), { lines: [], total: 0 });
});

test('exceeding the per-item limit leaves the existing quantity intact', t => {
  const { app, itemId } = fixture(t);
  const { id } = app.cart.change(null, itemId, 99);
  assert.throws(() => app.cart.change(id, itemId, 1, true), hasStatus(400));
  assert.equal(app.cart.view(id).lines[0].quantity, 99);
});

test('cart prices follow the current menu before checkout', t => {
  const { app, itemId, itemData } = fixture(t);
  const { id } = app.cart.change(null, itemId, 2);
  app.catalog.saveItem(itemId, { ...itemData, price: 20000 });
  assert.equal(app.cart.view(id).total, 40000);
});
