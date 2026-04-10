import type { Observation, TodayStats } from "@/lib/types.ts";
import ConditionCard from "./ConditionCard.tsx";

interface ConditionsGridProps {
  obs: Observation | null;
  todayStats?: TodayStats | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(val: number | undefined | null, decimals: number): string {
  if (val === undefined || val === null) return "—";
  return val.toFixed(decimals);
}

function fmtTime(epochSec: number | null | undefined): string {
  if (epochSec === null || epochSec === undefined) return "";
  return new Date(epochSec * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function speedToBeaufort(mps: number): number {
  if (mps < 0.3) return 0;
  if (mps < 1.6) return 1;
  if (mps < 3.4) return 2;
  if (mps < 5.5) return 3;
  if (mps < 8.0) return 4;
  if (mps < 10.8) return 5;
  if (mps < 13.9) return 6;
  if (mps < 17.2) return 7;
  if (mps < 20.8) return 8;
  if (mps < 24.5) return 9;
  if (mps < 28.5) return 10;
  if (mps < 32.7) return 11;
  return 12;
}

const COMPASS_DIRS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function degreesToCompass(deg: number): string {
  return COMPASS_DIRS[Math.round(deg / 22.5) % 16];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConditionsGrid({ obs, todayStats }: ConditionsGridProps) {
  if (!obs) {
    return (
      <div class="card text-center py-8">
        <p style="color: var(--color-muted);">No observations recorded yet.</p>
        <p class="text-sm mt-2" style="color: var(--color-muted);">
          Make sure the engine is running and the station is configured.
        </p>
      </div>
    );
  }

  const s = todayStats ?? null;

  // Temp
  const tempTopRight = s ? {
    label: fmtTime(s.temp_min_time),
    value: s.temp_min !== null ? `${s.temp_min.toFixed(1)}°C` : "—",
  } : undefined;
  const tempBottomRight = s ? {
    label: fmtTime(s.temp_max_time),
    value: s.temp_max !== null ? `${s.temp_max.toFixed(1)}°C` : "—",
  } : undefined;

  // Humidity
  const humTopRight = s ? {
    label: fmtTime(s.humidity_min_time),
    value: s.humidity_min !== null ? `${s.humidity_min.toFixed(0)}%` : "—",
  } : undefined;
  const humBottomRight = s ? {
    label: fmtTime(s.humidity_max_time),
    value: s.humidity_max !== null ? `${s.humidity_max.toFixed(0)}%` : "—",
  } : undefined;

  // Pressure
  const presTopRight = s ? {
    label: fmtTime(s.pressure_min_time),
    value: s.pressure_min !== null ? `${s.pressure_min.toFixed(1)} hPa` : "—",
  } : undefined;
  const presBottomRight = s ? {
    label: fmtTime(s.pressure_max_time),
    value: s.pressure_max !== null ? `${s.pressure_max.toFixed(1)} hPa` : "—",
  } : undefined;

  // Wind speed
  const windTopRight = s ? {
    label: "Avg",
    value: s.wind_speed_avg !== null ? `${s.wind_speed_avg.toFixed(1)} m/s` : "—",
  } : undefined;
  const windBottomRight = s ? {
    label: fmtTime(s.wind_speed_max_time),
    value: s.wind_speed_max !== null
      ? `${s.wind_speed_max.toFixed(1)} m/s${
          s.wind_dir_at_max !== null ? ` ${degreesToCompass(s.wind_dir_at_max)}` : ""
        }`
      : "—",
  } : undefined;

  // Rain
  const rainTopRight = s ? {
    label: "Rate",
    value: s.rain_rate_max !== null ? `${s.rain_rate_max.toFixed(1)} mm/h` : "—",
  } : undefined;
  const rainBottomRight = s ? {
    label: "Today",
    value: s.rain_today !== null ? `${s.rain_today.toFixed(1)} mm` : "—",
  } : undefined;

  // Dew point
  const dewTopRight = s ? {
    label: fmtTime(s.dew_point_min_time),
    value: s.dew_point_min !== null ? `${s.dew_point_min.toFixed(1)}°C` : "—",
  } : undefined;
  const dewBottomRight = s ? {
    label: fmtTime(s.dew_point_max_time),
    value: s.dew_point_max !== null ? `${s.dew_point_max.toFixed(1)}°C` : "—",
  } : undefined;

  // UV
  const uvTopRight = s ? {
    label: "Max",
    value: s.uv_max !== null ? s.uv_max.toFixed(0) : "—",
  } : undefined;

  // Indoor temp
  const indoorTopRight = s ? {
    label: fmtTime(s.temp_indoor_min_time),
    value: s.temp_indoor_min !== null ? `${s.temp_indoor_min.toFixed(1)}°C` : "—",
  } : undefined;
  const indoorBottomRight = s ? {
    label: fmtTime(s.temp_indoor_max_time),
    value: s.temp_indoor_max !== null ? `${s.temp_indoor_max.toFixed(1)}°C` : "—",
  } : undefined;

  // Solar
  const solarTopRight = s ? {
    label: "Max",
    value: s.solar_max !== null ? `${s.solar_max.toFixed(0)} W/m²` : "—",
  } : undefined;

  // Wind direction rotation
  const windDirDeg = obs.windDirection ?? 0;

  return (
    <div class="space-y-4">
      {/* Row 1: core conditions */}
      <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));">
        <ConditionCard
          label="Temperature" value={fmt(obs.tempOutdoor, 1)} unit="°C"
          icon="wi-thermometer"
          topRight={tempTopRight} bottomRight={tempBottomRight}
        />
        <ConditionCard
          label="Indoor Temp" value={fmt(obs.tempIndoor, 1)} unit="°C"
          icon="wi-thermometer"
          topRight={indoorTopRight} bottomRight={indoorBottomRight}
        />
        <ConditionCard
          label="Rain" value={fmt(obs.rainRate, 1)} unit="mm/h"
          icon="wi-rain"
          topRight={rainTopRight} bottomRight={rainBottomRight}
        />
        <ConditionCard
          label="Humidity" value={fmt(obs.humidityOutdoor, 0)} unit="%"
          icon="wi-humidity"
          topRight={humTopRight} bottomRight={humBottomRight}
        />
        <ConditionCard
          label="Pressure" value={fmt(obs.pressureRelative, 1)} unit="hPa"
          icon="wi-barometer"
          topRight={presTopRight} bottomRight={presBottomRight}
        />
        <ConditionCard
          label="Wind Speed" value={fmt(obs.windSpeed, 1)} unit="m/s"
          icon="wi-strong-wind"
          topRight={windTopRight} bottomRight={windBottomRight}
        />
        <ConditionCard
          label="Wind Gust" value={fmt(obs.windGust, 1)} unit="m/s"
          icon="wi-windy"
          rightIcon={obs.windGust !== undefined ? `wi-wind-beaufort-${speedToBeaufort(obs.windGust)}` : undefined}
        />
        <ConditionCard
          label="Wind Dir"
          value={fmt(obs.windDirection, 0)}
		  unit="°"
          valueSupplemental={obs.windDirection !== undefined ? degreesToCompass(obs.windDirection) : undefined}
          icon="wi-windy"
          rightIcon={`wi-wind towards-${Math.round(windDirDeg)}-deg`}
        />
      </div>

      {/* Row 2: supplemental readings */}
      <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));">
        <ConditionCard
          label="Dew Point" value={fmt(obs.tempDewpoint, 1)} unit="°C"
          icon="wi-raindrop"
          topRight={dewTopRight} bottomRight={dewBottomRight}
        />
        <ConditionCard
          label="UV Index" value={fmt(obs.uvIndex, 0)}
          icon="wi-day-sunny"
          topRight={uvTopRight}
        />
        <ConditionCard
          label="Solar Rad." value={fmt(obs.solarRadiation, 0)} unit="W/m²"
          icon="wi-day-haze"
          topRight={solarTopRight}
        />
      </div>
    </div>
  );
}
