import setup from './setup';
import {DeploymentConfig} from '../src/types';
import localConfig from './config/local.config';
import keplerConfig from './config/kepler.config';
import testnetConfig from './config/testnet.config';
import mainnetConfig from './config/mainnet.config';
import {EvmRpcProvider} from '@acala-network/eth-providers';
import moonbaseConfig from './config/moonbase.config';
import {Airdropper, ContractSDK, PermissionedExchange, QueryRegistry, SQToken} from '../src';
import deployment from '../publish/moonbase.json';
import {METADATA_HASH} from '../test/constants';
import {cidToBytes32} from 'test/helper';
import networkConfig from './config/startup.json';
import {PlanManager} from '../src/typechain/PlanManager';

export type SetupSdk = {
    sqToken: SQToken;
    airdropper: Airdropper;
    planManager: PlanManager;
    queryRegistry: QueryRegistry;
    permissionedExchange: PermissionedExchange;
};

export async function setupNetwork(sdk: SetupSdk, config?: typeof networkConfig) {
    const {setupConfig, exchange, dictionaries} = config ?? networkConfig;
    const {airdrops, amounts, rounds, planTemplates, startTime, endTime} = setupConfig;
    console.log('amounts:', amounts);

    await sdk.sqToken.increaseAllowance(sdk.airdropper.address, '10000000');

    // Create Airdrop rounds
    // await sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime);
    // await sdk.airdropper.batchAirdrop(airdrops, rounds, amounts);

    // Create plan templates (5)
    for (const template of planTemplates) {
        const {period, dailyReqCap, rateLimit} = template;
        await sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, METADATA_HASH);
    }

    // Create pair orders for exchange contract
    // const {usdcAddress, amountGive, amountGet, expireDate, tokenGiveBalance} = exchange;
    // await sdk.permissionedExchange.createPairOrders(
    //     usdcAddress,
    //     sdk.sqToken.address,
    //     amountGive,
    //     amountGet,
    //     expireDate,
    //     tokenGiveBalance
    // );

    // Create dictionary projects
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

const main = async () => {
    let config: DeploymentConfig;

    switch (process.argv[2]) {
        case '--mainnet':
            config = mainnetConfig as DeploymentConfig;
            break;
        case '--testnet':
            config = testnetConfig as DeploymentConfig;
            break;
        case '--moonbase':
            config = moonbaseConfig as DeploymentConfig;
            break;
        case '--kepler':
            config = keplerConfig as DeploymentConfig;
            break;
        default:
            config = localConfig();
    }

    if (process.env.ENDPOINT) {
        console.log(`use overridden endpoint ${process.env.ENDPOINT}`);
        if (config.network.platform === 'acala') {
            config.network.endpoint = {...config.network.endpoint, eth: process.env.ENDPOINT};
        } else {
            config.network.endpoint = process.env.ENDPOINT;
        }
    }

    const {wallet, provider} = await setup(config.network);
    const sdk = await ContractSDK.create(wallet, {
        deploymentDetails: deployment,
        network: 'testnet',
    });

    await setupNetwork(sdk);

    if ((provider as EvmRpcProvider).api) {
        await (provider as EvmRpcProvider).api.disconnect();
    }
};

main();
