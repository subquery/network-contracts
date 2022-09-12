import setup from './setup';
import {DeploymentConfig} from '../src/types';
import localConfig from './config/local.config';
import keplerConfig from './config/kepler.config';
import testnetConfig from './config/testnet.config';
import mainnetConfig from './config/mainnet.config';
import {EvmRpcProvider} from '@acala-network/eth-providers';
import moonbaseConfig from './config/moonbase.config';
import {ContractSDK} from '../src';
import deployment from '../publish/moonbase.json';
import {METADATA_HASH} from '../test/constants';

export async function setups(sdk) {
    const startTime = 1665503050;
    const endTime = 1668180003;
    const airdrops = [
        '0xEEd36C3DFEefB2D45372d72337CC48Bc97D119d4',
        '0x592C6A31df20DD24a7d33f5fe526730358337189',
        '0x9184cFF04fD32123db66329Ab50Bf176ece2e211',
        '0xFf60C1Efa7f0F10594229D8A68c312d7020E3478',
        '0xBDB9D4dC13c5E3E59B7fd69230c7F44f7170Ce02',
        '0x0421700EE1890d461353A54eAA481488f440A68f',
    ];
    const rounds = [0, 0, 0, 0, 0, 0];
    const amounts = [100, 200, 300, 400, 500, 600];

    await sdk.token.increaseAllowance(sdk.airdropper.address, 1000000);

    //Create Airdrop rounds
    await sdk.airdropper.createRound(await sdk.token.address, startTime, endTime);

    await sdk.airdropper.batchAirdrop(airdrops, rounds, amounts);

    //Create 5 plan templates
    await sdk.planManager.createPlanTemplate(10800, 10000, 10000, METADATA_HASH);
    await sdk.planManager.createPlanTemplate(1000, 100, 1000, METADATA_HASH);
    await sdk.planManager.createPlanTemplate(5000, 2000, 100, METADATA_HASH);
    await sdk.planManager.createPlanTemplate(30000, 5600, 863, METADATA_HASH);
    await sdk.planManager.createPlanTemplate(5630, 200, 567, METADATA_HASH);
}

const main = async () => {
    const usdcAddress = '0xF98bF104e268d7cBB7949029Fee874e3cd1db8fa';
    const futureTime = 1668180003;
    let config: DeploymentConfig;
    let dev = true;

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

    setups(sdk);

    //Create pair orders for exchange contract
    await sdk.permissionedExchange.createPairOrders(
        usdcAddress,
        sdk.sqToken.address,
        1000000,
        5000000000000000000,
        futureTime,
        100000000
    );

    if ((provider as EvmRpcProvider).api) {
        await (provider as EvmRpcProvider).api.disconnect();
    }
};

main();
