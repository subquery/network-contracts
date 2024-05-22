import CONTRACTS from '../src/contracts';

import {
    Airdropper,
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
    PlanManager,
    PlanManager__factory,
    PriceOracle,
    PriceOracle__factory,
    ProjectRegistry,
    ProjectRegistry__factory,
    ProxyAdmin,
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
    Vesting,
    OpDestination,
    SQTGift__factory,
    SQTGift,
    SQTRedeem__factory,
    SQTRedeem,
    VTSQToken,
    FactoryContstructor,
    AirdropperLite__factory,
    AirdropperLite,
    L2Vesting,
    L2Vesting__factory,
    Airdropper__factory,
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
    l2Vesting: L2Vesting;
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
    SQTRedeem: [CONTRACTS.SQTRedeem, SQTRedeem__factory],
    L2Vesting: [CONTRACTS.L2Vesting, L2Vesting__factory],
    Airdropper: [CONTRACTS.Airdropper, Airdropper__factory],
};

export type Config = number | string | string[];
export type ContractConfig = Partial<Record<ContractName, Config[]>>;
