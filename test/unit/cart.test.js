import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus } from '../support/fixture.js';

// Item is added with quantity 2 and total INR 299.
test("Add an available item", t => {
  const { app, itemId } = fixture(t);
  const { cart } = app.cart.change(null, itemId, 2, true);
  assert.equal(cart.lines[0].quantity, 2);
  assert.equal(cart.total, 29900);
});

// An error is shown and no item is added.
test("Add an unavailable item", t => {
  const { app, itemId } = fixture(t);
  app.catalog.setAvailability(itemId, false);
  assert.throws(() => app.cart.change(null, itemId, 1, true), hasStatus(409));
  assert.equal(app.cart.view(null).lines.length, 0);
});

// The cart total becomes INR 448.50.
test("Update an item quantity", t => {
  const { app, itemId } = fixture(t);
  const { id } = app.cart.change(null, itemId, 1, true);
  assert.equal(app.cart.change(id, itemId, 3).cart.total, 44850);
});

// The item is removed and the total becomes zero.
test("Remove an item", t => {
  const { app, itemId } = fixture(t);
  const { id } = app.cart.change(null, itemId, 1, true);
  const cart = app.cart.change(id, itemId, 0).cart;
  assert.equal(cart.lines.length, 0);
  assert.equal(cart.total, 0);
});

// A quantity validation error is returned.
test("Add an invalid quantity", t => {
  const { app, itemId } = fixture(t);
  assert.throws(() => app.cart.change(null, itemId, -1, true), hasStatus(400));
});

// The cart total is zero.
test("View an empty cart", t => {
  const { app } = fixture(t);
  assert.equal(app.cart.view(null).total, 0);
});
