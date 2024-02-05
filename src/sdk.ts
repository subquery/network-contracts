// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Provider as AbstractProvider } from '@ethersproject/abstract-provider';
import { Signer } from 'ethers';
import { DEPLOYMENT_DETAILS } from './deployments';
import {
    Airdropper,
    ConsumerHost,
    ConsumerRegistry,
    DisputeManager,
    EraManager,
    IndexerRegistry,
    PlanManager,
    PriceOracle,
    ProjectRegistry,
    ProxyAdmin,
    PurchaseOfferMarket,
    RewardsDistributor,
    RewardsHelper,
    RewardsPool,
    RewardsStaking,
    ServiceAgreementRegistry,
    Settings,
    Staking,
    StakingManager,
    StateChannel,
    VSQToken,
    SQTGift,
    SQTRedeem,
    ERC20,
    RewardsBooster,
    StakingAllocation,
} from './typechain';
import { CONTRACT_FACTORY, ContractDeploymentInner, ContractName, FactoryContstructor, SdkOptions } from './types';
import assert from 'assert';

// HOTFIX: Contract names are not consistent between deployments and privous var names
const contractNameConversion: Record<string, string> = {
    l2SQToken: 'sqToken',
    sQTGift: 'sqtGift',
    sQTRedeem: 'sqtRedeem',
};

export class ContractSDK {
    private _contractDeployments: ContractDeploymentInner;

    readonly settings!: Settings;
    readonly sqToken!: ERC20;
    readonly staking!: Staking;
    readonly stakingManager!: StakingManager;
    readonly indexerRegistry!: IndexerRegistry;
    readonly projectRegistry!: ProjectRegistry;
    readonly serviceAgreementRegistry!: ServiceAgreementRegistry;
    readonly eraManager!: EraManager;
    readonly planManager!: PlanManager;
    readonly rewardsBooster!: RewardsBooster;
    readonly rewardsDistributor!: RewardsDistributor;
    readonly rewardsPool!: RewardsPool;
    readonly rewardsStaking!: RewardsStaking;
    readonly rewardsHelper!: RewardsHelper;
    readonly purchaseOfferMarket!: PurchaseOfferMarket;
    readonly stateChannel!: StateChannel;
    readonly airdropper!: Airdropper;
    readonly consumerHost!: ConsumerHost;
    readonly disputeManager!: DisputeManager;
    readonly proxyAdmin!: ProxyAdmin;
    readonly consumerRegistry!: ConsumerRegistry;
    readonly priceOracle!: PriceOracle;
    readonly vSQToken!: VSQToken;
    readonly sqtGift!: SQTGift;
    readonly sqtRedeem!: SQTRedeem;
    readonly stakingAllocation!: StakingAllocation;

    constructor(
        // eslint-disable-next-line no-unused-vars
        private readonly signerOrProvider: AbstractProvider | Signer,
        public readonly options: SdkOptions
    ) {
        assert(
            this.options.deploymentDetails || DEPLOYMENT_DETAILS[options.network],
            ' missing contract deployment info'
        );
        this._contractDeployments = this.options.deploymentDetails ?? DEPLOYMENT_DETAILS[options.network]!.child;
        this._init();
    }

    static create(signerOrProvider: AbstractProvider | Signer, options: SdkOptions) {
        return new ContractSDK(signerOrProvider, options);
    }

    private async _init() {
        const contracts = Object.entries(this._contractDeployments).map(([name, contract]) => ({
            address: contract.address,
            factory: CONTRACT_FACTORY[name as ContractName] as FactoryContstructor,
            name: name as ContractName,
        }));

        for (const { name, factory, address } of contracts) {
            const contractInstance = factory.connect(address, this.signerOrProvider);
            if (contractInstance) {
                const key = name.charAt(0).toLowerCase() + name.slice(1);
                const contractName = contractNameConversion[key] ?? key;
                Object.defineProperty(this, contractName, {
                    get: () => contractInstance,
                });
            } else {
                throw new Error(`${name} contract not found`);
            }
        }
    }
}
