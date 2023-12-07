import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import {DeploymentConfig, FxERC20RootTunnel__factory, networks, SQToken__factory} from '../src';
import {setupCommon} from './setup';
import {deployRootContracts, saveDeployment} from './deployContracts';
import contractsConfig from './config/contracts.config';
import {eventFrom} from "../test/helper";
import {ethers} from "ethers";

const rootToken = '0xF5F0bf55218b07B9031590Fe1Bc1e40811E23e78';
const childToken = '0x237F1754eF00d526Fd3833E9840F35D0C294254e';
const mapToken = async () => {
    const name = 'testnet';
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const rootTunnel = FxERC20RootTunnel__factory.connect('0x3658ccFDE5e9629b0805EB06AaCFc42416850961', rootProvider)
    const tx = await rootTunnel.connect(wallet.connect(rootProvider)).mapToken(rootToken);
    const event = await eventFrom(tx, rootTunnel, 'TokenMappedERC20(address,address)');
    console.log(`rootToken: ${event.rootToken}, childToken: ${event.childToken}`);
};
const deposit = async () => {
    const name = 'testnet';
    const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
    const rootTunnel = FxERC20RootTunnel__factory.connect('0x3658ccFDE5e9629b0805EB06AaCFc42416850961', rootProvider)
    const sqToken = SQToken__factory.connect(rootToken, rootProvider);
    console.log('approval')
    let tx = await sqToken.connect(wallet.connect(rootProvider)).approve(rootTunnel.address, ethers.utils.parseEther('1'));
    await tx.wait(5)
    console.log('deposit')
    tx = await rootTunnel.connect(wallet.connect(rootProvider)).deposit(rootToken, wallet.address, ethers.utils.parseEther('1'),'0x00');
    console.log(`tx: ${tx.hash}`);
};

deposit();
