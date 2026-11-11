import { createAuth } from './auth.js';
import { createCart } from './cart.js';
import { createCatalog } from './catalog.js';
import { createDemoGateway } from './demo-gateway.js';
import { createFeedback } from './feedback.js';
import { createNotifications } from './notifications.js';
import { createOrders } from './orders.js';
import { createPayments } from './payments.js';
import { createReports } from './reports.js';

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

// Seed only the first run so restarting preserves café data and changed passwords.
export function seedDemo(db, app) {
  // Commit accounts and menu together. A failed seed leaves no partial data for the next launch.
  db.transaction(() => {
    if (!db.get("SELECT 1 FROM employees WHERE role='admin'")) {
      for (const role of ['admin', 'staff']) app.auth.createAccount(role, demoCredentials[role], role);
    }
    if (db.get('SELECT 1 FROM categories')) return;
    const categories = ['Coffee & Tea', 'Kitchen', 'Bakery'];
    const ids = categories.map(name => app.catalog.saveCategory(null, { name }));
    // Each row gives category index, item name, description, price in paise and availability.
    const menu = [
      [0, 'Iced Spanish Latte', 'Espresso and condensed milk over ice. Smooth, bold and lightly sweet.', 18500, true],
      [0, 'Café Mocha', 'Dark cocoa, espresso and silky steamed milk.', 17500, true],
      [0, 'Peach Iced Tea', 'Black tea, peach and a squeeze of lemon.', 13500, true],
      [1, 'Pesto Grilled Sandwich', 'Basil pesto, mozzarella and tomato on toasted sourdough.', 22500, true],
      [1, 'Smoky Paneer Wrap', 'Spiced paneer, crunchy slaw and a smoky yoghurt dressing.', 21000, true],
      [2, 'Sea Salt Brownie', 'Fudgy chocolate brownie with flaky sea salt.', 11500, true],
      [2, 'Almond Croissant', 'Butter croissant filled with almond cream.', 14500, false]
    ];
    for (const [group, name, description, price, available] of menu) {
      app.catalog.saveItem(null, { categoryId: ids[group], name, description, price, available, image: '' });
    }
  });
}
