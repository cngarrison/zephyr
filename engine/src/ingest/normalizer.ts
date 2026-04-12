import type { Observation } from '../domain/observation.ts';

/**
 * Magnus formula dew point calculation.
 * @param tempC  Outdoor temperature in °C
 * @param rhPct  Relative humidity in % (0–100)
 * @returns Dew point in °C
 */
function calcDewpoint(tempC: number, rhPct: number): number {
  const a = 17.625, b = 243.04;
  const gamma = Math.log(rhPct / 100) + (a * tempC) / (b + tempC);
  return (b * gamma) / (a - gamma);
}
import type { SensorReading } from '../storage/adapter.ts';
import { Units } from '../domain/units.ts';

export interface NormalizedData {
  observation: Observation;
  readings: SensorReading[];
}

// Weather Underground protocol query parameters (GW1000 push format).
export interface WuParams {
  ID?: string;
  tempf?: string;
  tempinf?: string;
  humidity?: string;
  humidityin?: string;
  baromin?: string;
  baromrelin?: string;
  winddir?: string;
  windspeedmph?: string;
  windgustmph?: string;
  rainratein?: string;
  dailyrainin?: string;
  weeklyrainin?: string;
  monthlyrainin?: string;
  yearlyrainin?: string;
  eventrainin?: string;
  solarradiation?: string;
  UV?: string;
  dateutc?: string;
  dewptf?: string; // dew point °F (some stations provide directly)
  vpd?: string; // vapour pressure deficit kPa
  [key: string]: string | undefined;
}

export function normalizeWu(params: WuParams, defaultStationId: string): NormalizedData {
  // Use server receive time, not the device-reported dateutc.
  // GW-series devices send local clock time in dateutc regardless of timezone
  // configuration, making the field unreliable for UTC timestamping.
  const ts = Math.floor(Date.now() / 1000);
  // Always use the configured station ID — the device's own push ID (params.ID)
  // is its hardware identifier and must not override the station name.
  const stationId = defaultStationId;

  const n = (key: string, convert?: (v: number) => number): number | undefined => {
    const raw = params[key];
    if (raw === undefined || raw === '') return undefined;
    const num = parseFloat(raw);
    if (isNaN(num)) return undefined;
    return convert ? convert(num) : num;
  };

  // Dew point: use station-provided value if available, otherwise calculate
  // from temperature + humidity via the Magnus formula.
  const _tempC = n('tempf', Units.fToC);
  const _rh = n('humidity');
  const tempDewpoint = n('dewptf', Units.fToC) ??
    (_tempC !== undefined && _rh !== undefined ? calcDewpoint(_tempC, _rh) : undefined);

  const observation: Observation = {
    timestamp: ts,
    stationId,
    tempOutdoor: _tempC,
    tempIndoor: n('tempinf', Units.fToC),
    tempDewpoint,
    humidityOutdoor: n('humidity'),
    humidityIndoor: n('humidityin'),
    vpd: n('vpd'),
    pressureAbsolute: n('baromin', Units.inHgToHpa),
    pressureRelative: n('baromrelin', Units.inHgToHpa),
    windDirection: n('winddir'),
    windSpeed: n('windspeedmph', Units.mphToMs),
    windGust: n('windgustmph', Units.mphToMs),
    // Piezo rain gauge preferred; fall back to standard tipping-bucket fields.
    rainRate: n('rrain_piezo', Units.inHrToMmHr) ?? n('rainratein', Units.inHrToMmHr),
    rainDaily: n('drain_piezo', Units.inToMm) ?? n('dailyrainin', Units.inToMm),
    rainWeekly: n('wrain_piezo', Units.inToMm) ?? n('weeklyrainin', Units.inToMm),
    rainMonthly: n('mrain_piezo', Units.inToMm) ?? n('monthlyrainin', Units.inToMm),
    rainYearly: n('yrain_piezo', Units.inToMm) ?? n('yearlyrainin', Units.inToMm),
    rainEvent: n('erain_piezo', Units.inToMm) ?? n('eventrainin', Units.inToMm),
    solarRadiation: n('solarradiation'),
    uvIndex: n('UV'),
  };

  const readings: SensorReading[] = [];
  const r = (sensorId: string, value: number | undefined): void => {
    if (value !== undefined) readings.push({ timestamp: ts, stationId, sensorId, value });
  };

  // Soil moisture + temperature (up to 8 channels)
  for (let i = 1; i <= 8; i++) {
    r(`soil.moisture.${i}`, n(`soilmoisture${i}`));
    r(`soil.temp.${i}`, n(`soiltemp${i}f`, Units.fToC));
  }

  // Extra temperature + humidity channels (up to 8)
  for (let i = 1; i <= 8; i++) {
    r(`temp.extra.${i}`, n(`temp${i}f`, Units.fToC));
    r(`humidity.extra.${i}`, n(`humidity${i}`));
  }

  // Leaf wetness (up to 4 channels)
  for (let i = 1; i <= 4; i++) {
    r(`leaf.wetness.${i}`, n(`leafwetness${i}`));
  }

  // Lightning (GW1000 WHTF01 sensor)
  r('lightning.count', n('lightning_num'));
  r('lightning.distance_km', n('lightning'));

  // Wind extras
  r('wind.dir_avg10m', n('winddir_avg10m'));
  r('wind.gust_daily_max', n('maxdailygust', Units.mphToMs));

  // Rain extras (standard accumulations not in primary observation)
  r('rain.hourly', n('hourlyrainin', Units.inToMm));
  r('rain.last24h', n('last24hrainin', Units.inToMm));
  r('rain.total', n('totalrainin', Units.inToMm));

  // Battery / power health
  r('battery.sensor1', n('batt1'));
  r('battery.wh90', n('wh90batt'));
  r('battery.ws90cap_v', n('ws90cap_volt'));

  return { observation, readings };
}

// Ecowitt protocol POST body (form-encoded; same imperial units as WU).
export interface EcowittParams {
  PASSKEY?: string;
  stationtype?: string;
  dateutc?: string;
  tempf?: string;
  tempinf?: string;
  humidity?: string;
  humidityin?: string;
  baromabsin?: string;
  baromrelin?: string;
  winddir?: string;
  windspeedmph?: string;
  windgustmph?: string;
  rainratein?: string;
  eventrainin?: string;
  dailyrainin?: string;
  weeklyrainin?: string;
  monthlyrainin?: string;
  yearlyrainin?: string;
  solarradiation?: string;
  uv?: string;
  lightning_num?: string;
  lightning?: string;
  [key: string]: string | undefined;
}

export function normalizeEcowitt(params: EcowittParams, defaultStationId: string): NormalizedData {
  // Ecowitt uses the same imperial values as WU; map keys and delegate.
  const mapped: WuParams = {
    ID: params.PASSKEY ?? defaultStationId,
    tempf: params.tempf,
    tempinf: params.tempinf,
    humidity: params.humidity,
    humidityin: params.humidityin,
    baromin: params.baromabsin,
    baromrelin: params.baromrelin,
    winddir: params.winddir,
    windspeedmph: params.windspeedmph,
    windgustmph: params.windgustmph,
    rainratein: params.rainratein,
    dailyrainin: params.dailyrainin,
    weeklyrainin: params.weeklyrainin,
    monthlyrainin: params.monthlyrainin,
    yearlyrainin: params.yearlyrainin,
    eventrainin: params.eventrainin,
    solarradiation: params.solarradiation,
    UV: params.uv,
    dateutc: params.dateutc,
    lightning_num: params.lightning_num,
    lightning: params.lightning,
    // Extra channels pass through via index signature
    ...params,
  };
  return normalizeWu(mapped, defaultStationId);
}
