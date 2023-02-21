import {Overrides, providers, utils, Wallet} from 'ethers';
import dotenv from 'dotenv';
import moduleAlias from 'module-alias';
import {DeploymentConfig, MoonbeamDeploymentConfig, HardhatDeploymentConfig} from '../src/types';
import assert from 'assert';

dotenv.config();
// nodejs doesn't understand rootDirs in tsconfig, use moduleAlias to workaround
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

const seed = process.env.SEED;

async function setupMoonbeam({endpoint, providerConfig}: MoonbeamDeploymentConfig['network']) {
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

async function setupHardhat({endpoint, providerConfig}: HardhatDeploymentConfig['network']) {
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

const setup = async (networkConfig: DeploymentConfig['network']) => {
    if (networkConfig.platform === 'moonbeam') {
        return setupMoonbeam(networkConfig);
    } else if (networkConfig.platform === 'hardhat') {
        return setupHardhat(networkConfig);
    } else {
        throw new Error(`platform ${(networkConfig as any).platform} not supported`);
    }
};

export default setup;
