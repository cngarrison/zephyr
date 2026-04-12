/**
 * Test environment setup using happy-dom.
 * Provides browser-like globals (window, document, localStorage, etc.) for web component tests.
 * Uses a singleton pattern — safe to call multiple times.
 */
import { Window as HappyDOMWindow } from 'happy-dom';

let _window: HappyDOMWindow | null = null;

/**
 * Create a happy-dom Window at http://localhost:8081 and assign browser globals to globalThis.
 * Also stubs globalThis.matchMedia (returns { matches: false }) — required by ThemeToggle's applyTheme.
 * Singleton: does nothing if already set up.
 */
export function setupTestEnvironment(): void {
  if (_window !== null) return;

  _window = new HappyDOMWindow({
    url: 'http://localhost:8081',
    width: 1024,
    height: 768,
  });

  const g = globalThis as Record<string, unknown>;
  const w = _window as unknown as Record<string, unknown>;

  g['window'] = _window;
  g['document'] = w['document'];
  g['navigator'] = w['navigator'];
  g['location'] = w['location'];
  g['history'] = w['history'];
  g['localStorage'] = w['localStorage'];
  g['sessionStorage'] = w['sessionStorage'];
  g['HTMLElement'] = w['HTMLElement'];
  g['Element'] = w['Element'];
  g['Document'] = w['Document'];

  // Stub matchMedia — needed by ThemeToggle's applyTheme which calls:
  // globalThis.matchMedia("(prefers-color-scheme: dark)").matches
  g['matchMedia'] = (_query: string) => ({
    matches: false,
    media: _query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

/**
 * Close the happy-dom Window and remove all assigned browser globals from globalThis.
 */
export function cleanupTestEnvironment(): void {
  if (_window === null) return;

  try {
    (_window as unknown as { close(): void }).close();
  } catch {
    // ignore close errors in case happy-dom version differs
  }
  _window = null;

  const g = globalThis as Record<string, unknown>;
  const keys = [
    'window',
    'document',
    'navigator',
    'location',
    'history',
    'localStorage',
    'sessionStorage',
    'HTMLElement',
    'Element',
    'Document',
    'matchMedia',
  ];
  for (const key of keys) {
    try {
      delete g[key];
    } catch {
      // If delete is not permitted (non-configurable), set to undefined
      g[key] = undefined;
    }
  }
}

/** Return the current happy-dom Window instance, or null if not set up. */
export function getTestWindow(): HappyDOMWindow | null {
  return _window;
}
