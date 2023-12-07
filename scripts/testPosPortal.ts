import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import {ContractSDKRoot, networks, ContractSDK} from '../src';
import {setupCommon} from './setup';
import {ethers, utils} from "ethers";

const deposit = async () => {
    const name = 'testnet';
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const sdk = await ContractSDKRoot.create(wallet.connect(rootProvider), {network: 'testnet'});
    const balance = await sdk.sqToken.balanceOf(wallet.address);
    console.log(`balance: ${utils.formatEther(balance)}`);
    // const tokenType = await sdk.rootChainManager.tokenToType(sdk.sqToken.address);
    // const predicate = await sdk.rootChainManager.typeToPredicate(tokenType);
    // console.log(`predicate: ${predicate}`);
    // let tx = await sdk.sqToken.increaseAllowance(predicate, utils.parseEther('12'));
    // await tx.wait();
    const amount = utils.parseEther('12');
    await sdk.approveDeposit(amount);
    const tx = await sdk.depositFor(wallet.address, amount);
    await tx.wait();
};

const withdraw = async () => {
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const sdk = ContractSDK.create(wallet.connect(childProvider), {network: 'testnet'});
    const balance = await sdk.sqToken.balanceOf(wallet.address);
    console.log(`balance: ${utils.formatEther(balance)}`);
    const amount = utils.parseEther('8');
    const tx = await sdk.sqToken.withdraw(amount);
    await tx.wait();
};

withdraw();
