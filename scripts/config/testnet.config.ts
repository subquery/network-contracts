export default {
    contracts: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        Staking: [3600], // LockPeriod
        ServiceAgreementRegistry: [1e6], //threshold
        EraManager: [3600], // EraPeriod
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: ['1000000000000000000000'],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: ['1000000000000000000000'], // minimumDeposit
    },
};
