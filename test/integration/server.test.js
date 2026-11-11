import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, existsSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const directory = mkdtempSync(join(tmpdir(), 'sketch-server-'));
const database = join(directory, 'nested', 'demo.sqlite');
const entry = new URL('../../src/server.js', import.meta.url);
let child;
let base;

async function start() {
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('../', entry),
    env: { ...process.env, PORT: '0', SKETCH_DB: database },
    stdio: ['ignore', 'pipe', 'inherit'],
    windowsHide: true
  });
  const timeout = setTimeout(() => child.kill(), 7000);
  try {
    const line = await Promise.race([
      once(child.stdout, 'data').then(([chunk]) => chunk.toString()),
      once(child, 'exit').then(() => { throw new Error('Server exited before startup'); })
    ]);
    base = line.match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  } finally {
    clearTimeout(timeout);
  }
}

async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exit = once(child, 'exit');
  child.kill();
  await exit;
}

before(start);
after(async () => {
  await stop();
  // Remove only files owned by this test. The directory name is unique per run.
  for (const suffix of ['', '-shm', '-wal']) rmSync(database + suffix, { force: true });
  for (const folder of [join(directory, 'nested'), directory]) {
    if (existsSync(folder)) rmdirSync(folder);
  }
});

test('entry point uses a loopback address and an OS-assigned port', () => {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  assert.ok(Number(new URL(base).port) > 0);
});

test('entry point creates the configured database and its parent directory', () => {
  assert.ok(existsSync(database));
});

test('first launch serves the seeded menu through the public API', async () => {
  const response = await fetch(base + '/api/menu');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).items.length, 7);
});

test('restarting the entry point preserves a guest cart', async () => {
  const menu = await (await fetch(base + '/api/menu')).json();
  const response = await fetch(base + '/api/cart', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: menu.items.find(item => item.available).id, quantity: 2 })
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie()[0].split(';')[0];
  await stop();
  await start();
  const cart = await (await fetch(base + '/api/cart', { headers: { Cookie: cookie } })).json();
  assert.equal(cart.lines[0].quantity, 2);
});
