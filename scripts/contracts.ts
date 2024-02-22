import CONTRACTS from '../src/contracts';

import {
    Airdropper,
    Airdropper__factory,
    ConsumerHost,
    ConsumerHost__factory,
    ConsumerRegistry,
    ConsumerRegistry__factory,
    ContractName,
    DisputeManager,
    DisputeManager__factory,
    EraManager,
    EraManager__factory,
    IndexerRegistry,
    IndexerRegistry__factory,
    InflationController,
    InflationController__factory,
    PermissionedExchange,
    PermissionedExchange__factory,
    TokenExchange,
    TokenExchange__factory,
    PlanManager,
    PlanManager__factory,
    PriceOracle,
    PriceOracle__factory,
    ProjectRegistry,
    ProjectRegistry__factory,
    ProxyAdmin,
    ProxyAdmin__factory,
    PurchaseOfferMarket,
    PurchaseOfferMarket__factory,
    RewardsDistributor,
    RewardsDistributor__factory,
    RewardsHelper,
    RewardsHelper__factory,
    RewardsPool,
    RewardsPool__factory,
    RewardsStaking,
    RewardsStaking__factory,
    RewardsBooster,
    RewardsBooster__factory,
    ERC20,
    SQToken,
    SQToken__factory,
    ServiceAgreementRegistry,
    ServiceAgreementRegistry__factory,
    Settings,
    Settings__factory,
    Staking,
    Staking__factory,
    StakingManager,
    StakingManager__factory,
    StakingAllocation,
    StakingAllocation__factory,
    StateChannel,
    StateChannel__factory,
    VSQToken,
    VSQToken__factory,
    Vesting,
    Vesting__factory,
    OpDestination,
    OpDestination__factory,
    SQTGift__factory,
    SQTGift,
    SQTRedeem__factory,
    SQTRedeem,
    VTSQToken,
    VTSQToken__factory,
    L2SQToken__factory,
    FactoryContstructor,
    AirdropperLite__factory,
    AirdropperLite,
} from '../src';

export type Contracts = {
    proxyAdmin: ProxyAdmin;
    settings: Settings;
    inflationController: InflationController;
    rootToken: SQToken;
    token: ERC20;
    vtoken: VSQToken;
    staking: Staking;
    stakingManager: StakingManager;
    stakingAllocation: StakingAllocation;
    eraManager: EraManager;
    indexerRegistry: IndexerRegistry;
    projectRegistry: ProjectRegistry;
    planManager: PlanManager;
    purchaseOfferMarket: PurchaseOfferMarket;
    serviceAgreementRegistry: ServiceAgreementRegistry;
    rewardsDistributor: RewardsDistributor;
    rewardsPool: RewardsPool;
    rewardsStaking: RewardsStaking;
    rewardsHelper: RewardsHelper;
    rewardsBooster: RewardsBooster;
    stateChannel: StateChannel;
    airdropper: Airdropper;
    permissionedExchange: PermissionedExchange;
    tokenExchange: TokenExchange;
    vesting: Vesting;
    vtSQToken: VTSQToken;
    consumerHost: ConsumerHost;
    disputeManager: DisputeManager;
    consumerRegistry: ConsumerRegistry;
    priceOracle: PriceOracle;
    opDestination: OpDestination;
    sqtGift: SQTGift;
    sqtRedeem: SQTRedeem;
    airdropperLite: AirdropperLite;
};

export const UPGRADEBAL_CONTRACTS: Partial<
    Record<keyof typeof CONTRACTS, [{ bytecode: string }, FactoryContstructor]>
> = {
    InflationController: [CONTRACTS.InflationController, InflationController__factory],
    IndexerRegistry: [CONTRACTS.IndexerRegistry, IndexerRegistry__factory],
    PlanManager: [CONTRACTS.PlanManager, PlanManager__factory],
    ProjectRegistry: [CONTRACTS.ProjectRegistry, ProjectRegistry__factory],
    RewardsDistributor: [CONTRACTS.RewardsDistributor, RewardsDistributor__factory],
    RewardsPool: [CONTRACTS.RewardsPool, RewardsPool__factory],
    RewardsStaking: [CONTRACTS.RewardsStaking, RewardsStaking__factory],
    RewardsHelper: [CONTRACTS.RewardsHelper, RewardsHelper__factory],
    RewardsBooster: [CONTRACTS.RewardsBooster, RewardsBooster__factory],
    ServiceAgreementRegistry: [CONTRACTS.ServiceAgreementRegistry, ServiceAgreementRegistry__factory],
    Staking: [CONTRACTS.Staking, Staking__factory],
    StakingManager: [CONTRACTS.StakingManager, StakingManager__factory],
    StakingAllocation: [CONTRACTS.StakingAllocation, StakingAllocation__factory],
    EraManager: [CONTRACTS.EraManager, EraManager__factory],
    PurchaseOfferMarket: [CONTRACTS.PurchaseOfferMarket, PurchaseOfferMarket__factory],
    StateChannel: [CONTRACTS.StateChannel, StateChannel__factory],
    PermissionedExchange: [CONTRACTS.PermissionedExchange, PermissionedExchange__factory],
    ConsumerHost: [CONTRACTS.ConsumerHost, ConsumerHost__factory],
    DisputeManager: [CONTRACTS.DisputeManager, DisputeManager__factory],
    ConsumerRegistry: [CONTRACTS.ConsumerRegistry, ConsumerRegistry__factory],
    PriceOracle: [CONTRACTS.PriceOracle, PriceOracle__factory],
    Settings: [CONTRACTS.Settings, Settings__factory],
    SQTGift: [CONTRACTS.SQTGift, SQTGift__factory],
    AirdropperLite: [CONTRACTS.AirdropperLite, AirdropperLite__factory],
};

export const CONTRACT_FACTORY: Record<ContractName, FactoryContstructor> = {
    ProxyAdmin: ProxyAdmin__factory,
    Settings: Settings__factory,
    InflationController: InflationController__factory,
    SQToken: SQToken__factory,
    VSQToken: VSQToken__factory,
    Airdropper: Airdropper__factory,
    Vesting: Vesting__factory,
    VTSQToken: VTSQToken__factory,
    Staking: Staking__factory,
    StakingManager: StakingManager__factory,
    StakingAllocation: StakingAllocation__factory,
    EraManager: EraManager__factory,
    IndexerRegistry: IndexerRegistry__factory,
    ProjectRegistry: ProjectRegistry__factory,
    PlanManager: PlanManager__factory,
    PurchaseOfferMarket: PurchaseOfferMarket__factory,
    ServiceAgreementRegistry: ServiceAgreementRegistry__factory,
    RewardsDistributor: RewardsDistributor__factory,
    RewardsPool: RewardsPool__factory,
    RewardsStaking: RewardsStaking__factory,
    RewardsHelper: RewardsHelper__factory,
    RewardsBooster: RewardsBooster__factory,
    StateChannel: StateChannel__factory,
    PermissionedExchange: PermissionedExchange__factory,
    TokenExchange: TokenExchange__factory,
    ConsumerHost: ConsumerHost__factory,
    DisputeManager: DisputeManager__factory,
    ConsumerRegistry: ConsumerRegistry__factory,
    PriceOracle: PriceOracle__factory,
    OpDestination: OpDestination__factory,
    SQTGift: SQTGift__factory,
    SQTRedeem: SQTRedeem__factory,
    L2SQToken: L2SQToken__factory,
    AirdropperLite: AirdropperLite__factory,
};

export type Config = number | string | string[];
export type ContractConfig = Partial<Record<ContractName, Config[]>>;
