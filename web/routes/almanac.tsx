import { page } from 'fresh';
import { Head } from 'fresh/runtime';
import { define } from '@/utils.ts';
import { fetchAlmanac, fetchStationConfig } from '@/lib/api.ts';
import type { AlmanacData } from '@/lib/types.ts';
import Header from '@/islands/Header.tsx';
import NavTabs from '@/components/layout/NavTabs.tsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtTime(iso: string | null, tz: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-AU', {
    timeZone: tz,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageData {
  stationName: string;
  serverTime: string;
  timezone: string;
  almanac: AlmanacData | null;
  date: string; // YYYY-MM-DD (display date)
  prevDate: string;
  nextDate: string;
  isToday: boolean;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const station = await fetchStationConfig();
    const tz = station.timezone;

    // Determine which date to display.
    const dateParam = new URL(ctx.req.url).searchParams.get('date');
    let targetDate: Temporal.PlainDate;
    const todayDate = Temporal.Now.plainDateISO(tz);

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      try {
        targetDate = Temporal.PlainDate.from(dateParam);
      } catch {
        targetDate = todayDate;
      }
    } else {
      targetDate = todayDate;
    }

    const date = targetDate.toString();
    const prevDate = targetDate.subtract({ days: 1 }).toString();
    const nextDate = targetDate.add({ days: 1 }).toString();
    const isToday = Temporal.PlainDate.compare(targetDate, todayDate) === 0;

    const almanac = await fetchAlmanac(date);

    return page({
      stationName: station.name,
      serverTime: Temporal.Now.instant().toString(),
      timezone: tz,
      almanac,
      date,
      prevDate,
      nextDate,
      isToday,
    });
  },
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SunRow({ label, iso, tz, icon }: { label: string; iso: string | null; tz: string; icon: string }) {
  return (
    <div class='flex items-center justify-between py-2 border-b border-[var(--color-card-border)] last:border-0'>
      <span class='flex items-center gap-2 text-sm' style='color: var(--color-muted);'>
        <i class={`wi ${icon} text-lg w-6 text-center`} style='color: var(--color-label);' />
        {label}
      </span>
      <span class='font-mono text-sm font-medium' style='color: var(--color-text);'>
        {fmtTime(iso, tz)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default define.page(function AlmanacPage({ data }: { data: PageData }) {
  const { stationName, serverTime, timezone, almanac, date, prevDate, nextDate, isToday } = data;

  // Format display date header
  const displayDate = new Date(date + 'T12:00:00Z').toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });

  return (
    <>
      <Head>
        <title>{stationName} — Almanac — Zephyr Weather</title>
      </Head>
      <Header stationName={stationName} initialTime={serverTime} timezone={timezone} almanac={almanac} />
      <NavTabs current='/almanac' />

      <main class='max-w-3xl mx-auto px-4 py-8 space-y-6'>
        {/* ── Date navigation ────────────────────────────────────────── */}
        <div class='flex items-center justify-between'>
          <a
            href={`/almanac?date=${prevDate}`}
            class='flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-colors'
            style='color: var(--color-accent); border: 1px solid var(--color-card-border);'
          >
            ← {new Date(prevDate + 'T12:00:00Z').toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              timeZone: timezone,
            })}
          </a>

          <div class='text-center'>
            <h2 class='text-lg font-bold' style='color: var(--color-text);'>{displayDate}</h2>
            {!isToday && <a href='/almanac' class='text-xs' style='color: var(--color-accent);'>Today</a>}
          </div>

          <a
            href={`/almanac?date=${nextDate}`}
            class='flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-colors'
            style='color: var(--color-accent); border: 1px solid var(--color-card-border);'
          >
            {new Date(nextDate + 'T12:00:00Z').toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              timeZone: timezone,
            })} →
          </a>
        </div>

        {!almanac && <p class='label-text text-center py-12'>Almanac data unavailable.</p>}

        {almanac && (
          <div class='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* ── Sun card ───────────────────────────────────────────── */}
            <div class='card space-y-0'>
              <div class='flex items-center gap-2 mb-3'>
                <i class='wi wi-day-sunny text-2xl' style='color: #fbbf24;' />
                <h3 class='text-base font-semibold' style='color: var(--color-text);'>Sun</h3>
              </div>

              <SunRow label='Civil Dawn' iso={almanac.sun.dawn} tz={timezone} icon='wi-horizon' />
              <SunRow label='Sunrise' iso={almanac.sun.sunrise} tz={timezone} icon='wi-sunrise' />
              <SunRow label='Golden Hour End' iso={almanac.sun.goldenHourEnd} tz={timezone} icon='wi-day-cloudy' />
              <SunRow label='Solar Noon' iso={almanac.sun.solarNoon} tz={timezone} icon='wi-day-sunny' />
              <SunRow label='Golden Hour' iso={almanac.sun.goldenHour} tz={timezone} icon='wi-day-cloudy' />
              <SunRow label='Sunset' iso={almanac.sun.sunset} tz={timezone} icon='wi-sunset' />
              <SunRow label='Civil Dusk' iso={almanac.sun.dusk} tz={timezone} icon='wi-horizon-alt' />

              <div class='flex items-center justify-between pt-3 mt-1'>
                <span class='text-xs font-semibold uppercase tracking-wide' style='color: var(--color-label);'>
                  Day length
                </span>
                <span class='font-mono text-sm font-bold' style='color: var(--color-text);'>
                  {fmtDayLength(almanac.sun.dayLengthSeconds)}
                </span>
              </div>
            </div>

            {/* ── Moon card ───────────────────────────────────────────── */}
            <div class='card flex flex-col gap-4'>
              <div class='flex items-center gap-2'>
                <i class={`wi ${moonIconClass(almanac.moon.phase)} text-2xl`} style='color: #94a3b8;' />
                <h3 class='text-base font-semibold' style='color: var(--color-text);'>Moon</h3>
              </div>

              {/* Phase display */}
              <div class='flex flex-col items-center gap-2 py-4'>
                <i
                  class={`wi ${moonIconClass(almanac.moon.phase)}`}
                  style='font-size: 5rem; color: #cbd5e1;'
                />
                <p class='text-lg font-semibold' style='color: var(--color-text);'>
                  {almanac.moon.phaseName}
                </p>
                <p class='text-sm' style='color: var(--color-muted);'>
                  {Math.round(almanac.moon.fraction * 100)}% illuminated
                </p>
              </div>

              {/* Rise / set */}
              <div class='space-y-0 border-t border-[var(--color-card-border)] pt-3'>
                <div class='flex items-center justify-between py-2 border-b border-[var(--color-card-border)]'>
                  <span class='flex items-center gap-2 text-sm' style='color: var(--color-muted);'>
                    <i class='wi wi-moonrise text-lg w-6 text-center' style='color: var(--color-label);' />
                    Moonrise
                  </span>
                  <span class='font-mono text-sm font-medium' style='color: var(--color-text);'>
                    {fmtTime(almanac.moon.rise, timezone)}
                  </span>
                </div>
                <div class='flex items-center justify-between py-2'>
                  <span class='flex items-center gap-2 text-sm' style='color: var(--color-muted);'>
                    <i class='wi wi-moonset text-lg w-6 text-center' style='color: var(--color-label);' />
                    Moonset
                  </span>
                  <span class='font-mono text-sm font-medium' style='color: var(--color-text);'>
                    {fmtTime(almanac.moon.set, timezone)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
});
