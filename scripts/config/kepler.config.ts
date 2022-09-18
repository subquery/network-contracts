export default {
    network: {
        name: 'kepler',
        endpoint: {
            eth: 'https://eth-rpc-karura.aca-api.network/',
            substrate: 'wss://eth-rpc-karura.aca-api.network/ws',
        },
        platform: 'acala',
    },
    contracts: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        Staking: [1000], // LockPeriod
        EraManager: [60 * 60 * 24], // 1 day
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: [1000e18],
    },
};
