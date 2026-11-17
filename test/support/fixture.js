import { createApp } from '../../src/app.js';
import { openDatabase } from '../../src/database.js';
import { readFileSync } from 'node:fs';

// Use the same SQL menu as the cafe, but give each case its own in-memory copy.
// No test reads or edits the running application's saved database.
const menuSeed = readFileSync(new URL('../../src/seed.sql', import.meta.url), 'utf8');

const time = Date.parse('2026-11-10T18:45:00Z');
export const mobile = '9876543210';
export const customer = { name: 'Asha', phone: mobile };
export const hasStatus = status => error => error.status === status;

// Each service test owns a fresh database with a known menu and clock.
export function fixture(t) {
  const db = openDatabase();
  t.after(() => db.close());
  const app = createApp(db, { time: () => time });
  db.transaction(() => db.exec(menuSeed));
  const latte = app.catalog.list('Latte').items.find(item => item.name === 'Latte');
  const categoryId = latte.category_id;
  const itemId = latte.id;
  const itemData = { categoryId, name: latte.name, description: latte.description,
    price: latte.price, available: Boolean(latte.available), image: latte.image };
  const place = () => app.orders.place(app.cart.change(null, itemId, 2).id, customer);
  // Drive the real demo verification path rather than writing a paid order directly.
  function settle(order, outcome = 'Succeeded') {
    const { id } = app.payments.start(order.id, mobile);
    app.payments.demoOutcome(order.id, mobile, id, outcome);
    return app.payments.verify(order.id, mobile, id);
  }
  return { app, db, categoryId, itemData, itemId, place, settle };
}

