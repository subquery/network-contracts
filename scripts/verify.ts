import {BigNumber} from 'ethers';
import {expect} from 'chai';
import Pino from 'pino';

import setup from './setup';
import {ContractSDK} from '../src';
import testnetDeployment from '../publish/testnet.json';
import keplerDeployment from '../publish/kepler.json';
import mainnetDeployment from '../publish/mainnet.json';
import startupKeplerConfig from './config/startup.kepler.json';
import startupMainnetConfig from './config/startup.mainnet.json';
import startupTestnetConfig from './config/startup.testnet.json';
import { getLogger } from './logger';
import { cidToBytes32 } from '../test/helper';

let logger: Pino.Logger;

async function checkInitialisation(sdk: ContractSDK, config, caller: string) {
    try {
        //InflationController
        logger = getLogger('InflationController');
        logger.info(`🧮 Verifying inflationController Contract: ${sdk.inflationController.address}`);
        const [rate, destination] = config.contracts['InflationController'];
        const inflationRate = await sdk.inflationController.inflationRate();
        logger.info(`InflationRate to be equal ${rate}`);
        expect(inflationRate).to.eql(BigNumber.from(rate));

        const inflationDestination = await sdk.inflationController.inflationDestination();
        logger.info(`InflationDestination to be equal ${destination}`);
        expect(inflationDestination.toUpperCase()).to.equal(destination.toUpperCase());
        logger.info('🎉 InflationController Contract verified\n');

        // SQToken
        logger = getLogger('SQToken');
        logger.info(`🧮 Verifying SQToken Contract: ${sdk.sqToken.address}`);
        const [totalSupply] = config.contracts['SQToken'];
        const amount = await sdk.sqToken.totalSupply();
        logger.info(`Initial supply to be equal ${amount.toString()}`);
        expect(totalSupply).to.eql(amount);
        logger.info('🎉 SQToken Contract verified\n');

        // SQToken
        logger = getLogger('SQToken');
        logger.info(colorText(`Verifying SQToken Contract: ${sdk.sqToken.address}`, TextColor.YELLOW));
        const [totalSupply] = config.contracts['SQToken'];
        const amount = await sdk.sqToken.totalSupply();
        logger.info(`Initial supply to be equal ${amount.toString()}`);
        expect(totalSupply).to.eql(amount.toString());
        logger.info(colorText('SQToken Contract verified', TextColor.YELLOW));

        //Staking
        logger = getLogger('Staking');
        logger.info(`🧮 Verifying Staking Contract: ${sdk.staking.address}`);
        const [lPeriod] = config.contracts['Staking'];
        const lockPeriod = await sdk.staking.lockPeriod();
        logger.info(`lockPeriod to be equal ${lPeriod}`);
        expect(lockPeriod).to.eql(BigNumber.from(lPeriod));
        logger.info('🎉 Staking Contract verified\n');

        // Airdrop
        logger = getLogger('Airdrop');
        logger.info(`🧮 Verifying Airdrop Contract: ${sdk.airdropper.address}`);
        const [sDestination] = config.contracts['Airdropper'];
        const settleDestination = await sdk.airdropper.settleDestination();
        logger.info(`settleDestination to be equal ${sDestination}`);
        expect(settleDestination.toUpperCase()).to.equal(sDestination.toUpperCase());
        logger.info(`${caller} is not controller`)
        expect(await sdk.airdropper.controllers(caller)).to.be.false;
        const multiSig = destination;
        logger.info(`${multiSig} is controller`)
        expect(await sdk.airdropper.controllers(multiSig)).to.be.true;
        logger.info('🎉 Airdrop Contract verified\n');

        //EraManager
        logger = getLogger('EraManager');
        logger.info(`🧮 Verifying EraManager Contract: ${sdk.eraManager.address}`);
        const [ePeriod] = config.contracts['EraManager'];
        const eraPeriod = await sdk.eraManager.eraPeriod();
        logger.info(`eraPeriod to be equal ${ePeriod}`);
        expect(eraPeriod).to.eql(BigNumber.from(ePeriod));
        logger.info('🎉 EraManager Contract verified\n');

        //ServiceAgreementRegistry
        logger = getLogger('ServiceAgreementRegistry');
        logger.info(`🧮 Verifying ServiceAgreementRegistry Contract: ${sdk.serviceAgreementRegistry.address}`);
        const [Threshold] = config.contracts['ServiceAgreementRegistry'];
        const threshold = await sdk.serviceAgreementRegistry.threshold();
        logger.info(`threshold to be equal ${Threshold}`);
        expect(threshold).to.eql(BigNumber.from(Threshold));
        logger.info('🎉 ServiceAgreementRegistry Contract verified\n');

        //PurchaseOfferMarket
        logger = getLogger('PurchaseOfferMarket');
        logger.info(`🧮 Verifying PurchaseOfferMarket Contract: ${sdk.purchaseOfferMarket.address}`);
        const [pRate, pDestination] = config.contracts['PurchaseOfferMarket'];
        const penaltyRate = await sdk.purchaseOfferMarket.penaltyRate();
        logger.info(`penaltyRate to be equal ${pRate}`);
        expect(penaltyRate).to.eql(BigNumber.from(pRate));
        const penaltyDestination = await sdk.purchaseOfferMarket.penaltyDestination();
        logger.info(`penaltyDestination to be equal ${pDestination}`);
        expect(penaltyDestination.toUpperCase()).to.equal(pDestination.toUpperCase());
        logger.info('🎉 PurchaseOfferMarket Contract verified\n');

        //IndexerRegistry
        logger = getLogger('IndexerRegistry');
        logger.info(`🧮 Verifying IndexerRegistry Contract: ${sdk.indexerRegistry.address}`);
        const [msa] = config.contracts['IndexerRegistry'];
        const minimumStakingAmount = await sdk.indexerRegistry.minimumStakingAmount();
        logger.info(`minimumStakingAmount to be equal ${msa}`);
        expect(minimumStakingAmount).to.eql(BigNumber.from(msa));
        logger.info('🎉 IndexerRegistry Contract verified\n');

        //QueryRegistry
        logger = getLogger('QueryRegistry');
        logger.info(`🧮 Verifying QueryRegistry Contract: ${sdk.queryRegistry.address}`);
        logger.info(`${caller} is not project creator`)
        expect(await sdk.queryRegistry.creatorWhitelist(caller)).to.be.false;
        logger.info(`${multiSig} is project creator`)
        expect(await sdk.queryRegistry.creatorWhitelist(multiSig)).to.be.true;

        //ConsumerHost
        logger = getLogger('ConsumerHost');
        logger.info(`🧮 Verifying ConsumerHost Contract: ${sdk.consumerHost.address}`);
        const [fee] = config.contracts['ConsumerHost'];
        const feePercentage = await sdk.consumerHost.feePercentage();
        logger.info(`feePercentage to be equal ${fee}`);
        expect(feePercentage).to.eql(BigNumber.from(fee));
        logger.info('🎉 ConsumerHost Contract verified\n');

        //DisputeManager
        logger = getLogger('DisputeManager');
        logger.info(`🧮 Verifying DisputeManager Contract: ${sdk.disputeManager.address}`);
        const [minDeposit] = config.contracts['DisputeManager'];
        const minimumDeposit = await sdk.disputeManager.minimumDeposit();
        logger.info(`DisputeManager minimumDeposit to be equal ${minDeposit}`);
        expect(minimumDeposit).to.eql(BigNumber.from(minDeposit));
        logger.info('🎉 DisputeManager Contract verified\n');
    } catch(err){
        logger.info(`Failed to verify contract: ${err}`);
    }
}

async function checkConfiguration(sdk: ContractSDK, config, caller: string) {
    try {
        // planTemplates
        let logger = getLogger('planTemplates');
        logger.info(`🧮 Verifying planTemplates`));
        let planTemplates = config.planTemplates;
        for(let i = 0; i < planTemplates.length; i++) {
            let planTemplate = planTemplates[i];
            let pm = await sdk.planManager.getPlanTemplate(i);
            expect(BigNumber.from(planTemplate.period)).to.eql(pm.period);
            expect(BigNumber.from(planTemplate.dailyReqCap)).to.eql(pm.dailyReqCap);
            expect(BigNumber.from(planTemplate.rateLimit)).to.eql(pm.rateLimit);
            logger.info(`🎉 planTemplate ${i} verified\n`);
        }

        //projects
        logger = getLogger('projects');
        logger.info(`🧮 Verifying projects`);
        let projects = config.projects; 
        for(let i = 0; i < projects.length; i++) {
            let project = projects[i];
            let p = await sdk.queryRegistry.queryInfos(i);
            expect(cidToBytes32(project.deploymentId)).to.eql(p.latestDeploymentId);
            expect(cidToBytes32(project.versionCid)).to.eql(p.latestVersion);
            expect(cidToBytes32(project.metadataCid)).to.eql(p.metadata);
            logger.info(`🎉 project ${project.name} verified`);
        }
        //QRCreators
        logger = getLogger('QRCreators');
        logger.info(`🧮 Verifying QRCreators`);
        let creators = config.QRCreator; 
        for(let i = 0; i < creators.length; i++) {
            let creator = creators[i];
            let isCreator = await sdk.queryRegistry.creatorWhitelist(creator);
            expect(isCreator).to.eql(true);
            logger.info(`🎉 QRCreator: ${creator} verified`);
        }
        //AirdropControllers
        logger = getLogger('AirdropControllers');
        logger.info(`🧮 Verifying AirdropControllers`);
        let controllers = config.AirdropController; 
        for(let i = 0; i < controllers.length; i++) {
            let controller = controllers[i];
            let isController = await sdk.airdropper.controllers(controller);
            expect(isController).to.eql(true);
            logger.info(`🎉 AirdropController: ${controller} verified`);
        }
    } catch (error) {
        console.log(error);
    }
}

async function checkOwnership(sdk: ContractSDK, owner: string) {
    let logger = getLogger('ownership');
    logger.info(`🧮 Verifying ownership`);
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
            logger.info(`🎉 Ownership of contract: ${contract.address} verified`);
        }
    } catch (error) {
        console.log(error);
    }
}

const main = async () => {
    let sdk: ContractSDK;
    let startupConfig: any = startupTestnetConfig;
    const {wallet, config} = await setup(process.argv[2]);
    const caller = wallet.address;

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
            await checkInitialisation(sdk, config, caller);
            break;
        case '--configuration':
            await checkConfiguration(sdk, startupConfig, caller);
            break;
        case '--ownership':
            await checkOwnership(sdk, startupConfig.multiSign);
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`);
    }
}

main();
