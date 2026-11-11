CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE,
  archived INTEGER NOT NULL DEFAULT 0
);
-- Archived categories keep references but release the name for reuse.
CREATE UNIQUE INDEX IF NOT EXISTS active_category_name ON categories(name) WHERE archived=0;
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories,
  name TEXT NOT NULL, description TEXT NOT NULL, image TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK(price > 0), available INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0
);
-- Guest carts use opaque IDs. An order's unique cart ID makes checkout retry-safe.
CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cart_items (
  cart_id TEXT NOT NULL REFERENCES carts, item_id INTEGER NOT NULL REFERENCES items,
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
  PRIMARY KEY(cart_id, item_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, cart_id TEXT NOT NULL UNIQUE REFERENCES carts,
  name TEXT NOT NULL, phone TEXT NOT NULL, total INTEGER NOT NULL CHECK(total > 0),
  status TEXT NOT NULL CHECK(status IN ('Pending Payment','Paid','Preparing','Ready','Completed')),
  created_at TEXT NOT NULL
);
-- Preserve the ordered names and prices independently of future menu edits.
CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders, item_id INTEGER NOT NULL REFERENCES items,
  name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price INTEGER NOT NULL CHECK(unit_price > 0), PRIMARY KEY(order_id, item_id)
);
-- A stage is recorded once per order and displayed in the tracking timeline.
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders,
  status TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(order_id,status)
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders,
  amount INTEGER NOT NULL CHECK(amount > 0), reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('Pending','Failed','Succeeded')),
  created_at TEXT NOT NULL, verified_at TEXT
);
-- An order can have many failed attempts but only one active and one successful attempt.
CREATE UNIQUE INDEX IF NOT EXISTS one_success ON payments(order_id) WHERE status = 'Succeeded';
CREATE UNIQUE INDEX IF NOT EXISTS one_pending ON payments(order_id) WHERE status = 'Pending';
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders, status TEXT NOT NULL,
  message TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(order_id,status)
);
-- One administrator and multiple staff can use the same account and session schema.
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('staff','admin')),
  active INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS single_admin ON employees(role) WHERE role = 'admin';
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees, last_seen INTEGER NOT NULL
);
-- The order primary key enforces one review per order.
CREATE TABLE IF NOT EXISTS reviews (
  order_id TEXT PRIMARY KEY REFERENCES orders, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL, created_at TEXT NOT NULL
);
-- General support requests can exist without an order. A reply is optional until resolution.
CREATE TABLE IF NOT EXISTS support (
  id INTEGER PRIMARY KEY, order_id TEXT REFERENCES orders, phone TEXT NOT NULL,
  message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Resolved')),
  created_at TEXT NOT NULL, response TEXT, resolved_at TEXT
);
-- Simulated provider state is separate from the café's verified payment records.
CREATE TABLE IF NOT EXISTS demo_gateway (
  reference TEXT PRIMARY KEY, order_id TEXT NOT NULL, amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending'
);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS payments_verified ON payments(status, verified_at);
