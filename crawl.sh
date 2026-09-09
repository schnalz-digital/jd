#!/bin/bash

echo "============================================"
echo "HK Property Crawler"
echo "Running once for local testing"
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies..."
pip install -q -r requirements.txt

echo ""
python crawler.py

echo ""
if command -v node >/dev/null 2>&1; then
    node tools/version.mjs
else
    echo "node not found — skipping cache-bust version stamp"
fi
