#!/bin/bash
# init-multinode.sh — Initialize Osmosis 4-validator localnet
#
# This script:
#   1. Builds the Osmosis Docker image (if not already built)
#   2. Initializes genesis for a 4-validator network
#   3. Funds a test account with the official LocalOsmosis mnemonic
#
# Prerequisites: Docker
#
# Usage:
#   chmod +x init-multinode.sh
#   ./init-multinode.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OSMOSIS_VERSION="v31.0.1"
IMAGE_NAME="osmosis:local"

# ─── Build Docker image if needed ─────────────────────────────
if ! docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
    echo "🔨 Building Osmosis Docker image from source (${OSMOSIS_VERSION})..."
    echo "   This may take several minutes on first build."
    if [ ! -d "osmosis-src" ]; then
        git clone --depth 1 --branch "$OSMOSIS_VERSION" \
            https://github.com/osmosis-labs/osmosis.git osmosis-src
    fi
    cd osmosis-src
    DOCKER_DEFAULT_PLATFORM=linux/amd64 docker build \
        --build-arg RUNNER_IMAGE=golang:1.23-alpine3.20 \
        --build-arg GO_VERSION="1.23" \
        -t "$IMAGE_NAME" .
    cd "$SCRIPT_DIR"
    echo "   ✅ ${IMAGE_NAME} built successfully"
else
    echo "✅ Docker image ${IMAGE_NAME} already exists, skipping build"
fi

# ─── Clean previous data ──────────────────────────────────────
rm -rf "$SCRIPT_DIR/data"
mkdir -p "$SCRIPT_DIR/data"

# ─── Write genesis init script ────────────────────────────────
# This script runs INSIDE the container to initialize all 4 validators.
# Using a single-quoted heredoc so no host-side variable expansion occurs.
cat > "$SCRIPT_DIR/_init-genesis.sh" << 'GENESIS_EOF'
#!/bin/sh
set -e

CHAIN_ID="localosmosis"
DENOM="uosmo"

echo "📦 Installing dependencies..."
apk add --no-cache jq > /dev/null 2>&1

echo "🔧 Initializing 4 validator nodes..."
for i in 0 1 2 3; do
    osmosisd init "validator-$i" --chain-id "$CHAIN_ID" --home "/data/node$i" -o 2>/dev/null
done

echo "🔑 Generating validator keys..."
for i in 0 1 2 3; do
    osmosisd keys add "validator-$i" --keyring-backend=test --home "/data/node$i" 2>/dev/null
done

# Add funded test account using official LocalOsmosis mnemonic
FOUNDER_MNEMONIC="bottom loan skill merry east cradle onion journey palm apology verb edit desert impose absurd oil bubble sweet glove shallow size build burst effort"
echo "$FOUNDER_MNEMONIC" | osmosisd keys add founder --recover --keyring-backend=test --home /data/node0 2>/dev/null

echo "📝 Collecting addresses..."
ADDR0=$(osmosisd keys show validator-0 -a --keyring-backend=test --home /data/node0)
ADDR1=$(osmosisd keys show validator-1 -a --keyring-backend=test --home /data/node1)
ADDR2=$(osmosisd keys show validator-2 -a --keyring-backend=test --home /data/node2)
ADDR3=$(osmosisd keys show validator-3 -a --keyring-backend=test --home /data/node3)
FOUNDER_ADDR=$(osmosisd keys show founder -a --keyring-backend=test --home /data/node0)

echo "   Validator 0: $ADDR0"
echo "   Validator 1: $ADDR1"
echo "   Validator 2: $ADDR2"
echo "   Validator 3: $ADDR3"
echo "   Founder:     $FOUNDER_ADDR"

echo "⚙️  Editing genesis parameters..."
GENESIS="/data/node0/config/genesis.json"
jq '
  .app_state.staking.params.bond_denom = "uosmo" |
  .app_state.staking.params.unbonding_time = "240s" |
  .app_state.crisis.constant_fee.denom = "uosmo" |
  .app_state.gov.params.voting_period = "60s" |
  .app_state.gov.params.expedited_voting_period = "30s" |
  .app_state.gov.params.min_deposit[0].denom = "uosmo" |
  .app_state.mint.params.mint_denom = "uosmo" |
  .app_state.txfees.basedenom = "uosmo" |
  .app_state.poolmanager.params.pool_creation_fee[0].denom = "uosmo" |
  .app_state.wasm.params.code_upload_access.permission = "Everybody" |
  .app_state.concentratedliquidity.params.is_permissionless_pool_creation_enabled = true
' "$GENESIS" > "${GENESIS}.tmp" && mv "${GENESIS}.tmp" "$GENESIS"

echo "💰 Adding genesis accounts..."
VALIDATOR_BALANCE="100000000000uosmo,100000000000stake"
FOUNDER_BALANCE="500000000000uosmo,100000000000stake"
osmosisd add-genesis-account "$ADDR0" "$VALIDATOR_BALANCE" --home /data/node0
osmosisd add-genesis-account "$ADDR1" "$VALIDATOR_BALANCE" --home /data/node0
osmosisd add-genesis-account "$ADDR2" "$VALIDATOR_BALANCE" --home /data/node0
osmosisd add-genesis-account "$ADDR3" "$VALIDATOR_BALANCE" --home /data/node0
osmosisd add-genesis-account "$FOUNDER_ADDR" "$FOUNDER_BALANCE" --home /data/node0

# Copy genesis to all nodes before gentx
for i in 1 2 3; do
    cp "$GENESIS" "/data/node$i/config/genesis.json"
done

echo "📜 Creating gentxs..."
for i in 0 1 2 3; do
    echo "   Creating gentx for validator-$i..."
    osmosisd gentx "validator-$i" 500000000uosmo \
        --keyring-backend=test \
        --chain-id="$CHAIN_ID" \
        --home "/data/node$i"
done

# Collect all gentxs on node0
for i in 1 2 3; do
    cp /data/node$i/config/gentx/* /data/node0/config/gentx/
done
osmosisd collect-gentxs --home /data/node0 2>/dev/null

echo "🌐 Configuring network peers..."
get_node_id() {
    # node ID = hex(SHA256(pubkey)[:20])
    # Ed25519 key in node_key.json is 64 bytes: first 32 = privkey, last 32 = pubkey
    jq -r '.priv_key.value' "$1/config/node_key.json" | \
        base64 -d | dd bs=1 skip=32 2>/dev/null | \
        sha256sum | cut -c 1-40
}

PEERS=""
for i in 0 1 2 3; do
    NODE_ID=$(get_node_id "/data/node$i")
    if [ -z "$NODE_ID" ]; then
        echo "   ❌ Failed to get node ID for validator-$i"
        exit 1
    fi
    echo "   validator-$i node ID: $NODE_ID"
    [ -n "$PEERS" ] && PEERS="$PEERS,"
    PEERS="${PEERS}${NODE_ID}@osmosis-validator-$i:26656"
done

echo "🔧 Distributing genesis and configuring nodes..."
for i in 0 1 2 3; do
    NODE_HOME="/data/node$i"

    # Copy final genesis to other nodes (node0 is the source)
    [ "$i" != "0" ] && cp /data/node0/config/genesis.json "$NODE_HOME/config/genesis.json"

    # Bind to all interfaces (required for Docker networking)
    sed -i 's/127\.0\.0\.1/0.0.0.0/g' "$NODE_HOME/config/config.toml"
    sed -i 's/localhost/0.0.0.0/g' "$NODE_HOME/config/app.toml"
    sed -i 's/127\.0\.0\.1/0.0.0.0/g' "$NODE_HOME/config/app.toml"

    # Set persistent peers
    sed -i "s|persistent_peers = \".*\"|persistent_peers = \"$PEERS\"|" "$NODE_HOME/config/config.toml"

    # Enable Cosmos REST API
    sed -i '/^\[api\]/,/^\[/ s/enable = false/enable = true/' "$NODE_HOME/config/app.toml"

    # Enable CORS for API access
    sed -i 's/enabled-unsafe-cors = false/enabled-unsafe-cors = true/g' "$NODE_HOME/config/app.toml"
    sed -i 's/cors_allowed_origins = \[\]/cors_allowed_origins = ["*"]/' "$NODE_HOME/config/config.toml"
done

# Export founder private key for test framework
echo "🔑 Exporting founder private key..."
yes | osmosisd keys export founder --unarmored-hex --unsafe \
    --keyring-backend=test --home /data/node0 2>/dev/null > /data/founder_private_key.txt || \
osmosisd keys export founder --unarmored-hex --unsafe \
    --keyring-backend=test --home /data/node0 > /data/founder_private_key.txt 2>/dev/null
FOUNDER_PK=$(cat /data/founder_private_key.txt | tr -d '[:space:]')
if [ -n "$FOUNDER_PK" ]; then
    echo "   ✅ Founder private key exported"
else
    echo "   ⚠️  Could not export founder private key (tests requiring tx signing may fail)"
fi

echo ""
echo "✅ Genesis initialization complete!"
echo "   Chain ID:  $CHAIN_ID"
echo "   Denom:     $DENOM"
echo "   Founder:   $FOUNDER_ADDR"
GENESIS_EOF

# ─── Run genesis init inside container ────────────────────────
echo ""
echo "🚀 Running genesis initialization..."
docker run --rm \
    --entrypoint sh \
    -v "$SCRIPT_DIR/data:/data" \
    -v "$SCRIPT_DIR/_init-genesis.sh:/init-genesis.sh" \
    "$IMAGE_NAME" /init-genesis.sh

# Cleanup temp script
rm -f "$SCRIPT_DIR/_init-genesis.sh"

echo ""
echo "✅ Initialization complete!"
echo ""
echo "Next steps:"
echo "  1. Start network: ./start-multinode.sh"
echo "  2. Check status:  docker compose ps"
echo "  3. Stop network:  ./stop-multinode.sh"
echo ""
