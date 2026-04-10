import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { JSX } from 'preact';

type Theme = "light" | "dark" | "system";

const SunIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const MonitorIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const ICONS: Record<Theme, () => JSX.Element> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

const LABELS: Record<Theme, string> = {
  light: "Switch to dark mode",
  dark: "Switch to system theme",
  system: "Switch to light mode",
};

const CYCLE: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

function applyTheme(theme: Theme): void {
  const prefersDark = globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("zephyr-theme", theme);
}

export default function ThemeToggle() {
  const theme = useSignal<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("zephyr-theme") as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      theme.value = stored;
    }
  }, []);

  function toggle() {
    const next = CYCLE[theme.value];
    theme.value = next;
    applyTheme(next);
  }

  const Icon = ICONS[theme.value];

  return (
    <button
      type='button'
      onClick={toggle}
      class="ml-1 p-1.5 rounded-md transition-opacity hover:opacity-80 flex items-center justify-center"
      aria-label={LABELS[theme.value]}
      title={LABELS[theme.value]}
    >
      <Icon />
      <span class="sr-only">{LABELS[theme.value]}</span>
    </button>
  );
}
