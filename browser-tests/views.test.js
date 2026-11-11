import test from 'node:test';
import assert from 'node:assert/strict';
import { browserSuite, itemCard, mobile, seedOrder } from './fixture.js';

const browser = browserSuite();

test('the responsive menu filters by keyword and opens accessible item details', async t => {
  const page = await (await browser(t)).page('menu', { width: 390, height: 844 });
  await page.getByLabel('Search the menu').fill('latte');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('heading', { name: 'Café Mocha' }).waitFor({ state: 'detached' });
  await itemCard(page, 'Iced Spanish Latte').getByRole('button', { name: 'Details' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: 'Iced Spanish Latte' }).waitFor();
  assert.doesNotMatch(await dialog.innerText(), /\b(?:null|undefined)\b/);
  assert.equal(await dialog.locator('img').count(), 0);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('sold-out items cannot be added and cart updates preserve checkout fields', async t => {
  const page = await (await browser(t)).page();
  const soldOut = itemCard(page, 'Almond Croissant');
  await soldOut.getByText('Sold out').waitFor();
  assert.equal(await soldOut.getByRole('button', { name: 'Add to cart' }).count(), 0);
  await itemCard(page, 'Iced Spanish Latte').getByRole('button', { name: 'Add to cart' }).click();
  await page.getByLabel('Your name').fill('Test Guest');
  const quantity = page.getByLabel('Quantity for Iced Spanish Latte');
  await quantity.fill('');
  await quantity.press('Tab');
  await page.getByText('Enter a quantity from 1 to 99', { exact: false }).waitFor();
  assert.equal(await quantity.inputValue(), '1');
  await quantity.fill('2');
  await quantity.press('Tab');
  await page.getByRole('button', { name: 'View cart (2)', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Your name').inputValue(), 'Test Guest');
  assert.match(await page.getByRole('complementary', { name: 'Cart' }).innerText(), /₹370\.00/);
});

test('guest checkout shows a failed attempt, then a verified receipt after retry', async t => {
  const page = await (await browser(t)).page();
  await itemCard(page, 'Iced Spanish Latte').getByRole('button', { name: 'Add to cart' }).click();
  await page.getByLabel('Your name').fill('Test Guest');
  await page.getByLabel('Mobile number').fill(mobile);
  await page.getByRole('button', { name: 'Place pickup order' }).click();
  await page.getByRole('button', { name: 'Start demo UPI payment' }).click();
  assert.doesNotMatch(await page.getByRole('main').innerText(), /\b(?:null|undefined)\b/);
  await page.getByRole('button', { name: 'Simulate failure' }).click();
  await page.getByText('Payment failed.', { exact: false }).waitFor();
  assert.equal(await page.locator('.progress [aria-current=step]').innerText(), 'Pending Payment');
  await page.getByRole('button', { name: 'Start demo UPI payment' }).click();
  await page.getByRole('button', { name: 'Simulate success' }).click();
  await page.getByText('Demo UPI receipt').waitFor();
  assert.equal(await page.locator('.progress [aria-current=step]').innerText(), 'Paid');
  assert.doesNotMatch(await page.getByRole('main').innerText(), /\b(?:null|undefined)\b/);
});

test('tracking shows an open support request and a completed-order review without placeholder text', async t => {
  const { app, page } = await browser(t);
  const order = seedOrder(app, { pay: true });
  app.feedback.request({ orderId: order.id, phone: mobile, message: 'Pickup question' });
  for (const status of ['Preparing', 'Ready', 'Completed']) app.orders.advance(order.id, status);

  const guest = await page('track');
  await guest.getByLabel('Order code').fill(order.id);
  await guest.getByLabel('Mobile number').fill(mobile);
  await guest.getByRole('button', { name: 'Find order' }).click();
  await guest.getByRole('heading', { name: 'Support requests' }).waitFor();
  await guest.getByRole('heading', { name: 'How was your order?' }).waitFor();
  assert.doesNotMatch(await guest.getByRole('main').innerText(), /\b(?:null|undefined)\b/);
});

test('a failed receipt refresh leaves payment check available for a safe retry', async t => {
  const { app, page } = await browser(t);
  const order = seedOrder(app);
  const guest = await page('track');
  await guest.getByLabel('Order code').fill(order.id);
  await guest.getByLabel('Mobile number').fill(mobile);
  await guest.getByRole('button', { name: 'Find order' }).click();
  await guest.getByRole('button', { name: 'Start demo UPI payment' }).click();

  // Settlement succeeds, but the next tracking read fails before the receipt can render.
  await guest.route('**/api/track', route => route.fulfill({
    status: 503, json: { error: 'Order refresh unavailable' }
  }), { times: 1 });
  await guest.getByRole('button', { name: 'Simulate success' }).click();
  await guest.getByRole('alert').filter({ hasText: 'Order refresh unavailable' }).waitFor();
  await guest.getByRole('button', { name: 'Check payment' }).click();
  await guest.getByText('Demo UPI receipt').waitFor();
  assert.equal(app.orders.track(order.id, mobile).notifications.length, 1);
});

test('support form submits and looks up an enquiry with the correct phone', async t => {
  const page = await (await browser(t)).page('support');
  await page.getByLabel('Mobile number').first().fill(mobile);
  await page.getByLabel('Message', { exact: true }).fill('When do you close?');
  await page.getByRole('button', { name: 'Send request' }).click();
  await page.getByText(/Request #1 was received/).waitFor();
  await page.getByLabel('Request number').fill('1');
  await page.getByLabel('Mobile number').last().fill(mobile);
  await page.getByRole('button', { name: 'Check status' }).click();
  await page.getByText('Open', { exact: true }).waitFor();
});
