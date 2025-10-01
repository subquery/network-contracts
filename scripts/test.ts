import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import { networks, ContractSDK } from '../src';
// @ts-expect-error path changed with hmoduleAlias
import mainnetDeployment from './publish/mainnet.json';
import { setupCommon } from './setup';
import { ethers, utils } from 'ethers';

const dryRun = false;

const deposit = async () => {
    const { wallet, rootProvider, childProvider } = await setupCommon(networks.mainnet);
    const sdk = new ContractSDK(childProvider, { network: 'mainnet' });
    const es = await sdk.rewardsBooster.estimateGas.removeBoosterDeployment(
        '0x14cbc2f1f04e330b4a33fec882607bb023f369fb1279bfeb8756265953afca58',
        utils.parseEther('450000'),
        { from: '0x297692be8Cec210bb2a10b51394f6205039A9cB5' }
    );
    console.log(es);
};

deposit();
