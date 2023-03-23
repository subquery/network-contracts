import {ContractFactory, Contract, Overrides} from 'ethers';
import sha256 from 'sha256';
import {Wallet} from '@ethersproject/wallet';
import CONTRACTS from '../src/contracts';
import {ContractDeployment, DeploymentConfig} from '../src/types';

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

export const deployProxy = async <C extends Contract>(
    proxyAdmin: ProxyAdmin,
    ContractFactory: FactoryContstructor,
    wallet: Wallet,
    overrides: any
): Promise<[C, string]> => {
    const contractFactory = new ContractFactory(wallet);
    let contractLogic = await contractFactory.deploy(overrides);
    await contractLogic.deployTransaction.wait(1);

    const adminUpgradabilityProxyFactory = new AdminUpgradeabilityProxy__factory(wallet);

    const contractProxy = await adminUpgradabilityProxyFactory.deploy(
        contractLogic.address,
        proxyAdmin.address,
        [],
        overrides
    );
    await contractProxy.deployTransaction.wait(1);

    const proxy = contractFactory.attach(contractProxy.address) as C;
    (proxy as any).deployTransaction = contractLogic.deployTransaction;
    return [proxy, contractLogic.address];
};

export const upgradeContract = async (
    proxyAdmin: ProxyAdmin,
    proxyAddress: string,
    ContractFactory: FactoryContstructor,
    wallet: Wallet,
    overrides: any
): Promise<[string, string]> => {
    const contractFactory = new ContractFactory(wallet);
    let contractLogic = await contractFactory.deploy(overrides);
    await contractLogic.deployTransaction.wait(1);

    const tx = await proxyAdmin.upgrade(proxyAddress, contractLogic.address);
    await tx.wait(1);

    return [contractLogic.address, contractLogic.deployTransaction.hash];
};

function updateDeployment(
    deployment: Partial<ContractDeployment>,
    name: keyof ContractDeployment,
    contractAddr: string,
    innerAddr: string,
    deployTxHash: string
) {
    if (process.env.DEPLOY_PRINT === 'true') {
        console.log(`${name} ${contractAddr} deployed at tx ${deployTxHash}`);
    }
    deployment[name] = {
        innerAddress: innerAddr,
        address: contractAddr,
        bytecodeHash: sha256(Buffer.from(CONTRACTS[name].bytecode.replace(/^0x/, ''), 'hex')),
        lastUpdate: new Date().toUTCString(),
    };
}

export async function deployContracts(
    wallet: Wallet,
    config: DeploymentConfig['contracts'],
    overrides: Overrides | {} = {}
): Promise<[Partial<ContractDeployment>, Contracts]> {
    const deployment: Partial<ContractDeployment> = {};
    if (process.env.DEBUG) {
        console.log(`deploy start, from wallet ${wallet.address}`);
    }
    const proxyAdmin = await new ProxyAdmin__factory(wallet).deploy(overrides);
    await proxyAdmin.deployTransaction.wait(1);
    console.log(`Deploy proxyAdmin: ${proxyAdmin.deployTransaction.hash}`);
    updateDeployment(deployment, 'ProxyAdmin', proxyAdmin.address, '', proxyAdmin.deployTransaction.hash);

    // deploy settings contract
    const settings = await new Settings__factory(wallet).deploy(overrides);
    await settings.deployTransaction.wait(1);
    console.log(`Deploy settings: ${settings.deployTransaction.hash}`);
    updateDeployment(deployment, 'Settings', settings.address, '', settings.deployTransaction.hash);

    // deploy InflationController contract
    const [inflationController, ICInnerAddr] = await deployProxy<InflationController>(
        proxyAdmin,
        InflationController__factory,
        wallet,
        overrides
    );
    console.log(`Deploy inflationController: ${inflationController.deployTransaction.hash}`);
    const inflationInit = await inflationController.initialize(
        deployment.Settings.address,
        ...(config['InflationController'] as [number, string]),
        overrides
    );
    await inflationInit.wait(1);
    updateDeployment(
        deployment,
        'InflationController',
        inflationController.address,
        ICInnerAddr,
        inflationController.deployTransaction.hash
    );

    // deploy SQToken contract
    const sqtToken = await new SQToken__factory(wallet).deploy(deployment.InflationController.address, overrides);
    await sqtToken.deployTransaction.wait(1);
    console.log(`Deploy sqtToken: ${sqtToken.deployTransaction.hash}`);
    updateDeployment(deployment, 'SQToken', sqtToken.address, '', sqtToken.deployTransaction.hash);

    // deploy VSQToken contract
    const vsqtToken = await new VSQToken__factory(wallet).deploy(overrides);
    console.log(`Deploy vsqtToken: ${vsqtToken.deployTransaction.hash}`);
    const initVsqtToken = await vsqtToken.initialize(deployment.Settings.address, overrides);
    await initVsqtToken.wait(1);
    updateDeployment(deployment, 'VSQToken', vsqtToken.address, '', vsqtToken.deployTransaction.hash);

    //deploy Airdropper contract
    const airdropper = await new Airdropper__factory(wallet).deploy(overrides);
    await airdropper.deployTransaction.wait(1);
    console.log(`Deploy airdropper: ${airdropper.deployTransaction.hash}`);
    updateDeployment(deployment, 'Airdropper', airdropper.address, '', airdropper.deployTransaction.hash);

    //deploy vesting contract
    const vesting = await new Vesting__factory(wallet).deploy(deployment.SQToken.address, overrides);
    await vesting.deployTransaction.wait(1);
    console.log(`Deploy vesting: ${vesting.deployTransaction.hash}`);
    updateDeployment(deployment, 'Vesting', vesting.address, '', vesting.deployTransaction.hash);

    // deploy Staking contract
    const [staking, SInnerAddr] = await deployProxy<Staking>(proxyAdmin, Staking__factory, wallet, overrides);
    console.log(`Deploy staking: ${staking.deployTransaction.hash}`);
    const initStaking = await staking.initialize(
        ...(config['Staking'] as [number]),
        deployment.Settings.address,
        overrides
    );
    await initStaking.wait(1);
    updateDeployment(deployment, 'Staking', staking.address, SInnerAddr, staking.deployTransaction.hash);

    // deploy StakingManager contract
    const [stakingManager, SMInnerAddr] = await deployProxy<StakingManager>(
        proxyAdmin,
        StakingManager__factory,
        wallet,
        overrides
    );
    console.log(`Deploy stakingManager: ${stakingManager.deployTransaction.hash}`);
    const stakingManagerInit = await stakingManager.initialize(deployment.Settings.address, overrides);
    await stakingManagerInit.wait(1);
    updateDeployment(
        deployment,
        'StakingManager',
        stakingManager.address,
        SMInnerAddr,
        stakingManager.deployTransaction.hash
    );

    // deploy Era manager
    const [eraManager, EMInnerAddr] = await deployProxy<EraManager>(proxyAdmin, EraManager__factory, wallet, overrides);
    console.log(`Deploy eraManager: ${eraManager.deployTransaction.hash}`);
    const eraManagerInit = await eraManager.initialize(
        deployment.Settings.address,
        ...(config['EraManager'] as [number]),
        overrides
    );
    await eraManagerInit.wait(1);
    updateDeployment(deployment, 'EraManager', eraManager.address, EMInnerAddr, eraManager.deployTransaction.hash);

    // deploy IndexerRegistry contract
    const [indexerRegistry, IRInnerAddr] = await deployProxy<IndexerRegistry>(
        proxyAdmin,
        IndexerRegistry__factory,
        wallet,
        overrides
    );
    console.log(`Deploy indexerRegistry: ${indexerRegistry.deployTransaction.hash}`);
    const initIndexer = await indexerRegistry.initialize(
        deployment.Settings.address,
        ...(config['IndexerRegistry'] as [string]),
        overrides
    );
    await initIndexer.wait(1);
    updateDeployment(
        deployment,
        'IndexerRegistry',
        indexerRegistry.address,
        IRInnerAddr,
        indexerRegistry.deployTransaction.hash
    );

    // deploy QueryRegistry contract
    const [queryRegistry, QRInnerAddr] = await deployProxy<QueryRegistry>(
        proxyAdmin,
        QueryRegistry__factory,
        wallet,
        overrides
    );
    console.log(`Deploy queryRegistry: ${queryRegistry.deployTransaction.hash}`);
    const initQuery = await queryRegistry.initialize(deployment.Settings.address, overrides);
    await initQuery.wait(1);
    updateDeployment(
        deployment,
        'QueryRegistry',
        queryRegistry.address,
        QRInnerAddr,
        queryRegistry.deployTransaction.hash
    );

    const [planManager, PMInnerAddr] = await deployProxy<PlanManager>(
        proxyAdmin,
        PlanManager__factory,
        wallet,
        overrides
    );
    console.log(`Deploy planManager: ${planManager.deployTransaction.hash}`);
    const initPlanManager = await planManager.initialize(deployment.Settings.address, overrides);
    await initPlanManager.wait(1);
    updateDeployment(deployment, 'PlanManager', planManager.address, PMInnerAddr, planManager.deployTransaction.hash);

    const [purchaseOfferMarket, POMInnerAddr] = await deployProxy<PurchaseOfferMarket>(
        proxyAdmin,
        PurchaseOfferMarket__factory,
        wallet,
        overrides
    );
    console.log(`Deploy purchaseOfferMarket: ${purchaseOfferMarket.deployTransaction.hash}`);
    const purchaseOfferMarketInit = await purchaseOfferMarket.initialize(
        deployment.Settings.address,
        ...(config['PurchaseOfferMarket'] as [number, string]),
        overrides
    );
    await purchaseOfferMarketInit.wait(1);
    updateDeployment(
        deployment,
        'PurchaseOfferMarket',
        purchaseOfferMarket.address,
        POMInnerAddr,
        purchaseOfferMarket.deployTransaction.hash
    );

    const [serviceAgreementRegistry, SARInnerAddr] = await deployProxy<ServiceAgreementRegistry>(
        proxyAdmin,
        ServiceAgreementRegistry__factory,
        wallet,
        overrides
    );
    console.log(`Deploy serviceAgreementRegistry: ${serviceAgreementRegistry.deployTransaction.hash}`);
    const initSARegistry = await serviceAgreementRegistry.initialize(
        deployment.Settings.address,
        ...(config['ServiceAgreementRegistry'] as [number]),
        [planManager.address, purchaseOfferMarket.address]
    );
    await initSARegistry.wait(1);
    updateDeployment(
        deployment,
        'ServiceAgreementRegistry',
        serviceAgreementRegistry.address,
        SARInnerAddr,
        serviceAgreementRegistry.deployTransaction.hash
    );

    const [rewardsDistributer, RDInnerAddr] = await deployProxy<RewardsDistributer>(
        proxyAdmin,
        RewardsDistributer__factory,
        wallet,
        overrides
    );
    console.log(`Deploy rewardsDistributer: ${rewardsDistributer.deployTransaction.hash}`);
    const initRewardsDistributer = await rewardsDistributer.initialize(deployment.Settings.address, overrides);
    await initRewardsDistributer.wait(1);
    updateDeployment(
        deployment,
        'RewardsDistributer',
        rewardsDistributer.address,
        RDInnerAddr,
        rewardsDistributer.deployTransaction.hash
    );

    const [rewardsPool, RPInnerAddr] = await deployProxy<RewardsPool>(
        proxyAdmin,
        RewardsPool__factory,
        wallet,
        overrides
    );
    console.log(`Deploy rewardsPool: ${rewardsPool.deployTransaction.hash}`);
    const initRewardsPool = await rewardsPool.initialize(deployment.Settings.address, overrides);
    await initRewardsPool.wait(1);
    updateDeployment(deployment, 'RewardsPool', rewardsPool.address, RPInnerAddr, rewardsPool.deployTransaction.hash);

    const [rewardsStaking, RSInnerAddr] = await deployProxy<RewardsStaking>(
        proxyAdmin,
        RewardsStaking__factory,
        wallet,
        overrides
    );
    console.log(`Deploy rewardsStaking: ${rewardsStaking.deployTransaction.hash}`);
    const initRewardsStaking = await rewardsStaking.initialize(deployment.Settings.address, overrides);
    await initRewardsStaking.wait(1);
    updateDeployment(
        deployment,
        'RewardsStaking',
        rewardsStaking.address,
        RSInnerAddr,
        rewardsStaking.deployTransaction.hash
    );

    const [rewardsHelper, RHInnerAddr] = await deployProxy<RewardsHelper>(
        proxyAdmin,
        RewardsHelper__factory,
        wallet,
        overrides
    );
    console.log(`Deploy rewardsHelper: ${rewardsHelper.deployTransaction.hash}`);
    const initRewardsHelper = await rewardsHelper.initialize(deployment.Settings.address, overrides);
    await initRewardsHelper.wait(1);
    updateDeployment(
        deployment,
        'RewardsHelper',
        rewardsHelper.address,
        RHInnerAddr,
        rewardsHelper.deployTransaction.hash
    );

    const [stateChannel, SCInnerAddr] = await deployProxy<StateChannel>(
        proxyAdmin,
        StateChannel__factory,
        wallet,
        overrides
    );
    console.log(`Deploy stateChannel: ${stateChannel.deployTransaction.hash}`);
    const initStateChannel = await stateChannel.initialize(deployment.Settings.address, overrides);
    await initStateChannel.wait(1);
    updateDeployment(
        deployment,
        'StateChannel',
        stateChannel.address,
        SCInnerAddr,
        stateChannel.deployTransaction.hash
    );

    const [permissionedExchange, PEInnerAddr] = await deployProxy<PermissionedExchange>(
        proxyAdmin,
        PermissionedExchange__factory,
        wallet,
        overrides
    );
    console.log(`Deploy permissionedExchange: ${permissionedExchange.deployTransaction.hash}`);
    const initPermissionedExchange = await permissionedExchange.initialize(
        deployment.Settings.address,
        [rewardsDistributer.address],
        overrides
    );
    await initPermissionedExchange.wait(1);
    updateDeployment(
        deployment,
        'PermissionedExchange',
        permissionedExchange.address,
        PEInnerAddr,
        permissionedExchange.deployTransaction.hash
    );

    const [consumerHost, CHInnerAddr] = await deployProxy<ConsumerHost>(
        proxyAdmin,
        ConsumerHost__factory,
        wallet,
        overrides
    );
    console.log(`Deploy consumerHost: ${consumerHost.deployTransaction.hash}`);
    const initConsumerHost = await consumerHost.initialize(
        settings.address,
        sqtToken.address,
        stateChannel.address,
        ...(config['ConsumerHost'] as [number]),
        overrides
    );
    await initConsumerHost.wait(1);
    updateDeployment(
        deployment,
        'ConsumerHost',
        consumerHost.address,
        CHInnerAddr,
        consumerHost.deployTransaction.hash
    );

    const [disputeManager, DMInnerAddr] = await deployProxy<DisputeManager>(
        proxyAdmin,
        DisputeManager__factory,
        wallet,
        overrides
    );
    console.log(`Deploy disputeManager: ${disputeManager.deployTransaction.hash}`);
    const initDisputeManager = await disputeManager.initialize(
        ...(config['DisputeManager'] as [string]),
        deployment.Settings.address,
        overrides
    );
    await initDisputeManager.wait(1);
    updateDeployment(
        deployment,
        'DisputeManager',
        disputeManager.address,
        DMInnerAddr,
        disputeManager.deployTransaction.hash
    );

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
        overrides as any
    );

    await txToken.wait(1);

    const txProject = await settings.setProjectAddresses(
        deployment.IndexerRegistry.address,
        deployment.QueryRegistry.address,
        deployment.EraManager.address,
        deployment.PlanManager.address,
        deployment.ServiceAgreementRegistry.address,
        deployment.DisputeManager.address,
        deployment.StateChannel.address,
        overrides as any
    );

    await txProject.wait(1);

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

export async function upgradeContracts(
    wallet: Wallet,
    deployment: ContractDeployment,
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
        const [innerAddr, deployTx] = await upgradeContract(proxyAdmin, address, factory, wallet, overrides);
        updateDeployment(deployment, contract, address, innerAddr, deployTx);
    }
    return deployment;
}
