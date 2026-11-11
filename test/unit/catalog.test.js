import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus, mobile } from '../support/fixture.js';

test('catalog supports keyword/category filters and sold-out listings', t => {
  const { app, itemId, categoryId } = fixture(t);
  assert.equal(app.catalog.list('COCOA', String(categoryId)).items[0].id, itemId);
  assert.equal(app.catalog.list('missing').items.length, 0);
  assert.equal(app.catalog.list('', '999').items.length, 0);
  app.catalog.setAvailability(itemId, false);
  assert.equal(app.catalog.item(itemId).available, 0);
});

test('catalog validates price, category, image and safely archives records', t => {
  const { app, itemId, itemData, categoryId, place } = fixture(t);
  const order = place();
  for (const values of [{ price: -3 }, { categoryId: 999 }, { image: 'javascript:alert(1)' }]) {
    assert.throws(() => app.catalog.saveItem(null, { ...itemData, ...values }), hasStatus(400));
  }
  assert.throws(() => app.catalog.removeCategory(categoryId), hasStatus(409));
  app.catalog.archiveItem(itemId);
  app.catalog.removeCategory(categoryId);
  assert.deepEqual(app.catalog.list(), { categories: [], items: [] });
  assert.equal(app.orders.track(order.id, mobile).lines[0].name, itemData.name);
  assert.ok(app.catalog.saveCategory(null, { name: 'Drinks' }) > 0);
});

test('category renaming updates the public item listing and rejects duplicate names', t => {
  const { app, categoryId, itemId } = fixture(t);
  app.catalog.saveCategory(categoryId, { name: 'Espresso bar' });
  assert.equal(app.catalog.item(itemId).category, 'Espresso bar');
  assert.throws(() => app.catalog.saveCategory(null, { name: 'ESPRESSO BAR' }), hasStatus(409));
});

test('changing availability does not change name or price', t => {
  const { app, itemId, itemData } = fixture(t);
  app.catalog.setAvailability(itemId, false);
  assert.throws(() => app.catalog.setAvailability(itemId, 'true'), hasStatus(400));
  app.catalog.setAvailability(itemId, true);
  assert.equal(app.catalog.item(itemId).price, itemData.price);
  assert.equal(app.catalog.item(itemId).available, 1);
});

test('archived items disappear from details and search', t => {
  const { app, itemId } = fixture(t);
  app.catalog.archiveItem(itemId);
  assert.equal(app.catalog.list('mocha').items.length, 0);
  assert.throws(() => app.catalog.item(itemId), hasStatus(404));
});
