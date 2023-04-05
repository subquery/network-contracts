import {ethers, ContractReceipt, ContractTransaction, Wallet} from 'ethers';
import Pino from 'pino';

import setup from './setup';

import startupKeplerConfig from './config/startup.kepler.json';
import startupMainnetConfig from './config/startup.mainnet.json';
import startupTestnetConfig from './config/startup.testnet.json';
import {METADATA_HASH} from '../test/constants';
import {cidToBytes32, lastestTime} from '../test/helper';
import {ContractSDK} from '../src';
import Token from '../artifacts/contracts/SQToken.sol/SQToken.json';

import deployment from '../publish/testnet.json';
import { parseEther } from 'ethers/lib/utils';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { getLogger } from './logger';

let startupConfig : any = startupTestnetConfig;
let logger: Pino.Logger;
let confirms = 0;

async function sendTx(transaction: () => Promise<ContractTransaction>): Promise<ContractReceipt> {
    const tx = await transaction();
    logger?.info(`🤞 Sending transaction: ${tx.hash}`);
    const receipt = await tx.wait(confirms);
    logger?.info('🚀 Transaction successful!');
    return receipt;
}

async function getAirdropTimeConfig(provider) {
    const startTime = (await lastestTime(provider)) + 600;
    const endTime = startTime + 864000;

    return {startTime, endTime};
}

export async function createProjects(sdk: ContractSDK) {
    logger = getLogger('Projects');
    for (const creator of startupConfig.QRCreator) {
        const result = await sdk.queryRegistry.creatorWhitelist(creator); 
        if (!result) {
            logger.info(`Add project creator: ${creator}`);
            await sendTx(() => sdk.queryRegistry.addCreator(creator));
        } else {
            logger.info(`${creator} has already exist`);
        } 
    }
    
    logger.info('Create Query Projects');
    const queryId = await sdk.queryRegistry.nextQueryId(); 
    const projects = startupConfig.projects;
    for (var i = queryId.toNumber(); i < projects.length; i++){
        const {name, metadataCid, versionCid, deploymentId} = projects[i];
        logger.info(`Create query project: ${name}`);
        await sendTx(() => sdk.queryRegistry.createQueryProject(
            cidToBytes32(metadataCid),
            cidToBytes32(versionCid),
            cidToBytes32(deploymentId)
        ));
    }
    console.log('\n');
}

export async function createPlanTemplates(sdk: ContractSDK) {
    logger = getLogger('Plan Templates');
    const templateId = await sdk.planManager.nextTemplateId(); 
    const templates = startupConfig.planTemplates;
    for (var i = templateId.toNumber(); i < templates.length; i++){
        const {period, dailyReqCap, rateLimit} = templates[i];
        logger.info(`Create No. ${i} plan template: ${period} | ${dailyReqCap} | ${rateLimit}`);
        await sendTx(() => sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, METADATA_HASH));
    }

    console.log('\n');
}

export async function airdrop(sdk: ContractSDK, provider: StaticJsonRpcProvider) {
    logger = getLogger('Airdrop');
    for (const controller of startupConfig.AirdropController) {
        const result = await sdk.airdropper.controllers(controller); 
        if (!result) {
            logger.info(`Add airdrop controller: ${controller}`);
            await sendTx(() => sdk.airdropper.addController(controller));
        } else {
            logger.info(`${controller} has already exist`);
        } 
    }

    logger.info("Create Airdrop round");
    const {startTime, endTime} = await getAirdropTimeConfig(provider);
    const receipt = await sendTx(() => sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime));
    const roundId = receipt.events[0].args.roundId;
    logger.info(`Round ${roundId} created: ${startTime} | ${endTime}`);

    const airdropAccounts = startupConfig.airdrops;
    const rounds = new Array(airdropAccounts.length).fill(roundId);
    const amounts = startupConfig.amounts.map((a) => parseEther(a.toString()));

    logger.info("Batch send Airdrop");
    const totalAmount = eval(startupConfig.amounts.join("+"));
    await sendTx(() => sdk.sqToken.increaseAllowance(sdk.airdropper.address, parseEther(totalAmount.toString())));
    await sendTx(() => sdk.airdropper.batchAirdrop(airdropAccounts, rounds, amounts));

    console.log('\n');
}

async function setupPermissionExchange(sdk: ContractSDK, provider: StaticJsonRpcProvider, wallet: Wallet) {
    logger = getLogger('Permission Exchange');
    logger.info("Setup exchange order");
    const {usdcAddress, amountGive, amountGet, expireDate, tokenGiveBalance} = startupConfig.exchange;
    const usdcContract = new ethers.Contract(usdcAddress, Token.abi, provider);
    await usdcContract.connect(wallet).increaseAllowance(sdk.permissionedExchange.address, tokenGiveBalance);

    await sendTx(() => sdk.permissionedExchange.createPairOrders(
        usdcAddress,
        sdk.sqToken.address,
        amountGive,
        amountGet,
        expireDate,
        tokenGiveBalance
    ));

    console.log('\n');
}

export async function ownerTransfer(sdk: ContractSDK) {
    logger = getLogger('Owner Transfer');
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
            logger.info(`Transfer Ownership: ${contract.contractName}`);
            await sendTx(() => contract.transferOwnership(startupConfig.multiSign));
        } else {
            console.info(`${contract.contractName} ownership has already transfered`);
        } 
    }

    console.log('\n');
}

export async function balanceTransfer(sdk: ContractSDK, wallet: Wallet) {
    logger = getLogger('Token');
    const balance = await sdk.sqToken.balanceOf(wallet.address);
    if (balance.gt(0)){
        logger.info(`Transfer ${balance.toString()} from ${wallet.address} to ${startupConfig.multiSign}`);
        await sendTx(() => sdk.sqToken.transfer(startupConfig.multiSign, balance));
    }else{
        logger.info(`Balance already transfered`)
    }
    
}

const main = async () => {
    const {wallet, provider} = await setup(process.argv[2]);
    const sdk = await ContractSDK.create(wallet, {deploymentDetails: deployment});

    const networkType = process.argv[2];
    switch (networkType) {
        case '--mainnet':
            startupConfig = startupMainnetConfig;
            confirms = 20;
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            await balanceTransfer(sdk, wallet);
            await ownerTransfer(sdk);
            break;
        case '--kepler':
            confirms = 20;
            startupConfig = startupKeplerConfig;
            await createProjects(sdk);
            // await createPlanTemplates(sdk);
            await balanceTransfer(sdk, wallet);
            await ownerTransfer(sdk);
            break;
        case '--testnet':
            confirms = 1;
            startupConfig = startupTestnetConfig;
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            await airdrop(sdk, provider);
            // await setupPermissionExchange(sdk, provider, wallet);
            await balanceTransfer(sdk, wallet);
            await ownerTransfer(sdk);
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`)
    }
};

main();
