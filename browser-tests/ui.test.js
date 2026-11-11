import test from 'node:test';
import assert from 'node:assert/strict';
import { browserSuite } from './fixture.js';

const browser = browserSuite();

test('default route loads the menu and marks the active navigation link', async t => {
  const page = await (await browser(t)).page();
  await page.getByRole('heading', { name: 'Good coffee. Easy pickup.' }).waitFor();
  assert.equal(await page.getByRole('navigation').getByRole('link', { name: 'Menu' }).getAttribute('aria-current'), 'page');
  assert.equal(await page.getByRole('main').getAttribute('aria-busy'), null);
});

test('route links and browser Back keep location and content synchronized', async t => {
  const page = await (await browser(t)).page();
  await page.getByRole('link', { name: 'Track order' }).click();
  await page.getByRole('heading', { name: 'Track your order' }).waitFor();
  await page.getByRole('link', { name: 'Support' }).click();
  await page.getByRole('heading', { name: 'Contact support' }).waitFor();
  await page.goBack();
  await page.getByRole('heading', { name: 'Track your order' }).waitFor();
  assert.equal(new URL(page.url()).hash, '#track');
});

test('unknown routes fall back to the menu and leave the artwork decorative', async t => {
  const page = await (await browser(t)).page('unrecognized');
  await page.getByRole('heading', { name: 'Good coffee. Easy pickup.' }).waitFor();
  const image = page.locator('.hero-art');
  assert.equal(await image.getAttribute('alt'), '');
  assert.ok(await image.evaluate(node => node.complete && node.naturalWidth > 0));
});

test('keyboard skip link focuses main content without changing the route', async t => {
  const page = await (await browser(t)).page('support', { width: 360, height: 800 });
  await page.getByRole('heading', { name: 'Contact support' }).waitFor();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'app');
  assert.equal(new URL(page.url()).hash, '#support');
});
