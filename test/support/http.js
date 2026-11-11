import { once } from 'node:events';
import { openDatabase } from '../../src/database.js';
import { createApp, seedDemo } from '../../src/app.js';
import { createHttpServer } from '../../src/http.js';

// Bind a temporary loopback server and seed an isolated database for each HTTP test.
export async function serverFixture(t) {
  const db = openDatabase();
  const app = createApp(db);
  seedDemo(db, app);
  const server = createHttpServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  });
  const url = 'http://127.0.0.1:' + server.address().port;
  // Each client has a small cookie jar so the same fixture can represent separate users.
  const client = () => {
    const cookies = new Map();
    return async (path, body, headers = {}) => {
      const options = { headers: { ...headers } };
      if (body !== undefined) {
        options.method = 'POST';
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      options.headers.Cookie = [...cookies.values()].join('; ');
      const response = await fetch(url + path, options);
      for (const value of response.headers.getSetCookie()) {
        const cookie = value.split(';')[0];
        cookies.set(cookie.split('=')[0], cookie);
      }
      const data = response.headers.get('content-type')?.startsWith('application/json')
        ? await response.json() : await response.text();
      return { status: response.status, data, headers: response.headers };
    };
  };
  return { app, client, db, url };
}

