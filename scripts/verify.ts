import {BigNumber} from 'ethers';
import Pino from 'pino';

import setup from './setup';
import {ContractSDK} from '../src';
import testnetDeployment from '../publish/testnet.json';
import keplerDeployment from '../publish/kepler.json';
import mainnetDeployment from '../publish/mainnet.json';
import startupKeplerConfig from './config/startup.kepler.json';
import startupMainnetConfig from './config/startup.mainnet.json';
import startupTestnetConfig from './config/startup.testnet.json';
import {expect} from 'chai';
import { colorText, getLogger, TextColor } from './logger';

let logger: Pino.Logger;

async function checkInitialisation(sdk: ContractSDK, config) {
    try {
        //InflationController
        let logger = getLogger('InflationController');
        logger.info(colorText(`🧮 Verifying inflationController Contract: ${sdk.inflationController.address}`, TextColor.GREEN));
        const [rate, destination] = config.contracts['InflationController'];
        const inflationRate = await sdk.inflationController.inflationRate();
        logger.info(`InflationRate to be equal ${rate}`);
        expect(inflationRate).to.eql(BigNumber.from(rate));

        const inflationDestination = await sdk.inflationController.inflationDestination();
        logger.info(`InflationDestination to be equal ${destination}`);
        expect(inflationDestination.toUpperCase()).to.equal(destination.toUpperCase());
        logger.info(colorText('InflationController Contract verified\n', TextColor.GREEN));

        // SQToken
        logger = getLogger('SQToken');
        logger.info(colorText(`🧮 Verifying SQToken Contract: ${sdk.sqToken.address}`, TextColor.GREEN));
        const [totalSupply] = config.contracts['SQToken'];
        const amount = await sdk.sqToken.totalSupply();
        logger.info(`Initial supply to be equal ${amount.toString()}`);
        expect(totalSupply).to.eql(amount);
        logger.info(colorText('SQToken Contract verified\n', TextColor.GREEN));

        //Staking
        logger = getLogger('Staking');
        logger.info(colorText(`🧮 Verifying Staking Contract: ${sdk.staking.address}`, TextColor.GREEN));
        const [lPeriod] = config.contracts['Staking'];
        const lockPeriod = await sdk.staking.lockPeriod();
        logger.info(`lockPeriod to be equal ${lPeriod}`);
        expect(lockPeriod).to.eql(BigNumber.from(lPeriod));
        logger.info(colorText('Staking Contract verified\n', TextColor.GREEN));

        // Airdrop
        logger = getLogger('Airdrop');
        logger.info(colorText(`🧮 Verifying Airdrop Contract: ${sdk.airdropper.address}`, TextColor.GREEN));
        const [sDestination] = config.contracts['Airdropper'];
        const settleDestination = await sdk.airdropper.settleDestination();
        logger.info(`settleDestination to be equal ${sDestination}`);
        expect(settleDestination.toUpperCase()).to.equal(sDestination.toUpperCase());
        logger.info(colorText('Airdrop Contract verified\n', TextColor.GREEN));

        //EraManager
        logger = getLogger('EraManager');
        logger.info(colorText(`🧮 Verifying EraManager Contract: ${sdk.eraManager.address}`, TextColor.GREEN));
        const [ePeriod] = config.contracts['EraManager'];
        const eraPeriod = await sdk.eraManager.eraPeriod();
        logger.info(`eraPeriod to be equal ${ePeriod}`);
        expect(eraPeriod).to.eql(BigNumber.from(ePeriod));
        logger.info(colorText('EraManager Contract verified\n', TextColor.GREEN));

        //ServiceAgreementRegistry
        logger = getLogger('ServiceAgreementRegistry');
        logger.info(colorText(`🧮 Verifying ServiceAgreementRegistry Contract: ${sdk.serviceAgreementRegistry.address}`, TextColor.GREEN));
        const [Threshold] = config.contracts['ServiceAgreementRegistry'];
        const threshold = await sdk.serviceAgreementRegistry.threshold();
        logger.info(`threshold to be equal ${Threshold}`);
        expect(threshold).to.eql(BigNumber.from(Threshold));
        logger.info(colorText('ServiceAgreementRegistry Contract verified\n', TextColor.GREEN));

        //PurchaseOfferMarket
        logger = getLogger('PurchaseOfferMarket');
        logger.info(colorText(`🧮 Verifying PurchaseOfferMarket Contract: ${sdk.purchaseOfferMarket.address}`, TextColor.GREEN));
        const [pRate, pDestination] = config.contracts['PurchaseOfferMarket'];
        const penaltyRate = await sdk.purchaseOfferMarket.penaltyRate();
        logger.info(`penaltyRate to be equal ${pRate}`);
        expect(penaltyRate).to.equal(BigNumber.from(pRate));
        const penaltyDestination = await sdk.purchaseOfferMarket.penaltyDestination();
        logger.log(`penaltyDestination to be equal ${pDestination}`);
        expect(penaltyDestination.toUpperCase()).to.equal(pDestination.toUpperCase());
        logger.info(colorText('PurchaseOfferMarket Contract verified\n', TextColor.GREEN));

        //IndexerRegistry
        logger = getLogger('IndexerRegistry');
        logger.info(colorText(`🧮 Verifying IndexerRegistry Contract: ${sdk.indexerRegistry.address}`, TextColor.GREEN));
        const [msa] = config.contracts['IndexerRegistry'];
        const minimumStakingAmount = await sdk.indexerRegistry.minimumStakingAmount();
        logger.info(`minimumStakingAmount to be equal ${msa}`);
        expect(minimumStakingAmount).to.eql(BigNumber.from(msa));
        logger.info(colorText('IndexerRegistry Contract verified\n', TextColor.GREEN));

        //ConsumerHost
        logger = getLogger('ConsumerHost');
        logger.info(colorText(`🧮 Verifying ConsumerHost Contract: ${sdk.consumerHost.address}`, TextColor.GREEN));
        const [fee] = config.contracts['ConsumerHost'];
        const feePercentage = await sdk.consumerHost.feePercentage();
        logger.info(`feePercentage to be equal ${fee}`);
        expect(feePercentage).to.eql(BigNumber.from(fee));
        logger.info(colorText('ConsumerHost Contract verified\n', TextColor.GREEN));

        //DisputeManager
        logger = getLogger('DisputeManager');
        logger.info(colorText(`🧮 Verifying DisputeManager Contract: ${sdk.disputeManager.address}`, TextColor.GREEN));
        const [minDeposit] = config.contracts['DisputeManager'];
        const minimumDeposit = await sdk.disputeManager.minimumDeposit();
        logger.log(`DisputeManager minimumDeposit to be equal ${minDeposit}`);
        expect(minimumDeposit).to.eql(BigNumber.from(minDeposit));
        logger.info(colorText('DisputeManager Contract verified\n', TextColor.GREEN));
    } catch(err){
        logger.error(`Failed to verify contract: ${err}`);
    }
}

async function checkConfiguration(sdk: ContractSDK, config) {
    try {
        //planTemplates
        // let logger = getLogger('planTemplates');
        // logger.info(colorText(`🧮 Verifying planTemplates`, TextColor.GREEN));
        // let planTemplates = config.planTemplates;
        // for(let i = 0; i < planTemplates.length; i++) {
        //     let planTemplate = planTemplates[i];
        //     let pm = await sdk.planManager.getPlanTemplate(i);
        //     expect(BigNumber.from(planTemplate.period)).to.eql(pm.period);
        //     expect(BigNumber.from(planTemplate.dailyReqCap)).to.eql(pm.dailyReqCap);
        //     expect(BigNumber.from(planTemplate.rateLimit)).to.eql(pm.rateLimit);
        //     logger.info(colorText(`planTemplate ${i} verified\n`, TextColor.GREEN));
        // }
        //projects
        logger = getLogger('projects');
        logger.info(colorText(`🧮 Verifying projects`, TextColor.GREEN));
        let projects = config.projects; 
        for(let i = 0; i < projects.length; i++) {
            let project = projects[i];
            let p = await sdk.queryRegistry.queryInfos(i);
            expect(project.deploymentId).to.eql(p.latestDeploymentId);
            expect(project.versionCid).to.eql(p.latestVersion);
            expect(project.metadataCid).to.eql(p.metadata);
            logger.info(colorText(`project ${project.name} verified`, TextColor.GREEN));
        }
        //QRCreators
        logger = getLogger('QRCreators');
        logger.info(colorText(`🧮 Verifying QRCreators`, TextColor.GREEN));
        let creators = config.QRCreator; 
        for(let i = 0; i < creators.length; i++) {
            let creator = creators[i];
            let isCreator = await sdk.queryRegistry.creatorWhitelist(creator);
            expect(isCreator).to.eql(true);
            logger.info(colorText(`QRCreator: ${creator} verified`, TextColor.GREEN));
        }
        //AirdropControllers
        logger = getLogger('AirdropControllers');
        logger.info(colorText(`🧮 Verifying AirdropControllers`, TextColor.GREEN));
        let controllers = config.AirdropController; 
        for(let i = 0; i < controllers.length; i++) {
            let controller = controllers[i];
            let isController = await sdk.airdropper.controllers(controller);
            expect(isController).to.eql(true);
            logger.info(colorText(`AirdropController: ${controller} verified`, TextColor.GREEN));
        }
    } catch (error) {
        console.log(error);
    }
}

async function checkOwnership(sdk: ContractSDK, owner: string) {
    let logger = getLogger('ownership');
    logger.info(colorText(`🧮 Verifying ownership`, TextColor.GREEN));
    const contracts = [
        sdk.airdropper,
        sdk.consumerHost, 
        sdk.disputeManager,
        sdk.eraManager,
        sdk.indexerRegistry, 
        sdk.inflationController,
        sdk.permissionedExchange,
        sdk.planManager,
        sdk.proxyAdmin, 
        sdk.purchaseOfferMarket,
        sdk.queryRegistry,
        sdk.rewardsDistributor,
        sdk.rewardsHelper,
        sdk.rewardsPool,
        sdk.rewardsStaking,
        sdk.serviceAgreementRegistry,
        sdk.settings,
        sdk.sqToken,
        sdk.staking,
        sdk.stakingManager,
        sdk.stateChannel,
        sdk.vesting,
    ];
    try {
        for (const contract of contracts) {
            const o = await contract.owner();
            expect(o).to.eql(owner);
            logger.info(colorText(`Ownership of contract: ${contract.address} verified`, TextColor.GREEN));
        }
    } catch (error) {
        console.log(error);
    }
}

const main = async () => {
    let sdk: ContractSDK;
    let startupConfig: any = startupTestnetConfig;
    const {wallet, config} = await setup(process.argv[2]);

    const networkType = process.argv[2];
    switch (networkType) {
        case '--mainnet':
            sdk = await ContractSDK.create(wallet, {deploymentDetails: mainnetDeployment});
            startupConfig = startupMainnetConfig;
            break;
        case '--kepler':
            sdk = await ContractSDK.create(wallet, {deploymentDetails: keplerDeployment});
            startupConfig = startupKeplerConfig;
            break;
        case '--testnet':
            sdk = await ContractSDK.create(wallet, {deploymentDetails: testnetDeployment});
            startupConfig = startupTestnetConfig;
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`)
    }

    const verifyType = process.argv[3]; 
    switch (verifyType) {
        case '--initialisation':
            await checkInitialisation(sdk, config);
            break;
        case '--configuration':
            await checkConfiguration(sdk, startupConfig);
            break;
        case '--ownership':
            await checkOwnership(sdk, startupConfig.multiSign);
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`);
    }
}

main();
