import {calcEthereumTransactionParams, EvmRpcProvider} from '@acala-network/eth-providers';
import {Overrides, providers, utils, Wallet} from 'ethers';
import dotenv from 'dotenv';
import moduleAlias from 'module-alias';
import {AcalaDeploymentConfig, DeploymentConfig, MoonbeamDeploymentConfig} from '../src/types';
import assert from 'assert';

dotenv.config();
// nodejs doesn't understand rootDirs in tsconfig, use moduleAlias to workaround
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

const seed = process.env.SEED;

// Taken from https://github.com/AcalaNetwork/hardhat-tutorials/blob/a01d0121b4a2f61a6b96bd5f647aba5491d33525/EVM/utils/transactionHelper.js
async function txParams(provider: EvmRpcProvider) {
    const txFeePerGas = provider.api.consts.evm.txFeePerGas.toString();
    const storageByteDeposit = provider.api.consts.evm.storageDepositPerByte.toString();
    const blockNumber = await provider.getBlockNumber();

    const ethParams = calcEthereumTransactionParams({
        gasLimit: '31000000',
        validUntil: (blockNumber + 100).toString(),
        storageLimit: '64001',
        txFeePerGas,
        storageByteDeposit,
    });

    return {
        txGasPrice: ethParams.txGasPrice,
        txGasLimit: ethParams.txGasLimit,
    };
}

async function setupAcala({endpoint}: AcalaDeploymentConfig['network']) {
    assert(seed, 'Not found SEED in env');
    const hdNode = utils.HDNode.fromMnemonic(seed).derivePath("m/44'/60'/0'/0/0");
    const provider = EvmRpcProvider.from(process.env.SUBSTRATE ?? endpoint.substrate);
    const network = await provider.isReady();
    const ethProvider = new providers.StaticJsonRpcProvider(endpoint.eth, network);
    const wallet = new Wallet(hdNode, provider);

    console.log('WALLET ADDRESS', wallet.address);

    const {txGasLimit, txGasPrice} = await txParams(provider);
    const overrides: Overrides = {
        gasLimit: txGasLimit,
        gasPrice: txGasPrice,
        type: 0,
    };
    return {
        wallet,
        ethProvider,
        provider,
        overrides,
    };
}

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

const setup = async (networkConfig: DeploymentConfig['network']) => {
    if (networkConfig.platform === 'acala') {
        return setupAcala(networkConfig);
    } else if (networkConfig.platform === 'moonbeam') {
        return setupMoonbeam(networkConfig);
    } else {
        throw new Error(`platform ${(networkConfig as any).platform} not supported`);
    }
};

export default setup;
