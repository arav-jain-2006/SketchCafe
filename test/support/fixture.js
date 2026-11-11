import { createApp } from '../../src/app.js';
import { openDatabase } from '../../src/database.js';

export const time = Date.parse('2026-11-10T18:45:00Z');
export const mobile = '9876543210';
export const customer = { name: 'Asha', phone: mobile };
export const hasStatus = status => error => error.status === status;

// Each service test owns a fresh database with a known menu and clock.
export function fixture(t, options = {}) {
  const db = openDatabase();
  t.after(() => db.close());
  const app = createApp(db, { time: () => time, ...options });
  const categoryId = app.catalog.saveCategory(null, { name: 'Drinks' });
  const itemData = { categoryId, name: 'Mocha', description: 'Dark cocoa', price: 14950, available: true, image: '' };
  const itemId = app.catalog.saveItem(null, itemData);
  const place = () => app.orders.place(app.cart.change(null, itemId, 2).id, customer);
  // Drive the real demo verification path rather than writing a paid order directly.
  function settle(order, outcome = 'Succeeded') {
    const { id } = app.payments.start(order.id, mobile);
    app.payments.demoOutcome(order.id, mobile, id, outcome);
    return app.payments.verify(order.id, mobile, id);
  }
  return { app, db, categoryId, itemData, itemId, place, settle };
}

