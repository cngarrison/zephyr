import { assertAlmostEquals, assertEquals, assertExists } from '@std/assert';
import { normalizeEcowitt } from '../../src/ingest/normalizer.ts';
import { makeEcowittPayload } from '@zephyr/shared/testing';

const TS_TOLERANCE = 2;
const STATION = 'test-station';

Deno.test('ecowitt: timestamp is server time, not dateutc', () => {
  const payload = makeEcowittPayload({ dateutc: '2020-01-01 00:00:00' });
  const before = Math.floor(Date.now() / 1000);
  const { observation } = normalizeEcowitt(payload, STATION);
  assertEquals(Math.abs(observation.timestamp - before) <= TS_TOLERANCE, true);
});

Deno.test('ecowitt: stationId uses configured station, not PASSKEY', () => {
  const payload = makeEcowittPayload({ PASSKEY: 'HARDWARE_PASSKEY_ABC' });
  const { observation } = normalizeEcowitt(payload, 'my-station');
  assertEquals(observation.stationId, 'my-station');
  assertEquals(observation.stationId === 'HARDWARE_PASSKEY_ABC', false);
});

Deno.test('ecowitt: baromabsin maps to pressureAbsolute (not baromin)', () => {
  // Ecowitt uses baromabsin/baromrelin instead of WU baromin/baromrelin
  const payload = makeEcowittPayload({ baromabsin: '29.9212', baromrelin: '30.0124' });
  const { observation } = normalizeEcowitt(payload, STATION);
  assertExists(observation.pressureAbsolute);
  assertAlmostEquals(observation.pressureAbsolute!, 1013.25, 0.5);
  assertExists(observation.pressureRelative);
});

Deno.test('ecowitt: uv (lowercase) maps to uvIndex', () => {
  // Ecowitt sends 'uv' (lowercase); WU sends 'UV' (uppercase)
  const payload = makeEcowittPayload({ uv: '5' });
  const { observation } = normalizeEcowitt(payload, STATION);
  assertEquals(observation.uvIndex, 5);
});

Deno.test('ecowitt: temperature converted from °F to °C', () => {
  const payload = makeEcowittPayload({ tempf: '68.0', tempinf: '71.6' });
  const { observation } = normalizeEcowitt(payload, STATION);
  assertExists(observation.tempOutdoor);
  assertAlmostEquals(observation.tempOutdoor!, 20.0, 0.01);
  assertExists(observation.tempIndoor);
  assertAlmostEquals(observation.tempIndoor!, 22.0, 0.01);
});

Deno.test('ecowitt: wind converted from mph to m/s', () => {
  const payload = makeEcowittPayload({ windspeedmph: '11.185', windgustmph: '17.895' });
  const { observation } = normalizeEcowitt(payload, STATION);
  assertAlmostEquals(observation.windSpeed!, 5.0, 0.01);
  assertAlmostEquals(observation.windGust!, 8.0, 0.02);
});

Deno.test('ecowitt: lightning fields map to readings', () => {
  const payload = makeEcowittPayload({ lightning_num: '3', lightning: '12' });
  const { readings } = normalizeEcowitt(payload, STATION);
  const byId = Object.fromEntries(readings.map((r) => [r.sensorId, r.value]));
  assertEquals(byId['lightning.count'], 3);
  assertEquals(byId['lightning.distance_km'], 12);
});

Deno.test('ecowitt: missing optional fields produce undefined not NaN', () => {
  const payload: Record<string, string | undefined> = { PASSKEY: 'X' };
  const { observation } = normalizeEcowitt(payload, STATION);
  for (const [key, value] of Object.entries(observation)) {
    if (typeof value === 'number') {
      assertEquals(isNaN(value), false, `observation.${key} is NaN`);
    }
  }
});

Deno.test('ecowitt: integration with real fixture file', async () => {
  const text = await Deno.readTextFile(
    new URL('../fixtures/ecowitt-payload.json', import.meta.url),
  );
  const payload = JSON.parse(text) as Record<string, string | undefined>;
  const before = Math.floor(Date.now() / 1000);
  const { observation, readings } = normalizeEcowitt(payload, 'integration-station');

  assertEquals(Math.abs(observation.timestamp - before) <= TS_TOLERANCE, true);
  assertEquals(observation.stationId, 'integration-station');
  assertExists(observation.tempOutdoor);
  assertEquals(observation.tempOutdoor! < 50, true, 'temp looks like °F');
  assertExists(observation.windSpeed);
  assertEquals(observation.windSpeed! < 30, true, 'wind looks like mph');
  assertEquals(readings.length > 0, true);
});
