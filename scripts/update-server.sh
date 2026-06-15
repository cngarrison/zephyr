#!/usr/bin/env bash
# scripts/update-server.sh — Download and install the latest Zephyr .deb release.
#
# Usage (on your LAN server):
#   sudo bash update-server.sh           # install latest release
#   sudo bash update-server.sh v1.2.3    # install a specific version
#
set -euo pipefail

GITHUB_REPO="cngarrison/zephyr"

die()  { echo "error: $*" >&2; exit 1; }
info() { echo "  ▶ $*"; }

[ "$(id -u)" -eq 0 ] || die "Must be run as root (try: sudo bash $0 $*)"

# ── architecture ─────────────────────────────────────────────────────────────

case "$(uname -m)" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  *)       die "Unsupported architecture: $(uname -m)" ;;
esac

# ── version ───────────────────────────────────────────────────────────────────

if [ -n "${1:-}" ]; then
  TAG="v${1#v}"
else
  info "Fetching latest release version from GitHub..."
  TAG=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
    | grep '"tag_name"' \
    | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  [ -n "$TAG" ] || die "Could not determine latest release version."
fi

VERSION="${TAG#v}"
DEB="zephyr_${VERSION}_${ARCH}.deb"
URL="https://github.com/${GITHUB_REPO}/releases/download/${TAG}/${DEB}"

echo ""
echo "Installing Zephyr ${TAG} (${ARCH})"
echo ""

# ── download ──────────────────────────────────────────────────────────────────

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

info "Downloading ${DEB}..."
wget -q --show-progress -O "$TMP/$DEB" "$URL" \
  || die "Download failed. Check that ${TAG} exists at https://github.com/${GITHUB_REPO}/releases"

# ── install ───────────────────────────────────────────────────────────────────

info "Installing package..."
apt install -y "$TMP/$DEB"

echo ""
echo "✅  Zephyr ${TAG} installed."
echo ""
echo "Check logs:"
echo ""
echo "  journalctl -u zephyr-engine -u zephyr-web -f"
echo ""
