# Building a Web Consumer

Zephyr's engine exposes a plain REST API — you don't have to use the built-in Fresh web UI. You can build any alternative frontend (static HTML, React app, Home Assistant integration, etc.) that polls the engine directly.

For the full endpoint reference, see [api.md](api.md).

---

## What the engine provides

| Endpoint | Returns |
|---|---|
| `GET /api/observations/latest` | Most recent observation (all sensors) |
| `GET /api/observations/range` | Raw observations between two timestamps |
| `GET /api/observations/aggregate` | Bucketed min/max/avg (hour or day) |
| `GET /api/observations/today` | Today’s high/low/total summary |
| `GET /api/almanac` | Sunrise/sunset + moon phase |
| `GET /api/config` | Station name, location, timezone |

All values are SI units (°C, hPa, m/s, mm). All timestamps are epoch seconds.

---

## Base URL

The engine listens on port `8080` by default. If you're building a consumer that runs in a browser, you have two options:

**Option A — talk directly to the engine:**
```
http://<zephyr-host>:8080
```

**Option B — proxy through the web daemon:**
```
http://<zephyr-host>:8081/api
```

The built-in web UI uses option B (same-origin proxy) so browser security policies are a non-issue. For external consumers, option A is simpler.

**CORS:** The engine does not currently restrict CORS origins — cross-origin browser requests are accepted.

**Auth:** No authentication is currently required on any API endpoint.

---

## Minimal example — polling `/api/observations/latest`

A self-contained HTML page that refreshes every 60 seconds:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Weather</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; }
    #data { margin-top: 1rem; white-space: pre; }
  </style>
</head>
<body>
  <h1>Current Conditions</h1>
  <div id="data">Loading...</div>

  <script>
    const ENGINE = 'http://zephyr.local:8080';  // ← change this

    async function update() {
      try {
        const res  = await fetch(`${ENGINE}/api/observations/latest`);
        const obs  = await res.json();

        const ts   = new Date(obs.timestamp * 1000).toLocaleTimeString();
        const temp = obs.temp_c   != null ? `${obs.temp_c.toFixed(1)} °C`  : '—';
        const hum  = obs.humidity != null ? `${obs.humidity} %`            : '—';
        const pres = obs.pressure_hpa != null
          ? `${obs.pressure_hpa.toFixed(1)} hPa` : '—';
        const wind = obs.wind_speed_ms != null
          ? `${obs.wind_speed_ms.toFixed(1)} m/s` : '—';

        document.getElementById('data').textContent = [
          `Updated:     ${ts}`,
          `Temperature: ${temp}`,
          `Humidity:    ${hum}`,
          `Pressure:    ${pres}`,
          `Wind:        ${wind}`,
        ].join('\n');
      } catch (e) {
        document.getElementById('data').textContent = `Error: ${e.message}`;
      }
    }

    update();
    setInterval(update, 60_000);
  </script>
</body>
</html>
```

---

## Fetching a time range

```javascript
const ENGINE = 'http://zephyr.local:8080';

async function getLast24h() {
  const to   = Math.floor(Date.now() / 1000);
  const from = to - 86400;  // 24 hours ago

  const res  = await fetch(`${ENGINE}/api/observations/range?from=${from}&to=${to}`);
  const data = await res.json();  // Observation[]
  return data;
}
```

## Fetching hourly aggregates

```javascript
async function getHourlyAggregates(fromEpoch, toEpoch) {
  const url = `${ENGINE}/api/observations/aggregate` +
    `?from=${fromEpoch}&to=${toEpoch}&bucket=hour`;
  const res  = await fetch(url);
  const data = await res.json();  // AggregateObservation[]
  return data;
}
```

---

## Tips

- **Unit conversion:** All values arrive in SI. Multiply `temp_c * 9/5 + 32` for °F; multiply `wind_speed_ms * 2.237` for mph; multiply `pressure_hpa * 0.02953` for inHg.
- **Null values:** Any sensor field may be `null` if the device didn’t report it. Always guard before displaying.
- **Timestamps:** `obs.timestamp` is epoch seconds. Construct a JS `Date` with `new Date(obs.timestamp * 1000)`.
- **Station info:** Fetch `GET /api/config` once at startup to get the station name and timezone for display.
