import test from 'node:test';
import assert from 'node:assert/strict';
import { browserSuite } from './fixture.js';

const browser = browserSuite();

test('DOM helper displays HTML-like text without creating active markup', async t => {
  const page = await (await browser(t)).page();
  const result = await page.evaluate(async () => {
    const { el } = await import('/components.js');
    const node = el('p', {}, '<img onerror=alert(1)>');
    return [node.textContent, node.childElementCount];
  });
  assert.deepEqual(result, ['<img onerror=alert(1)>', 0]);
});

test('money and order lines display exact paise with quantity multiplication', async t => {
  const page = await (await browser(t)).page();
  const total = await page.evaluate(async () => {
    const { lines } = await import('/components.js');
    return lines({ lines: [{ name: 'Coffee', quantity: 2, unit_price: 12345 }] }).textContent;
  });
  assert.equal(total, '2 × Coffee₹246.90');
});

test('replacing children omits absent values and preserves valid zero content', async t => {
  const page = await (await browser(t)).page();
  const result = await page.evaluate(async () => {
    const { el, replace } = await import('/components.js');
    const panel = el('div', {}, 'Old contents');
    replace(panel, null, [undefined, false, 0, el('strong', {}, ' items')]);
    return { text: panel.textContent, elements: panel.childElementCount };
  });
  assert.deepEqual(result, { text: '0 items', elements: 1 });
});

test('action controls restore the button and announce a rejected operation', async t => {
  const page = await (await browser(t)).page();
  await page.evaluate(async () => {
    const { actionButton, note } = await import('/components.js');
    const error = note('', 'error');
    document.body.append(actionButton('Test action', async () => { throw new Error('Unavailable'); }, error), error);
  });
  const action = page.getByRole('button', { name: 'Test action' });
  await action.click();
  await page.getByRole('alert').filter({ hasText: 'Unavailable' }).waitFor();
  assert.equal(await action.isEnabled(), true);
});

test('forms pass named values and lock the submit button while saving', async t => {
  const page = await (await browser(t)).page();
  await page.evaluate(async () => {
    const { form, input } = await import('/components.js');
    const result = document.createElement('output');
    document.body.append(form(input('Test name', 'name'), 'Save test', async values => {
      await new Promise(resolve => { window.finishTestSave = resolve; });
      result.textContent = values.name;
    }), result);
  });
  await page.getByLabel('Test name').fill('Sample');
  const save = page.getByRole('button', { name: 'Save test' });
  await save.click();
  assert.equal(await save.isDisabled(), true);
  await page.evaluate(() => window.finishTestSave());
  await page.getByText('Sample', { exact: true }).waitFor();
  assert.equal(await save.isEnabled(), true);
});
