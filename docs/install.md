# Installing Zephyr

## Quick install (one-liner)

```sh
curl -fsSL https://raw.githubusercontent.com/cngarrison/zephyr/main/install.sh | sh
```

To pin to a specific version:

```sh
curl -fsSL https://raw.githubusercontent.com/cngarrison/zephyr/main/install.sh | sh -s -- --version v0.1.0
```

The script downloads the correct archive for your platform, extracts the binaries to `/usr/local/bin/`, creates the `zephyr` system user, sets up `/etc/zephyr/` and `/var/lib/zephyr/`, installs the systemd units, and copies the example config.

---

## Install from .deb (Debian / Ubuntu / Raspberry Pi OS)

Download the `.deb` for your architecture from the [Releases page](https://github.com/cngarrison/zephyr/releases/latest):

| Architecture | Package |
|---|---|
| x86-64 | `zephyr_<version>_amd64.deb` |
| aarch64 | `zephyr_<version>_arm64.deb` |

```sh
# Example — aarch64
sudo dpkg -i zephyr_0.1.0_arm64.deb
```

The postinstall script creates the system user, directories, and enables the systemd target. Skip to [Post-install setup](#post-install-setup).

---

## Manual binary install

### 1. Download and extract

```sh
# Replace <version> and <platform> as appropriate
curl -fsSL https://github.com/cngarrison/zephyr/releases/download/<version>/zephyr-<platform>.tar.gz \
  | tar -xz -C /tmp/zephyr
```

Available `<platform>` values:

| Platform | Notes |
|---|---|
| `linux-x86_64` | Standard 64-bit Linux |
| `linux-aarch64` | 64-bit ARM — Raspberry Pi 4/5 running 64-bit OS |
| `darwin-aarch64` | Apple Silicon Mac — **development only** |

### 2. Copy binaries

```sh
sudo cp /tmp/zephyr/zephyr-engine /usr/local/bin/
sudo cp /tmp/zephyr/zephyr-web    /usr/local/bin/
sudo chmod +x /usr/local/bin/zephyr-engine /usr/local/bin/zephyr-web
```

### 3. Create system user

```sh
sudo useradd --system --no-create-home --home /var/lib/zephyr \
             --shell /usr/sbin/nologin zephyr
```

### 4. Create directories

```sh
sudo mkdir -p /etc/zephyr /var/lib/zephyr /run/zephyr
sudo chown zephyr:zephyr /var/lib/zephyr /run/zephyr
sudo chmod 750 /var/lib/zephyr
```

### 5. Install systemd units

Download or copy the unit files from [`deploy/systemd/`](../deploy/systemd/) in the repository:

```sh
sudo cp deploy/systemd/zephyr-engine.service /etc/systemd/system/
sudo cp deploy/systemd/zephyr-web.service    /etc/systemd/system/
sudo cp deploy/systemd/zephyr.target         /etc/systemd/system/
sudo systemctl daemon-reload
```

### 6. Create config

```sh
sudo cp deploy/etc/zephyr.toml.example /etc/zephyr/zephyr.toml
sudo chown root:zephyr /etc/zephyr/zephyr.toml
sudo chmod 640 /etc/zephyr/zephyr.toml
```

Then edit `/etc/zephyr/zephyr.toml` — see the [Configuration guide](configure.md).

---

## Post-install setup

1. **Edit the config** — at minimum set your station's name, coordinates, and timezone:

   ```sh
   sudo nano /etc/zephyr/zephyr.toml
   ```

2. **Start the service:**

   ```sh
   sudo systemctl enable --now zephyr.target
   ```

3. **Check status and logs:**

   ```sh
   systemctl status zephyr-engine zephyr-web
   journalctl -u zephyr-engine -u zephyr-web -f
   ```

4. The web UI is available at `http://<host>:8081` by default. The engine REST API is on port `8080`.

---

## Supported platforms

| Platform | Target triple | Notes |
|---|---|---|
| Linux x86-64 | `linux-x86_64` | Standard server/desktop |
| Linux aarch64 | `linux-aarch64` | Raspberry Pi 4/5 (64-bit OS required) |
| macOS aarch64 | `darwin-aarch64` | Apple Silicon — **dev only**, no systemd |

> **Raspberry Pi note:** Raspberry Pi OS Lite (64-bit) is the recommended OS for Pi deployments. Verify you are running a 64-bit kernel with `uname -m` (should print `aarch64`).

---

## Building from source

For contributors and packagers. Requires [Deno](https://deno.com) ≥ 2.x.

```sh
git clone https://github.com/cngarrison/zephyr.git
cd zephyr

# Build Fresh/Vite assets (required before compiling web)
deno task build

# Compile both binaries for the current platform
deno task compile
```

Outputs are placed in `dist/`. Cross-compile targets are defined in the root `deno.json`.
