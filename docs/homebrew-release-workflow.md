# Homebrew Release Workflow

This document explains how `sdd` keeps the Homebrew tap (`applica-software-guru/homebrew-sdd`) in sync with npm releases.

## TL;DR

- A regular commit to `sdd` **does not** update Homebrew.
- On GitHub Release, the workflow publishes npm first, then syncs Homebrew.
- The formula in `homebrew-sdd` always points to the npm tarball and SHA256 of `@applica-software-guru/sdd`.

## Source of truth

- Package version: `packages/cli/package.json`
- Published artifact: `https://registry.npmjs.org/@applica-software-guru/sdd/-/sdd-X.Y.Z.tgz`
- Automation workflow: `.github/workflows/sync-homebrew-tap.yml`
- Target file in tap: `Formula/sdd.rb`

## What triggers Homebrew sync

The workflow supports two triggers:

1. `release.published` (automatic, recommended) → publish npm + sync Homebrew
2. `workflow_dispatch` (manual fallback/test) with inputs:
	- `version` (optional)
	- `publish_npm` (`true`/`false`, default `false`)

It resolves version, optionally publishes npm, computes SHA256 from npm tarball, and writes `Formula/sdd.rb` into `applica-software-guru/homebrew-sdd` using `HOMEBREW_TAP_TOKEN`.

## Release checklist (recommended flow)

1. Bump CLI version in `packages/cli/package.json`
2. Build/test as needed
3. Create GitHub Release with tag `vX.Y.Z`
4. Verify workflow `Publish npm and Sync Homebrew Tap` is green
5. Verify formula in tap points to `sdd-X.Y.Z.tgz`

## Manual test / fallback

From repo root:

```bash
gh workflow run sync-homebrew-tap.yml -f version=1.0.1 -f publish_npm=false
gh run list --workflow sync-homebrew-tap.yml --limit 1
gh run watch <run-id> --exit-status
```

Manual publish + sync (rare, only if needed):

```bash
gh workflow run sync-homebrew-tap.yml -f version=1.0.2 -f publish_npm=true
```

## Required secret

Repository: `applica-software-guru/sdd`

- `NPM_TOKEN`
- `HOMEBREW_TAP_TOKEN`

Minimum token capabilities:

- `NPM_TOKEN`: npm automation token (or granular token with 2FA bypass) with publish permission for `@applica-software-guru/sdd`
- Access to repository `applica-software-guru/homebrew-sdd`
- Permission `Contents: Read and write`
- If org enforces SSO, token must be authorized for SSO

## Troubleshooting

### `Input required and not supplied: github-token`

`HOMEBREW_TAP_TOKEN` is missing in `sdd` repository secrets.

### npm publish fails with auth errors

`NPM_TOKEN` is missing/invalid, or does not have publish permission for `@applica-software-guru/sdd`.

If npm account/org enforces 2FA for publish, use an automation token (or granular token with 2FA bypass enabled), otherwise CI publish fails with 403.

### `Resource not accessible by personal access token` (403)

Token exists but has insufficient org/repo permissions, or SSO authorization is missing.

### Workflow green but brew still old

Run:

```bash
brew update
brew upgrade sdd
```

Then verify:

```bash
sdd --version
```

## Operator commands

Quick checks:

```bash
GH_PAGER=cat gh secret list --repo applica-software-guru/sdd
GH_PAGER=cat gh run list --workflow sync-homebrew-tap.yml --limit 5
GH_PAGER=cat gh api repos/applica-software-guru/homebrew-sdd/contents/Formula/sdd.rb -q .content | base64 --decode
```
