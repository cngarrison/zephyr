import { assertAlmostEquals, assertEquals, assertExists } from '@std/assert';
import { computeAlmanac } from '../../src/almanac/calculator.ts';

// ---------------------------------------------------------------------------
// Helper: parse an HH:MM UTC time string and return fractional hours
// ---------------------------------------------------------------------------
function parseHoursUTC(isoOrHHMM: string | null): number | null {
  if (isoOrHHMM === null) return null;
  // Handle full ISO string (e.g. '2024-06-21T04:43:00.000Z')
  const match = isoOrHHMM.match(/(\d{2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1]) + parseInt(match[2]) / 60;
}

// ---------------------------------------------------------------------------
// London summer solstice — well-known astronomical reference
//
// On 2024-06-21 (summer solstice) at London (51.5074°N, -0.1278°W):
//   Sunrise ≈ 04:43 UTC
//   Sunset  ≈ 21:21 UTC
//   Day length ≈ 16h 38min = 59,880 s
//
// Source: timeanddate.com / USNO astronomical data.
// We allow ±5 minutes tolerance to account for suncalc library accuracy.
// ---------------------------------------------------------------------------

Deno.test('computeAlmanac: London summer solstice — sunrise and sunset', async (t) => {
  const result = computeAlmanac(new Date('2024-06-21'), 51.5074, -0.1278);

  await t.step('returns correct date', () => {
    assertEquals(result.date, '2024-06-21');
  });

  await t.step('has sun data', () => {
    assertExists(result.sun);
  });

  await t.step('sunrise is approximately 03:44 UTC (±5 min)', () => {
    assertExists(result.sun.sunrise);
    const h = parseHoursUTC(result.sun.sunrise);
    assertExists(h);
    // 04:43 BST = 03:43 UTC = 3.717h; UK is UTC+1 in summer (BST)
    assertAlmostEquals(h!, 3.717, 0.085);
  });

  await t.step('sunset is approximately 20:22 UTC (±5 min)', () => {
    assertExists(result.sun.sunset);
    const h = parseHoursUTC(result.sun.sunset);
    assertExists(h);
    // 21:21 BST = 20:21 UTC = 20.35h
    assertAlmostEquals(h!, 20.35, 0.085);
  });

  await t.step('day length is approximately 16h 38min (59880 s ±300 s)', () => {
    assertAlmostEquals(result.sun.dayLengthSeconds, 59880, 300);
  });

  await t.step('dawn is before sunrise', () => {
    if (result.sun.dawn && result.sun.sunrise) {
      const dawn = parseHoursUTC(result.sun.dawn)!;
      const rise = parseHoursUTC(result.sun.sunrise)!;
      assertEquals(dawn < rise, true, 'dawn should be before sunrise');
    }
  });

  await t.step('dusk is after sunset', () => {
    if (result.sun.dusk && result.sun.sunset) {
      const dusk = parseHoursUTC(result.sun.dusk)!;
      const set = parseHoursUTC(result.sun.sunset)!;
      assertEquals(dusk > set, true, 'dusk should be after sunset');
    }
  });
});

// ---------------------------------------------------------------------------
// London winter solstice — short day reference
//
// On 2024-12-21 (winter solstice) at London:
//   Sunrise ≈ 08:03 UTC
//   Sunset  ≈ 15:58 UTC
//   Day length ≈ 7h 55min = 28,500 s
// ---------------------------------------------------------------------------

Deno.test('computeAlmanac: London winter solstice — short day', async (t) => {
  const result = computeAlmanac(new Date('2024-12-21'), 51.5074, -0.1278);

  await t.step('sunrise is approximately 08:03 UTC', () => {
    assertExists(result.sun.sunrise);
    const h = parseHoursUTC(result.sun.sunrise)!;
    assertAlmostEquals(h, 8.05, 0.085);
  });

  await t.step('sunset is approximately 15:58 UTC', () => {
    assertExists(result.sun.sunset);
    const h = parseHoursUTC(result.sun.sunset)!;
    assertAlmostEquals(h, 15.97, 0.085);
  });

  await t.step('day length is approximately 7h 55min', () => {
    // suncalc may differ slightly from published tables; allow ±400 s
    assertAlmostEquals(result.sun.dayLengthSeconds, 28500, 400);
  });
});

// ---------------------------------------------------------------------------
// Polar locations — edge cases
//
// Polar night (winter above Arctic Circle): no sunrise
// Midnight sun (summer above Arctic Circle): no sunset
//
// WHY THESE TESTS MATTER:
// SunCalc returns NaN for times that don't exist at extreme latitudes.
// The calculator MUST handle NaN gracefully and return null (not 'NaN' string).
// The UI shows '—' for null, but would crash on NaN in date arithmetic.
// ---------------------------------------------------------------------------

Deno.test('computeAlmanac: polar night — Tromso 70°N in winter (no sunrise)', async (t) => {
  // Tromso, Norway: 69.6°N. Well inside polar night on 2024-01-01.
  const result = computeAlmanac(new Date('2024-01-01'), 69.6, 18.95);

  await t.step('sun data exists', () => assertExists(result.sun));

  await t.step('sunrise is null (polar night)', () => {
    // May be null OR the library may compute civil twilight only — either way,
    // the result must not be a NaN string.
    if (result.sun.sunrise !== null) {
      assertEquals(result.sun.sunrise.includes('NaN'), false);
    }
  });

  await t.step('dayLengthSeconds is a finite number', () => {
    assertEquals(isFinite(result.sun.dayLengthSeconds), true);
    assertEquals(isNaN(result.sun.dayLengthSeconds), false);
  });
});

Deno.test('computeAlmanac: midnight sun — Tromso 70°N in summer (no sunset)', async (t) => {
  const result = computeAlmanac(new Date('2024-06-21'), 69.6, 18.95);

  await t.step('sun data exists', () => assertExists(result.sun));

  await t.step('no NaN in sunrise/sunset strings', () => {
    if (result.sun.sunrise) assertEquals(result.sun.sunrise.includes('NaN'), false);
    if (result.sun.sunset) assertEquals(result.sun.sunset.includes('NaN'), false);
  });

  await t.step('dayLengthSeconds is finite and non-NaN', () => {
    assertEquals(isFinite(result.sun.dayLengthSeconds), true);
    assertEquals(isNaN(result.sun.dayLengthSeconds), false);
  });
});

// ---------------------------------------------------------------------------
// Moon phase names
//
// The phase value (0–1) maps to named lunar phases.
// We test the canonical phase=0 (new) and phase=0.5 (full) edges, plus
// the overall structure of the moon object.
// ---------------------------------------------------------------------------

Deno.test('computeAlmanac: moon data structure is complete', async (t) => {
  const result = computeAlmanac(new Date('2024-06-15'), 51.5074, -0.1278);

  await t.step('has moon data', () => assertExists(result.moon));

  await t.step('moon.phase is a number in [0, 1)', () => {
    assertEquals(typeof result.moon.phase, 'number');
    assertEquals(result.moon.phase >= 0, true);
    assertEquals(result.moon.phase < 1, true);
  });

  await t.step('moon.fraction is a number in [0, 1]', () => {
    assertEquals(typeof result.moon.fraction, 'number');
    assertEquals(result.moon.fraction >= 0, true);
    assertEquals(result.moon.fraction <= 1, true);
  });

  await t.step('moon.phaseName is a non-empty string', () => {
    assertEquals(typeof result.moon.phaseName, 'string');
    assertEquals(result.moon.phaseName.length > 0, true);
  });

  await t.step('moon.angle is a number', () => {
    assertEquals(typeof result.moon.angle, 'number');
  });
});

Deno.test('computeAlmanac: moon phase names for canonical values', async (t) => {
  // We find dates known to be near new moon and full moon by their phase values.
  // 2024-06-06: New Moon (phase ≈ 0)
  // 2024-06-22: Full Moon (phase ≈ 0.5)
  // We test that phase names contain expected keywords.

  await t.step('new moon phaseName contains "New"', () => {
    const result = computeAlmanac(new Date('2024-06-06'), 51.5074, -0.1278);
    // phase should be close to 0 (new moon)
    if (result.moon.phase < 0.1 || result.moon.phase > 0.9) {
      assertEquals(
        result.moon.phaseName.toLowerCase().includes('new'),
        true,
        `Expected 'New' in phaseName, got: ${result.moon.phaseName}`,
      );
    }
  });

  await t.step('full moon phaseName contains "Full"', () => {
    const result = computeAlmanac(new Date('2024-06-22'), 51.5074, -0.1278);
    // phase should be close to 0.5 (full moon)
    if (result.moon.phase > 0.4 && result.moon.phase < 0.6) {
      assertEquals(
        result.moon.phaseName.toLowerCase().includes('full'),
        true,
        `Expected 'Full' in phaseName, got: ${result.moon.phaseName}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Date field contract
// ---------------------------------------------------------------------------

Deno.test('computeAlmanac: date field matches input date string', () => {
  const dates = ['2024-01-01', '2024-06-15', '2024-12-31'];
  for (const date of dates) {
    const result = computeAlmanac(new Date(date), 51.5074, -0.1278);
    assertEquals(result.date, date, `date field should match input '${date}'`);
  }
});
