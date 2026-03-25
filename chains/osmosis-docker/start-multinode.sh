#!/bin/bash
# start-multinode.sh — Start Osmosis 4-validator localnet
#
# Prerequisites:
#   Run ./init-multinode.sh first to initialize all validators
#
# Usage:
#   chmod +x start-multinode.sh
#   ./start-multinode.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "data/node0" ]; then
    echo "❌ data/node0 not found. Run ./init-multinode.sh first."
    exit 1
fi

echo "🚀 Starting Osmosis multi-validator localnet..."
docker compose up -d

echo ""
echo "⏳ Waiting for network to produce blocks..."
RPC_URL="http://localhost:26657"
MAX_WAIT=120
WAITED=0
HEIGHT="0"

while [ $WAITED -lt $MAX_WAIT ]; do
    HEIGHT=$(curl -s "${RPC_URL}/status" 2>/dev/null | \
      grep -o '"latest_block_height":"[0-9]*"' | \
      grep -o '[0-9]*' || echo "0")

    if [ -n "$HEIGHT" ] && [ "$HEIGHT" != "0" ]; then
        echo "   ✅ Block height: ${HEIGHT}"
        break
    fi

    echo "   Waiting... (${WAITED}s)"
    sleep 5
    WAITED=$((WAITED + 5))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "   ⚠️  Timeout waiting for blocks."
    echo ""
    echo "=== Container status ==="
    docker compose ps -a
    echo ""
    echo "=== osmosis-validator-0 logs (last 80 lines) ==="
    docker compose logs osmosis-validator-0 --tail=80 2>/dev/null || true
    echo ""
    echo "=== osmosis-validator-1 logs (last 30 lines) ==="
    docker compose logs osmosis-validator-1 --tail=30 2>/dev/null || true
    exit 1
fi

# Verify validator count
VALIDATOR_COUNT=$(curl -s "${RPC_URL}/validators" 2>/dev/null | \
  grep -o '"total":"[0-9]*"' | \
  grep -o '[0-9]*' | head -1 || echo "unknown")

# Check Cosmos REST API readiness
REST_OK=$(curl -s http://localhost:1317/cosmos/base/tendermint/v1beta1/node_info 2>/dev/null | \
  grep -c "node_info" 2>/dev/null || true)
REST_OK=${REST_OK:-0}
REST_OK=$((REST_OK + 0))

if [ "$REST_OK" -gt 0 ] 2>/dev/null; then
    REST_STATUS="✅ Ready"
else
    REST_STATUS="⚠️  Not ready yet"
fi

echo ""
echo "✅ Osmosis multi-validator localnet started!"
echo ""
echo "📊 Network Status:"
echo "   Chain ID:        localosmosis"
echo "   Block Height:    ${HEIGHT}"
echo "   Validators:      ${VALIDATOR_COUNT}"
echo "   Cosmos REST API: ${REST_STATUS}"
echo ""
echo "📍 Validator 0 (osmosis-validator-0) Endpoints (primary):"
echo "   CometBFT RPC:    http://localhost:26657"
echo "   Cosmos REST:     http://localhost:1317"
echo "   gRPC:            localhost:9090"
echo ""
echo "📍 Other Validators:"
echo "   validator-1:  RPC=:36657  REST=:21317  gRPC=:29090"
echo "   validator-2:  RPC=:46657  REST=:31317  gRPC=:39090"
echo "   validator-3:  RPC=:56657  REST=:41317  gRPC=:49090"
echo ""
echo "To stop: ./stop-multinode.sh"
echo ""
