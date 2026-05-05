#!/usr/bin/env bash
# download_ephemeris.sh
# Downloads the Swiss Ephemeris data files required by pyswisseph.
# Run once after cloning: bash download_ephemeris.sh

set -e

EPHE_DIR="$(dirname "$0")/ephemeris"
mkdir -p "$EPHE_DIR"

BASE="https://www.astro.com/ftp/swisseph/ephe"
FILES=(
  "sepl_18.se1"
  "semo_18.se1"
  "seas_18.se1"
)

echo "Downloading Swiss Ephemeris files to $EPHE_DIR ..."

for f in "${FILES[@]}"; do
  if [ -f "$EPHE_DIR/$f" ]; then
    echo "  $f already exists — skipping"
  else
    echo "  Downloading $f ..."
    curl -fsSL "$BASE/$f" -o "$EPHE_DIR/$f"
    echo "  ✓ $f"
  fi
done

echo ""
echo "Done. Ephemeris files are in $EPHE_DIR"
