export default {
    network: {
        name: 'local',
        platform: 'hardhat',
        endpoint: 'http://127.0.0.1:8545',
        providerConfig: {
            chainId: 31337,
            name: 'Hardhat',
        },
    },
    contracts: {
        InflationController: [100, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRateBP, inflationDestination
        Staking: [1000], // LockPeriodl
        EraManager: [60 * 60 * 24],
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: ['1000000000000000000000'],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: ['1000000000000000000000'], // minimumDeposit
    },
};
