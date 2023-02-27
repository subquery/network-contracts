import {providers, utils, Wallet} from 'ethers';
import dotenv from 'dotenv';
import moduleAlias from 'module-alias';
import assert from 'assert';

import mainnetConfig from './config/mainnet.config';
import keplerConfig from './config/kepler.config';
import testnetConfig from './config/testnet.config';
import localConfig from './config/local.config';
import {networks, DeploymentConfig} from '../src'

dotenv.config();
// nodejs doesn't understand rootDirs in tsconfig, use moduleAlias to workaround
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

const seed = process.env.SEED;

async function setupCommon({endpoint, providerConfig}: DeploymentConfig['network']) {
    assert(seed, 'Not found SEED in env');
    const hdNode = utils.HDNode.fromMnemonic(seed).derivePath("m/44'/60'/0'/0/0");
    const provider = new providers.StaticJsonRpcProvider(endpoint, providerConfig);
    const wallet = new Wallet(hdNode, provider);
    return {
        wallet,
        provider,
        overrides: {},
    };
}

const setup = async (argv: string) => {
    let config;

    switch (argv) {
        case '--mainnet':
            config = mainnetConfig;
            config.network = networks.mainnet;
            break;
        case '--kepler':
            config = keplerConfig;
            config.network = networks.kepler;
            break;
        case '--testnet':
            config = testnetConfig;
            config.network = networks.testnet;
            break;
        default:
            config = localConfig;
            config.network = networks.local;
    }

    if (process.env.ENDPOINT) {
        console.log(`use overridden endpoint ${process.env.ENDPOINT}`);
        config.network.endpoint = process.env.ENDPOINT;
    }

    if (config.network.platform === 'moonbeam' || config.network.platform === 'hardhat' || config.network.platform === 'polygon') {
        const {wallet, provider, overrides} =  await setupCommon(config.network);
        return {config, wallet, provider, overrides}
    } else {
        throw new Error(`platform ${config.network.platform} not supported`);
    }
};

export default setup;
