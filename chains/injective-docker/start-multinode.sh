#!/bin/bash
# start-multinode.sh — Start Injective 4-validator localnet
#
# Prerequisites:
#   Run ./init-multinode.sh first to initialize all validators
#
# Usage:
#   chmod +x start-multinode.sh
#   ./start-multinode.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

if [ ! -f "${SCRIPT_DIR}/.env.multinode" ]; then
    echo "❌ .env.multinode not found. Run ./init-multinode.sh first."
    exit 1
fi

echo "🚀 Starting Injective multi-validator localnet..."
docker compose --env-file "${SCRIPT_DIR}/.env.multinode" -f "$COMPOSE_FILE" up -d

echo ""
echo "⏳ Waiting for network to produce blocks..."
MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    HEIGHT=$(curl -s http://localhost:26657/status 2>/dev/null | \
      grep -o '"latest_block_height":"[0-9]*"' | \
      grep -o '[0-9]*' || echo "0")

    if [ "$HEIGHT" != "0" ] && [ -n "$HEIGHT" ]; then
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
    docker compose --env-file "${SCRIPT_DIR}/.env.multinode" -f "$COMPOSE_FILE" ps -a
    echo ""
    echo "=== inj-validator1 logs (last 80 lines) ==="
    docker compose --env-file "${SCRIPT_DIR}/.env.multinode" -f "$COMPOSE_FILE" logs inj-validator1 --tail=80 2>/dev/null || true
    exit 1
fi

VALIDATOR_COUNT=$(curl -s http://localhost:26657/validators 2>/dev/null | \
  grep -o '"total":"[0-9]*"' | \
  grep -o '[0-9]*' | head -1 || echo "unknown")

EVM_OK=$(curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>/dev/null | \
  grep -c "result" 2>/dev/null || true)
EVM_OK=${EVM_OK:-0}
EVM_OK=$((EVM_OK + 0))

if [ "$EVM_OK" -gt 0 ] 2>/dev/null; then
    EVM_STATUS="✅ Ready"
else
    EVM_STATUS="⚠️  Not ready yet"
fi

echo ""
echo "✅ Injective multi-validator localnet started!"
echo ""
echo "📊 Network Status:"
echo "   Block Height:    ${HEIGHT}"
echo "   Validators:      ${VALIDATOR_COUNT}"
echo "   EVM JSON-RPC:    ${EVM_STATUS}"
echo ""
echo "📍 Validator 1 Endpoints (primary):"
echo "   CometBFT RPC:   http://localhost:26657"
echo "   EVM JSON-RPC:    http://localhost:8545  ([json-rpc] section)"
echo "   EVM WebSocket:   ws://localhost:8546"
echo "   Cosmos REST:     http://localhost:1317"
echo "   gRPC:            localhost:9900"
echo ""
echo "📍 Other Validators:"
echo "   Validator 2:     RPC=:36657  EVM=:28545  REST=:21317"
echo "   Validator 3:     RPC=:46657  EVM=:38545  REST=:31317"
echo "   Validator 4:     RPC=:56657  EVM=:48545  REST=:41317"
echo ""
echo "To stop: ./stop-multinode.sh"
echo ""
