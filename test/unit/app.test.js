import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, seedDemo, demoCredentials } from '../../src/app.js';
import { openDatabase } from '../../src/database.js';

test('composition seeds repeatably without replacing the demo accounts or menu', t => {
  const db = openDatabase();
  t.after(() => db.close());
  const app = createApp(db);
  seedDemo(db, app);
  seedDemo(db, app);
  assert.equal(app.catalog.list().items.length, 7);
  assert.equal(app.auth.staff().length, 1);
  assert.equal(app.auth.login({ username: 'admin', password: demoCredentials.admin }).user.role, 'admin');
});

test('composition shares the catalog across cart and checkout', t => {
  const db = openDatabase();
  t.after(() => db.close());
  const app = createApp(db);
  seedDemo(db, app);
  const item = app.catalog.list().items.find(entry => entry.available);
  const { id } = app.cart.change(null, item.id, 2);
  assert.equal(app.orders.place(id, { name: 'Test', phone: '9876543210' }).total, item.price * 2);
});

test('the supplied clock determines persisted order and history timestamps', t => {
  const db = openDatabase();
  t.after(() => db.close());
  const instant = '2026-11-11T12:34:56.000Z';
  const app = createApp(db, { time: () => Date.parse(instant) });
  seedDemo(db, app);
  const item = app.catalog.list().items.find(entry => entry.available);
  const { id } = app.cart.change(null, item.id, 1);
  const order = app.orders.place(id, { name: 'Test', phone: '9876543210' });
  assert.equal(order.created_at, instant);
  assert.equal(order.history[0].created_at, instant);
});

test('re-seeding preserves menu changes and does not revive an archived item', t => {
  const db = openDatabase();
  t.after(() => db.close());
  const app = createApp(db);
  seedDemo(db, app);
  app.catalog.archiveItem(app.catalog.list().items[0].id);
  seedDemo(db, app);
  assert.equal(app.catalog.list().items.length, 6);
});
