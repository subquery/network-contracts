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

export async function createProjects(sdk) {
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

export async function createPlanTemplates(sdk) {
    console.info("Create Plan Templates:");
    let templateId = await sdk.planManager.nextTemplateId(); 
    let templates = startupConfig.planTemplates;
    for (var i = templateId.toNumber(); i < templates.length; i++){
        const {period, dailyReqCap, rateLimit} = templates[i];
        console.info(`Create No. ${i} plan template`);
        await sendTx(() => sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, METADATA_HASH));
    }
}

export async function airdropStartup(sdk) {
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

export async function ownerTransfer(sdk) {
    console.info("Transfer Ownerships:");
    const contracts = [
        [sdk.airdropper, "airdropper"], 
        [sdk.consumerHost, "consumerHost"], 
        [sdk.disputeManager, "disputeManager"], 
        [sdk.eraManager, "eraManager"],
        [sdk.indexerRegistry, "indexerRegistry"], 
        [sdk.inflationController, "inflationController"],
        [sdk.permissionedExchange, "permissionedExchange"],
        [sdk.planManager, "planManager"],
        [sdk.proxyAdmin, "proxyAdmin"],
        [sdk.purchaseOfferMarket, "purchaseOfferMarket"],
        [sdk.queryRegistry, "queryRegistry"],
        [sdk.rewardsDistributor, "rewardsDistributor"],
        [sdk.rewardsHelper, "rewardsHelper"],
        [sdk.rewardsPool, "rewardsPool"],
        [sdk.rewardsStaking, "rewardsStaking"],
        [sdk.serviceAgreementRegistry, "serviceAgreementRegistry"],
        [sdk.settings, "settings"],
        [sdk.sqToken, "sqToken"],
        [sdk.staking, "staking"],
        [sdk.stakingManager, "stakingManager"],
        [sdk.stateChannel, "stateChannel"],
        [sdk.vesting, "vesting"]
    ];
    for (const contract of contracts) {
        const owner = await contract[0].owner();
        if (owner != startupConfig.multiSign) {
            console.info(`Transfer Ownership: ${contract[1]}`);
            await sendTx(() => contract[0].transferOwnership(startupConfig.multiSign));
        } else {
            console.info(`${contract[1]} already transfered`);
        } 
    }

}

export async function balanceTransfer(sdk, wallet) {
    const balance = await sdk.sqToken.balanceOf(wallet.address);
    if (balance.gt(0)){
        console.info(`Transfer ${balance.toString()} from ${wallet.address} to ${startupConfig.multiSign}`);
        await sendTx(() => sdk.sqToken.transfer(startupConfig.multiSign, balance));
    }else{
        console.info(`Balance already transfered`)
    }
    
}

const main = async () => {
    const {wallet} = await setup(process.argv[2]);
    const sdk = await ContractSDK.create(wallet, {deploymentDetails: deployment});

    switch (process.argv[2]) {
        case '--mainnet':
            break;
        case '--kepler':
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            await airdropStartup(sdk);
            await ownerTransfer(sdk);
            await balanceTransfer(sdk, wallet);
            break;
        case '--testnet':
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            await airdropStartup(sdk);
            await ownerTransfer(sdk);
            await balanceTransfer(sdk, wallet);
            break;
        default:
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            await airdropStartup(sdk);
    }
};

main();
