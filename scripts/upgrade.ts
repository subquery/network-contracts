import fs, {writeFileSync} from 'fs';
import setup from './setup';
import {DeploymentConfig} from '../src/types';
import localConfig from './config/local.config';
import moonbeamConfig from './config/moonbeam.config';
import testnetConfig from './config/testnet.config';
import mainnetConfig from './config/mainnet.config';
import {EvmRpcProvider} from '@acala-network/eth-providers';
import {upgradeContracts} from './deployContracts';

const main = async () => {
    let config: DeploymentConfig;

    switch (process.argv[2]) {
        case '--mainnet':
            config = mainnetConfig as DeploymentConfig;
            break;
        case '--testnet':
            config = testnetConfig as DeploymentConfig;
            break;
        case '--moonbeam':
            config = moonbeamConfig as DeploymentConfig;
            break;
        default:
            config = localConfig();
    }
    if (process.env.ENDPOINT) {
        console.log(`use overiden endpoint ${process.env.ENDPOINT}`);
        if (config.network.platform === 'acala') {
            config.network.endpoint = { ...config.network.endpoint, eth: process.env.ENDPOINT };
        } else {
            config.network.endpoint = process.env.ENDPOINT;
        }
    }

    const {wallet, provider, overrides} = await setup(config.network);
    const filePath = `${__dirname}/../publish/${config.network.name}.json`;
    let deployment = JSON.parse(fs.readFileSync(filePath, {encoding: 'utf8'}));

    deployment = await upgradeContracts(wallet, deployment, config.contracts, overrides);

    writeFileSync(filePath, JSON.stringify(deployment, null, 4));
    console.log('Exported the deployment result to ', filePath);

    if ((provider as EvmRpcProvider).api) {
        await (provider as EvmRpcProvider).api.disconnect();
    }
};

main();
