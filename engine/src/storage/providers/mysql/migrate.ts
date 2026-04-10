import type { Pool } from "mysql2/promise";
import * as m001 from "./migrations/001_initial_schema.ts";
import * as m002 from "./migrations/002_daily_aggregates.ts";

export interface Migration {
  version: number;
  name: string;
  up: (pool: Pool) => Promise<void>;
}

export const migrations: Migration[] = [
  { version: 1, name: "initial_schema",    up: m001.up },
  { version: 2, name: "daily_aggregates",  up: m002.up },
];

async function ensureSchemaVersion(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    BIGINT       NOT NULL,
      name       VARCHAR(255) NOT NULL,
      applied_at VARCHAR(64)  NOT NULL DEFAULT (DATE_FORMAT(NOW(3), '%Y-%m-%dT%H:%i:%s.%fZ')),
      PRIMARY KEY (version)
    )
  `);
}

async function getCurrentVersion(pool: Pool): Promise<number> {
  try {
    const [rows] = await pool.execute(
      "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
    );
    const r = (rows as { version: number }[])[0];
    return r?.version ?? 0;
  } catch {
    return 0;
  }
}

async function recordMigration(pool: Pool, version: number, name: string): Promise<void> {
  await pool.execute(
    "INSERT INTO schema_version (version, name) VALUES (?, ?)",
    [version, name],
  );
}

export async function runMigrations(pool: Pool): Promise<void> {
  await ensureSchemaVersion(pool);
  const current = await getCurrentVersion(pool);
  const pending = migrations.filter((m) => m.version > current);
  if (pending.length === 0) return;
  for (const migration of pending) {
    console.info(`[migrate] Running migration ${migration.version}: ${migration.name}`);
    try {
      await migration.up(pool);
      await recordMigration(pool, migration.version, migration.name);
      console.info(`[migrate] Migration ${migration.version} applied.`);
    } catch (err) {
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${(err as Error).message}`,
      );
    }
  }
}
