import { utils } from 'ethers';

export default {
    mainnet: {
        InflationController: [10000, '0x9E3a8e4d0115e5b157B61b6a5372ecc41446D472'], // inflationRate, inflationDestination
        InflationDestination: ['0x9E3a8e4d0115e5b157B61b6a5372ecc41446D472'], // XcRecipient
        SQToken: [utils.parseEther('10000000000')], // initial supply 10 billion
        VTSQToken: [],
        Staking: [1209600, 1e3], // lockPeriod: 14 days, unbondFeeRate: 10e3/10e6=0.001=0.1%
        Airdropper: ['0xC3b9127ceBfFe170616502FaEE3c0bC7822F15BD'], // settle destination
        EraManager: [604800], // 7 day
        PurchaseOfferMarket: [1e5, '0x31E99bdA5939bA2e7528707507b017f43b67F89B'], // _penaltyRate: 1e5/1e6=0.1=10%, _penaltyDestination: treasury
        IndexerRegistry: [utils.parseEther('200000')], // _minimumStakingAmount: 200,000 SQT
        ConsumerHost: [10000], // Fee Percentage, 1e4/1e6=0.01=1%
        DisputeManager: [utils.parseEther('10000')], // minimumDeposit: 10,000 SQT
        // base: 2s a block, 31536000/2 = 15768000 blocks a year, 1% rewards = 100000000 / 15768000 = about 6.3419584 SQT per block
        RewardsBooster: [utils.parseEther('6.3419584'), utils.parseEther('10000')], // _issuancePerBlock, _minimumDeploymentBooster
        L2SQToken: ['0x4200000000000000000000000000000000000010', '0x09395a2A58DB45db0da254c7EAa5AC469D8bDc85'], // l2bridge, l1token
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
