#!/usr/bin/env bash
# Surfaces pending SDD work at session start. Silent exit when not in an SDD project
# or when the sdd CLI isn't available — never blocks the session.

set -e

# Only run in SDD projects
if [ ! -f ".sdd/config.yaml" ]; then
  exit 0
fi

# Only run if sdd CLI is available
if ! command -v sdd >/dev/null 2>&1; then
  exit 0
fi

# Collect counts — failures are non-fatal (missing command, remote errors, etc.)
pending=$(sdd status --quiet 2>/dev/null | grep -cE '^\s*(new|changed|deleted)' || echo 0)
bugs=$(sdd bug open --quiet 2>/dev/null | grep -cE '^\s*[a-zA-Z0-9_-]+\.md' || echo 0)
crs=$(sdd cr pending --quiet 2>/dev/null | grep -cE '^\s*[a-zA-Z0-9_-]+\.md' || echo 0)

if [ "$pending" = "0" ] && [ "$bugs" = "0" ] && [ "$crs" = "0" ]; then
  echo "SDD: all synced. No open bugs or pending CRs."
  exit 0
fi

echo "SDD status:"
[ "$bugs" != "0" ]   && echo "  - $bugs open bug(s) — run /sdd-bugs or 'sdd bug open'"
[ "$crs" != "0" ]    && echo "  - $crs pending CR(s) — run /sdd-crs or 'sdd cr pending'"
[ "$pending" != "0" ] && echo "  - $pending doc file(s) pending sync — run /sdd-sync or 'sdd sync'"
