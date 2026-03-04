# Homebrew Tap Setup Guide

Complete guide to set up the Homebrew Tap for SDD, allowing macOS users to install the CLI with `brew install`.

## What is a Homebrew Tap

A **Tap** is a GitHub repository that contains third-party Homebrew formulae. When a user runs:

```bash
brew install applica-software-guru/sdd/sdd
```

Homebrew automatically clones the `applica-software-guru/homebrew-sdd` repo and installs the formula `Formula/sdd.rb` from it.

## Step 1: Create the repository

Create a new **public** repository on GitHub:

- **Owner:** `applica-software-guru`
- **Name:** `homebrew-sdd` (the `homebrew-` prefix is required)
- **Visibility:** Public

## Step 2: Repository structure

The repo needs this minimal structure:

```
homebrew-sdd/
  Formula/
    sdd.rb
  README.md  (optional)
```

## Step 3: Generate the formula

From the `sdd` repo, run:

```bash
./scripts/update-homebrew.sh
```

This script:
1. Reads the current version from `packages/cli/package.json`
2. Downloads the npm tarball and calculates its SHA256
3. Prints the complete Ruby formula

Copy the output (the "Formula snippet" section) into `Formula/sdd.rb` in the tap repo.

Alternatively, you can specify an explicit version:

```bash
./scripts/update-homebrew.sh 1.2.3
```

## Step 4: Manual SHA256 calculation (alternative)

If you need to calculate the SHA256 manually:

```bash
curl -sL https://registry.npmjs.org/@applica-software-guru/sdd/-/sdd-1.0.0.tgz | shasum -a 256
```

## Step 5: Local testing

Before pushing to the tap repo, test the formula locally using a temporary tap:

```bash
# Create a local tap
brew tap-new --no-git local/sdd

# Copy the formula into it
cp ./Formula/sdd.rb "$(brew --repository)/Library/Taps/local/homebrew-sdd/Formula/sdd.rb"

# Install
brew install local/sdd/sdd

# Verify
sdd --version
sdd --help

# Clean up
brew uninstall sdd
brew untap local/sdd
```

## Step 6: Publishing

Push the `Formula/sdd.rb` file to the `applica-software-guru/homebrew-sdd` repo. From that point on, users can install with:

```bash
brew install applica-software-guru/sdd/sdd
```

Or, by adding the tap first:

```bash
brew tap applica-software-guru/sdd
brew install sdd
```

## Step 7: Automatic updates (CI)

The `sdd` repo includes a GitHub Actions workflow (`.github/workflows/update-homebrew.yml`) that automatically updates the formula in the tap when a new version is released.

### Secrets configuration

In the **`sdd`** repo (not the tap), configure:

- **`HOMEBREW_TAP_TOKEN`**: a GitHub Personal Access Token (classic) with `repo` scope that has write access to the `applica-software-guru/homebrew-sdd` repo

### How to use the workflow

1. Publish the new version to npm: `npm publish`
2. Go to GitHub Actions in the `sdd` repo
3. Select the "Update Homebrew Formula" workflow
4. Click "Run workflow" and enter the version number (e.g. `1.2.3`)
5. The workflow will calculate the SHA256 and update the formula in the tap repo

## Troubleshooting

### The formula doesn't install

- Verify that the SHA256 matches the current tarball on npm
- Verify that `node` is available: `brew install node`
- Regenerate the formula with `./scripts/update-homebrew.sh`

### The CI workflow fails

- Verify that the `HOMEBREW_TAP_TOKEN` secret is configured correctly
- Verify that the token has `repo` scope and access to the tap repo
- Verify that the specified version is already published on npm

### Users can't find the formula

- Verify that the `homebrew-sdd` repo is **public**
- Verify that the file is located at `Formula/sdd.rb` (not in the root)
