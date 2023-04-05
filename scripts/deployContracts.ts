import { BaseContract, ContractTransaction, Overrides } from 'ethers';
import {ContractFactory, Contract} from 'ethers';
import Pino from 'pino';
import sha256 from 'sha256';
import {Wallet} from '@ethersproject/wallet';
import CONTRACTS from '../src/contracts';
import {ContractDeployment, ContractName, DeploymentConfig} from '../src/types';
import { colorText, getLogger, TextColor } from './logger';

import {
    ProxyAdmin,
    ProxyAdmin__factory,
    AdminUpgradeabilityProxy__factory,
    InflationController__factory,
    Staking__factory,
    IndexerRegistry__factory,
    QueryRegistry__factory,
    InflationController,
    Staking,
    StakingManager,
    StakingManager__factory,
    Settings__factory,
    QueryRegistry,
    PlanManager__factory,
    SQToken__factory,
    ServiceAgreementRegistry__factory,
    ServiceAgreementRegistry,
    EraManager__factory,
    PurchaseOfferMarket__factory,
    Settings,
    SQToken,
    VSQToken,
    VSQToken__factory,
    EraManager,
    IndexerRegistry,
    PlanManager,
    PurchaseOfferMarket,
    RewardsDistributer,
    RewardsDistributer__factory,
    RewardsPool,
    RewardsPool__factory,
    RewardsStaking,
    RewardsStaking__factory,
    RewardsHelper,
    RewardsHelper__factory,
    StateChannel,
    StateChannel__factory,
    Airdropper,
    Airdropper__factory,
    PermissionedExchange,
    PermissionedExchange__factory,
    Vesting,
    Vesting__factory,
    ConsumerHost,
    ConsumerHost__factory,
    DisputeManager,
    DisputeManager__factory,
} from '../src';
import { Provider } from '@ethersproject/providers';
import { SubqueryNetwork } from '@subql/contract-sdk';

interface FactoryContstructor {
    new (wallet: Wallet): ContractFactory;
    readonly abi: any;
}

export type Contracts = {
    proxyAdmin: ProxyAdmin;
    settings: Settings;
    inflationController: InflationController;
    token: SQToken;
    vtoken: VSQToken;
    staking: Staking;
    stakingManager: StakingManager;
    eraManager: EraManager;
    indexerRegistry: IndexerRegistry;
    queryRegistry: QueryRegistry;
    planManager: PlanManager;
    purchaseOfferMarket: PurchaseOfferMarket;
    serviceAgreementRegistry: ServiceAgreementRegistry;
    rewardsDistributer: RewardsDistributer;
    rewardsPool: RewardsPool;
    rewardsStaking: RewardsStaking;
    rewardsHelper: RewardsHelper;
    stateChannel: StateChannel;
    airdropper: Airdropper;
    permissionedExchange: PermissionedExchange;
    vesting: Vesting;
    consumerHost: ConsumerHost;
    disputeManager: DisputeManager;
};

const UPGRADEBAL_CONTRACTS: Partial<Record<keyof typeof CONTRACTS, [{bytecode: string}, FactoryContstructor]>> = {
    InflationController: [CONTRACTS.InflationController, InflationController__factory],
    IndexerRegistry: [CONTRACTS.IndexerRegistry, IndexerRegistry__factory],
    PlanManager: [CONTRACTS.PlanManager, PlanManager__factory],
    QueryRegistry: [CONTRACTS.QueryRegistry, QueryRegistry__factory],
    RewardsDistributer: [CONTRACTS.RewardsDistributer, RewardsDistributer__factory],
    RewardsPool: [CONTRACTS.RewardsPool, RewardsPool__factory],
    RewardsStaking: [CONTRACTS.RewardsStaking, RewardsStaking__factory],
    RewardsHelper: [CONTRACTS.RewardsHelper, RewardsHelper__factory],
    ServiceAgreementRegistry: [CONTRACTS.ServiceAgreementRegistry, ServiceAgreementRegistry__factory],
    Staking: [CONTRACTS.Staking, Staking__factory],
    StakingManager: [CONTRACTS.StakingManager, StakingManager__factory],
    EraManager: [CONTRACTS.EraManager, EraManager__factory],
    PurchaseOfferMarket: [CONTRACTS.PurchaseOfferMarket, PurchaseOfferMarket__factory],
    StateChannel: [CONTRACTS.StateChannel, StateChannel__factory],

    PermissionedExchange: [CONTRACTS.PermissionedExchange, PermissionedExchange__factory],
    ConsumerHost: [CONTRACTS.ConsumerHost, ConsumerHost__factory],
    DisputeManager: [CONTRACTS.DisputeManager, DisputeManager__factory],
};

let provider: Provider;
let network: SubqueryNetwork;
let logger: Pino.Logger;
let confirms: number;

async function getOverrides(): Promise<Overrides> {
    const price = await provider.getGasPrice();
    const gasPrice = price.add(10000000000); // add extra 10 gwei
    return { gasPrice };
}

async function deployContract<T extends BaseContract>(
    name: ContractName, 
    deployFn: (name: ContractName, overrides: Overrides) => Promise<T>,
    initFn?: (name: ContractName,contract: T, overrides: Overrides) => Promise<ContractTransaction>
): Promise<T> {
    if (network !== 'local') logger = getLogger(name);

    logger?.info('🤞 Deploying contract');
    let overrides = await getOverrides();
    const contract = await deployFn(name, overrides);
    logger?.info(`🔎 Tx hash: ${contract.deployTransaction.hash}`);
    await contract.deployTransaction.wait(confirms);
    logger?.info(`🚀 Contract address: ${contract.address}`);

    if (!initFn) return contract;
      
    logger?.info('🤞 Init contract');
    overrides = await getOverrides();
    const tx = await initFn(name, contract, overrides);
    logger?.info(`🔎 Tx hash: ${tx.hash}`);
    await tx.wait(confirms);
    logger?.info(`🚀 Contract initialized`);

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
    innerAddr: string,
) {
    const address = contract.address;
    const txHash = contract.deployTransaction.hash;
    if (process.env.DEPLOY_PRINT === 'true') {
        console.log(`${name} ${contract.address} deployed at tx ${txHash}`);
    }

    deployment[name] = {
        innerAddress: innerAddr,
        address,
        bytecodeHash: sha256(Buffer.from(CONTRACTS[name].bytecode.replace(/^0x/, ''), 'hex')),
        lastUpdate: new Date().toUTCString(),
    };
}

export async function deployContracts(
    wallet: Wallet,
    config: DeploymentConfig['contracts'],
    options?: { network: SubqueryNetwork, confirms: number },
): Promise<[Partial<ContractDeployment>, Contracts]> {
    provider = wallet.provider;
    confirms = options?.confirms ?? 1;
    network = options?.network ?? 'local';

    if (network !== 'local') getLogger('Wallet').info(colorText(`Deploy with wallet ${wallet.address}`, TextColor.GREEN));
    const deployment: Partial<ContractDeployment> = {};

    const proxyAdmin = await deployContract<ProxyAdmin>('ProxyAdmin', async (name, overrides) => {
        const proxyAdmin = await new ProxyAdmin__factory(wallet).deploy(overrides);
        updateDeployment(deployment, name, proxyAdmin, '');
        return proxyAdmin;
    });

    const settings =  await deployContract<Settings>('Settings', async (name, overrides) => {
        const settings = await new Settings__factory(wallet).deploy(overrides);
        updateDeployment(deployment, name, settings, '');
        return settings;
    });

    const settingsAddress = settings.address;
    const inflationController = await deployContract<InflationController>(
        'InflationController', 
        async (name) => {
            const [inflationController, ICInnerAddr] = await deployProxy<InflationController>(
                proxyAdmin,
                InflationController__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, inflationController, ICInnerAddr);
            return inflationController;
        }, (name, contract, overrides) => {
            const [rate, destination] = config[name];
            return contract.initialize(
                settingsAddress,
                rate,
                destination,
                overrides
            );
        });

    // deploy SQToken contract
    const sqtToken = await deployContract<SQToken>('SQToken', async (name, overrides) => {
        const [totalSupply] = config[name];
        const sqtToken = await new SQToken__factory(wallet).deploy(
            deployment.InflationController.address, 
            totalSupply, 
            overrides
        );
        updateDeployment(deployment, name, sqtToken, '');
        return sqtToken;
    });

    // deploy VSQToken contract
    const vsqtToken = await deployContract<VSQToken>(
        'VSQToken',
        async (name, overrides) => {
            const vsqtToken = await new VSQToken__factory(wallet).deploy(overrides);
            updateDeployment(deployment, name, vsqtToken, '');
            return vsqtToken;
        }, (_, contract, overrides) => contract.initialize(settingsAddress, overrides)
    );

    //deploy Airdropper contract
    const airdropper = await deployContract<Airdropper>('Airdropper', async (name, overrides) => {
        const [settleDestination] = config[name];
        const airdropper = await new Airdropper__factory(wallet).deploy(settleDestination, overrides);
        updateDeployment(deployment, name, airdropper, '');
        return airdropper;
    });

    //deploy vesting contract
    const vesting = await deployContract<Vesting>('Vesting', async (name, overrides) => {
        const vesting = await new Vesting__factory(wallet).deploy(deployment.SQToken.address, overrides);
        updateDeployment(deployment, name, vesting, '');   
        return vesting;
    });

    // deploy Staking contract
    const staking = await deployContract<Staking>(
        'Staking', 
        async () => {
            const [staking, SInnerAddr] = await deployProxy<Staking>(proxyAdmin, Staking__factory, wallet, confirms);
            updateDeployment(deployment, 'Staking', staking, SInnerAddr);
            return staking;
        }, (name, contract, overrides) => {
            const [lockPeriod, unbondFeeRate] = config[name];
            return contract.initialize(settingsAddress, lockPeriod, unbondFeeRate, overrides);
        });

    // deploy StakingManager contract
    const stakingManager = await deployContract<StakingManager>(
        'StakingManager', 
        async (name) => {
            const [stakingManager, SMInnerAddr] = await deployProxy<StakingManager>(
                proxyAdmin,
                StakingManager__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, stakingManager, SMInnerAddr);
            return stakingManager;
        }, (_, contract, overrides) => contract.initialize(settingsAddress, overrides));

    // deploy Era manager
    const eraManager = await deployContract<EraManager>(
        'EraManager', 
        async (name) => {
            const [eraManager, EMInnerAddr] = await deployProxy<EraManager>(proxyAdmin, EraManager__factory, wallet, confirms);
            updateDeployment(deployment, name, eraManager, EMInnerAddr);
            return eraManager;
        }, (name, contract, overrides) => {
            const [eraPeriod] = config[name];
            return contract.initialize(settingsAddress, eraPeriod, overrides);
        });

    // deploy IndexerRegistry contract
    const indexerRegistry = await deployContract<IndexerRegistry>(
        'IndexerRegistry', 
        async (name) => {
            const [indexerRegistry, IRInnerAddr] = await deployProxy<IndexerRegistry>(
                proxyAdmin,
                IndexerRegistry__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, indexerRegistry, IRInnerAddr);
            return indexerRegistry;
        }, (name, contract, overrides) => {
            const [minStaking] = config[name];
            return contract.initialize(settingsAddress, minStaking, overrides);
        });

    // deploy QueryRegistry contract
    const queryRegistry = await deployContract<QueryRegistry>(
        'QueryRegistry', 
        async (name) => {
            const [queryRegistry, QRInnerAddr] = await deployProxy<QueryRegistry>(
                proxyAdmin,
                QueryRegistry__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, queryRegistry, QRInnerAddr);
            return queryRegistry;
        }, (_, contract, overrides) => contract.initialize(settingsAddress, overrides));

    // deploy PlanManager contract
    const planManager = await deployContract<PlanManager>(
        'PlanManager', 
        async (name) => {
            const [planManager, PMInnerAddr] = await deployProxy<PlanManager>(
                proxyAdmin,
                PlanManager__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, planManager, PMInnerAddr);
            return planManager;
        }, (_, contract, overrides) => contract.initialize(settingsAddress, overrides));

    
    // deploy PurchaseOfferMarket contract
    const purchaseOfferMarket = await deployContract<PurchaseOfferMarket>(
        'PurchaseOfferMarket', 
        async (name) => {
            const [purchaseOfferMarket, POMInnerAddr] = await deployProxy<PurchaseOfferMarket>(
                proxyAdmin,
                PurchaseOfferMarket__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, purchaseOfferMarket, POMInnerAddr);
            return purchaseOfferMarket;
        }, (name, contract, overrides) => {
            const [penalty, destination] = config[name];
            return contract.initialize(
                settingsAddress,
                penalty,
                destination,
                overrides
            );
        });

    const serviceAgreementRegistry = await deployContract<ServiceAgreementRegistry>(
        'ServiceAgreementRegistry', 
        async (name) => {
            const [serviceAgreementRegistry, SARInnerAddr] = await deployProxy<ServiceAgreementRegistry>(
                proxyAdmin,
                ServiceAgreementRegistry__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, serviceAgreementRegistry, SARInnerAddr);
            return serviceAgreementRegistry;
        }, (name, contract, overrides) => {
            const [threshold] = config[name];
            return contract.initialize(
                settingsAddress,
                threshold,
                [planManager.address, purchaseOfferMarket.address],
                overrides
            );
        });

    // deploy RewardsDistributer contract
    const rewardsDistributer = await deployContract<RewardsDistributer>(
        'RewardsDistributer', 
        async (name) => {
            const [rewardsDistributer, RDInnerAddr] = await deployProxy<RewardsDistributer>(
                proxyAdmin,
                RewardsDistributer__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, rewardsDistributer, RDInnerAddr);
            return rewardsDistributer;
        }, (_, contract, overrides) => contract.initialize(settingsAddress, overrides));

    // deploy RewardsPool contract
    const rewardsPool = await deployContract<RewardsPool>(
        'RewardsPool', 
        async (name) => {
            const [rewardsPool, RPInnerAddr] = await deployProxy<RewardsPool>(
                proxyAdmin,
                RewardsPool__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, rewardsPool, RPInnerAddr);
            return rewardsPool;
        }, (_, contract, overrides) => contract.initialize(settingsAddress, overrides));

    // deploy RewardsStaking contract
    const rewardsStaking = await deployContract<RewardsStaking>(
        'RewardsStaking', 
        async (name) => {
            const [rewardsStaking, RSInnerAddr] = await deployProxy<RewardsStaking>(
                proxyAdmin,
                RewardsStaking__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, rewardsStaking, RSInnerAddr);
            return rewardsStaking;
        }, (_, contract, overrides) => contract.initialize(settingsAddress, overrides));

    // deploy RewardsHelper contract
    const rewardsHelper = await deployContract<RewardsHelper>(
        'RewardsHelper',
        async (name) => {
            const [rewardsHelper, RHInnerAddr] = await deployProxy<RewardsHelper>(
                proxyAdmin,
                RewardsHelper__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, rewardsHelper, RHInnerAddr);
            return rewardsHelper;
        }, (_, contract, overrides) => contract.initialize(settingsAddress, overrides));

    // deploy stateChannel contract
    const stateChannel = await deployContract<StateChannel>(
        'StateChannel',
        async (name) => {
            const [stateChannel, SCInnerAddr] = await deployProxy<StateChannel>(
                proxyAdmin,
                StateChannel__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, stateChannel, SCInnerAddr);
            return stateChannel;
        }, (_, contract, overrides) => contract.initialize(settingsAddress, overrides));

    // deploy PermissionedExchange contract
    const permissionedExchange = await deployContract<PermissionedExchange>(
        'PermissionedExchange',
        async (name) => {
            const [permissionedExchange, PEInnerAddr] = await deployProxy<PermissionedExchange>(
                proxyAdmin,
                PermissionedExchange__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, permissionedExchange, PEInnerAddr);
            return permissionedExchange;
        }, (_, contract, overrides) => contract.initialize(
                settingsAddress,
                [rewardsDistributer.address],
                overrides
            ));
    
    // deploy ConsumerHost contract
    const consumerHost = await deployContract<ConsumerHost>(
        'ConsumerHost',
        async (name) => {
            const [consumerHost, CHInnerAddr] = await deployProxy<ConsumerHost>(
                proxyAdmin,
                ConsumerHost__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, consumerHost, CHInnerAddr);
            return consumerHost;
        }, (name, contract, overrides) => {
            const [rate] = config[name];
            return contract.initialize(
                settings.address,
                sqtToken.address,
                stateChannel.address,
                rate,
                overrides
            );
        });
    
    const disputeManager = await deployContract<DisputeManager>(
        'DisputeManager',
        async (name) => {
            const [disputeManager, DMInnerAddr] = await deployProxy<DisputeManager>(
                proxyAdmin,
                DisputeManager__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, name, disputeManager, DMInnerAddr);
            return disputeManager;
        }, (name, contract, overrides) => {
            const [minDeposit] = config[name];
            return contract.initialize(
                minDeposit,
                settingsAddress,
                overrides
            );
        });

    // Register addresses on settings contract
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

    const txProject = await settings.setProjectAddresses(
        deployment.IndexerRegistry.address,
        deployment.QueryRegistry.address,
        deployment.EraManager.address,
        deployment.PlanManager.address,
        deployment.ServiceAgreementRegistry.address,
        deployment.DisputeManager.address,
        deployment.StateChannel.address,
        await getOverrides()
    );

    await txProject.wait(confirms);

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
        },
    ];
}

export const upgradeContract = async (
    proxyAdmin: ProxyAdmin,
    proxyAddress: string,
    ContractFactory: FactoryContstructor,
    wallet: Wallet,
    confirms: number
): Promise<[string, Contract]> => {
    provider = wallet.provider;
    const contractFactory = new ContractFactory(wallet);
    const contract = await contractFactory.deploy(await getOverrides());
    await contract.deployTransaction.wait(confirms);

    const tx = await proxyAdmin.upgrade(proxyAddress, contract.address);
    await tx.wait(confirms);

    return [contract.address, contract];
};

export async function upgradeContracts(
    wallet: Wallet,
    deployment: ContractDeployment,
    confirms: number
): Promise<ContractDeployment> {
    const logger = getLogger('Upgrade Contract');
    logger.info(`Upgrade contrqact with wallet ${wallet.address}`);
    
    provider = wallet.provider;
    const proxyAdmin = ProxyAdmin__factory.connect(deployment.ProxyAdmin.address, wallet);

    const changed: (keyof typeof CONTRACTS)[] = [];
    for (const contract of Object.keys(UPGRADEBAL_CONTRACTS)) {
        const bytecodeHash = sha256(Buffer.from(CONTRACTS[contract].bytecode.replace(/^0x/, ''), 'hex'));
        if (bytecodeHash !== deployment[contract].bytecodeHash) {
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
        const {address} = deployment[contractName];
        const [innerAddr, contract] = await upgradeContract(proxyAdmin, address, factory, wallet, confirms);
        updateDeployment(deployment, contractName, contract, innerAddr);
    }
    return deployment;
}
