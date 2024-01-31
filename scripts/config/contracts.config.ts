import { utils } from 'ethers';

export default {
    mainnet: {
        InflationController: [10000, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther('10000000000')], // initial supply 10 billion
        VTSQToken: [], // initial supply 0
        Staking: [1209600, 1e3], // lockPeriod, unbondFeeRate
        Airdropper: ['0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // settle destination
        EraManager: [604800], // 7 day
        ServiceAgreementExtra: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'],
        IndexerRegistry: [utils.parseEther('16000')],
        ConsumerHost: [10000], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther('10000')], // minimumDeposit
        RewardsBooster: [utils.parseEther('6.34'), utils.parseEther('10000')], // _issuancePerBlock, _minimumDeploymentBooster
        L2SQToken: ['', ''], // l2bridge, l1token
    },
    kepler: {
        InflationController: [0, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther('25000000')], // initial supply 25M
        Staking: [1209600, 0], // lockPeriod, unbondFeeRate
        Airdropper: ['0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // settle destination
        EraManager: [604800], // 7 day
        ServiceAgreementRegistry: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x34c35136ECe9CBD6DfDf2F896C6e29be01587c0C'], // penalty rate, penalty destination
        IndexerRegistry: [utils.parseEther('16000')], // minimum staking
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther('10000')], // minimumDeposit
    },
    'testnet-mumbai': {
        InflationController: [10000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther('10000000000')], // initial supply 10 billion
        VTSQToken: [], // initial supply 0
        Staking: [1000, 1e3], // lockPeriod, unbondFeeRate
        Airdropper: ['0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // settle destination
        EraManager: [3600], // 1 hour
        ServiceAgreementExtra: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: [utils.parseEther('1000')],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther('10000')], // minimumDeposit
        ChildERC20: ['SubQueryToken', 'SQT', 18, '0x2e5e27d50EFa501D90Ad3638ff8441a0C0C0d75e'],
    },
    testnet: {
        InflationController: [10000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther('10000000000')], // initial supply 10 billion
        VTSQToken: [], // initial supply 0
        Staking: [1000, 1e3], // lockPeriod, unbondFeeRate
        Airdropper: ['0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // settle destination
        EraManager: [3600], // 1 hour
        ServiceAgreementExtra: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: [utils.parseEther('1000')],
        ConsumerHost: [1], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther('10000')], // minimumDeposit
        // base: 2s a block, 31536000/2 = 15768000 blocks a year, 1% rewards = 100000000 / 15768000 = about 6.3419584 SQT per block
        RewardsBooster: [utils.parseEther('6.34'), utils.parseEther('10000')], // _issuancePerBlock, _minimumDeploymentBooster
        L2SQToken: ['0x4200000000000000000000000000000000000010', '0xE6E15Ffc71AbDAe8D34D65bB695959fbd6c15435'], // l2bridge, l1token
    },
    local: {
        InflationController: [1000, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRate, inflationDestination
        SQToken: [utils.parseEther('10000000000')], // initial supply 10 billion
        VTSQToken: [], // initial supply 0 billion
        Staking: [1000, 1e3], // lockPeriod, unbondFeeRate
        Airdropper: ['0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // settle destination
        EraManager: [60 * 60], // 1 hour
        ServiceAgreementExtra: [1e6], //threshold
        PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
        IndexerRegistry: [utils.parseEther('1000')],
        ConsumerHost: [10000], // Fee Percentage, default is 1%
        DisputeManager: [utils.parseEther('10000')], // minimumDeposit
        // polygon: 10240000 blocks a year, 1% rewards = about 9.5 SQT per block
        RewardsBooster: [utils.parseEther('9.5'), utils.parseEther('10000')], // _issuancePerBlock, _minimumDeploymentBooster
    },
};
