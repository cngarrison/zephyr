import { page } from "fresh";
import { define } from "@/utils.ts";
import { fetchAlmanac, fetchDailyAggregates, fetchStationConfig } from "@/lib/api.ts";
import type { AlmanacData, DailyAggregate } from "@/lib/types.ts";
import Header from "@/islands/Header.tsx";
import NavTabs from "@/components/layout/NavTabs.tsx";
import HeatmapTable from "@/components/history/HeatmapTable.tsx";
import type { HeatmapTableProps } from "@/components/history/HeatmapTable.tsx";
import RecordsTable from "@/components/history/RecordsTable.tsx";
import type { RecordsGroup } from "@/components/history/RecordsTable.tsx";

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

/** Extract sorted unique years from the aggregate data. */
function extractYears(data: DailyAggregate[]): number[] {
  const set = new Set<number>();
  for (const d of data) set.add(parseInt(d.date.slice(0, 4), 10));
  return [...set].sort((a, b) => a - b);
}

type CellFn = (d: DailyAggregate) => number | null;

/**
 * Build a cells[month][year] matrix for HeatmapTable.
 * month index 0 = January, year index matches years[].
 * reducer: 'avg' averages the per-day values; 'sum' sums them; 'max' takes max.
 */
function buildCells(
  data: DailyAggregate[],
  years: number[],
  getValue: CellFn,
  reducer: "avg" | "sum" | "max",
): (number | null)[][] {
  // Accumulate [sum, count, max] per (month, year)
  const acc: Map<string, { sum: number; count: number; max: number }> = new Map();

  for (const d of data) {
    const v = getValue(d);
    if (v === null) continue;
    const year  = parseInt(d.date.slice(0, 4), 10);
    const month = parseInt(d.date.slice(5, 7), 10) - 1; // 0-based
    const key = `${month}_${year}`;
    const existing = acc.get(key);
    if (existing) {
      existing.sum   += v;
      existing.count += 1;
      if (v > existing.max) existing.max = v;
    } else {
      acc.set(key, { sum: v, count: 1, max: v });
    }
  }

  return Array.from({ length: 12 }, (_, mi) =>
    years.map((yr) => {
      const key = `${mi}_${yr}`;
      const entry = acc.get(key);
      if (!entry) return null;
      if (reducer === "sum") return entry.sum;
      if (reducer === "max") return entry.max;
      return entry.sum / entry.count; // avg
    }),
  );
}

/** Find the record (max or min) in the current year's data. */
function findRecord(
  data: DailyAggregate[],
  currentYear: number,
  getValue: CellFn,
  mode: "max" | "min",
): { value: number | null; date: string | null } {
  let best: number | null = null;
  let bestDate: string | null = null;
  for (const d of data) {
    if (parseInt(d.date.slice(0, 4), 10) !== currentYear) continue;
    const v = getValue(d);
    if (v === null) continue;
    if (
      best === null ||
      (mode === "max" && v > best) ||
      (mode === "min" && v < best)
    ) {
      best = v;
      bestDate = d.date;
    }
  }
  return { value: best, date: bestDate };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageData {
  stationName: string;
  serverTime: string;
  timezone: string;
  almanac: AlmanacData | null;
  years: number[];
  tempAvgCells:  (number | null)[][];
  rainSumCells:  (number | null)[][];
  windMaxCells:  (number | null)[][];
  summerDayCells:   (number | null)[][];
  tropNightCells:   (number | null)[][];
  frostDayCells:    (number | null)[][];
  recordGroups: RecordsGroup[];
  url: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const [station, data, almanac] = await Promise.all([
      fetchStationConfig(),
      fetchDailyAggregates(), // no year — fetch all
      fetchAlmanac(),
    ]);

    const tz = station.timezone;
    const currentYear = Temporal.Now.plainDateISO(tz).year;
    const years = extractYears(data);

    // Heatmap cells
    const tempAvgCells = buildCells(data, years, (d) => d.temp_c_avg ?? null, "avg");
    const rainSumCells = buildCells(data, years, (d) => d.rain_total_mm ?? null, "sum");
    const windMaxCells = buildCells(data, years, (d) => d.wind_gust_ms_max ?? null, "max");

    // Count-style cells (days meeting a threshold per month/year)
    const summerDayCells = buildCells(
      data, years,
      (d) => (d.temp_c_max !== undefined && d.temp_c_max > 30 ? 1 : d.temp_c_max !== undefined ? 0 : null),
      "sum",
    );
    const tropNightCells = buildCells(
      data, years,
      (d) => (d.temp_c_min !== undefined && d.temp_c_min > 20 ? 1 : d.temp_c_min !== undefined ? 0 : null),
      "sum",
    );
    const frostDayCells = buildCells(
      data, years,
      (d) => (d.temp_c_min !== undefined && d.temp_c_min < 0 ? 1 : d.temp_c_min !== undefined ? 0 : null),
      "sum",
    );

    // This-year records
    const rMax  = (fn: CellFn) => findRecord(data, currentYear, fn, "max");
    const rMin  = (fn: CellFn) => findRecord(data, currentYear, fn, "min");

    const recordGroups: RecordsGroup[] = [
      {
        heading: "Temperature",
        records: [
          { label: "Highest",       ...rMax((d) => d.temp_c_max ?? null),        unit: "°C" },
          { label: "Lowest",        ...rMin((d) => d.temp_c_min ?? null),        unit: "°C" },
          { label: "Max Dew Point", ...rMax((d) => d.dew_point_c_max ?? null),   unit: "°C" },
          { label: "Min Dew Point", ...rMin((d) => d.dew_point_c_min ?? null),   unit: "°C" },
        ],
      },
      {
        heading: "Wind",
        records: [
          { label: "Max Gust",        ...rMax((d) => d.wind_gust_ms_max  ?? null), unit: "m/s" },
          { label: "Max Avg Speed",   ...rMax((d) => d.wind_speed_ms_avg ?? null), unit: "m/s" },
        ],
      },
      {
        heading: "Rain",
        records: [
          { label: "Highest Daily Total", ...rMax((d) => d.rain_total_mm ?? null), unit: "mm" },
        ],
      },
      {
        heading: "UV / Solar",
        records: [
          { label: "Max UV Index",       ...rMax((d) => d.uv_index_max      ?? null), unit: "" },
          { label: "Max Solar Radiation",...rMax((d) => d.solar_rad_wm2_max ?? null), unit: "W/m²" },
        ],
      },
    ];

    return page({
      stationName: station.name,
      serverTime: Temporal.Now.instant().toString(),
      timezone: station.timezone,
      almanac,
      years,
      tempAvgCells,
      rainSumCells,
      windMaxCells,
      summerDayCells,
      tropNightCells,
      frostDayCells,
      recordGroups,
      url: ctx.req.url
    });
  },
});

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default define.page(function HistoryPage({ data }: { data: PageData }) {
  const {
    stationName, serverTime, timezone, almanac, years,
    tempAvgCells, rainSumCells, windMaxCells,
    summerDayCells, tropNightCells, frostDayCells,
    recordGroups,
    url,
  } = data;
  const pathname = new URL(url).pathname;

  const heatmapProps = (overrides: Partial<HeatmapTableProps> & Pick<HeatmapTableProps, "title" | "unit" | "cells" | "colorScheme">) =>
    ({ years, ...overrides }) satisfies HeatmapTableProps;

  return (
    <div class="min-h-screen bg-[var(--color-bg)]">
      <Header stationName={stationName} initialTime={serverTime} timezone={timezone} almanac={almanac} />
      <NavTabs current={pathname} />
      <main class="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <h2 class="text-xl font-bold">Weather Statistics</h2>

        {years.length === 0 && (
          <p class="label-text">No historical data available yet.</p>
        )}

        {years.length > 0 && (
          <>
            {/* Heatmap tables */}
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <HeatmapTable
                {...heatmapProps({
                  title: "Mean Temperature",
                  unit: "°C",
                  cells: tempAvgCells,
                  colorScheme: "temp",
                })}
              />
              <HeatmapTable
                {...heatmapProps({
                  title: "Monthly Rainfall",
                  unit: "mm",
                  cells: rainSumCells,
                  colorScheme: "rain",
                })}
              />
              <HeatmapTable
                {...heatmapProps({
                  title: "Max Wind Gust",
                  unit: "m/s",
                  cells: windMaxCells,
                  colorScheme: "wind",
                })}
              />
              <HeatmapTable
                {...heatmapProps({
                  title: "Summer Days (max ≥ 30°C)",
                  unit: "days",
                  cells: summerDayCells,
                  colorScheme: "neutral",
                })}
              />
              <HeatmapTable
                {...heatmapProps({
                  title: "Tropical Nights (min ≥ 20°C)",
                  unit: "nights",
                  cells: tropNightCells,
                  colorScheme: "neutral",
                })}
              />
              <HeatmapTable
                {...heatmapProps({
                  title: "Frost Days (min < 0°C)",
                  unit: "days",
                  cells: frostDayCells,
                  colorScheme: "neutral",
                })}
              />
            </div>

            {/* Records */}
            <RecordsTable
              title="This Year's Records"
              groups={recordGroups}
            />
          </>
        )}
      </main>
    </div>
  );
});
