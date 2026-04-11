# Installing Zephyr from a `.deb` package

This guide covers installing Zephyr on a Debian/Ubuntu server using the
pre-built `.deb` package from a GitHub Release.

## Prerequisites

- Debian 11+ or Ubuntu 22.04+ (amd64 or arm64)
- `systemd` as the init system
- `sudo` / root access

## 1. Download the package

Find the correct architecture for your server:

```bash
dpkg --print-architecture   # amd64  or  arm64
```

Download the matching `.deb` from the [Releases page](https://github.com/cngarrison/zephyr/releases):

```bash
# Replace <version> and <arch> as appropriate, e.g. 0.1.1 and amd64
wget https://github.com/cngarrison/zephyr/releases/download/v<version>/zephyr_<version>_<arch>.deb
```

## 2. Install

Use `apt` rather than `dpkg -i` so that the `systemd` dependency is resolved
automatically:

```bash
sudo apt install ./zephyr_<version>_<arch>.deb
```

The package will:
- Create the `zephyr` system user
- Install binaries to `/usr/local/bin/`
- Install systemd units to `/lib/systemd/system/`
- Create `/etc/zephyr/` with example config files
- Create `/var/lib/zephyr/` (data directory)
- Enable and attempt to start `zephyr.target`

## 3. Configure

Copy the example env files and edit them before the services will work
correctly:

```bash
sudo cp /etc/zephyr/engine.env.example /etc/zephyr/engine.env
sudo cp /etc/zephyr/web.env.example    /etc/zephyr/web.env
sudo cp /etc/zephyr/app.env.example    /etc/zephyr/app.env
```

Edit each file:

```bash
sudo nano /etc/zephyr/app.env      # station name, lat/lon, timezone
sudo nano /etc/zephyr/engine.env   # ENGINE_PORT, DB_PROVIDER, SQLITE_PATH, etc.
sudo nano /etc/zephyr/web.env      # PORT, WEB_ENGINE_URL
```

Key values to set in `app.env`:

```bash
STATION_NAME=My Weather Station
STATION_LAT=xx.xxxx
STATION_LON=xx.xxxx
STATION_ALTITUDE_M=xx
STATION_TIMEZONE=Australia/Sydney   # IANA timezone string
```

Key values to set in `engine.env`:

```bash
ENGINE_PORT=8080
DB_PROVIDER=sqlite
SQLITE_PATH=/var/lib/zephyr/zephyr.db
```

Key values to set in `web.env`:

```bash
PORT=8081
WEB_ENGINE_URL=http://127.0.0.1:8080
```

## 4. Start

```bash
sudo systemctl start zephyr.target
sudo systemctl status zephyr.target
```

## 5. Check logs

```bash
# Follow live logs from both services
journalctl -u zephyr-engine -u zephyr-web -f

# Or individually
journalctl -u zephyr-engine --since today
journalctl -u zephyr-web --since today
```

## Upgrading

Download the new `.deb` and re-install. The package will stop services,
update binaries, and restart automatically:

```bash
sudo apt install ./zephyr_<new-version>_<arch>.deb
```

Your config files in `/etc/zephyr/` and data in `/var/lib/zephyr/` are
preserved.

## Removing

```bash
# Remove binaries and units; keep /etc/zephyr and /var/lib/zephyr
sudo apt remove zephyr

# Remove everything including config, data, and the zephyr system user
sudo apt purge zephyr
```
