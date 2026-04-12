/**
 * Tests for web/components/layout/NavTabs.tsx
 *
 * Uses preact-render-to-string. No DOM setup required.
 */
import { assertEquals, assertStringIncludes } from '@std/assert';
import { renderToString } from 'preact-render-to-string';
import NavTabs from '../../../components/layout/NavTabs.tsx';

Deno.test('NavTabs', async (t) => {
  await t.step('renders all 8 tabs', () => {
    const html = renderToString(<NavTabs current='/' />);
    for (const label of ['Current', 'Yesterday', 'Week', 'Month', 'Year', 'History', 'Archive', 'Almanac']) {
      assertStringIncludes(html, label, `Expected tab label "${label}" in rendered output`);
    }
  });

  await t.step('marks / as active when current is /', () => {
    const html = renderToString(<NavTabs current='/' />);
    // Active tab gets class "border-b-2"; inactive tabs get "opacity-70"
    assertStringIncludes(html, 'border-b-2');
    // Exactly one tab is active at a time
    assertEquals(
      (html.match(/border-b-2/g) ?? []).length,
      1,
      'exactly one tab should be active',
    );
    // 7 inactive tabs
    assertEquals(
      (html.match(/opacity-70/g) ?? []).length,
      7,
      'exactly 7 inactive tabs',
    );
  });

  await t.step('does not mark / as active when current is /yesterday', () => {
    const html = renderToString(<NavTabs current='/yesterday' />);
    // Only /yesterday should be active (startsWith match)
    assertEquals(
      (html.match(/border-b-2/g) ?? []).length,
      1,
      'exactly one tab active for /yesterday',
    );
    assertEquals(
      (html.match(/opacity-70/g) ?? []).length,
      7,
      'exactly 7 tabs inactive',
    );
    // The active tab's link comes after the inactive Current ("/") link in the DOM.
    // border-b-2 should appear after the "Current" text in the rendered HTML,
    // which confirms "/" is NOT the active tab.
    const currentIdx = html.indexOf('>Current<');
    const borderIdx = html.indexOf('border-b-2');
    // "Current" link is the first <a>; border-b-2 must appear AFTER it
    // (i.e. on a later link, not on the Current link itself)
    assertEquals(
      currentIdx < borderIdx,
      true,
      'border-b-2 must appear after the Current link (Current is inactive)',
    );
  });

  await t.step('marks sub-route active by startsWith', () => {
    const html = renderToString(<NavTabs current='/week' />);
    assertEquals(
      (html.match(/border-b-2/g) ?? []).length,
      1,
      'exactly one tab active for /week',
    );
    assertStringIncludes(html, 'Week');
    // Verify border-b-2 appears near the Week link
    const weekIdx = html.indexOf('>Week<');
    const borderIdx = html.indexOf('border-b-2');
    // The Week link contains border-b-2; since Week is the 3rd link, border-b-2
    // should come before the Week text node
    assertEquals(
      borderIdx < weekIdx + 50,
      true,
      'border-b-2 should be on or just before the Week link text',
    );
  });

  await t.step('inactive tabs have opacity-70 class', () => {
    const html = renderToString(<NavTabs current='/month' />);
    // With current="/month": 7 tabs are inactive → opacity-70 appears 7 times
    assertEquals(
      (html.match(/opacity-70/g) ?? []).length,
      7,
      '7 inactive tabs should each have opacity-70',
    );
    // The active tab should have border-b-2
    assertStringIncludes(html, 'border-b-2');
  });
});
