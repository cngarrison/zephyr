# Configuring Zephyr

## Config file discovery

Zephyr locates its configuration file in the following order:

1. `--config <path>` CLI flag
2. `$ZEPHYR_CONFIG` environment variable
3. `/etc/zephyr/zephyr.toml` (default)

Both the engine and web daemons use the same file.

### Security

The config file may contain database credentials. Restrict access:

```sh
sudo chown root:zephyr /etc/zephyr/zephyr.toml
sudo chmod 640 /etc/zephyr/zephyr.toml
```

---

## Full annotated example

```toml
# /etc/zephyr/zephyr.toml

[engine]
# Port the engine daemon listens on for /api/* and /ingest/* requests.
port = 8080
host = "0.0.0.0"

[web]
# URL the web daemon uses to reach the engine (server-side proxy calls).
# Change this if engine runs on a different host or port.
engine_url = "http://localhost:8080"
# Note: the web daemon's own listen port and hostname are set via the
# PORT and HOSTNAME environment variables in the systemd unit file,
# NOT in this file. See below.

[storage]
# Storage provider: "sqlite" (default) or "mysql"
provider = "sqlite"

[storage.sqlite]
path = "/var/lib/zephyr/zephyr.db"

# Uncomment and configure for MySQL:
# [storage.mysql]
# host     = "localhost"
# port     = 3306
# user     = "zephyr"
# password = "changeme"
# database = "zephyr"

[[stations]]
# Stable identifier used as the primary key in the database.
# Do not change this after data has been collected.
id       = "home"
name     = "Home Weather"
lat      = 51.5074
lon      = -0.1278
altitude = 10          # metres above sea level
timezone = "Europe/London"

[stations.ingest.push]
# Accept incoming HTTP push from weather stations (WU / Ecowitt protocol).
enabled    = true
debug_dump = false     # set true to log raw ingest payloads

[stations.ingest.push.device_ids]
# Map protocol name → device identifier.
# Empty string = accept any device (fine for single-station setups).
wu      = ""
ecowitt = ""

[stations.ingest.poll]
# Poll a device over its local LAN API.
enabled          = false
gw_host          = "192.168.1.100"
gw_port          = 45000
interval_seconds = 60
```

---

## Section reference

### `[engine]`

| Key | Type | Default | Description |
|---|---|---|---|
| `port` | integer | `8080` | TCP port for the engine HTTP server |
| `host` | string | `"0.0.0.0"` | Bind address |

### `[web]`

| Key | Type | Default | Description |
|---|---|---|---|
| `engine_url` | string | `"http://localhost:8080"` | Engine base URL used by web server-side proxy |

> **`PORT` / `HOSTNAME` for the web daemon** are process environment variables set in the systemd unit file (`Environment=PORT=8081`), not in `zephyr.toml`. Fresh reads `PORT` before user code runs, so it cannot be read from TOML.

### `[storage]`

| Key | Type | Default | Description |
|---|---|---|---|
| `provider` | string | `"sqlite"` | `"sqlite"` or `"mysql"` |

For `provider = "sqlite"`, configure `[storage.sqlite]`; for `"mysql"`, configure `[storage.mysql]`.

### `[[stations]]`

Array of tables — one entry per weather station. The first entry is the default station shown in the web UI.

| Key | Type | Description |
|---|---|---|
| `id` | string | Stable slug — used as `station_id` in the DB. Never change after first use. |
| `name` | string | Display name shown in the UI |
| `lat` | float | Latitude (decimal degrees, WGS84) |
| `lon` | float | Longitude (decimal degrees, WGS84) |
| `altitude` | integer | Metres above sea level |
| `timezone` | string | IANA timezone name (e.g. `"America/New_York"`) |

### `[stations.ingest.push]`

Controls the HTTP push receiver (`/ingest/wu`, `/ingest/ecowitt`).

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Enable push ingestion |
| `debug_dump` | bool | `false` | Log raw incoming payloads |

### `[stations.ingest.push.device_ids]`

Maps protocol name to an expected device identifier. An empty string accepts any device — appropriate for single-station setups.

```toml
[stations.ingest.push.device_ids]
wu      = ""        # Weather Underground PASSKEY or empty
ecowitt = ""        # Ecowitt MAC/PASSKEY or empty
```

### `[stations.ingest.poll]`

Controls the LAN poller. Currently supports Ecowitt GW-series gateways (GW1000, GW1100, GW2000).

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Enable LAN polling |
| `gw_host` | string | — | IP address of the gateway |
| `gw_port` | integer | `45000` | Gateway local API port |
| `interval_seconds` | integer | `60` | Poll interval in seconds |
