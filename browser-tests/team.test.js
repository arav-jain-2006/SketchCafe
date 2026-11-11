import test from 'node:test';
import assert from 'node:assert/strict';
import { browserSuite, itemCard, login, mobile, seedOrder } from './fixture.js';

const browser = browserSuite();

test('staff sees authentication feedback and only staff navigation after signing in', async t => {
  const page = await (await browser(t)).page('team');
  await page.getByLabel('Username').fill('staff');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Username or password is incorrect' }).waitFor();
  await login(page, 'staff');
  assert.equal(await page.getByRole('button', { name: 'Sales reports' }).count(), 0);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('heading', { name: 'Team sign-in' }).waitFor();
});

test('a verified guest order appears in the live staff queue and moves through pickup', async t => {
  const { page, app } = await browser(t);
  const order = seedOrder(app);
  const staff = await page('team');
  await login(staff, 'staff');
  await staff.getByText('No active paid orders.').waitFor();

  const guest = await page('track', { width: 390, height: 844 });
  await guest.getByLabel('Order code').fill(order.id);
  await guest.getByLabel('Mobile number').fill(mobile);
  await guest.getByRole('button', { name: 'Find order' }).click();
  await guest.getByRole('button', { name: 'Start demo UPI payment' }).click();
  await guest.getByRole('button', { name: 'Simulate success' }).click();

  for (const status of ['Preparing', 'Ready', 'Completed']) {
    await staff.getByRole('button', { name: 'Mark ' + status }).click();
  }
  await guest.getByRole('heading', { name: 'How was your order?' }).waitFor();
  await guest.getByLabel('Comment (optional)').fill('Fast pickup');
  await guest.getByRole('button', { name: 'Submit review' }).click();
  await guest.getByText('Thanks for reviewing your order.').waitFor();
  await staff.getByRole('button', { name: 'Order history' }).click();
  await staff.locator('select[name=status]').selectOption('Completed');
  await staff.getByRole('button', { name: 'Filter history' }).click();
  await staff.getByRole('heading', { name: 'Test Guest' }).waitFor();
});

test('staff availability updates the customer menu', async t => {
  const { page } = await browser(t);
  const staff = await page('team');
  await login(staff, 'staff');
  await staff.getByRole('button', { name: 'Availability', exact: true }).click();
  const item = staff.locator('section.card').filter({ has: staff.getByRole('heading', { name: 'Iced Spanish Latte' }) });
  await item.getByRole('button', { name: 'Mark sold out' }).click();
  await item.getByText('Sold out', { exact: true }).waitFor();

  const guest = await page();
  const latte = itemCard(guest, 'Iced Spanish Latte');
  await latte.getByText('Sold out', { exact: true }).waitFor();
  assert.equal(await latte.getByRole('button', { name: 'Add to cart' }).count(), 0);
});

test('admin can create a menu category and staff account in separate screens', async t => {
  const admin = await (await browser(t)).page('team');
  await login(admin, 'admin');
  await admin.getByLabel('Category name').last().fill('Weekend specials');
  await admin.getByRole('button', { name: 'Add category' }).click();
  await admin.locator('summary').getByText('Weekend specials', { exact: true }).waitFor();

  await admin.getByRole('button', { name: 'Staff accounts' }).click();
  await admin.getByLabel('Username', { exact: true }).last().fill('weekend-staff');
  await admin.getByLabel('Password', { exact: true }).fill('WeekendStaff!26');
  await admin.getByRole('button', { name: 'Create staff account' }).click();
  await admin.locator('summary').getByText('weekend-staff · Active', { exact: true }).waitFor();
});

test('admin sees verified sales and can resolve a guest support request', async t => {
  const { page, app } = await browser(t);
  const order = seedOrder(app, { pay: true });
  app.feedback.request({ orderId: order.id, phone: mobile, message: 'Is the café open tomorrow?' });
  const admin = await page('team');
  await login(admin, 'admin');
  await admin.getByRole('button', { name: 'Sales reports' }).click();
  await admin.getByText('Verified orders', { exact: true }).waitFor();
  const stats = admin.locator('.stat').filter({ hasText: 'Total sales' });
  assert.match(await stats.innerText(), /₹370\.00/);

  await admin.getByRole('button', { name: 'Feedback' }).click();
  await admin.getByLabel('Response to customer').fill('Yes, from 9 am.');
  await admin.getByRole('button', { name: 'Send reply and resolve' }).click();
  await admin.getByText('Yes, from 9 am.').waitFor();
  assert.equal(app.feedback.lookup(1, mobile).status, 'Resolved');
});
