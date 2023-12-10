import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import { Wallet } from '@ethersproject/wallet';
import { BaseContract, Contract, Overrides, constants } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import Pino from 'pino';
import sha256 from 'sha256';

import CONTRACTS from '../src/contracts';
import {ContractDeployment, ContractDeploymentInner, ContractName, SQContracts, SubqueryNetwork} from '../src/types';
import { getLogger } from './logger';

import {
    ConsumerHost,
    ConsumerRegistry,
    DisputeManager,
    EraManager,
    IndexerRegistry,
    InflationController,
    PlanManager,
    PriceOracle,
    ProjectRegistry,
    ProxyAdmin,
    ProxyAdmin__factory,
    PurchaseOfferMarket,
    RewardsDistributer,
    RewardsHelper,
    RewardsPool,
    RewardsStaking,
    SQToken,
    ServiceAgreementExtra,
    ServiceAgreementRegistry,
    Settings,
    Staking,
    StakingManager,
    StateChannel,
    VSQToken,
    Vesting,
    EventSyncRootTunnel, TransparentUpgradeableProxy__factory,
} from '../src';
import {
    CONTRACT_FACTORY,
    Config,
    ContractConfig,
    Contracts,
    FactoryContstructor,
    UPGRADEBAL_CONTRACTS,
} from './contracts';
import {ChildERC20__factory} from "../build";

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
    // const gasPrice = price.add(20000000000); // add extra 15 gwei
    return { gasPrice: price, gasLimit: 6000000 };
}

export function saveDeployment(name: string, deployment: Partial<ContractDeployment>) {
    const filePath = `${__dirname}/../publish/${name}.json`;
    writeFileSync(filePath, JSON.stringify(deployment, null, 4));
}

function loadDeployment(name: string) {
    const filePath = `${__dirname}/../publish/${name}.json`;
    const deployment = JSON.parse(readFileSync(filePath, 'utf8'));
    getLogger('Load Deployments').info(`Load deployment for network: ${name} from ${filePath}:`);

    return deployment;
}

async function deployContract<T extends BaseContract>(
    name: ContractName,
    target: 'root' | 'child',
    options?: {
        proxyAdmin?: ProxyAdmin;
        initConfig?: (string | number | string[])[];
        deployConfig?: Config[];
    },
): Promise<T> {
    if (!deployment[target]) {
        deployment[target] = {} as any;
    }
    const contractAddress = deployment[target][name]?.address;
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
        const f = CONTRACT_FACTORY[name]
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
    updateDeployment(deployment, name, contract, innerAddress, target);

    return contract;
}

export const deployProxy = async <C extends Contract>(
    proxyAdmin: ProxyAdmin,
    ContractFactory: FactoryContstructor,
    wallet: Wallet,
    confirms: number
): Promise<[C, string]> => {
    const contractFactory = new ContractFactory(wallet);
    const contractLogic = await contractFactory.deploy(await getOverrides());
    await contractLogic.deployTransaction.wait(confirms);

    const transparentUpgradeableProxyFactory = new TransparentUpgradeableProxy__factory(wallet);

    const contractProxy = await transparentUpgradeableProxyFactory.deploy(
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
    innerAddr: string,
    target: 'root'|'child',
) {
    const address = contract.address;
    const txHash = contract.deployTransaction.hash;
    if (process.env.DEPLOY_PRINT === 'true') {
        console.log(`${name} ${contract.address} deployed at tx ${txHash}`);
    }
    deployment[target][name] = {
        innerAddress: innerAddr,
        address,
        bytecodeHash: codeToHash(CONTRACTS[name].bytecode),
        lastUpdate: new Date().toUTCString(),
    };

    saveDeployment(network, deployment);
}

export async function deployRootContracts(
    _wallet: Wallet,
    _config: ContractConfig,
    options?: { network: SubqueryNetwork; confirms: number; history: boolean }
): Promise<[Partial<ContractDeployment>, Partial<Contracts>]> {
    wallet = _wallet;
    config = _config;
    confirms = options?.confirms ?? 1;
    network = options?.network ?? 'local';

    if (options?.history) {
        const localDeployment = loadDeployment(network);
        deployment = localDeployment;
    } else {
        clearObject(deployment);
    }

    try {
        const proxyAdmin = await deployContract<ProxyAdmin>('ProxyAdmin', 'root');
        getLogger('Deployer').info('🤞 ProxyAdmin');
        const settings = await deployContract<Settings>('Settings', 'root', { proxyAdmin, initConfig: [] });
        getLogger('Deployer').info('🤞 Settings');
        const settingsAddress = settings.address;

        // deploy SQToken contract
        const sqtToken = await deployContract<SQToken>('SQToken', 'root', {
            deployConfig: [constants.AddressZero, ...config['SQToken']],
        });
        getLogger('Deployer').info('🤞 SQToken');

        const inflationController = await deployContract<InflationController>('InflationController', 'root', {
            initConfig: [settingsAddress],
            proxyAdmin,
        });
        getLogger('Deployer').info('🤞 InflationController');

        // TODO: we don't need event sync contract anymore
        const eventSyncRootTunnel = await deployContract<EventSyncRootTunnel>('EventSyncRootTunnel', 'root', {
            deployConfig: [...config['EventSyncRootTunnel']],
        });
        getLogger('Deployer').info('🤞 EventSyncRootTunnel');

        //deploy vesting contract
        const vesting = await deployContract<Vesting>('Vesting', 'root', { deployConfig: [deployment.root.SQToken.address] });
        getLogger('Deployer').info('🤞 Vesting');

        getLogger('SettingContract').info('🤞 Set addresses');
        let tx = await settings.setBatchAddress([
            SQContracts.SQToken,
            SQContracts.InflationController,
            SQContracts.EventSyncRootTunnel,
            SQContracts.Vesting,
        ],[
            sqtToken.address,
            inflationController.address,
            eventSyncRootTunnel.address,
            vesting.address
        ]);
        await tx.wait(confirms);


        // Register addresses on settings contract
        return [
            deployment,
            {
                inflationController,
                rootToken: sqtToken,
                proxyAdmin,
                eventSyncRootTunnel,
                vesting,
            },
        ];
    } catch (error) {
        getLogger('ContractDeployment').info(`Failed to deploy contracts: ${JSON.stringify(error)}`);
        saveDeployment(network, deployment);
    }
}

export async function deployContracts(
    _wallet: Wallet,
    _config: ContractConfig,
    options?: { network: SubqueryNetwork; confirms: number; history: boolean, test: boolean }
): Promise<[Partial<ContractDeployment>, Partial<Contracts>]> {
    wallet = _wallet;
    config = _config;
    confirms = options?.confirms ?? 1;
    network = options?.network ?? 'local';

    if (options?.history) {
        const localDeployment = loadDeployment(network);
        deployment = localDeployment;
    } else {
        clearObject(deployment);
    }

    try {
        const proxyAdmin = await deployContract<ProxyAdmin>('ProxyAdmin', 'child');

        const settings = await deployContract<Settings>('Settings', 'child', { proxyAdmin, initConfig: [] });
        const settingsAddress = settings.address;

        // We don't need to deploy ChildErc20, polygon team will do it for us when we request tokenMapping
        // deploy SQToken contract
        let sqtToken;
        if (network === 'local') {
            sqtToken = await deployContract<SQToken>('SQToken', 'child', {
                deployConfig: [...config['SQToken']],
            });
        } else {
            sqtToken = ChildERC20__factory.connect(deployment.child.SQToken.address, wallet);
        }
        // deploy VSQToken contract
        const vsqtToken = await deployContract<VSQToken>('VSQToken', 'child', { proxyAdmin, initConfig: [settingsAddress] });

        //deploy vesting contract
        // const vesting = await deployContract<Vesting>('Vesting', { deployConfig: [deployment.SQToken.address] });

        // deploy Staking contract
        const staking = await deployContract<Staking>('Staking', 'child', { proxyAdmin, initConfig: [settingsAddress] });

        // deploy StakingManager contract
        const stakingManager = await deployContract<StakingManager>('StakingManager', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy Era manager
        const eraManager = await deployContract<EraManager>('EraManager', 'child', { proxyAdmin, initConfig: [settingsAddress] });

        // deploy IndexerRegistry contract
        const indexerRegistry = await deployContract<IndexerRegistry>('IndexerRegistry', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy ProjectRegistry contract
        const projectRegistry = await deployContract<ProjectRegistry>('ProjectRegistry', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy PlanManager contract
        const planManager = await deployContract<PlanManager>('PlanManager', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy PurchaseOfferMarket contract
        const purchaseOfferMarket = await deployContract<PurchaseOfferMarket>('PurchaseOfferMarket', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy ServiceAgreementRegistry contract
        const serviceAgreementRegistry = await deployContract<ServiceAgreementRegistry>('ServiceAgreementRegistry', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress, [planManager.address, purchaseOfferMarket.address]],
        });

        const serviceAgreementExtra = await deployContract<ServiceAgreementExtra>('ServiceAgreementExtra', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy RewardsDistributer contract
        const rewardsDistributer = await deployContract<RewardsDistributer>('RewardsDistributer', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy RewardsPool contract
        const rewardsPool = await deployContract<RewardsPool>('RewardsPool', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy RewardsStaking contract
        const rewardsStaking = await deployContract<RewardsStaking>('RewardsStaking', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy RewardsHelper contract
        const rewardsHelper = await deployContract<RewardsHelper>('RewardsHelper', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy stateChannel contract
        const stateChannel = await deployContract<StateChannel>('StateChannel', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy ConsumerHost contract
        const consumerHost = await deployContract<ConsumerHost>('ConsumerHost', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress, sqtToken.address, stateChannel.address],
        });

        // deploy DisputeManager contract
        const disputeManager = await deployContract<DisputeManager>('DisputeManager', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy ConsumerRegistry contract
        const consumerRegistry = await deployContract<ConsumerRegistry>('ConsumerRegistry', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // delpoy PriceOracle contract
        const priceOracle = await deployContract<PriceOracle>('PriceOracle', 'child', {
            proxyAdmin,
            initConfig: [10, 3600],
        });

        // Register addresses on settings contract
        getLogger('SettingContract').info('🤞 Set token addresses');
        const txToken = await settings.setBatchAddress([
            SQContracts.SQToken,
            SQContracts.Staking,
            SQContracts.StakingManager,
            SQContracts.RewardsDistributer,
            SQContracts.RewardsPool,
            SQContracts.RewardsStaking,
            SQContracts.RewardsHelper,
            SQContracts.PriceOracle,
            SQContracts.IndexerRegistry,
            SQContracts.ProjectRegistry,
            SQContracts.EraManager,
            SQContracts.PlanManager,
            SQContracts.ServiceAgreementRegistry,
            SQContracts.ServiceAgreementExtra,
            SQContracts.DisputeManager,
            SQContracts.StateChannel,
            SQContracts.ConsumerRegistry,
        ],[
            sqtToken.address,
            staking.address,
            stakingManager.address,
            rewardsDistributer.address,
            rewardsPool.address,
            rewardsStaking.address,
            rewardsHelper.address,
            priceOracle.address,
            indexerRegistry.address,
            projectRegistry.address,
            eraManager.address,
            planManager.address,
            serviceAgreementRegistry.address,
            serviceAgreementExtra.address,
            disputeManager.address,
            stateChannel.address,
            consumerHost.address,
        ]);

        await txToken.wait(confirms);
        getLogger('SettingContract').info('🚀  Set settings success');

        return [
            deployment,
            {
                settings,
                token: sqtToken,
                vtoken: vsqtToken,
                staking,
                stakingManager,
                eraManager,
                indexerRegistry,
                projectRegistry,
                planManager,
                purchaseOfferMarket,
                serviceAgreementRegistry,
                serviceAgreementExtra,
                rewardsDistributer,
                rewardsPool,
                rewardsStaking,
                rewardsHelper,
                proxyAdmin,
                stateChannel,
                consumerHost,
                disputeManager,
                priceOracle,
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
    confirms: number,
    implementationOnly: boolean
): Promise<[string, Contract]> => {
    wallet = _wallet;
    const contractFactory = new ContractFactory(wallet);
    const contract = await contractFactory.deploy(await getOverrides());
    await contract.deployTransaction.wait(confirms);

    if (!implementationOnly) {
        const tx = await proxyAdmin.upgrade(proxyAddress, contract.address);
        await tx.wait(confirms);
    }

    return [contract.address, contract];
};

export async function upgradeContracts(configs: {
    wallet: Wallet,
    deployment: ContractDeployment,
    confirms: number,
    checkOnly: boolean,
    implementationOnly: boolean,
    target: string,
    matcher: string,
    network: SubqueryNetwork,
}): Promise<ContractDeployment> {
    const { deployment, confirms, checkOnly, implementationOnly, target, matcher } = configs;
    wallet = configs.wallet;
    network = configs.network;

    const logger = getLogger('Upgrade Contract');
    logger.info(`Upgrade contract with wallet ${wallet.address}`);
    let _deployment: ContractDeploymentInner;
    let proxyAdmin: ProxyAdmin;
    if (target === 'root') {
        _deployment = deployment.root;
        proxyAdmin = ProxyAdmin__factory.connect(deployment.root.ProxyAdmin.address, wallet);
    } else if (target=== 'child') {
        _deployment = deployment.child
        proxyAdmin = ProxyAdmin__factory.connect(deployment.child.ProxyAdmin.address, wallet);
    }

    const changed: (keyof typeof CONTRACTS)[] = [];
    for (const contract of Object.keys(UPGRADEBAL_CONTRACTS)) {
        if (matcher && !contract.startsWith(matcher)) {
            continue;
        }
        const bytecodeHash = codeToHash(CONTRACTS[contract].bytecode);
        if (_deployment[contract] && bytecodeHash !== _deployment[contract].bytecodeHash) {
            changed.push(contract as any);
        } else {
            logger.info(`Contract ${contract} not changed`);
        }
    }

    if (!changed.length) {
        logger.info('No Contracts Changed');
        return;
    }

    logger.info(`Contract Changed: ${changed.join(',')}`);
    if (checkOnly) return deployment;


    for (const contractName of changed) {
        const [_, factory] = UPGRADEBAL_CONTRACTS[contractName];
        if (!_deployment[contractName]) {
            console.warn(`contract ${contractName} not deployed`);
            continue;
        }

        logger.info(`Upgrading ${contractName}`);
        const { address } = _deployment[contractName];
        const [innerAddr] = await upgradeContract(
            proxyAdmin,
            address,
            factory,
            wallet,
            confirms,
            implementationOnly
        );
        _deployment[contractName] = {
            innerAddress: innerAddr,
            address,
            bytecodeHash: codeToHash(CONTRACTS[contractName].bytecode),
            lastUpdate: new Date().toUTCString(),
        };
        saveDeployment(network, deployment);
    }
    return deployment;
}
