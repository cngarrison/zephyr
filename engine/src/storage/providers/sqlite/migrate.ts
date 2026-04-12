import type { DatabaseSync } from 'node:sqlite';
import * as m001 from './migrations/001_initial_schema.ts';
import * as m002 from './migrations/002_daily_aggregates.ts';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const migrations: Migration[] = [
  { version: 1, name: 'initial_schema', up: m001.up },
  { version: 2, name: 'daily_aggregates', up: m002.up },
];

function ensureSchemaVersion(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
}

function getCurrentVersion(db: DatabaseSync): number {
  try {
    const row = db.prepare(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1',
    ).get() as { version: number } | undefined;
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

function recordMigration(db: DatabaseSync, version: number, name: string): void {
  db.prepare(
    'INSERT INTO schema_version (version, name) VALUES (?, ?)',
  ).run(version, name);
}

export function runMigrations(db: DatabaseSync): void {
  ensureSchemaVersion(db);
  const current = getCurrentVersion(db);
  const pending = migrations.filter((m) => m.version > current);
  if (pending.length === 0) return;
  for (const migration of pending) {
    console.info(`[migrate] Running migration ${migration.version}: ${migration.name}`);
    db.exec('BEGIN');
    try {
      migration.up(db);
      recordMigration(db, migration.version, migration.name);
      db.exec('COMMIT');
      console.info(`[migrate] Migration ${migration.version} applied.`);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${(err as Error).message}`,
      );
    }
  }
}
