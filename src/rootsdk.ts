import type { Provider as AbstractProvider } from '@ethersproject/abstract-provider';
import {BigNumber, BigNumberish, Signer, utils} from 'ethers';
import { DEPLOYMENT_DETAILS } from './deployments';
import {
    RootChainManager,
    SQToken,
} from './typechain';
import {
    CONTRACT_FACTORY,
    ContractDeploymentInner,
    SdkOptions
} from './types';
import {applyProviderWrappers} from "hardhat/internal/core/providers/construction";

export class ContractSDKRoot {
    private _contractDeployments: ContractDeploymentInner;

    readonly sqToken: SQToken;
    readonly rootChainManager: RootChainManager;
    private _predicateAddr?: string;
    private signerAddress?: string;

    constructor(private readonly signerOrProvider: AbstractProvider | Signer, public readonly options: SdkOptions) {
        this._contractDeployments = this.options.deploymentDetails ?? DEPLOYMENT_DETAILS[options.network].root;
        this.sqToken = CONTRACT_FACTORY.SQToken.connect(this._contractDeployments.SQToken.address, this.signerOrProvider) as SQToken;
        this.rootChainManager = CONTRACT_FACTORY.RootChainManager.connect(this._contractDeployments.RootChainManager.address, this.signerOrProvider) as RootChainManager;

    }

    static async create(signerOrProvider: AbstractProvider | Signer, options: SdkOptions): Promise<ContractSDKRoot> {
        const sdk = new ContractSDKRoot(signerOrProvider, options);
        return sdk._init();
    }

    async _init(): Promise<this>{
        const tokenType = await this.rootChainManager.tokenToType(this.sqToken.address);
        this._predicateAddr = await this.rootChainManager.typeToPredicate(tokenType);
        if ((this.signerOrProvider as Signer).getAddress ) {
            this.signerAddress = await (this.signerOrProvider as Signer).getAddress();
        }
        return this;
    }

    async approveDeposit(amount: BigNumberish, option?: {confirm: number}) {
        if (!this.signerAddress) {
            throw new Error('require valid signer');
        }
        if (!this._predicateAddr) {
            throw new Error('failed to read predicate address');
        }
        const allowance = await this.sqToken.allowance(this.signerAddress, this._predicateAddr);
        if (allowance.lt(amount)) {
            const tx = await this.sqToken.increaseAllowance(this._predicateAddr, BigNumber.from(amount).sub(allowance));
            return tx.wait(option?.confirm);
        }
    }

    async depositFor(addr: string, amount: BigNumberish) {
        return this.rootChainManager.depositFor(addr, this.sqToken.address, utils.defaultAbiCoder.encode(['uint256'], [BigNumber.from(amount)]));
    }
}
