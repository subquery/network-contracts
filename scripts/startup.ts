import {BaseContract, ContractReceipt, ContractTransaction, Wallet} from 'ethers';

import setup from './setup';

import startupConfig from './config/startup.json';
import {METADATA_HASH} from '../test/constants';
import {cidToBytes32, lastestTime} from '../test/helper';
import {ContractSDK} from '../src';

import deployment from '../publish/testnet.json';
import { parseEther } from 'ethers/lib/utils';
import { StaticJsonRpcProvider } from '@ethersproject/providers';

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

export async function createProjects(sdk: ContractSDK) {
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

export async function createPlanTemplates(sdk: ContractSDK) {
    console.info("Create Plan Templates:");
    let templateId = await sdk.planManager.nextTemplateId(); 
    let templates = startupConfig.planTemplates;
    for (var i = templateId.toNumber(); i < templates.length; i++){
        const {period, dailyReqCap, rateLimit} = templates[i];
        console.info(`Create No. ${i} plan template`);
        await sendTx(() => sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, METADATA_HASH));
    }
}

export async function airdrop(sdk: ContractSDK, provider: StaticJsonRpcProvider) {
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

    console.info("Create Airdrop round:");
    const {startTime, endTime} = await getAirdropTimeConfig(provider);
    const receipt = await sendTx(() => sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime));
    const roundId = receipt.events[0].args.roundId;

    const airdropAccounts = startupConfig.airdrops;
    const rounds = new Array(airdropAccounts.length).fill(roundId);
    const amounts = startupConfig.amounts.map((a) => parseEther(a.toString()));

    console.info("Batch send Airdrop");
    await  sendTx(() => sdk.airdropper.batchAirdrop(airdropAccounts, rounds, amounts));
}

export async function ownerTransfer(sdk: ContractSDK) {
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
    
    for (const contract of contracts) {
        const owner = await contract.owner();
        if (owner != startupConfig.multiSign) {
            console.info(`Transfer Ownership: ${contract.contractName}`);
            await sendTx(() => contract.transferOwnership(startupConfig.multiSign));
        } else {
            console.info(`${contract.contractName} already transfered`);
        } 
    }

}

export async function balanceTransfer(sdk: ContractSDK, wallet: Wallet) {
    const balance = await sdk.sqToken.balanceOf(wallet.address);
    if (balance.gt(0)){
        console.info(`Transfer ${balance.toString()} from ${wallet.address} to ${startupConfig.multiSign}`);
        await sendTx(() => sdk.sqToken.transfer(startupConfig.multiSign, balance));
    }else{
        console.info(`Balance already transfered`)
    }
    
}

const main = async () => {
    const {wallet, provider} = await setup(process.argv[2]);
    const sdk = await ContractSDK.create(wallet, {deploymentDetails: deployment});

    const networkType = process.argv[2];
    switch (networkType) {
        case '--mainnet':
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            await balanceTransfer(sdk, wallet);
            await ownerTransfer(sdk);
            break;
        case '--kepler':
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            await balanceTransfer(sdk, wallet);
            await ownerTransfer(sdk);
            break;
        case '--testnet':
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            await airdrop(sdk, provider);
            await balanceTransfer(sdk, wallet);
            await ownerTransfer(sdk);
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`)
    }
};

main();
