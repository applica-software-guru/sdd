#!/bin/bash
set -e
cd "$(dirname "$0")/.."
npm run build
npm link --workspace=packages/cli
echo "Done! You can now use 'sdd' globally."
