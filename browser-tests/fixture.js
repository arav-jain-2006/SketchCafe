import { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { demoCredentials } from '../src/app.js';
import { serverFixture } from '../test/support/http.js';

export const mobile = '9876543210';

// Share one browser process per suite, with a fresh context and server for each case.
export function browserSuite() {
  let browser;

  before(async () => {
    const modulePath = process.env.SKETCH_PLAYWRIGHT_PATH;
    const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.SKETCH_CHROMIUM_PATH || undefined
    });
  });
  after(async () => { await browser?.close(); });

  return async function browserFixture(t) {
    const server = await serverFixture(t);
    const contexts = [];
    const errors = [];
    t.after(async () => {
      await Promise.all(contexts.map(context => context.close()));
      assert.deepEqual(errors, [], 'No uncaught page errors');
    });

    // Open a separate context for each role to avoid sharing employee or cart cookies.
    async function page(route = 'menu', viewport = { width: 1280, height: 900 }) {
      const context = await browser.newContext({ viewport });
      contexts.push(context);
      const tab = await context.newPage();
      tab.on('pageerror', error => errors.push(error.message));
      tab.setDefaultTimeout(10000);
      await tab.goto(server.url + '/#' + route);
      return tab;
    }

    return { ...server, page };
  };
}

export async function login(page, role) {
  await page.getByLabel('Username').fill(role);
  await page.getByLabel('Password', { exact: true }).fill(demoCredentials[role]);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: role === 'staff' ? 'Staff workspace' : 'Café administration' }).waitFor();
}

export function seedOrder(app, { pay = false, name = 'Test Guest' } = {}) {
  const item = app.catalog.list('latte').items[0];
  const { id } = app.cart.change(null, item.id, 2);
  const order = app.orders.place(id, { name, phone: mobile });
  if (pay) {
    const attempt = app.payments.start(order.id, mobile);
    app.payments.demoOutcome(order.id, mobile, attempt.id, 'Succeeded');
    app.payments.verify(order.id, mobile, attempt.id);
  }
  return order;
}

export function itemCard(page, name) {
  return page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
}
