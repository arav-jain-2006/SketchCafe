import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, mobile, hasStatus } from '../support/fixture.js';
import { createApp, seedDemo } from '../../src/app.js';
import { openDatabase } from '../../src/database.js';

// Catalog and cart services are available.
test("Create the application services", t => {
  const { app } = fixture(t);
  assert.equal(typeof app.catalog.list, 'function');
  assert.equal(typeof app.cart.view, 'function');
});

// The photographed food menu and approved drinks load without serving times.
test("Load the demo menu", t => {
  const demoDb = openDatabase();
  t.after(() => demoDb.close());
  const demoApp = createApp(demoDb);
  seedDemo(demoDb, demoApp);
  const menu = demoApp.catalog.list();
  assert.equal(menu.items.length, 52);
  assert.equal(menu.categories.length, 6);
  assert.equal(menu.items.find(item => item.name === 'Vada Pav Combo').price, 7000);
  assert.equal(menu.items.find(item => item.name === 'Masala Dosa').price, 6300);
  assert.equal(menu.items.find(item => item.name === 'Mutton Curry Combo').price, 19500);
  assert.equal(menu.items.find(item => item.name === 'Tea').price, 1500);
  assert.equal(menu.items.find(item => item.name === 'Latte').price, 7000);
  assert.ok(menu.items.every(item => !/\d+:\d+|\bam\b|\bpm\b/i.test(item.description)));
});

// The staff account is created.
test("Load the demo staff account", t => {
  const demoDb = openDatabase();
  t.after(() => demoDb.close());
  const demoApp = createApp(demoDb);
  seedDemo(demoDb, demoApp);
  assert.equal(demoApp.auth.staff()[0].username, 'staff');
});

// Replacing a menu must preserve prior order totals and the customer's receipt
// data. The old lines are archived rather than deleted from the database.
test('Update an existing menu without changing saved orders', t => {
  const { app, db, place, itemId } = fixture(t);
  const order = place();
  // Simulate a database that has not applied this menu revision yet.
  db.run("DELETE FROM app_settings WHERE key='menu_version'");
  seedDemo(db, app);
  assert.equal(app.catalog.list().items.length, 52);
  assert.equal(db.get('SELECT archived FROM items WHERE id=?', itemId).archived, 1);
  const saved = app.orders.track(order.id, mobile);
  assert.equal(saved.total, 14000);
  assert.equal(saved.lines[0].unit_price, 7000);
  assert.equal(saved.lines[0].name, 'Latte');
});

// Once the menu revision is applied, restarting keeps admin price/availability
// changes and does not create duplicate items. Old carts cannot buy archived food.
test('Preserve menu edits and block old cart items after a restart', t => {
  const { app, db, itemId } = fixture(t);
  const oldCart = app.cart.change(null, itemId, 1).id;
  db.run("DELETE FROM app_settings WHERE key='menu_version'");
  seedDemo(db, app);
  const tea = app.catalog.list('Tea').items.find(item => item.name === 'Tea');
  app.catalog.saveItem(tea.id, { categoryId: tea.category_id, name: tea.name,
    description: tea.description, image: '', price: 2000, available: false });
  seedDemo(db, app);
  assert.equal(app.catalog.list().items.length, 52);
  assert.equal(app.catalog.item(tea.id).price, 2000);
  assert.equal(app.catalog.item(tea.id).available, 0);
  assert.throws(() => app.orders.place(oldCart, { name: 'Asha', phone: mobile }), hasStatus(409));
});

// An order has the configured creation time.
test("Use the configured application clock", t => {
  const { place } = fixture(t);
  assert.equal(place().created_at, '2026-11-10T18:45:00.000Z');
});
