import {Wallet} from '@ethersproject/wallet';
import {BaseContract, ContractFactory, Signer} from 'ethers';
import {Provider} from '@ethersproject/abstract-provider';

import {
    SQToken__factory,
    Settings__factory,
    Staking__factory,
    StakingManager__factory,
    IndexerRegistry__factory,
    InflationController__factory,
    QueryRegistry__factory,
    ServiceAgreementRegistry__factory,
    EraManager__factory,
    PlanManager__factory,
    RewardsDistributer__factory,
    RewardsPool__factory,
    RewardsStaking__factory,
    RewardsHelper__factory,
    PurchaseOfferMarket__factory,
    StateChannel__factory,
    Airdropper__factory,
    PermissionedExchange__factory,
    ConsumerHost__factory,
    DisputeManager__factory,
    ProxyAdmin__factory,
    Vesting__factory,
    VSQToken__factory,
    PriceOracle__factory,
    ConsumerRegistry__factory,
    TokenExchange__factory,
} from './typechain';
import type CONTRACTS from './contracts';

export type SubqueryNetwork = 'mainnet' | 'kepler' | 'testnet' | 'local';

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
    network: Network;
    contracts: {[contract: string]: any[]};
};

export type ContractDeploymentDetail = {
    innerAddress?: string;
    address: string;
    bytecodeHash: string;
    lastUpdate: string;
};
export type ContractDeployment = Record<keyof typeof CONTRACTS, ContractDeploymentDetail>;

export type ContractName = keyof ContractDeployment;

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
    PriceOracle: PriceOracle__factory,
    ConsumerRegistry: ConsumerRegistry__factory,
    TokenExchange: TokenExchange__factory,
};
