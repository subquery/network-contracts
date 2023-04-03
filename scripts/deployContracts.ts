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
    confirms: number
): Promise<[C, string]> => {
    const contractFactory = new ContractFactory(wallet);
    let contractLogic = await contractFactory.deploy(await getOverrides(wallet));
    await contractLogic.deployTransaction.wait(confirms);

    const adminUpgradabilityProxyFactory = new AdminUpgradeabilityProxy__factory(wallet);

    const contractProxy = await adminUpgradabilityProxyFactory.deploy(
        contractLogic.address,
        proxyAdmin.address,
        [],
        await getOverrides(wallet)
    );
    await contractProxy.deployTransaction.wait(confirms);

    const proxy = contractFactory.attach(contractProxy.address) as C;
    (proxy as any).deployTransaction = contractLogic.deployTransaction;
    return [proxy, contractLogic.address];
};

export const upgradeContract = async (
    proxyAdmin: ProxyAdmin,
    proxyAddress: string,
    ContractFactory: FactoryContstructor,
    wallet: Wallet,
    confirms: number
): Promise<[string, string]> => {
    const contractFactory = new ContractFactory(wallet);
    let contractLogic = await contractFactory.deploy(await getOverrides(wallet));
    await contractLogic.deployTransaction.wait(confirms);

    const tx = await proxyAdmin.upgrade(proxyAddress, contractLogic.address);
    await tx.wait(confirms);

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

async function getOverrides(wallet: Wallet) {
    const price = await wallet.provider.getGasPrice();
    const gasPrice = price.add(10000000000);
    return { gasPrice };
}

export async function deployContracts(
    wallet: Wallet,
    config: DeploymentConfig['contracts'],
    confirms: number | 0 = 0
): Promise<[Partial<ContractDeployment>, Contracts]> {
    let logger = getLogger('deployContracts');
    const deployment: Partial<ContractDeployment> = {};
    if (process.env.DEBUG) {
        logger.info(colorText(`deploy start, from wallet ${wallet.address}`, TextColor.YELLOW));
    }
    const proxyAdmin = await new ProxyAdmin__factory(wallet).deploy(await getOverrides(wallet));
    await proxyAdmin.deployTransaction.wait(confirms);
    if (process.env.DEBUG) {
        console.log(`Deploy proxyAdmin: ${proxyAdmin.deployTransaction.hash}`);
    }
    updateDeployment(deployment, 'ProxyAdmin', proxyAdmin.address, '', proxyAdmin.deployTransaction.hash);

    // deploy settings contract
    const settings = await new Settings__factory(wallet).deploy(await getOverrides(wallet));
    await settings.deployTransaction.wait(confirms);
    if (process.env.DEBUG) {
        console.log(`Deploy settings: ${settings.deployTransaction.hash}`);
    }
    updateDeployment(deployment, 'Settings', settings.address, '', settings.deployTransaction.hash);

    // deploy InflationController contract
    const [inflationController, ICInnerAddr] = await deployProxy<InflationController>(
        proxyAdmin,
        InflationController__factory,
        wallet,
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy inflationController: ${inflationController.deployTransaction.hash}`);
    }
    const inflationInit = await inflationController.initialize(
        deployment.Settings.address,
        ...(config['InflationController'] as [number, string]),
        await getOverrides(wallet)
    );
    await inflationInit.wait(confirms);
    updateDeployment(
        deployment,
        'InflationController',
        inflationController.address,
        ICInnerAddr,
        inflationController.deployTransaction.hash
    );

    // deploy SQToken contract
    const sqtToken = await new SQToken__factory(wallet).deploy(deployment.InflationController.address, await getOverrides(wallet));
    await sqtToken.deployTransaction.wait(confirms);
    if (process.env.DEBUG) {
        console.log(`Deploy sqtToken: ${sqtToken.deployTransaction.hash}`);
    }
    updateDeployment(deployment, 'SQToken', sqtToken.address, '', sqtToken.deployTransaction.hash);

    // deploy VSQToken contract
    const vsqtToken = await new VSQToken__factory(wallet).deploy(await getOverrides(wallet));
    if (process.env.DEBUG) {
        console.log(`Deploy vsqtToken: ${vsqtToken.deployTransaction.hash}`);
    }
    const initVsqtToken = await vsqtToken.initialize(deployment.Settings.address, await getOverrides(wallet));
    await initVsqtToken.wait(confirms);
    updateDeployment(deployment, 'VSQToken', vsqtToken.address, '', vsqtToken.deployTransaction.hash);

    //deploy Airdropper contract
    const airdropper = await new Airdropper__factory(wallet).deploy(await getOverrides(wallet));
    await airdropper.deployTransaction.wait(confirms);
    if (process.env.DEBUG) {
        console.log(`Deploy airdropper: ${airdropper.deployTransaction.hash}`);
    }
    updateDeployment(deployment, 'Airdropper', airdropper.address, '', airdropper.deployTransaction.hash);

    //deploy vesting contract
    const vesting = await new Vesting__factory(wallet).deploy(deployment.SQToken.address, await getOverrides(wallet));
    await vesting.deployTransaction.wait(confirms);
    if (process.env.DEBUG) {
        console.log(`Deploy vesting: ${vesting.deployTransaction.hash}`);
    }
    updateDeployment(deployment, 'Vesting', vesting.address, '', vesting.deployTransaction.hash);

    // deploy Staking contract
    const [staking, SInnerAddr] = await deployProxy<Staking>(proxyAdmin, Staking__factory, wallet, confirms);
    if (process.env.DEBUG) {
        console.log(`Deploy staking: ${staking.deployTransaction.hash}`);
    }
    const initStaking = await staking.initialize(
        ...(config['Staking'] as [number]),
        deployment.Settings.address,
        await getOverrides(wallet)
    );
    await initStaking.wait(confirms);
    updateDeployment(deployment, 'Staking', staking.address, SInnerAddr, staking.deployTransaction.hash);

    // deploy StakingManager contract
    const [stakingManager, SMInnerAddr] = await deployProxy<StakingManager>(
        proxyAdmin,
        StakingManager__factory,
        wallet,
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy stakingManager: ${stakingManager.deployTransaction.hash}`);
    }
    const stakingManagerInit = await stakingManager.initialize(deployment.Settings.address, await getOverrides(wallet));
    await stakingManagerInit.wait(confirms);
    updateDeployment(
        deployment,
        'StakingManager',
        stakingManager.address,
        SMInnerAddr,
        stakingManager.deployTransaction.hash
    );

    // deploy Era manager
    const [eraManager, EMInnerAddr] = await deployProxy<EraManager>(proxyAdmin, EraManager__factory, wallet, confirms);
    if (process.env.DEBUG) {
        console.log(`Deploy eraManager: ${eraManager.deployTransaction.hash}`);
    }
    const eraManagerInit = await eraManager.initialize(
        deployment.Settings.address,
        ...(config['EraManager'] as [number]),
        await getOverrides(wallet)
    );
    await eraManagerInit.wait(confirms);
    updateDeployment(deployment, 'EraManager', eraManager.address, EMInnerAddr, eraManager.deployTransaction.hash);

    // deploy IndexerRegistry contract
    const [indexerRegistry, IRInnerAddr] = await deployProxy<IndexerRegistry>(
        proxyAdmin,
        IndexerRegistry__factory,
        wallet,
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy indexerRegistry: ${indexerRegistry.deployTransaction.hash}`);
    }
    const initIndexer = await indexerRegistry.initialize(
        deployment.Settings.address,
        ...(config['IndexerRegistry'] as [string]),
        await getOverrides(wallet)
    );
    await initIndexer.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy queryRegistry: ${queryRegistry.deployTransaction.hash}`);
    }
    const initQuery = await queryRegistry.initialize(deployment.Settings.address, await getOverrides(wallet));
    await initQuery.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy planManager: ${planManager.deployTransaction.hash}`);
    }
    const initPlanManager = await planManager.initialize(deployment.Settings.address, await getOverrides(wallet));
    await initPlanManager.wait(confirms);
    updateDeployment(deployment, 'PlanManager', planManager.address, PMInnerAddr, planManager.deployTransaction.hash);

    const [purchaseOfferMarket, POMInnerAddr] = await deployProxy<PurchaseOfferMarket>(
        proxyAdmin,
        PurchaseOfferMarket__factory,
        wallet,
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy purchaseOfferMarket: ${purchaseOfferMarket.deployTransaction.hash}`);
    }
    const purchaseOfferMarketInit = await purchaseOfferMarket.initialize(
        deployment.Settings.address,
        ...(config['PurchaseOfferMarket'] as [number, string]),
        await getOverrides(wallet)
    );
    await purchaseOfferMarketInit.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy serviceAgreementRegistry: ${serviceAgreementRegistry.deployTransaction.hash}`);
    }
    const initSARegistry = await serviceAgreementRegistry.initialize(
        deployment.Settings.address,
        ...(config['ServiceAgreementRegistry'] as [number]),
        [planManager.address, purchaseOfferMarket.address]
    );
    await initSARegistry.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy rewardsDistributer: ${rewardsDistributer.deployTransaction.hash}`);
    }
    const initRewardsDistributer = await rewardsDistributer.initialize(deployment.Settings.address, await getOverrides(wallet));
    await initRewardsDistributer.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy rewardsPool: ${rewardsPool.deployTransaction.hash}`);
    }
    const initRewardsPool = await rewardsPool.initialize(deployment.Settings.address, await getOverrides(wallet));
    await initRewardsPool.wait(confirms);
    updateDeployment(deployment, 'RewardsPool', rewardsPool.address, RPInnerAddr, rewardsPool.deployTransaction.hash);

    const [rewardsStaking, RSInnerAddr] = await deployProxy<RewardsStaking>(
        proxyAdmin,
        RewardsStaking__factory,
        wallet,
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy rewardsStaking: ${rewardsStaking.deployTransaction.hash}`);
    }
    const initRewardsStaking = await rewardsStaking.initialize(deployment.Settings.address, await getOverrides(wallet));
    await initRewardsStaking.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy rewardsHelper: ${rewardsHelper.deployTransaction.hash}`);
    }
    const initRewardsHelper = await rewardsHelper.initialize(deployment.Settings.address, await getOverrides(wallet));
    await initRewardsHelper.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy stateChannel: ${stateChannel.deployTransaction.hash}`);
    }
    const initStateChannel = await stateChannel.initialize(deployment.Settings.address, await getOverrides(wallet));
    await initStateChannel.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy permissionedExchange: ${permissionedExchange.deployTransaction.hash}`);
    }
    const initPermissionedExchange = await permissionedExchange.initialize(
        deployment.Settings.address,
        [rewardsDistributer.address],
        await getOverrides(wallet)
    );
    await initPermissionedExchange.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy consumerHost: ${consumerHost.deployTransaction.hash}`);
    }
    const initConsumerHost = await consumerHost.initialize(
        settings.address,
        sqtToken.address,
        stateChannel.address,
        ...(config['ConsumerHost'] as [number]),
        await getOverrides(wallet)
    );
    await initConsumerHost.wait(confirms);
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
        confirms
    );
    if (process.env.DEBUG) {
        console.log(`Deploy disputeManager: ${disputeManager.deployTransaction.hash}`);
    }
    const initDisputeManager = await disputeManager.initialize(
        ...(config['DisputeManager'] as [string]),
        deployment.Settings.address,
        await getOverrides(wallet)
    );
    await initDisputeManager.wait(confirms);
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
        await getOverrides(wallet)
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
        await getOverrides(wallet)
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

export async function upgradeContracts(
    wallet: Wallet,
    deployment: ContractDeployment,
    confirms: number
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
        const [innerAddr, deployTx] = await upgradeContract(proxyAdmin, address, factory, wallet, confirms);
        updateDeployment(deployment, contract, address, innerAddr, deployTx);
    }
    return deployment;
}
