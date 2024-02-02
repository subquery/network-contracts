import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import { Wallet } from '@ethersproject/wallet';
import { BaseContract, Contract, Overrides, constants } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import Pino from 'pino';
import sha256 from 'sha256';

import CONTRACTS from '../src/contracts';
import {
    ContractDeployment,
    ContractDeploymentInner,
    ContractName,
    FactoryContstructor,
    SQContracts,
    SubqueryNetwork,
} from '../src/types';
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
    RewardsDistributor,
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
    TransparentUpgradeableProxy__factory,
    TokenExchange,
    OpDestination,
    SQTGift,
    SQTRedeem,
    Airdropper,
    VTSQToken,
    RewardsBooster,
    StakingAllocation,
    AllocationMananger,
    L2SQToken,
} from '../src';
import { CONTRACT_FACTORY, Config, ContractConfig, Contracts, UPGRADEBAL_CONTRACTS } from './contracts';
import { l1StandardBridge } from './L1StandardBridge';

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
    // console.log(`gasprice: ${price.toString()}`)
    // price = price.add(15000000000); // add extra 15 gwei
    return { gasPrice: price, gasLimit: 3000000 };
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
    }
): Promise<T> {
    if (!deployment[target]) {
        deployment[target] = {} as unknown;
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
        contract = (await new CONTRACT_FACTORY[name](wallet).deploy(...deployConfig, overrides)) as T;
        logger?.info(`🔎 Tx hash: ${contract.deployTransaction.hash}`);
        await contract.deployTransaction.wait(confirms);
    }

    logger?.info(`🚀 Contract address: ${contract.address}`);

    if (initConfig) {
        logger?.info('🤞 Init contract');
        const defaultConfig = config[name] ?? [];
        const params = [...initConfig, ...defaultConfig];
        const overrides = await getOverrides();

        // @ts-expect-error type missing
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
    logger?.info(`🔎 Tx hash: contractLogic ${contractLogic.deployTransaction.hash}`);
    await contractLogic.deployTransaction.wait(confirms);

    const transparentUpgradeableProxyFactory = new TransparentUpgradeableProxy__factory(wallet);

    const contractProxy = await transparentUpgradeableProxyFactory.deploy(
        contractLogic.address,
        proxyAdmin.address,
        [],
        await getOverrides()
    );
    logger?.info(`🔎 Tx hash: contractProxy ${contractProxy.deployTransaction.hash}`);
    await contractProxy.deployTransaction.wait(confirms);

    const proxy = contractFactory.attach(contractProxy.address) as C;
    // @ts-expect-error type missing
    proxy.deployTransaction = contractLogic.deployTransaction;
    return [proxy, contractLogic.address];
};

function updateDeployment(
    deployment: Partial<ContractDeployment>,
    name: ContractName,
    contract: Contract,
    innerAddr: string,
    target: 'root' | 'child'
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
    logger = network === 'local' ? undefined : getLogger('Deployer');

    if (options?.history) {
        const localDeployment = loadDeployment(network);
        deployment = localDeployment;
    } else {
        clearObject(deployment);
    }

    try {
        const proxyAdmin = await deployContract<ProxyAdmin>('ProxyAdmin', 'root');
        logger?.info('🤞 ProxyAdmin');
        const settings = await deployContract<Settings>('Settings', 'root', { proxyAdmin, initConfig: [] });
        logger?.info('🤞 Settings');
        const settingsAddress = settings.address;

        // deploy SQToken contract
        const sqtToken = await deployContract<SQToken>('SQToken', 'root', {
            deployConfig: [constants.AddressZero, ...config['SQToken']],
        });
        logger?.info('🤞 SQToken');

        // deploy InflationController
        const inflationController = await deployContract<InflationController>('InflationController', 'root', {
            initConfig: [settingsAddress],
            proxyAdmin,
        });
        logger?.info('🤞 InflationController');
        // setup minter
        let tx = await sqtToken.setMinter(inflationController.address);
        await tx.wait(confirms);
        logger?.info('🤞 Set SQToken minter');

        // deploy VTSQToken
        const vtSQToken = await deployContract<VTSQToken>('VTSQToken', 'root', {
            deployConfig: [constants.AddressZero],
        });
        logger?.info('🤞 VTSQToken');

        //deploy vesting contract
        const vesting = await deployContract<Vesting>('Vesting', 'root', {
            deployConfig: [sqtToken.address, vtSQToken.address],
        });
        logger?.info('🤞 Vesting');

        // set vesting contract as the minter of vtSQToken
        tx = await vtSQToken.setMinter(vesting.address);
        await tx.wait(confirms);
        logger?.info('🤞 Set VTSQToken minter');

        let opDestination;
        if (network !== 'testnet-mumbai') {
            //deploy OpDestination contract
            opDestination = await deployContract<OpDestination>('OpDestination', 'root', {
                deployConfig: [
                    sqtToken.address,
                    deployment.child?.SQToken?.address ?? constants.AddressZero,
                    l1StandardBridge[network]?.address ?? constants.AddressZero,
                ],
            });

            logger?.info('🤞 OpDestination');
        }

        logger?.info('🤞 Set addresses');
        tx = await settings.setBatchAddress(
            [SQContracts.SQToken, SQContracts.InflationController, SQContracts.Vesting],
            [sqtToken.address, inflationController.address, vesting.address]
        );
        await tx.wait(confirms);

        // Register addresses on settings contract
        return [
            deployment,
            {
                inflationController,
                rootToken: sqtToken,
                vtSQToken,
                proxyAdmin,
                vesting,
                opDestination,
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
    options?: { network: SubqueryNetwork; confirms: number; history: boolean }
): Promise<[Partial<ContractDeployment>, Partial<Contracts>]> {
    wallet = _wallet;
    config = _config;
    confirms = options?.confirms ?? 1;
    network = options?.network ?? 'local';
    logger = network === 'local' ? undefined : getLogger('Child Deployer');

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
            sqtToken = await deployContract<L2SQToken>('L2SQToken', 'child', {
                deployConfig: [...config['L2SQToken']],
            });
        }
        // deploy VSQToken contract
        const vsqtToken = await deployContract<VSQToken>('VSQToken', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy Staking contract
        const staking = await deployContract<Staking>('Staking', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy StakingManager contract
        const stakingManager = await deployContract<StakingManager>('StakingManager', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy Era manager
        const eraManager = await deployContract<EraManager>('EraManager', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

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
        const serviceAgreementRegistry = await deployContract<ServiceAgreementRegistry>(
            'ServiceAgreementRegistry',
            'child',
            {
                proxyAdmin,
                initConfig: [settingsAddress, [planManager.address, purchaseOfferMarket.address]],
            }
        );

        const tokenExchange = await deployContract<TokenExchange>('TokenExchange', 'child', { initConfig: [] });

        // deploy RewardsDistributor contract
        const rewardsDistributor = await deployContract<RewardsDistributor>('RewardsDistributor', 'child', {
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

        // deploy PriceOracle contract
        const priceOracle = await deployContract<PriceOracle>('PriceOracle', 'child', {
            proxyAdmin,
            initConfig: [10, 3600],
        });

        // delpoy SQTGift (NFT) contract
        const sqtGift = await deployContract<SQTGift>('SQTGift', 'child', {
            proxyAdmin,
            initConfig: [],
        });

        // deploy SQTRedeem (NFT redeem) contract
        const sqtRedeem = await deployContract<SQTRedeem>('SQTRedeem', 'child', {
            proxyAdmin,
            initConfig: [sqtToken.address],
        });

        //deploy Airdropper contract
        const [settleDestination] = config['Airdropper'];
        const airdropper = await deployContract<Airdropper>('Airdropper', 'child', {
            deployConfig: [settleDestination],
        });

        // deploy rewardsBooster contract
        const rewardsBooster = await deployContract<RewardsBooster>('RewardsBooster', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy StakingAllocation contract
        const stakingAllocation = await deployContract<StakingAllocation>('StakingAllocation', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // deploy StakingAllocation contract
        const allocationManager = await deployContract<AllocationMananger>('AllocationManager', 'child', {
            proxyAdmin,
            initConfig: [settingsAddress],
        });

        // Register addresses on settings contract
        logger?.info('🤞 Set settings addresses');
        const txToken = await settings.setBatchAddress(
            [
                SQContracts.SQToken,
                SQContracts.Staking,
                SQContracts.StakingManager,
                SQContracts.RewardsDistributor,
                SQContracts.RewardsPool,
                SQContracts.RewardsStaking,
                SQContracts.RewardsHelper,
                SQContracts.PriceOracle,
                SQContracts.IndexerRegistry,
                SQContracts.ProjectRegistry,
                SQContracts.EraManager,
                SQContracts.PlanManager,
                SQContracts.ServiceAgreementRegistry,
                SQContracts.DisputeManager,
                SQContracts.StateChannel,
                SQContracts.ConsumerRegistry,
                SQContracts.RewardsBooster,
                SQContracts.StakingAllocation,
                SQContracts.AllocationMananger,
            ],
            [
                sqtToken.address,
                staking.address,
                stakingManager.address,
                rewardsDistributor.address,
                rewardsPool.address,
                rewardsStaking.address,
                rewardsHelper.address,
                priceOracle.address,
                indexerRegistry.address,
                projectRegistry.address,
                eraManager.address,
                planManager.address,
                serviceAgreementRegistry.address,
                disputeManager.address,
                stateChannel.address,
                consumerRegistry.address,
                rewardsBooster.address,
                stakingAllocation.address,
                allocationManager.address,
            ]
        );

        await txToken.wait(confirms);
        logger?.info('🚀  Set settings success');

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
                rewardsDistributor,
                rewardsPool,
                rewardsStaking,
                rewardsHelper,
                rewardsBooster,
                proxyAdmin,
                stateChannel,
                consumerHost,
                disputeManager,
                tokenExchange,
                priceOracle,
                consumerRegistry,
                sqtGift,
                sqtRedeem,
                airdropper,
                stakingAllocation,
                allocationManager,
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
    wallet: Wallet;
    deployment: ContractDeployment;
    confirms: number;
    checkOnly: boolean;
    implementationOnly: boolean;
    target: string;
    matcher: string;
    network: SubqueryNetwork;
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
    } else if (target === 'child') {
        _deployment = deployment.child;
        proxyAdmin = ProxyAdmin__factory.connect(deployment.child.ProxyAdmin.address, wallet);
    }

    const changed: (keyof typeof CONTRACTS)[] = [];
    for (const contract of Object.keys(UPGRADEBAL_CONTRACTS)) {
        if (matcher && !contract.startsWith(matcher)) {
            continue;
        }
        const bytecodeHash = codeToHash(CONTRACTS[contract].bytecode);
        if (_deployment[contract] && bytecodeHash !== _deployment[contract].bytecodeHash) {
            changed.push(contract as unknown as keyof typeof CONTRACTS);
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
        const [innerAddr] = await upgradeContract(proxyAdmin, address, factory, wallet, confirms, implementationOnly);
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
