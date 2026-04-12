import { assertAlmostEquals, assertEquals, assertExists } from '@std/assert';
import { normalizeWu } from '../../src/ingest/normalizer.ts';
import { BASE_TIMESTAMP, makeWuPayload } from '@zephyr/shared/testing';

const TS_TOLERANCE = 2; // seconds
const STATION = 'test-station';

Deno.test('wu: timestamp is server time, not dateutc', () => {
  const payload = makeWuPayload({ dateutc: '2020-01-01 00:00:00' });
  const before = Math.floor(Date.now() / 1000);
  const { observation } = normalizeWu(payload, STATION);
  assertEquals(Math.abs(observation.timestamp - before) <= TS_TOLERANCE, true);
  // dateutc epoch = 2020-01-01 00:00:00 UTC ~ 1577836800
  assertEquals(Math.abs(observation.timestamp - 1577836800) > 60, true);
});

Deno.test('wu: stationId uses configured station, not device ID', () => {
  const payload = makeWuPayload({ ID: 'DEVICE_HW_ID' });
  const { observation } = normalizeWu(payload, 'my-configured-station');
  assertEquals(observation.stationId, 'my-configured-station');
  assertEquals(observation.stationId === 'DEVICE_HW_ID', false);
});

Deno.test('wu: temperature converted from °F to °C', () => {
  const payload = makeWuPayload({ tempf: '68.0', tempinf: '71.6' });
  const { observation } = normalizeWu(payload, STATION);
  assertExists(observation.tempOutdoor);
  assertAlmostEquals(observation.tempOutdoor!, 20.0, 0.01);
  assertExists(observation.tempIndoor);
  assertAlmostEquals(observation.tempIndoor!, 22.0, 0.01);
  // Must NOT be in °F
  assertEquals(Math.abs(observation.tempOutdoor! - 68.0) > 1, true);
});

Deno.test('wu: wind converted from mph to m/s', () => {
  const payload = makeWuPayload({ windspeedmph: '11.185', windgustmph: '17.895' });
  const { observation } = normalizeWu(payload, STATION);
  assertExists(observation.windSpeed);
  assertAlmostEquals(observation.windSpeed!, 5.0, 0.01);
  assertExists(observation.windGust);
  assertAlmostEquals(observation.windGust!, 8.0, 0.02);
});

Deno.test('wu: rain converted from inches to mm', () => {
  const payload = makeWuPayload({ rainratein: '0.039370', dailyrainin: '0.157' });
  const { observation } = normalizeWu(payload, STATION);
  assertExists(observation.rainRate);
  assertAlmostEquals(observation.rainRate!, 1.0, 0.01);
  assertExists(observation.rainDaily);
  assertAlmostEquals(observation.rainDaily!, 3.99, 0.01);
});

Deno.test('wu: pressure converted from inHg to hPa', () => {
  const payload = makeWuPayload({ baromin: '29.9212', baromrelin: '30.0124' });
  const { observation } = normalizeWu(payload, STATION);
  assertExists(observation.pressureAbsolute);
  assertAlmostEquals(observation.pressureAbsolute!, 1013.25, 0.5);
});

Deno.test('wu: missing fields produce undefined not NaN', () => {
  const payload: Record<string, string | undefined> = { ID: 'DEVICE1' };
  const { observation } = normalizeWu(payload, STATION);
  assertEquals(observation.tempOutdoor, undefined);
  assertEquals(observation.windSpeed, undefined);
  for (const [key, value] of Object.entries(observation)) {
    if (typeof value === 'number') {
      assertEquals(isNaN(value), false, `observation.${key} is NaN`);
    }
  }
});

Deno.test('wu: empty string fields produce undefined not NaN', () => {
  const payload = makeWuPayload({ tempf: '', windspeedmph: '' });
  const { observation } = normalizeWu(payload, STATION);
  assertEquals(observation.tempOutdoor, undefined);
  assertEquals(observation.windSpeed, undefined);
});

Deno.test('wu: piezo fields preferred over standard rain', () => {
  const payload = makeWuPayload({
    rainratein: '0.100',
    rrain_piezo: '0.200',
    dailyrainin: '1.000',
    drain_piezo: '0.500',
  });
  const { observation } = normalizeWu(payload, STATION);
  assertAlmostEquals(observation.rainRate!, 5.08, 0.01);
  assertAlmostEquals(observation.rainDaily!, 12.7, 0.01);
});

Deno.test('wu: extended sensors appear in readings array', () => {
  const payload = makeWuPayload({
    soilmoisture1: '42',
    soiltemp1f: '64.4',
    lightning_num: '3',
    lightning: '12',
  });
  const { readings } = normalizeWu(payload, STATION);
  const byId = Object.fromEntries(readings.map((r) => [r.sensorId, r.value]));
  assertEquals(byId['soil.moisture.1'], 42);
  assertAlmostEquals(byId['soil.temp.1'], 18.0, 0.1);
  assertEquals(byId['lightning.count'], 3);
  assertEquals(byId['lightning.distance_km'], 12);
});

Deno.test('wu: dewpoint calculated when not provided', () => {
  const payload = makeWuPayload({ tempf: '68.0', humidity: '50' });
  delete payload.dewptf;
  const { observation } = normalizeWu(payload, STATION);
  assertExists(observation.tempDewpoint);
  assertAlmostEquals(observation.tempDewpoint!, 9.27, 0.1);
});

Deno.test('wu: dewptf used when provided', () => {
  const payload = makeWuPayload({ dewptf: '50.0' });
  const { observation } = normalizeWu(payload, STATION);
  assertExists(observation.tempDewpoint);
  assertAlmostEquals(observation.tempDewpoint!, 10.0, 0.01);
});

Deno.test('wu: all readings have correct stationId and valid timestamps', () => {
  const payload = makeWuPayload({ soilmoisture1: '42', lightning_num: '5' });
  const before = Math.floor(Date.now() / 1000);
  const { readings } = normalizeWu(payload, STATION);
  for (const r of readings) {
    assertEquals(r.stationId, STATION);
    assertEquals(Math.abs(r.timestamp - before) <= TS_TOLERANCE, true);
  }
});
