#!/usr/bin/env bash
# Zephyr install / upgrade script.
#
# One-liner usage (always installs latest release):
#   curl -fsSL https://raw.githubusercontent.com/cngarrison/zephyr/main/scripts/install.sh | sudo bash
#
# Pin to a specific version:
#   curl -fsSL https://raw.githubusercontent.com/cngarrison/zephyr/main/scripts/install.sh | sudo bash -s v0.1.1
#
# Or download and run locally:
#   sudo bash scripts/install.sh [v<version>]
#
# This script installs from a release tarball.  For .deb-based installs on
# Debian/Ubuntu see docs/deb-install.md.
set -euo pipefail

GITHUB_REPO="cngarrison/zephyr"
INSTALL_DIR="/usr/local/bin"
SYSTEMD_DIR="/lib/systemd/system"
CONFIG_DIR="/etc/zephyr"
DATA_DIR="/var/lib/zephyr"

# ── helpers ────────────────────────────────────────────────────────────────────

die()  { echo "error: $*" >&2; exit 1; }
info() { echo "  ▶ $*"; }
ok()   { echo "  ✅ $*"; }

# ── checks ───────────────────────────────────────────────────────────────────

[ "$(uname -s)" = "Linux" ] \
  || die "This script only supports Linux.  For macOS, download the tarball from the releases page."

[ "$(id -u)" -eq 0 ] \
  || die "Must be run as root (try: sudo bash $0 $*)"

for cmd in curl tar systemctl; do
  command -v "$cmd" > /dev/null 2>&1 \
    || die "Required command not found: $cmd"
done

# ── architecture ─────────────────────────────────────────────────────────────

case "$(uname -m)" in
  x86_64)  ARCH="linux-amd64" ;;
  aarch64) ARCH="linux-arm64" ;;
  *)       die "Unsupported architecture: $(uname -m). Supported: x86_64, aarch64" ;;
esac

# ── version ───────────────────────────────────────────────────────────────────

# Accept an optional version argument (with or without leading v).
if [ -n "${1:-}" ]; then
  TAG="v${1#v}"   # normalise: strip leading v then re-add
else
  info "Fetching latest release version from GitHub..."
  TAG=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
    | grep '"tag_name"' \
    | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  [ -n "$TAG" ] || die "Could not determine latest release version."
fi

VERSION="${TAG#v}"
TARBALL="zephyr-${TAG}-${ARCH}.tar.gz"
URL="https://github.com/${GITHUB_REPO}/releases/download/${TAG}/${TARBALL}"

echo ""
echo "Installing Zephyr ${TAG} (${ARCH})"
echo ""

# ── download ───────────────────────────────────────────────────────────────────

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

info "Downloading ${TARBALL}..."
curl -fsSL --progress-bar "$URL" -o "$TMP/$TARBALL" \
  || die "Download failed.  Check that ${TAG} exists at https://github.com/${GITHUB_REPO}/releases"

info "Extracting..."
tar -xzf "$TMP/$TARBALL" -C "$TMP"

# ── install binaries ───────────────────────────────────────────────────────────

info "Installing binaries to ${INSTALL_DIR}/..."
install -m 755 "$TMP/zephyr-engine" "${INSTALL_DIR}/zephyr-engine"
install -m 755 "$TMP/zephyr-web"    "${INSTALL_DIR}/zephyr-web"
ok "zephyr-engine, zephyr-web installed."

# ── install systemd units ─────────────────────────────────────────────────────

if [ -d "$TMP/deploy/systemd" ]; then
  info "Installing systemd units to ${SYSTEMD_DIR}/..."
  install -m 644 "$TMP/deploy/systemd/zephyr-engine.service" "${SYSTEMD_DIR}/"
  install -m 644 "$TMP/deploy/systemd/zephyr-web.service"    "${SYSTEMD_DIR}/"
  install -m 644 "$TMP/deploy/systemd/zephyr.target"         "${SYSTEMD_DIR}/"
  ok "Systemd units installed."
fi

# ── config directory ──────────────────────────────────────────────────────────

mkdir -p "${CONFIG_DIR}"

# Copy example files; never overwrite files the operator has already edited.
if [ -d "$TMP/deploy/etc" ]; then
  for f in engine.env web.env app.env; do
    EXAMPLE_SRC="$TMP/deploy/etc/${f}.example"
    EXAMPLE_DST="${CONFIG_DIR}/${f}.example"
    [ -f "$EXAMPLE_SRC" ] && install -m 644 "$EXAMPLE_SRC" "$EXAMPLE_DST"
  done
fi

# ── system user ────────────────────────────────────────────────────────────────

if ! getent passwd zephyr > /dev/null 2>&1; then
  info "Creating zephyr system user..."
  useradd \
    --system \
    --no-create-home \
    --home-dir  "${DATA_DIR}" \
    --shell     /sbin/nologin \
    --comment   "Zephyr Weather Station" \
    zephyr
  ok "User zephyr created."
fi

# ── directories + permissions ───────────────────────────────────────────────────

mkdir -p "${DATA_DIR}"
chown zephyr:zephyr "${DATA_DIR}"
chmod 0750 "${DATA_DIR}"

chown root:zephyr  "${CONFIG_DIR}"
chmod 0750 "${CONFIG_DIR}"
chmod 0644 "${CONFIG_DIR}"/*.example 2>/dev/null || true

# ── systemd reload ───────────────────────────────────────────────────────────

systemctl daemon-reload

# ── done ────────────────────────────────────────────────────────────────────────

echo ""
echo "──────────────────────────────────────────────────────────────────"
echo "✅  Zephyr ${TAG} installed."
echo "──────────────────────────────────────────────────────────────────"
echo ""

# Check whether config files already exist
CONFIG_MISSING=false
for f in app.env engine.env web.env; do
  [ ! -f "${CONFIG_DIR}/$f" ] && CONFIG_MISSING=true
done

if [ "$CONFIG_MISSING" = true ]; then
  echo "Before starting, create your config files from the examples:"
  echo ""
  echo "  sudo cp ${CONFIG_DIR}/app.env.example    ${CONFIG_DIR}/app.env"
  echo "  sudo cp ${CONFIG_DIR}/engine.env.example ${CONFIG_DIR}/engine.env"
  echo "  sudo cp ${CONFIG_DIR}/web.env.example    ${CONFIG_DIR}/web.env"
  echo ""
  echo "  Then edit them (minimum: app.env for station identity):"
  echo ""
  echo "  sudo nano ${CONFIG_DIR}/app.env"
  echo ""
fi

echo "Enable and start:"
echo ""
echo "  sudo systemctl enable --now zephyr.target"
echo ""
echo "Check logs:"
echo ""
echo "  journalctl -u zephyr-engine -u zephyr-web -f"
echo ""
