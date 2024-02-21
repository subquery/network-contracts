import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import { networks } from '../src';
// @ts-expect-error path changed with hmoduleAlias
import mainnetDeployment from './publish/mainnet.json';
import { setupCommon } from './setup';
import { ethers } from 'ethers';
import { CrossChainMessenger, MessageStatus, SignerOrProviderLike } from '@eth-optimism/sdk';

const dryRun = false;

const deposit = async () => {
    const { wallet, rootProvider, childProvider } = await setupCommon(networks.mainnet);
    const crossChainMessenger = new CrossChainMessenger({
        l1ChainId: (await rootProvider.getNetwork()).chainId,
        l2ChainId: (await childProvider.getNetwork()).chainId,
        l1SignerOrProvider: wallet.connect(rootProvider) as unknown as SignerOrProviderLike,
        l2SignerOrProvider: wallet.connect(childProvider) as unknown as SignerOrProviderLike,
    });
    const amount = ethers.utils.parseEther('414395576.3');
    const rootToken = mainnetDeployment.root.SQToken.address;
    const l2Token = mainnetDeployment.child.L2SQToken.address;

    console.log(
        `request deposit approval: signer: ${wallet.address}, amount: ${amount.toString()}, root token:${rootToken}, l2 token = ${l2Token}`
    );
    if (!dryRun) {
        const depositApproveTx = await crossChainMessenger.approveERC20(rootToken, l2Token, amount);
        console.log(`tx: ${depositApproveTx.hash}`);
        await depositApproveTx.wait();
        console.log('deposit approval done');

        console.log('request deposit');
        const depositTx = await crossChainMessenger.depositERC20(rootToken, l2Token, amount);
        console.log(`deposit hash: ${depositTx.hash}`);
        await depositTx.wait();
        console.log('deposit done');

        console.log('wait for deposit status');
        await crossChainMessenger.waitForMessageStatus(depositTx.hash, MessageStatus.RELAYED);
        console.log('deposit status done');
    }
};

deposit();
