#!/bin/bash
set -e

# Calculates URL and SHA256 of the npm tarball for the current version
# of @applica-software-guru/sdd and outputs the Homebrew formula snippet.
#
# Usage:
#   ./scripts/update-homebrew.sh          # uses version from packages/cli/package.json
#   ./scripts/update-homebrew.sh 1.2.3    # uses explicit version

cd "$(dirname "$0")/.."

if [ -n "$1" ]; then
  VERSION="$1"
else
  VERSION=$(node -p "require('./packages/cli/package.json').version")
fi

TARBALL_URL="https://registry.npmjs.org/@applica-software-guru/sdd/-/sdd-${VERSION}.tgz"

echo "Fetching tarball for @applica-software-guru/sdd@${VERSION}..."
echo "URL: ${TARBALL_URL}"
echo ""

SHA256=$(curl -sL "$TARBALL_URL" | shasum -a 256 | awk '{print $1}')

echo "SHA256: ${SHA256}"
echo ""
echo "--- Formula snippet ---"
echo ""
cat <<EOF
class Sdd < Formula
  desc "CLI for Story Driven Development"
  homepage "https://github.com/applica-software-guru/sdd"
  url "${TARBALL_URL}"
  sha256 "${SHA256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/sdd --version")
  end
end
EOF
