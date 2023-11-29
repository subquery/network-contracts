import dotenv from 'dotenv';
import { providers, utils, Wallet } from 'ethers';

import moduleAlias from 'module-alias';
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import { DeploymentConfig, networks, SubqueryNetwork } from '../src';
import contractsConfig from './config/contracts.config';

dotenv.config();

const seed = process.env.SEED;
const privateKey = process.env.PK;

export const {argv} = yargs(hideBin(process.argv))
    .options({
        'network': {
            demandOption: false,
            describe: 'network',
            type: 'string',
            default: 'local',
        },
        'history':{
            type: 'boolean',
            describe: 'compare history deployment',
            default: true,
        },
        'check-only':{
            type: 'boolean',
            default: true,
        },
        'implementation-only':{
            type: 'boolean',
            describe: 'only deploy implementation contract',
            default: false,
        }
    });

async function setupCommon({ rpcUrls, chainId, chainName }: DeploymentConfig["network"]) {
    let wallet: Wallet;
    const provider = new providers.StaticJsonRpcProvider(rpcUrls[0], chainId ? {
        chainId: parseInt(chainId, 16),
        name: chainName
    }: undefined);
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

const setup = async () => {
    let config = { contracts: null, network: null };
    let name: SubqueryNetwork;
    let history = false;
    let checkOnly = false;
    let implementationOnly = false;

    switch (argv.network) {
        // TODO: can support more network type here like `testnet-base` | `testnet-ethereum`
        case 'mainnet':
            config.contracts = contractsConfig.mainnet;
            config.network = networks.polygon;
            break;
        case 'kepler':
            config.contracts = contractsConfig.kepler;
            config.network = networks.polygon;
            break;
        case 'testnet':
            config.contracts = contractsConfig.testnet;
            config.network = networks.mumbai;
            break;
        default:
            config.contracts = contractsConfig.local;
            config.network = {rpcUrls: ['http://localhost:8545']};
    }
    name = argv.network as SubqueryNetwork;

    history = argv.history;
    checkOnly = argv["check-only"];
    implementationOnly = argv["implementation-only"];

    if (process.env.ENDPOINT) {
        console.log(`use overridden endpoint ${process.env.ENDPOINT}`);
        config.network.rpcUrls = [process.env.ENDPOINT];
    }

    let confirms = 1;
    if (['Polygon'].includes(config.network.chainName)) {
        confirms = 20;
    }
    const { wallet, provider, overrides } = await setupCommon(config.network);
    return { name, config, wallet, provider, overrides, confirms, history, checkOnly, implementationOnly }
};

export default setup;
