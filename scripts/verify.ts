import {BigNumber} from 'ethers';
import {expect} from 'chai';
import Pino from 'pino';

import setup from './setup';
import {ContractSDK, SubqueryNetwork, } from '../build';
import startupKeplerConfig from './config/startup.kepler.json';
import startupMainnetConfig from './config/startup.mainnet.json';
import startupTestnetConfig from './config/startup.testnet.json';
import { getLogger } from './logger';
import { cidToBytes32 } from '../test/helper';

let logger: Pino.Logger;

const BN = (value: string | number): BigNumber => BigNumber.from(value);

async function checkInitialisation(sdk: ContractSDK, config, startupConfig, caller: string) {
    try {
        const multiSig = startupConfig.multiSign;
        //InflationController
        logger = getLogger('InflationController');
        logger.info(`🧮 Verifying inflationController Contract: ${sdk.inflationController.address}`);
        const [rate, destination] = config.contracts['InflationController'];
        logger.info(`InflationRate to be equal ${rate}`);
        expect(await sdk.inflationController.inflationRate()).to.eql(BN(rate));

        logger.info(`InflationDestination to be equal ${destination}`);
        expect((await sdk.inflationController.inflationDestination()).toUpperCase()).to.equal(destination.toUpperCase());
        logger.info('🎉 InflationController Contract verified\n');

        // SQToken
        logger = getLogger('SQToken');
        logger.info(`🧮 Verifying SQToken Contract: ${sdk.sqToken.address}`);
        const [totalSupply] = config.contracts['SQToken'];
        const amount = await sdk.sqToken.totalSupply();
        logger.info(`Initial supply to be equal ${amount.toString()}`);
        expect(totalSupply).to.eql(amount);
        logger.info(`Multi-sig wallet: ${multiSig} own the total assets`);
        expect(totalSupply).to.eql(await sdk.sqToken.balanceOf(multiSig));
        logger.info('🎉 SQToken Contract verified\n');

        //Staking
        logger = getLogger('Staking');
        logger.info(`🧮 Verifying Staking Contract: ${sdk.staking.address}`);
        const [lockPeriod, unbondFeeRate] = config.contracts['Staking'];
        logger.info(`lockPeriod to be equal ${lockPeriod}`);
        expect(await sdk.staking.lockPeriod()).to.eql(BN(lockPeriod));
        logger.info(`unbondFeeRate to be equal ${unbondFeeRate}`);
        expect(await sdk.staking.unbondFeeRate()).to.eql(BN(unbondFeeRate));
        logger.info('🎉 Staking Contract verified\n');

        // Airdrop
        logger = getLogger('Airdrop');
        logger.info(`🧮 Verifying Airdrop Contract: ${sdk.airdropper.address}`);
        const [settleDestination] = config.contracts['Airdropper'];
        logger.info(`settleDestination to be equal ${settleDestination}`);
        expect((await sdk.airdropper.settleDestination()).toUpperCase()).to.equal(settleDestination.toUpperCase());
        logger.info('🎉 Airdrop Contract verified\n');

        //EraManager
        logger = getLogger('EraManager');
        logger.info(`🧮 Verifying EraManager Contract: ${sdk.eraManager.address}`);
        const [eraPeriod] = config.contracts['EraManager'];
        logger.info(`eraPeriod to be equal ${eraPeriod}`);
        expect(await sdk.eraManager.eraPeriod()).to.eql(BN(eraPeriod));
        logger.info('🎉 EraManager Contract verified\n');

        //ServiceAgreementRegistry
        logger = getLogger('ServiceAgreementRegistry');
        logger.info(`🧮 Verifying ServiceAgreementRegistry Contract: ${sdk.serviceAgreementRegistry.address}`);
        const [threshold] = config.contracts['ServiceAgreementRegistry'];
        logger.info(`threshold to be equal ${threshold}`);
        expect(await sdk.serviceAgreementRegistry.threshold()).to.eql(BN(threshold));
        logger.info('PlanMananger and PurchaseOfferContract are in the whitelist');
        expect(await sdk.serviceAgreementRegistry.establisherWhitelist(sdk.planManager.address)).to.be.true;
        expect(await sdk.serviceAgreementRegistry.establisherWhitelist(sdk.purchaseOfferMarket.address)).to.be.true;
        logger.info('🎉 ServiceAgreementRegistry Contract verified\n');

        //PurchaseOfferMarket
        logger = getLogger('PurchaseOfferMarket');
        logger.info(`🧮 Verifying PurchaseOfferMarket Contract: ${sdk.purchaseOfferMarket.address}`);
        const [penaltyRate, pDestination] = config.contracts['PurchaseOfferMarket'];
        logger.info(`penaltyRate to be equal ${penaltyRate}`);
        expect(await sdk.purchaseOfferMarket.penaltyRate()).to.eql(BN(penaltyRate));
        logger.info(`penaltyDestination to be equal ${pDestination}`);
        expect((await sdk.purchaseOfferMarket.penaltyDestination()).toUpperCase()).to.equal(pDestination.toUpperCase());
        logger.info('🎉 PurchaseOfferMarket Contract verified\n');

        //IndexerRegistry
        logger = getLogger('IndexerRegistry');
        logger.info(`🧮 Verifying IndexerRegistry Contract: ${sdk.indexerRegistry.address}`);
        const [minimumStakingAmount] = config.contracts['IndexerRegistry'];
        logger.info(`minimumStakingAmount to be equal ${minimumStakingAmount}`);
        expect(await sdk.indexerRegistry.minimumStakingAmount()).to.eql(BN(minimumStakingAmount));
        logger.info('🎉 IndexerRegistry Contract verified\n');

        //QueryRegistry
        logger = getLogger('QueryRegistry');
        logger.info(`🧮 Verifying QueryRegistry Contract: ${sdk.queryRegistry.address}`);
        logger.info(`${caller} is not project creator`)
        expect(await sdk.queryRegistry.creatorWhitelist(caller)).to.be.false;
        logger.info(`${multiSig} is project creator`)
        expect(await sdk.queryRegistry.creatorWhitelist(multiSig)).to.be.true;
        logger.info('🎉 QueryRegistry Contract verified\n');

        //PermissionExchange
        logger = getLogger('P');
        logger.info(`🧮 Verifying PermissionExchange Contract: ${sdk.permissionedExchange.address}`);
        logger.info(`RewardDistribute is the controller: ${sdk.rewardsDistributor.address}`);
        expect(await sdk.permissionedExchange.exchangeController(sdk.rewardsDistributor.address)).to.be.true;
        logger.info('🎉 PermissionExchange Contract verified\n');

        //ConsumerHost
        logger = getLogger('ConsumerHost');
        logger.info(`🧮 Verifying ConsumerHost Contract: ${sdk.consumerHost.address}`);
        const [feePercentage] = config.contracts['ConsumerHost'];
        logger.info(`feePercentage to be equal ${feePercentage}`);
        expect(await sdk.consumerHost.feePercentage()).to.eql(BN(feePercentage));
        logger.info('🎉 ConsumerHost Contract verified\n');

        //DisputeManager
        logger = getLogger('DisputeManager');
        logger.info(`🧮 Verifying DisputeManager Contract: ${sdk.disputeManager.address}`);
        const [minDeposit] = config.contracts['DisputeManager'];
        logger.info(`DisputeManager minimumDeposit to be equal ${minDeposit}`);
        expect(await sdk.disputeManager.minimumDeposit()).to.eql(BN(minDeposit));
        logger.info('🎉 DisputeManager Contract verified\n');
    } catch(err){
        logger.info(`Failed to verify contract: ${err}`);
    }
}

async function checkConfiguration(sdk: ContractSDK, config) {
    try {
        // planTemplates
        let logger = getLogger('planTemplates');
        logger.info(`🧮 Verifying planTemplates`);
        let planTemplates = config.planTemplates;
        for(let i = 0; i < planTemplates.length; i++) {
            let planTemplate = planTemplates[i];
            let pm = await sdk.planManager.getPlanTemplate(i);
            expect(BN(planTemplate.period)).to.eql(pm.period);
            expect(BN(planTemplate.dailyReqCap)).to.eql(pm.dailyReqCap);
            expect(BN(planTemplate.rateLimit)).to.eql(pm.rateLimit);
            logger.info(`🎉 planTemplate ${i} verified`);
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
            expect(isCreator).to.be.false;
            logger.info(`🎉 QRCreator: ${creator} verified`);
        }
        //AirdropControllers
        logger = getLogger('AirdropControllers');
        logger.info(`🧮 Verifying AirdropControllers`);
        let controllers = config.AirdropController; 
        for(let i = 0; i < controllers.length; i++) {
            let controller = controllers[i];
            let isController = await sdk.airdropper.controllers(controller);
            expect(isController).to.eql(false);
            logger.info(`🎉 AirdropController: ${controller} verified`);
        }
        console.log('\n');
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
            expect(o.toLowerCase()).to.eql(owner.toLocaleLowerCase());
            logger.info(`🎉 Ownership of contract: ${contract.address} verified`);
        }
    } catch (error) {
        console.log(error);
    }
}

const main = async () => {
    let sdk: ContractSDK;
    let startupConfig: any = startupTestnetConfig;
    const {wallet, config} = await setup(process.argv);
    const caller = wallet.address;

    const networkType = process.argv[2];
    let network: SubqueryNetwork;
    switch (networkType) {
        case '--mainnet':
            network = 'mainnet';
            startupConfig = startupMainnetConfig;
            break;
        case '--kepler':
            network = 'kepler';
            startupConfig = startupKeplerConfig;
            break;
        case '--testnet':
            network = 'testnet';
            startupConfig = startupTestnetConfig;
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`)
    }

    sdk = ContractSDK.create(wallet, { network });

    const verifyType = process.argv[3]; 
    switch (verifyType) {
        case '--initialisation':
            await checkInitialisation(sdk, config, startupConfig, caller);
            break;
        case '--configuration':
            await checkConfiguration(sdk, startupConfig);
            break;
        case '--ownership':
            await checkOwnership(sdk, startupConfig.multiSign);
            break;
        case '--all':
            await checkInitialisation(sdk, config, startupConfig, caller);
            await checkConfiguration(sdk, startupConfig);
            await checkOwnership(sdk, startupConfig.multiSign);
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`);
    }
}

main();
