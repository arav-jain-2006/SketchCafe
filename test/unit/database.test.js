import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, seedDemo } from '../../src/app.js';
import { openDatabase } from '../../src/database.js';
import { fixture, customer, mobile } from '../support/fixture.js';

test('database rolls back a failed transaction and enforces foreign keys', t => {
  const { db } = fixture(t);
  assert.throws(() => db.transaction(() => {
    db.run('INSERT INTO categories(name) VALUES (?)', 'Temporary');
    db.run("INSERT INTO items(category_id,name,description,price) VALUES (999,'Tea','',100)");
  }));
  assert.equal(db.get("SELECT name FROM categories WHERE name='Temporary'"), undefined);
});

test('database persists an order and receipt across a restart', t => {
  const directory = mkdtempSync(join(tmpdir(), 'sketch-test-'));
  const path = join(directory, 'sketch.sqlite');
  t.after(() => {
    for (const suffix of ['', '-shm', '-wal']) rmSync(path + suffix, { force: true });
    rmdirSync(directory);
  });
  let db = openDatabase(path);
  let id;
  try {
    const app = createApp(db);
    seedDemo(db, app);
    const itemId = app.catalog.list().items.find(item => item.available).id;
    const cartId = app.cart.change(null, itemId, 1).id;
    id = app.orders.place(cartId, customer).id;
    const attempt = app.payments.start(id, mobile);
    app.payments.demoOutcome(id, mobile, attempt.id, 'Succeeded');
    app.payments.verify(id, mobile, attempt.id);
  } finally {
    db.close();
  }
  db = openDatabase(path);
  try {
    const tracked = createApp(db).orders.track(id, mobile);
    assert.equal(tracked.status, 'Paid');
    assert.match(tracked.receipt.reference, /^DEMO-/);
  } finally {
    db.close();
  }
});

test('database commits transaction results and supports bound parameters', t => {
  const db = openDatabase();
  t.after(() => db.close());
  const name = "Chef's specials";
  const id = db.transaction(() => db.run('INSERT INTO categories(name) VALUES (?)', name).lastInsertRowid);
  assert.equal(db.get('SELECT name FROM categories WHERE id=?', id).name, name);
});

test('each in-memory database has isolated data', t => {
  const first = openDatabase();
  const second = openDatabase();
  t.after(() => { first.close(); second.close(); });
  first.run('INSERT INTO categories(name) VALUES (?)', 'Only here');
  assert.equal(first.all('SELECT * FROM categories').length, 1);
  assert.deepEqual(second.all('SELECT * FROM categories'), []);
});
