/** Heatmap grid: rows = months (Jan–Dec), columns = years. */

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface HeatmapTableProps {
  title: string;
  unit: string;
  /** Sorted ascending list of years present in the data. */
  years: number[];
  /**
   * cells[monthIndex][yearIndex] — month 0 = January, yearIndex matches years[].
   * null means no data for that month/year combination.
   */
  cells: (number | null)[][];
  colorScheme: "temp" | "rain" | "wind" | "neutral";
}

/** Return an RGB hex string interpolated between two hex colours at fraction t (0–1). */
function lerpHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

/** Perceived luminance (0–1) of an RGB hex colour. */
function luminance(hex: string): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(parseInt(hex.slice(1, 3), 16));
  const g = toLinear(parseInt(hex.slice(3, 5), 16));
  const b = toLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const COLOR_SCHEMES: Record<HeatmapTableProps["colorScheme"], [string, string]> = {
  temp:    ["#bfdbfe", "#b91c1c"], // blue-200 → red-700
  rain:    ["#eff6ff", "#1e3a8a"], // blue-50  → blue-900
  wind:    ["#f5f3ff", "#5b21b6"], // purple-50 → purple-800
  neutral: ["#f1f5f9", "#334155"], // slate-100 → slate-700
};

export default function HeatmapTable(
  { title, unit, years, cells, colorScheme }: HeatmapTableProps,
) {
  if (years.length === 0) {
    return (
      <section class="card p-4">
        <h3 class="font-semibold text-base mb-2">{title}</h3>
        <p class="label-text text-sm">No data available.</p>
      </section>
    );
  }

  // Compute global min/max for colour scaling (skip nulls).
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const row of cells) {
    for (const v of row) {
      if (v !== null) {
        if (v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      }
    }
  }
  const range = globalMax - globalMin || 1;
  const [colorLow, colorHigh] = COLOR_SCHEMES[colorScheme];

  return (
    <section class="card p-4 overflow-x-auto">
      <h3 class="font-semibold text-base mb-3">{title}</h3>
      <table class="border-collapse text-xs">
        <thead>
          <tr>
            <th class="px-2 py-1 text-left label-text w-10"></th>
            {years.map((y) => (
              <th key={y} class="px-2 py-1 text-center label-text font-medium">{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MONTH_LABELS.map((month, mi) => (
            <tr key={mi}>
              <td class="px-2 py-1 label-text font-medium">{month}</td>
              {years.map((_, yi) => {
                const v = cells[mi]?.[yi] ?? null;
                if (v === null) {
                  return (
                    <td
                      key={yi}
                      class="px-2 py-1 text-center w-16 h-8"
                      style="background:#f1f5f9"
                    >
                      <span class="text-slate-300">—</span>
                    </td>
                  );
                }
                const t = (v - globalMin) / range;
                const bg = lerpHex(colorLow, colorHigh, t);
                const fg = luminance(bg) > 0.35 ? "#1e293b" : "#ffffff";
                return (
                  <td
                    key={yi}
                    class="px-2 py-1 text-center w-16 h-8 tabular-nums"
                    style={`background:${bg};color:${fg}`}
                    title={`${v.toFixed(1)} ${unit}`}
                  >
                    {v.toFixed(1)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p class="label-text text-xs mt-1">{unit}</p>
    </section>
  );
}
