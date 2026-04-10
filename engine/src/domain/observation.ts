// Canonical interval weather observation.
// All numeric values in SI units unless otherwise noted.
// Extended/event sensors (lightning, soil, extra channels) are stored
// in the readings table — see storage/adapter.ts.
export interface Observation {
  timestamp: number; // Unix epoch, seconds
  stationId: string;

  // Temperature °C
  tempIndoor?: number;
  tempOutdoor?: number;
  tempDewpoint?: number;
  tempFeelsLike?: number;

  // Humidity %
  humidityIndoor?: number;
  humidityOutdoor?: number;

  // Atmospheric
  vpd?: number;             // Vapour Pressure Deficit kPa

  // Pressure hPa
  pressureAbsolute?: number;
  pressureRelative?: number;

  // Wind
  windSpeed?: number; // m/s
  windGust?: number; // m/s
  windDirection?: number; // degrees 0–360

  // Rain mm
  rainRate?: number; // mm/hr
  rainDaily?: number;
  rainWeekly?: number;
  rainMonthly?: number;
  rainYearly?: number;
  rainEvent?: number;

  // Solar
  solarRadiation?: number; // W/m²
  uvIndex?: number;
}
