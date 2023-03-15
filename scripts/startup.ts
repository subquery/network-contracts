import {ContractReceipt, ContractTransaction} from 'ethers';

import setup from './setup';

import startupConfig from './config/startup.json';
import {METADATA_HASH} from '../test/constants';
import {cidToBytes32, lastestTime} from '../test/helper';
import {ContractSDK} from '../src';

import deployment from '../publish/testnet.json';

async function sendTx(transaction: () => Promise<ContractTransaction>): Promise<ContractReceipt> {
    const tx = await transaction();
    const receipt = await tx.wait();

    return receipt;
}

async function getAirdropTimeConfig(provider) {
    const startTime = (await lastestTime(provider)) + 600;
    const endTime = startTime + 864000;

    return {startTime, endTime};
}

async function qrStartup(sdk) {
    console.info('Add QueryRegistry creator:');
    for (const creator of startupConfig.QRCreator) {
        const result = await sdk.queryRegistry.creatorWhitelist(creator); 
        if (!result) {
            console.info(`Add ${creator}`);
            await sendTx(() => sdk.queryRegistry.addCreator(creator));
        } else {
            console.info(`${creator} is already creator`);
        } 
    }
    
    console.info('Create Query Projects:');
    let queryId = await sdk.queryRegistry.nextQueryId(); 
    let projects = startupConfig.projects;
    for (var i = queryId.toNumber(); i < projects.length; i++){
        const {name, metadataCid, versionCid, deploymentId} = projects[i];
        console.info(`Create query project: ${name}`);
        await sendTx(() => sdk.queryRegistry.createQueryProject(
            cidToBytes32(metadataCid),
            cidToBytes32(versionCid),
            cidToBytes32(deploymentId)
        ));
    }
}

async function pmStartup(sdk) {
    console.info("Create Plan Templates:");
    let templateId = await sdk.planManager.nextTemplateId(); 
    let templates = startupConfig.planTemplates;
    for (var i = templateId.toNumber(); i < templates.length; i++){
        const {period, dailyReqCap, rateLimit} = templates[i];
        console.info(`Create plan template with: ${templates[i]}`);
        await sendTx(() => sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, METADATA_HASH));
    }
}

async function airdropStartup(sdk) {
    console.info("Add Airdrop Controllers:");
    for (const controller of startupConfig.AirdropController) {
        const result = await sdk.airdropper.controllers(controller); 
        if (!result) {
            console.info(`Add ${controller}`);
            await sendTx(() => sdk.airdropper.addController(controller));
        } else {
            console.info(`${controller} is already controller`);
        } 
    }
}

async function ownerTransfer(sdk) {
    console.info("Transfer Ownerships:");
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
        sdk.rewardsDistributer,
        sdk.rewardsHelper,
        sdk.rewardsPool,
        sdk.rewardsStaking,
        sdk.serviceAgreementRegistry,
        sdk.settings,
        sdk.sqToken,
        sdk.staking,
        sdk.stakingManager,
        sdk.stateChannel,
        sdk.vesting
    ];
    for (const contract of contracts) {
        const owner = await contract.owner();
        if (owner != startupConfig.multiSign) {
            console.info(`Transfer Ownership`);
            await sendTx(() => contract.transferOwnership(startupConfig.multiSign));
        } else {
            console.info(`Transfer Complete`);
        } 
    }

}

const main = async () => {
    const {wallet, provider} = await setup(process.argv[2]);
    const sdk = await ContractSDK.create(wallet, {deploymentDetails: deployment});

    switch (process.argv[2]) {
        case '--mainnet':
            break;
        case '--kepler':
            await qrStartup(sdk);
            await pmStartup(sdk);
            await airdropStartup(sdk);
            await ownerTransfer(sdk);
            const balance = await sdk.sqToken.balanceOf(wallet.address);
            await sendTx(() => sdk.sqToken.transfer(startupConfig.multiSign, balance));
            break;
        case '--testnet':
            await qrStartup(sdk);
            await pmStartup(sdk);
            await airdropStartup(sdk);
            break;
        default:
            await qrStartup(sdk);
            await pmStartup(sdk);
            await airdropStartup(sdk);
    }
};

main();
