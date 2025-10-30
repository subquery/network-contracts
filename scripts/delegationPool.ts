import fs from 'node:fs';
import setup from './setup';
import { Wallet } from 'ethers';
import { ContractDeployment, CONTRACT_FACTORY, ProxyAdmin__factory } from '../src';
import { deployProxy } from './deployContracts';
import { getLogger } from './logger';

const logger = getLogger('Delegation Pool Deployment');

export async function deployDelegationPool({ wallet, deployment }: { wallet: Wallet; deployment: ContractDeployment }) {
    const proxyAdmin = ProxyAdmin__factory.connect(deployment.child.ProxyAdmin.address, wallet);

    const confirms = 1;

    const [contract, innerAddress] = await deployProxy(proxyAdmin, CONTRACT_FACTORY.DelegationPool, wallet, confirms);

    logger.info(`🚀 Contract address: ${contract.address}`);

    const tx = await contract.initialize(deployment.child.Settings.address, 10000 /* 1% fee */);
    logger.info(`🔎 Tx hash: ${tx.hash}`);
    await tx.wait(confirms);
    logger.info(`🚀 Contract initialized`);

    return contract;
}

async function run() {
    const { name, wallet, target, childProvider } = await setup();

    if (target !== 'child') {
        throw new Error(`Invalid target specified: ${target}`);
    }

    const filePath = `${__dirname}/../publish/${name}.json`;
    const deployment = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));

    const connectedWallet = wallet.connect(childProvider);

    console.log('PROVIDER', connectedWallet.provider);

    await deployDelegationPool({
        wallet: connectedWallet,
        deployment,
    });
}

run();
