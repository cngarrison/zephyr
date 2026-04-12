/**
 * Zephyr version — single source of truth for local builds and release scripts.
 * The git tag (v<VERSION>) is the canonical release identifier; this file
 * should always match the most recently pushed tag.
 *
 * Update this file via:  scripts/tag-release.sh [--patch|--minor|--major|<version>]
 */
export const VERSION = '0.1.4';
