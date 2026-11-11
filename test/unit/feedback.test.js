import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, hasStatus, mobile } from '../support/fixture.js';

test('feedback restricts reviews and supports both order-linked and standalone requests', t => {
  const { app, place, settle } = fixture(t);
  const order = place();
  const data = { orderId: order.id, phone: mobile, rating: 5, comment: 'Great!' };
  assert.throws(() => app.feedback.review(data), hasStatus(409));
  settle(order);
  for (const stage of ['Preparing', 'Ready', 'Completed']) app.orders.advance(order.id, stage);
  assert.throws(() => app.feedback.review({ ...data, rating: 6 }), hasStatus(400));
  app.feedback.review(data);
  assert.throws(() => app.feedback.review(data), hasStatus(409));
  const standalone = app.feedback.request({ phone: mobile, message: 'Opening hours?' });
  const linked = app.feedback.request({ ...data, message: 'Can I get the receipt?' });
  app.feedback.resolve(linked, 'Open Track order to view your receipt.');
  assert.equal(app.feedback.lookup(standalone, mobile).status, 'Open');
  assert.equal(app.feedback.lookup(linked, mobile).status, 'Resolved');
  assert.throws(() => app.feedback.lookup(linked, '9876543211'), hasStatus(404));
  assert.equal(app.orders.track(order.id, mobile).support[0].id, linked);
  assert.equal(app.feedback.list().reviews.length, 1);
});

test('support rejects invalid contact details and blank messages', t => {
  const { app } = fixture(t);
  assert.throws(() => app.feedback.request({ phone: 'bad', message: 'Help' }), hasStatus(400));
  assert.throws(() => app.feedback.request({ phone: mobile, message: ' ' }), hasStatus(400));
});

test('a linked request requires the order owner’s phone', t => {
  const { app, place } = fixture(t);
  const order = place();
  assert.throws(() => app.feedback.request({ orderId: order.id, phone: '9876543211', message: 'Help' }), hasStatus(404));
});

test('resolving a ticket requires a reply and preserves the first reply', t => {
  const { app } = fixture(t);
  const id = app.feedback.request({ phone: mobile, message: 'Opening hours?' });
  assert.throws(() => app.feedback.resolve(id, ''), hasStatus(400));
  app.feedback.resolve(id, 'Open at 9.');
  assert.throws(() => app.feedback.resolve(id, 'Different reply'), hasStatus(409));
  assert.equal(app.feedback.lookup(id, mobile).response, 'Open at 9.');
});
