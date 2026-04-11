# REST API Reference

The engine exposes a REST API on `http://<host>:8080` (default). All responses are JSON.

**Conventions:**
- Timestamps are **epoch seconds** (integer)
- All measurement values are in **SI units** (°C, hPa, m/s, mm, etc.)
- The web daemon proxies these endpoints from `/api/*` to the engine

---

## Endpoints

### `GET /api/observations/latest`

Returns the most recent observation for the default station.

**Query params:** none

**Response:**
```json
{
  "station_id": "home",
  "timestamp": 1744361035,
  "temp_c": 12.4,
  "dew_point_c": 8.1,
  "humidity": 74,
  "pressure_hpa": 1013.2,
  "wind_speed_ms": 2.1,
  "wind_gust_ms": 3.8,
  "wind_dir_deg": 245,
  "rain_mm": 0.0,
  "rain_rate_mm_hr": 0.0,
  "uv_index": 1.2,
  "solar_radiation_wm2": 310.0
}
```

**Example:**
```sh
curl http://localhost:8080/api/observations/latest
```

---

### `GET /api/observations`

Returns recent observations (default: last 100).

**Query params:**

| Param | Type | Description |
|---|---|---|
| `limit` | integer | Max records to return (default: 100) |
| `station_id` | string | Filter by station (optional) |

**Response:** Array of observation objects (same shape as `/latest`).

**Example:**
```sh
curl "http://localhost:8080/api/observations?limit=50"
```

---

### `GET /api/observations/range`

Returns all observations between two epoch timestamps.

**Query params:**

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | integer | Yes | Start timestamp (epoch seconds, inclusive) |
| `to` | integer | Yes | End timestamp (epoch seconds, inclusive) |
| `station_id` | string | No | Filter by station |

**Response:** Array of observation objects.

**Example:**
```sh
# Last 24 hours
FROM=$(date -d '24 hours ago' +%s)
TO=$(date +%s)
curl "http://localhost:8080/api/observations/range?from=$FROM&to=$TO"
```

---

### `GET /api/observations/aggregate`

Returns time-bucketed aggregate observations (min/max/avg per bucket).

**Query params:**

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | integer | Yes | Start timestamp (epoch seconds) |
| `to` | integer | Yes | End timestamp (epoch seconds) |
| `bucket` | string | Yes | `hour` or `day` |
| `station_id` | string | No | Filter by station |

**Response:**
```json
[
  {
    "bucket": 1744358400,
    "temp_avg_c": 11.8,
    "temp_min_c": 10.2,
    "temp_max_c": 13.4,
    "humidity_avg": 76,
    "pressure_avg_hpa": 1012.8,
    "wind_avg_ms": 1.9,
    "wind_max_ms": 4.2,
    "rain_total_mm": 0.4,
    "uv_max": 2.1
  }
]
```

**Example:**
```sh
FROM=$(date -d '7 days ago' +%s)
TO=$(date +%s)
curl "http://localhost:8080/api/observations/aggregate?from=$FROM&to=$TO&bucket=hour"
```

---

### `GET /api/observations/today`

Returns today's summary statistics (high/low/total) for the default station.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `tz` | string | IANA timezone for midnight calculation (defaults to station timezone from config) |

**Response:**
```json
{
  "temp_min_c": 8.3,
  "temp_max_c": 15.1,
  "temp_min_time": 1744326000,
  "temp_max_time": 1744358400,
  "wind_max_ms": 6.2,
  "wind_max_time": 1744340000,
  "wind_max_dir_deg": 210,
  "rain_total_mm": 1.2,
  "pressure_min_hpa": 1010.1,
  "pressure_max_hpa": 1014.5
}
```

**Example:**
```sh
curl "http://localhost:8080/api/observations/today?tz=Europe%2FLondon"
```

---

### `GET /api/almanac`

Returns sunrise/sunset and moon phase data for a given date and station location.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `date` | string | `YYYY-MM-DD` (defaults to today UTC) |

**Response:**
```json
{
  "sun": {
    "sunrise": 1744337820,
    "sunset": 1744385640,
    "dawn": 1744335300,
    "dusk": 1744388160,
    "dayLengthSeconds": 47820
  },
  "moon": {
    "phase": 0.43,
    "phaseName": "Waxing Gibbous",
    "illumination": 0.81,
    "rise": 1744352100,
    "set": 1744398000
  }
}
```

**Example:**
```sh
curl "http://localhost:8080/api/almanac?date=2026-04-11"
```

---

### `GET /api/config`

Returns public station configuration (safe to expose to the UI).

**Query params:** none

**Response:**
```json
{
  "station": {
    "id": "home",
    "name": "Home Weather",
    "lat": 51.5074,
    "lon": -0.1278,
    "altitude": 10,
    "timezone": "Europe/London"
  }
}
```

**Example:**
```sh
curl http://localhost:8080/api/config
```
