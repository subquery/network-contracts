export var networks = {
    mainnet: {
        name: 'mainnet',
        platform: 'polygon',
        endpoint: 'https://1rpc.io/matic',
        providerConfig: {
            chainId: 137,
            name: 'polygon',
        }
    },
    kepler: {
        name: 'kepler',
        platform: 'polygon',
        endpoint: 'https://1rpc.io/matic',
        providerConfig: {
            chainId: 137,
            name: 'polygon',
        }
    },
    testnet: {
        name: 'testnet',
        platform: 'polygon',
        endpoint: 'https://rpc.ankr.com/polygon_mumbai',
        providerConfig: {
            chainId: 80001,
            name: 'Mumbai',
        }
    },
    local: {
        name: 'local',
        platform: 'hardhat',
        endpoint: 'http://127.0.0.1:8545',
        providerConfig: {
            chainId: 31337,
            name: 'Hardhat',
        },
    },
    moonbase: {
        name: 'moonbase',
        platform: 'moonbeam',
        endpoint: 'https://moonbeam-alpha.api.onfinality.io/public',
        providerConfig: {
            chainId: 1287,
            name: 'Moonbase-alpha',
        }
    }
}