import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../support/fixture.js';
import { createApp, seedDemo } from '../../src/app.js';
import { openDatabase } from '../../src/database.js';

// Catalog and cart services are available.
test("Create the application services", t => {
  const { app } = fixture(t);
  assert.equal(typeof app.catalog.list, 'function');
  assert.equal(typeof app.cart.view, 'function');
});

// Seven menu items are created.
test("Load the demo menu", t => {
  const {  } = fixture(t);
  const demoDb = openDatabase();
  t.after(() => demoDb.close());
  const demoApp = createApp(demoDb);
  seedDemo(demoDb, demoApp);
  assert.equal(demoApp.catalog.list().items.length, 7);
});

// The staff account is created.
test("Load the demo staff account", t => {
  const {  } = fixture(t);
  const demoDb = openDatabase();
  t.after(() => demoDb.close());
  const demoApp = createApp(demoDb);
  seedDemo(demoDb, demoApp);
  assert.equal(demoApp.auth.staff()[0].username, 'staff');
});

// An order has the configured creation time.
test("Use the configured application clock", t => {
  const { place } = fixture(t);
  assert.equal(place().created_at, '2026-11-10T18:45:00.000Z');
});
