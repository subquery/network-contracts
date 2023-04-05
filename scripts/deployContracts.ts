import { BaseContract, ContractTransaction, Overrides } from 'ethers';
import {ContractFactory, Contract} from 'ethers';
import sha256 from 'sha256';
import {Wallet} from '@ethersproject/wallet';
import CONTRACTS from '../src/contracts';
import {ContractDeployment, DeploymentConfig} from '../src/types';
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
let confirms = 5;
let logger = getLogger('deployContracts');

async function getOverrides(): Promise<Overrides> {
    const price = await provider.getGasPrice();
    // TODO: confirm whether need to increase gas price
    const gasPrice = price.add(10000000000);
    return { gasPrice };
}

async function deployContract<T extends BaseContract>(
    name: string, 
    deployFn: (overrides: Overrides) => Promise<T>,
    initFn?: (contract: T, overrides: Overrides) => Promise<ContractTransaction>
): Promise<T> {
    logger = getLogger(name);
    logger.info('🤞 Deploying contract');
    
    let overrides = await getOverrides();
    const contract = await deployFn(overrides);
    await contract.deployTransaction.wait(confirms);
    
    logger.info(`🚀 Contract address: ${contract.address}`);
    if (!initFn) return contract;
      
    logger.info('🤞 Init contract');
    overrides = await getOverrides();
    const tx = await initFn(contract, overrides);
    await tx.wait(confirms);
    logger.info(`🚀 Contract initialized`);

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
    name: keyof ContractDeployment,
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
    _confirms: number | 0 = 0
): Promise<[Partial<ContractDeployment>, Contracts]> {
    logger.info(colorText(`Deploy with wallet ${wallet.address}`, TextColor.YELLOW));
    const deployment: Partial<ContractDeployment> = {};
    provider = wallet.provider;
    confirms = _confirms;

    const proxyAdmin = await deployContract<ProxyAdmin>('ProxyAdmin', async (overrides) => {
        const proxyAdmin = await new ProxyAdmin__factory(wallet).deploy(overrides);
        updateDeployment(deployment, 'ProxyAdmin', proxyAdmin, '');
        return proxyAdmin;
    });

    const settings =  await deployContract<Settings>('Settings', async (overrides) => {
        const settings = await new Settings__factory(wallet).deploy(overrides);
        updateDeployment(deployment, 'Settings', settings, '');
        return settings;
    });

    const inflationController = await deployContract<InflationController>(
        'InflationController', 
        async () => {
            const [inflationController, ICInnerAddr] = await deployProxy<InflationController>(
                proxyAdmin,
                InflationController__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'InflationController', inflationController, ICInnerAddr);
            return inflationController;
        }, (contract, overrides) => {
            const [rate, destination] = config['InflationController'];
            return contract.initialize(
                deployment.Settings.address,
                rate,
                destination,
                overrides
            );
        });

    // deploy SQToken contract
    const [totalSupply] = config['SQToken'];
    const sqtToken = await deployContract<SQToken>('SQToken', async (overrides) => {
        const sqtToken = await new SQToken__factory(wallet).deploy(
            deployment.InflationController.address, 
            totalSupply, 
            overrides
        );
        updateDeployment(deployment, 'SQToken', sqtToken, '');
        return sqtToken;
    });

    // deploy VSQToken contract
    const vsqtToken = await deployContract<VSQToken>(
        'VSQToken',
        async (overrides) => {
            const vsqtToken = await new VSQToken__factory(wallet).deploy(overrides);
            updateDeployment(deployment, 'VSQToken', vsqtToken, '');
            return vsqtToken;
        }, (contract, overrides) => contract.initialize(deployment.Settings.address, overrides)
    );

    //deploy Airdropper contract
    const airdropper = await deployContract<Airdropper>('Airdropper', async (overrides) => {
        const [settleDestination] = config['Airdropper'];
        const airdropper = await new Airdropper__factory(wallet).deploy(settleDestination, overrides);
        updateDeployment(deployment, 'Airdropper', airdropper, '');
        return airdropper;
    });

    //deploy vesting contract
    const vesting = await deployContract<Vesting>('Vesting', async (overrides) => {
        const vesting = await new Vesting__factory(wallet).deploy(deployment.SQToken.address, overrides);
        updateDeployment(deployment, 'Vesting', vesting, '');   
        return vesting;
    });

    // deploy Staking contract
    const staking = await deployContract<Staking>(
        'Staking', 
        async () => {
            const [staking, SInnerAddr] = await deployProxy<Staking>(proxyAdmin, Staking__factory, wallet, confirms);
            updateDeployment(deployment, 'Staking', staking, SInnerAddr);
            return staking;
        }, (contract, overrides) => {
            const [lockPeriod] = config['Staking'];
            return contract.initialize(lockPeriod, deployment.Settings.address, overrides);
        });

    // deploy StakingManager contract
    const stakingManager = await deployContract<StakingManager>(
        'StakingManager', 
        async () => {
            const [stakingManager, SMInnerAddr] = await deployProxy<StakingManager>(
                proxyAdmin,
                StakingManager__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'StakingManager', stakingManager, SMInnerAddr);
            return stakingManager;
        }, (contract, overrides) => contract.initialize(deployment.Settings.address, overrides));

    // deploy Era manager
    const eraManager = await deployContract<EraManager>(
        'EraManager', 
        async () => {
            const [eraManager, EMInnerAddr] = await deployProxy<EraManager>(proxyAdmin, EraManager__factory, wallet, confirms);
            updateDeployment(deployment, 'EraManager', eraManager, EMInnerAddr);
            return eraManager;
        }, (contract, overrides) => {
            const [eraPeriod] = config['EraManager'];
            return contract.initialize(deployment.Settings.address, eraPeriod, overrides);
        });

    // deploy IndexerRegistry contract
    const indexerRegistry = await deployContract<IndexerRegistry>(
        'IndexerRegistry', 
        async () => {
            const [indexerRegistry, IRInnerAddr] = await deployProxy<IndexerRegistry>(
                proxyAdmin,
                IndexerRegistry__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'IndexerRegistry', indexerRegistry, IRInnerAddr);
            return indexerRegistry;
        }, (contract, overrides) => {
            const [minStaking] = config['IndexerRegistry'];
            return contract.initialize(deployment.Settings.address, minStaking, overrides);
        });

    // deploy QueryRegistry contract
    const queryRegistry = await deployContract<QueryRegistry>(
        'QueryRegistry', 
        async () => {
            const [queryRegistry, QRInnerAddr] = await deployProxy<QueryRegistry>(
                proxyAdmin,
                QueryRegistry__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'QueryRegistry', queryRegistry, QRInnerAddr);
            return queryRegistry;
        }, (contract, overrides) => contract.initialize(deployment.Settings.address, overrides));

    // deploy PlanManager contract
    const planManager = await deployContract<PlanManager>(
        'PlanManager', 
        async () => {
            const [planManager, PMInnerAddr] = await deployProxy<PlanManager>(
                proxyAdmin,
                PlanManager__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'PlanManager', planManager, PMInnerAddr);
            return planManager;
        }, (contract, overrides) => contract.initialize(deployment.Settings.address, overrides));

    
    // deploy PurchaseOfferMarket contract
    const purchaseOfferMarket = await deployContract<PurchaseOfferMarket>(
        'PurchaseOfferMarket', 
        async () => {
            const [purchaseOfferMarket, POMInnerAddr] = await deployProxy<PurchaseOfferMarket>(
                proxyAdmin,
                PurchaseOfferMarket__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'PurchaseOfferMarket', purchaseOfferMarket, POMInnerAddr);
            return purchaseOfferMarket;
        }, (contract, overrides) => {
            const [penalty, destination] = config['PurchaseOfferMarket'];
            return contract.initialize(
                deployment.Settings.address,
                penalty,
                destination,
                overrides
            );
        });

    const serviceAgreementRegistry = await deployContract<ServiceAgreementRegistry>(
        'ServiceAgreementRegistry', 
        async () => {
            const [serviceAgreementRegistry, SARInnerAddr] = await deployProxy<ServiceAgreementRegistry>(
                proxyAdmin,
                ServiceAgreementRegistry__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'ServiceAgreementRegistry', serviceAgreementRegistry, SARInnerAddr);
            return serviceAgreementRegistry;
        }, (contract, overrides) => {
            const [threshold] = config['ServiceAgreementRegistry'];
            return contract.initialize(
                deployment.Settings.address,
                threshold,
                [planManager.address, purchaseOfferMarket.address],
                overrides
            );
        });

    // deploy RewardsDistributer contract
    const rewardsDistributer = await deployContract<RewardsDistributer>(
        'RewardsDistributer', 
        async () => {
            const [rewardsDistributer, RDInnerAddr] = await deployProxy<RewardsDistributer>(
                proxyAdmin,
                RewardsDistributer__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'RewardsDistributer', rewardsDistributer, RDInnerAddr);
            return rewardsDistributer;
        }, (contract, overrides) => contract.initialize(deployment.Settings.address, overrides));

    // deploy RewardsPool contract
    const rewardsPool = await deployContract<RewardsPool>(
        'RewardsPool', 
        async () => {
            const [rewardsPool, RPInnerAddr] = await deployProxy<RewardsPool>(
                proxyAdmin,
                RewardsPool__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'RewardsPool', rewardsPool, RPInnerAddr);
            return rewardsPool;
        }, (contract, overrides) => contract.initialize(deployment.Settings.address, overrides));

    // deploy RewardsStaking contract
    const rewardsStaking = await deployContract<RewardsStaking>(
        'RewardsStaking', 
        async () => {
            const [rewardsStaking, RSInnerAddr] = await deployProxy<RewardsStaking>(
                proxyAdmin,
                RewardsStaking__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'RewardsStaking', rewardsStaking, RSInnerAddr);
            return rewardsStaking;
        }, (contract, overrides) => contract.initialize(deployment.Settings.address, overrides));

    // deploy RewardsHelper contract
    const rewardsHelper = await deployContract<RewardsHelper>(
        'RewardsHelper',
        async () => {
            const [rewardsHelper, RHInnerAddr] = await deployProxy<RewardsHelper>(
                proxyAdmin,
                RewardsHelper__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'RewardsHelper', rewardsHelper, RHInnerAddr);
            return rewardsHelper;
        }, (contract, overrides) => contract.initialize(deployment.Settings.address, overrides));

    // deploy stateChannel contract
    const stateChannel = await deployContract<StateChannel>(
        'StateChannel',
        async () => {
            const [stateChannel, SCInnerAddr] = await deployProxy<StateChannel>(
                proxyAdmin,
                StateChannel__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'StateChannel', stateChannel, SCInnerAddr);
            return stateChannel;
        }, (contract, overrides) => contract.initialize(deployment.Settings.address, overrides));

    // deploy PermissionedExchange contract
    const permissionedExchange = await deployContract<PermissionedExchange>(
        'PermissionedExchange',
        async () => {
            const [permissionedExchange, PEInnerAddr] = await deployProxy<PermissionedExchange>(
                proxyAdmin,
                PermissionedExchange__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'PermissionedExchange', permissionedExchange, PEInnerAddr);
            return permissionedExchange;
        }, (contract, overrides) => contract.initialize(
                deployment.Settings.address,
                [rewardsDistributer.address],
                overrides
            ));
    
    // deploy ConsumerHost contract
    const consumerHost = await deployContract<ConsumerHost>(
        'ConsumerHost',
        async () => {
            const [consumerHost, CHInnerAddr] = await deployProxy<ConsumerHost>(
                proxyAdmin,
                ConsumerHost__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'ConsumerHost', consumerHost, CHInnerAddr);
            return consumerHost;
        }, (contract, overrides) => {
            const [rate] = config['ConsumerHost'];
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
        async () => {
            const [disputeManager, DMInnerAddr] = await deployProxy<DisputeManager>(
                proxyAdmin,
                DisputeManager__factory,
                wallet,
                confirms
            );
            updateDeployment(deployment, 'DisputeManager', disputeManager, DMInnerAddr);
            return disputeManager;
        }, (contract, overrides) => {
            const [minDeposit] = config['DisputeManager'];
            return contract.initialize(
                minDeposit,
                deployment.Settings.address,
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
    logger = getLogger('UpgradeContracts');
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
