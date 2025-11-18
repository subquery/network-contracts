import fs from 'node:fs';
import setup from './setup';
import { Wallet } from 'ethers';
import { ContractDeployment, CONTRACT_FACTORY, ProxyAdmin__factory } from '../src';
import { deployProxy, upgradeContract } from './deployContracts';
import { getLogger } from './logger';
import { UPGRADEBAL_CONTRACTS } from './contracts';

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

export async function upgradeDelegationPool({
    address,
    wallet,
    deployment,
}: {
    address: string;
    wallet: Wallet;
    deployment: ContractDeployment;
}) {
    const proxyAdmin = ProxyAdmin__factory.connect(deployment.child.ProxyAdmin.address, wallet);

    logger.info(`Upgrading delegationPool`);

    const [, factory] = UPGRADEBAL_CONTRACTS['DelegationPool'];

    const [implAddress] = await upgradeContract(proxyAdmin, address, factory, wallet, 1, false);

    logger.info(`Implementation deployed to ${implAddress}`);

    logger.info(`🚀 DelegationPool upgraded`);
}

async function run() {
    const { name, wallet, target, childProvider } = await setup();

    if (target !== 'child') {
        throw new Error(`Invalid target specified: ${target}`);
    }

    const filePath = `${__dirname}/../publish/${name}.json`;
    const deployment = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));

    const connectedWallet = wallet.connect(childProvider);

    if (process.env.DELEGATION_POOL_ADDRESS) {
        await upgradeDelegationPool({
            address: process.env.DELEGATION_POOL_ADDRESS,
            wallet: connectedWallet,
            deployment,
        });
    } else {
        await deployDelegationPool({
            wallet: connectedWallet,
            deployment,
        });
    }
}

run();
