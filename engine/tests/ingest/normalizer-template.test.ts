/**
 * normalizer-template.test.ts
 *
 * HOW TO USE THIS FILE
 * ====================
 * When you add a new ingest driver (e.g. normalizeAcurite, normalizeNetatmo),
 * COPY this file to normalizer-<yourdriver>.test.ts and adapt it.
 *
 * This file tests the WU normalizer as the canonical reference implementation.
 * Reading it teaches you:
 *
 *   1. The contract every normalizer MUST satisfy (timestamp, stationId, SI units)
 *   2. How to structure normalizer tests
 *   3. Which edge cases to always cover
 *   4. Why each assertion exists and what production failure it prevents
 *
 * ARCHITECTURE NOTE: Why do normalizers matter?
 * The normalizer is the ONLY place where protocol-specific field names and
 * imperial units are converted to Zephyr's canonical SI Observation. If this
 * layer is wrong, every piece of stored data is wrong — silently, permanently.
 * Tests here are your last line of defence before bad data hits the database.
 *
 * CHECKLIST for a new normalizer:
 *   [ ] timestamp uses Date.now() (server receive time)
 *   [ ] stationId uses the configured defaultStationId arg
 *   [ ] all temperatures are in °C
 *   [ ] all wind speeds are in m/s
 *   [ ] all rain values are in mm (rates in mm/hr)
 *   [ ] all pressures are in hPa
 *   [ ] missing/empty fields produce undefined, not NaN or 0
 *   [ ] extended sensors go in the readings array, not the Observation
 *   [ ] readings have correct stationId and server timestamp
 */

import { assertAlmostEquals, assertEquals, assertExists, assertStrictEquals } from '@std/assert';
import { normalizeWu } from '../../src/ingest/normalizer.ts';
import { makeWuPayload } from '@zephyr/shared/testing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// How close a computed timestamp must be to 'now' (in seconds).
// We allow 2 s to account for test runner startup and parallel execution.
const TIMESTAMP_TOLERANCE_S = 2;

// The station ID our tests always use — must match what we pass to normalizeWu.
const TEST_STATION = 'test-station';

// ---------------------------------------------------------------------------
// Section 1: Timestamp contract
//
// CONTRACT: The observation timestamp MUST be the server receive time,
// not the value reported by the device (dateutc field).
//
// WHY THIS MATTERS:
// GW-series devices send their local clock time in 'dateutc', regardless of
// the station's timezone configuration. This means dateutc is often wrong by
// hours (or more if the device clock drifts). If we used it:
//   - Observations would appear in the database at the wrong UTC time
//   - Range queries (from/to) would return wrong results
//   - The /history heatmap would show data on the wrong day
//   - Multiple stations in different timezones would be inconsistent
//
// HOW WE VERIFY:
// We pass a clearly-past dateutc value, then check the returned timestamp
// is close to Date.now() and NOT close to the device dateutc epoch.
// ---------------------------------------------------------------------------

Deno.test('timestamp: uses server receive time, not device dateutc', async (t) => {
  // The payload contains a dateutc value that is clearly in the past
  // (2024-06-15 10:30:00 UTC = epoch 1718447400).
  // The normalizer MUST ignore it and use Math.floor(Date.now() / 1000) instead.
  const payload = makeWuPayload({ dateutc: '2024-06-15 10:30:00' });
  const beforeCall = Math.floor(Date.now() / 1000);
  const { observation } = normalizeWu(payload, TEST_STATION);
  const _afterCall = Math.floor(Date.now() / 1000);

  await t.step('timestamp is close to now', () => {
    // The observation timestamp must fall within [beforeCall, afterCall + tolerance].
    // If this fails, the normalizer is using the device clock instead of the server clock.
    const diff = Math.abs(observation.timestamp - beforeCall);
    assertEquals(
      diff <= TIMESTAMP_TOLERANCE_S,
      true,
      `Expected timestamp within ${TIMESTAMP_TOLERANCE_S}s of now (got diff=${diff}s). ` +
        'Is the normalizer using Date.now() for the timestamp?',
    );
  });

  await t.step('timestamp is NOT the device dateutc value', () => {
    // epoch 1718447400 = 2024-06-15 10:30:00 UTC (the value in dateutc)
    const deviceEpoch = 1718447400;
    const diff = Math.abs(observation.timestamp - deviceEpoch);
    assertEquals(
      diff > 60,
      true,
      'Timestamp appears to match dateutc — normalizer MUST use server receive time.',
    );
  });
});

// ---------------------------------------------------------------------------
// Section 2: Station identity contract
//
// CONTRACT: observation.stationId MUST equal the defaultStationId argument,
// never the device push ID (params.ID / params.PASSKEY).
//
// WHY THIS MATTERS:
// The device push ID (e.g. 'KXXXXXX1') is a hardware registration identifier.
// Zephyr's station identity is configured by the operator in zephyr.toml.
// If we used the device ID:
//   - Data would be stored under the hardware ID, breaking existing queries
//   - Different hardware for the same station would create two separate series
//   - The web UI would show 'KXXXXXX1' instead of the configured station name
//   - Replacing a broken device would orphan all historical data
// ---------------------------------------------------------------------------

Deno.test('stationId: uses configured station, not device push ID', async (t) => {
  const devicePushId = 'DEVICE_HARDWARE_ID_123';
  const configuredStation = 'My Weather Station';

  const payload = makeWuPayload({ ID: devicePushId });
  const { observation } = normalizeWu(payload, configuredStation);

  await t.step('stationId equals configured defaultStationId', () => {
    assertStrictEquals(observation.stationId, configuredStation);
  });

  await t.step('stationId does NOT equal the device push ID', () => {
    assertEquals(
      observation.stationId === devicePushId,
      false,
      'stationId must be the operator-configured name, not the device hardware ID.',
    );
  });
});

// ---------------------------------------------------------------------------
// Section 3: Temperature unit contract
//
// CONTRACT: All temperatures in the Observation MUST be in °C.
//
// WHY THIS MATTERS:
// The database stores values without unit metadata. If even one temperature
// value is stored in °F, every downstream consumer (API, charts, export,
// alerts) will silently show wrong values. The °F→°C conversion MUST happen
// in the normalizer, and ONLY in the normalizer.
//
// HOW WE VERIFY:
// We send a known °F value and assert the °C result within floating-point
// tolerance. We also assert it is NOT the original °F value.
//
// FORMULA: °C = (°F - 32) × 5/9
//   68°F = (68-32) × 5/9 = 36 × 5/9 = 20.0°C exactly
//   71.6°F = (71.6-32) × 5/9 = 39.6 × 5/9 = 22.0°C exactly
// ---------------------------------------------------------------------------

Deno.test('temperature: converted from °F to °C', async (t) => {
  const payload = makeWuPayload({ tempf: '68.0', tempinf: '71.6' });
  const { observation } = normalizeWu(payload, TEST_STATION);

  await t.step('tempOutdoor is 20°C (was 68°F)', () => {
    assertExists(observation.tempOutdoor);
    assertAlmostEquals(observation.tempOutdoor!, 20.0, 0.01);
  });

  await t.step('tempOutdoor is NOT stored as °F', () => {
    // If this assertion fails, the normalizer forgot to call Units.fToC.
    // 68 would indicate the raw °F value was stored directly.
    assertEquals(
      Math.abs(observation.tempOutdoor! - 68.0) > 1,
      true,
      'tempOutdoor looks like it is still in °F — Units.fToC not applied?',
    );
  });

  await t.step('tempIndoor is 22°C (was 71.6°F)', () => {
    assertExists(observation.tempIndoor);
    assertAlmostEquals(observation.tempIndoor!, 22.0, 0.01);
  });
});

// ---------------------------------------------------------------------------
// Section 4: Wind speed unit contract
//
// CONTRACT: windSpeed and windGust MUST be in m/s.
//
// WHY THIS MATTERS:
// m/s is the SI unit. Beaufort scale computations, alerts, and API consumers
// all expect m/s. Storing mph would make calm winds appear as light breezes
// and storm-force winds appear as hurricanes in any system expecting m/s.
//
// CONVERSION FACTOR: 1 mph = 0.44704 m/s exactly (NIST definition).
//   11.185 mph × 0.44704 = ~5.000 m/s
//   17.895 mph × 0.44704 = ~8.001 m/s
// ---------------------------------------------------------------------------

Deno.test('wind: converted from mph to m/s', async (t) => {
  const payload = makeWuPayload({ windspeedmph: '11.185', windgustmph: '17.895' });
  const { observation } = normalizeWu(payload, TEST_STATION);

  await t.step('windSpeed is ~5.0 m/s (was 11.185 mph)', () => {
    assertExists(observation.windSpeed);
    assertAlmostEquals(observation.windSpeed!, 5.0, 0.01);
  });

  await t.step('windSpeed is NOT stored as mph', () => {
    assertEquals(
      Math.abs(observation.windSpeed! - 11.185) > 1,
      true,
      'windSpeed looks like raw mph — Units.mphToMs not applied?',
    );
  });

  await t.step('windGust is ~8.0 m/s (was 17.895 mph)', () => {
    assertExists(observation.windGust);
    assertAlmostEquals(observation.windGust!, 8.0, 0.02);
  });

  await t.step('windDirection is passed through unchanged (degrees need no conversion)', () => {
    // winddir is already in degrees 0–360; no conversion needed
    assertExists(observation.windDirection);
    assertEquals(observation.windDirection, 180);
  });
});

// ---------------------------------------------------------------------------
// Section 5: Rain unit contract
//
// CONTRACT: all rain values MUST be in mm (rate in mm/hr).
//
// WHY THIS MATTERS:
// Global weather data standards use mm. WU devices report in inches.
// 1 inch = 25.4 mm exactly (definition). Storing raw inches would show
// 1 mm of rain as 0.039 mm — indistinguishable from no rain.
//
// CONVERSION:
//   rainratein: 0.039370 in/hr × 25.4 = ~1.0 mm/hr
//   dailyrainin: 0.157 in × 25.4 = 3.9878 mm ≈ 3.99 mm
// ---------------------------------------------------------------------------

Deno.test('rain: converted from inches to mm', async (t) => {
  const payload = makeWuPayload({
    rainratein: '0.039370',
    dailyrainin: '0.157',
  });
  const { observation } = normalizeWu(payload, TEST_STATION);

  await t.step('rainRate is ~1.0 mm/hr (was 0.039 in/hr)', () => {
    assertExists(observation.rainRate);
    assertAlmostEquals(observation.rainRate!, 1.0, 0.01);
  });

  await t.step('rainDaily is ~3.99 mm (was 0.157 in)', () => {
    assertExists(observation.rainDaily);
    assertAlmostEquals(observation.rainDaily!, 3.99, 0.01);
  });
});

// ---------------------------------------------------------------------------
// Section 6: Pressure unit contract
//
// CONTRACT: pressure MUST be in hPa (hectopascals).
//
// WHY THIS MATTERS:
// Meteorological convention worldwide uses hPa. WU devices report in inHg.
// 29.92 inHg ≈ 1013.25 hPa (standard atmosphere).
// 1 inHg = 33.8639 hPa (exact conversion factor used by Units.inHgToHpa).
//
// Storing inHg as-is would make 1013 hPa appear as 29.9 hPa, causing the
// pressure chart to look like it's measuring vacuum rather than weather.
// ---------------------------------------------------------------------------

Deno.test('pressure: converted from inHg to hPa', async (t) => {
  const payload = makeWuPayload({ baromin: '29.9212', baromrelin: '30.0124' });
  const { observation } = normalizeWu(payload, TEST_STATION);

  await t.step('pressureAbsolute is ~1013.25 hPa', () => {
    assertExists(observation.pressureAbsolute);
    assertAlmostEquals(observation.pressureAbsolute!, 1013.25, 0.5);
  });

  await t.step('pressureAbsolute is NOT in inHg (would be ~29.9)', () => {
    // If pressure is stored as inHg, it will be ~29.9 instead of ~1013
    assertEquals(
      observation.pressureAbsolute! > 100,
      true,
      'pressureAbsolute looks like inHg (< 100) — Units.inHgToHpa not applied?',
    );
  });

  await t.step('pressureRelative is also in hPa', () => {
    assertExists(observation.pressureRelative);
    assertEquals(observation.pressureRelative! > 100, true);
  });
});

// ---------------------------------------------------------------------------
// Section 7: Dew point calculation
//
// CONTRACT: When dewptf is absent, dew point is calculated via the Magnus
// formula from tempf + humidity. When dewptf IS present, that value is used
// (converted to °C). It should never be undefined when temp and humidity exist.
//
// WHY THIS MATTERS:
// Dew point is a critical comfort and safety metric. If it's always undefined,
// the ConditionsGrid will show '—' for dew point even when data is available.
// The Magnus formula gives a good approximation; a device-provided value is
// always preferred if available (may be calculated with calibration data).
//
// Magnus formula:
//   γ = ln(RH/100) + (a × T) / (b + T)
//   Td = (b × γ) / (a - γ)
// where a=17.625, b=243.04, T in °C, RH in 0–100.
// At 20°C, 50% RH: Td ≈ 9.27°C
// ---------------------------------------------------------------------------

Deno.test('dewpoint: calculated from temp+humidity when not provided', async (t) => {
  const payload = makeWuPayload({ tempf: '68.0', humidity: '50' });
  delete payload.dewptf;
  const { observation } = normalizeWu(payload, TEST_STATION);

  await t.step('tempDewpoint is defined', () => assertExists(observation.tempDewpoint));
  await t.step('tempDewpoint is approximately 9.27°C (Magnus formula)', () => {
    assertAlmostEquals(observation.tempDewpoint!, 9.27, 0.1);
  });
  await t.step('tempDewpoint is NOT in °F', () => {
    // 9.27°C in °F would be ~48.7°F — if we see ~48, the formula output wasn't converted
    assertEquals(observation.tempDewpoint! < 30, true, 'tempDewpoint looks like °F');
  });
});

Deno.test('dewpoint: uses provided dewptf value when present', async (t) => {
  // 50°F = 10°C exactly: (50 - 32) × 5/9 = 18 × 5/9 = 10°C
  const payload = makeWuPayload({ dewptf: '50.0' });
  const { observation } = normalizeWu(payload, TEST_STATION);

  await t.step('tempDewpoint is 10°C (was 50°F)', () => {
    assertExists(observation.tempDewpoint);
    assertAlmostEquals(observation.tempDewpoint!, 10.0, 0.01);
  });
});

// ---------------------------------------------------------------------------
// Section 8: Missing / empty field handling
//
// CONTRACT: Missing optional fields produce undefined, not NaN or 0.
//
// WHY THIS MATTERS:
// NaN stored in the database causes silent corruption in aggregate queries
// (AVG/MIN/MAX of a column with NaN behave unexpectedly in some drivers).
// undefined causes the field to be omitted from the INSERT, leaving it NULL
// in the DB. NULL is the correct 'not available' representation.
// A 0 would be worse than NaN — it looks like valid zero rain or zero wind.
//
// HOW WE VERIFY:
// We pass a minimal payload (no sensor fields) and a payload with empty
// strings (which some firmware versions send for missing sensors).
// We then scan all numeric fields for NaN.
// ---------------------------------------------------------------------------

Deno.test('missing fields: produce undefined, not NaN', async (t) => {
  // A minimal payload with only the required identity fields
  const payload: Record<string, string | undefined> = { ID: 'DEVICE1' };
  const { observation } = normalizeWu(payload, TEST_STATION);

  await t.step('tempOutdoor is undefined when tempf absent', () => {
    assertEquals(observation.tempOutdoor, undefined);
  });

  await t.step('windSpeed is undefined when windspeedmph absent', () => {
    assertEquals(observation.windSpeed, undefined);
  });

  await t.step('rainRate is undefined when rainratein absent', () => {
    assertEquals(observation.rainRate, undefined);
  });

  await t.step('no NaN values anywhere in observation', () => {
    for (const [key, value] of Object.entries(observation)) {
      if (typeof value === 'number') {
        assertEquals(
          isNaN(value),
          false,
          `observation.${key} is NaN — check the n() helper for this field`,
        );
      }
    }
  });
});

Deno.test('empty string fields: produce undefined, not NaN', async (t) => {
  // Empty strings can arrive from buggy firmware or missing sensors
  const payload = makeWuPayload({ tempf: '', windspeedmph: '', rainratein: '' });
  const { observation } = normalizeWu(payload, TEST_STATION);

  await t.step('tempOutdoor is undefined when tempf is empty string', () => {
    assertEquals(observation.tempOutdoor, undefined);
  });

  await t.step('windSpeed is undefined when windspeedmph is empty string', () => {
    assertEquals(observation.windSpeed, undefined);
  });

  await t.step('rainRate is undefined when rainratein is empty string', () => {
    assertEquals(observation.rainRate, undefined);
  });

  await t.step('no NaN values in observation with empty strings', () => {
    for (const [key, value] of Object.entries(observation)) {
      if (typeof value === 'number') {
        assertEquals(isNaN(value), false, `observation.${key} is NaN`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Section 9: Piezo rain gauge preference
//
// CONTRACT: Piezo (rrain_piezo etc.) fields are preferred over standard
// tipping-bucket fields when both are present.
//
// WHY THIS MATTERS:
// The GW2000 / WS90 uses a piezoelectric rain sensor alongside an optional
// tipping-bucket. The piezo sensor is more accurate (no moving parts, higher
// resolution, doesn't miss light rain or get stuck). When both field sets are
// present, the piezo values should win. When only standard fields exist (older
// devices), those are used as fallback.
//
// TEST DESIGN:
// We set the piezo value to 2× the standard value so any error is detectable.
// piezo rainrate: 0.200 in/hr → 5.08 mm/hr
// standard rainrate: 0.100 in/hr → 2.54 mm/hr
// ---------------------------------------------------------------------------

Deno.test('rain: piezo fields preferred over standard fields', async (t) => {
  const payload = makeWuPayload({
    rainratein: '0.100', // standard: 2.54 mm/hr
    rrain_piezo: '0.200', // piezo: 5.08 mm/hr  ← should win
    dailyrainin: '1.000', // standard: 25.4 mm
    drain_piezo: '0.500', // piezo: 12.7 mm  ← should win
  });
  const { observation } = normalizeWu(payload, TEST_STATION);

  await t.step('rainRate uses piezo value (5.08 mm/hr)', () => {
    assertExists(observation.rainRate);
    assertAlmostEquals(observation.rainRate!, 5.08, 0.01);
  });

  await t.step('rainRate does NOT use standard value (2.54 mm/hr)', () => {
    assertEquals(
      Math.abs(observation.rainRate! - 2.54) > 0.5,
      true,
      'rainRate is using the standard field, not piezo — check piezo ?? fallback logic',
    );
  });

  await t.step('rainDaily uses piezo value (12.7 mm)', () => {
    assertExists(observation.rainDaily);
    assertAlmostEquals(observation.rainDaily!, 12.7, 0.01);
  });
});

// ---------------------------------------------------------------------------
// Section 10: Extended sensor readings (SensorReading[])
//
// CONTRACT: Soil, extra temperature, leaf wetness, and lightning values
// MUST appear in the readings array, NOT in the primary Observation.
//
// WHY THIS MATTERS:
// The Observation interface has a fixed schema (universal sensors). Extended
// sensors vary by hardware configuration — storing them in a fixed schema
// would require schema migrations for every new sensor channel.
// The readings table has an open schema: (stationId, sensorId, timestamp, value).
// This lets users add any sensor channel without a migration.
//
// sensorId naming convention (dot-notation):
//   'soil.moisture.1' — channel 1
//   'soil.temp.1'     — soil temp channel 1 (in °C, even though soiltemp1f is °F)
//   'lightning.count' — strike count
//   'lightning.distance_km' — estimated distance in km
// ---------------------------------------------------------------------------

Deno.test('readings: extended sensors appear in readings array', async (t) => {
  const payload = makeWuPayload({
    soilmoisture1: '42',
    soiltemp1f: '64.4', // 18°C exactly: (64.4 - 32) × 5/9 = 18°C
    lightning_num: '3',
    lightning: '12', // km
  });
  const { readings } = normalizeWu(payload, TEST_STATION);

  const readingMap = Object.fromEntries(readings.map((r) => [r.sensorId, r.value]));

  await t.step('soil.moisture.1 reading present', () => {
    assertEquals(readingMap['soil.moisture.1'], 42);
  });

  await t.step('soil.temp.1 reading present and in °C (not °F)', () => {
    // 64.4°F = 18°C. If stored as °F, it would be 64.4.
    assertExists(readingMap['soil.temp.1']);
    assertAlmostEquals(readingMap['soil.temp.1'], 18.0, 0.1);
  });

  await t.step('lightning.count reading present', () => {
    assertEquals(readingMap['lightning.count'], 3);
  });

  await t.step('lightning.distance_km reading present', () => {
    assertEquals(readingMap['lightning.distance_km'], 12);
  });

  await t.step('all readings have correct stationId', () => {
    for (const r of readings) {
      assertStrictEquals(r.stationId, TEST_STATION);
    }
  });

  await t.step('all readings have valid server timestamps', () => {
    const now = Math.floor(Date.now() / 1000);
    for (const r of readings) {
      assertEquals(
        Math.abs(r.timestamp - now) <= TIMESTAMP_TOLERANCE_S,
        true,
        `reading ${r.sensorId} has stale timestamp`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Section 11: Integration / round-trip — using real fixture file
//
// This test loads the committed JSON fixture (engine/tests/fixtures/wu-payload.json)
// and verifies the FULL normalizeWu output. It is the regression guard: if the
// fixture reflects real hardware output and this test passes, the normalizer
// works for real-world payloads.
//
// The fixture (wu-payload.json) represents a real GW2000 push payload including
// extra fields (soilmoisture1, soiltemp1f, lightning_num, lightning, batt1).
//
// HOW TO UPDATE THIS TEST when you add a new fixture field:
//   1. Update engine/tests/fixtures/wu-payload.json with the new field
//   2. Add an assertion below for the new field
//   3. Run: deno task --cwd engine test
//   4. If the test fails, fix the normalizer. If it passes, commit both.
//
// IMPORTANT: The fixture file MUST use real-world field names and values
// from your actual device. If you make up values, you may miss mapping bugs.
// ---------------------------------------------------------------------------

Deno.test('integration: normalizes real WU fixture file correctly', async (t) => {
  const fixtureText = await Deno.readTextFile(
    new URL('../fixtures/wu-payload.json', import.meta.url),
  );
  const payload = JSON.parse(fixtureText) as Record<string, string | undefined>;

  const before = Math.floor(Date.now() / 1000);
  const { observation, readings } = normalizeWu(payload, 'integration-test-station');

  await t.step('timestamp is recent (server time, not dateutc)', () => {
    assertEquals(Math.abs(observation.timestamp - before) <= TIMESTAMP_TOLERANCE_S, true);
  });

  await t.step('stationId is the configured value', () => {
    assertStrictEquals(observation.stationId, 'integration-test-station');
  });

  await t.step('has outdoor temperature in plausible °C range (not °F)', () => {
    assertExists(observation.tempOutdoor);
    // 68°F = 20°C. We check it's < 50 (which would indicate °F not converted)
    assertEquals(observation.tempOutdoor! < 50, true, 'Temperature looks like °F, not °C');
    assertEquals(observation.tempOutdoor! > -50, true, 'Temperature unrealistically cold');
  });

  await t.step('has wind speed in plausible m/s range (not mph)', () => {
    assertExists(observation.windSpeed);
    // 11.185 mph = 5 m/s. If stored as mph, we'd see 11.185 here.
    assertEquals(observation.windSpeed! < 30, true, 'Wind speed looks like mph, not m/s');
  });

  await t.step('has pressure in hPa range (not inHg)', () => {
    assertExists(observation.pressureAbsolute);
    assertEquals(observation.pressureAbsolute! > 900, true, 'Pressure looks like inHg, not hPa');
  });

  await t.step('has UV index', () => {
    assertEquals(observation.uvIndex, 3);
  });

  await t.step('readings array is non-empty (fixture has soil + lightning fields)', () => {
    // The fixture includes soilmoisture1, soiltemp1f, lightning_num, lightning, batt1
    assertEquals(readings.length > 0, true);
  });

  await t.step('soil moisture reading is present', () => {
    const soil = readings.find((r) => r.sensorId === 'soil.moisture.1');
    assertExists(soil);
    assertEquals(soil!.value, 42);
  });

  await t.step('soil temp reading is in °C', () => {
    // soiltemp1f = '64.4' → 18°C
    const soilTemp = readings.find((r) => r.sensorId === 'soil.temp.1');
    assertExists(soilTemp);
    assertAlmostEquals(soilTemp!.value, 18.0, 0.1);
  });
});
