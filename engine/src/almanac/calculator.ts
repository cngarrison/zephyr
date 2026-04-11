// @ts-types="npm:@types/suncalc@^1.6.2"
import SunCalc from 'suncalc';

// ---------------------------------------------------------------------------
// Shared almanac types (mirrored in web/lib/types.ts)
// ---------------------------------------------------------------------------

export interface SunTimes {
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string | null;
  dawn: string | null; // civil twilight begin
  dusk: string | null; // civil twilight end
  goldenHourEnd: string | null;
  goldenHour: string | null;
  dayLengthSeconds: number;
}

export interface MoonData {
  rise: string | null;
  set: string | null;
  fraction: number; // 0–1 illuminated fraction
  phase: number; // 0–1 (0 = new, 0.5 = full, 1 = new again)
  phaseName: string;
  angle: number;
}

export interface AlmanacData {
  date: string; // YYYY-MM-DD
  sun: SunTimes;
  moon: MoonData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISOOrNull(d: Date | undefined): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString();
}

function getPhaseName(phase: number): string {
  if (phase < 0.033 || phase >= 0.967) return 'New Moon';
  if (phase < 0.233) return 'Waxing Crescent';
  if (phase < 0.267) return 'First Quarter';
  if (phase < 0.467) return 'Waxing Gibbous';
  if (phase < 0.533) return 'Full Moon';
  if (phase < 0.733) return 'Waning Gibbous';
  if (phase < 0.767) return 'Last Quarter';
  return 'Waning Crescent';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Compute almanac data for a given date and location.
 *
 * @param date  The date/time to compute for. Pass noon-UTC for the target day.
 * @param lat   Latitude in decimal degrees (positive = north)
 * @param lon   Longitude in decimal degrees (positive = east)
 */
export function computeAlmanac(date: Date, lat: number, lon: number): AlmanacData {
  //console.log('[AlmanacCalculator] date/lat/long', { date, lat, lon });
  const dateStr = date.toISOString().slice(0, 10);

  const sunTimes = SunCalc.getTimes(date, lat, lon);
  const moonIllum = SunCalc.getMoonIllumination(date);
  const moonTimes = SunCalc.getMoonTimes(date, lat, lon);
  //console.log('[AlmanacCalculator] moonTimes', moonTimes);

  const sunriseDate = sunTimes.sunrise;
  const sunsetDate = sunTimes.sunset;

  let dayLengthSeconds = 0;
  if (sunriseDate && sunsetDate && !isNaN(sunriseDate.getTime()) && !isNaN(sunsetDate.getTime())) {
    dayLengthSeconds = Math.max(0, (sunsetDate.getTime() - sunriseDate.getTime()) / 1000);
  }

  return {
    date: dateStr,
    sun: {
      sunrise: toISOOrNull(sunriseDate),
      sunset: toISOOrNull(sunsetDate),
      solarNoon: toISOOrNull(sunTimes.solarNoon),
      dawn: toISOOrNull(sunTimes.dawn),
      dusk: toISOOrNull(sunTimes.dusk),
      goldenHourEnd: toISOOrNull(sunTimes.goldenHourEnd),
      goldenHour: toISOOrNull(sunTimes.goldenHour),
      dayLengthSeconds,
    },
    moon: {
      rise: toISOOrNull((moonTimes as { rise?: Date }).rise),
      set: toISOOrNull((moonTimes as { set?: Date }).set),
      fraction: moonIllum.fraction,
      phase: moonIllum.phase,
      phaseName: getPhaseName(moonIllum.phase),
      angle: moonIllum.angle,
    },
  };
}
