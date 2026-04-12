# GitHub Branch Protection — Zephyr

Repo: `cngarrison/zephyr`

## Set branch protection on `main`

Requires CI to pass before merging. The `context` string must exactly match
the `name:` of the job in `.github/workflows/ci.yml`.

```bash
gh api \
  --method PUT \
  repos/cngarrison/zephyr/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Test, type-check, lint & format" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null
}
EOF
```

- `strict: true` — branch must be up-to-date with `main` before merge
- `enforce_admins: true` — rule applies even to you as owner

## Inspect current protection rules

```bash
gh api repos/cngarrison/zephyr/branches/main/protection | jq .
```

Just the required status checks:

```bash
gh api repos/cngarrison/zephyr/branches/main/protection \
  | jq '.required_status_checks.checks'
```

## Remove branch protection entirely

```bash
gh api --method DELETE repos/cngarrison/zephyr/branches/main/protection
```

## Temporarily allow admin bypass (to force-merge in an emergency)

Disable `enforce_admins`, merge, then re-enable:

```bash
# Disable
gh api --method POST \
  repos/cngarrison/zephyr/branches/main/protection/enforce_admins \
  -f enforce_admins=false

# Re-enable
gh api --method POST \
  repos/cngarrison/zephyr/branches/main/protection/enforce_admins \
  -f enforce_admins=true
```

Or just update the full ruleset with `enforce_admins: false` and PUT it again.

## Check your auth token has the right scopes

```bash
gh auth status
```

Needs `repo` scope. Re-login with correct scopes if missing:

```bash
gh auth login --scopes repo
```

## View all recent CI runs

```bash
gh run list --repo cngarrison/zephyr --workflow ci.yml
```

## Watch a live CI run

```bash
gh run watch --repo cngarrison/zephyr
```

## Re-run a failed CI job

```bash
# List runs to get the run ID
gh run list --repo cngarrison/zephyr --workflow ci.yml --limit 5

# Re-run failed jobs only
gh run rerun <run-id> --failed

# Re-run everything
gh run rerun <run-id>
```

## View CI run logs

```bash
gh run view <run-id> --log
gh run view <run-id> --log-failed   # failures only
```

## List all workflow files

```bash
gh workflow list --repo cngarrison/zephyr
```

## Manually trigger the release workflow (if needed)

The release workflow is tag-triggered, but if you ever want to test it:

```bash
gh workflow run release.yml --repo cngarrison/zephyr --ref main
```

Note: this only works if the workflow has a `workflow_dispatch:` trigger — it
currently does not, so this is a reminder to add one if you want that ability.
