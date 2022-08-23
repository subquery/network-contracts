export default {
    network: {
        name: 'moonbase',
        platform: 'moonbeam',
        endpoint: 'https://moonbeam-alpha.api.onfinality.io/public',
        providerConfig: {
            chainId: 1287,
            name: 'moonbase',
        },
    },
    contracts: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        Staking: [1000], // LockPeriod
        EraManager: [60 * 60 * 24], // 1 day
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
    },
};
