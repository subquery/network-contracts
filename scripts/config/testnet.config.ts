export default {
    network: {
        name: 'testnet',
        platform: 'mumbai',
        endpoint: 'https://polygon-mumbai.infura.io/v3/4458cf4d1689497b9a38b1d6bbf05e78',
        providerConfig: {
            chainId: 80001,
            name: 'Mumbai',
        },
    },
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
