import assert from 'assert';
import dotenv from 'dotenv';
import { providers, utils, Wallet } from 'ethers';

import moduleAlias from 'module-alias';
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

import { DeploymentConfig, networks, SubqueryNetwork } from '../src';
import contractsConfig from './config/contracts.config';

dotenv.config();

const seed = process.env.SEED;
const privateKey = process.env.PK;

async function setupCommon({ rpcUrls, chainId, chainName }: DeploymentConfig["network"]) {
    let wallet: Wallet;
    const provider = new providers.StaticJsonRpcProvider(rpcUrls[0], {
        chainId: parseInt(chainId, 16),
        name: chainName
    });
    if (seed) {
        const hdNode = utils.HDNode.fromMnemonic(seed).derivePath("m/44'/60'/0'/0/0");
        wallet = new Wallet(hdNode, provider);
    }else if (privateKey) {
        wallet = new Wallet(privateKey, provider);
    } else {
        throw new Error('Not found SEED or PK in env');
    }
    console.log(`signer is ${wallet.address}`);
    return {
        wallet,
        provider,
        overrides: { gasPrice: await provider.getGasPrice() },
    };
}

const setup = async (argv) => {
    let config = { contracts: null, network: null };
    let name: SubqueryNetwork;
    let history = false;
    let checkOnly = false;
    let implementationOnly = false;

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

    if (argv[3] === '--history') history = true;
    if (argv[3] === '--check-only') checkOnly = true;
    if (argv[3] === '--implementation-only') implementationOnly = true;

    if (process.env.ENDPOINT) {
        console.log(`use overridden endpoint ${process.env.ENDPOINT}`);
        config.network.rpcUrls = [process.env.ENDPOINT];
    }

    if (['Mumbai', 'Hardaht', 'Moonbase-alpha'].includes(config.network.chainName)) {
        const { wallet, provider, overrides } = await setupCommon(config.network);
        const confirms = 1;
        return { name, config, wallet, provider, overrides, confirms, history, checkOnly, implementationOnly }
    } else if (['Polygon'].includes(config.network.chainName)) {
        const { wallet, provider, overrides } = await setupCommon(config.network);
        const confirms = 20
        return { name, config, wallet, provider, overrides, confirms, history, checkOnly, implementationOnly }
    }
    else {
        throw new Error(`Network ${config.network.chainName} not supported`);
    }
};

export default setup;
