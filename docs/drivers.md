# Writing an Ingest Driver

Zephyr supports two ingest patterns:

| Type | Description | Example |
|---|---|---|
| **HTTP push** | Weather station POSTs or GETs to the engine | WU protocol, Ecowitt protocol |
| **LAN poller** | Engine polls the device on a schedule | Device local HTTP API (currently: Ecowitt GW-series) |

All drivers must produce an `Observation` in SI units and use server receive time for the timestamp.

---

## The `Observation` type

Defined in `engine/src/domain/observation.ts`:

```typescript
export interface Observation {
  station_id:         string;
  timestamp:          number;    // epoch seconds — always use Date.now() / 1000

  temp_c?:            number;    // °C
  dew_point_c?:       number;    // °C
  humidity?:          number;    // % (0–100)
  pressure_hpa?:      number;    // hPa (sea-level)
  wind_speed_ms?:     number;    // m/s
  wind_gust_ms?:      number;    // m/s
  wind_dir_deg?:      number;    // degrees (0–360)
  rain_mm?:           number;    // mm (event total)
  rain_rate_mm_hr?:   number;    // mm/hr
  uv_index?:          number;
  solar_radiation_wm2?: number;  // W/m²
}
```

**Key rules:**
- **SI units only.** Convert from imperial in your driver. Unit helpers are in `engine/src/domain/units.ts`.
- **Use server receive time** (`Math.floor(Date.now() / 1000)`) for `timestamp`. Never trust device-reported time — device clocks can be wrong or in local time.
- All measurement fields are optional; populate what the device provides.

---

## Adding a push driver

Push drivers handle inbound HTTP requests from a weather station.

### 1. Add a normalizer

Create a function in `engine/src/ingest/normalizer.ts` that converts the raw query params or body to an `Observation`:

```typescript
import { fToC, inHgToHPa, mphToMs, inToMm } from "../domain/units.ts";
import type { Observation } from "../domain/observation.ts";

export function normalizeMyProtocol(
  params: Record<string, string>,
  stationId: string,
): Observation {
  return {
    station_id: stationId,
    timestamp:  Math.floor(Date.now() / 1000),  // always server time
    temp_c:     params.tempf    ? fToC(parseFloat(params.tempf))       : undefined,
    humidity:   params.humidity ? parseFloat(params.humidity)          : undefined,
    pressure_hpa: params.baromin ? inHgToHPa(parseFloat(params.baromin)) : undefined,
    // ... map remaining fields
  };
}
```

### 2. Add a route handler

Add a handler in `engine/src/ingest/push.ts`:

```typescript
case "/ingest/myprotocol": {
  const params = Object.fromEntries(url.searchParams);
  const obs = normalizeMyProtocol(params, config.stations[0].id);
  await storage.saveObservation(obs);
  return new Response("OK", { status: 200 });
}
```

### 3. Configure your station

Point your weather station to `http://<engine-host>:8080/ingest/myprotocol`.

Add any device ID filtering to `[stations.ingest.push.device_ids]` in `zephyr.toml`.

---

## Adding a poller driver

Pollers run on a timer and pull data from the device over the network.

### 1. Create a poller module

Add a file such as `engine/src/ingest/pollers/my-device.ts`:

```typescript
import type { StorageAdapter } from "../../storage/adapter.ts";
import type { StationConfig } from "../../config.ts";
import type { Observation } from "../../domain/observation.ts";

export async function pollMyDevice(
  host: string,
  port: number,
  station: StationConfig,
  storage: StorageAdapter,
): Promise<void> {
  const url = `http://${host}:${port}/device/realtime`;
  const res = await fetch(url);
  if (!res.ok) return;

  const data = await res.json();

  const obs: Observation = {
    station_id: station.id,
    timestamp:  Math.floor(Date.now() / 1000),  // server receive time
    temp_c:     data.temperature_c,
    humidity:   data.humidity,
    // ... map remaining fields
  };

  await storage.saveObservation(obs);
}
```

### 2. Wire into the poll loop

In `engine/src/ingest/poller.ts`, import and call your function from the interval callback, using the poll config from `config.stations[0].ingest.poll`.

### 3. Enable in config

```toml
[stations.ingest.poll]
enabled          = true
gw_host          = "192.168.1.50"
gw_port          = 8000
interval_seconds = 30
```

---

## Porting from weewx

The [weewx fork](https://github.com/cngarrison/weewx) in the `weewx` datasource is a useful reference for device protocol details and unit conversion patterns. weewx drivers are Python but the protocol parsing logic maps directly to TypeScript.

Key differences when porting:
- weewx stores imperial units internally; Zephyr stores SI. Apply conversions in the normalizer.
- weewx uses the device-reported `dateTime`; Zephyr always uses server receive time.
- weewx drivers register via Python class hierarchy; Zephyr drivers are plain functions.
