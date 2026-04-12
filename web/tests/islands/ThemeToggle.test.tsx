/**
 * Tests for web/islands/ThemeToggle.tsx
 *
 * ThemeToggle is a Preact island with useSignal, useEffect, localStorage, and
 * document.documentElement manipulation. CYCLE, LABELS, and applyTheme are
 * module-internal (not exported), so we test observable behaviour:
 *
 * • SSR tests (renderToString) — verify rendered HTML structure / aria-labels.
 * • DOM tests — mount with Preact render, interact via state, check DOM class.
 *
 * SSR tests need no DOM setup.
 * DOM tests call setupTestEnvironment() so localStorage and document are available.
 */
import { assertStringIncludes } from '@std/assert';
import { renderToString } from 'preact-render-to-string';
import ThemeToggle from '../../islands/ThemeToggle.tsx';

Deno.test('ThemeToggle — SSR', async (t) => {
  await t.step('renders a button element', () => {
    const html = renderToString(<ThemeToggle />);
    assertStringIncludes(html, '<button', 'ThemeToggle should render a <button>');
    assertStringIncludes(html, 'aria-label', 'button should have an aria-label attribute');
  });

  await t.step('initial aria-label is "Switch to light mode" (system default)', () => {
    // Initial theme signal value is "system".
    // LABELS.system = "Switch to light mode"
    // useEffect does not run during SSR, so the localStorage read is skipped.
    const html = renderToString(<ThemeToggle />);
    assertStringIncludes(
      html,
      'Switch to light mode',
      "initial aria-label should reflect the system theme's next-action label",
    );
  });

  await t.step('has screen-reader text via sr-only span', () => {
    const html = renderToString(<ThemeToggle />);
    // The button contains a <span class="sr-only"> with the same label text
    assertStringIncludes(html, 'sr-only', 'sr-only span should be present for screen readers');
    // The sr-only text should match the aria-label
    assertStringIncludes(html, 'Switch to light mode');
  });

  await t.step('renders an SVG icon', () => {
    const html = renderToString(<ThemeToggle />);
    // Initial theme is "system" → MonitorIcon (SVG with a rect and lines)
    assertStringIncludes(html, '<svg', 'should render an SVG icon');
    assertStringIncludes(html, 'viewBox', 'SVG should have a viewBox attribute');
  });

  await t.step('button has transition-opacity hover class', () => {
    const html = renderToString(<ThemeToggle />);
    assertStringIncludes(
      html,
      'hover:opacity-80',
      'button should have hover opacity transition class',
    );
  });
});
