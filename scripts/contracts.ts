import {Wallet} from '@ethersproject/wallet';
import {BaseContract, BigNumber, ContractFactory, Signer} from 'ethers';
import {Provider} from '@ethersproject/abstract-provider';

import CONTRACTS from '../src/contracts';

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
    ConsumerRegistry__factory,
    ConsumerRegistry,
    ContractName,
} from '../src';

export interface FactoryContstructor {
    new (wallet: Wallet): ContractFactory;
    connect: (address: string, signerOrProvider: Signer | Provider) => BaseContract;
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
    consumerRegistry: ConsumerRegistry;
};

export const UPGRADEBAL_CONTRACTS: Partial<Record<keyof typeof CONTRACTS, [{bytecode: string}, FactoryContstructor]>> =
    {
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
        ConsumerRegistry: [CONTRACTS.ConsumerRegistry, ConsumerRegistry__factory],
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
    QueryRegistry: QueryRegistry__factory,
    PlanManager: PlanManager__factory,
    PurchaseOfferMarket: PurchaseOfferMarket__factory,
    ServiceAgreementRegistry: ServiceAgreementRegistry__factory,
    RewardsDistributer: RewardsDistributer__factory,
    RewardsPool: RewardsPool__factory,
    RewardsStaking: RewardsStaking__factory,
    RewardsHelper: RewardsHelper__factory,
    StateChannel: StateChannel__factory,
    PermissionedExchange: PermissionedExchange__factory,
    ConsumerHost: ConsumerHost__factory,
    DisputeManager: DisputeManager__factory,
    ConsumerRegistry: ConsumerRegistry__factory,
};

export type Config = number | string | BigNumber | string[];
export type ContractConfig = Record<ContractName, Config[]>;
