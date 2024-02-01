// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

/* eslint-disable */
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
    RewardsDistributor__factory,
    RewardsHelper__factory,
    RewardsPool__factory,
    RewardsStaking__factory,
    ServiceAgreementRegistry__factory,
    Settings__factory,
    StakingManager__factory,
    Staking__factory,
    StateChannel__factory,
    VSQToken__factory,
    Vesting__factory,
    VTSQToken__factory,
    SQToken__factory,
    TokenExchange__factory,
    OpDestination__factory,
    SQTGift__factory,
    SQTRedeem__factory,
    RewardsBooster__factory,
    StakingAllocation__factory,
    AllocationMananger__factory,
    L2SQToken__factory,
} from './typechain';

export type SubqueryNetwork = 'testnet' | 'testnet-mumbai' | 'mainnet' | 'local';

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
    contracts: { [contract: string]: any[] };
};

export type ContractDeploymentDetail = {
    innerAddress?: string;
    address: string;
    bytecodeHash: string;
    lastUpdate: string;
};

export type ContractName = keyof typeof CONTRACTS;

export type ContractDeploymentInner = Partial<Record<ContractName, ContractDeploymentDetail>>;
export type ContractDeployment = {
    root: ContractDeploymentInner;
    child: ContractDeploymentInner;
};

export type SdkOptions = {
    network: SubqueryNetwork;
    deploymentDetails?: ContractDeploymentInner;
};
export type PolygonSdkOptions = {
    network: SubqueryNetwork;
    deploymentDetails?: ContractDeployment;
};

export interface FactoryContstructor {
    new (wallet: Wallet): ContractFactory;
    connect: (address: string, signerOrProvider: Signer | Provider) => BaseContract;
    readonly abi: any;
}

// for child sdk only
export const CONTRACT_FACTORY: Record<ContractName, FactoryContstructor> = {
    ProxyAdmin: ProxyAdmin__factory,
    Settings: Settings__factory,
    InflationController: InflationController__factory,
    SQToken: SQToken__factory, // for child sdk only
    VSQToken: VSQToken__factory,
    Airdropper: Airdropper__factory,
    Vesting: Vesting__factory,
    VTSQToken: VTSQToken__factory,
    Staking: Staking__factory,
    StakingManager: StakingManager__factory,
    StakingAllocation: StakingAllocation__factory,
    AllocationManager: AllocationMananger__factory,
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
    PriceOracle: PriceOracle__factory,
    ConsumerRegistry: ConsumerRegistry__factory,
    OpDestination: OpDestination__factory,
    SQTGift: SQTGift__factory,
    SQTRedeem: SQTRedeem__factory,
    L2SQToken: L2SQToken__factory,
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
    RewardsDistributor,
    RewardsPool,
    RewardsStaking,
    RewardsHelper,
    InflationController,
    Vesting,
    DisputeManager,
    StateChannel,
    ConsumerRegistry,
    PriceOracle,
    Treasury,
    RewardsBooster,
    StakingAllocation,
    AllocationMananger,
}

export enum ServiceStatus {
    TERMINATED,
    READY,
}

export enum ProjectType {
    SUBQUERY,
    RPC,
}
