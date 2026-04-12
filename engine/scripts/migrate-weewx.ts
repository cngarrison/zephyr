#!/usr/bin/env -S deno run -A
/**
 * engine/scripts/migrate-weewx.ts
 *
 * One-shot idempotent migration from a weewx MySQL archive database into the
 * Zephyr SQLite observations table.
 *
 * Usage (from project root):
 *   deno run -A engine/scripts/migrate-weewx.ts
 *   # or via root task:
 *   deno task migrate
 *
 * Reads:  weewx MySQL archive table (imperial or metric units)
 * Writes: Zephyr SQLite observations table (SI units)
 *
 * Safe to re-run — records already present are silently skipped
 * (INSERT OR IGNORE on the primary key: timestamp + station_id).
 *
 * Tip: copy .env.example → .env and fill in values, then run:
 *   source .env && deno task migrate
 */

import { DatabaseSync } from 'node:sqlite';
import { createConnection } from 'mysql2/promise';
import { ensureDir } from '@std/fs';
import { dirname, resolve } from '@std/path';
import { config, primaryStation } from '../config.ts';
import { Units } from '../src/domain/units.ts';
import { runMigrations } from '../src/storage/providers/sqlite/migrate.ts';
import { load as loadDotenv } from '@std/dotenv';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

// Best-effort .env load — CWD is always engine/ when run via `deno task migrate`,
// so this finds engine/.env naturally. Silently ignored if not present.
await loadDotenv({ export: true }).catch(() => {});

// weewx source credentials are still read from env vars (external DB, not in zephyr.toml).
function env(name: string, fallback?: string): string {
  const val = Deno.env.get(name) ?? fallback;
  if (val === undefined) {
    console.error(`❌  Missing required env var: ${name}`);
    Deno.exit(1);
  }
  return val as string;
}

const MYSQL_HOST = env('WEEWX_MYSQL_HOST', 'localhost');
const MYSQL_PORT = Number(env('WEEWX_MYSQL_PORT', '3306'));
const MYSQL_USER = env('WEEWX_MYSQL_USER');
const MYSQL_PASSWORD = env('WEEWX_MYSQL_PASSWORD', '');
const MYSQL_DATABASE = env('WEEWX_MYSQL_DATABASE');
// Destination comes from zephyr.toml via the config singleton.
const SQLITE_PATH = resolve(config.storage.sqlite.path);
const STATION_ID = primaryStation().id;

// ---------------------------------------------------------------------------
// weewx unit systems
// ---------------------------------------------------------------------------

/** weewx usUnits codes */
const US = 1; // °F, inHg, mph, inch, in/hr
const METRIC = 16; // °C, hPa, km/h, mm, mm/hr
const METRICWX = 17; // °C, hPa, m/s,  mm, mm/hr

function n(v: unknown): number | null {
  return v == null ? null : Number(v);
}

function toC(v: unknown, us: number): number | null {
  const val = n(v);
  if (val === null) return null;
  return us === US ? Units.fToC(val) : val;
}

function toHpa(v: unknown, us: number): number | null {
  const val = n(v);
  if (val === null) return null;
  return us === US ? Units.inHgToHpa(val) : val;
}

function toMs(v: unknown, us: number): number | null {
  const val = n(v);
  if (val === null) return null;
  if (us === US) return Units.mphToMs(val);
  if (us === METRIC) return val / 3.6; // km/h → m/s
  return val; // METRICWX already m/s
}

function toMmHr(v: unknown, us: number): number | null {
  const val = n(v);
  if (val === null) return null;
  return us === US ? Units.inHrToMmHr(val) : val;
}

function toMm(v: unknown, us: number): number | null {
  const val = n(v);
  if (val === null) return null;
  return us === US ? Units.inToMm(val) : val;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;

async function main() {
  console.log('🌤  Zephyr — weewx migration');
  console.log(`   MySQL  : ${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`);
  console.log(`   SQLite : ${SQLITE_PATH}`);
  console.log(`   Station: ${STATION_ID}`);
  console.log();

  // ── Open SQLite ─────────────────────────────────────────────────────────
  await ensureDir(dirname(SQLITE_PATH));
  const db = new DatabaseSync(SQLITE_PATH);
  // Run migrations to ensure schema is up to date.
  runMigrations(db);

  // Find the highest timestamp already stored for this station so we can
  // skip everything up to that point (cursor-based resume).
  const maxRow = db
    .prepare('SELECT MAX(timestamp) AS m FROM observations WHERE station_id = ?')
    .get(STATION_ID) as { m: number | null } | undefined;
  const since: number = maxRow?.m ?? 0;

  if (since > 0) {
    console.log(
      `ℹ  Resuming after ${new Date(since * 1000).toISOString()} (epoch ${since})`,
    );
  } else {
    console.log('ℹ  No existing records — full migration.');
  }
  console.log();

  // Prepared INSERT OR IGNORE — skips rows whose (timestamp, station_id)
  // primary key already exists in the observations table.
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO observations (
      timestamp, station_id,
      temp_indoor, temp_outdoor, temp_dewpoint, temp_feels_like,
      humidity_indoor, humidity_outdoor,
      pressure_abs, pressure_rel,
      wind_speed, wind_gust, wind_direction,
      rain_rate, rain_daily, rain_weekly, rain_monthly, rain_yearly, rain_event,
      solar_radiation, uv_index
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  // ── Connect to MySQL ─────────────────────────────────────────────────────
  console.log('Connecting to MySQL...');
  const conn = await createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
  });
  console.log('Connected.\n');

  let totalRead = 0;
  let inserted = 0;
  let skipped = 0;
  let cursorTs = since;

  try {
    // Record count for progress display (informational; not a hard limit).
    const [countRows] = await conn.query(
      'SELECT COUNT(*) AS n FROM archive WHERE dateTime > ?',
      [since],
    ) as [Record<string, unknown>[], unknown];
    const total = Number((countRows as Record<string, unknown>[])[0]?.n ?? 0);

    console.log(`📊 Records to process: ${total}`);
    if (total === 0) {
      console.log('✅ Already up to date — nothing to do.');
      return;
    }
    console.log();

    // Cursor-based pagination: always advance past the last seen dateTime.
    // This avoids OFFSET slowdowns and handles additions to the archive mid-run.
    while (true) {
      const [rows] = await conn.query(
        `SELECT * FROM archive
         WHERE dateTime > ?
         ORDER BY dateTime ASC
         LIMIT ?`,
        [cursorTs, BATCH_SIZE],
      ) as [Record<string, unknown>[], unknown];

      const batch = rows as Record<string, unknown>[];
      if (batch.length === 0) break;

      db.exec('BEGIN');
      try {
        for (const row of batch) {
          const us = Number(row.usUnits ?? US);

          // Warn once if we see unexpected unit system codes.
          if (us !== US && us !== METRIC && us !== METRICWX) {
            console.warn(
              `  ⚠  Unknown usUnits=${us} at dateTime=${row.dateTime} — treating as US imperial.`,
            );
          }

          const result = insertStmt.run(
            n(row.dateTime), // INTEGER epoch seconds
            STATION_ID,
            // Temperatures → °C
            toC(row.inTemp, us), // temp_indoor
            toC(row.outTemp, us), // temp_outdoor
            toC(row.dewpoint, us), // temp_dewpoint
            toC(row.appTemp, us), // temp_feels_like (may be null)
            // Humidity %  (dimensionless — no conversion)
            n(row.inHumidity), // humidity_indoor
            n(row.outHumidity), // humidity_outdoor
            // Pressure → hPa
            toHpa(row.pressure, us), // pressure_abs  (station pressure)
            toHpa(row.barometer, us), // pressure_rel  (sea-level)
            // Wind → m/s, direction degrees (no conversion)
            toMs(row.windSpeed, us), // wind_speed
            toMs(row.windGust, us), // wind_gust
            n(row.windDir), // wind_direction
            // Rain → mm/hr or mm
            toMmHr(row.rainRate, us), // rain_rate
            null, // rain_daily  (not in archive interval)
            null, // rain_weekly
            null, // rain_monthly
            null, // rain_yearly
            toMm(row.rain, us), // rain_event  (interval accumulation)
            // Solar / UV (W/m², index — no conversion)
            n(row.radiation), // solar_radiation
            n(row.UV), // uv_index
          ) as { changes: number; lastInsertRowid: number | bigint };

          if (result.changes > 0) inserted++;
          else skipped++;
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      totalRead += batch.length;
      cursorTs = Number(batch[batch.length - 1].dateTime);

      const pct = total > 0 ? Math.min(100, Math.round((totalRead / total) * 100)) : 100;
      console.log(
        `   [${totalRead}/${total} — ${pct}%]  inserted: ${inserted}  skipped: ${skipped}`,
      );
    }

    console.log();
    console.log('─'.repeat(50));
    console.log('✅  Migration complete');
    console.log(`   Records read    : ${totalRead}`);
    console.log(`   Inserted        : ${inserted}`);
    console.log(`   Skipped (dupes) : ${skipped}`);
    console.log('─'.repeat(50));
  } finally {
    await conn.end();
    db.close();
  }
}

main().catch((err: unknown) => {
  console.error(
    '\n❌  Migration failed:',
    err instanceof Error ? err.message : String(err),
  );
  Deno.exit(1);
});
