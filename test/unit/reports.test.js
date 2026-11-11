import test from 'node:test';
import assert from 'node:assert/strict';
import { localDay, validateDate } from '../../src/reports.js';
import { fixture, hasStatus, time } from '../support/fixture.js';

test('reports use verified payments, order-line quantities and IST dates', t => {
  const { app, place, settle } = fixture(t);
  settle(place(), 'Failed');
  const paid = place();
  settle(paid);
  assert.equal(localDay(time), '2026-11-11');
  assert.throws(() => validateDate('2026-02-30'), hasStatus(400));
  assert.throws(() => app.reports.sales('2026-11-11', '2026-11-10'), hasStatus(400));
  assert.equal(app.reports.sales('2026-11-10', '2026-11-10').orders, 0);
  const report = app.reports.sales('2026-11-11', '2026-11-11');
  assert.equal(report.orders, 1);
  assert.equal(report.total, 29900);
  assert.equal(report.perDay[0].day, '2026-11-11');
  assert.equal(report.top[0].quantity, 2);
  assert.equal(app.reports.daily().handled, 0);
  for (const stage of ['Preparing', 'Ready', 'Completed']) app.orders.advance(paid.id, stage);
  assert.equal(app.reports.daily().handled, 1);
});

test('empty sales periods return numeric zero and empty series', t => {
  const { app } = fixture(t);
  assert.deepEqual(app.reports.sales('2026-11-11', '2026-11-11'), { orders: 0, total: 0, perDay: [], top: [] });
});

test('sales aggregate renamed menu items under the same item ID', t => {
  const { app, itemId, itemData, place, settle } = fixture(t);
  settle(place());
  app.catalog.saveItem(itemId, { ...itemData, name: 'Signature Mocha' });
  settle(place());
  const { top, total } = app.reports.sales('2026-11-11', '2026-11-11');
  assert.deepEqual(top.map(row => ({ ...row })), [{ name: 'Signature Mocha', quantity: 4 }]);
  assert.equal(total, 59800);
});

test('invalid or missing calendar dates fail before aggregation', t => {
  const { app } = fixture(t);
  for (const value of [null, '2026-2-01', '2025-02-29']) {
    assert.throws(() => app.reports.sales(value, '2026-11-11'), hasStatus(400));
  }
  assert.equal(validateDate('2024-02-29'), '2024-02-29');
});
