import type {Contract, Signer} from 'ethers';
import type {Provider as AbstractProvider} from '@ethersproject/abstract-provider';
import {ContractDeployment, ContractName, SdkOptions} from './types';
import {
    SQToken,
    SQToken__factory,
    Settings,
    Settings__factory,
    Staking,
    Staking__factory,
    StakingManager,
    StakingManager__factory,
    IndexerRegistry,
    IndexerRegistry__factory,
    InflationController,
    InflationController__factory,
    QueryRegistry,
    QueryRegistry__factory,
    ServiceAgreementRegistry,
    ServiceAgreementRegistry__factory,
    EraManager,
    EraManager__factory,
    PlanManager,
    PlanManager__factory,
    RewardsDistributer,
    RewardsDistributer__factory,
    RewardsPool,
    RewardsPool__factory,
    RewardsStaking,
    RewardsStaking__factory,
    RewardsHelper,
    RewardsHelper__factory,
    PurchaseOfferMarket,
    PurchaseOfferMarket__factory,
    StateChannel,
    StateChannel__factory,
    Airdropper,
    Airdropper__factory,
    PermissionedExchange,
    PermissionedExchange__factory,
    ConsumerHost,
    ConsumerHost__factory,
    DisputeManager,
    DisputeManager__factory,
    ProxyAdmin,
    ProxyAdmin__factory,
    Vesting,
    Vesting__factory
} from './typechain';
import { CONTRACT_FACTORY, FactoryContstructor } from './types';

export class ContractSDK {
  private _contractDeployments: ContractDeployment;

  // private _settings?: Settings;
  // private _sqToken?: SQToken;
  // private _staking?: Staking;
  // private _stakingManager?: StakingManager;
  // private _indexerRegistry?: IndexerRegistry;
  // private _queryRegistry?: QueryRegistry;
  // private _inflationController?: InflationController;
  // private _serviceAgreementRegistry?: ServiceAgreementRegistry;
  // private _eraManager?: EraManager;
  // private _planManager?: PlanManager;
  // private _rewardsDistributor?: RewardsDistributer;
  // private _rewardsPool?: RewardsPool;
  // private _rewardsStaking?: RewardsStaking;
  // private _rewardsHelper?: RewardsHelper;
  // private _purchaseOfferMarket?: PurchaseOfferMarket;
  // private _stateChannel?: StateChannel;
  // private _airdropper?: Airdropper;
  // private _permissionedExchange?: PermissionedExchange;
  // private _consumerHost?: ConsumerHost;
  // private _disputeManager?: DisputeManager;
  // private _proxyAdmin?: ProxyAdmin;
  // private _vesting?: Vesting;

  private contracts: Record<string, Contract> = {};

  constructor(
    private readonly signerOrProvider: AbstractProvider | Signer,
    public readonly options?: SdkOptions
  ) {
    const defaultOptions = require(`./publish/${options?.network || 'testnet'}.json`);
    this._contractDeployments = options?.deploymentDetails || defaultOptions;
    this._init();
    this.createProxy();
  }

  // create getter for private properties dynamically
  createProxy() {
    return new Proxy(this, {
      get(target, prop) {
        if (target.hasOwnProperty(prop) &&typeof prop === 'string' && prop.startsWith('_')) {
          return target[prop];
        }

        return target[prop];
      }
    });
  }

  private async _init() {
    const contracts = Object.entries(this._contractDeployments).map(([name, info]) => ({
      address: info.address,
      factory: CONTRACT_FACTORY[name] as FactoryContstructor,
      name: name as ContractName,
    }))

    for (const { name, factory, address } of contracts) {
      const contractInstance = factory.connect(address, this.signerOrProvider);
      if (contractInstance) {
        const key = `_${name.charAt(0).toLowerCase() + name.slice(1)}`;
        if (this.hasOwnProperty(key)) {
          this[key] = contractInstance;
        }
        
      } else {
        throw new Error(`${name} contract not found`);
      }
    }
  }

  public getContract(contractType: string): Contract {
    const contract = this.contracts[contractType];

    if (!contract) {
      throw new Error(`Contract of type '${contractType}' not found`);
    }

    return contract;
  }
}