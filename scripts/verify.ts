import {BigNumber} from 'ethers';
import setup from './setup';
import {ContractSDK} from '../src';
import testnetDeployment from '../publish/testnet.json';
import keplerDeployment from '../publish/kepler.json';
import mainnetDeployment from '../publish/mainnet.json';
import {expect} from 'chai';
import { colorText, getLogger, TextColor } from './logger';

const main = async () => {
    let sdk: ContractSDK;
    let configs;
    const {wallet, config} = await setup(process.argv[2]);

    const networkType = process.argv[2];
    switch (networkType) {
        case '--mainnet':
            sdk = await ContractSDK.create(wallet, {deploymentDetails: mainnetDeployment});
            break;
        case '--kepler':
            sdk = await ContractSDK.create(wallet, {deploymentDetails: keplerDeployment});
            break;
        case '--testnet':
            sdk = await ContractSDK.create(wallet, {deploymentDetails: testnetDeployment});
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`)
    }

    try {
        //InflationController
        // TODO: following this example to update all the logs,
        let logger = getLogger('InflationController');
        logger.info(colorText(`InflationController Contract: ${sdk.inflationController.address}`, TextColor.BLUE));
        // TODO: user explicity name for the params in config  
        const [rate, destination] = config.contracts['InflationController'];
        const inflationRate = await sdk.inflationController.inflationRate();
        logger.info(`InflationRate to be equal ${rate}`);
        expect(inflationRate).to.eql(BigNumber.from(rate));

        const inflationDestination = await sdk.inflationController.inflationDestination();
        logger.info(`InflationDestination to be equal ${destination}`);
        expect(inflationDestination.toUpperCase()).to.equal(configs[1].toUpperCase());

        //Staking
        logger = getLogger('Staking');
        logger.info(`Staking Contract: ${sdk.staking.address}`);
        configs = config.contracts['Staking'];
        const lockPeriod = await sdk.staking.lockPeriod();
        console.log(`Staking lockPeriod to be equal ${configs[0]}...`);
        expect(lockPeriod).to.eql(BigNumber.from(configs[0]));

        //EraManager
        console.log("EraManager Contract: ");
        configs = config.contracts['EraManager'];
        const eraPeriod = await sdk.eraManager.eraPeriod();
        console.log(`EraManager eraPeriod to be equal ${configs[0]}...`);
        expect(eraPeriod).to.eql(BigNumber.from(configs[0]));

        //ServiceAgreementRegistry
        console.log("ServiceAgreementRegistry Contract: ");
        configs = config.contracts['ServiceAgreementRegistry'];
        const threshold = await sdk.serviceAgreementRegistry.threshold();
        console.log(`ServiceAgreementRegistry threshold to be equal ${configs[0]}...`);
        expect(threshold).to.eql(BigNumber.from(configs[0]));

        //PurchaseOfferMarket
        console.log("PurchaseOfferMarket Contract: ");
        configs = config.contracts['PurchaseOfferMarket'];
        const penaltyRate = await sdk.purchaseOfferMarket.penaltyRate();
        console.log(`PurchaseOfferMarket penaltyRate to be equal ${configs[0]}...`);
        expect(penaltyRate).to.eql(BigNumber.from(configs[0]));
        const penaltyDestination = await sdk.purchaseOfferMarket.penaltyDestination();
        console.log(`PurchaseOfferMarket penaltyDestination to be equal ${configs[1]}...`);
        expect(penaltyDestination.toUpperCase()).to.equal(configs[1].toUpperCase());

        //IndexerRegistry
        console.log("IndexerRegistry Contract: ");
        configs = config.contracts['IndexerRegistry'];
        const minimumStakingAmount = await sdk.indexerRegistry.minimumStakingAmount();
        console.log(`IndexerRegistry minimumStakingAmount to be equal ${configs[0]}...`);
        expect(minimumStakingAmount).to.eql(BigNumber.from(configs[0]));

        //ConsumerHost
        console.log("ConsumerHost Contract: ");
        configs = config.contracts['ConsumerHost'];
        const feePercentage = await sdk.consumerHost.feePercentage();
        console.log(`ConsumerHost feePercentage to be equal ${configs[0]}...`);
        expect(feePercentage).to.eql(BigNumber.from(configs[0]));

        //DisputeManager
        console.log("DisputeManager Contract: ");
        configs = config.contracts['DisputeManager'];
        const minimumDeposit = await sdk.disputeManager.minimumDeposit();
        console.log(`DisputeManager minimumDeposit to be equal ${configs[0]}...`);
        expect(minimumDeposit).to.eql(BigNumber.from(configs[0]));

    } catch(err){
        console.log(err);
    }
    
};

main();
