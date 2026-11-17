import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../support/fixture.js';

// Sales total is zero.
test("View a report with no sales", t => {
  const { app } = fixture(t);
  assert.equal(app.reports.sales('2026-11-11', '2026-11-11').total, 0);
});

// Sales total is INR 299.
test("View total sales", t => {
  const { app, place, settle } = fixture(t);
  settle(place());
  assert.equal(app.reports.sales('2026-11-11', '2026-11-11').total, 29900);
});

// The daily order count is 1.
test("View orders per day", t => {
  const { app, place, settle } = fixture(t);
  settle(place());
  assert.equal(app.reports.sales('2026-11-11', '2026-11-11').perDay[0].orders, 1);
});

// Mocha is listed with two units sold.
test("View best-selling items", t => {
  const { app, place, settle } = fixture(t);
  settle(place());
  const item = app.reports.sales('2026-11-11', '2026-11-11').top[0];
  assert.equal(item.name, 'Mocha');
  assert.equal(item.quantity, 2);
});
