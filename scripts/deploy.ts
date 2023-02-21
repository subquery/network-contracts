import {writeFileSync} from 'fs';
import setup from './setup';
import {DeploymentConfig} from '../src/types';
import localConfig from './config/local.config';
import keplerConfig from './config/kepler.config';
import testnetConfig from './config/testnet.config';
import mainnetConfig from './config/mainnet.config';
import {deployContracts} from './deployContracts';
import moonbaseConfig from './config/moonbase.config';

const main = async () => {
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
        config.network.endpoint = process.env.ENDPOINT;
    }

    const {wallet, provider, overrides} = await setup(config.network);
    const [deployment] = await deployContracts(wallet, config.contracts, overrides, dev);

    const filePath = `${__dirname}/../publish/${config.network.name}.json`;
    writeFileSync(filePath, JSON.stringify(deployment, null, 4));
    console.log('Exported the deployment result to ', filePath);

    if ((provider as EvmRpcProvider).api) {
        await (provider as EvmRpcProvider).api.disconnect();
    }
};

main();
