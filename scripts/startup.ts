import {ethers, Wallet} from 'ethers';
import {StaticJsonRpcProvider} from '@ethersproject/providers';

import setup from './setup';
import {DeploymentConfig} from '../src/types';
import {Airdropper, ContractSDK, PermissionedExchange, QueryRegistry, SQToken} from '../src';
import {PlanManager} from '../src/typechain/PlanManager';
import localConfig from './config/local.config';
import keplerConfig from './config/kepler.config';
import testnetConfig from './config/testnet.config';
import mainnetConfig from './config/mainnet.config';
import networkConfig from './config/startup.json';
import {METADATA_HASH} from '../test/constants';
import {cidToBytes32, createProvider, lastestTime, Provider} from '../test/helper';
import Token from '../artifacts/contracts/SQToken.sol/SQToken.json';

import deployment from '../publish/testnet.json';

export type SetupSdk = {
    sqToken: SQToken;
    airdropper: Airdropper;
    planManager: PlanManager;
    queryRegistry: QueryRegistry;
    permissionedExchange: PermissionedExchange;
};

async function getAirdropTimeConfig(provider) {
    const startTime = (await lastestTime(provider)) + 600;
    const endTime = startTime + 864000;

    return {startTime, endTime};
}

export async function setupNetwork(sdk: SetupSdk, provider: Provider, config?: typeof networkConfig) {
    const {setupConfig, exchange, dictionaries} = config ?? networkConfig;
    const {airdrops, amounts, rounds, planTemplates} = setupConfig;
    await sdk.sqToken.increaseAllowance(sdk.airdropper.address, '10000000');

    // Create Airdrop round with period --- 10 days
    console.info('Create and send airdrop');
    const {startTime, endTime} = await getAirdropTimeConfig(provider);
    const tx = await sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime);
    tx.wait(2);
    await sdk.airdropper.batchAirdrop(airdrops, rounds, amounts);

    console.info('Setup plan templates');
    for (const template of planTemplates) {
        const {period, dailyReqCap, rateLimit} = template;
        await sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, METADATA_HASH);
    }

    console.info('Setup dictionary projects');
    const creator = await sdk.sqToken.owner();
    await sdk.queryRegistry.addCreator(creator);

    // Add dictionary projects to query registry contract
    for (const dictionary of dictionaries) {
        const {metadataCid, versionCid, deploymentId} = dictionary;
        await sdk.queryRegistry.createQueryProject(
            cidToBytes32(metadataCid),
            cidToBytes32(versionCid),
            cidToBytes32(deploymentId)
        );
    }
}

async function setupPermissionExchange(sdk: SetupSdk, provider: StaticJsonRpcProvider, wallet: Wallet) {
    console.info('Setup exchange pair orders');

    const {usdcAddress, amountGive, amountGet, expireDate, tokenGiveBalance} = networkConfig.exchange;
    const usdcContract = new ethers.Contract(usdcAddress, Token.abi, provider);

    await usdcContract.connect(wallet).increaseAllowance(sdk.permissionedExchange.address, tokenGiveBalance);

    await sdk.permissionedExchange.createPairOrders(
        usdcAddress,
        sdk.sqToken.address,
        amountGive,
        amountGet,
        expireDate,
        tokenGiveBalance
    );
}

const main = async () => {
    let config: DeploymentConfig;

    switch (process.argv[2]) {
        case '--mainnet':
            config = mainnetConfig as DeploymentConfig;
            break;
        case '--kepler':
            config = keplerConfig as DeploymentConfig;
            break;
        case '--testnet':
            config = testnetConfig as DeploymentConfig;
            break;
        default:
            config = localConfig as DeploymentConfig;
    }

    if (process.env.ENDPOINT) {
        console.log(`use overridden endpoint ${process.env.ENDPOINT}`);
        config.network.endpoint = process.env.ENDPOINT;
    }

    const {wallet, provider} = await setup(config.network);
    const sdk = await ContractSDK.create(wallet, {deploymentDetails: deployment});

    await setupNetwork(sdk, provider);
    await setupPermissionExchange(sdk, provider as StaticJsonRpcProvider, wallet);
};

main();
