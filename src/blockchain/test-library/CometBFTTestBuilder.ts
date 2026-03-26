import { expect } from 'chai';
import { Blockchain } from '../../core/Blockchain';

export class CometBFTTestBuilder {
    private httpEndpoint: string;
    private blockHeight: number = 0;
    private latestBlockHeight: number = 0;
    private blockchain: Blockchain;
    private nodeIndex?: number;

    // Common blockResponseSchema
    static blockResponseSchema = {
        type: 'object',
        required: ['jsonrpc', 'id', 'result'],
        properties: {
            jsonrpc: { type: 'string' },
            id: { type: 'integer' },
            result: {
                type: 'object',
                required: ['block_id', 'block'],
                properties: {
                    block_id: {
                        type: 'object',
                        required: ['hash', 'parts'],
                        properties: {
                            hash: { type: 'string' },
                            parts: {
                                type: 'object',
                                required: ['total', 'hash'],
                                properties: {
                                    total: { type: 'integer' },
                                    hash: { type: 'string' },
                                },
                            },
                        },
                    },
                    block: {
                        type: 'object',
                        required: ['header', 'data', 'evidence', 'last_commit'],
                        properties: {
                            header: {
                                type: 'object',
                                required: [
                                    'version',
                                    'chain_id',
                                    'height',
                                    'time',
                                    'last_block_id',
                                    'last_commit_hash',
                                    'data_hash',
                                    'validators_hash',
                                    'next_validators_hash',
                                    'consensus_hash',
                                    'app_hash',
                                    'last_results_hash',
                                    'evidence_hash',
                                    'proposer_address',
                                ],
                                properties: {
                                    version: {
                                        type: 'object',
                                        required: ['block'],
                                        properties: { block: { type: 'string' } },
                                    },
                                    chain_id: { type: 'string' },
                                    height: { type: 'string' },
                                    time: { type: 'string' },
                                    last_block_id: {
                                        type: 'object',
                                        required: ['hash', 'parts'],
                                        properties: {
                                            hash: { type: 'string' },
                                            parts: {
                                                type: 'object',
                                                required: ['total', 'hash'],
                                                properties: {
                                                    total: { type: 'integer' },
                                                    hash: { type: 'string' },
                                                },
                                            },
                                        },
                                    },
                                    last_commit_hash: { type: 'string' },
                                    data_hash: { type: 'string' },
                                    validators_hash: { type: 'string' },
                                    next_validators_hash: { type: 'string' },
                                    consensus_hash: { type: 'string' },
                                    app_hash: { type: 'string' },
                                    last_results_hash: { type: 'string' },
                                    evidence_hash: { type: 'string' },
                                    proposer_address: { type: 'string' },
                                },
                            },
                            data: {
                                type: 'object',
                                required: ['txs'],
                                properties: {
                                    txs: { type: 'array', items: { type: 'string' } },
                                },
                            },
                            evidence: {
                                type: 'object',
                                required: ['evidence'],
                                properties: {
                                    evidence: { type: 'array' },
                                },
                            },
                            last_commit: {
                                type: 'object',
                                required: ['height', 'round', 'block_id', 'signatures'],
                                properties: {
                                    height: { type: 'string' },
                                    round: { type: 'integer' },
                                    block_id: {
                                        type: 'object',
                                        required: ['hash', 'parts'],
                                        properties: {
                                            hash: { type: 'string' },
                                            parts: {
                                                type: 'object',
                                                required: ['total', 'hash'],
                                                properties: {
                                                    total: { type: 'integer' },
                                                    hash: { type: 'string' },
                                                },
                                            },
                                        },
                                    },
                                    signatures: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            required: ['block_id_flag', 'validator_address', 'timestamp', 'signature'],
                                            properties: {
                                                block_id_flag: { type: 'integer' },
                                                validator_address: { type: 'string' },
                                                timestamp: { type: 'string' },
                                                signature: {
                                                    anyOf: [{ type: 'string' }, { type: 'null' }],
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    };

    // Common check_txResponseSchema
    static check_txResponseSchema = {
        required: ['log', 'data', 'code'],
        properties: {
            code: { type: 'integer' },
            data: {
                anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            log: { type: 'string' },
            info: { type: 'string' },
            gas_wanted: { type: 'string' },
            gas_used: { type: 'string' },
            events: {
                type: 'array',
                nullable: true,
                items: {
                    type: 'object',
                    properties: {
                        type: { type: 'string' },
                        attributes: {
                            type: 'array',
                            nullable: false,
                            items: {
                                type: 'object',
                                properties: {
                                    key: { type: 'string' },
                                    value: { type: 'string' },
                                    index: { type: 'boolean' },
                                },
                            },
                        },
                    },
                },
            },
            codespace: { type: 'string' },
        },
        type: 'object',
    };

    // Common JSON-RPC response schema
    static jsonRpcResponseSchema = {
        type: 'object',
        required: ['jsonrpc', 'id', 'result'],
        properties: {
            jsonrpc: { type: 'string' },
            id: { type: 'integer' },
            result: { type: 'object' },
            error: { type: 'string' },
        },
    };

    // Common transaction query schema
    static txQuerySchema = {
        type: 'object',
        required: ['tx'],
        properties: {
            tx: { type: 'string' },
        },
    };

    // Common hash query schema
    static hashQuerySchema = {
        type: 'object',
        required: ['hash'],
        properties: {
            hash: { type: 'string' },
        },
    };

    constructor(blockchain: Blockchain, options?: { endpoint?: string; nodeIndex?: number }) {
        this.blockchain = blockchain;
        this.nodeIndex = options?.nodeIndex;

        // Get endpoint - if nodeIndex is specified, use that node's consensus RPC URL
        if (this.nodeIndex !== undefined) {
            const node = blockchain.getNode(this.nodeIndex);
            this.httpEndpoint = node.getConsensusLayerRpcUrl();
        } else {
            this.httpEndpoint = options?.endpoint ?? blockchain.getConsensusLayerRpcUrl();
        }
    }

    // Helper methods
    private async getBlockHeight(): Promise<number> {
        // Use new Blockchain architecture
        const response = await this.blockchain.makeConsensusRpcCall(
            '/status',
            {},
            undefined,
            undefined,
            '',
            this.nodeIndex
        );
        return parseInt(response.result.sync_info.latest_block_height);
    }

    private async getBlockHash(blockHeight: number): Promise<string> {
        const queryBlock = { height: blockHeight };
        const responseBlock = await this.blockchain.makeConsensusRpcCall(
            '/block',
            queryBlock,
            undefined,
            undefined,
            '',
            this.nodeIndex
        );
        return '0x' + responseBlock.result.block_id.hash;
    }

    /**
     * Initialize test environment
     */
    async initialize(): Promise<CometBFTTestBuilder> {
        console.log('Initializing CometBFT test environment...');

        this.latestBlockHeight = await this.getBlockHeight();
        this.blockHeight = this.latestBlockHeight - 10;

        const connectivityResults = await this.blockchain.testConnectivity();
        const connected = Array.from(connectivityResults.values()).some(result => result);
        expect(connected).to.be.true;

        console.log(`✓ Initialized with block height: ${this.blockHeight}, latest: ${this.latestBlockHeight}`);
        return this;
    }

    // Test methods
    /**
     * Test validators - Get validators list
     */
    async testValidators(): Promise<CometBFTTestBuilder> {
        console.log('Testing method: validators...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                height: { type: 'integer', default: 0 },
                page: { type: 'integer', default: 1 },
                per_page: { type: 'integer', default: 30 },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    required: ['block_height', 'validators'],
                    properties: {
                        block_height: { type: 'string' },
                        validators: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    address: { type: 'string' },
                                    pub_key: {
                                        required: ['type', 'value'],
                                        properties: {
                                            type: { type: 'string' },
                                            value: { type: 'string' },
                                        },
                                        type: 'object',
                                    },
                                    voting_power: { type: 'string' },
                                    proposer_priority: { type: 'string' },
                                },
                            },
                        },
                        count: { type: 'string' },
                        total: { type: 'string' },
                    },
                    type: 'object',
                },
            },
        };

        const query = {
            height: this.blockHeight,
            page: 1,
            per_page: 30,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/validators',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ methond: validators test passed');
        return this;
    }

    /**
     * Test status - Get node status
     */
    async testStatus(): Promise<CometBFTTestBuilder> {
        console.log('Testing method: status...');

        const querySchema = null;
        const responseSchema = {
            description: 'Status Response',
            allOf: [
                {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        jsonrpc: { type: 'string' },
                    },
                },
                {
                    type: 'object',
                    properties: {
                        result: {
                            description: 'Status Response',
                            type: 'object',
                            properties: {
                                node_info: {
                                    type: 'object',
                                    properties: {
                                        protocol_version: {
                                            type: 'object',
                                            properties: {
                                                p2p: { type: 'string' },
                                                block: { type: 'string' },
                                                app: { type: 'string' },
                                            },
                                        },
                                        id: { type: 'string' },
                                        listen_addr: { type: 'string' },
                                        network: { type: 'string' },
                                        version: { type: 'string' },
                                        channels: { type: 'string' },
                                        moniker: { type: 'string' },
                                        other: {
                                            type: 'object',
                                            properties: {
                                                tx_index: { type: 'string' },
                                                rpc_address: { type: 'string' },
                                            },
                                        },
                                    },
                                },
                                sync_info: {
                                    type: 'object',
                                    properties: {
                                        latest_block_hash: { type: 'string' },
                                        latest_app_hash: { type: 'string' },
                                        latest_block_height: { type: 'string' },
                                        latest_block_time: { type: 'string' },
                                        earliest_block_hash: { type: 'string' },
                                        earliest_app_hash: { type: 'string' },
                                        earliest_block_height: { type: 'string' },
                                        earliest_block_time: { type: 'string' },
                                        catching_up: { type: 'boolean' },
                                    },
                                },
                                validator_info: {
                                    type: 'object',
                                    properties: {
                                        address: { type: 'string' },
                                        pub_key: {
                                            type: 'object',
                                            properties: {
                                                type: { type: 'string' },
                                                value: { type: 'string' },
                                            },
                                        },
                                        voting_power: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        };

        const query = {};
        const response = await this.blockchain.makeConsensusRpcCall(
            '/status',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: status test passed');
        return this;
    }

    /**
     * Test health - Get node health status
     */
    async testHealth(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping health test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: health...');

        const querySchema = null;
        const responseSchema = {
            description: 'Empty Response',
            allOf: [
                {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        jsonrpc: { type: 'string' },
                    },
                },
                {
                    type: 'object',
                    properties: {
                        result: {
                            type: 'object',
                            additionalProperties: {},
                        },
                    },
                },
            ],
        };

        const query = {};
        const response = await this.blockchain.makeConsensusRpcCall(
            '/health',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: health test passed');
        return this;
    }

    /**
     * Test status (for non-HTTPS endpoints) - Get node status
     */
    async testStatusNonHttps(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping status test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: status (non-HTTPS)...');

        const querySchema = null;
        const responseSchema = {
            description: 'Status Response',
            allOf: [
                {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        jsonrpc: { type: 'string' },
                    },
                },
                {
                    type: 'object',
                    properties: {
                        result: {
                            description: 'Status Response',
                            type: 'object',
                            properties: {
                                node_info: {
                                    type: 'object',
                                    properties: {
                                        protocol_version: {
                                            type: 'object',
                                            properties: {
                                                p2p: { type: 'string' },
                                                block: { type: 'string' },
                                                app: { type: 'string' },
                                            },
                                        },
                                        id: { type: 'string' },
                                        listen_addr: { type: 'string' },
                                        network: { type: 'string' },
                                        version: { type: 'string' },
                                        channels: { type: 'string' },
                                        moniker: { type: 'string' },
                                        other: {
                                            type: 'object',
                                            properties: {
                                                tx_index: { type: 'string' },
                                                rpc_address: { type: 'string' },
                                            },
                                        },
                                    },
                                },
                                sync_info: {
                                    type: 'object',
                                    properties: {
                                        latest_block_hash: { type: 'string' },
                                        latest_app_hash: { type: 'string' },
                                        latest_block_height: { type: 'string' },
                                        latest_block_time: { type: 'string' },
                                        earliest_block_hash: { type: 'string' },
                                        earliest_app_hash: { type: 'string' },
                                        earliest_block_height: { type: 'string' },
                                        earliest_block_time: { type: 'string' },
                                        catching_up: { type: 'boolean' },
                                    },
                                },
                                validator_info: {
                                    type: 'object',
                                    properties: {
                                        address: { type: 'string' },
                                        pub_key: {
                                            type: 'object',
                                            properties: {
                                                type: { type: 'string' },
                                                value: { type: 'string' },
                                            },
                                        },
                                        voting_power: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        };

        const query = {};
        const response = await this.blockchain.makeConsensusRpcCall(
            '/status',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: status (non-HTTPS) test passed');
        return this;
    }

    /**
     * Test net_info - Get network information
     */
    async testNetInfo(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping net_info test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: net_info...');

        const querySchema = null;
        const responseSchema = {
            description: 'NetInfo Response',
            allOf: [
                {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        jsonrpc: { type: 'string' },
                    },
                },
                {
                    type: 'object',
                    properties: {
                        result: {
                            type: 'object',
                            properties: {
                                listening: { type: 'boolean' },
                                listeners: {
                                    type: 'array',
                                    items: { type: 'string' },
                                },
                                n_peers: { type: 'string' },
                                peers: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            node_info: {
                                                type: 'object',
                                                properties: {
                                                    protocol_version: {
                                                        type: 'object',
                                                        properties: {
                                                            p2p: { type: 'string' },
                                                            block: { type: 'string' },
                                                            app: { type: 'string' },
                                                        },
                                                    },
                                                    id: { type: 'string' },
                                                    listen_addr: { type: 'string' },
                                                    network: { type: 'string' },
                                                    version: { type: 'string' },
                                                    channels: { type: 'string' },
                                                    moniker: { type: 'string' },
                                                    other: {
                                                        type: 'object',
                                                        properties: {
                                                            tx_index: { type: 'string' },
                                                            rpc_address: { type: 'string' },
                                                        },
                                                    },
                                                },
                                            },
                                            is_outbound: { type: 'boolean' },
                                            connection_status: {
                                                type: 'object',
                                                properties: {
                                                    Duration: { type: 'string' },
                                                    SendMonitor: {
                                                        type: 'object',
                                                        properties: {
                                                            Active: { type: 'boolean' },
                                                            Start: { type: 'string' },
                                                            Duration: { type: 'string' },
                                                            Idle: { type: 'string' },
                                                            Bytes: { type: 'string' },
                                                            Samples: { type: 'string' },
                                                            InstRate: { type: 'string' },
                                                            CurRate: { type: 'string' },
                                                            AvgRate: { type: 'string' },
                                                            PeakRate: { type: 'string' },
                                                            BytesRem: { type: 'string' },
                                                            TimeRem: { type: 'string' },
                                                            Progress: { type: 'integer' },
                                                        },
                                                    },
                                                    RecvMonitor: {
                                                        type: 'object',
                                                        properties: {
                                                            Active: { type: 'boolean' },
                                                            Start: { type: 'string' },
                                                            Duration: { type: 'string' },
                                                            Idle: { type: 'string' },
                                                            Bytes: { type: 'string' },
                                                            Samples: { type: 'string' },
                                                            InstRate: { type: 'string' },
                                                            CurRate: { type: 'string' },
                                                            AvgRate: { type: 'string' },
                                                            PeakRate: { type: 'string' },
                                                            BytesRem: { type: 'string' },
                                                            TimeRem: { type: 'string' },
                                                            Progress: { type: 'integer' },
                                                        },
                                                    },
                                                    Channels: {
                                                        type: 'array',
                                                        items: {
                                                            type: 'object',
                                                            properties: {
                                                                ID: { type: 'integer' },
                                                                SendQueueCapacity: { type: 'string' },
                                                                SendQueueSize: { type: 'string' },
                                                                Priority: { type: 'string' },
                                                                RecentlySent: { type: 'string' },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                            remote_ip: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        };

        const query = {};
        const response = await this.blockchain.makeConsensusRpcCall(
            '/net_info',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: net_info test passed');
        return this;
    }

    /**
     * Test blockchain - Get blockchain information
     */
    async testBlockchain(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping blockchain test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: blockchain...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                minHeight: { type: 'integer' },
                maxHeight: { type: 'integer' },
            },
        };

        const responseSchema = {
            description: 'Blockchain info',
            allOf: [
                {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        jsonrpc: { type: 'string' },
                    },
                },
                {
                    type: 'object',
                    properties: {
                        result: {
                            type: 'object',
                            required: ['last_height', 'block_metas'],
                            properties: {
                                last_height: { type: 'string' },
                                block_metas: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            block_id: {
                                                required: ['hash', 'parts'],
                                                properties: {
                                                    hash: { type: 'string' },
                                                    parts: {
                                                        required: ['total', 'hash'],
                                                        properties: {
                                                            total: { type: 'integer' },
                                                            hash: { type: 'string' },
                                                        },
                                                        type: 'object',
                                                    },
                                                },
                                                type: 'object',
                                            },
                                            block_size: { type: 'string' },
                                            header: {
                                                required: [
                                                    'version',
                                                    'chain_id',
                                                    'height',
                                                    'time',
                                                    'last_block_id',
                                                    'last_commit_hash',
                                                    'data_hash',
                                                    'validators_hash',
                                                    'next_validators_hash',
                                                    'consensus_hash',
                                                    'app_hash',
                                                    'last_results_hash',
                                                    'evidence_hash',
                                                    'proposer_address',
                                                ],
                                                properties: {
                                                    version: {
                                                        required: ['block'],
                                                        properties: {
                                                            block: { type: 'string' },
                                                            app: { type: 'string' },
                                                        },
                                                        type: 'object',
                                                    },
                                                    chain_id: { type: 'string' },
                                                    height: { type: 'string' },
                                                    time: { type: 'string' },
                                                    last_block_id: {
                                                        required: ['hash', 'parts'],
                                                        properties: {
                                                            hash: { type: 'string' },
                                                            parts: {
                                                                required: ['total', 'hash'],
                                                                properties: {
                                                                    total: { type: 'integer' },
                                                                    hash: { type: 'string' },
                                                                },
                                                                type: 'object',
                                                            },
                                                        },
                                                        type: 'object',
                                                    },
                                                    last_commit_hash: { type: 'string' },
                                                    data_hash: { type: 'string' },
                                                    validators_hash: { type: 'string' },
                                                    next_validators_hash: { type: 'string' },
                                                    consensus_hash: { type: 'string' },
                                                    app_hash: { type: 'string' },
                                                    last_results_hash: { type: 'string' },
                                                    evidence_hash: { type: 'string' },
                                                    proposer_address: { type: 'string' },
                                                },
                                                type: 'object',
                                            },
                                            num_txs: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        };

        const query = {
            minHeight: this.blockHeight,
            maxHeight: this.latestBlockHeight,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/blockchain',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: blockchain test passed');
        return this;
    }

    /**
     * Test header - Get block header
     */
    async testHeader(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping header test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: header...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                height: {
                    type: 'integer',
                    default: 0,
                },
            },
        };

        const responseSchema = {
            required: [
                'version',
                'chain_id',
                'height',
                'time',
                'last_block_id',
                'last_commit_hash',
                'data_hash',
                'validators_hash',
                'next_validators_hash',
                'consensus_hash',
                'app_hash',
                'last_results_hash',
                'evidence_hash',
                'proposer_address',
            ],
            properties: {
                version: {
                    required: ['block'],
                    properties: {
                        block: { type: 'string' },
                    },
                    type: 'object',
                },
                chain_id: { type: 'string' },
                height: { type: 'string' },
                time: { type: 'string' },
                last_block_id: {
                    required: ['hash', 'parts'],
                    properties: {
                        hash: { type: 'string' },
                        parts: {
                            required: ['total', 'hash'],
                            properties: {
                                total: { type: 'integer' },
                                hash: { type: 'string' },
                            },
                            type: 'object',
                        },
                    },
                    type: 'object',
                },
                last_commit_hash: { type: 'string' },
                data_hash: { type: 'string' },
                validators_hash: { type: 'string' },
                next_validators_hash: { type: 'string' },
                consensus_hash: { type: 'string' },
                app_hash: { type: 'string' },
                last_results_hash: { type: 'string' },
                evidence_hash: { type: 'string' },
                proposer_address: { type: 'string' },
            },
            type: 'object',
        };

        const query = {
            height: this.blockHeight,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/header',
            query,
            querySchema,
            responseSchema,
            'result.header',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: header test passed');
        return this;
    }

    /**
     * Test block - Get block
     */
    async testBlock(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping block test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: block...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                height: {
                    type: 'integer',
                    default: 0,
                },
            },
        };

        const query = {
            height: this.blockHeight,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/block',
            query,
            querySchema,
            CometBFTTestBuilder.blockResponseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: block test passed');
        return this;
    }

    /**
     * Test block_results - Get block results
     */
    async testBlockResults(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping block_results test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: block_results...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                height: {
                    type: 'integer',
                    default: 0,
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    type: 'object',
                    required: ['height'],
                    properties: {
                        height: { type: 'string' },
                        txs_results: {
                            type: 'array',
                            nullable: true,
                            items: {
                                type: 'object',
                                properties: {
                                    code: { type: 'integer' },
                                    data: { type: ['string', 'null'] },
                                    log: { type: 'string' },
                                    info: { type: 'string' },
                                    gas_wanted: { type: 'string' },
                                    gas_used: { type: 'string' },
                                    events: {
                                        type: 'array',
                                        nullable: true,
                                        items: {
                                            type: 'object',
                                            properties: {
                                                type: { type: 'string' },
                                                attributes: {
                                                    type: 'array',
                                                    nullable: false,
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            key: { type: 'string' },
                                                            value: { type: 'string' },
                                                            index: { type: 'boolean' },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    codespace: { type: 'string' },
                                },
                            },
                        },
                        finalize_block_events: {
                            type: 'array',
                            nullable: true,
                            items: {
                                type: 'object',
                                properties: {
                                    type: { type: 'string' },
                                    attributes: {
                                        type: 'array',
                                        nullable: false,
                                        items: {
                                            type: 'object',
                                            properties: {
                                                key: { type: 'string' },
                                                value: { type: 'string' },
                                                index: { type: 'boolean' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        validator_updates: {
                            type: 'array',
                            nullable: true,
                            items: {
                                type: 'object',
                                properties: {
                                    pub_key: {
                                        type: 'object',
                                        required: ['type', 'value'],
                                        properties: {
                                            type: { type: 'string' },
                                            value: { type: 'string' },
                                        },
                                    },
                                    power: { type: 'string' },
                                },
                            },
                        },
                        consensus_param_updates: {
                            type: 'object',
                            nullable: true,
                            required: ['block', 'evidence', 'validator'],
                            properties: {
                                block: {
                                    type: 'object',
                                    required: ['max_bytes', 'max_gas'],
                                    properties: {
                                        max_bytes: { type: 'string' },
                                        max_gas: { type: 'string' },
                                        time_iota_ms: { type: 'string' },
                                    },
                                },
                                evidence: {
                                    type: 'object',
                                    required: ['max_age_num_blocks', 'max_age_duration'],
                                    properties: {
                                        max_age_num_blocks: { type: 'string' },
                                        max_age_duration: { type: 'string' },
                                    },
                                },
                                validator: {
                                    type: 'object',
                                    required: ['pub_key_types'],
                                    properties: {
                                        pub_key_types: {
                                            type: 'array',
                                            items: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        const query = {
            height: this.blockHeight,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/block_results',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: block_results test passed');
        return this;
    }

    /**
     * Test commit - Get commit
     */
    async testCommit(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping commit test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: commit...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                height: {
                    type: 'integer',
                    default: 0,
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    required: ['signed_header', 'canonical'],
                    properties: {
                        signed_header: {
                            required: ['header', 'commit'],
                            properties: {
                                header: {
                                    required: [
                                        'version',
                                        'chain_id',
                                        'height',
                                        'time',
                                        'last_block_id',
                                        'last_commit_hash',
                                        'data_hash',
                                        'validators_hash',
                                        'next_validators_hash',
                                        'consensus_hash',
                                        'app_hash',
                                        'last_results_hash',
                                        'evidence_hash',
                                        'proposer_address',
                                    ],
                                    properties: {
                                        version: {
                                            required: ['block'],
                                            properties: {
                                                block: { type: 'string' },
                                            },
                                            type: 'object',
                                        },
                                        chain_id: { type: 'string' },
                                        height: { type: 'string' },
                                        time: { type: 'string' },
                                        last_block_id: {
                                            required: ['hash', 'parts'],
                                            properties: {
                                                hash: { type: 'string' },
                                                parts: {
                                                    required: ['total', 'hash'],
                                                    properties: {
                                                        total: { type: 'integer' },
                                                        hash: { type: 'string' },
                                                    },
                                                    type: 'object',
                                                },
                                            },
                                            type: 'object',
                                        },
                                        last_commit_hash: { type: 'string' },
                                        data_hash: { type: 'string' },
                                        validators_hash: { type: 'string' },
                                        next_validators_hash: { type: 'string' },
                                        consensus_hash: { type: 'string' },
                                        app_hash: { type: 'string' },
                                        last_results_hash: { type: 'string' },
                                        evidence_hash: { type: 'string' },
                                        proposer_address: { type: 'string' },
                                    },
                                    type: 'object',
                                },
                                commit: {
                                    required: ['height', 'round', 'block_id', 'signatures'],
                                    properties: {
                                        height: { type: 'string' },
                                        round: { type: 'integer' },
                                        block_id: {
                                            required: ['hash', 'parts'],
                                            properties: {
                                                hash: { type: 'string' },
                                                parts: {
                                                    required: ['total', 'hash'],
                                                    properties: {
                                                        total: { type: 'integer' },
                                                        hash: { type: 'string' },
                                                    },
                                                    type: 'object',
                                                },
                                            },
                                            type: 'object',
                                        },
                                        signatures: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    block_id_flag: { type: 'integer' },
                                                    validator_address: { type: 'string' },
                                                    timestamp: { type: 'string' },
                                                    signature: {
                                                        anyOf: [{ type: 'string' }, { type: 'null' }],
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    type: 'object',
                                },
                            },
                            type: 'object',
                        },
                        canonical: { type: 'boolean' },
                    },
                    type: 'object',
                },
            },
        };

        const query = {
            height: this.blockHeight,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/commit',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: commit test passed');
        return this;
    }

    /**
     * Test validators (for non-HTTPS endpoints) - Get validators list
     */
    async testValidatorsNonHttps(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping validators test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: validators (non-HTTPS)...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                height: {
                    type: 'integer',
                    default: 0,
                },
                page: {
                    type: 'integer',
                    default: 1,
                },
                per_page: {
                    type: 'integer',
                    default: 30,
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    required: ['block_height', 'validators'],
                    properties: {
                        block_height: { type: 'string' },
                        validators: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    address: { type: 'string' },
                                    pub_key: {
                                        required: ['type', 'value'],
                                        properties: {
                                            type: { type: 'string' },
                                            value: { type: 'string' },
                                        },
                                        type: 'object',
                                    },
                                    voting_power: { type: 'string' },
                                    proposer_priority: { type: 'string' },
                                },
                            },
                        },
                        count: { type: 'string' },
                        total: { type: 'string' },
                    },
                    type: 'object',
                },
            },
        };

        const query = {
            height: this.blockHeight,
            page: 1,
            per_page: 30,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/validators',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: validators (non-HTTPS) test passed');
        return this;
    }

    /**
     * Test genesis - Get genesis
     */
    async testGenesis(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping genesis test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: genesis...');

        const querySchema = null;
        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    type: 'object',
                    required: ['genesis'],
                    properties: {
                        genesis: {
                            type: 'object',
                            required: ['genesis_time', 'chain_id', 'initial_height', 'consensus_params', 'app_hash'],
                            properties: {
                                genesis_time: { type: 'string' },
                                chain_id: { type: 'string' },
                                initial_height: { type: 'string' },
                                consensus_params: {
                                    type: 'object',
                                    nullable: true,
                                    required: ['block', 'evidence', 'validator'],
                                    properties: {
                                        block: {
                                            type: 'object',
                                            required: ['max_bytes', 'max_gas'],
                                            properties: {
                                                max_bytes: { type: 'string' },
                                                max_gas: { type: 'string' },
                                            },
                                        },
                                        evidence: {
                                            type: 'object',
                                            required: ['max_age_num_blocks', 'max_age_duration'],
                                            properties: {
                                                max_age_num_blocks: { type: 'string' },
                                                max_age_duration: { type: 'string' },
                                            },
                                        },
                                        validator: {
                                            type: 'object',
                                            required: ['pub_key_types'],
                                            properties: {
                                                pub_key_types: {
                                                    type: 'array',
                                                    items: { type: 'string' },
                                                },
                                            },
                                        },
                                    },
                                },
                                app_hash: { type: 'string' },
                                app_state: {
                                    properties: {},
                                    type: 'object',
                                },
                            },
                        },
                    },
                },
            },
        };

        const query = {};
        const response = await this.blockchain.makeConsensusRpcCall(
            '/genesis',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: genesis test passed');
        return this;
    }

    /**
     * Test genesis_chunked - Get genesis document in chunks
     */
    async testGenesisChunked(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping genesis_chunked test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: genesis_chunked...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                chunk: {
                    type: 'integer',
                    default: 0,
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    required: ['chunk', 'total', 'data'],
                    properties: {
                        chunk: { type: 'string' },
                        total: { type: 'string' },
                        data: { type: 'string' },
                    },
                    type: 'object',
                },
            },
        };

        const query = {
            chunk: 0,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/genesis_chunked',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: genesis_chunked test passed');
        return this;
    }

    /**
     * Test dump_consensus_state - Get consensus state
     */
    async testDumpConsensusState(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping dump_consensus_state test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: dump_consensus_state...');

        const querySchema = null;
        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    required: ['round_state', 'peers'],
                    properties: {
                        round_state: {
                            required: [
                                'height',
                                'round',
                                'step',
                                'start_time',
                                'commit_time',
                                'validators',
                                'proposal',
                                'proposal_block',
                                'proposal_block_parts',
                                'locked_round',
                                'locked_block',
                                'locked_block_parts',
                                'valid_round',
                                'valid_block',
                                'valid_block_parts',
                                'votes',
                                'commit_round',
                                'last_commit',
                                'last_validators',
                                'triggered_timeout_precommit',
                            ],
                            properties: {
                                height: { type: 'string' },
                                round: { type: 'integer' },
                                step: { type: 'integer' },
                                start_time: { type: 'string' },
                                commit_time: { type: 'string' },
                                validators: {
                                    required: ['validators', 'proposer'],
                                    properties: {
                                        validators: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    address: { type: 'string' },
                                                    pub_key: {
                                                        required: ['type', 'value'],
                                                        properties: {
                                                            type: { type: 'string' },
                                                            value: { type: 'string' },
                                                        },
                                                        type: 'object',
                                                    },
                                                    voting_power: { type: 'string' },
                                                    proposer_priority: { type: 'string' },
                                                },
                                            },
                                        },
                                        proposer: {
                                            type: 'object',
                                            properties: {
                                                address: { type: 'string' },
                                                pub_key: {
                                                    required: ['type', 'value'],
                                                    properties: {
                                                        type: { type: 'string' },
                                                        value: { type: 'string' },
                                                    },
                                                    type: 'object',
                                                },
                                                voting_power: { type: 'string' },
                                                proposer_priority: { type: 'string' },
                                            },
                                        },
                                    },
                                    type: 'object',
                                },
                                locked_round: { type: 'integer' },
                                valid_round: { type: 'integer' },
                                votes: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            round: { type: 'integer' },
                                            prevotes: {
                                                type: 'array',
                                                nullable: true,
                                                items: { type: 'string' },
                                            },
                                            prevotes_bit_array: { type: 'string' },
                                            precommits: {
                                                type: 'array',
                                                nullable: true,
                                                items: { type: 'string' },
                                            },
                                            precommits_bit_array: { type: 'string' },
                                        },
                                    },
                                },
                                commit_round: { type: 'integer' },
                                last_commit: {
                                    type: ['object', 'null'],
                                    properties: {
                                        // Old Tendermint fields
                                        votes: {
                                            type: 'array',
                                            items: { type: 'string' },
                                        },
                                        votes_bit_array: { type: 'string' },
                                        peer_maj_23s: {
                                            properties: {},
                                            type: 'object',
                                        },
                                    },
                                },
                                last_validators: {
                                    required: ['validators', 'proposer'],
                                    properties: {
                                        validators: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    address: { type: 'string' },
                                                    pub_key: {
                                                        required: ['type', 'value'],
                                                        properties: {
                                                            type: { type: 'string' },
                                                            value: { type: 'string' },
                                                        },
                                                        type: 'object',
                                                    },
                                                    voting_power: { type: 'string' },
                                                    proposer_priority: { type: 'string' },
                                                },
                                            },
                                        },
                                        proposer: {
                                            type: 'object',
                                            properties: {
                                                address: { type: 'string' },
                                                pub_key: {
                                                    required: ['type', 'value'],
                                                    properties: {
                                                        type: { type: 'string' },
                                                        value: { type: 'string' },
                                                    },
                                                    type: 'object',
                                                },
                                                voting_power: { type: 'string' },
                                                proposer_priority: { type: 'string' },
                                            },
                                        },
                                    },
                                    type: 'object',
                                },
                                triggered_timeout_precommit: { type: 'boolean' },
                            },
                            type: 'object',
                        },
                        peers: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    node_address: { type: 'string' },
                                    peer_state: {
                                        required: ['round_state', 'stats'],
                                        properties: {
                                            round_state: {
                                                required: [
                                                    'height',
                                                    'round',
                                                    'step',
                                                    'start_time',
                                                    'proposal',
                                                    'proposal_block_part_set_header',
                                                    'proposal_pol_round',
                                                    'proposal_pol',
                                                    'prevotes',
                                                    'precommits',
                                                    'last_commit_round',
                                                    'last_commit',
                                                    'catchup_commit_round',
                                                    'catchup_commit',
                                                ],
                                                properties: {
                                                    height: { type: 'string' },
                                                    round: { type: 'integer' },
                                                    step: { type: 'integer' },
                                                    start_time: { type: 'string' },
                                                    proposal: { type: 'boolean' },
                                                    proposal_block_part_set_header: {
                                                        required: ['total', 'hash'],
                                                        properties: {
                                                            total: { type: 'integer' },
                                                            hash: { type: 'string' },
                                                        },
                                                        type: 'object',
                                                    },
                                                    proposal_pol_round: {
                                                        nullable: true,
                                                        type: 'integer',
                                                    },
                                                    proposal_pol: {
                                                        nullable: true,
                                                        type: 'string',
                                                    },
                                                    prevotes: {
                                                        nullable: true,
                                                        type: 'string',
                                                    },
                                                    precommits: {
                                                        nullable: true,
                                                        type: 'string',
                                                    },
                                                    last_commit_round: {
                                                        nullable: true,
                                                        type: 'integer',
                                                    },
                                                    last_commit: {
                                                        nullable: true,
                                                        type: 'string',
                                                    },
                                                    catchup_commit_round: {
                                                        type: 'integer',
                                                        nullable: true,
                                                    },
                                                    catchup_commit: {
                                                        nullable: true,
                                                        type: 'string',
                                                    },
                                                },
                                                type: 'object',
                                            },
                                            stats: {
                                                required: ['votes', 'block_parts'],
                                                properties: {
                                                    votes: { type: 'string' },
                                                    block_parts: { type: 'string' },
                                                },
                                                type: 'object',
                                            },
                                        },
                                        type: 'object',
                                    },
                                },
                            },
                        },
                    },
                    type: 'object',
                },
            },
        };

        const query = {};
        const response = await this.blockchain.makeConsensusRpcCall(
            '/dump_consensus_state',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: dump_consensus_state test passed');
        return this;
    }

    /**
     * Test consensus_state - Get consensus state
     */
    async testConsensusState(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping consensus_state test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: consensus_state...');

        const querySchema = null;
        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    required: ['round_state'],
                    properties: {
                        round_state: {
                            required: [
                                'height/round/step',
                                'start_time',
                                'proposal_block_hash',
                                'locked_block_hash',
                                'valid_block_hash',
                                'height_vote_set',
                                'proposer',
                            ],
                            properties: {
                                'height/round/step': { type: 'string' },
                                start_time: { type: 'string' },
                                proposal_block_hash: { type: 'string' },
                                locked_block_hash: { type: 'string' },
                                valid_block_hash: { type: 'string' },
                                height_vote_set: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            round: { type: 'integer' },
                                            prevotes: {
                                                type: 'array',
                                                items: { type: 'string' },
                                            },
                                            prevotes_bit_array: { type: 'string' },
                                            precommits: {
                                                type: 'array',
                                                items: { type: 'string' },
                                            },
                                            precommits_bit_array: { type: 'string' },
                                        },
                                    },
                                },
                                proposer: {
                                    type: 'object',
                                    properties: {
                                        address: { type: 'string' },
                                        index: { type: 'integer' },
                                    },
                                },
                            },
                            type: 'object',
                        },
                    },
                    type: 'object',
                },
            },
        };

        const query = {};
        const response = await this.blockchain.makeConsensusRpcCall(
            '/consensus_state',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: consensus_state test passed');
        return this;
    }

    /**
     * Test consensus_params - Get consensus parameters
     */
    async testConsensusParams(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping consensus_params test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: consensus_params...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                height: {
                    type: 'integer',
                    default: 0,
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    type: 'object',
                    required: ['block_height', 'consensus_params'],
                    properties: {
                        block_height: { type: 'string' },
                        consensus_params: {
                            type: 'object',
                            nullable: true,
                            required: ['block', 'evidence', 'validator'],
                            properties: {
                                block: {
                                    type: 'object',
                                    required: ['max_bytes', 'max_gas'],
                                    properties: {
                                        max_bytes: { type: 'string' },
                                        max_gas: { type: 'string' },
                                    },
                                },
                                evidence: {
                                    type: 'object',
                                    required: ['max_age_num_blocks', 'max_age_duration'],
                                    properties: {
                                        max_age_num_blocks: { type: 'string' },
                                        max_age_duration: { type: 'string' },
                                    },
                                },
                                validator: {
                                    type: 'object',
                                    required: ['pub_key_types'],
                                    properties: {
                                        pub_key_types: {
                                            type: 'array',
                                            items: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        const query = {
            height: this.blockHeight,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/consensus_params',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: consensus_params test passed');
        return this;
    }

    /**
     * Test unconfirmed_txs - Get list of unconfirmed transactions
     */
    async testUnconfirmedTxs(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping unconfirmed_txs test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: unconfirmed_txs...');

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                limit: {
                    type: 'integer',
                    default: 30,
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    required: ['n_txs', 'total', 'total_bytes', 'txs'],
                    properties: {
                        n_txs: { type: 'string' },
                        total: { type: 'string' },
                        total_bytes: { type: 'string' },
                        txs: {
                            type: 'array',
                            nullable: true,
                            items: {
                                type: 'string',
                                nullable: true,
                            },
                        },
                    },
                    type: 'object',
                },
            },
        };

        const query = {
            limit: 1,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/unconfirmed_txs',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ unconfirmed_txs test passed');
        return this;
    }

    /**
     * Test num_unconfirmed_txs - Get data about unconfirmed transactions
     */
    async testNumUnconfirmedTxs(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping num_unconfirmed_txs test for HTTPS endpoint');
            return this;
        }

        console.log('Testing num_unconfirmed_txs...');

        const querySchema = null;
        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    required: ['n_txs', 'total', 'total_bytes'],
                    properties: {
                        n_txs: { type: 'string' },
                        total: { type: 'string' },
                        total_bytes: { type: 'string' },
                    },
                    type: 'object',
                },
            },
        };

        const query = {};
        const response = await this.blockchain.makeConsensusRpcCall(
            '/num_unconfirmed_txs',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ num_unconfirmed_txs test passed');
        return this;
    }

    /**
     * Test abci_info - Get info about the application
     */
    async testAbciInfo(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping abci_info test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: abci_info...');

        const querySchema = null;
        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    required: ['response'],
                    properties: {
                        response: {
                            required: ['data', 'last_block_height', 'last_block_app_hash'],
                            properties: {
                                data: { type: 'string' },
                                last_block_height: { type: 'string' },
                                last_block_app_hash: { type: 'string' },
                            },
                            type: 'object',
                        },
                    },
                    type: 'object',
                },
            },
        };

        const query = {};
        const response = await this.blockchain.makeConsensusRpcCall(
            '/abci_info',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: abci_info test passed');
        return this;
    }

    /**
     * Test abci_query - Query the application for some information
     */
    async testAbciQuery(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping abci_query test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: abci_query...');

        const querySchema = {
            type: 'object',
            required: ['path', 'data'],
            properties: {
                path: { type: 'string' },
                data: { type: 'string' },
                height: {
                    type: 'integer',
                    default: 0,
                },
                prove: {
                    type: 'boolean',
                    default: false,
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['result', 'id', 'jsonrpc'],
            properties: {
                error: { type: 'string' },
                result: {
                    required: ['response'],
                    properties: {
                        response: {
                            required: [
                                'log',
                                'height',
                                'proofOps',
                                'value',
                                'key',
                                'index',
                                'code',
                                'codespace',
                                'info',
                            ],
                            properties: {
                                log: { type: 'string' },
                                height: { type: 'string' },
                                proofOps: {
                                    anyOf: [{ type: 'string' }, { type: 'null' }],
                                },
                                value: {
                                    anyOf: [{ type: 'string' }, { type: 'null' }],
                                },
                                key: {
                                    anyOf: [{ type: 'string' }, { type: 'null' }],
                                },
                                index: { type: 'string' },
                                code: { type: 'number' },
                                codespace: { type: 'string' },
                                info: { type: 'string' },
                            },
                            type: 'object',
                        },
                    },
                    type: 'object',
                },
                id: { type: 'integer' },
                jsonrpc: { type: 'string' },
            },
        };

        const query = {
            path: '"/a/b/c"',
            data: '"IHAVENOIDEA"',
            height: this.blockHeight,
            prove: true,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/abci_query',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: abci_query test passed');
        return this;
    }

    /**
     * Test header_by_hash - Get Header By Hash
     */
    async testHeaderByHash(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping header_by_hash test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: header_by_hash...');

        const responseSchema = {
            required: [
                'version',
                'chain_id',
                'height',
                'time',
                'last_block_id',
                'last_commit_hash',
                'data_hash',
                'validators_hash',
                'next_validators_hash',
                'consensus_hash',
                'app_hash',
                'last_results_hash',
                'evidence_hash',
                'proposer_address',
            ],
            properties: {
                version: {
                    required: ['block'],
                    properties: {
                        block: { type: 'string' },
                    },
                    type: 'object',
                },
                chain_id: { type: 'string' },
                height: { type: 'string' },
                time: { type: 'string' },
                last_block_id: {
                    required: ['hash', 'parts'],
                    properties: {
                        hash: { type: 'string' },
                        parts: {
                            required: ['total', 'hash'],
                            properties: {
                                total: { type: 'integer' },
                                hash: { type: 'string' },
                            },
                            type: 'object',
                        },
                    },
                    type: 'object',
                },
                last_commit_hash: { type: 'string' },
                data_hash: { type: 'string' },
                validators_hash: { type: 'string' },
                next_validators_hash: { type: 'string' },
                consensus_hash: { type: 'string' },
                app_hash: { type: 'string' },
                last_results_hash: { type: 'string' },
                evidence_hash: { type: 'string' },
                proposer_address: { type: 'string' },
            },
            type: 'object',
        };

        const blockHash = await this.getBlockHash(this.blockHeight);
        const query = {
            hash: blockHash,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/header_by_hash',
            query,
            CometBFTTestBuilder.hashQuerySchema,
            responseSchema,
            'result.header'
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: header_by_hash test passed');
        return this;
    }

    /**
     * Test block_by_hash - Get Block By Hash
     */
    async testBlockByHash(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping block_by_hash test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: block_by_hash...');

        const blockHash = await this.getBlockHash(this.blockHeight);
        const query = {
            hash: blockHash,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/block_by_hash',
            query,
            CometBFTTestBuilder.hashQuerySchema,
            CometBFTTestBuilder.blockResponseSchema
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: block_by_hash test passed');
        return this;
    }

    /**
     * Test block_search - Search for blocks by FinalizeBlock events
     */
    async testBlockSearch(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping block_search test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: block_search...');

        const querySchema = {
            type: 'object',
            required: ['query'],
            properties: {
                query: { type: 'string' },
                page: {
                    type: 'integer',
                    default: 1,
                },
                per_page: {
                    type: 'integer',
                    default: 30,
                },
                order_by: {
                    type: 'string',
                    default: 'desc',
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                    type: 'object',
                    required: ['blocks', 'total_count'],
                    properties: {
                        blocks: {
                            type: 'array',
                            items: CometBFTTestBuilder.blockResponseSchema.properties.result,
                        },
                        total_count: { type: 'string' },
                    },
                },
            },
        };

        const query = {
            query: '"block.height=' + this.blockHeight + '"',
            page: 1,
            per_page: 3,
            order_by: '"asc"',
        };

        // block_search may succeed (if block indexing is enabled) or fail (if disabled)
        // Both cases are valid depending on chain configuration
        try {
            const response = await this.blockchain.makeConsensusRpcCall(
                '/block_search',
                query,
                querySchema,
                responseSchema,
                '',
                this.nodeIndex
            );
            // Block indexing is enabled - validate response
            expect(response).to.have.property('result');
            console.log('✓ method: block_search test passed (indexing enabled)');
        } catch (error: unknown) {
            // Block indexing is disabled - this is also valid
            const errorMessage = error instanceof Error ? error.message : String(error);
            expect(errorMessage).to.include('block indexing is disabled');
            console.log('✓ method: block_search test passed (indexing disabled)');
        }
        return this;
    }

    /**
     * Test broadcast_tx_sync - Broadcast transaction synchronously
     */
    async testBroadcastTxSync(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping broadcast_tx_sync test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: broadcast_tx_sync...');

        const responseSchema = {
            ...CometBFTTestBuilder.jsonRpcResponseSchema,
            properties: {
                ...CometBFTTestBuilder.jsonRpcResponseSchema.properties,
                result: CometBFTTestBuilder.check_txResponseSchema,
            },
        };

        const query = {
            tx: '"456"',
        };

        try {
            const response = await this.blockchain.makeConsensusRpcCall(
                '/broadcast_tx_sync',
                query,
                CometBFTTestBuilder.txQuerySchema,
                responseSchema
            );
            expect(response).to.not.be.empty;
            console.log('✓ method: broadcast_tx_sync test passed');
        } catch (error) {
            if (error instanceof Error && error.message.includes('nop')) {
                console.log('⚠️ broadcast_tx_sync skipped: nop mempool not supported');
            } else if (error instanceof Error && error.message.includes('tx parse error')) {
                console.log(
                    '⚠️ broadcast_tx_sync skipped: chain rejects dummy tx at decode (strict protobuf validation)'
                );
            } else {
                throw error;
            }
        }
        return this;
    }

    /**
     * Test broadcast_tx_async - Broadcast transaction asynchronously
     */
    async testBroadcastTxAsync(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping broadcast_tx_async test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: broadcast_tx_async...');

        const responseSchema = {
            ...CometBFTTestBuilder.jsonRpcResponseSchema,
            properties: {
                ...CometBFTTestBuilder.jsonRpcResponseSchema.properties,
                result: {
                    required: ['code', 'data', 'log', 'hash'],
                    properties: {
                        code: { type: 'integer' },
                        data: { type: 'string' },
                        log: { type: 'string' },
                        codespace: { type: 'string' },
                        hash: { type: 'string' },
                    },
                    type: 'object',
                },
            },
        };

        const query = {
            tx: '"123"',
        };

        try {
            const response = await this.blockchain.makeConsensusRpcCall(
                '/broadcast_tx_async',
                query,
                CometBFTTestBuilder.txQuerySchema,
                responseSchema
            );
            expect(response).to.not.be.empty;
            console.log('✓ method: broadcast_tx_async test passed');
        } catch (error) {
            if (error instanceof Error && error.message.includes('nop')) {
                console.log('⚠️ broadcast_tx_async skipped: nop mempool not supported');
            } else if (error instanceof Error && error.message.includes('tx parse error')) {
                console.log(
                    '⚠️ broadcast_tx_async skipped: chain rejects dummy tx at decode (strict protobuf validation)'
                );
            } else {
                throw error;
            }
        }
        return this;
    }

    /**
     * Test broadcast_tx_commit - Broadcast transaction and wait for commit
     */
    async testBroadcastTxCommit(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping broadcast_tx_commit test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: broadcast_tx_commit...');

        const responseSchema = {
            type: 'object',
            required: ['result', 'id', 'jsonrpc'],
            properties: {
                error: { type: 'string' },
                result: {
                    required: ['height', 'hash', 'check_tx'],
                    properties: {
                        height: { type: 'string' },
                        hash: { type: 'string' },
                        // CometBFT 0.38+ uses 'tx_result'; older Tendermint uses 'deliver_tx'
                        tx_result: CometBFTTestBuilder.check_txResponseSchema,
                        deliver_tx: CometBFTTestBuilder.check_txResponseSchema,
                        check_tx: CometBFTTestBuilder.check_txResponseSchema,
                    },
                    type: 'object',
                },
                id: { type: 'integer' },
                jsonrpc: { type: 'string' },
            },
        };

        const query = {
            tx: '0x01111111111111111111111111111111',
        };

        try {
            const response = await this.blockchain.makeConsensusRpcCall(
                '/broadcast_tx_commit',
                query,
                CometBFTTestBuilder.txQuerySchema,
                responseSchema
            );
            expect(response).to.not.be.empty;
            console.log('✓ method: broadcast_tx_commit test passed');
        } catch (error) {
            if (error instanceof Error && error.message.includes('nop')) {
                console.log('⚠️ broadcast_tx_commit skipped: nop mempool not supported');
            } else if (error instanceof Error && error.message.includes('tx parse error')) {
                console.log(
                    '⚠️ broadcast_tx_commit skipped: chain rejects dummy tx at decode (strict protobuf validation)'
                );
            } else {
                throw error;
            }
        }
        return this;
    }

    /**
     * Test check_tx - Check transaction
     */
    async testCheckTx(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping check_tx test for HTTPS endpoint');
            return this;
        }

        console.log('Testing method: check_tx...');

        const responseSchema = {
            type: 'object',
            required: ['result', 'id', 'jsonrpc'],
            properties: {
                error: { type: 'string' },
                result: CometBFTTestBuilder.check_txResponseSchema,
                id: { type: 'integer' },
                jsonrpc: { type: 'string' },
            },
        };

        const txHash = '0x8FCF360CD38C951A875E9D811FC262B64D454AEE087F8EB02431F735A75C3BBD';
        const query = {
            tx: txHash,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/check_tx',
            query,
            CometBFTTestBuilder.txQuerySchema,
            responseSchema
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: check_tx test passed');
        return this;
    }

    /**
     * Test dial_seeds - Dial a peer (skipped for safety)
     *
     * NOTE: This test is skipped for the following reasons:
     * 1. Safety: dial_seeds is an unsafe operation that can modify network connections
     * 2. HTTPS restriction: Only runs on non-HTTPS endpoints (like local development)
     * 3. Manual enablement: Can be enabled by changing it.skip to it for testing
     *
     * Execution conditions:
     * - Endpoint must NOT be HTTPS (local development only)
     * - Test must be manually enabled (it.skip -> it)
     * - Should only be run in controlled environments
     */
    async testDialSeeds(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping dial_seeds test for HTTPS endpoint');
            return this;
        }

        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                peers: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
            },
        };

        const responseSchema = {
            type: 'object',
            properties: {
                Log: {
                    type: 'string',
                },
            },
        };

        const query = {};

        const response = await this.blockchain.makeConsensusRpcCall(
            '/dial_seeds',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: dial_seeds test passed');
        return this;
    }

    /**
     * Test dial_peers - Set a persistent peer (skipped for safety)
     *
     * NOTE: This test is skipped for the following reasons:
     * 1. Safety: dial_peers is an unsafe operation that can modify network connections
     * 2. HTTPS restriction: Only runs on non-HTTPS endpoints (like local development)
     * 3. Manual enablement: Can be enabled by changing it.skip to it for testing
     *
     * Execution conditions:
     * - Endpoint must NOT be HTTPS (local development only)
     * - Test must be manually enabled (it.skip -> it)
     * - Should only be run in controlled environments
     */
    async testDialPeers(): Promise<CometBFTTestBuilder> {
        await Promise.resolve();
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping dial_peers test for HTTPS endpoint');
            return this;
        }

        console.log('⚠️ Skipping dial_peers test (unsafe operation)');

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const querySchema = {
            type: 'object',
            required: [],
            properties: {
                persistent: {
                    type: 'boolean',
                },
                unconditional: {
                    type: 'boolean',
                },
                private: {
                    type: 'boolean',
                },
                peers: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const responseSchema = {
            type: 'object',
            properties: {
                Log: {
                    type: 'string',
                },
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const query = {
            persistent: true,
            unconditional: true,
            private: true,
        };

        // Note: This is skipped for safety, so we don't actually make the request
        // const response = await this.blockchain.makeConsensusRpcCall("/dial_peers", query, querySchema, responseSchema, '', this.nodeIndex);
        // expect(response).to.not.be.empty;

        return this;
    }

    /**
     * Test broadcast_evidence - Broadcast evidence of misbehavior (skipped for safety)
     *
     * NOTE: This test is skipped for the following reasons:
     * 1. Safety: broadcast_evidence can trigger network-wide evidence propagation
     * 2. HTTPS restriction: Only runs on non-HTTPS endpoints (like local development)
     * 3. Manual enablement: Can be enabled by changing it.skip to it for testing
     *
     * Execution conditions:
     * - Endpoint must NOT be HTTPS (local development only)
     * - Test must be manually enabled (it.skip -> it)
     * - Should only be run in controlled environments
     */
    async testBroadcastEvidence(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping broadcast_evidence test for HTTPS endpoint');
            return this;
        }

        const querySchema = {
            type: 'object',
            required: ['evidence'],
            properties: {
                evidence: {
                    type: 'object',
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['id', 'jsonrpc'],
            properties: {
                error: {
                    type: 'string',
                },
                result: {
                    type: 'string',
                },
                id: {
                    type: 'integer',
                },
                jsonrpc: {
                    type: 'string',
                },
            },
        };

        const query = {
            evidence: {
                type: 'tendermint/DuplicateVoteEvidence',
                duplicate_vote_evidence: {
                    vote_a: {
                        type: 2,
                        height: '20',
                        round: '1',
                        block_id: {
                            hash: 'A47D8D932829C0E63D9BE7923AC7BB9488521D5138D44C75A5944AE0B10AA5BC',
                            parts: {
                                total: '3',
                                hash: '2C33E51071A5E90609FA7184EA03896E1B51DB32A5DD646C5E1819FEA605D574',
                            },
                        },
                        timestamp: '2022-09-21T11:23:17.000Z',
                        validator_address: '4B1E54CCECF2E0F851C08BE6D1D141A8C2FBB319',
                        validator_index: '1',
                        signature: 'QWERTYUIOPASDFGHJKLZXCVBNM1234567890ABCDE',
                    },
                    vote_b: {
                        type: 2,
                        height: '20',
                        round: '1',
                        block_id: {
                            hash: 'C4B0A2326BA8C7439654A4EE55DE389B00879797CA9FF7761F1C63F5A2F3B6EF',
                            parts: {
                                total: '3',
                                hash: '0A57EFFC8945ABFB5A74EBC2430E4B7DAC74FDB7CD4741221774A197395D5037',
                            },
                        },
                        timestamp: '2022-09-21T11:23:17.000Z',
                        validator_address: '4B1E54CCECF2E0F851C08BE6D1D141A8C2FBB319',
                        validator_index: '1',
                        signature: 'ZXCVBNMASDFGHJKLQWERTYUIOP1234567890ABCD',
                    },
                    total_voting_power: '10000',
                    validator_power: '100',
                    timestamp: '2022-09-21T11:23:17.000Z',
                },
            },
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/broadcast_evidence',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: broadcast_evidence test passed');
        return this;
    }

    /**
     * Test tx_search - Search for transactions (skipped for development)
     *
     * NOTE: This test is skipped for the following reasons:
     * 1. Development: tx_search functionality is still under development
     * 2. HTTPS restriction: Only runs on non-HTTPS endpoints (like local development)
     * 3. Manual enablement: Can be enabled by changing it.skip to it for testing
     *
     * Execution conditions:
     * - Endpoint must NOT be HTTPS (local development only)
     * - Test must be manually enabled (it.skip -> it)
     * - Should only be run when tx_search is fully implemented
     */
    async testTxSearch(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping tx_search test for HTTPS endpoint');
            return this;
        }

        const querySchema = {
            type: 'object',
            required: ['query'],
            properties: {
                query: {
                    type: 'string',
                },
                prove: {
                    type: 'boolean',
                    default: false,
                },
                page: {
                    type: 'integer',
                    default: 1,
                },
                per_page: {
                    type: 'integer',
                    default: 30,
                },
                order_by: {
                    type: 'string',
                    default: 'asc',
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: {
                    type: 'string',
                },
                id: {
                    type: 'integer',
                },
                result: {
                    required: ['txs', 'total_count'],
                    properties: {
                        txs: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    hash: {
                                        type: 'string',
                                    },
                                    height: {
                                        type: 'string',
                                    },
                                    index: {
                                        type: 'integer',
                                    },
                                    tx_result: {
                                        required: ['log', 'gas_wanted', 'gas_used'],
                                        properties: {
                                            log: {
                                                type: 'string',
                                            },
                                            gas_wanted: {
                                                type: 'string',
                                            },
                                            gas_used: {
                                                type: 'string',
                                            },
                                        },
                                        type: 'object',
                                    },
                                    tx: {
                                        type: 'string',
                                    },
                                    proof: {
                                        required: ['root_hash', 'data', 'proof'],
                                        properties: {
                                            root_hash: {
                                                type: 'string',
                                            },
                                            data: {
                                                type: 'string',
                                            },
                                            proof: {
                                                required: ['total', 'index', 'leaf_hash', 'aunts'],
                                                properties: {
                                                    total: {
                                                        type: 'string',
                                                    },
                                                    index: {
                                                        type: 'string',
                                                    },
                                                    leaf_hash: {
                                                        type: 'string',
                                                    },
                                                    aunts: {
                                                        type: 'array',
                                                        items: {
                                                            type: 'string',
                                                        },
                                                    },
                                                },
                                                type: 'object',
                                            },
                                        },
                                        type: 'object',
                                    },
                                },
                            },
                        },
                        total_count: {
                            type: 'string',
                        },
                    },
                    type: 'object',
                },
            },
        };

        const query = {
            query: '"tx.height=' + this.blockHeight + '"',
            prove: true,
            page: 1,
            per_page: 3,
            order_by: '"asc"',
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/tx_search',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: tx_search test passed');
        return this;
    }

    /**
     * Test tx - Get a transaction (skipped for development)
     *
     * NOTE: This test is skipped for the following reasons:
     * 1. Development: tx functionality is still under development
     * 2. HTTPS restriction: Only runs on non-HTTPS endpoints (like local development)
     * 3. Manual enablement: Can be enabled by changing it.skip to it for testing
     *
     * Execution conditions:
     * - Endpoint must NOT be HTTPS (local development only)
     * - Test must be manually enabled (it.skip -> it)
     * - Should only be run when tx is fully implemented
     */
    async testTx(): Promise<CometBFTTestBuilder> {
        if (this.httpEndpoint.startsWith('https')) {
            console.log('⚠️ Skipping tx test for HTTPS endpoint');
            return this;
        }

        const querySchema = {
            type: 'object',
            required: ['hash'],
            properties: {
                hash: {
                    type: 'string',
                },
                prove: {
                    type: 'boolean',
                    default: false,
                },
            },
        };

        const responseSchema = {
            type: 'object',
            required: ['jsonrpc', 'id', 'result'],
            properties: {
                jsonrpc: {
                    type: 'string',
                },
                id: {
                    type: 'integer',
                },
                result: {
                    required: ['hash', 'height', 'index', 'tx_result', 'tx'],
                    properties: {
                        hash: {
                            type: 'string',
                        },
                        height: {
                            type: 'string',
                        },
                        index: {
                            type: 'integer',
                        },
                        tx_result: {
                            required: ['log', 'gas_wanted', 'gas_used'],
                            properties: {
                                log: {
                                    type: 'string',
                                },
                                gas_wanted: {
                                    type: 'string',
                                },
                                gas_used: {
                                    type: 'string',
                                },
                            },
                            type: 'object',
                        },
                        tx: {
                            type: 'string',
                        },
                    },
                    type: 'object',
                },
            },
        };

        const txHash = '0x8FCF360CD38C951A875E9D811FC262B64D454AEE087F8EB02431F735A75C3BBD';
        const query = {
            hash: txHash,
            prove: true,
        };

        const response = await this.blockchain.makeConsensusRpcCall(
            '/tx',
            query,
            querySchema,
            responseSchema,
            '',
            this.nodeIndex
        );
        expect(response).to.not.be.empty;
        console.log('✓ method: tx test passed');
        return this;
    }
}
