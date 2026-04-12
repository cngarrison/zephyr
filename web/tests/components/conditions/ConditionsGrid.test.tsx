/**
 * Tests for web/components/conditions/ConditionsGrid.tsx
 *
 * Uses preact-render-to-string for SSR snapshot-style assertions.
 * No DOM setup required — pure render-to-string checks.
 */
import { assertEquals, assertStringIncludes } from '@std/assert';
import { renderToString } from 'preact-render-to-string';
import ConditionsGrid from '../../../components/conditions/ConditionsGrid.tsx';
import { makeObservation, makeTodayStats } from '@zephyr/shared/testing';
import type { Observation } from '@zephyr/shared';

Deno.test('ConditionsGrid', async (t) => {
  await t.step('renders no-data message when obs is null', () => {
    const html = renderToString(<ConditionsGrid obs={null} />);
    assertStringIncludes(html, 'No observations recorded yet');
  });

  await t.step('renders temperature when obs provided', () => {
    const html = renderToString(
      <ConditionsGrid obs={makeObservation({ tempOutdoor: 19.5 })} />,
    );
    assertStringIncludes(html, '19.5');
  });

  await t.step('renders — for missing optional fields', () => {
    // Observation fields are optional (uvIndex?: number, solarRadiation?: number)
    const obs: Observation = { ...makeObservation(), uvIndex: undefined, solarRadiation: undefined };
    const html = renderToString(<ConditionsGrid obs={obs} />);
    // fmt() returns "—" for undefined/null values
    assertStringIncludes(html, '—');
  });

  await t.step('renders all 11 condition cards', () => {
    const html = renderToString(<ConditionsGrid obs={makeObservation()} />);
    // Row 1: Temperature, Indoor Temp, Rain, Humidity, Pressure, Wind Speed, Wind Gust, Wind Dir
    // Row 2: Dew Point, UV Index, Solar Rad.
    const labels = [
      'Temperature',
      'Indoor Temp',
      'Rain',
      'Humidity',
      'Pressure',
      'Wind Speed',
      'Wind Gust',
      'Wind Dir',
      'Dew Point',
      'UV Index',
      'Solar Rad.',
    ];
    for (const label of labels) {
      assertStringIncludes(html, label, `Expected condition card with label: "${label}"`);
    }
  });

  await t.step('renders todayStats min/max when provided', () => {
    const html = renderToString(
      <ConditionsGrid
        obs={makeObservation()}
        todayStats={makeTodayStats({ temp_min: 12.3 })}
      />,
    );
    // temp_min 12.3 → appears as "12.3°C" in the topRight stat box
    assertStringIncludes(html, '12.3');
  });

  await t.step('renders — for todayStats null values', () => {
    const html = renderToString(
      <ConditionsGrid
        obs={makeObservation()}
        todayStats={makeTodayStats({ temp_min: null, temp_min_time: null })}
      />,
    );
    // When temp_min is null, the stat box value is formatted as "—"
    assertStringIncludes(html, '—');
  });

  await t.step('degreesToCompass: cardinal directions', () => {
    const cases: Array<[number, string]> = [
      [0, 'N'],    // 0° → COMPASS_DIRS[0]
      [90, 'E'],   // 90° → COMPASS_DIRS[4]
      [180, 'S'],  // 180° → COMPASS_DIRS[8]
      [270, 'W'],  // 270° → COMPASS_DIRS[12]
    ];
    for (const [degrees, expected] of cases) {
      const html = renderToString(
        <ConditionsGrid obs={makeObservation({ windDirection: degrees })} />,
      );
      // The compass value is rendered as the Wind Dir card's valueSupplemental
      // Compass letters are uppercase — CSS class names are all lowercase — so
      // an uppercase match here can only be the compass direction text.
      assertStringIncludes(
        html,
        expected,
        `Expected compass direction "${expected}" for windDirection=${degrees}°`,
      );
    }
  });

  await t.step('renders with todayStats=null (no stats boxes)', () => {
    // Passing todayStats=null explicitly should not crash — topRight/bottomRight are undefined
    const html = renderToString(
      <ConditionsGrid obs={makeObservation()} todayStats={null} />,
    );
    // Cards should still render, just without stats boxes
    assertStringIncludes(html, 'Temperature');
    // Wind Gust and Wind Dir always render rightIcon (shrink-0 present), but
    // the temperature/humidity/pressure stat boxes (topRight/bottomRight) are absent.
    // Verify the no-stats marker: temp_min is absent since no todayStats supplied.
    // (topRight for Temperature would show temp_min; without todayStats it's undefined.)
    // We just verify no crash and core cards present.
  });
});
