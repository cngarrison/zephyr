#!/usr/bin/env -S deno run -A
/**
 * engine/scripts/dedup-observations.ts
 *
 * Removes duplicate observations caused by the weewx migration overlapping
 * with live GW1000 ingestion.
 *
 * Background
 * ----------
 * weewx archives on exact 5-minute epoch boundaries (timestamp % 300 == 0).
 * Live push data from the GW1000 arrives at arbitrary timestamps.
 * When the migration ran, it imported weewx records for a period where live
 * data was already present — resulting in two records per ~5-minute window
 * with different values (most visible as a pressure chart anomaly).
 *
 * Strategy
 * --------
 * 1. Find the earliest "live" record — i.e., the oldest record whose timestamp
 *    is NOT on a 5-minute boundary. Everything from that timestamp onward is
 *    the "overlap zone".
 * 2. Within the overlap zone, delete any record whose timestamp IS on a
 *    5-minute boundary (those are the weewx-migrated records).
 * 3. Leave the historical pre-live weewx records untouched.
 *
 * Run (from project root):
 *   deno task --cwd engine run -A scripts/dedup-observations.ts
 * Or with --dry-run to preview without deleting:
 *   deno task --cwd engine run -A scripts/dedup-observations.ts --dry-run
 */

import { DatabaseSync } from 'node:sqlite';
import { resolve } from '@std/path';
import { config, primaryStation } from '../config.ts';

const SQLITE_PATH = resolve(config.storage.sqlite.path);
const STATION_ID = primaryStation().id;
const DRY_RUN = Deno.args.includes('--dry-run');

console.log('🧹 Zephyr — observation dedup');
console.log(`   SQLite  : ${SQLITE_PATH}`);
console.log(`   Station : ${STATION_ID}`);
console.log(`   Mode    : ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
console.log();

const db = new DatabaseSync(SQLITE_PATH);

// ---------------------------------------------------------------------------
// 1. Diagnostics — count total records and show density in recent 48 hours
// ---------------------------------------------------------------------------

const totalRow = db
  .prepare('SELECT COUNT(*) AS n FROM observations WHERE station_id = ?')
  .get(STATION_ID) as { n: number };
console.log(`📊 Total observations for station '${STATION_ID}': ${totalRow.n}`);

// Find first and last timestamps
const rangeRow = db.prepare(
  'SELECT MIN(timestamp) AS first, MAX(timestamp) AS last FROM observations WHERE station_id = ?',
).get(STATION_ID) as { first: number; last: number };

if (!rangeRow.first) {
  console.log('No records found — nothing to do.');
  db.close();
  Deno.exit(0);
}

console.log(
  `   Range   : ${new Date(rangeRow.first * 1000).toISOString()} → ${new Date(rangeRow.last * 1000).toISOString()}`,
);
console.log();

// ---------------------------------------------------------------------------
// 2. Find the overlap zone — earliest non-5-min-boundary record
//    (these are live push records from the GW1000)
// ---------------------------------------------------------------------------

const firstLiveRow = db.prepare(`
  SELECT MIN(timestamp) AS t
  FROM observations
  WHERE station_id = ?
    AND (timestamp % 300) != 0
`).get(STATION_ID) as { t: number | null };

if (!firstLiveRow.t) {
  console.log('ℹ  No non-boundary records found — all records appear to be from weewx.');
  console.log('   Nothing to deduplicate.');
  db.close();
  Deno.exit(0);
}

const overlapStart = firstLiveRow.t;
console.log(`🔍 Overlap zone starts at: ${new Date(overlapStart * 1000).toISOString()} (epoch ${overlapStart})`);

// Count records in overlap zone
const overlapTotal = db.prepare(`
  SELECT COUNT(*) AS n FROM observations
  WHERE station_id = ? AND timestamp >= ?
`).get(STATION_ID, overlapStart) as { n: number };

const overlapBoundary = db.prepare(`
  SELECT COUNT(*) AS n FROM observations
  WHERE station_id = ? AND timestamp >= ? AND (timestamp % 300) = 0
`).get(STATION_ID, overlapStart) as { n: number };

const overlapLive = db.prepare(`
  SELECT COUNT(*) AS n FROM observations
  WHERE station_id = ? AND timestamp >= ? AND (timestamp % 300) != 0
`).get(STATION_ID, overlapStart) as { n: number };

console.log(`   Records in overlap zone    : ${overlapTotal.n}`);
console.log(`   └─ 5-min boundary (weewx)  : ${overlapBoundary.n}  ← will be deleted`);
console.log(`   └─ non-boundary (live)     : ${overlapLive.n}  ← will be kept`);
console.log();

if (overlapBoundary.n === 0) {
  console.log('✅ No weewx overlap records found — nothing to delete.');
  db.close();
  Deno.exit(0);
}

// ---------------------------------------------------------------------------
// 3. Show a sample of what will be deleted (first 5 rows)
// ---------------------------------------------------------------------------

const samples = db.prepare(`
  SELECT timestamp, temp_outdoor, pressure_rel, humidity_outdoor
  FROM observations
  WHERE station_id = ? AND timestamp >= ? AND (timestamp % 300) = 0
  ORDER BY timestamp ASC
  LIMIT 5
`).all(STATION_ID, overlapStart) as Array<{
  timestamp: number;
  temp_outdoor: number | null;
  pressure_rel: number | null;
  humidity_outdoor: number | null;
}>;

console.log('Sample weewx overlap records (first 5 to be deleted):');
console.log('  timestamp            | temp_out | pressure_rel | humidity_out');
console.log('  ---------------------|----------|--------------|-------------');
for (const r of samples) {
  const dt = new Date(r.timestamp * 1000).toISOString();
  console.log(
    `  ${dt} | ${r.temp_outdoor?.toFixed(1).padStart(8) ?? '    null'} | ${
      r.pressure_rel?.toFixed(1).padStart(12) ?? '        null'
    } | ${r.humidity_outdoor?.toFixed(1).padStart(12) ?? '        null'}`,
  );
}
console.log();

// ---------------------------------------------------------------------------
// 4. Delete (or dry-run)
// ---------------------------------------------------------------------------

if (DRY_RUN) {
  console.log(`🔎 DRY RUN — would delete ${overlapBoundary.n} weewx records from overlap zone.`);
  console.log('   Re-run without --dry-run to apply.');
} else {
  console.log(`🗑  Deleting ${overlapBoundary.n} weewx overlap records...`);
  db.exec('BEGIN');
  try {
    const result = db.prepare(`
      DELETE FROM observations
      WHERE station_id = ? AND timestamp >= ? AND (timestamp % 300) = 0
    `).run(STATION_ID, overlapStart) as { changes: number };
    db.exec('COMMIT');
    console.log(`✅ Deleted ${result.changes} records.`);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  // Post-dedup count
  const afterRow = db
    .prepare('SELECT COUNT(*) AS n FROM observations WHERE station_id = ?')
    .get(STATION_ID) as { n: number };
  console.log(`   Remaining records: ${afterRow.n}`);
}

console.log();
db.close();
