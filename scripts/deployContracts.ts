import {ContractFactory, Contract, Overrides} from 'ethers';
import sha256 from 'sha256';
import CONTRACTS from '../src/contracts';
import {ContractDeployment, DeploymentConfig} from '../src/types';
import {Wallet} from '@ethersproject/wallet';

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
    EraManager,
    IndexerRegistry,
    PlanManager,
    PurchaseOfferMarket,
    RewardsDistributer,
    RewardsDistributer__factory,
    RewardsHelper,
    RewardsHelper__factory,
    StateChannel,
    StateChannel__factory,
    ConsumerProxy,
    ConsumerProxy__factory,
    ConsumerHoster,
    ConsumerHoster__factory,
} from '../src';

interface FactoryContstructor {
    new (wallet: Wallet): ContractFactory;
    readonly abi: any;
}

type Contracts = {
    proxyAdmin: ProxyAdmin;
    settings: Settings;
    inflationController: InflationController;
    token: SQToken;
    staking: Staking;
    eraManager: EraManager;
    indexerRegistry: IndexerRegistry;
    queryRegistry: QueryRegistry;
    planManager: PlanManager;
    purchaseOfferMarket: PurchaseOfferMarket;
    serviceAgreementRegistry: ServiceAgreementRegistry;
    rewardsDistributer: RewardsDistributer;
    rewardsHelper: RewardsHelper;
    stateChannel: StateChannel;
    consumerProxy: ConsumerProxy;
    consumerHoster: ConsumerHoster;
};

const UPGRADEBAL_CONTRACTS: Partial<Record<keyof typeof CONTRACTS, [{bytecode: string}, FactoryContstructor]>> = {
    InflationController: [CONTRACTS.InflationController, InflationController__factory],
    IndexerRegistry: [CONTRACTS.IndexerRegistry, IndexerRegistry__factory],
    PlanManager: [CONTRACTS.PlanManager, PlanManager__factory],
    QueryRegistry: [CONTRACTS.QueryRegistry, QueryRegistry__factory],
    RewardsDistributer: [CONTRACTS.RewardsDistributer, RewardsDistributer__factory],
    RewardsHelper: [CONTRACTS.RewardsHelper, RewardsHelper__factory],
    ServiceAgreementRegistry: [CONTRACTS.ServiceAgreementRegistry, ServiceAgreementRegistry__factory],
    Staking: [CONTRACTS.Staking, Staking__factory],
    EraManager: [CONTRACTS.EraManager, EraManager__factory],
    PurchaseOfferMarket: [CONTRACTS.PurchaseOfferMarket, PurchaseOfferMarket__factory],
    StateChannel: [CONTRACTS.StateChannel, StateChannel__factory],
    ConsumerProxy: [CONTRACTS.ConsumerProxy, ConsumerProxy__factory],
    ConsumerHoster: [CONTRACTS.ConsumerHoster, ConsumerHoster__factory],
};

export const deployProxy = async <C extends Contract>(
    proxyAdmin: ProxyAdmin,
    ContractFactory: FactoryContstructor,
    wallet: Wallet,
    overrides: any
): Promise<C> => {
    const contractFactory = new ContractFactory(wallet);
    let contractLogic = await contractFactory.deploy(overrides);
    await contractLogic.deployTransaction.wait();

    const adminUpgradabilityProxyFactory = new AdminUpgradeabilityProxy__factory(wallet);

    const contractProxy = await adminUpgradabilityProxyFactory.deploy(
        contractLogic.address,
        proxyAdmin.address,
        [],
        overrides
    );
    await contractProxy.deployTransaction.wait();

    const proxy = contractFactory.attach(contractProxy.address) as C;
    (proxy as any).deployTransaction = contractLogic.deployTransaction;
    return proxy;
};

export const upgradeContract = async (
    proxyAdmin: ProxyAdmin,
    proxyAddress: string,
    ContractFactory: FactoryContstructor,
    wallet: Wallet,
    overrides: any
): Promise<string> => {
    const contractFactory = new ContractFactory(wallet);
    let contractLogic = await contractFactory.deploy(overrides);
    await contractLogic.deployTransaction.wait();

    const tx = await proxyAdmin.upgrade(proxyAddress, contractLogic.address);
    await tx.wait();

    return contractLogic.deployTransaction.hash;
};

function updateDeployment(
    deployment: Partial<ContractDeployment>,
    name: keyof ContractDeployment,
    contractAddr: string,
    deployTxHash: string
) {
    if (process.env.DEPLOY_PRINT === 'true') {
        console.log(`${name} ${contractAddr} deployed at tx ${deployTxHash}`);
    }
    deployment[name] = {
        address: contractAddr,
        bytecodeHash: sha256(Buffer.from(CONTRACTS[name].bytecode.replace(/^0x/, ''), 'hex')),
        txHash: deployTxHash,
        lastUpdate: new Date().toUTCString(),
    };
}

export async function deployContracts(
    wallet: Wallet,
    config: DeploymentConfig['contracts'],
    overrides: Overrides | {} = {},
    dev: boolean | true
): Promise<[Partial<ContractDeployment>, Contracts]> {
    const deployment: Partial<ContractDeployment> = {};
    if (process.env.DEBUG) {
        console.log(`deploy start, from wallet ${wallet.address}`);
    }
    const proxyAdmin = await new ProxyAdmin__factory(wallet).deploy(overrides);
    await proxyAdmin.deployTransaction.wait();
    updateDeployment(deployment, 'ProxyAdmin', proxyAdmin.address, proxyAdmin.deployTransaction.hash);
    if (process.env.DEBUG) {
        console.log(`proxyAdmin deploy ${proxyAdmin.address}`);
    }
    // deploy settings contract
    const settings = await new Settings__factory(wallet).deploy(overrides);
    await settings.deployTransaction.wait();
    updateDeployment(deployment, 'Settings', settings.address, settings.deployTransaction.hash);
    // deploy InflationController contract
    const inflationController = await deployProxy<InflationController>(
        proxyAdmin,
        InflationController__factory,
        wallet,
        overrides
    );
    const inflationInit = await inflationController.initialize(
        deployment.Settings.address,
        ...(config['InflationController'] as [number, string]),
        overrides
    );
    await inflationInit.wait();
    updateDeployment(
        deployment,
        'InflationController',
        inflationController.address,
        inflationController.deployTransaction.hash
    );

    // deploy SQToken contract
    const sqtToken = await new SQToken__factory(wallet).deploy(deployment.InflationController.address, overrides);
    await sqtToken.deployTransaction.wait();
    updateDeployment(deployment, 'SQToken', sqtToken.address, sqtToken.deployTransaction.hash);

    // deploy Staking contract
    const staking = await deployProxy<Staking>(proxyAdmin, Staking__factory, wallet, overrides);
    const initStaking = await staking.initialize(
        ...(config['Staking'] as [number]),
        deployment.Settings.address,
        overrides
    );
    await initStaking.wait();
    updateDeployment(deployment, 'Staking', staking.address, staking.deployTransaction.hash);

    // deploy Era manager
    const eraManager = await deployProxy<EraManager>(proxyAdmin, EraManager__factory, wallet, overrides);
    const eraManagerInit = await eraManager.initialize(
        deployment.Settings.address,
        ...(config['EraManager'] as [number]),
        overrides
    );
    await eraManagerInit.wait();
    updateDeployment(deployment, 'EraManager', eraManager.address, eraManager.deployTransaction.hash);

    // deploy IndexerRegistry contract
    const indexerRegistry = await deployProxy<IndexerRegistry>(proxyAdmin, IndexerRegistry__factory, wallet, overrides);
    const initIndexer = await indexerRegistry.initialize(deployment.Settings.address, overrides);
    await initIndexer.wait();
    updateDeployment(deployment, 'IndexerRegistry', indexerRegistry.address, indexerRegistry.deployTransaction.hash);

    // deploy QueryRegistry contract
    const queryRegistry = await deployProxy<QueryRegistry>(proxyAdmin, QueryRegistry__factory, wallet, overrides);
    const initQuery = await queryRegistry.initialize(deployment.Settings.address, overrides);
    await initQuery.wait();
    updateDeployment(deployment, 'QueryRegistry', queryRegistry.address, queryRegistry.deployTransaction.hash);

    const planManager = await deployProxy<PlanManager>(proxyAdmin, PlanManager__factory, wallet, overrides);
    const initPlanManager = await planManager.initialize(deployment.Settings.address, overrides);
    await initPlanManager.wait();
    updateDeployment(deployment, 'PlanManager', planManager.address, planManager.deployTransaction.hash);

    const purchaseOfferMarket = await deployProxy<PurchaseOfferMarket>(
        proxyAdmin,
        PurchaseOfferMarket__factory,
        wallet,
        overrides
    );
    const purchaseOfferMarketInit = await purchaseOfferMarket.initialize(
        deployment.Settings.address,
        ...(config['PurchaseOfferMarket'] as [number, string]),
        overrides
    );
    await purchaseOfferMarketInit.wait();
    updateDeployment(
        deployment,
        'PurchaseOfferMarket',
        purchaseOfferMarket.address,
        purchaseOfferMarket.deployTransaction.hash
    );

    const serviceAgreementRegistry = await deployProxy<ServiceAgreementRegistry>(
        proxyAdmin,
        ServiceAgreementRegistry__factory,
        wallet,
        overrides
    );
    const initSARegistry = await serviceAgreementRegistry.initialize(deployment.Settings.address, [
        planManager.address,
        purchaseOfferMarket.address,
    ]);
    await initSARegistry.wait();
    updateDeployment(
        deployment,
        'ServiceAgreementRegistry',
        serviceAgreementRegistry.address,
        serviceAgreementRegistry.deployTransaction.hash
    );

    const rewardsDistributer = await deployProxy<RewardsDistributer>(
        proxyAdmin,
        RewardsDistributer__factory,
        wallet,
        overrides
    );
    const initRewardsDistributer = await rewardsDistributer.initialize(deployment.Settings.address, overrides);
    await initRewardsDistributer.wait();
    updateDeployment(
        deployment,
        'RewardsDistributer',
        rewardsDistributer.address,
        rewardsDistributer.deployTransaction.hash
    );

    const rewardsHelper = await deployProxy<RewardsHelper>(proxyAdmin, RewardsHelper__factory, wallet, overrides);
    const initRewardsHelper = await rewardsHelper.initialize(deployment.Settings.address, overrides);
    await initRewardsHelper.wait();
    updateDeployment(deployment, 'RewardsHelper', rewardsHelper.address, rewardsHelper.deployTransaction.hash);

    const stateChannel = await deployProxy<StateChannel>(proxyAdmin, StateChannel__factory, wallet, overrides);
    const initStateChannel = await stateChannel.initialize(deployment.Settings.address, overrides);
    await initStateChannel.wait();
    updateDeployment(deployment, 'StateChannel', stateChannel.address, stateChannel.deployTransaction.hash);

    // only local & test deploy.
    let consumerProxy;
    let consumerHoster;
    if (dev) {
        consumerProxy = await deployProxy<ConsumerProxy>(proxyAdmin, ConsumerProxy__factory, wallet, overrides);
        const initConsumerProxy = await consumerProxy.initialize(sqtToken.address, stateChannel.address, wallet.address, overrides);
        await initConsumerProxy.wait();
        updateDeployment(deployment, 'ConsumerProxy', consumerProxy.address, consumerProxy.deployTransaction.hash);

        consumerHoster = await deployProxy<ConsumerHoster>(proxyAdmin, ConsumerHoster__factory, wallet, overrides);
        const initConsumerHoster = await consumerHoster.initialize(sqtToken.address, stateChannel.address, overrides);
        await initConsumerHoster.wait();
        updateDeployment(deployment, 'ConsumerHoster', consumerHoster.address, consumerHoster.deployTransaction.hash);
    }

    // Register addresses on settings contract
    const txObj = await settings.setAllAddresses(
        deployment.SQToken.address,
        deployment.Staking.address,
        deployment.IndexerRegistry.address,
        deployment.QueryRegistry.address,
        deployment.EraManager.address,
        deployment.PlanManager.address,
        deployment.ServiceAgreementRegistry.address,
        deployment.RewardsDistributer.address,
        deployment.RewardsHelper.address,
        deployment.InflationController.address,
        overrides as any
    );

    await txObj.wait();

    return [
        deployment,
        {
            settings,
            inflationController,
            token: sqtToken,
            staking,
            eraManager,
            indexerRegistry,
            queryRegistry,
            planManager,
            purchaseOfferMarket,
            serviceAgreementRegistry,
            rewardsDistributer,
            rewardsHelper,
            proxyAdmin,
            stateChannel,
            consumerProxy,
            consumerHoster,
        },
    ];
}

export async function upgradeContracts(
    wallet: Wallet,
    deployment: ContractDeployment,
    config: DeploymentConfig['contracts'],
    overrides: Overrides | {} = {}
): Promise<ContractDeployment> {
    if (process.env.DEBUG) {
        console.log(`deploy start, from wallet ${wallet.address}`);
    }
    const proxyAdmin = ProxyAdmin__factory.connect(deployment.ProxyAdmin.address, wallet);

    const changed: (keyof typeof CONTRACTS)[] = [];
    for (const contract of Object.keys(UPGRADEBAL_CONTRACTS)) {
        const bytecodeHash = sha256(Buffer.from(CONTRACTS[contract].bytecode.replace(/^0x/, ''), 'hex'));
        if (bytecodeHash !== deployment[contract].bytecodeHash) {
            changed.push(contract as any);
        }
    }
    if (!changed.length) {
        console.log(`No Contracts Changed`);
        return;
    }
    console.log(`Contract Changed: ${changed.join(',')}`);
    for (const contract of changed) {
        console.log(`Upgrading ${contract}`);
        const [_, factory] = UPGRADEBAL_CONTRACTS[contract];
        const {address} = deployment[contract];
        const deployTx = await upgradeContract(proxyAdmin, address, factory, wallet, overrides);
        updateDeployment(deployment, contract, address, deployTx);
    }
    return deployment;
}
