import {providers, utils, Wallet} from 'ethers';
import dotenv from 'dotenv';
import moduleAlias from 'module-alias';
import assert from 'assert';

import contractsConfig from './config/contracts.config';
import {networks, DeploymentConfig} from '../src'

dotenv.config();
// nodejs doesn't understand rootDirs in tsconfig, use moduleAlias to workaround
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

const seed = process.env.SEED;

async function setupCommon({rpcUrls, chainId, chainName}: DeploymentConfig["network"]) {
    assert(seed, 'Not found SEED in env');
    const hdNode = utils.HDNode.fromMnemonic(seed).derivePath("m/44'/60'/0'/0/0");
    const provider = new providers.StaticJsonRpcProvider(rpcUrls[0], {chainId: parseInt(chainId,16), name: chainName});
    const wallet = new Wallet(hdNode, provider);
    return {
        wallet,
        provider,
        overrides: {},
    };
}

const setup = async (argv: string) => {
    let config = { contracts: null, network: null };
    let name;
    switch (argv) {
        case '--mainnet':
            config.contracts = contractsConfig.mainnet;
            config.network = networks.mainnet;
            name = "mainnet";
            break;
        case '--kepler':
            config.contracts = contractsConfig.kepler;
            config.network = networks.kepler;
            name = "kepler";
            break;
        case '--testnet':
            config.contracts = contractsConfig.testnet;
            config.network = networks.testnet;
            name = "testnet";
            break;
        default:
            config.contracts = contractsConfig.local;
            config.network = networks.local;
            name = "local";
    }

    if (process.env.ENDPOINT) {
        console.log(`use overridden endpoint ${process.env.ENDPOINT}`);
        config.network.rpcUrls = [process.env.ENDPOINT];
    }

    if (['Polygon', 'Mumbai', 'Hardaht', 'Moonbase-alpha'].includes(config.network.chainName)) {
        const {wallet, provider, overrides} =  await setupCommon(config.network);
        return {name, config, wallet, provider, overrides}
    } else {
        throw new Error(`Network ${config.network.chainName} not supported`);
    }
};

export default setup;
