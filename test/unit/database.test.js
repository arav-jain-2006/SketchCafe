import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../support/fixture.js';

// The stored name is Drinks.
test("Read a stored category", t => {
  const { db, categoryId } = fixture(t);
  assert.equal(db.get('SELECT name FROM categories WHERE id=?', categoryId).name, 'Drinks');
});

// One seeded item is returned.
test("List menu items", t => {
  const { db } = fixture(t);
  assert.equal(db.all('SELECT * FROM items').length, 1);
});

// The stored name becomes Coffee.
test("Update a category", t => {
  const { db, categoryId } = fixture(t);
  db.run('UPDATE categories SET name=? WHERE id=?', 'Coffee', categoryId);
  assert.equal(db.get('SELECT name FROM categories WHERE id=?', categoryId).name, 'Coffee');
});

// The new category is stored.
test("Save a transaction", t => {
  const { db } = fixture(t);
  db.transaction(() => db.run('INSERT INTO categories(name) VALUES (?)', 'Snacks'));
  assert.equal(db.get('SELECT name FROM categories WHERE name=?', 'Snacks').name, 'Snacks');
});
