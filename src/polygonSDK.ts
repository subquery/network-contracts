import type { Provider as AbstractProvider } from '@ethersproject/abstract-provider';
import {BigNumber, BigNumberish, Signer, utils} from 'ethers';
import { DEPLOYMENT_DETAILS } from './deployments';
import {
    ERC20,
    SQToken,
} from './typechain';
import {
    CONTRACT_FACTORY, ContractDeployment, PolygonSdkOptions,
} from './types';
import {POSClient, use, setProofApi} from "@maticnetwork/maticjs";
import { Web3ClientPlugin } from '@maticnetwork/maticjs-ethers';
use(Web3ClientPlugin);
setProofApi("https://proof-generator.polygon.technology/");

export class PolygonSDK {
    private _contractDeployments: ContractDeployment;

    readonly sqToken: SQToken;
    readonly childToken: ERC20;
    private _posClient: POSClient;
    private signerAddress?: string;

    constructor(private readonly wallet: Signer, private readonly providers: {root: AbstractProvider, child: AbstractProvider}, public readonly options: PolygonSdkOptions) {
        this._contractDeployments = this.options.deploymentDetails ?? DEPLOYMENT_DETAILS[options.network];
        this.sqToken = CONTRACT_FACTORY.SQToken.connect(this._contractDeployments.root.SQToken.address, this.wallet.connect(providers.root)) as SQToken;
        this.childToken = CONTRACT_FACTORY.ChildERC20.connect(this._contractDeployments.child.SQToken.address, this.wallet.connect(providers.child)) as ERC20;
        this._posClient = new POSClient();
    }

    static async create(wallet: Signer, providers: {root: AbstractProvider, child: AbstractProvider}, options: PolygonSdkOptions): Promise<PolygonSDK> {
        const sdk = new PolygonSDK(wallet, providers, options);
        return sdk._init();
    }

    async _init(): Promise<this>{
        this.signerAddress = await (this.wallet as Signer).getAddress();
        let version: string;
        if (this.options.network === 'testnet') {
            version = 'mumbai';
        } else if(this.options.network === 'mainnet' ) {
            version = 'v1';
        } else {
            throw new Error(`unsupported network ${this.options.network}`)
        }
        await this._posClient.init({
            network: this.options.network,
            version,
            parent: {
                provider: this.wallet.connect(this.providers.root),
                defaultConfig:{
                    from: this.signerAddress,
                }
            },
            child:{
                provider: this.wallet.connect(this.providers.child),
                defaultConfig: {
                    from: this.signerAddress,
                }
            }
        })
        return this;
    }

    async approveDeposit(amount: BigNumberish) {
        const token = this._posClient.erc20(this.sqToken.address, true);
        return token.approve(BigNumber.from(amount).toString());
    }

    async depositFor(amount: BigNumberish, addr?: string, ) {
        const token = this._posClient.erc20(this.sqToken.address, true);
        return token.deposit(BigNumber.from(amount).toString(), addr ?? this.signerAddress!);
    }

    async withdrawStart(amount: BigNumberish) {
        const token = this._posClient.erc20(this.childToken.address, false);
        const tx = await token.withdrawStart(BigNumber.from(amount).toString());
        return tx.getReceipt();
    }

    async withdrawExit(withdrawTx: string) {
        const isCheckPointed = await this._posClient.isCheckPointed(withdrawTx);
        if (!isCheckPointed) {
            throw new Error('checkpoint hasn\'t been reached');
        }
        const token = this._posClient.erc20(this.childToken.address, false);
        const tx = await token.withdrawExitFaster(withdrawTx);
        return tx.getReceipt();
    }

    async isCheckPointed(txHash: string) {
        return this._posClient.isCheckPointed(txHash)
    }

    async isWithdrawExited(txHash: string) {
        const token = this._posClient.erc20(this.childToken.address, false);
        return token.isWithdrawExited(txHash);
    }
}
