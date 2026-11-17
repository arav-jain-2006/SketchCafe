import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../support/fixture.js';

// The current cafe menu includes Latte at INR 70.
test("View the menu", t => {
  const { app } = fixture(t);
  const items = app.catalog.list().items;
  assert.equal(items.length, 52);
  assert.ok(items.some(item => item.name === 'Latte' && item.price === 7000));
});

// The matching item is returned.
test("Search for an item", t => {
  const { app, itemId } = fixture(t);
  assert.equal(app.catalog.list('Latte').items[0].id, itemId);
});

// No matching items are returned.
test("Search for an item that does not exist", t => {
  const { app } = fixture(t);
  assert.equal(app.catalog.list('Pizza').items.length, 0);
});

// Latte is marked unavailable in this test database only.
test("Mark an item sold out", t => {
  const { app, itemId } = fixture(t);
  app.catalog.setAvailability(itemId, false);
  assert.equal(app.catalog.item(itemId).available, 0);
});

// The administrator's price change shows INR 80.
test("Change an item price", t => {
  const { app, itemId, itemData } = fixture(t);
  app.catalog.saveItem(itemId, { ...itemData, price: 8000 });
  assert.equal(app.catalog.item(itemId).price, 8000);
});
