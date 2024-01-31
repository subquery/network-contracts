import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import {networks, ContractSDK} from '../src';
// @ts-ignore
import {setupCommon} from './setup';
import { ethers, Overrides, utils } from "ethers";
async function getOverrides(provider): Promise<Overrides> {
    let price = await provider.getGasPrice();
    // console.log(`gasprice: ${price.toString()}`)
    price = price.add(15000000000); // add extra 15 gwei
    return { gasPrice: price, gasLimit: 3000000 };
}
const deposit = async () => {
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.mainnet);
    const sdk = ContractSDK.create(wallet.connect(childProvider), {network: 'testnet'});
    const _overrides = await getOverrides(childProvider);
    const tx = await sdk.sqtGift.setSeriesActive(0, false, {..._overrides, nonce: 3051});
    console.log(`tx: ${tx.hash}`);
    await tx.wait();
};


deposit();
