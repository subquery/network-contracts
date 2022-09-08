import setup from './setup';
import {DeploymentConfig} from '../src/types';
import localConfig from './config/local.config';
import keplerConfig from './config/kepler.config';
import testnetConfig from './config/testnet.config';
import mainnetConfig from './config/mainnet.config';
import {EvmRpcProvider} from '@acala-network/eth-providers';
import moonbaseConfig from './config/moonbase.config';
import {ContractSDK} from '@subql/contract-sdk';
import deployment from '@subql/contract-sdk/publish/moonbase.json';
import {METADATA_HASH} from '../test/constants';

const main = async () => {
    let config: DeploymentConfig;
    let dev = true;
    let usdcAddress;
    let futureTime;
    let startTime;
    let endTime;

    switch (process.argv[2]) {
        case '--mainnet':
            config = mainnetConfig as DeploymentConfig;
            dev = false;
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

    //Create Airdrop rounds
    await sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime);

    //Create pair orders for exchange contract
    await sdk.permissionedExchange.createPairOrders(
        usdcAddress,
        sdk.sqToken.address,
        1000000,
        5000000000000000000,
        futureTime,
        100000000
    );

    //Create 5 plan templates
    await sdk.planManager.createPlanTemplate(10800, 10000, 10000, METADATA_HASH);
    await sdk.planManager.createPlanTemplate(1000, 100, 1000, METADATA_HASH);
    await sdk.planManager.createPlanTemplate(5000, 2000, 100, METADATA_HASH);
    await sdk.planManager.createPlanTemplate(30000, 5600, 863, METADATA_HASH);
    await sdk.planManager.createPlanTemplate(5630, 200, 567, METADATA_HASH);

    if ((provider as EvmRpcProvider).api) {
        await (provider as EvmRpcProvider).api.disconnect();
    }
};

main();
