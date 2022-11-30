import setup from './setup';
import { DeploymentConfig } from '../src/types';
import localConfig from './config/local.config';
import keplerConfig from './config/kepler.config';
import testnetConfig from './config/testnet.config';
import mainnetConfig from './config/mainnet.config';
import {EvmRpcProvider} from '@acala-network/eth-providers';
import moonbaseConfig from './config/moonbase.config';
import {ContractSDK} from '../src';
import deployment from '../publish/moonbase.json';
import {METADATA_HASH} from '../test/constants';
import { BigNumberish } from 'ethers';
import { cidToBytes32 } from 'test/helper';
import jsonConfig from './config/startup.json';

async function setupDictionaries(sdk: ContractSDK): Promise<void>{
    const { dictionaries } = jsonConfig;
    
    //add dictionary projects to query registry contract
    for (const dictionary of dictionaries) {
        const { metadataCid, versionCid, deploymentId} = dictionary;
        await sdk.queryRegistry.createQueryProject(
            cidToBytes32(metadataCid),
            cidToBytes32(versionCid),
            cidToBytes32(deploymentId),
        );
    }
}

export async function setups(sdk: ContractSDK, startTime: BigNumberish, endTime: BigNumberish) {
    const { setupConfig } = jsonConfig;
    const { airdrops, amounts, rounds, planTemplates } = setupConfig;

    await sdk.sqToken.increaseAllowance(sdk.airdropper.address, 1000000);

    //Create Airdrop rounds
    await sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime);
    await sdk.airdropper.batchAirdrop(airdrops, rounds, amounts);

    //Create plan templates (5)
    for (const template of planTemplates) {
        const { period, dailyReqCap, rateLimit } = template;
        await sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, METADATA_HASH);
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

    const {wallet, provider, overrides} = await setup(config.network);
    const sdk = await ContractSDK.create(wallet, {
        deploymentDetails: deployment,
        network: 'testnet',
    });

    //TODO: Set controller account for creating project 

    const { setupConfig, exchange } = jsonConfig;
    const { startTime, endTime } = setupConfig;
    await setups(sdk, startTime, endTime);

    const { usdcAddress, amountGive, amountGet, expireDate, tokenGiveBalance } = exchange;
    //Create pair orders for exchange contract
    await sdk.permissionedExchange.createPairOrders(
        usdcAddress,
        sdk.sqToken.address,
        amountGive,
        amountGet,
        expireDate,
        tokenGiveBalance
    );

    if ((provider as EvmRpcProvider).api) {
        await (provider as EvmRpcProvider).api.disconnect();
    }
    await setupDictionaries(sdk);
};

main();
