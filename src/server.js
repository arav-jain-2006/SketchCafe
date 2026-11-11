import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { createApp, seedDemo } from './app.js';
import { createHttpServer } from './http.js';

// The launcher owns the on-disk database. Tests can isolate it with SKETCH_DB and PORT=0.
const databasePath = process.env.SKETCH_DB ? resolve(process.env.SKETCH_DB) :
  fileURLToPath(new URL('../data/sketch.sqlite', import.meta.url));
// Prepare the database directory before opening SQLite and seeding first-run records.
mkdirSync(dirname(databasePath), { recursive: true });
const db = openDatabase(databasePath);
const app = createApp(db);
seedDemo(db, app);
// Bind only to loopback. PORT=0 requests an available port in tests.
const port = Number(process.env.PORT ?? 3000);
const server = createHttpServer(app);
server.listen(port, '127.0.0.1', () => {
  console.log('Sketch Café demo is ready at http://127.0.0.1:' + server.address().port);
});
// Drain outstanding requests before closing SQLite when the operator presses Ctrl+C.
process.once('SIGINT', () => server.close(() => db.close()));
