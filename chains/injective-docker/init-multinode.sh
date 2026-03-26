#!/bin/bash
# init-multinode.sh — Initialize 4-validator Injective localnet
#
# Architecture: CometBFT-based EVM-compatible chain (Cosmos SDK + native EVM)
# Each validator = 1 container (consensus + EVM in same process)
# Binary: injectived | Home: /root/.injectived | Denom: inj (18 decimals)
#
# How it works:
#   1. Clean old Docker volumes
#   2. Initialize each validator node (generate keys and config)
#   3. Create operator keys for each validator
#   4. Import founder (test wallet) key on node1
#   5. Add all accounts to genesis on node1
#   6. Patch genesis denominations and EVM config
#   7. Distribute genesis to all nodes for gentx signing
#   8. Create gentx for each validator
#   9. Collect all gentxs on node1 to produce final genesis
#  10. Configure node settings (RPC, EVM, fast blocks)
#  11. Distribute final genesis to all nodes
#  12. Get CometBFT Node IDs and write PERSISTENT_PEERS
#
# Usage:
#   chmod +x init-multinode.sh
#   ./init-multinode.sh

set -e

IMAGE="injectivelabs/injective-core:${INJ_TAG:-v1.18.2}"
CHAIN_ID="injective-1337"
INJ_HOME="/root/.injectived"
DENOM="inj"

# Amounts (inj uses 18 decimal places, like ETH)
VALIDATOR_BALANCE="1000000000000000000000000${DENOM}"    # 1,000,000 INJ per validator
VALIDATOR_STAKE="100000000000000000000000${DENOM}"       # 100,000 INJ staked per validator
FOUNDER_BALANCE="10000000000000000000000000${DENOM}"     # 10,000,000 INJ for test wallet

# Founder private key — from env or default to Hardhat Account #0
if [ -z "$TEST_WALLET_PRIVATE_KEY" ]; then
  echo "⚠️  TEST_WALLET_PRIVATE_KEY not set, using default Hardhat Account #0 key"
  TEST_WALLET_PRIVATE_KEY="ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
fi
FOUNDER_ETH_PRIVKEY="${TEST_WALLET_PRIVATE_KEY#0x}"

VALIDATOR_ETH_PRIVKEY_1="${VALIDATOR_ETH_PRIVKEY_1:-1111111111111111111111111111111111111111111111111111111111111111}"
VALIDATOR_ETH_PRIVKEY_2="${VALIDATOR_ETH_PRIVKEY_2:-2222222222222222222222222222222222222222222222222222222222222222}"
VALIDATOR_ETH_PRIVKEY_3="${VALIDATOR_ETH_PRIVKEY_3:-3333333333333333333333333333333333333333333333333333333333333333}"
VALIDATOR_ETH_PRIVKEY_4="${VALIDATOR_ETH_PRIVKEY_4:-4444444444444444444444444444444444444444444444444444444444444444}"
VALIDATOR_ETH_PRIVKEYS=(
  "$VALIDATOR_ETH_PRIVKEY_1"
  "$VALIDATOR_ETH_PRIVKEY_2"
  "$VALIDATOR_ETH_PRIVKEY_3"
  "$VALIDATOR_ETH_PRIVKEY_4"
)

NUM_VALIDATORS=4
TOTAL_STEPS=12

# Helper: run injectived command in a Docker container
run_inj() {
  local vol="$1"
  shift
  docker run --rm --entrypoint injectived \
    -v "${vol}:${INJ_HOME}" "$IMAGE" "$@" --home "${INJ_HOME}"
}

run_inj_quiet() {
  local vol="$1"
  shift
  docker run --rm --entrypoint injectived \
    -v "${vol}:${INJ_HOME}" "$IMAGE" "$@" --home "${INJ_HOME}" >/dev/null 2>&1
}

echo "============================================"
echo "  Injective Multi-Validator Localnet Init"
echo "  Architecture: CometBFT + Native EVM"
echo "  Validators: ${NUM_VALIDATORS}"
echo "  Image: ${IMAGE}"
echo "  Chain ID: ${CHAIN_ID}"
echo "============================================"
echo ""

# ----------------------------------------------------------
# Step 1: Clean old volumes
# ----------------------------------------------------------
echo "🧹 Step 1/${TOTAL_STEPS}: Cleaning old volumes..."
for i in $(seq 1 $NUM_VALIDATORS); do
  docker volume rm -f inj_validator${i}_home 2>/dev/null || true
done
echo "   ✅ Cleaned"
echo ""

# ----------------------------------------------------------
# Step 2: Initialize each validator node
# ----------------------------------------------------------
echo "🔑 Step 2/${TOTAL_STEPS}: Initializing nodes..."
for i in $(seq 1 $NUM_VALIDATORS); do
  run_inj_quiet "inj_validator${i}_home" init validator${i} --chain-id ${CHAIN_ID}
  echo "   ✅ Validator $i: initialized"
done
echo ""

# ----------------------------------------------------------
# Step 3: Create operator keys for each validator
# ----------------------------------------------------------
echo "🔐 Step 3/${TOTAL_STEPS}: Creating operator keys..."
declare -a VALIDATOR_ADDRS
for i in $(seq 1 $NUM_VALIDATORS); do
  PRIVKEY="${VALIDATOR_ETH_PRIVKEYS[$((i-1))]}"

  echo -e "password123\npassword123" | docker run -i --rm --entrypoint injectived \
    -v inj_validator${i}_home:${INJ_HOME} \
    "$IMAGE" keys unsafe-import-eth-key validator${i} ${PRIVKEY} \
      --keyring-backend test --home ${INJ_HOME} 2>/dev/null || true

  ADDR=$(docker run --rm --entrypoint injectived \
    -v inj_validator${i}_home:${INJ_HOME} \
    "$IMAGE" keys show validator${i} \
      --keyring-backend test --home ${INJ_HOME} -a 2>/dev/null | tr -d '\n\r')
  if [ -z "$ADDR" ]; then
    echo "❌ Error: failed to import validator${i} operator key or resolve its address."
    exit 1
  fi
  VALIDATOR_ADDRS+=("$ADDR")
  echo "   ✅ Validator $i: ${ADDR}"
done
echo ""

# ----------------------------------------------------------
# Step 4: Import founder (test wallet) key on node1
# ----------------------------------------------------------
echo "💰 Step 4/${TOTAL_STEPS}: Importing founder test wallet..."
echo -e "password123\npassword123" | docker run -i --rm --entrypoint injectived \
  -v inj_validator1_home:${INJ_HOME} \
  "$IMAGE" keys unsafe-import-eth-key founder ${FOUNDER_ETH_PRIVKEY} \
    --keyring-backend test --home ${INJ_HOME} >/dev/null 2>&1 || true

FOUNDER_ADDR=$(docker run --rm --entrypoint injectived \
  -v inj_validator1_home:${INJ_HOME} \
  "$IMAGE" keys show founder \
    --keyring-backend test --home ${INJ_HOME} -a 2>/dev/null | tr -d '\n\r')

echo "   ✅ Founder address: ${FOUNDER_ADDR}"
echo ""

# ----------------------------------------------------------
# Step 5: Add genesis accounts on node1
# ----------------------------------------------------------
echo "📝 Step 5/${TOTAL_STEPS}: Adding genesis accounts..."

add_genesis_account() {
  local vol="$1"
  local account="$2"
  local amount="$3"
  docker run --rm --entrypoint injectived \
    -v "${vol}:${INJ_HOME}" "$IMAGE" add-genesis-account "$account" "$amount" \
      --chain-id ${CHAIN_ID} --keyring-backend test --home "${INJ_HOME}"
}

add_genesis_account "inj_validator1_home" "${FOUNDER_ADDR}" "${FOUNDER_BALANCE}"
echo "   ✅ Founder account added"

for i in $(seq 1 $NUM_VALIDATORS); do
  idx=$((i-1))
  ADDR="${VALIDATOR_ADDRS[$idx]}"
  if [ $i -eq 1 ]; then
    add_genesis_account "inj_validator1_home" "validator1" "${VALIDATOR_BALANCE}"
  else
    add_genesis_account "inj_validator1_home" "${ADDR}" "${VALIDATOR_BALANCE}"
  fi
  echo "   ✅ Validator $i account added"
done
echo ""

# ----------------------------------------------------------
# Step 6: Patch genesis denominations and EVM config
# ----------------------------------------------------------
echo "🔄 Step 6/${TOTAL_STEPS}: Patching genesis.json..."
docker run --rm \
  -v inj_validator1_home:/home/inj \
  alpine sh -c '
    apk add --no-cache jq >/dev/null 2>&1
    GENESIS=/home/inj/config/genesis.json

    jq ".app_state.staking.params.bond_denom = \"inj\" |
        .app_state.staking.params.unbonding_time = \"120s\" |
        .app_state.crisis.constant_fee.denom = \"inj\" |
        .app_state.gov.params.min_deposit[0].denom = \"inj\" |
        .app_state.gov.params.voting_period = \"60s\" |
        .app_state.gov.params.expedited_voting_period = \"30s\" |
        .app_state.mint.params.mint_denom = \"inj\" |
        .app_state.evm.params.evm_denom = \"inj\" |
        .app_state.txfees.params.min_gas_price = \"160000000.000000000000000000\" |
        .consensus_params.block.max_gas = \"30000000\"" $GENESIS > $GENESIS.tmp && \
    mv $GENESIS.tmp $GENESIS

    jq ".app_state.bank.denom_metadata = [{
      \"description\": \"The native staking and governance token of Injective\",
      \"denom_units\": [
        {\"denom\": \"inj\", \"exponent\": 0, \"aliases\": [\"attoinj\"]},
        {\"denom\": \"INJ\", \"exponent\": 18}
      ],
      \"base\": \"inj\",
      \"display\": \"INJ\",
      \"name\": \"Injective\",
      \"symbol\": \"INJ\"
    }]" $GENESIS > $GENESIS.tmp && \
    mv $GENESIS.tmp $GENESIS
  ' 2>/dev/null
echo "   ✅ Genesis patched (denom: inj, EVM denom: inj, voting_period: 60s)"
echo ""

# ----------------------------------------------------------
# Step 7: Distribute genesis (with accounts) to all nodes
# ----------------------------------------------------------
echo "📤 Step 7/${TOTAL_STEPS}: Distributing genesis with accounts..."
for i in $(seq 2 $NUM_VALIDATORS); do
  docker run --rm \
    -v inj_validator1_home:/src:ro \
    -v inj_validator${i}_home:/dst \
    alpine sh -c "cp /src/config/genesis.json /dst/config/genesis.json" 2>/dev/null
  echo "   ✅ Genesis → Validator $i"
done
echo ""

# ----------------------------------------------------------
# Step 8: Create gentx for each validator
# ----------------------------------------------------------
echo "📝 Step 8/${TOTAL_STEPS}: Creating gentx for each validator..."
echo "   Detecting gentx command variant..."
# Detect which command variant works: `genesis gentx` vs `gentx`
GENTX_PREFIX=""
if docker run --rm --entrypoint injectived -v "inj_validator1_home:${INJ_HOME}" "$IMAGE" genesis --help 2>&1 | grep -q gentx; then
  GENTX_PREFIX="genesis"
  echo "   Using: injectived genesis gentx"
else
  echo "   Using: injectived gentx"
fi

for i in $(seq 1 $NUM_VALIDATORS); do
  docker run --rm --entrypoint injectived \
    -v "inj_validator${i}_home:${INJ_HOME}" "$IMAGE" \
    ${GENTX_PREFIX} gentx validator${i} ${VALIDATOR_STAKE} \
      --chain-id ${CHAIN_ID} --keyring-backend test --home "${INJ_HOME}"
  echo "   ✅ Validator $i: gentx created"
done
echo ""

# ----------------------------------------------------------
# Step 9: Collect gentxs on node1
# ----------------------------------------------------------
echo "📦 Step 9/${TOTAL_STEPS}: Collecting gentxs on node1..."
for i in $(seq 2 $NUM_VALIDATORS); do
  docker run --rm \
    -v inj_validator${i}_home:/src:ro \
    -v inj_validator1_home:/dst \
    alpine sh -c "cp /src/config/gentx/* /dst/config/gentx/" 2>/dev/null
  echo "   ✅ Validator $i gentx → node1"
done

docker run --rm --entrypoint injectived \
  -v "inj_validator1_home:${INJ_HOME}" "$IMAGE" \
  ${GENTX_PREFIX} collect-gentxs --home "${INJ_HOME}"
echo "   ✅ Genesis finalized with all gentxs"
echo ""

# ----------------------------------------------------------
# Step 10: Configure node settings
# ----------------------------------------------------------
echo "⚙️  Step 10/${TOTAL_STEPS}: Configuring node settings..."
for i in $(seq 1 $NUM_VALIDATORS); do
  docker run --rm \
    -v inj_validator${i}_home:/home/inj \
    alpine sh -c '
      CONFIG=/home/inj/config/config.toml
      APP=/home/inj/config/app.toml

      # === CometBFT config.toml ===
      sed -i "s|laddr = \"tcp://127.0.0.1:26657\"|laddr = \"tcp://0.0.0.0:26657\"|" $CONFIG
      sed -i "s|timeout_commit = \"5s\"|timeout_commit = \"2s\"|" $CONFIG
      sed -i "s|timeout_propose = \"3s\"|timeout_propose = \"2s\"|" $CONFIG
      sed -i "s|cors_allowed_origins = \[\]|cors_allowed_origins = [\"*\"]|" $CONFIG

      # === app.toml patching ===
      # Strategy: remove [api], [grpc], [evm-rpc] sections then append known-good versions.
      # This avoids fragile sed pattern matching against unknown default values.
      # Injective port layout (matches official testnet/mainnet config):
      #   [api]     -> Cosmos REST on 10337
      #   [grpc]    -> gRPC on 9900
      #   [evm-rpc] -> EVM JSON-RPC on 1317, WS on 1318

      # Debug: dump defaults before patching
      echo "--- DEFAULT app.toml key sections ---"
      echo ">> Has [api]:"
      grep -c "^\[api\]" $APP || echo "0"
      echo ">> Has [grpc]:"
      grep -c "^\[grpc\]" $APP || echo "0"
      echo ">> Has [json-rpc]:"
      grep -c "^\[json-rpc\]" $APP || echo "0"
      echo ">> [json-rpc] content:"
      sed -n "/^\[json-rpc\]/,/^\[/p" $APP 2>/dev/null | head -5 || echo "(none)"
      echo "---"

      # Step A: Remove existing [api], [grpc], [json-rpc] sections using sed ranges
      # For each: delete section header + all lines until next section header
      for SECT in api grpc json-rpc; do
        if grep -q "^\[${SECT}\]" $APP; then
          sed -i "/^\[${SECT}\]/,/^\[/{/^\[${SECT}\]/d;/^\[/!d;}" $APP
        fi
      done

      # Step B: Append known-good sections
      echo "" >> $APP
      echo "[api]" >> $APP
      echo "enable = true" >> $APP
      echo "swagger = false" >> $APP
      echo "address = \"tcp://0.0.0.0:1317\"" >> $APP
      echo "max-open-connections = 1000" >> $APP
      echo "rpc-read-timeout = 10" >> $APP
      echo "rpc-write-timeout = 0" >> $APP
      echo "rpc-max-body-bytes = 1000000" >> $APP
      echo "enabled-unsafe-cors = true" >> $APP

      echo "" >> $APP
      echo "[grpc]" >> $APP
      echo "enable = true" >> $APP
      echo "address = \"0.0.0.0:9900\"" >> $APP

      echo "" >> $APP
      echo "[json-rpc]" >> $APP
      echo "enable = true" >> $APP
      echo "address = \"0.0.0.0:8545\"" >> $APP
      echo "ws-address = \"0.0.0.0:8546\"" >> $APP
      echo "api = \"eth,net,web3\"" >> $APP
      echo "gas-cap = 25000000" >> $APP
      echo "evm-timeout = \"5s\"" >> $APP
      echo "txfee-cap = 10" >> $APP
      echo "filter-cap = 200" >> $APP
      echo "feehistory-cap = 100" >> $APP
      echo "logs-cap = 10000" >> $APP
      echo "block-range-cap = 10000" >> $APP
      echo "http-timeout = \"30s\"" >> $APP
      echo "http-idle-timeout = \"2m0s\"" >> $APP
      echo "allow-unprotected-txs = false" >> $APP
      echo "max-open-connections = 0" >> $APP
      echo "enable-indexer = true" >> $APP
      echo "allow-indexer-gap = true" >> $APP

      # Base config
      sed -i "s|^minimum-gas-prices .*|minimum-gas-prices = \"500000000inj\"|" $APP

      # Debug: confirm final config
      echo "--- FINAL app.toml key sections ---"
      echo ">> [api]:"
      sed -n "/^\[api\]/,/^\[/p" $APP | head -6
      echo ">> [grpc]:"
      sed -n "/^\[grpc\]/,/^\[/p" $APP | head -4
      echo ">> [json-rpc]:"
      sed -n "/^\[json-rpc\]/,/^\[/p" $APP | head -5
      echo "---"
    '
  echo "   ✅ Validator $i: configured"
done
echo ""

# ----------------------------------------------------------
# Step 11: Distribute final genesis to all nodes
# ----------------------------------------------------------
echo "📤 Step 11/${TOTAL_STEPS}: Distributing final genesis.json..."
for i in $(seq 2 $NUM_VALIDATORS); do
  docker run --rm \
    -v inj_validator1_home:/src:ro \
    -v inj_validator${i}_home:/dst \
    alpine sh -c "cp /src/config/genesis.json /dst/config/genesis.json" 2>/dev/null
  echo "   ✅ Genesis → Validator $i"
done
echo ""

# ----------------------------------------------------------
# Step 12: Get CometBFT Node IDs and write PERSISTENT_PEERS
# ----------------------------------------------------------
echo "🔗 Step 12/${TOTAL_STEPS}: Getting CometBFT Node IDs..."

PEERS=""
for i in $(seq 1 $NUM_VALIDATORS); do
  NODE_ID=$(docker run --rm --entrypoint injectived \
    -v inj_validator${i}_home:${INJ_HOME} \
    "$IMAGE" comet show-node-id --home ${INJ_HOME} 2>/dev/null || \
  docker run --rm --entrypoint injectived \
    -v inj_validator${i}_home:${INJ_HOME} \
    "$IMAGE" tendermint show-node-id --home ${INJ_HOME} 2>/dev/null || \
  docker run --rm --entrypoint injectived \
    -v inj_validator${i}_home:${INJ_HOME} \
    "$IMAGE" cometbft show-node-id --home ${INJ_HOME} 2>/dev/null)
  NODE_ID=$(echo "$NODE_ID" | tr -d '\n\r')

  if [ -z "$NODE_ID" ]; then
    echo "   ⚠️  Could not get node ID for validator $i via CLI, computing from node_key.json..."
    NODE_ID=$(docker run --rm \
      -v inj_validator${i}_home:/home/inj \
      alpine sh -c '
        apk add --no-cache jq coreutils >/dev/null 2>&1
        jq -r ".priv_key.value" /home/inj/config/node_key.json | \
          base64 -d | dd bs=1 skip=32 2>/dev/null | \
          sha256sum | cut -c 1-40
      ' 2>/dev/null)
    NODE_ID=$(echo "$NODE_ID" | tr -d '\n\r')
  fi

  PEER="${NODE_ID}@inj-validator${i}:26656"
  echo "   Validator $i: ${PEER}"

  if [ -z "$PEERS" ]; then
    PEERS="$PEER"
  else
    PEERS="${PEERS},${PEER}"
  fi
done

echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "${SCRIPT_DIR}/.env.multinode.sample" "${SCRIPT_DIR}/.env.multinode" 2>/dev/null || true
ENV_FILE="${SCRIPT_DIR}/.env.multinode"

if [ -f "$ENV_FILE" ] && grep -q "^PERSISTENT_PEERS=" "$ENV_FILE"; then
  sed -i.bak "s|^PERSISTENT_PEERS=.*|PERSISTENT_PEERS=${PEERS}|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
else
  echo "PERSISTENT_PEERS=${PEERS}" >> "$ENV_FILE"
fi
echo "   ✅ Updated PERSISTENT_PEERS in .env.multinode"

echo ""
echo "============================================"
echo "  ✅ Initialization complete!"
echo "  ${NUM_VALIDATORS} validators configured"
echo "============================================"
echo ""
echo "📋 Validator Addresses:"
for i in $(seq 1 $NUM_VALIDATORS); do
  idx=$((i-1))
  echo "   Validator $i: ${VALIDATOR_ADDRS[$idx]}"
done
echo ""
echo "📋 Founder Wallet:"
echo "   Address: ${FOUNDER_ADDR}"
echo ""
echo "📋 Persistent Peers:"
echo "   ${PEERS}"
echo ""
echo "📋 Next steps:"
echo "  1. Start network: ./start-multinode.sh"
echo "  2. Check status:  docker compose --env-file .env.multinode -f docker-compose.yml ps"
echo "  3. Stop network:  ./stop-multinode.sh"
echo ""
