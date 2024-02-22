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
    const [rate, destination] = config.contracts['InflationController'];
    logger.info(`InflationRate to be equal ${rate}`);
    expect(await sdk.inflationController.inflationRate()).to.eql(BN(rate));
    logger.info(`InflationDestination to be equal ${destination}`);
    expect((await sdk.inflationController.inflationDestination()).toUpperCase()).to.equal(
        destination.toUpperCase()
    );
    logger.info('🎉 InflationController Contract verified\n');

    // inflation destination
    logger = getLogger('InflationDestination');
    logger.info(`🧮 Verifying inflationDestination: ${sdk.inflationDestination.address}`);
    const [XcRecipient] = config.contracts['InflationDestination']
    logger.info(`XcRecipient to be equal ${XcRecipient}`);
    expect(await sdk.inflationDestination.xcRecipient()).eq(XcRecipient);
    logger.info('🎉 InflationDestination Contract verified\n');

    // SQToken
    logger = getLogger('SQToken');
    logger.info(`🧮 Verifying SQToken Contract: ${sdk.sqToken.address}`);
    const [totalSupply] = config.contracts['SQToken'];
    const amount = await sdk.sqToken.totalSupply();
    logger.info(`Initial supply to be equal ${amount.toString()}`);
    expect(totalSupply).to.eql(amount);
    const wallet = mainnetConfig.multiSig.root.foundation;
    logger.info(`Foundation wallet: ${wallet} own the total assets`);
    // TODO: sqt may already transfer to other accounts
    expect(totalSupply).to.eql(await sdk.sqToken.balanceOf(wallet));
    logger.info('🎉 SQToken Contract verified\n');

    // VTSQToken
    logger = getLogger('VTSQToken');
    logger.info(`🧮 Verifying VTSQToken Contract: ${sdk.vtSQToken.address}`);
    const minter = sdk.vesting.address;
    logger.info(`Minter to be equal ${minter}`);
    // @ts-expect-error no minter interface
    expect((await sdk.vtSQToken.getMinter()).toUpperCase()).to.equal(minter.toUpperCase());
}

async function checkChildInitialisation(sdk: ContractSDK, config, startupConfig, caller: string) {
    try {
        const multiSig = startupConfig.multiSign;
  
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

        //ProjectRegistry
        logger = getLogger('ProjectRegistry');
        logger.info(`🧮 Verifying ProjectRegistry Contract: ${sdk.projectRegistry.address}`);
        logger.info(`${caller} is not project creator`);
        expect(await sdk.projectRegistry.creatorWhitelist(caller)).to.be.false;
        logger.info(`${multiSig} is project creator`);
        expect(await sdk.projectRegistry.creatorWhitelist(multiSig)).to.be.true;
        logger.info('🎉 ProjectRegistry Contract verified\n');

        //ConsumerHost
        logger = getLogger('ConsumerHost');
        logger.info(`🧮 Verifying ConsumerHost Contract: ${sdk.consumerHost.address}`);
        const [feePercentage] = config.contracts['ConsumerHost'];
        logger.info(`feePercentage to be equal ${feePercentage}`);
        expect(await sdk.consumerHost.fee()).to.eql(BN(feePercentage));
        logger.info('🎉 ConsumerHost Contract verified\n');

        //DisputeManager
        logger = getLogger('DisputeManager');
        logger.info(`🧮 Verifying DisputeManager Contract: ${sdk.disputeManager.address}`);
        const [minDeposit] = config.contracts['DisputeManager'];
        logger.info(`DisputeManager minimumDeposit to be equal ${minDeposit}`);
        expect(await sdk.disputeManager.minimumDeposit()).to.eql(BN(minDeposit));
        logger.info('🎉 DisputeManager Contract verified\n');
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

async function checkRootContractsOwnership(sdk: RootContractSDK, owner: string) {

}

async function checkChildContractsOwnership(sdk: ContractSDK, owner: string) {
    const logger = getLogger('ownership');
    logger.info(`🧮 Verifying ownership`);

    const contracts = [
        sdk.airdropper,
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
    ];
    try {
        for (const contract of contracts) {
            // @ts-expect-error no owner interface
            const o = await contract.owner();
            expect(o.toLowerCase()).to.eql(owner.toLocaleLowerCase());
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
    const caller = '0x00';

    console.log('rootSDK:', rootSDK);

    const config = contractsConfig[network];
    const verifyType = process.argv[6];
    switch (verifyType) {
        case '--initialisation':
            // await checkChildInitialisation(childSDK, config, startupConfig, caller);
            await checkRootInitialisation(rootSDK, config);
            break;
        case '--configuration':
            await checkConfiguration(childSDK, startupConfig);
            break;
        case '--ownership':
            await checkChildContractsOwnership(childSDK, startupConfig.multiSign);
            await checkRootContractsOwnership(rootSDK, startupConfig.multiSign);
            break;
        case '--all':
            await checkChildInitialisation(childSDK, config, startupConfig, caller);
            await checkRootInitialisation(rootSDK, config);
            await checkConfiguration(childSDK, startupConfig);
            await checkChildContractsOwnership(childSDK, startupConfig.multiSign);
            await checkRootContractsOwnership(rootSDK, startupConfig.multiSign);
            break;
        default:
            throw new Error(`Please provide correct network ${network}`);
    }
};

main();
