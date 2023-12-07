import type { Provider as AbstractProvider } from '@ethersproject/abstract-provider';
import { Signer } from 'ethers';
import { DEPLOYMENT_DETAILS } from './deployments';
import {
    Airdropper,
    ChildERC20,
    ConsumerHost,
    ConsumerRegistry,
    DisputeManager,
    EraManager,
    IndexerRegistry,
    InflationController,
    PermissionedExchange,
    PlanManager,
    PriceOracle,
    ProjectRegistry,
    ProxyAdmin,
    PurchaseOfferMarket,
    RewardsDistributer,
    RewardsHelper,
    RewardsPool,
    RewardsStaking,
    SQToken,
    ServiceAgreementExtra,
    ServiceAgreementRegistry,
    Settings,
    Staking,
    StakingManager,
    StateChannel,
    VSQToken,
    Vesting,
} from './typechain';
import {
    CONTRACT_FACTORY,
    ContractDeploymentInner,
    ContractName,
    FactoryContstructor,
    SdkOptions
} from './types';

// HOTFIX: Contract names are not consistent between deployments and privous var names
const contractNameConversion: Record<string, string> = {
    sQToken: 'sqToken',
    rewardsDistributer: 'rewardsDistributor',
};

export class ContractSDK {
    private _contractDeployments: ContractDeploymentInner;

    readonly settings!: Settings;
    readonly sqToken!: ChildERC20;
    readonly staking!: Staking;
    readonly stakingManager!: StakingManager;
    readonly indexerRegistry!: IndexerRegistry;
    readonly projectRegistry!: ProjectRegistry;
    readonly inflationController!: InflationController;
    readonly serviceAgreementRegistry!: ServiceAgreementRegistry;
    readonly serviceAgreementExtra!: ServiceAgreementExtra;
    readonly eraManager!: EraManager;
    readonly planManager!: PlanManager;
    readonly rewardsDistributor!: RewardsDistributer;
    readonly rewardsPool!: RewardsPool;
    readonly rewardsStaking!: RewardsStaking;
    readonly rewardsHelper!: RewardsHelper;
    readonly purchaseOfferMarket!: PurchaseOfferMarket;
    readonly stateChannel!: StateChannel;
    readonly airdropper!: Airdropper;
    readonly permissionedExchange!: PermissionedExchange;
    readonly consumerHost!: ConsumerHost;
    readonly disputeManager!: DisputeManager;
    readonly proxyAdmin!: ProxyAdmin;
    readonly vesting!: Vesting;
    readonly consumerRegistry!: ConsumerRegistry;
    readonly priceOracle!: PriceOracle;
    readonly vSQToken!: VSQToken;

    constructor(private readonly signerOrProvider: AbstractProvider | Signer, public readonly options: SdkOptions) {
        this._contractDeployments = this.options.deploymentDetails ?? DEPLOYMENT_DETAILS[options.network].child;
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
