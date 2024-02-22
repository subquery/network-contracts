import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import Pino from 'pino';

import { ContractSDK, SubqueryNetwork, RootContractSDK } from '../build';
import startupMainnetConfig from './config/startup.mainnet.json';
import startupTestnetConfig from './config/startup.testnet.json';
import { getLogger } from './logger';
import { argv, setupCommon } from './setup';
import mainnetConfig from './config/mainnet.config';
import contractsConfig from './config/contracts.config';
import { networks } from '../src/networks';

let logger: Pino.Logger;

const BN = (value: string | number): BigNumber => BigNumber.from(value);

function cidToBytes32(cid: string): string {
    return '0x' + Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex');
}

async function checkRootInitialisation(sdk: RootContractSDK, config) {
    //InflationController
    logger = getLogger('InflationController');
    logger.info(`🧮 Verifying inflationController Contract: ${sdk.inflationController.address}`);
    const [rate] = config['InflationController'];
    const destination = sdk.inflationDestination.address;
    logger.info(`InflationRate to be equal ${rate}`);
    expect((await sdk.inflationController.inflationRate()).toNumber()).to.eq(rate);
    logger.info(`InflationDestination to be equal ${destination}`);
    expect((await sdk.inflationController.inflationDestination()).toUpperCase()).to.equal(
        destination.toUpperCase()
    );
    logger.info('🎉 InflationController Contract verified\n');

    // inflation destination
    logger = getLogger('InflationDestination');
    logger.info(`🧮 Verifying inflationDestination: ${sdk.inflationDestination.address}`);
    const [l1Token, l2Token, l1StandardBridge] = config['OpDestination'];
    logger.info(`l1Token to be equal ${l1Token}`);
    expect((await sdk.inflationDestination.l1Token()).toUpperCase()).to.equal(l1Token.toUpperCase());
    logger.info(`l2Token to be equal ${l2Token}`);
    expect((await sdk.inflationDestination.l2Token()).toUpperCase()).to.equal(l2Token.toUpperCase());
    logger.info(`l1StandardBridge to be equal ${l1StandardBridge}`);
    expect((await sdk.inflationDestination.l1StandardBridge()).toUpperCase()).to.equal(l1StandardBridge.toUpperCase());
    const XcRecipient = mainnetConfig.multiSig.child.treasury;
    logger.info(`XcRecipient to be equal ${XcRecipient}`);
    expect(await sdk.inflationDestination.xcRecipient()).eq(XcRecipient);
    logger.info('🎉 InflationDestination Contract verified\n');

    // SQToken
    logger = getLogger('SQToken');
    logger.info(`🧮 Verifying SQToken Contract: ${sdk.sqToken.address}`);
    const [totalSupply] = config['SQToken'];
    const amount = await sdk.sqToken.totalSupply();
    logger.info(`Initial supply to be equal ${amount.toString()}`);
    expect(totalSupply).to.eql(amount);
    logger.info(`SQToken minter is ${sdk.inflationController.address}`);
    expect((await sdk.sqToken.getMinter())).to.equal('0x0000000000000000000000000000000000000000');
    const wallet = mainnetConfig.multiSig.root.foundation;
    logger.info(`Foundation wallet: ${wallet} own the total assets`);
    const foundationSQTBalance = await sdk.sqToken.balanceOf(wallet);
    expect(totalSupply.gt(foundationSQTBalance)).to.be.true;
    logger.info('🎉 SQToken Contract verified\n');

    // Vesting
    logger = getLogger('Vesting');
    logger.info(`🧮 Verifying Vesting Contract: ${sdk.vesting.address}`);
    logger.info(`Vesting SQToken is ${sdk.sqToken.address}`);
    expect((await sdk.vesting.token()).toUpperCase()).to.equal(sdk.sqToken.address.toUpperCase());
    logger.info(`Vesting vtSQToken is ${sdk.vtSQToken.address}`);
    expect((await sdk.vesting.vtToken()).toUpperCase()).to.equal(sdk.vtSQToken.address.toUpperCase());
    logger.info('🎉 Vesting Contract verified\n');

    // VTSQToken
    logger = getLogger('VTSQToken');
    logger.info(`🧮 Verifying VTSQToken Contract: ${sdk.vtSQToken.address}`);
    const minter = sdk.vesting.address;
    logger.info(`Minter to be equal ${minter}`);
    // @ts-expect-error no minter interface
    expect((await sdk.vtSQToken.getMinter()).toUpperCase()).to.equal(minter.toUpperCase());
    logger.info('🎉 VTSQToken Contract verified\n');
}

async function checkChildInitialisation(sdk: ContractSDK, config, caller: string) {
    try {
        //Staking
        logger = getLogger('Staking');
        logger.info(`🧮 Verifying Staking Contract: ${sdk.staking.address}`);
        const [lockPeriod, unbondFeeRate] = config['Staking'];
        logger.info(`lockPeriod to be equal ${lockPeriod}`);
        expect(await sdk.staking.lockPeriod()).to.eql(BN(lockPeriod));
        logger.info(`unbondFeeRate to be equal ${unbondFeeRate}`);
        expect(await sdk.staking.unbondFeeRate()).to.eql(BN(unbondFeeRate));
        logger.info('🎉 Staking Contract verified\n');

        //EraManager
        logger = getLogger('EraManager');
        logger.info(`🧮 Verifying EraManager Contract: ${sdk.eraManager.address}`);
        const [eraPeriod] = config['EraManager'];
        logger.info(`eraPeriod to be equal ${eraPeriod}`);
        expect(await sdk.eraManager.eraPeriod()).to.eql(BN(eraPeriod));
        logger.info('🎉 EraManager Contract verified\n');

        //ServiceAgreementRegistry
        logger = getLogger('ServiceAgreementRegistry');
        logger.info(`🧮 Verifying ServiceAgreementRegistry Contract: ${sdk.serviceAgreementRegistry.address}`);
        logger.info('PlanMananger and PurchaseOfferContract are in the whitelist');
        expect(await sdk.serviceAgreementRegistry.establisherWhitelist(sdk.planManager.address)).to.be.true;
        expect(await sdk.serviceAgreementRegistry.establisherWhitelist(sdk.purchaseOfferMarket.address)).to.be.true;
        logger.info('🎉 ServiceAgreementRegistry Contract verified\n');

        //PurchaseOfferMarket
        logger = getLogger('PurchaseOfferMarket');
        logger.info(`🧮 Verifying PurchaseOfferMarket Contract: ${sdk.purchaseOfferMarket.address}`);
        const [penaltyRate] = config['PurchaseOfferMarket'];
        logger.info(`penaltyRate to be equal ${penaltyRate}`);
        expect(await sdk.purchaseOfferMarket.penaltyRate()).to.eql(BN(penaltyRate));
        const pDestination = mainnetConfig.multiSig.child.treasury;
        logger.info(`penaltyDestination to be equal ${pDestination}`);
        expect((await sdk.purchaseOfferMarket.penaltyDestination()).toUpperCase()).to.equal(pDestination.toUpperCase());
        logger.info('🎉 PurchaseOfferMarket Contract verified\n');

        //IndexerRegistry
        logger = getLogger('IndexerRegistry');
        logger.info(`🧮 Verifying IndexerRegistry Contract: ${sdk.indexerRegistry.address}`);
        const [minimumStakingAmount] = config['IndexerRegistry'];
        logger.info(`minimumStakingAmount to be equal ${minimumStakingAmount}`);
        expect(await sdk.indexerRegistry.minimumStakingAmount()).to.eql(BN(minimumStakingAmount));
        logger.info('🎉 IndexerRegistry Contract verified\n');

        //ProjectRegistry
        logger = getLogger('ProjectRegistry');
        logger.info(`🧮 Verifying ProjectRegistry Contract: ${sdk.projectRegistry.address}`);
        logger.info(`${caller} is project creator`);
        expect(await sdk.projectRegistry.creatorWhitelist(caller)).to.be.true;
        logger.info('🎉 ProjectRegistry Contract verified\n');

        //ConsumerHost
        logger = getLogger('ConsumerHost');
        logger.info(`🧮 Verifying ConsumerHost Contract: ${sdk.consumerHost.address}`);
        const [feePercentage] = config['ConsumerHost'];
        logger.info(`feePercentage to be equal ${feePercentage}`);
        expect(await sdk.consumerHost.feePerMill()).to.eql(BN(feePercentage));
        logger.info('🎉 ConsumerHost Contract verified\n');

        //DisputeManager
        logger = getLogger('DisputeManager');
        logger.info(`🧮 Verifying DisputeManager Contract: ${sdk.disputeManager.address}`);
        const [minDeposit] = config['DisputeManager'];
        logger.info(`DisputeManager minimumDeposit to be equal ${minDeposit}`);
        expect(await sdk.disputeManager.minimumDeposit()).to.eql(BN(minDeposit));
        logger.info('🎉 DisputeManager Contract verified\n');

        //rewardsBooster
        logger = getLogger('RewardsBooster');
        logger.info(`🧮 Verifying RewardsBooster Contract: ${sdk.rewardsBooster.address}`);
        const [issuancePerBlock, minimumDeploymentBooster] = config['RewardsBooster'];
        logger.info(`issuancePerBlock to be equal ${issuancePerBlock}`);
        expect(await sdk.rewardsBooster.issuancePerBlock()).to.eql(BN(issuancePerBlock));
        logger.info(`minimumDeploymentBooster to be equal ${minimumDeploymentBooster}`);
        expect(await sdk.rewardsBooster.minimumDeploymentBooster()).to.eql(BN(minimumDeploymentBooster));
        logger.info('🎉 RewardsBooster Contract verified\n');

        //priceOracle
        logger = getLogger('PriceOracle');
        logger.info(`🧮 Verifying PriceOracle Contract: ${sdk.priceOracle.address}`);
        const [sizeLimit, blockLimit] = config['PriceOracle'];
        logger.info(`sizeLimit to be equal ${sizeLimit}`);
        expect(await sdk.priceOracle.sizeLimit()).to.eql(BN(sizeLimit));
        logger.info(`blockLimit to be equal ${blockLimit}`);
        expect(await sdk.priceOracle.blockLimit()).to.eql(BN(blockLimit));
        logger.info('🎉 PriceOracle Contract verified\n');

    } catch (err) {
        logger.info(`Failed to verify contract: ${err}`);
    }
}

async function checkConfiguration(sdk: ContractSDK, config) {
    try {
        // planTemplates
        let logger = getLogger('planTemplates');
        logger.info(`🧮 Verifying planTemplates`);
        const planTemplates = config.planTemplates;
        for (let i = 0; i < planTemplates.length; i++) {
            const planTemplate = planTemplates[i];
            const pm = await sdk.planManager.getPlanTemplate(i);
            expect(BN(planTemplate.period)).to.eql(pm.period);
            expect(BN(planTemplate.dailyReqCap)).to.eql(pm.dailyReqCap);
            expect(BN(planTemplate.rateLimit)).to.eql(pm.rateLimit);
            logger.info(`🎉 planTemplate ${i} verified`);
        }
        //projects
        logger = getLogger('projects');
        logger.info(`🧮 Verifying projects`);
        const projects = config.projects;
        for (let i = 1; i <= projects.length; i++) {
            const project = projects[i];
            const p = await sdk.projectRegistry.projectInfos(i);
            const uri = await sdk.projectRegistry.tokenURI(i);
            const deploymentInfo = await sdk.projectRegistry.deploymentInfos(p.latestDeploymentId);
            expect(cidToBytes32(project.deploymentId)).to.eql(p.latestDeploymentId);
            expect(cidToBytes32(project.deploymentMetadata)).to.eql(deploymentInfo.metadata);
            expect(project.projectMetadata).to.eql(`ipfs://${uri}`);
            logger.info(`🎉 project ${project.name} verified`);
        }
        //QRCreators
        logger = getLogger('QRCreators');
        logger.info(`🧮 Verifying QRCreators`);
        const creators = config.QRCreator;
        for (let i = 0; i < creators.length; i++) {
            const creator = creators[i];
            const isCreator = await sdk.projectRegistry.creatorWhitelist(creator);
            expect(isCreator).to.be.false;
            logger.info(`🎉 QRCreator: ${creator} verified`);
        }
        //AirdropControllers
        logger = getLogger('AirdropControllers');
        logger.info(`🧮 Verifying AirdropControllers`);
        const controllers = config.AirdropController;
        for (let i = 0; i < controllers.length; i++) {
            const controller = controllers[i];
            const isController = await sdk.airdropper.controllers(controller);
            expect(isController).to.eql(false);
            logger.info(`🎉 AirdropController: ${controller} verified`);
        }
        console.log('\n');
    } catch (error) {
        console.log(error);
    }
}

async function checkRootContractsOwnership(sdk: RootContractSDK) {
    const logger = getLogger('ownership');
    logger.info(`🧮 Verifying root contracts ownership`);

    const foundationW = mainnetConfig.multiSig.root.foundation;
    const allocationW = mainnetConfig.multiSig.root.foundationAllocation;
    const contracts = [
        [sdk.vesting, foundationW],
        [sdk.sqToken, foundationW],
        [sdk.vtSQToken, foundationW],
        [sdk.inflationDestination, foundationW],
        [sdk.inflationController, foundationW],
        // TODO: verify `settings` and `proxyAmdin` which owner is `allocationW`
    ];
    
    try {
        for (const [contract, owner] of contracts) {
            // @ts-expect-error no owner interface
            const o = await contract.owner();
            expect(o.toLowerCase()).to.eql(owner);
            // @ts-expect-error no address interface
            logger.info(`🎉 Ownership of contract: ${contract.address} verified`);
        }
    } catch (error) {
        console.log(error);
    }
}

async function checkChildContractsOwnership(sdk: ContractSDK) {
    const logger = getLogger('ownership');
    logger.info(`🧮 Verifying ownership`);

    const contracts = [
        sdk.consumerHost,
        sdk.disputeManager,
        sdk.eraManager,
        sdk.indexerRegistry,
        sdk.planManager,
        sdk.proxyAdmin,
        sdk.purchaseOfferMarket,
        sdk.projectRegistry,
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
        sdk.consumerRegistry,
        sdk.rewardsBooster,
        sdk.stakingAllocation,
    ];

    const owner = mainnetConfig.multiSig.child.council;
    try {
        for (const contract of contracts) {
            // @ts-expect-error no owner interface
            const o = await contract.owner();
            expect(o.toLowerCase()).to.eql(owner);
            logger.info(`🎉 Ownership of contract: ${contract.address} verified`);
        }
    } catch (error) {
        console.log(error);
    }
}

const main = async () => {
    let startupConfig: typeof startupTestnetConfig = startupTestnetConfig;
    const network = (argv.network ?? 'testnet') as SubqueryNetwork;
    const { rootProvider, childProvider } = await setupCommon(networks[network]);

    switch (network) {
        case 'mainnet':
            // @ts-expect-error mainnet has diff config with testnet
            startupConfig = startupMainnetConfig;
            break;
        case 'testnet':
            startupConfig = startupTestnetConfig;
            break;
        default:
            throw new Error(`Please provide correct network ${network}`);
    }

    const childSDK = ContractSDK.create(childProvider, { network });
    const rootSDK = RootContractSDK.create(rootProvider, { network });
    const caller = '0x70d0afee4a6a314d71046da9b4bbcfb8fd1722ce';

    const config = contractsConfig[network];
    const verifyType = process.argv[6];
    switch (verifyType) {
        case '--initialisation':
            await checkRootInitialisation(rootSDK, config);
            await checkChildInitialisation(childSDK, config, caller);
            break;
        case '--configuration':
            await checkConfiguration(childSDK, config);
            break;
        case '--ownership':
            await checkChildContractsOwnership(childSDK);
            await checkRootContractsOwnership(rootSDK);
            break;
        case '--all':
            await checkChildInitialisation(childSDK, config, caller);
            await checkRootInitialisation(rootSDK, config);
            await checkConfiguration(childSDK, startupConfig);
            await checkChildContractsOwnership(childSDK);
            await checkRootContractsOwnership(rootSDK);
            break;
        default:
            throw new Error(`Please provide correct network ${network}`);
    }
};

main();
