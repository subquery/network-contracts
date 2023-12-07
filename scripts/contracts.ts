import { Provider } from '@ethersproject/abstract-provider';
import { Wallet } from '@ethersproject/wallet';
import { BaseContract, BigNumber, ContractFactory, Signer } from 'ethers';

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
    RewardsDistributer,
    RewardsDistributer__factory,
    RewardsHelper,
    RewardsHelper__factory,
    RewardsPool,
    RewardsPool__factory,
    RewardsStaking,
    RewardsStaking__factory,
    IERC20,
    SQToken,
    SQToken__factory,
    ServiceAgreementRegistry,
    ServiceAgreementRegistry__factory,
    ServiceAgreementExtra,
    ServiceAgreementExtra__factory,
    Settings,
    Settings__factory,
    Staking,
    StakingManager,
    StakingManager__factory,
    Staking__factory,
    StateChannel,
    StateChannel__factory,
    VSQToken,
    VSQToken__factory,
    Vesting,
    Vesting__factory,
    EventSyncRootTunnel,
    EventSyncRootTunnel__factory,
} from '../src';
import ChildERC20 from "../artifacts/contracts/polygon/ChildERC20.sol/ChildERC20.json";
import {ChildERC20__factory} from "../build";

export interface FactoryContstructor {
    new(wallet: Wallet): ContractFactory;
    connect: (address: string, signerOrProvider: Signer | Provider) => BaseContract;
    readonly abi: any;
}

export type Contracts = {
    proxyAdmin: ProxyAdmin;
    settings: Settings;
    inflationController: InflationController;
    token: IERC20;
    vtoken: VSQToken;
    staking: Staking;
    stakingManager: StakingManager;
    eraManager: EraManager;
    indexerRegistry: IndexerRegistry;
    projectRegistry: ProjectRegistry;
    planManager: PlanManager;
    purchaseOfferMarket: PurchaseOfferMarket;
    serviceAgreementRegistry: ServiceAgreementRegistry;
    serviceAgreementExtra: ServiceAgreementExtra;
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
    consumerRegistry: ConsumerRegistry;
    priceOracle: PriceOracle;
    eventSyncRootTunnel: EventSyncRootTunnel;
};

export const UPGRADEBAL_CONTRACTS: Partial<Record<keyof typeof CONTRACTS, [{ bytecode: string }, FactoryContstructor]>> =
{
    InflationController: [CONTRACTS.InflationController, InflationController__factory],
    IndexerRegistry: [CONTRACTS.IndexerRegistry, IndexerRegistry__factory],
    PlanManager: [CONTRACTS.PlanManager, PlanManager__factory],
    ProjectRegistry: [CONTRACTS.ProjectRegistry, ProjectRegistry__factory],
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
    ConsumerRegistry: [CONTRACTS.ConsumerRegistry, ConsumerRegistry__factory],
    PriceOracle: [CONTRACTS.PriceOracle, PriceOracle__factory],
    Settings: [CONTRACTS.Settings, Settings__factory],
};

export const CONTRACT_FACTORY: Record<ContractName, FactoryContstructor> = {
    ProxyAdmin: ProxyAdmin__factory,
    Settings: Settings__factory,
    InflationController: InflationController__factory,
    SQToken: SQToken__factory,
    VSQToken: VSQToken__factory,
    Airdropper: Airdropper__factory,
    Vesting: Vesting__factory,
    Staking: Staking__factory,
    StakingManager: StakingManager__factory,
    EraManager: EraManager__factory,
    IndexerRegistry: IndexerRegistry__factory,
    ProjectRegistry: ProjectRegistry__factory,
    PlanManager: PlanManager__factory,
    PurchaseOfferMarket: PurchaseOfferMarket__factory,
    ServiceAgreementRegistry: ServiceAgreementRegistry__factory,
    ServiceAgreementExtra: ServiceAgreementExtra__factory,
    RewardsDistributer: RewardsDistributer__factory,
    RewardsPool: RewardsPool__factory,
    RewardsStaking: RewardsStaking__factory,
    RewardsHelper: RewardsHelper__factory,
    StateChannel: StateChannel__factory,
    PermissionedExchange: PermissionedExchange__factory,
    ConsumerHost: ConsumerHost__factory,
    DisputeManager: DisputeManager__factory,
    ConsumerRegistry: ConsumerRegistry__factory,
    PriceOracle: PriceOracle__factory,
    EventSyncRootTunnel: EventSyncRootTunnel__factory,
    ChildERC20: ChildERC20__factory,
};

export type Config = number | string | string[];
export type ContractConfig = Record<Partial<ContractName>, Config[]>;
