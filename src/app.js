import { readFileSync } from 'node:fs';
import { createAuth } from './auth.js';
import { createCart } from './cart.js';
import { createCatalog } from './catalog.js';
import { createDemoGateway } from './demo-gateway.js';
import { createFeedback } from './feedback.js';
import { createNotifications } from './notifications.js';
import { createOrders } from './orders.js';
import { createPayments } from './payments.js';
import { createReports } from './reports.js';

// The SQL seed initializes database rows. Runtime menu reads and admin updates
// use the catalog service and SQLite, never an in-memory menu array.
const menuSeed = readFileSync(new URL('./seed.sql', import.meta.url), 'utf8');

// The composition root wires shared dependencies once. Feature services stay independent of HTTP.
export function createApp(db, { time = Date.now, gateway = createDemoGateway(db) } = {}) {
  // Give features a UTC timestamp and keep the original millisecond clock for session expiry.
  const now = () => new Date(time()).toISOString();
  const catalog = createCatalog(db);
  const cart = createCart(db, catalog, now);
  const notifications = createNotifications(db, now);
  // Compose in dependency order: orders consume cart and inbox, then payment and feedback consume orders.
  const orders = createOrders(db, cart, notifications, now);
  return {
    auth: createAuth(db, time), catalog, cart, orders, notifications,
    payments: createPayments(db, orders, gateway, now),
    feedback: createFeedback(db, orders, now), reports: createReports(db, now)
  };
}

// Public classroom credentials let the employee roles be demonstrated from a clean database.
export const demoCredentials = { admin: 'SketchAdmin!26', staff: 'SketchStaff!26' };

// Keep accounts on restart and apply each menu revision only once. Existing
// orders retain their original item references, copied names and prices.
export function seedDemo(db, app) {
  // Commit accounts and menu together. A failed seed leaves no partial data for the next launch.
  db.transaction(() => {
    if (!db.get("SELECT 1 FROM employees WHERE role='admin'")) {
      for (const role of ['admin', 'staff']) app.auth.createAccount(role, demoCredentials[role], role);
    }
    // The seed's database guard applies this revision once. Repeated starts
    // preserve prices, sold-out flags, custom items and historical orders.
    db.exec(menuSeed);
  });
}
