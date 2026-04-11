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

Copy the example config file and edit it before the services will start correctly:

```bash
sudo cp /etc/zephyr/zephyr.toml.example /etc/zephyr/zephyr.toml
sudo nano /etc/zephyr/zephyr.toml
```

Key values to set:

```toml
[[stations]]
id       = "home"
name     = "My Weather Station"
lat      = xx.xxxx
lon      = xx.xxxx
altitude = xx
timezone = "Australia/Sydney"   # IANA timezone string

[storage.sqlite]
path = "/var/lib/zephyr/zephyr.db"
```

The file is well-commented — see [`docs/configure.md`](./configure.md) for a full reference.

Set the correct permissions:

```bash
sudo chmod 640 /etc/zephyr/zephyr.toml
sudo chown root:zephyr /etc/zephyr/zephyr.toml
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
