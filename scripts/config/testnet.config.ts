export default {
    network: {
        name: 'testnet',
        endpoint: {
            eth: 'https://tc7-eth.aca-dev.network',
            substrate: 'wss://acala-mandala.api.onfinality.io/public-ws',
        },
        platform: 'acala',
    },
    contracts: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        Staking: [1000], // LockPeriod
        EraManager: [60 * 60 * 24], // 1 day
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
    },
};
