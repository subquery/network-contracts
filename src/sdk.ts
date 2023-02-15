import type {Contract, Signer} from 'ethers';
import type {Provider as AbstractProvider} from '@ethersproject/abstract-provider';
import {ContractDeployment, RevertCodes, SdkOptions} from './types';
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
} from './typechain';

import revertCodes from './publish/revertcode.json';

export class ContractSDK {
    static async create(signerOrProvider: AbstractProvider | Signer, options?: SdkOptions): Promise<ContractSDK> {
        const sdk = new ContractSDK(signerOrProvider, options);
        return sdk.isReady;
    }

    private _isReady: Promise<ContractSDK>;
    private _contractDeployments: ContractDeployment;
    private _revertCodes: RevertCodes;

    private _settings?: Settings;
    private _sqToken?: SQToken;
    private _staking?: Staking;
    private _stakingManager?: StakingManager;
    private _indexerRegistry?: IndexerRegistry;
    private _queryRegistry?: QueryRegistry;
    private _inflationController?: InflationController;
    private _serviceAgreementRegistry?: ServiceAgreementRegistry;
    private _eraManager?: EraManager;
    private _planManager?: PlanManager;
    private _rewardsDistributor?: RewardsDistributer;
    private _rewardsPool?: RewardsPool;
    private _rewardsStaking?: RewardsStaking;
    private _rewardsHelper?: RewardsHelper;
    private _purchaseOfferMarket?: PurchaseOfferMarket;
    private _stateChannel?: StateChannel;
    private _airdropper?: Airdropper;
    private _permissionedExchange?: PermissionedExchange;
    private _consumerHost?: ConsumerHost;

    constructor(private readonly signerOrProvider: AbstractProvider | Signer, public readonly options?: SdkOptions) {
        this._contractDeployments =
            options?.deploymentDetails || require(`./publish/${options?.network || 'testnet'}.json`);
        this._isReady = this._init().then(() => this);
    }

    get revertCodes(): RevertCodes {
        if (!this._revertCodes) {
            throw new Error(`revert codes cannot be found`);
        }
        return this._revertCodes;
    }

    get settings(): Settings {
        if (!this._settings) {
            throw new Error(`_settings address not found`);
        }
        return this._settings;
    }

    get sqToken(): SQToken {
        if (!this._sqToken) {
            throw new Error(`sqToken address not found`);
        }
        return this._sqToken;
    }

    get staking(): Staking {
        if (!this._staking) {
            throw new Error(`_staking address not found`);
        }
        return this._staking;
    }

    get stakingManager(): StakingManager {
        if (!this._stakingManager) {
            throw new Error(`_stakingManager address not found`);
        }
        return this._stakingManager;
    }

    get indexerRegistry(): IndexerRegistry {
        if (!this._indexerRegistry) {
            throw new Error(`_indexerRegistry address not found`);
        }
        return this._indexerRegistry;
    }

    get queryRegistry(): QueryRegistry {
        if (!this._queryRegistry) {
            throw new Error(`_queryRegistry address not found`);
        }
        return this._queryRegistry;
    }

    get inflationController(): InflationController {
        if (!this._inflationController) {
            throw new Error(`_inflationController address not found`);
        }
        return this._inflationController;
    }

    get serviceAgreementRegistry(): ServiceAgreementRegistry {
        if (!this._serviceAgreementRegistry) {
            throw new Error(`_serviceAgreementRegistry address not found`);
        }
        return this._serviceAgreementRegistry;
    }

    get eraManager(): EraManager {
        if (!this._eraManager) {
            throw new Error(`_eraManager address not found`);
        }
        return this._eraManager;
    }

    get planManager(): PlanManager {
        if (!this._planManager) {
            throw new Error(`_planManager address not found`);
        }
        return this._planManager;
    }

    get rewardsDistributor(): RewardsDistributer {
        if (!this._rewardsDistributor) {
            throw new Error(`_rewardsDistributer address not found`);
        }
        return this._rewardsDistributor;
    }

    get rewardsPool(): RewardsPool {
        if (!this._rewardsPool) {
            throw new Error(`_rewardsPool address not found`);
        }
        return this._rewardsPool;
    }

    get rewardsStaking(): RewardsStaking {
        if (!this._rewardsStaking) {
            throw new Error(`_rewardsStaking address not found`);
        }
        return this._rewardsStaking;
    }

    get rewardsHelper(): RewardsHelper {
        if (!this._rewardsHelper) {
            throw new Error(`_rewardsHelper address not found`);
        }
        return this._rewardsHelper;
    }

    get purchaseOfferMarket(): PurchaseOfferMarket {
        if (!this._purchaseOfferMarket) {
            throw new Error(`_purchaseOfferMarket address not found`);
        }
        return this._purchaseOfferMarket;
    }

    get isReady(): Promise<ContractSDK> {
        return this._isReady;
    }

    get stateChannel(): StateChannel {
        if (!this._stateChannel) {
            throw new Error(`_stateChannel address not found`);
        }
        return this._stateChannel;
    }

    get airdropper(): Airdropper {
        if (!this._airdropper) {
            throw new Error(`_airdropper address not found`);
        }
        return this._airdropper;
    }

    get permissionedExchange(): PermissionedExchange {
        if (!this._permissionedExchange) {
            throw new Error(`_permissionedExchange address not found`);
        }
        return this._permissionedExchange;
    }

    get consumerHost(): ConsumerHost {
        if (!this._consumerHost) {
            throw new Error(`_consumerHost address not found`);
        }
        return this._consumerHost;
    }

    public async initContract<C extends Contract>(
        factory: {connect: (address: string, signerOrProvider: AbstractProvider | Signer) => C},
        address?: string
    ): Promise<C | undefined> {
        if (!address) {
            return undefined;
        }
        return factory.connect(address, this.signerOrProvider);
    }

    private async _init(): Promise<void> {
        const [
            settings,
            sqToken,
            staking,
            stakingManager,
            indexerRegistry,
            queryRegistry,
            inflationController,
            serviceAgreementRegistry,
            eraManager,
            planManager,
            rewardsDistributor,
            rewardsPool,
            rewardsStaking,
            rewardsHelper,
            purchaseOfferMarket,
            stateChannel,
            airdropper,
            permissionedExchange,
            consumerHost,
        ] = await Promise.all([
            this.initContract(Settings__factory, this._contractDeployments.Settings?.address),
            this.initContract(SQToken__factory, this._contractDeployments.SQToken?.address),
            this.initContract(Staking__factory, this._contractDeployments.Staking?.address),
            this.initContract(StakingManager__factory, this._contractDeployments.StakingManager?.address),
            this.initContract(IndexerRegistry__factory, this._contractDeployments.IndexerRegistry?.address),
            this.initContract(QueryRegistry__factory, this._contractDeployments.QueryRegistry?.address),
            this.initContract(InflationController__factory, this._contractDeployments.InflationController.address),
            this.initContract(
                ServiceAgreementRegistry__factory,
                this._contractDeployments.ServiceAgreementRegistry.address
            ),
            this.initContract(EraManager__factory, this._contractDeployments.EraManager.address),
            this.initContract(PlanManager__factory, this._contractDeployments.PlanManager.address),
            this.initContract(RewardsDistributer__factory, this._contractDeployments.RewardsDistributer.address),
            this.initContract(RewardsPool__factory, this._contractDeployments.RewardsPool.address),
            this.initContract(RewardsStaking__factory, this._contractDeployments.RewardsStaking.address),
            this.initContract(RewardsHelper__factory, this._contractDeployments.RewardsHelper.address),
            this.initContract(PurchaseOfferMarket__factory, this._contractDeployments.PurchaseOfferMarket.address),
            this.initContract(StateChannel__factory, this._contractDeployments.StateChannel.address),
            this.initContract(Airdropper__factory, this._contractDeployments.Airdropper.address),
            this.initContract(PermissionedExchange__factory, this._contractDeployments.PermissionedExchange.address),
            this.initContract(ConsumerHost__factory, this._contractDeployments.ConsumerHost.address),
        ]);
        this._revertCodes = revertCodes;
        this._settings = settings;
        this._sqToken = sqToken;
        this._staking = staking;
        this._stakingManager = stakingManager;
        this._indexerRegistry = indexerRegistry;
        this._inflationController = inflationController;
        this._queryRegistry = queryRegistry;
        this._serviceAgreementRegistry = serviceAgreementRegistry;
        this._eraManager = eraManager;
        this._planManager = planManager;
        this._rewardsDistributor = rewardsDistributor;
        this._rewardsPool = rewardsPool;
        this._rewardsStaking = rewardsStaking;
        this._rewardsHelper = rewardsHelper;
        this._purchaseOfferMarket = purchaseOfferMarket;
        this._stateChannel = stateChannel;
        this._airdropper = airdropper;
        this._permissionedExchange = permissionedExchange;
        this._consumerHost = consumerHost;
    }
}
