import {ContractReceipt, ContractTransaction, ethers, Wallet} from 'ethers';
import {StaticJsonRpcProvider} from '@ethersproject/providers';

import setup from './setup';
import {Airdropper, ContractSDK, PermissionedExchange, QueryRegistry, SQToken} from '../src';
import {PlanManager} from '../src/typechain/PlanManager';
import networkConfig from './config/startup.json';
import {METADATA_HASH} from '../test/constants';
import {cidToBytes32, lastestTime, Provider} from '../test/helper';
import Token from '../artifacts/contracts/SQToken.sol/SQToken.json';

import deployment from '../publish/testnet.json';

export type SetupSdk = {
    sqToken: SQToken;
    airdropper: Airdropper;
    planManager: PlanManager;
    queryRegistry: QueryRegistry;
    permissionedExchange: PermissionedExchange;
};

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

export async function setupNetwork(sdk: SetupSdk, provider: Provider, config?: typeof networkConfig) {
    const {setupConfig, dictionaries} = config ?? networkConfig;
    const {airdrops, amounts, planTemplates} = setupConfig;
    await sdk.sqToken.increaseAllowance(sdk.airdropper.address, '10000000');

    console.info('Add airdrop controller account');
    await sendTx(() => sdk.airdropper.addController("0x293a6d85DD0d7d290A719Fdeef43FaD10240bA77"));
    console.log(`0x293a6d85DD0d7d290A719Fdeef43FaD10240bA77: ${await sdk.airdropper.controllers("0x293a6d85DD0d7d290A719Fdeef43FaD10240bA77")}`)

    // Create Airdrop round with period --- 10 days
    console.info('Create and send airdrop');
    const {startTime, endTime} = await getAirdropTimeConfig(provider);
    const receipt = await sendTx(() => sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime));
    const roundId = receipt.events[0].args.roundId;
    const rounds = new Array(airdrops.length).fill(roundId);
    await  sendTx(() => sdk.airdropper.batchAirdrop(airdrops, rounds, amounts));

    console.info('Setup plan templates');
    for (const template of planTemplates) {
        const {period, dailyReqCap, rateLimit} = template;
        await sendTx(() => sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, METADATA_HASH));
    }

    console.info('Setup dictionary projects');
    const creator = await sdk.sqToken.owner();
    await sendTx(() => sdk.queryRegistry.addCreator(creator));

    // Add dictionary projects to query registry contract
    for (const dictionary of dictionaries) {
        const {metadataCid, versionCid, deploymentId} = dictionary;
        try {
            await sendTx(() => sdk.queryRegistry.createQueryProject(
                cidToBytes32(metadataCid),
                cidToBytes32(versionCid),
                cidToBytes32(deploymentId)
            ));
        } catch (error) {
            console.log(error);
        }
    }
}

async function setupPermissionExchange(sdk: SetupSdk, provider: StaticJsonRpcProvider, wallet: Wallet) {
    console.info('Setup exchange pair orders');

    const {usdcAddress, amountGive, amountGet, expireDate, tokenGiveBalance} = networkConfig.exchange;
    const usdcContract = new ethers.Contract(usdcAddress, Token.abi, provider);

    await sendTx(() => usdcContract.connect(wallet).increaseAllowance(sdk.permissionedExchange.address, tokenGiveBalance));

    await sendTx(() => sdk.permissionedExchange.createPairOrders(
        usdcAddress,
        sdk.sqToken.address,
        amountGive,
        amountGet,
        expireDate,
        tokenGiveBalance
    ));
}

const main = async () => {
    const {wallet, provider} = await setup(process.argv[2]);
    const sdk = await ContractSDK.create(wallet, {deploymentDetails: deployment});

    // await setupNetwork(sdk, provider);
    await setupPermissionExchange(sdk, provider as StaticJsonRpcProvider, wallet);
};

main();
