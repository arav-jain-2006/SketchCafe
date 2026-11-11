import { once } from 'node:events';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createApp, seedDemo } from '../src/app.js';
import { openDatabase } from '../src/database.js';
import { createHttpServer } from '../src/http.js';

const clients = 50;
const db = openDatabase();
const app = createApp(db);
seedDemo(db, app);
const server = createHttpServer(app);
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port + '/api/';

async function request(path, options) {
  const response = await fetch(base + path, options);
  assert.equal(response.status, 200, path + ' returned an unexpected status');
  return response;
}

function post(body, cookie) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(body) };
}

// Start all clients together and measure each complete API journey.
async function measure(name, requestsPerClient, journey) {
  const timings = await Promise.all(Array.from({ length: clients }, async (_, index) => {
    const start = performance.now();
    const data = await journey(index);
    return { ms: performance.now() - start, data };
  }));
  timings.sort((a, b) => a.ms - b.ms);
  const p95 = timings[Math.ceil(clients * .95) - 1].ms;
  const max = timings.at(-1).ms;
  console.log(JSON.stringify({
    scenario: name, clients, requests: clients * requestsPerClient,
    p95Ms: Math.round(p95), maxMs: Math.round(max)
  }));
  return { data: timings.map(result => result.data), max };
}

try {
  const reads = await measure('Menu and cart reads', 2, async () => {
    const [menu, cart] = await Promise.all(['menu', 'cart'].map(async path => (await request(path)).json()));
    assert.equal(menu.items.length, 7);
    assert.deepEqual(cart.lines, []);
  });
  assert.ok(reads.max <= 3000, 'Menu and cart exceeded the 3-second target');

  const item = app.catalog.list('latte').items[0];
  // Give each client its own cart cookie and assert that no totals leak across concurrent writes.
  const checkouts = await measure('Cart writes and checkouts', 2, async index => {
    const quantity = index % 4 + 1;
    const cartResponse = await request('cart', post({ id: item.id, quantity }));
    const cart = await cartResponse.json();
    assert.equal(cart.total, item.price * quantity);
    const cookie = cartResponse.headers.getSetCookie()[0].split(';')[0];
    const order = await (await request('order', post({
      name: 'Load Guest ' + index, phone: '9876543210'
    }, cookie))).json();
    assert.equal(order.status, 'Pending Payment');
    assert.equal(order.total, item.price * quantity);
    assert.equal(order.lines[0].quantity, quantity);
    return order.id;
  });
  assert.equal(new Set(checkouts.data).size, clients, 'Each cart must produce one distinct order');
  assert.equal(db.get('SELECT count(*) AS count FROM orders').count, clients);
  assert.deepEqual(app.orders.staffList(), [], 'Unpaid load orders must stay out of the staff queue');
  console.log('PASS: reads meet the latency target; concurrent checkouts preserve totals and isolation.');
} finally {
  await new Promise(resolve => server.close(resolve));
  db.close();
}
