#!/bin/bash
# stop-multinode.sh — Stop Osmosis multi-validator localnet
#
# Usage:
#   chmod +x stop-multinode.sh
#   ./stop-multinode.sh [--clean]
#
# Options:
#   --clean   Also remove testnet data and source (full reset, requires re-init)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

echo "🛑 Stopping Osmosis multi-validator localnet..."
docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
echo "   ✅ Containers stopped"

if [ "$1" = "--clean" ]; then
    echo ""
    echo "🧹 Cleaning testnet data..."
    rm -rf "${SCRIPT_DIR}/data" 2>/dev/null || true
    rm -rf "${SCRIPT_DIR}/osmosis-src" 2>/dev/null || true
    rm -f "${SCRIPT_DIR}/_init-genesis.sh" 2>/dev/null || true
    echo "   ✅ Testnet data cleaned"
    echo "   Run ./init-multinode.sh to re-initialize"
fi

echo ""
echo "✅ Osmosis multi-validator localnet stopped."
