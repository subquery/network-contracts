import { SQToken } from './../../src/typechain/SQToken';
export default {
    mainnet: {
        InflationController: [1000, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // inflationRate, inflationDestination
        SQToken: [10e27], // initial supply 10 billion
        Staking: [1209600], // LockPeriod
        EraManager: [604800], // 7 day
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'],
        IndexerRegistry: [16e21],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [1e22], // minimumDeposit
    },
    kepler: {
        InflationController: [1000, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // inflationRate, inflationDestination
        SQToken: [25e24], // initial supply 25M
        Staking: [1209600], // LockPeriod
        EraManager: [604800], // 7 day
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // penalty rate, penalty destination
        IndexerRegistry: [16e21], // minimum staking
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [1e22], // minimumDeposit
    },
    testnet: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        SQToken: [10e27], // initial supply 10 billion
        Staking: [1000], // LockPeriod
        EraManager: [3600], // 1 hour
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: [1e21],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [1e22], // minimumDeposit
    },
    local: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        SQToken: [10e27], // initial supply 10 billion
        Staking: [1000], // LockPeriod
        EraManager: [60 * 60], // 1 hour
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: ['1000000000000000000000'],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: ['1000000000000000000000'], // minimumDeposit
    },
    moonbase: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        SQToken: [10e27], // initial supply 10 billion
        Staking: [1000], // LockPeriod
        EraManager: [60 * 60], // 1 hour
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: ['1000000000000000000000'],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: ['1000000000000000000000'], // minimumDeposit
    }
}