import {providers, utils, Wallet} from 'ethers';
import dotenv from 'dotenv';
import moduleAlias from 'module-alias';
import assert from 'assert';

import contractsConfig from './config/contracts.config';
import {networks, DeploymentConfig, SubqueryNetwork} from '../src'

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
        overrides: {gasPrice: await provider.getGasPrice()},
    };
}

const setup = async (argv) => {
    let config = { contracts: null, network: null };
    let name: SubqueryNetwork;
    let hisotry = false;

    switch (argv[2]) {
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

    if (argv[3] === '--hisotry') hisotry = true;

    if (process.env.ENDPOINT) {
        console.log(`use overridden endpoint ${process.env.ENDPOINT}`);
        config.network.rpcUrls = [process.env.ENDPOINT];
    }

    if (['Mumbai', 'Hardaht', 'Moonbase-alpha'].includes(config.network.chainName)) {
        const {wallet, provider, overrides} =  await setupCommon(config.network);
        const confirms = 1;
        return {name, config, wallet, provider, overrides, confirms, hisotry}
    } else if(['Polygon'].includes(config.network.chainName)){
        const {wallet, provider, overrides} =  await setupCommon(config.network);
        const confirms = 20
        return {name, config, wallet, provider, overrides, confirms, hisotry}
    }
    else {
        throw new Error(`Network ${config.network.chainName} not supported`);
    }
};

export default setup;
