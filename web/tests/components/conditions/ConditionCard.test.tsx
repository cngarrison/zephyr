/**
 * Tests for web/components/conditions/ConditionCard.tsx
 *
 * Uses preact-render-to-string to render SSR components to HTML strings.
 * No DOM setup is required — these are pure render-to-string checks.
 */
import { assertFalse, assertStringIncludes } from '@std/assert';
import { renderToString } from 'preact-render-to-string';
import ConditionCard from '../../../components/conditions/ConditionCard.tsx';

Deno.test('ConditionCard', async (t) => {
  await t.step('renders label and value', () => {
    const html = renderToString(
      <ConditionCard label='Temperature' value='20.1' unit='°C' />,
    );
    assertStringIncludes(html, 'Temperature');
    assertStringIncludes(html, '20.1');
    assertStringIncludes(html, '°C');
  });

  await t.step('renders — for missing unit', () => {
    const html = renderToString(
      <ConditionCard label='Temperature' value='20.1' />,
    );
    // No unit prop → unit span should not be rendered
    assertFalse(html.includes('°C'), 'unit should not appear when not provided');
  });

  await t.step('renders topRight stat box when provided', () => {
    const html = renderToString(
      <ConditionCard
        label='Temperature'
        value='20.1'
        unit='°C'
        topRight={{ label: 'Min', value: '15.0°C' }}
      />,
    );
    assertStringIncludes(html, 'Min');
    assertStringIncludes(html, '15.0°C');
  });

  await t.step('renders bottomRight stat box when provided', () => {
    const html = renderToString(
      <ConditionCard
        label='Temperature'
        value='20.1'
        unit='°C'
        bottomRight={{ label: 'Max', value: '25.0°C' }}
      />,
    );
    assertStringIncludes(html, 'Max');
    assertStringIncludes(html, '25.0°C');
  });

  await t.step('renders rightIcon class when provided', () => {
    const html = renderToString(
      <ConditionCard
        label='Wind'
        value='5.0'
        unit='m/s'
        rightIcon='wi-wind-beaufort-3'
      />,
    );
    assertStringIncludes(html, 'wi-wind-beaufort-3');
  });

  await t.step('does not render right column when no right props', () => {
    const html = renderToString(
      <ConditionCard label='Temperature' value='20.1' unit='°C' />,
    );
    // The right column div uses shrink-0 — absent when hasRight is false
    assertFalse(html.includes('shrink-0'), 'right column should not render without right props');
  });

  await t.step('renders valueSupplemental when provided', () => {
    const html = renderToString(
      <ConditionCard label='Wind Dir' value='180' unit='°' valueSupplemental='NNE' />,
    );
    assertStringIncludes(html, 'NNE');
  });

  await t.step('renders trend icon for up/down/steady', () => {
    for (
      const [trend, icon] of [
        ['up', '↑'],
        ['down', '↓'],
        ['steady', '→'],
      ] as const
    ) {
      const html = renderToString(
        <ConditionCard
          label='Pressure'
          value='1013.2'
          unit='hPa'
          trend={trend}
          meta={`${trend} trend`}
        />,
      );
      assertStringIncludes(html, icon, `Expected trend icon ${icon} for trend=${trend}`);
      assertStringIncludes(html, `${trend} trend`);
    }
  });
});
