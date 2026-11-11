import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCredentials } from '../../src/app.js';
import { serverFixture } from '../support/http.js';

test('HTTP guest checkout → failed retry → paid queue → pickup → review and support', async t => {
  const { client, db } = await serverFixture(t);
  const guest = client();
  const staff = client();
  const admin = client();
  const cartItem = (await guest('/api/menu?q=latte')).data.items[0];
  assert.equal(cartItem.name, 'Iced Spanish Latte');
  assert.equal((await guest('/api/cart', { id: cartItem.id, quantity: 2 })).data.total, 37000);
  const who = { name: 'Demo Customer', phone: '9876543210' };
  const [order1, order2] = await Promise.all([guest('/api/order', who), guest('/api/order', who)]);
  assert.equal(order1.status, 200);
  assert.equal(order1.data.id, order2.data.id);
  assert.equal(db.get('SELECT count(*) AS n FROM orders').n, 1);
  const creds = { orderId: order1.data.id, phone: who.phone };
  assert.equal((await staff('/api/staff/orders')).status, 401);
  assert.equal((await staff('/api/login', { username: 'staff', password: demoCredentials.staff })).status, 200);
  assert.equal((await admin('/api/login', { username: 'admin', password: demoCredentials.admin })).status, 200);
  assert.equal((await staff('/api/admin/staff')).status, 403);
  assert.equal((await admin('/api/staff/orders')).status, 403);
  assert.equal((await guest('/api/track', { ...creds, phone: '9876543211' })).status, 404);
  const attempt = (await guest('/api/payment/start', creds)).data.id;
  const first = { ...creds, attemptId: attempt };
  assert.equal((await guest('/api/payment/demo', { ...first, outcome: 'Failed' })).status, 200);
  assert.equal((await guest('/api/payment/verify', first)).data.status, 'Failed');
  assert.deepEqual((await staff('/api/staff/orders')).data.orders, []);
  const next = { ...creds, attemptId: (await guest('/api/payment/start', creds)).data.id };
  await guest('/api/payment/demo', { ...next, outcome: 'Succeeded' });
  assert.deepEqual((await staff('/api/staff/orders')).data.orders, []);
  const results = await Promise.all([guest('/api/payment/verify', next), guest('/api/payment/verify', next)]);
  assert.ok(results.every(result => result.data.status === 'Succeeded'));
  assert.equal((await staff('/api/staff/orders')).data.orders.length, 1);
  assert.equal((await staff('/api/staff/status', { orderId: creds.orderId, status: 'Ready' })).status, 409);
  for (const status of ['Preparing', 'Ready', 'Completed']) {
    assert.equal((await staff('/api/staff/status', { orderId: creds.orderId, status })).data.status, status);
  }
  assert.equal((await guest('/api/track', creds)).data.notifications.length, 4);
  assert.equal((await guest('/api/review', { ...creds, rating: 5, comment: 'Excellent' })).status, 200);
  assert.equal((await guest('/api/review', { ...creds, rating: 5, comment: '' })).status, 409);
  const ticket = await guest('/api/support', { ...creds, message: 'When do you close?' });
  const id = ticket.data.id;
  assert.equal((await admin('/api/admin/feedback')).data.reviews.length, 1);
  assert.equal((await admin('/api/admin/feedback/resolve', { id, response: 'At 8 pm.' })).status, 200);
  assert.equal((await guest('/api/support/lookup', { id, phone: who.phone })).data.response, 'At 8 pm.');
  assert.equal((await guest('/api/cancel', creds)).status, 404);
  assert.equal((await guest('/api/refund', creds)).status, 404);
});


test('admin price changes and staff availability changes apply at the right boundaries', async t => {
  const { client } = await serverFixture(t);
  const guest = client();
  const staff = client();
  const admin = client();
  await staff('/api/login', { username: 'staff', password: demoCredentials.staff });
  await admin('/api/login', { username: 'admin', password: demoCredentials.admin });
  const item = (await guest('/api/menu?q=latte')).data.items[0];
  await guest('/api/cart', { id: item.id, quantity: 1 });
  const payload = { id: item.id, name: item.name, description: item.description, image: item.image,
    categoryId: item.category_id, price: 20000, available: true };
  assert.equal((await staff('/api/admin/item', payload)).status, 403);
  assert.equal((await admin('/api/admin/item', payload)).status, 200);
  assert.equal((await guest('/api/cart')).data.total, 20000);
  await staff('/api/staff/availability', { id: item.id, available: false });
  const customer = { name: 'Guest', phone: '9876543210' };
  assert.equal((await guest('/api/order', customer)).status, 409);
  await staff('/api/staff/availability', { id: item.id, available: true });
  const order = (await guest('/api/order', customer)).data;
  await admin('/api/admin/item', { ...payload, price: 22000 });
  assert.equal((await guest('/api/track', { orderId: order.id, phone: customer.phone })).data.total, 20000);
});

test('customer sessions isolate carts and administrator deactivation revokes an open staff session', async t => {
  const { client } = await serverFixture(t);
  const first = client();
  const second = client();
  const admin = client();
  const item = (await first('/api/menu?q=latte')).data.items[0];
  await first('/api/cart', { id: item.id, quantity: 2 });
  assert.deepEqual((await second('/api/cart')).data.lines, []);
  const staff = (await first('/api/login', { username: 'staff', password: demoCredentials.staff })).data;
  await admin('/api/login', { username: 'admin', password: demoCredentials.admin });
  assert.equal((await admin('/api/admin/staff', { id: staff.id, username: staff.username, active: false })).status, 200);
  assert.equal((await first('/api/staff/orders')).status, 401);
  assert.equal((await first('/api/cart')).data.total, item.price * 2);
});

test('admin menu creation and archival immediately update the guest catalog', async t => {
  const { client } = await serverFixture(t);
  const admin = client();
  const guest = client();
  await admin('/api/login', { username: 'admin', password: demoCredentials.admin });
  const category = await admin('/api/admin/category', { name: 'Seasonal' });
  assert.equal(category.status, 200);
  const item = await admin('/api/admin/item', { name: 'Apple Cake', description: 'Baked today',
    image: '', price: 10000, categoryId: category.data.id, available: true });
  assert.equal(item.status, 200);
  assert.equal((await guest('/api/menu?q=Apple')).data.items.length, 1);
  assert.equal((await admin('/api/admin/category/remove', { id: category.data.id })).status, 409);
  assert.equal((await admin('/api/admin/item/remove', { id: item.data.id })).status, 200);
  assert.equal((await admin('/api/admin/category/remove', { id: category.data.id })).status, 200);
  assert.deepEqual((await guest('/api/menu?q=Apple')).data.items, []);
});
