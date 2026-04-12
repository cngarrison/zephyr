import { assertEquals, assertAlmostEquals } from '@std/assert';
import { Units } from '../../src/domain/units.ts';

Deno.test('Units.fToC', async (t) => {
  await t.step('freezing point: 32°F → 0°C', () => assertEquals(Units.fToC(32), 0));
  await t.step('body temp: 98.6°F → 37°C', () => assertAlmostEquals(Units.fToC(98.6), 37.0, 0.01));
  await t.step('boiling: 212°F → 100°C', () => assertEquals(Units.fToC(212), 100));
  await t.step('crossover: -40°F → -40°C', () => assertEquals(Units.fToC(-40), -40));
  await t.step('20°C reference: 68°F → 20°C', () => assertAlmostEquals(Units.fToC(68), 20.0, 0.001));
  await t.step('22°C reference: 71.6°F → 22°C', () => assertAlmostEquals(Units.fToC(71.6), 22.0, 0.001));
});

Deno.test('Units.inHgToHpa', async (t) => {
  await t.step('standard atmosphere: 29.9212 inHg → 1013.25 hPa', () =>
    assertAlmostEquals(Units.inHgToHpa(29.9212), 1013.25, 0.1));
  await t.step('1 inHg → 33.8639 hPa (definition)', () =>
    assertAlmostEquals(Units.inHgToHpa(1), 33.8639, 0.001));
  await t.step('zero is zero', () => assertEquals(Units.inHgToHpa(0), 0));
  await t.step('typical high pressure: 30.5 inHg', () =>
    assertAlmostEquals(Units.inHgToHpa(30.5), 30.5 * 33.8639, 0.01));
});

Deno.test('Units.mphToMs', async (t) => {
  await t.step('1 mph = 0.44704 m/s (exact definition)', () =>
    assertAlmostEquals(Units.mphToMs(1), 0.44704, 0.00001));
  await t.step('11.185 mph → ~5.0 m/s', () =>
    assertAlmostEquals(Units.mphToMs(11.185), 5.0, 0.005));
  await t.step('17.895 mph → ~8.0 m/s', () =>
    assertAlmostEquals(Units.mphToMs(17.895), 8.0, 0.005));
  await t.step('zero is zero', () => assertEquals(Units.mphToMs(0), 0));
  await t.step('60 mph = 26.8224 m/s', () =>
    assertAlmostEquals(Units.mphToMs(60), 26.8224, 0.001));
});

Deno.test('Units.inToMm', async (t) => {
  await t.step('1 inch = 25.4 mm (exact)', () => assertEquals(Units.inToMm(1), 25.4));
  await t.step('0 = 0', () => assertEquals(Units.inToMm(0), 0));
  await t.step('0.157 in → ~3.99 mm', () =>
    assertAlmostEquals(Units.inToMm(0.157), 3.9878, 0.001));
  await t.step('12 in = 304.8 mm (one foot)', () =>
    assertAlmostEquals(Units.inToMm(12), 304.8, 0.001));
});

Deno.test('Units.inHrToMmHr', async (t) => {
  await t.step('1 in/hr = 25.4 mm/hr (same factor as inToMm)', () =>
    assertEquals(Units.inHrToMmHr(1), 25.4));
  await t.step('0.039370 in/hr → ~1.0 mm/hr', () =>
    assertAlmostEquals(Units.inHrToMmHr(0.039370), 1.0, 0.001));
  await t.step('zero is zero', () => assertEquals(Units.inHrToMmHr(0), 0));
});

Deno.test('Units: round-trip consistency', async (t) => {
  await t.step('fToC and manual formula are identical', () => {
    for (const f of [-40, 0, 32, 68, 100, 212]) {
      const expected = (f - 32) * 5 / 9;
      assertAlmostEquals(Units.fToC(f), expected, 0.0001);
    }
  });
  await t.step('inHgToHpa factor is 33.8639', () => {
    for (const v of [1, 10, 29.92, 30.5]) {
      assertAlmostEquals(Units.inHgToHpa(v), v * 33.8639, 0.001);
    }
  });
  await t.step('mphToMs factor is 0.44704', () => {
    for (const v of [1, 10, 60, 100]) {
      assertAlmostEquals(Units.mphToMs(v), v * 0.44704, 0.001);
    }
  });
});
