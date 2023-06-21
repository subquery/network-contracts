// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers} from 'hardhat';
import {deployContracts} from './setup';
import {deploymentIds} from './constants';
import {
    ConsumerHost,
    IndexerRegistry,
    RewardsPool,
    RewardsDistributer,
    EraManager,
    SQToken,
    Staking,
    StateChannel,
} from '../src';
import {registerIndexer, delay, etherParse} from './helper';
import {Wallet, BigNumberish, BytesLike, BigNumber} from 'ethers';

describe('ConsumerHost Contract', () => {
    const deploymentId = deploymentIds[0];
    let wallet_0, indexer, consumer, consumer2, hoster;

    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let stateChannel: StateChannel;
    let consumerHost: ConsumerHost;
    const address_zero = "0x0000000000000000000000000000000000000000";

    const openChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        hoster: Wallet,
        consumer: Wallet,
        nonce: BigNumber,
        amount: BigNumber,
        price: BigNumber,
        expiration: number,
        isApproved: boolean
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        let consumerSign;

        if (!isApproved) {
            const consumerMsg = abi.encode(['uint256', 'uint256', 'uint256'], [channelId, amount, nonce]);
            const consumerPayloadHash = ethers.utils.keccak256(consumerMsg);
            consumerSign = await consumer.signMessage(ethers.utils.arrayify(consumerPayloadHash));
        } else {
            consumerSign = '0x';
        }
        const consumerCallback = abi.encode(['address', 'bytes'], [consumer.address, consumerSign]);

        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32', 'bytes'],
            [
                channelId,
                indexer.address,
                consumerHost.address,
                amount,
                price,
                expiration,
                deploymentId,
                consumerCallback,
            ]
        );
        let payloadHash = ethers.utils.keccak256(msg);

        let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
        let hosterSign = await hoster.signMessage(ethers.utils.arrayify(payloadHash));

        const recoveredIndexer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), indexerSign);
        expect(indexer.address).to.equal(recoveredIndexer);

        const recoveredHoster = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), hosterSign);
        expect(hoster.address).to.equal(recoveredHoster);

        await stateChannel.open(
            channelId,
            indexer.address,
            consumerHost.address,
            amount,
            price,
            expiration,
            deploymentId,
            consumerCallback,
            indexerSign,
            hosterSign
        );
    };

    const fundChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        hoster: Wallet,
        consumer: Wallet,
        nonce: BigNumber,
        preTotal: BigNumber,
        amount: BigNumber,
        isApproved: boolean
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        let consumerSign;

        if (!isApproved) {
            const consumerMsg = abi.encode(['uint256', 'uint256', 'uint256'], [channelId, amount, nonce]);
            const consumerPayloadHash = ethers.utils.keccak256(consumerMsg);
            consumerSign = await consumer.signMessage(ethers.utils.arrayify(consumerPayloadHash));
        } else {
            consumerSign = '0x';
        }
        const consumerCallback = abi.encode(['address', 'bytes'], [consumer.address, consumerSign]);

        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
            [channelId, indexer.address, consumerHost.address, preTotal, amount, consumerCallback]
        );
        let payloadHash = ethers.utils.keccak256(msg);
        let hosterSign = await hoster.signMessage(ethers.utils.arrayify(payloadHash));

        const recoveredHoster = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), hosterSign);
        expect(hoster.address).to.equal(recoveredHoster);

        await stateChannel.fund(channelId, preTotal, amount, consumerCallback, hosterSign);
    };

    const buildQueryState = async (
        channelId: Uint8Array,
        indexer: Wallet,
        hoster: Wallet,
        spent: BigNumber,
        isFinal: boolean
    ): Promise<{
        channelId: BigNumberish;
        spent: BigNumberish;
        isFinal: boolean;
        indexerSign: BytesLike;
        consumerSign: BytesLike;
    }> => {
        const abi = ethers.utils.defaultAbiCoder;
        const msg = abi.encode(['uint256', 'uint256', 'bool'], [channelId, spent, isFinal]);
        let payloadHash = ethers.utils.keccak256(msg);

        let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
        let hosterSign = await hoster.signMessage(ethers.utils.arrayify(payloadHash));

        const recoveredIndexer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), indexerSign);
        expect(indexer.address).to.equal(recoveredIndexer);

        const recoveredHoster = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), hosterSign);
        expect(hoster.address).to.equal(recoveredHoster);

        return {
            channelId: channelId,
            spent: spent,
            isFinal: isFinal,
            indexerSign: indexerSign,
            consumerSign: hosterSign,
        };
    };

    beforeEach(async () => {
        [wallet_0, indexer, consumer, consumer2, hoster] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, indexer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        stateChannel = deployment.stateChannel;
        consumerHost = deployment.consumerHost;
    });

    describe('Consumer Host Config', () => {
        it('set consumer host signer should work', async () => {
            expect((await consumerHost.getSigners()).length).to.equal(0);

            await consumerHost.connect(wallet_0).addSigner(hoster.address);
            expect((await consumerHost.getSigners())[0]).to.equal(hoster.address);

            await consumerHost.connect(wallet_0).addSigner(consumer.address);
            expect((await consumerHost.getSigners())[1]).to.equal(consumer.address);

            await consumerHost.connect(wallet_0).addSigner(consumer2.address);
            expect((await consumerHost.getSigners())[2]).to.equal(consumer2.address);

            await consumerHost.connect(wallet_0).removeSigner(consumer.address);
            expect((await consumerHost.getSigners())[1]).to.equal(consumer2.address);

            await consumerHost.connect(wallet_0).removeSigner(consumer2.address);
            expect((await consumerHost.getSigners())[0]).to.equal(hoster.address);
        });

        it('set and remove controller account should work', async () => {
            expect((await consumerHost.controllers(wallet_0.address))).to.equal(address_zero);
            await expect(consumerHost.setControllerAccount(consumer.address))
            .to.be.emit(consumerHost, 'SetControllerAccount')
            .withArgs(wallet_0.address, consumer.address);
            expect((await consumerHost.controllers(wallet_0.address))).to.equal(consumer.address);
            await expect(consumerHost.removeControllerAccount())
            .to.be.emit(consumerHost, 'RemoveControllerAccount')
            .withArgs(wallet_0.address, consumer.address);
            expect((await consumerHost.controllers(wallet_0.address))).to.equal(address_zero);
        });

        it('Approve host can use consumer balance should work', async () => {
            await expect(consumerHost.connect(consumer).approve())
                .to.be.emit(consumerHost, 'Approve')
                .withArgs(consumer.address);
            expect((await consumerHost.consumers(consumer.address)).approved).to.equal(true);
        });

        it('Disapprove host can use consumer balance should work', async () => {
            await consumerHost.connect(consumer).approve();
            await expect(consumerHost.connect(consumer).disapprove())
                .to.be.emit(consumerHost, 'Disapprove')
                .withArgs(consumer.address);
            expect((await consumerHost.consumers(consumer.address)).approved).to.equal(false);
        });

        it('Consumer deposit should work', async () => {
            await token.connect(wallet_0).transfer(consumer.address, etherParse('10'));
            await token.connect(consumer).increaseAllowance(consumerHost.address, etherParse('10'));

            await expect(consumerHost.connect(consumer).deposit(etherParse('10'), false))
                .to.be.emit(consumerHost, 'Deposit')
                .withArgs(consumer.address, etherParse('10'), etherParse('10'));

            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('0'));
            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('10'));
            expect((await consumerHost.consumers(consumer.address)).balance).to.equal(etherParse('10'));
        });

        it('Consumer withdraw should work', async () => {
            await token.connect(wallet_0).transfer(consumer.address, etherParse('10'));
            await token.connect(consumer).increaseAllowance(consumerHost.address, etherParse('10'));
            await consumerHost.connect(consumer).deposit(etherParse('10'), false);

            await expect(consumerHost.connect(consumer).withdraw(etherParse('10')))
                .to.be.emit(consumerHost, 'Withdraw')
                .withArgs(consumer.address, etherParse('10'), etherParse('0'));

            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('10'));
            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('0'));
            expect((await consumerHost.consumers(consumer.address)).balance).to.equal(etherParse('0'));
        });
    });

    describe('Consumer Host State Channel should work', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '2000');
            await consumerHost.connect(wallet_0).addSigner(hoster.address);
            await token.connect(wallet_0).transfer(consumer.address, etherParse('10'));
            await token.connect(wallet_0).transfer(consumer2.address, etherParse('10'));

            // deposit
            await token.connect(consumer).increaseAllowance(consumerHost.address, etherParse('10'));
            await token.connect(consumer2).increaseAllowance(consumerHost.address, etherParse('10'));
            await consumerHost.connect(consumer).deposit(etherParse('10'), false);
            await consumerHost.connect(consumer2).deposit(etherParse('10'), true);
        });

        it('open a State Channel should work', async () => {
            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('20'));

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(
                channelId,
                indexer,
                hoster,
                consumer,
                BigNumber.from(0),
                etherParse('1'),
                etherParse('0.1'),
                60,
                false
            );
            expect((await consumerHost.consumers(consumer.address)).balance).to.equal(etherParse('8.99')); // 10 - 1 - 0.01
            expect(await consumerHost.channels(channelId)).to.equal(consumer.address);

            const channelId2 = ethers.utils.randomBytes(32);
            const channelId3 = ethers.utils.randomBytes(32);
            const cBalance0 = await consumerHost.consumers(consumer2.address);
            await openChannel(
                channelId2,
                indexer,
                hoster,
                consumer2,
                cBalance0.nonce,
                etherParse('2'),
                etherParse('0.1'),
                60,
                false
            );
            const cBalance1 = await consumerHost.consumers(consumer2.address);
            expect(cBalance1.balance).to.equal(etherParse('7.98')); // 8 - 0.02 fee
            expect(await consumerHost.channels(channelId2)).to.equal(consumer2.address);
            await openChannel(
                channelId3,
                indexer,
                hoster,
                consumer2,
                cBalance1.nonce,
                etherParse('1'),
                etherParse('0.1'),
                60,
                false
            );
            const cBalance2 = await consumerHost.consumers(consumer2.address);

            // update fee from 1% ~ 2%
            const fee1 = await consumerHost.fee();
            expect(fee1).to.equal(etherParse('0.04')); // 0.01 + 0.02 + 0.01
            await consumerHost.connect(wallet_0).setFeePercentage(BigNumber.from(2));
            await expect(consumerHost.connect(wallet_0).setFeePercentage(BigNumber.from(101))).to.be.revertedWith(
                'C001'
            );
            await fundChannel(
                channelId3,
                indexer,
                hoster,
                consumer2,
                cBalance2.nonce,
                etherParse('1'),
                etherParse('1'),
                true
            );
            const fee2 = await consumerHost.fee();
            expect(fee2).to.equal(etherParse('0.06')); // 0.04 + 1 * 2% = 0.06

            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('15'));

            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1); // 0 is Finalized, 1 is Open, 2 is Terminate
            expect(channel.indexer).to.equal(indexer.address);
            expect(channel.consumer).to.equal(consumerHost.address);
            expect(channel.total).to.equal(etherParse('1'));

            const query1 = await buildQueryState(channelId, indexer, hoster, etherParse('0.1'), false);
            await stateChannel.checkpoint(query1);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.1'));

            // claim rewards
            await stateChannel.setTerminateExpiration(5); // 5s
            const query2 = await buildQueryState(channelId, indexer, hoster, etherParse('0.2'), false);
            await stateChannel.connect(hoster).terminate(query2);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.2'));

            await delay(6);
            await stateChannel.claim(channelId);
            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('15.8')); // 15 + 0.8

            // withdraw
            const cBalance3 = await consumerHost.consumers(consumer.address);
            expect(cBalance3.balance).to.equal(etherParse('9.79')); // 8.99 + 0.8
            await consumerHost.connect(consumer).withdraw(etherParse('9.5'));
            const cBalance4 = await consumerHost.consumers(consumer.address);
            expect(cBalance4.balance).to.equal(etherParse('0.29'));

            // collect fee
            const tBalance1 = await token.balanceOf(consumer.address);
            expect(tBalance1).to.equal(etherParse('9.5'));
            await consumerHost.connect(wallet_0).collectFee(consumer.address, etherParse('0.01'));
            expect(await consumerHost.fee()).to.equal(etherParse('0.05'));
            const tBalance2 = await token.balanceOf(consumer.address);
            expect(tBalance2).to.equal(etherParse('9.51'));
        });
        it('open a State Channel with approved should work', async () => {
            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('20'));

            await consumerHost.connect(consumer).approve();

            const channelId = ethers.utils.randomBytes(32);
            // the approved consumer's `nonce` will not change.
            await openChannel(
                channelId,
                indexer,
                hoster,
                consumer,
                BigNumber.from(0),
                etherParse('1'),
                etherParse('0.1'),
                60,
                true
            );
            expect((await consumerHost.consumers(consumer.address)).balance).to.equal(etherParse('8.99'));
            expect(await consumerHost.channels(channelId)).to.equal(consumer.address);
            await fundChannel(
                channelId,
                indexer,
                hoster,
                consumer,
                BigNumber.from(0),
                etherParse('1'),
                etherParse('1'),
                true
            );
            expect((await consumerHost.consumers(consumer.address)).balance).to.equal(etherParse('7.98'));

            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('18'));

            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1); // 0 is Finalized, 1 is Open, 2 is Terminate
            expect(channel.indexer).to.equal(indexer.address);
            expect(channel.consumer).to.equal(consumerHost.address);
            expect(channel.total).to.equal(etherParse('2'));

            const query1 = await buildQueryState(channelId, indexer, hoster, etherParse('0.1'), false);
            await stateChannel.checkpoint(query1);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.1'));

            // claim rewards
            await stateChannel.setTerminateExpiration(5); // 5s
            const query2 = await buildQueryState(channelId, indexer, hoster, etherParse('0.2'), false);
            await stateChannel.connect(hoster).terminate(query2);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.2'));

            await delay(6);
            await stateChannel.claim(channelId);
            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('19.8')); // 18 + 1.8

            // withdraw
            const cBalance3 = await consumerHost.consumers(consumer.address);
            expect(cBalance3.balance).to.equal(etherParse('9.78')); // 7.98 + 1.8
            await consumerHost.connect(consumer).withdraw(etherParse('9.5'));
            const cBalance4 = await consumerHost.consumers(consumer.address);
            expect(cBalance4.balance).to.equal(etherParse('0.28'));
        });
    });
});
