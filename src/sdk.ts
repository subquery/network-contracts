import type {Signer} from 'ethers';
import type {Provider as AbstractProvider} from '@ethersproject/abstract-provider';
import {ContractDeployment, ContractName, SdkOptions, SubqueryNetwork} from './types';
import {
    SQToken,
    Settings,
    Staking,
    StakingManager,
    IndexerRegistry,
    InflationController,
    QueryRegistry,
    ServiceAgreementRegistry,
    EraManager,
    PlanManager,
    RewardsDistributer,
    RewardsPool,
    RewardsStaking,
    RewardsHelper,
    PurchaseOfferMarket,
    StateChannel,
    Airdropper,
    PermissionedExchange,
    ConsumerHost,
    DisputeManager,
    ProxyAdmin,
    Vesting,
} from './typechain';
import { CONTRACT_FACTORY, FactoryContstructor } from './types';

// The path is compatible with `build` folder
import mainnetDeployment from './publish/mainnet.json';
import keplerDeployment from './publish/kepler.json';
import testnetDeployment from './publish/testnet.json';
import moonbaseDeployment from './publish/moonbase.json';
import localDeployment from './publish/local.json';

const DEPLOYMENT_DETAILS: Record<SubqueryNetwork, ContractDeployment> = {
  mainnet: mainnetDeployment,
  kepler: keplerDeployment,
  testnet: testnetDeployment,
  moonbase: moonbaseDeployment,
  local: localDeployment,
};

export class ContractSDK {
  private _contractDeployments: ContractDeployment;

  readonly settings?: Settings;
  readonly sqToken?: SQToken;
  readonly staking?: Staking;
  readonly stakingManager?: StakingManager;
  readonly indexerRegistry?: IndexerRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly inflationController?: InflationController;
  readonly serviceAgreementRegistry?: ServiceAgreementRegistry;
  readonly eraManager?: EraManager;
  readonly planManager?: PlanManager;
  readonly rewardsDistributor?: RewardsDistributer;
  readonly rewardsPool?: RewardsPool;
  readonly rewardsStaking?: RewardsStaking;
  readonly rewardsHelper?: RewardsHelper;
  readonly purchaseOfferMarket?: PurchaseOfferMarket;
  readonly stateChannel?: StateChannel;
  readonly airdropper?: Airdropper;
  readonly permissionedExchange?: PermissionedExchange;
  readonly consumerHost?: ConsumerHost;
  readonly disputeManager?: DisputeManager;
  readonly proxyAdmin?: ProxyAdmin;
  readonly vesting?: Vesting;

  constructor(
    private readonly signerOrProvider: AbstractProvider | Signer,
    public readonly options: SdkOptions
  ) {
    this._contractDeployments = this.options.deploymentDetails ?? DEPLOYMENT_DETAILS[options.network];
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
    }))

    for (const { name, factory, address } of contracts) {
      const contractInstance = factory.connect(address, this.signerOrProvider);
      if (contractInstance) {
        const key = name.charAt(0).toLowerCase() + name.slice(1);
        Object.defineProperty(this, key, {
          get: () => contractInstance,
        });
      } else {
        throw new Error(`${name} contract not found`);
      }
    }
  }
}