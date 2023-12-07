import { Provider } from '@ethersproject/abstract-provider';
import { Wallet } from '@ethersproject/wallet';
import { BaseContract, ContractFactory, Signer } from 'ethers';

import type CONTRACTS from './contracts';
import {
    Airdropper__factory,
    ConsumerHost__factory,
    ConsumerRegistry__factory,
    DisputeManager__factory,
    EraManager__factory,
    IndexerRegistry__factory,
    InflationController__factory,
    PermissionedExchange__factory,
    PlanManager__factory,
    PriceOracle__factory,
    ProjectRegistry__factory,
    ProxyAdmin__factory,
    PurchaseOfferMarket__factory,
    RewardsDistributer__factory,
    RewardsHelper__factory,
    RewardsPool__factory,
    RewardsStaking__factory,
    SQToken__factory,
    ServiceAgreementRegistry__factory,
    ServiceAgreementExtra__factory,
    Settings__factory,
    StakingManager__factory,
    Staking__factory,
    StateChannel__factory,
    VSQToken__factory,
    Vesting__factory, EventSyncRootTunnel__factory, ChildERC20__factory
} from './typechain';

export type SubqueryNetwork = 'testnet' | 'mainnet'; //  'mainnet' | 'kepler' | 'testnet' | 'base-goerli' | 'goerli' | 'local';

export type NetworkPair = {
    root: Network;
    child: Network;
};

export type Network = {
    chainId: string;
    chainName: string;
    rpcUrls: string[];
    blockExplorerUrls: string[];
    iconUrls: string[];
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
};

export type DeploymentConfig = {
    network: NetworkPair;
    contracts: {[contract: string]: any[]};
};

export type ContractDeploymentDetail = {
    innerAddress?: string;
    address: string;
    bytecodeHash: string;
    lastUpdate: string;
};

export type ContractName = keyof typeof CONTRACTS;

export type ContractDeployment2 = Record<Partial<ContractName>, ContractDeploymentDetail>;
export type ContractDeployment = {
    root: ContractDeployment2;
    child: ContractDeployment2;
};

export type SdkOptions = {
    network: SubqueryNetwork;
    deploymentDetails?: ContractDeployment;
};

export interface FactoryContstructor {
    new (wallet: Wallet): ContractFactory;
    connect: (address: string, signerOrProvider: Signer | Provider) => BaseContract;
    readonly abi: any;
}

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
    PriceOracle: PriceOracle__factory,
    ConsumerRegistry: ConsumerRegistry__factory,
    EventSyncRootTunnel: EventSyncRootTunnel__factory,
    ChildERC20: ChildERC20__factory,
};

export enum SQContracts {
    SQToken,
    Staking,
    StakingManager,
    IndexerRegistry,
    ProjectRegistry,
    EraManager,
    PlanManager,
    ServiceAgreementRegistry,
    ServiceAgreementExtra,
    RewardsDistributer,
    RewardsPool,
    RewardsStaking,
    RewardsHelper,
    InflationController,
    Vesting,
    PermissionedExchange,
    DisputeManager,
    StateChannel,
    ConsumerRegistry,
    PriceOracle,
    EventSyncChildTunnel,
    EventSyncRootTunnel
};