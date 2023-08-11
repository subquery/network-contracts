import { Wallet } from '@ethersproject/wallet';
import { BaseContract, Contract, Overrides } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import Pino from 'pino';
import sha256 from 'sha256';
import CONTRACTS from '../src/contracts';
import { ContractDeployment, ContractName } from '../src/types';
import { TextColor, colorText, getLogger } from './logger';

import { SubqueryNetwork } from '@subql/contract-sdk';
import {
    AdminUpgradeabilityProxy__factory,
    Airdropper,
    ConsumerHost,
    ConsumerRegistry,
    DisputeManager,
    EraManager,
    IndexerRegistry,
    InflationController,
    PermissionedExchange,
    PlanManager,
    ProxyAdmin,
    ProxyAdmin__factory,
    PurchaseOfferMarket,
    QueryRegistry,
    RewardsDistributer,
    RewardsHelper,
    RewardsPool,
    RewardsStaking,
    SQToken,
    ServiceAgreementRegistry,
    Settings,
    Staking,
    StakingManager,
    StateChannel,
    VSQToken,
    Vesting,
} from '../src';
import {
    CONTRACT_FACTORY,
    Config,
    ContractConfig,
    Contracts,
    FactoryContstructor,
    UPGRADEBAL_CONTRACTS,
} from './contracts';

let wallet: Wallet;
let network: SubqueryNetwork;
let logger: Pino.Logger;
let confirms: number;
let config: ContractConfig;
let deployment: Partial<ContractDeployment> = {};

function clearObject(obj: Record<string, unknown>) {
    const keys = Object.keys(obj);
    for (const key of keys) {
        delete obj[key];
    }
}

function codeToHash(code: string) {
    return sha256(Buffer.from(code.replace(/^0x/, ''), 'hex'));
}

async function getOverrides(): Promise<Overrides> {
    const price = await wallet.provider.getGasPrice();
    const gasPrice = price.add(20000000000); // add extra 15 gwei
    return { gasPrice };
}

export function saveDeployment(name: string, deployment: Partial<ContractDeployment>) {
    const filePath = `${__dirname}/../publish/${name}.json`;
    writeFileSync(filePath, JSON.stringify(deployment, null, 4));
    getLogger('Save Deployment').info(`Exported deployment of network ${name} result to ${filePath}`);
}

function loadDeployment(name: string) {
    const filePath = `${__dirname}/../publish/${name}.json`;
    const deployment = JSON.parse(readFileSync(filePath, 'utf8'));
    getLogger('Load Deployments').info(`Load deployment for network: ${name} from ${filePath}:`);

    return deployment;
}

async function deployContract<T extends BaseContract>(
    name: ContractName,
    options?: {
        proxyAdmin?: ProxyAdmin;
        initConfig?: (string | string[])[];
        deployConfig?: Config[];
    }
): Promise<T> {
    if (network !== 'local') logger = getLogger(name);

    const contractAddress = deployment[name]?.address;
    if (contractAddress) {
        logger?.info(`🎃 Contract ${name} already deployed at ${contractAddress}`);
        return CONTRACT_FACTORY[name].connect(contractAddress, wallet) as T;
    }

    logger?.info('🤞 Deploying contract');

    let contract: T;
    let innerAddress = '';
    const { proxyAdmin, initConfig } = options ?? {};
    const deployConfig = options?.deployConfig ?? [];

    if (proxyAdmin) {
        [contract, innerAddress] = await deployProxy<T>(proxyAdmin, CONTRACT_FACTORY[name], wallet, confirms);
    } else {
        const overrides = await getOverrides();
        contract = (await new CONTRACT_FACTORY[name](wallet).deploy(...deployConfig, overrides)) as T;
        await contract.deployTransaction.wait(confirms);
        logger?.info(`🔎 Tx hash: ${contract.deployTransaction.hash}`);
    }

    logger?.info(`🚀 Contract address: ${contract.address}`);

    if (initConfig) {
        logger?.info('🤞 Init contract');
        const defaultConfig = config[name] ?? [];
        const params = [...initConfig, ...defaultConfig];
        const overrides = await getOverrides();

        // @ts-ignore
        const tx = await contract.initialize(...params, overrides);
        logger?.info(`🔎 Tx hash: ${tx.hash}`);
        await tx.wait(confirms);
        logger?.info(`🚀 Contract initialized`);
    }

    updateDeployment(deployment, name, contract, innerAddress);

    return contract;
}

export const deployProxy = async <C extends Contract>(
    proxyAdmin: ProxyAdmin,
    ContractFactory: FactoryContstructor,
    wallet: Wallet,
    confirms: number
): Promise<[C, string]> => {
    const contractFactory = new ContractFactory(wallet);
    let contractLogic = await contractFactory.deploy(await getOverrides());
    await contractLogic.deployTransaction.wait(confirms);

    const adminUpgradabilityProxyFactory = new AdminUpgradeabilityProxy__factory(wallet);

    const contractProxy = await adminUpgradabilityProxyFactory.deploy(
        contractLogic.address,
        proxyAdmin.address,
        [],
        await getOverrides()
    );
    await contractProxy.deployTransaction.wait(confirms);

    const proxy = contractFactory.attach(contractProxy.address) as C;
    (proxy as any).deployTransaction = contractLogic.deployTransaction;
    return [proxy, contractLogic.address];
};

function updateDeployment(
    deployment: Partial<ContractDeployment>,
    name: ContractName,
    contract: Contract,
    innerAddr: string
) {
    const address = contract.address;
    const txHash = contract.deployTransaction.hash;
    if (process.env.DEPLOY_PRINT === 'true') {
        console.log(`${name} ${contract.address} deployed at tx ${txHash}`);
    }

    deployment[name] = {
        innerAddress: innerAddr,
        address,
        bytecodeHash: codeToHash(CONTRACTS[name].bytecode),
        lastUpdate: new Date().toUTCString(),
    };
}

export async function deployContracts(
    _wallet: Wallet,
    _config: ContractConfig,
    options?: { network: SubqueryNetwork; confirms: number; history: boolean }
): Promise<[Partial<ContractDeployment>, Contracts]> {
    wallet = _wallet;
    config = _config;
    confirms = options?.confirms ?? 1;
    network = options?.network ?? 'local';

    if (network !== 'local')
        getLogger('Wallet').info(colorText(`Deploy with wallet ${wallet.address}`, TextColor.GREEN));
    if (options?.history) {
        const localDeployment = loadDeployment(network);
        deployment = localDeployment;
    } else {
        clearObject(deployment);
    }

    try {
        const proxyAdmin = await deployContract<ProxyAdmin>('ProxyAdmin');

        const settings = await deployContract<Settings>('Settings');

        const settingsAddress = settings.address;
        const inflationController = await deployContract<InflationController>('InflationController', {
            initConfig: [settingsAddress],
            proxyAdmin,
        });

        // deploy SQToken contract
        const sqtToken = await deployContract<SQToken>('SQToken', {
            deployConfig: [inflationController.address, ...config['SQToken']],
        });

        // deploy VSQToken contract
        const vsqtToken = await deployContract<VSQToken>('VSQToken', { initConfig: [settingsAddress] });

        //deploy Airdropper contract
        const [settleDestination] = config['Airdropper'];
        const airdropper = await deployContract<Airdropper>('Airdropper', { deployConfig: [settleDestination] });

        //deploy vesting contract
        const vesting = await deployContract<Vesting>('Vesting', { deployConfig: [deployment.SQToken.address] });

        // deploy Staking contract
        const staking = await deployContract<Staking>('Staking', { proxyAdmin, initConfig: [settingsAddress] });

        // deploy StakingManager contract
        const stakingManager = await deployContract<StakingManager>('StakingManager', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy Era manager
        const eraManager = await deployContract<EraManager>('EraManager', { proxyAdmin, initConfig: [settingsAddress] });

        // deploy IndexerRegistry contract
        const indexerRegistry = await deployContract<IndexerRegistry>('IndexerRegistry', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy QueryRegistry contract
        const queryRegistry = await deployContract<QueryRegistry>('QueryRegistry', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy PlanManager contract
        const planManager = await deployContract<PlanManager>('PlanManager', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy PurchaseOfferMarket contract
        const purchaseOfferMarket = await deployContract<PurchaseOfferMarket>('PurchaseOfferMarket', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy ServiceAgreementRegistry contract
        const serviceAgreementRegistry = await deployContract<ServiceAgreementRegistry>('ServiceAgreementRegistry', {
            proxyAdmin,
            initConfig: [settingsAddress, [planManager.address, purchaseOfferMarket.address]],
        });

        // deploy RewardsDistributer contract
        const rewardsDistributer = await deployContract<RewardsDistributer>('RewardsDistributer', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy RewardsPool contract
        const rewardsPool = await deployContract<RewardsPool>('RewardsPool', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy RewardsStaking contract
        const rewardsStaking = await deployContract<RewardsStaking>('RewardsStaking', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy RewardsHelper contract
        const rewardsHelper = await deployContract<RewardsHelper>('RewardsHelper', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy stateChannel contract
        const stateChannel = await deployContract<StateChannel>('StateChannel', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy PermissionedExchange contract
        const permissionedExchange = await deployContract<PermissionedExchange>('PermissionedExchange', {
            proxyAdmin,
            initConfig: [settingsAddress, [rewardsDistributer.address]],
        });

        // deploy ConsumerHost contract
        const consumerHost = await deployContract<ConsumerHost>('ConsumerHost', {
            proxyAdmin,
            initConfig: [settingsAddress, sqtToken.address, stateChannel.address],
        });

        // deploy DisputeManager contract
        const disputeManager = await deployContract<DisputeManager>('DisputeManager', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy ConsumerRegistry contract
        const consumerRegistry = await deployContract<ConsumerRegistry>('ConsumerRegistry', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // Register addresses on settings contract
        getLogger('SettingContract').info('🤞 Set token addresses');
        const txToken = await settings.setTokenAddresses(
            deployment.SQToken.address,
            deployment.Staking.address,
            deployment.StakingManager.address,
            deployment.RewardsDistributer.address,
            deployment.RewardsPool.address,
            deployment.RewardsStaking.address,
            deployment.RewardsHelper.address,
            deployment.InflationController.address,
            deployment.Vesting.address,
            deployment.PermissionedExchange.address,
            await getOverrides()
        );

        await txToken.wait(confirms);
        getLogger('SettingContract').info('🚀  Set token addresses success');

        getLogger('SettingContract').info('🤞 Set project addresses');
        const txProject = await settings.setProjectAddresses(
            deployment.IndexerRegistry.address,
            deployment.QueryRegistry.address,
            deployment.EraManager.address,
            deployment.PlanManager.address,
            deployment.ServiceAgreementRegistry.address,
            deployment.DisputeManager.address,
            deployment.StateChannel.address,
            deployment.ConsumerRegistry.address,
            await getOverrides()
        );

        await txProject.wait(confirms);
        getLogger('SettingContract').info('🚀  Set project addresses success');

        return [
            deployment,
            {
                settings,
                inflationController,
                token: sqtToken,
                vtoken: vsqtToken,
                staking,
                stakingManager,
                eraManager,
                indexerRegistry,
                queryRegistry,
                planManager,
                purchaseOfferMarket,
                serviceAgreementRegistry,
                rewardsDistributer,
                rewardsPool,
                rewardsStaking,
                rewardsHelper,
                proxyAdmin,
                stateChannel,
                airdropper,
                permissionedExchange,
                vesting,
                consumerHost,
                disputeManager,
                consumerRegistry,
            },
        ];
    } catch (error) {
        getLogger('ContractDeployment').info(`Failed to deploy contracts: ${JSON.stringify(error)}`);
        saveDeployment(network, deployment);
    }
}

export const upgradeContract = async (
    proxyAdmin: ProxyAdmin,
    proxyAddress: string,
    ContractFactory: FactoryContstructor,
    _wallet: Wallet,
    confirms: number
): Promise<[string, Contract]> => {
    wallet = _wallet;
    const contractFactory = new ContractFactory(wallet);
    const contract = await contractFactory.deploy(await getOverrides());
    await contract.deployTransaction.wait(confirms);

    const tx = await proxyAdmin.upgrade(proxyAddress, contract.address);
    await tx.wait(confirms);

    return [contract.address, contract];
};

export async function upgradeContracts(
    _wallet: Wallet,
    deployment: ContractDeployment,
    confirms: number
): Promise<ContractDeployment> {
    wallet = _wallet;
    const logger = getLogger('Upgrade Contract');
    logger.info(`Upgrade contrqact with wallet ${wallet.address}`);

    const proxyAdmin = ProxyAdmin__factory.connect(deployment.ProxyAdmin.address, wallet);

    const changed: (keyof typeof CONTRACTS)[] = [];
    for (const contract of Object.keys(UPGRADEBAL_CONTRACTS)) {
        const bytecodeHash = codeToHash(CONTRACTS[contract].bytecode);
        if (bytecodeHash !== deployment[contract]?.bytecodeHash) {
            changed.push(contract as any);
        }
    }

    if (!changed.length) {
        logger.info('No Contracts Changed');
        return;
    }

    logger.info(`Contract Changed: ${changed.join(',')}`);
    for (const contractName of changed) {
        logger.info(`Upgrading ${contractName}`);

        const [_, factory] = UPGRADEBAL_CONTRACTS[contractName];
        if (!deployment[contractName]) {
            console.warn(`contract ${contractName} not deployed`);
            continue;
        }

        const { address } = deployment[contractName];
        const [innerAddr] = await upgradeContract(proxyAdmin, address, factory, wallet, confirms);
        deployment[contractName] = {
            innerAddress: innerAddr,
            address,
            bytecodeHash: codeToHash(CONTRACTS[contractName].bytecode),
            lastUpdate: new Date().toUTCString(),
        };
    }
    return deployment as ContractDeployment;
}
