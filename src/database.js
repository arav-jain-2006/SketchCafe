import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/**
 * Open a file-backed café database or an isolated in-memory test database.
 * Return prepared-statement helpers and a synchronous transaction boundary.
 */
export function openDatabase(path = ':memory:') {
  const connection = new DatabaseSync(path);
  // Enable foreign keys, briefly wait for a busy writer and use WAL for file-backed data.
  connection.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000; PRAGMA journal_mode = WAL;');
  // The idempotent schema initializes new files while preserving existing rows.
  connection.exec(schema);
  return {
    // get reads one row, all reads a list and run returns write metadata. Arguments are bound separately.
    get: (sql, ...args) => connection.prepare(sql).get(...args),
    all: (sql, ...args) => connection.prepare(sql).all(...args),
    run: (sql, ...args) => connection.prepare(sql).run(...args),
    // Use only synchronous work here. BEGIN IMMEDIATE reserves the write lock before any reads.
    transaction(work) {
      connection.exec('BEGIN IMMEDIATE');
      try {
        const result = work();
        connection.exec('COMMIT');
        return result;
      } catch (error) {
        connection.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => connection.close()
  };
}
