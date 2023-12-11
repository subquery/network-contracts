import dotenv from 'dotenv';
import { providers, utils, Wallet } from 'ethers';

import moduleAlias from 'module-alias';
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import { networks, SubqueryNetwork, NetworkPair} from '../src';
import contractsConfig from './config/contracts.config';
import {ContractConfig} from "./contracts";

dotenv.config();

const seed = process.env.SEED;
const privateKey = process.env.PK;

export const {argv} = yargs(hideBin(process.argv))
    .options({
        'network': {
            demandOption: true,
            describe: 'network',
            type: 'string',
            choices: ['testnet', 'mainnet'],
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
        },
        'target':{
            type: 'string',
            choices: ['root','child'],
            demandOption: true,

        }
    });

export async function setupCommon(pair: NetworkPair) {
    let wallet: Wallet;

    const rootProvider = new providers.StaticJsonRpcProvider(pair.root.rpcUrls[0], pair.root.chainId ? {
        chainId: parseInt(pair.root.chainId, 16),
        name: pair.root.chainName
    }: undefined);
    const childProvider = new providers.StaticJsonRpcProvider(pair.child.rpcUrls[0], pair.child.chainId ? {
        chainId: parseInt(pair.child.chainId, 16),
        name: pair.child.chainName
    }: undefined);
    if (seed) {
        const hdNode = utils.HDNode.fromMnemonic(seed).derivePath("m/44'/60'/0'/0/0");
        wallet = new Wallet(hdNode);
    }else if (privateKey) {
        wallet = new Wallet(privateKey);
    } else {
        throw new Error('Not found SEED or PK in env');
    }
    console.log(`signer is ${wallet.address}`);
    return {
        wallet,
        rootProvider,
        childProvider,
        overrides: {},
    };
}

const setup = async (network?: string) => {
    let config:{network: NetworkPair, contracts: ContractConfig} = { contracts: null, network: null };
    let name: SubqueryNetwork;
    let history = false;
    let checkOnly = false;
    let implementationOnly = false;

    switch (network ?? argv.network) {
        case 'mainnet':
            config.contracts = contractsConfig.mainnet as any;
            config.network = networks.mainnet;
            break;
        case 'testnet':
            config.contracts = contractsConfig.testnet as any;
            config.network = networks.testnet;
            break;
        default:
            throw new Error('no network specified');
    }

    name = (argv.network ?? 'local') as SubqueryNetwork;

    history = argv.history;
    checkOnly = argv["check-only"];
    implementationOnly = argv["implementation-only"];

    if (process.env.ROOT_ENDPOINT) {
        console.log(`use overridden endpoint ${process.env.ROOT_ENDPOINT}`);
        config.network.root.rpcUrls = [process.env.ROOT_ENDPOINT];
    }
    if (process.env.CHILD_ENDPOINT) {
        console.log(`use overridden endpoint ${process.env.CHILD_ENDPOINT}`);
        config.network.root.rpcUrls = [process.env.CHILD_ENDPOINT];
    }

    let confirms = 1;
    if (['Polygon'].includes(config.network.child.chainName)) {
        confirms = 20;
    }
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(config.network);
    return { name, config, wallet, rootProvider, childProvider, overrides, confirms, history, checkOnly, implementationOnly, target: argv.target }
};

export default setup;
