#!/usr/bin/env bash
# scripts/tag-release.sh — bump version, commit, tag, and prompt to push.
#
# Usage:
#   scripts/tag-release.sh <version>     e.g.  1.2.3   or   1.2.3-rc.1
#   scripts/tag-release.sh --patch       auto-bump patch:  1.2.3 → 1.2.4
#   scripts/tag-release.sh --minor       auto-bump minor:  1.2.3 → 1.3.0
#   scripts/tag-release.sh --major       auto-bump major:  1.2.3 → 2.0.0
#
# The script:
#   1. Reads the current version from version.ts
#   2. Validates / computes the new version
#   3. Updates version.ts
#   4. Commits: "chore: release v<version>"
#   5. Creates an annotated tag: v<version>
#   6. Prompts whether to push branch + tag (which triggers the CI release)
#
# Prerequisites: git, deno (for reading version.ts)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION_FILE="$REPO_ROOT/version.ts"

# ── helpers ──────────────────────────────────────────────────────────────────

die()  { echo "error: $*" >&2; exit 1; }
info() { echo "  $*"; }

current_version() {
  sed -nE "s/.*VERSION = ['\"]([^'\"]+)['\"].*/\1/p" "$VERSION_FILE" \
    || die "Could not read VERSION from $VERSION_FILE"
}

# Bump a semver component.  Strips any pre-release suffix first.
bump() {
  local version="$1" component="$2"
  local base="${version%%-*}"  # strip -rc.1 etc.
  IFS='.' read -r major minor patch <<< "$base"
  case "$component" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "${major}.$((minor + 1)).0" ;;
    patch) echo "${major}.${minor}.$((patch + 1))" ;;
  esac
}

validate_version() {
  local v="$1"
  [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9._-]+)?$ ]] \
    || die "Invalid version '${v}'. Expected X.Y.Z or X.Y.Z-suffix (e.g. 1.2.3-rc.1)"
}

# ── pre-flight: stash any uncommitted changes before touching branches ────────

cd "$REPO_ROOT"
STASHED=false
if ! git diff --quiet || ! git diff --cached --quiet; then
  info "Uncommitted changes detected — stashing..."
  git stash push -m "tag-release: auto-stash" || die "Could not stash changes."
  STASHED=true
fi

# ── branch guard ──────────────────────────────────────────────────────────────

ORIGINAL_BRANCH="$(git -C "$REPO_ROOT" branch --show-current)"
[[ -z "$ORIGINAL_BRANCH" ]] && die "Detached HEAD detected. Check out a branch first."

# Return to original branch (and restore stash if created) on exit — success,
# error, or Ctrl-C.
cleanup() {
  git -C "$REPO_ROOT" checkout "$ORIGINAL_BRANCH" 2>/dev/null
  echo "  Returned to branch: ${ORIGINAL_BRANCH}"
  if [[ "$STASHED" == "true" ]]; then
    git -C "$REPO_ROOT" stash pop \
      && info "Restored stashed changes." \
      || echo "  warning: stash pop failed — run 'git stash pop' manually"
  fi
}
trap cleanup EXIT

if [[ "$ORIGINAL_BRANCH" != "main" ]]; then
  info "Currently on '${ORIGINAL_BRANCH}'. Switching to 'main'..."
  git -C "$REPO_ROOT" checkout main || die "Could not switch to 'main'."
fi

info "Pulling latest 'main' from origin..."
git -C "$REPO_ROOT" pull origin main || die "'git pull origin main' failed. Resolve issues and retry."
echo ""

# ── main ──────────────────────────────────────────────────────────────────────

CURRENT=$(current_version)
echo ""
echo "Current version: ${CURRENT}"

# Parse argument
case "${1:-}" in
  --patch) NEW_VERSION=$(bump "$CURRENT" patch) ;;
  --minor) NEW_VERSION=$(bump "$CURRENT" minor) ;;
  --major) NEW_VERSION=$(bump "$CURRENT" major) ;;
  "")     die "Usage: $0 <version | --patch | --minor | --major>" ;;
  -*)
    echo "Unknown flag: $1"
    echo "Usage: $0 <version | --patch | --minor | --major>"
    exit 1
    ;;
  *)      NEW_VERSION="$1" ;;
esac

validate_version "$NEW_VERSION"

TAG="v${NEW_VERSION}"

# Detect pre-release
if [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-[a-zA-Z] ]]; then
  PRE_LABEL=" (pre-release — will be marked as such on GitHub)"
else
  PRE_LABEL=""
fi

echo "New version:     ${NEW_VERSION}  →  tag: ${TAG}${PRE_LABEL}"
echo ""

# Confirm
read -rp "Continue? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
echo ""

# Guard: tag must not already exist
if git rev-parse "$TAG" > /dev/null 2>&1; then
  die "Tag ${TAG} already exists. Delete it first: git tag -d ${TAG}"
fi

# ── Update version.ts ────────────────────────────────────────────────────────
# sed -i works differently on macOS vs Linux; use a temp file to be safe.
TMP="$(mktemp)"
sed "s/export const VERSION = \'[^\']*\'/export const VERSION = \'${NEW_VERSION}\'/" \
  "$VERSION_FILE" > "$TMP"
mv "$TMP" "$VERSION_FILE"
info "Updated $VERSION_FILE  →  ${NEW_VERSION}"

# ── Commit ───────────────────────────────────────────────────────────────────────
git add "$VERSION_FILE"
git commit -m "chore: release ${TAG}"
info "Committed version bump."

# ── Annotated tag ─────────────────────────────────────────────────────────────
git tag -a "$TAG" -m "Zephyr ${TAG}"
info "Created annotated tag ${TAG}."

# ── Push prompt ───────────────────────────────────────────────────────────────
echo ""
read -rp "Push branch and tag to origin now? [y/N] " push_confirm
if [[ "$push_confirm" =~ ^[Yy]$ ]]; then
  git push
  git push origin "$TAG"
  echo ""
  echo "✅  Pushed. GitHub Actions release workflow triggered for ${TAG}."
else
  echo ""
  echo "Tag created locally. To trigger the release workflow when ready:"
  echo ""
  echo "  git push && git push origin ${TAG}"
  echo ""
fi

info "Remember to merge `main` branch into `dev` or feature branch."
