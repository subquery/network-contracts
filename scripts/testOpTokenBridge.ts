import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import { networks } from '../src';
// @ts-expect-error path changed with hmoduleAlias
import testnetDeployment from './publish/testnet.json';
import { setupCommon } from './setup';
import { ethers } from 'ethers';
import { CrossChainMessenger, MessageStatus, SignerOrProviderLike } from '@eth-optimism/sdk';

const deposit = async () => {
    const { wallet, rootProvider, childProvider } = await setupCommon(networks.testnet);
    const crossChainMessenger = new CrossChainMessenger({
        l1ChainId: (await rootProvider.getNetwork()).chainId,
        l2ChainId: (await childProvider.getNetwork()).chainId,
        l1SignerOrProvider: wallet.connect(rootProvider) as unknown as SignerOrProviderLike,
        l2SignerOrProvider: wallet.connect(childProvider) as unknown as SignerOrProviderLike,
    });
    const amount = ethers.utils.parseEther('10000000');

    console.log('request deposit approval');
    const depositApproveTx = await crossChainMessenger.approveERC20(
        testnetDeployment.root.SQToken.address,
        testnetDeployment.child.L2SQToken.address,
        amount
    );
    await depositApproveTx.wait();
    console.log('deposit approval done');

    console.log('request deposit');
    const depositTx = await crossChainMessenger.depositERC20(
        testnetDeployment.root.SQToken.address,
        testnetDeployment.child.L2SQToken.address,
        amount
    );
    console.log(`deposit hash: ${depositTx.hash}`);
    await depositTx.wait();
    console.log('deposit done');

    console.log('wait for deposit status');
    await crossChainMessenger.waitForMessageStatus(depositTx.hash, MessageStatus.RELAYED);
    console.log('deposit status done');
};

deposit();
