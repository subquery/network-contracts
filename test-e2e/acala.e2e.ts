// import {calcEthereumTransactionParams, EvmRpcProvider} from '@acala-network/eth-providers';
// import {
//     serializeTransaction,
//     Eip712Transaction,
//     parseTransaction,
//     signTransaction
// } from '@acala-network/eth-transactions';
// import { ContractFactory, ethers, providers, utils, Wallet } from "ethers";
// import { Network } from "@ethersproject/networks";
// import { Provider } from '@ethersproject/abstract-provider';
// import { AccessListish, Transaction } from "@ethersproject/transactions";
// import { expect, use } from "chai";
// import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
// import { TransactionRequest } from "@ethersproject/abstract-provider/src.ts/index";
//
// const SEED="fox sight canyon orphan hotel grow hedgehog build bless august weather swarm";
// const SUBSTRATE_ENDPOINT = 'ws://localhost:9944';
// const ETH_ENDPOINT = 'http://localhost:8545';
//
// async function createAcalaProvider(): Promise<EvmRpcProvider> {
//     const provider = EvmRpcProvider.from(SUBSTRATE_ENDPOINT);
//     await provider.isReady();
//     return provider;
// }
//
// function createEthersProvider(network?: Network) {
//     return new providers.StaticJsonRpcProvider(ETH_ENDPOINT, network);
// }
//
// export interface Overrides {
//     gasLimit?: BigNumberish;
//     gasPrice?: BigNumberish;
//     maxFeePerGas?: BigNumberish;
//     maxPriorityFeePerGas?: BigNumberish;
//     nonce?: BigNumberish;
//     type?: number;
//     accessList?: AccessListish;
//     customData?: Record<string, any>;
// };
//
// async function getOverrides(provider: EvmRpcProvider): Promise<Overrides> {
//     const txFeePerGas = provider.api.consts.evm.txFeePerGas.toString();
//     const storageByteDeposit = provider.api.consts.evm.storageDepositPerByte.toString();
//     const currentHeight = await provider.getBlockNumber();
//     const { txGasLimit, txGasPrice } = calcEthereumTransactionParams({
//         gasLimit: 10000001n,
//         validUntil: currentHeight + 1000,
//         storageLimit: 64001n,
//         txFeePerGas,
//         storageByteDeposit
//     });
//     return {
//         gasLimit: txGasLimit,
//         gasPrice: txGasPrice,
//         type: 0,
//     };
// }
//
// async function delay(sec: number): Promise<void> {
//     return new Promise((resolve) => {
//         setTimeout(resolve, sec * 1000);
//     });
// }
//
// function createWallet(provider: Provider) {
//     const hdNode = utils.HDNode.fromMnemonic(SEED).derivePath("m/44'/60'/0'/0/0");
//     return new Wallet(hdNode, provider);
// }
//
// describe('make tx on acala', () => {
//     const toAccount = '0x59a29c0509AF78a0D5B343AC0B5885F3733bCEFf';
//
//     // this can not be used in frontend, metamask will complain no enough balance for gas fee
//     it('use acala provider, normal tx, sign using eth account', async () => {
//         const provider = await createAcalaProvider();
//         const wallet = createWallet(provider);
//         const overrides = await getOverrides(provider);
//         const balanceBefore = await provider.getBalance(toAccount);
//         console.log(`balance before: ${balanceBefore.toString()}`);
//         const amount = ethers.utils.parseEther('100');
//         const unsignTx: TransactionRequest = {
//             from: wallet.address,
//             chainId: await provider.chainId(),
//             to: toAccount,
//             value: amount,
//             nonce: await provider.getTransactionCount(wallet.address),
//             gasLimit: overrides.gasLimit, // 100000
//             gasPrice: overrides.gasPrice,
//             type: 0,
//         }
//
//         const resp = await wallet.sendTransaction(unsignTx);
//         await resp.wait();
//         const balanceAfter = await provider.getBalance(toAccount);
//         console.log(`balance after: ${balanceAfter.toString()}`);
//         expect(balanceAfter.sub(balanceBefore).toString()).to.eq(amount.toString());
//         await provider.api.disconnect();
//     }).timeout(120000);
//
//     // this works for frontend, replace wallet with metamask signer
//     it('use acala provider, eip-712 tx, sign using eth account', async () => {
//         const provider = await createAcalaProvider();
//         const wallet = createWallet(provider);
//         // const overrides = await getOverrides(provider);
//         const balanceBefore = await provider.getBalance(toAccount);
//         const latestHeight = await provider.getBlockNumber();
//         console.log(`balance before: ${balanceBefore.toString()}`);
//         const amount = ethers.utils.parseEther('100');
//
//         const unsignEip712Tx: Eip712Transaction = {
//             nonce: await provider.getTransactionCount(wallet.address),
//             chainId: await provider.chainId(),
//             to: toAccount,
//             from: wallet.address,
//             data: undefined,
//             gasLimit: BigNumber.from(2100001),
//             value: amount,
//             salt: provider.api.genesisHash.toString(),
//             validUntil: latestHeight+100,
//             storageLimit: 100000,
//             type: 0x60
//         };
//
//         // need to replace this when use with metamask. https://docs.metamask.io/guide/signing-data.html#sign-typed-data-v4
//         const eip712sig = signTransaction(wallet.privateKey, unsignEip712Tx);
//         const raw712Tx = serializeTransaction(unsignEip712Tx, eip712sig);
//
//         const txHash = await provider.sendRawTransaction(raw712Tx);
//         console.log(`txHash: ${txHash}`);
//         await delay(12);
//         // waitForTransaction is not implemented on acala provider
//         // await provider.waitForTransaction(txHash);
//
//         const balanceAfter = await provider.getBalance(toAccount);
//         console.log(`balance after: ${balanceAfter.toString()}`);
//         expect(balanceAfter.sub(balanceBefore).toString()).to.eq(amount.toString());
//         await provider.api.disconnect();
//     }).timeout(120000);
//
//
//     // doesn't have to rely on acalaProvider, just need to hard code a few things
//     // same with acala provider, can not work with metamask
//     it('use ethers provider, normal tx, sign using eth account', async () => {
//         const acalaProvider = await createAcalaProvider();
//         const provider = await createEthersProvider(await acalaProvider.getNetwork());
//         const wallet = createWallet(provider);
//         const overrides = await getOverrides(acalaProvider);
//         const balanceBefore = await provider.getBalance(toAccount);
//         console.log(`balance before: ${balanceBefore.toString()}`);
//         const amount = ethers.utils.parseEther('100');
//         const unsignTx: TransactionRequest = {
//             from: wallet.address,
//             chainId: await acalaProvider.chainId(),
//             to: toAccount,
//             value: amount,
//             nonce: await provider.getTransactionCount(wallet.address),
//             gasLimit: overrides.gasLimit, // 100000
//             gasPrice: overrides.gasPrice,
//             type: 0,
//         }
//         // to wark around Error: Transaction hash mismatch from Provider.sendTransaction.
//         // const resp = await wallet.sendTransaction(unsignTx);
//         // await resp.wait();
//         const signedTx = await wallet.signTransaction(unsignTx);
//         const txHash = await provider.perform("sendTransaction", { signedTransaction: signedTx });
//         console.log(`txHash: ${txHash}`);
//         await provider.waitForTransaction(txHash);
//         // await provider.waitForTransaction(txHash);
//         const balanceAfter = await provider.getBalance(toAccount);
//         console.log(`balance after: ${balanceAfter.toString()}`);
//         expect(balanceAfter.sub(balanceBefore).toString()).to.eq(amount.toString());
//         await acalaProvider.api.disconnect();
//     }).timeout(120000);
//
//
//     // this works for frontend, replace wallet with metamask signer
//     it('use ethers provider, eip-712 tx, sign using eth account', async () => {
//         const acalaProvider = await createAcalaProvider();
//         const provider = await createEthersProvider(await acalaProvider.getNetwork());
//         const wallet = createWallet(provider);
//         // const overrides = await getOverrides(provider);
//         const balanceBefore = await provider.getBalance(toAccount);
//         const latestHeight = await provider.getBlockNumber();
//         console.log(`balance before: ${balanceBefore.toString()}`);
//         const amount = ethers.utils.parseEther('100');
//
//         const unsignEip712Tx: Eip712Transaction = {
//             nonce: await provider.getTransactionCount(wallet.address),
//             chainId: await acalaProvider.chainId(),
//             to: toAccount,
//             from: wallet.address,
//             data: undefined,
//             gasLimit: BigNumber.from(2100001),
//             value: amount,
//             salt: acalaProvider.api.genesisHash.toString(),
//             validUntil: latestHeight+100,
//             storageLimit: 100000,
//             type: 0x60
//         };
//
//         // need to replace this when use with metamask. https://docs.metamask.io/guide/signing-data.html#sign-typed-data-v4
//         const eip712sig = signTransaction(wallet.privateKey, unsignEip712Tx);
//         const raw712Tx = serializeTransaction(unsignEip712Tx, eip712sig);
//
//         // to wark around Error: unsupported transaction type 96
//         const txHash = await provider.perform("sendTransaction", { signedTransaction: raw712Tx });
//         console.log(`txHash: ${txHash}`);
//         await provider.waitForTransaction(txHash);
//
//         const balanceAfter = await provider.getBalance(toAccount);
//         console.log(`balance after: ${balanceAfter.toString()}`);
//         expect(balanceAfter.sub(balanceBefore).toString()).to.eq(amount.toString());
//         await acalaProvider.api.disconnect();
//     }).timeout(120000);
// });
