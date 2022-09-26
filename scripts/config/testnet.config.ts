export default {
    network: {
        name: 'testnet',
        platform: 'moonbeam',
        endpoint: 'https://moonbeam-alpha.api.onfinality.io/public',
        providerConfig: {
            chainId: 1287,
            name: 'moonbase',
        },
    },
    contracts: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        Staking: [3600], // LockPeriod
        EraManager: [60 * 60], // 1 day
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: ['1000000000000000000000'],
        ConsumerHost: [1], // Fee Percentage, default is 1%
    },
};
