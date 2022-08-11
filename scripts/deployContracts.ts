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
    VSQToken,
    VSQToken__factory,
    EraManager,
    IndexerRegistry,
    PlanManager,
    PurchaseOfferMarket,
    RewardsDistributer,
    RewardsDistributer__factory,
    StateChannel,
    StateChannel__factory,
    Airdropper,
    Airdropper__factory,
    PermissionedExchange,
    PermissionedExchange__factory,
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
    vtoken: VSQToken;
    staking: Staking;
    eraManager: EraManager;
    indexerRegistry: IndexerRegistry;
    queryRegistry: QueryRegistry;
    planManager: PlanManager;
    purchaseOfferMarket: PurchaseOfferMarket;
    serviceAgreementRegistry: ServiceAgreementRegistry;
    rewardsDistributer: RewardsDistributer;
    stateChannel: StateChannel;
    airdropper: Airdropper;
    permissionedExchange: PermissionedExchange;
};

const UPGRADEBAL_CONTRACTS: Partial<Record<keyof typeof CONTRACTS, [{bytecode: string}, FactoryContstructor]>> = {
    InflationController: [CONTRACTS.InflationController, InflationController__factory],
    IndexerRegistry: [CONTRACTS.IndexerRegistry, IndexerRegistry__factory],
    PlanManager: [CONTRACTS.PlanManager, PlanManager__factory],
    QueryRegistry: [CONTRACTS.QueryRegistry, QueryRegistry__factory],
    RewardsDistributer: [CONTRACTS.RewardsDistributer, RewardsDistributer__factory],
    ServiceAgreementRegistry: [CONTRACTS.ServiceAgreementRegistry, ServiceAgreementRegistry__factory],
    Staking: [CONTRACTS.Staking, Staking__factory],
    EraManager: [CONTRACTS.EraManager, EraManager__factory],
    PurchaseOfferMarket: [CONTRACTS.PurchaseOfferMarket, PurchaseOfferMarket__factory],
    StateChannel: [CONTRACTS.StateChannel, StateChannel__factory],
    PermissionedExchange: [CONTRACTS.PermissionedExchange, PermissionedExchange__factory],
};

export const deployProxy = async <C extends Contract>(
    proxyAdmin: ProxyAdmin,
    ContractFactory: FactoryContstructor,
    wallet: Wallet,
    overrides: any
): Promise<[C, string]> => {
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
    await contractLogic.deployTransaction.wait();

    const tx = await proxyAdmin.upgrade(proxyAddress, contractLogic.address);
    await tx.wait();

    return [contractLogic.address, contractLogic.deployTransaction.hash];
};

function updateDeployment(
    deployment: Partial<ContractDeployment>,
    name: keyof ContractDeployment,
    contractAddr: string,
    logicAddr: string,
    deployTxHash: string
) {
    if (process.env.DEPLOY_PRINT === 'true') {
        console.log(`${name} ${contractAddr} deployed at tx ${deployTxHash}`);
    }
    deployment[name] = {
        innerAddress: logicAddr,
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
    await proxyAdmin.deployTransaction.wait();
    updateDeployment(deployment, 'ProxyAdmin', proxyAdmin.address, '', proxyAdmin.deployTransaction.hash);

    // deploy settings contract
    const settings = await new Settings__factory(wallet).deploy(overrides);
    await settings.deployTransaction.wait();
    updateDeployment(deployment, 'Settings', settings.address, '', settings.deployTransaction.hash);

    // deploy InflationController contract
    const [inflationController, ICLogicAddr] = await deployProxy<InflationController>(
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
        ICLogicAddr,
        inflationController.deployTransaction.hash
    );

    // deploy SQToken contract
    const sqtToken = await new SQToken__factory(wallet).deploy(deployment.InflationController.address, overrides);
    await sqtToken.deployTransaction.wait();
    updateDeployment(deployment, 'SQToken', sqtToken.address, '', sqtToken.deployTransaction.hash);

    // deploy VSQToken contract
    const vsqtToken = await new VSQToken__factory(wallet).deploy(overrides);
    const initVsqtToken = await vsqtToken.initialize(deployment.Settings.address, overrides);
    await initVsqtToken.wait();
    updateDeployment(deployment, 'VSQToken', vsqtToken.address, '', vsqtToken.deployTransaction.hash);

    //deploy Airdropper contract
    const airdropper = await new Airdropper__factory(wallet).deploy(overrides);
    await airdropper.deployTransaction.wait();
    updateDeployment(deployment, 'Airdropper', airdropper.address, '', airdropper.deployTransaction.hash);

    // deploy Staking contract
    const [staking, SLogicAddr] = await deployProxy<Staking>(proxyAdmin, Staking__factory, wallet, overrides);
    const initStaking = await staking.initialize(
        ...(config['Staking'] as [number]),
        deployment.Settings.address,
        overrides
    );
    await initStaking.wait();
    updateDeployment(deployment, 'Staking', staking.address, SLogicAddr, staking.deployTransaction.hash);

    // deploy Era manager
    const [eraManager, EMLogicAddr] = await deployProxy<EraManager>(proxyAdmin, EraManager__factory, wallet, overrides);
    const eraManagerInit = await eraManager.initialize(
        deployment.Settings.address,
        ...(config['EraManager'] as [number]),
        overrides
    );
    await eraManagerInit.wait();
    updateDeployment(deployment, 'EraManager', eraManager.address, EMLogicAddr, eraManager.deployTransaction.hash);

    // deploy IndexerRegistry contract
    const [indexerRegistry, IRLogicAddr] = await deployProxy<IndexerRegistry>(
        proxyAdmin,
        IndexerRegistry__factory,
        wallet,
        overrides
    );
    const initIndexer = await indexerRegistry.initialize(deployment.Settings.address, overrides);
    await initIndexer.wait();
    updateDeployment(
        deployment,
        'IndexerRegistry',
        indexerRegistry.address,
        IRLogicAddr,
        indexerRegistry.deployTransaction.hash
    );

    // deploy QueryRegistry contract
    const [queryRegistry, QRLogicAddr] = await deployProxy<QueryRegistry>(
        proxyAdmin,
        QueryRegistry__factory,
        wallet,
        overrides
    );
    const initQuery = await queryRegistry.initialize(deployment.Settings.address, overrides);
    await initQuery.wait();
    updateDeployment(
        deployment,
        'QueryRegistry',
        queryRegistry.address,
        QRLogicAddr,
        queryRegistry.deployTransaction.hash
    );

    const [planManager, PMLogicAddr] = await deployProxy<PlanManager>(
        proxyAdmin,
        PlanManager__factory,
        wallet,
        overrides
    );
    const initPlanManager = await planManager.initialize(deployment.Settings.address, overrides);
    await initPlanManager.wait();
    updateDeployment(deployment, 'PlanManager', planManager.address, PMLogicAddr, planManager.deployTransaction.hash);

    const [purchaseOfferMarket, POMLogicAddr] = await deployProxy<PurchaseOfferMarket>(
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
        POMLogicAddr,
        purchaseOfferMarket.deployTransaction.hash
    );

    const [serviceAgreementRegistry, SARLogicAddr] = await deployProxy<ServiceAgreementRegistry>(
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
        SARLogicAddr,
        serviceAgreementRegistry.deployTransaction.hash
    );

    const [rewardsDistributer, RDLogicAddr] = await deployProxy<RewardsDistributer>(
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
        RDLogicAddr,
        rewardsDistributer.deployTransaction.hash
    );

    const [stateChannel, SCLogicAddr] = await deployProxy<StateChannel>(
        proxyAdmin,
        StateChannel__factory,
        wallet,
        overrides
    );
    const initStateChannel = await stateChannel.initialize(deployment.Settings.address, overrides);
    await initStateChannel.wait();
    updateDeployment(
        deployment,
        'StateChannel',
        stateChannel.address,
        SCLogicAddr,
        stateChannel.deployTransaction.hash
    );

    const [permissionedExchange, PELogicAddr] = await deployProxy<PermissionedExchange>(
        proxyAdmin,
        PermissionedExchange__factory,
        wallet,
        overrides
    );
    const initPermissionedExchange = await permissionedExchange.initialize(deployment.Settings.address, overrides);
    await initPermissionedExchange.wait();
    updateDeployment(
        deployment,
        'PermissionedExchange',
        permissionedExchange.address,
        PELogicAddr,
        permissionedExchange.deployTransaction.hash
    );

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
            vtoken: vsqtToken,
            staking,
            eraManager,
            indexerRegistry,
            queryRegistry,
            planManager,
            purchaseOfferMarket,
            serviceAgreementRegistry,
            rewardsDistributer,
            proxyAdmin,
            stateChannel,
            airdropper,
            permissionedExchange,
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
        const [logicAddr, deployTx] = await upgradeContract(proxyAdmin, address, factory, wallet, overrides);
        updateDeployment(deployment, contract, address, logicAddr, deployTx);
    }
    return deployment;
}
