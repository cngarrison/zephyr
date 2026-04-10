import ThemeToggle from '@/islands/ThemeToggle.tsx';
import type { AlmanacData } from '@/lib/types.ts';

interface HeaderProps {
  stationName: string;
  serverTime: string;
  timezone?: string;
  almanac?: AlmanacData | null;
}

function fmtTime(iso: string | null, timezone: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-AU', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDayLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function moonIconClass(phase: number): string {
  if (phase < 0.033 || phase >= 0.967) return 'wi-moon-new';
  if (phase < 0.25) {
    const n = Math.max(1, Math.min(6, Math.ceil((phase / 0.25) * 6)));
    return `wi-moon-waxing-crescent-${n}`;
  }
  if (phase < 0.283) return 'wi-moon-first-quarter';
  if (phase < 0.5) {
    const n = Math.max(1, Math.min(6, Math.ceil(((phase - 0.25) / 0.25) * 6)));
    return `wi-moon-waxing-gibbous-${n}`;
  }
  if (phase < 0.533) return 'wi-moon-full';
  if (phase < 0.75) {
    const n = Math.max(1, Math.min(6, Math.ceil(((phase - 0.5) / 0.25) * 6)));
    return `wi-moon-waning-gibbous-${n}`;
  }
  if (phase < 0.783) return 'wi-moon-third-quarter';
  const n = Math.max(1, Math.min(6, Math.ceil(((phase - 0.75) / 0.25) * 6)));
  return `wi-moon-waning-crescent-${n}`;
}

export default function Header({ stationName, serverTime, timezone = 'UTC', almanac }: HeaderProps) {
  const dt = new Date(serverTime);
  const formattedDate = dt.toLocaleDateString('en-AU', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = dt.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header style="background-color: var(--color-nav-bg); color: var(--color-nav-text);">
      <div class="flex items-center gap-3 px-4 py-2">

        {/* ── Logo ───────────────────────────────────────────────────── */}
        <a href="/" class="shrink-0 flex items-center">
          <img src="/logo.svg" alt="Zephyr" height="40" class="h-10 w-auto dark:hidden" />
          <img src="/logo-dark.svg" alt="Zephyr" height="40" class="h-10 w-auto hidden dark:block" />
        </a>

        {/* ── Station name + datetime (stacked) ──────────────────────── */}
        <div class="flex flex-col min-w-0 mr-auto">
          <span class="text-sm font-semibold leading-tight truncate">{stationName}</span>
          <span class="text-xs opacity-60 leading-tight">{formattedDate} · {formattedTime}</span>
        </div>

        {/* ── Almanac box (top-right, 2 rows) ────────────────────────── */}
        {almanac && (
          <a
            href="/almanac"
            class="hidden sm:flex flex-col gap-0.5 text-xs px-3 py-1.5 rounded-lg shrink-0 transition-opacity hover:opacity-90"
            style="background: rgba(0,0,0,0.22); border: 1px solid rgba(255,255,255,0.1);"
          >
            {/* Row 1 — sun */}
            <div class="flex items-center gap-3 opacity-90">
              <span class="flex items-center gap-1">
                <i class="wi wi-sunrise" />
                {fmtTime(almanac.sun.sunrise, timezone)}
              </span>
              <span class="flex items-center gap-1">
                <i class="wi wi-sunset" />
                {fmtTime(almanac.sun.sunset, timezone)}
              </span>
              <span class="opacity-70">Day {fmtDayLength(almanac.sun.dayLengthSeconds)}</span>
            </div>
            {/* Row 2 — moon */}
            <div class="flex items-center gap-3 opacity-90">
              <span class="flex items-center gap-1">
                <i class="wi wi-moonrise" />
                {almanac.moon.rise ? fmtTime(almanac.moon.rise, timezone) : '—'}
              </span>
              <span class="flex items-center gap-1">
                <i class="wi wi-moonset" />
                {almanac.moon.set ? fmtTime(almanac.moon.set, timezone) : '—'}
              </span>
              <span class="flex items-center gap-1">
                <i class={`wi ${moonIconClass(almanac.moon.phase)}`} />
                {almanac.moon.phaseName}
                <span class="opacity-70">({Math.round(almanac.moon.fraction * 100)}%)</span>
              </span>
            </div>
          </a>
        )}

        {/* ── Theme toggle ───────────────────────────────────────────── */}
        <ThemeToggle />
      </div>
    </header>
  );
}
