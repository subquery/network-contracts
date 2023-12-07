import { utils } from "ethers";

export default {
    mainnet: {
        InflationController: [1000, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther("10000000000")], // initial supply 10 billion
        Staking: [1209600, 1e3], // lockPeriod, unbondFeeRate
        Airdropper: ['0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // settle destination
        EraManager: [604800], // 7 day
        ServiceAgreementExtra: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'],
        IndexerRegistry: [utils.parseEther("16000")],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther("10000")], // minimumDeposit
    },
    kepler: {
        InflationController: [0, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther("25000000")], // initial supply 25M
        Staking: [1209600, 0], // lockPeriod, unbondFeeRate
        Airdropper: ['0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // settle destination
        EraManager: [604800], // 7 day
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // penalty rate, penalty destination
        IndexerRegistry: [utils.parseEther("16000")], // minimum staking
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther("10000")], // minimumDeposit
    },
    testnet: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther("10000000000")], // initial supply 10 billion
        Staking: [1000, 1e3], // lockPeriod, unbondFeeRate
        Airdropper: ['0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // settle destination
        EraManager: [3600], // 1 hour
        ServiceAgreementExtra: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: [utils.parseEther("1000")],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther("10000")], // minimumDeposit
        EventSyncRootTunnel: ['0x2890bA17EfE978480615e330ecB65333b880928e','0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA'],
        ChildERC20: ['SubQueryToken', 'SQT', 18, '0x2e5e27d50EFa501D90Ad3638ff8441a0C0C0d75e'],
    },
    local: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther("10000000000")], // initial supply 10 billion
        Staking: [1000, 1e3], // lockPeriod, unbondFeeRate
        Airdropper: ['0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // settle destination
        EraManager: [60 * 60], // 1 hour
        ServiceAgreementExtra: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: [utils.parseEther("1000")],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther("10000")], // minimumDeposit
    },
    'base-goerli': {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther("10000000000")], // initial supply 10 billion
        Staking: [1000, 1e3], // lockPeriod, unbondFeeRate
        Airdropper: ['0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // settle destination
        EraManager: [3600], // 1 hour
        ServiceAgreementExtra: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: [utils.parseEther("1000")],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther("10000")], // minimumDeposit
    },
}