import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import {PolygonSDK, networks, ContractSDK} from '../src';
import {setupCommon} from './setup';
import {ethers, utils} from "ethers";
import {POSClient, use, setProofApi} from "@maticnetwork/maticjs";
import { Web3ClientPlugin } from '@maticnetwork/maticjs-ethers';
use(Web3ClientPlugin);
setProofApi("https://proof-generator.polygon.technology/");


// const deposit = async () => {
//     const name = 'testnet';
//     const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
//     const sdk = await ContractSDKRoot.create(wallet, {root: rootProvider, child: childProvider}, {network: 'testnet'});
//     const balance = await sdk.sqToken.balanceOf(wallet.address);
//     console.log(`balance: ${utils.formatEther(balance)}`);
//     // const tokenType = await sdk.rootChainManager.tokenToType(sdk.sqToken.address);
//     // const predicate = await sdk.rootChainManager.typeToPredicate(tokenType);
//     // console.log(`predicate: ${predicate}`);
//     // let tx = await sdk.sqToken.increaseAllowance(predicate, utils.parseEther('12'));
//     // await tx.wait();
//     const amount = utils.parseEther('123');
//     await sdk.approveDeposit(amount);
//     const tx = await sdk.depositFor(wallet.address, amount);
//     await tx.wait();
// };

const deposit2 = async () => {
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const sdk = await PolygonSDK.create(wallet, {root: rootProvider, child: childProvider}, {network: 'testnet'});
    const balance = await sdk.sqToken.balanceOf(wallet.address);
    console.log(`balance: ${utils.formatEther(balance)}`);
    const amount = utils.parseEther('100');
    let tx = await sdk.approveDeposit(amount);
    await tx.getReceipt();
    tx = await sdk.depositFor(amount);
    const txHash = await tx.getTransactionHash();
    console.log(`txhash: ${txHash}`);
};

const withdrawStart = async () => {
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const sdk = ContractSDK.create(wallet.connect(childProvider), {network: 'testnet'});
    const balance = await sdk.sqToken.balanceOf(wallet.address);
    console.log(`balance: ${utils.formatEther(balance)}`);
    const amount = utils.parseEther('8');
    const tx = await sdk.sqToken.withdraw(amount);
    console.log(tx.hash)
    await tx.wait();
};

const withdraw2 = async () => {
    const rootTokenAddr = '0x1EcE1fAfcd6d7783A00bedDA4d744B0a666146cd';
    const childTokenAddr = '0xB7F2F528236DB18cb003D68b0B94915509e9C6ee';
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const posClient = new POSClient();
    await posClient.init({
        network: 'testnet',
        version: 'mumbai',
        parent: {
            provider: wallet.connect(rootProvider),
            defaultConfig:{
                from: wallet.address,
            }
        },
        child:{
            provider: wallet.connect(childProvider),
            defaultConfig: {
                from: wallet.address,
            }
        }
    });
    try {
        // const withdrawTx = '0x11a9bc5551545ca5841d50ea28671a22ca038009f4080094315238d91a2d021f';
        const withdrawTx = '0x7d6365b460fde971f0d94e3cf50e0fa1c83c577fc9e914befdd3a366a2c6ba30';
        const isCheckPointed = await posClient.isCheckPointed(withdrawTx);
        console.log(`isCheckPointed: ${isCheckPointed}`);
        if (isCheckPointed) {
            const rootToken = posClient.erc20(rootTokenAddr, true);
            const result = await rootToken.withdrawExit(withdrawTx);
            const txHash = await result.getTransactionHash();
            console.log(`exitTxHash: ${txHash}`);
            const txReceipt = await result.getReceipt();
            const isExited = await rootToken.isWithdrawExited(txHash);
            console.log(`isExited: ${isExited}`);
        }
    } catch (e) {
        console.error(e)
    }

}

const withdraw3 = async () => {
    const rootTokenAddr = '0x1EcE1fAfcd6d7783A00bedDA4d744B0a666146cd';
    const childTokenAddr = '0xB7F2F528236DB18cb003D68b0B94915509e9C6ee';
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const posClient = new POSClient();
    await posClient.init({
        network: 'testnet',
        version: 'mumbai',
        parent: {
            provider: wallet.connect(rootProvider),
            defaultConfig:{
                from: wallet.address,
            }
        },
        child:{
            provider: wallet.connect(childProvider),
            defaultConfig: {
                from: wallet.address,
            }
        }
    });
    try {
        // const withdrawTx = '0x11a9bc5551545ca5841d50ea28671a22ca038009f4080094315238d91a2d021f';
        const withdrawTx = '0x7d6365b460fde971f0d94e3cf50e0fa1c83c577fc9e914befdd3a366a2c6ba30';
        const isCheckPointed = await posClient.isCheckPointed(withdrawTx);
        console.log(`isCheckPointed: ${isCheckPointed}`);
        if (isCheckPointed) {
            const rootToken = posClient.erc20(rootTokenAddr, true);
            const result = await rootToken.withdrawExitFaster(withdrawTx);
            const txHash = await result.getTransactionHash();
            console.log(`exitTxHash: ${txHash}`);
            const txReceipt = await result.getReceipt();
            const isExited = await rootToken.isWithdrawExited(txHash);
            console.log(`isExited: ${isExited}`);
        }
    } catch (e) {
        console.error(e)
    }

}

const withdrawStart2 = async () => {
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const sdk = await PolygonSDK.create(wallet, {root: rootProvider, child: childProvider}, {network: 'testnet'});
    const amount = utils.parseEther('5');
    const tx = await sdk.withdrawStart(amount);
    console.log(`txHash:${tx.transactionHash}`);
};

const withdrawExit = async () => {
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const sdk = await PolygonSDK.create(wallet, {root: rootProvider, child: childProvider}, {network: 'testnet'});
    const txHash = '0xcad2dab624cec97f0cbe4518799968b3247160cb5d387335b21472ba7c1d0918';
    try {
        const tx = await sdk.withdrawExit(txHash);
        console.log(`txHash:${tx.transactionHash}`);
    } catch (e){
        console.error(e.message)
    }
};

withdrawExit();
