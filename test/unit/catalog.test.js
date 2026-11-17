import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../support/fixture.js';

// Mocha is listed.
test("View the menu", t => {
  const { app } = fixture(t);
  assert.equal(app.catalog.list().items[0].name, 'Mocha');
});

// The matching item is returned.
test("Search for an item", t => {
  const { app, itemId } = fixture(t);
  assert.equal(app.catalog.list('Mocha').items[0].id, itemId);
});

// No matching items are returned.
test("Search for an item that does not exist", t => {
  const { app } = fixture(t);
  assert.equal(app.catalog.list('Pizza').items.length, 0);
});

// Mocha is marked unavailable.
test("Mark an item sold out", t => {
  const { app, itemId } = fixture(t);
  app.catalog.setAvailability(itemId, false);
  assert.equal(app.catalog.item(itemId).available, 0);
});

// The menu shows INR 200.
test("Change an item price", t => {
  const { app, itemId, itemData } = fixture(t);
  app.catalog.saveItem(itemId, { ...itemData, price: 20000 });
  assert.equal(app.catalog.item(itemId).price, 20000);
});
