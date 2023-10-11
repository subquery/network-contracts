// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { BigNumber, BigNumberish, BytesLike, Wallet } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { EraManager, IndexerRegistry, RewardsDistributer, RewardsHelper, RewardsPool, SQToken, Staking, StateChannel } from '../src';
import { deploymentIds } from './constants';
import { delay, etherParse, eventFrom, eventsFrom, registerIndexer, startNewEra, time } from './helper';
import { deployContracts } from './setup';

describe('StateChannel Contract', () => {
    const deploymentId = deploymentIds[0];
    let wallet_0, indexer, consumer, indexer2;

    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributer;
    let rewardsHelper: RewardsHelper;
    let rewardsPool: RewardsPool;
    let stateChannel: StateChannel;

    const openChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
        amount: BigNumber,
        price: BigNumber,
        expiration: number
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32', 'bytes'],
            [channelId, indexer.address, consumer.address, amount, price, expiration, deploymentId, '0x']
        );
        let payloadHash = ethers.utils.keccak256(msg);

        let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
        let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

        const recoveredIndexer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), indexerSign);
        expect(indexer.address).to.equal(recoveredIndexer);

        const recoveredConsumer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), consumerSign);
        expect(consumer.address).to.equal(recoveredConsumer);

        await stateChannel
            .connect(consumer)
            .open(
                channelId,
                indexer.address,
                consumer.address,
                amount,
                price,
                expiration,
                deploymentId,
                '0x',
                indexerSign,
                consumerSign
            );
    };

    const buildQueryState = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
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
        let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

        const recoveredIndexer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), indexerSign);
        expect(indexer.address).to.equal(recoveredIndexer);

        const recoveredConsumer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), consumerSign);
        expect(consumer.address).to.equal(recoveredConsumer);

        return {
            channelId: channelId,
            spent: spent,
            isFinal: isFinal,
            indexerSign: indexerSign,
            consumerSign: consumerSign,
        };
    };

    const buildEmptyState = async (
        channelId: Uint8Array
    ): Promise<{
        channelId: BigNumberish;
        spent: BigNumberish;
        isFinal: boolean;
        indexerSign: BytesLike;
        consumerSign: BytesLike;
    }> => {
        return {
            channelId: channelId,
            spent: 0,
            isFinal: false,
            indexerSign: '0x',
            consumerSign: '0x',
        };
    };

    beforeEach(async () => {
        [wallet_0, indexer, consumer, indexer2] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, indexer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributer;
        rewardsHelper = deployment.rewardsHelper;
        rewardsPool = deployment.rewardsPool;
        eraManager = deployment.eraManager;
        stateChannel = deployment.stateChannel;
    });

    describe('State Channel Config', () => {
        it('set State Channel terminateExpiration should work', async () => {
            expect(await stateChannel.terminateExpiration()).to.equal(86400);
            await stateChannel.setTerminateExpiration(60);
            expect(await stateChannel.terminateExpiration()).to.equal(60);
        });

        it('set State Channel terminateExpiration without owner should fail', async () => {
            await expect(stateChannel.connect(consumer).setTerminateExpiration(10)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });
    });

    describe('State Channel Open', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '2000');
            await token.connect(wallet_0).transfer(consumer.address, etherParse('5'));
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('5'));
        });

        it('open a State Channel should work', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('1'), 60);

            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1); // 0 is Finalized, 1 is Open, 2 is Terminate
            expect(channel.indexer).to.equal(indexer.address);
            expect(channel.consumer).to.equal(consumer.address);
            expect(channel.total).to.equal(etherParse('1'));
        });

        it('repeat same channel Id State Channel should not work', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse('0.5'), etherParse('0.1'), 6);
            await expect(
                openChannel(channelId, indexer, consumer, etherParse('0.5'), etherParse('0.5'), 60)
            ).to.be.revertedWith('SC001');
        });

        it('can repeat same channel Id after channel is finalized', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('0.1'), 60);

            const balance = await token.balanceOf(stateChannel.address);
            expect(balance).to.equal(etherParse('1'));

            const query = await buildQueryState(channelId, indexer, consumer, etherParse('1'), true);
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(channelId)).status).to.equal(0);
            expect(await token.balanceOf(stateChannel.address)).to.equal(0);

            await openChannel(channelId, indexer, consumer, etherParse('0.1'), etherParse('0.1'), 6);
            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1);
            expect(channel.total).to.equal(etherParse('0.1'));
            expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('0.1'));
        });
    });

    describe('State Channel Checkpoint', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '2000');
            await token.connect(wallet_0).transfer(consumer.address, etherParse('5'));
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('5'));
        });

        it('checkpoint State Channel three steps', async () => {
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('5'));

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('0.1'), 60);
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('4'));

            const query1 = await buildQueryState(channelId, indexer, consumer, etherParse('0.1'), false);
            await stateChannel.checkpoint(query1);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.1'));
            expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('0.9'));

            // check rewards
            const currentEra = (await eraManager.eraNumber()).toNumber();
            const infos = await rewardsPool.getReward(deploymentId, currentEra, indexer.address);
            expect(infos[0]).to.be.eq(etherParse('0.1')); // labor
            expect(infos[1]).to.be.eq(etherParse('0.1')); // reward

            const query2 = await buildQueryState(channelId, indexer, consumer, etherParse('0.2'), false);
            await stateChannel.checkpoint(query2);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.2'));
            expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('0.8'));

            const query3 = await buildQueryState(channelId, indexer, consumer, etherParse('0.4'), true);
            await stateChannel.checkpoint(query3);
            expect(await token.balanceOf(stateChannel.address)).to.equal(0);
            expect((await stateChannel.channel(channelId)).status).to.equal(0);
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('4.6'));
        });
    });

    describe('State Channel Terminate', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '2000');
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer2, '2000');
            await token.connect(wallet_0).transfer(consumer.address, etherParse('5'));
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('5'));
            await eraManager.updateEraPeriod(time.duration.days(1).toString());
        });

        it('terminate without spent success', async () => {
            await stateChannel.setTerminateExpiration(5); // 5s

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('0.1'), 60);

            const query1 = await buildEmptyState(channelId);
            await stateChannel.connect(indexer).terminate(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.spent).to.equal(0);
            expect(state1.status).to.equal(2); // Terminate

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('SC008');

            await delay(6);
            await stateChannel.claim(channelId);

            const balance2 = await token.balanceOf(consumer.address);
            expect(balance2).to.equal(etherParse('5'));
        });

        it('terminate State Channel success', async () => {
            await stateChannel.setTerminateExpiration(5); // 5s

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('0.1'), 60);

            const query1 = await buildQueryState(channelId, indexer, consumer, etherParse('0.1'), false);
            await stateChannel.connect(indexer).terminate(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.spent).to.equal(etherParse('0.1'));
            expect(state1.status).to.equal(2); // Terminate
            // const era = await eraManager.eraNumber();
            // let unclaimed = await rewardsPool.getUnclaimDeployments(era.toNumber(), indexer.address);
            // console.log(`unclaimed: ${unclaimed.join(',')}`)

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('SC008');

            await delay(6);
            await stateChannel.claim(channelId);

            const balance2 = await token.balanceOf(consumer.address);
            expect(balance2).to.equal(etherParse('4.9'));

            await startNewEra(waffle.provider, eraManager)
            await rewardsHelper.connect(indexer).indexerCatchup(indexer.address);
            const indexerReward = await rewardsDistributor.userRewards(indexer.address, indexer.address);

            expect(indexerReward).to.eq(etherParse('0.1'));
        });

        it('terminate State Channel failure with respond', async () => {
            await stateChannel.setTerminateExpiration(5); // 5s

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('0.1'), 60);

            const query1 = await buildQueryState(channelId, indexer, consumer, etherParse('0.1'), false);
            await stateChannel.connect(consumer).terminate(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.spent).to.equal(etherParse('0.1'));
            expect(state1.status).to.equal(2); // Terminate

            const query2 = await buildQueryState(channelId, indexer, consumer, etherParse('0.2'), false);
            await stateChannel.connect(indexer).respond(query2);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.spent).to.equal(0);
            expect(state2.status).to.equal(0); // Finalized

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('SC008');
        });

        it('terminate State Channel with continue fund', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('0.1'), 5); // 5s expiration

            await delay(6); // channel is expiredAt

            const abi = ethers.utils.defaultAbiCoder;
            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
                [channelId, indexer.address, consumer.address, etherParse('1'), etherParse('0.1'), '0x']
            );
            let payload = ethers.utils.keccak256(msg);
            let sign = await consumer.signMessage(ethers.utils.arrayify(payload));
            const recover = ethers.utils.verifyMessage(ethers.utils.arrayify(payload), sign);
            expect(consumer.address).to.equal(recover);

            await expect(
                stateChannel.fund(channelId, etherParse('1'), etherParse('0.1'), '0x', sign)
            ).to.be.revertedWith('SC003');

            // extend the expiration
            const state = await stateChannel.channel(channelId);
            const preExpirationAt = state.expiredAt;
            const nextExpiration = 5;
            const msg2 = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256'],
                [channelId, indexer.address, consumer.address, preExpirationAt, nextExpiration]
            );
            let payload2 = ethers.utils.keccak256(msg2);
            let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payload2));
            let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payload2));

            await stateChannel.extend(channelId, preExpirationAt, nextExpiration, indexerSign, consumerSign);

            // fund again when renewal expiredAt.
            await stateChannel.fund(channelId, etherParse('1'), etherParse('0.1'), '0x', sign);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.total).to.equal(etherParse('1.1'));

            await expect(
                stateChannel.extend(channelId, preExpirationAt, nextExpiration, indexerSign, consumerSign)
            ).to.be.revertedWith('SC002');
        });

        /**
         * when only one indexer in the pool and that indexer unregistered,
         * channel can still be terminated, consumer can claim the channel token
         * rewards in the pool should be burned if collect is called on the pool
         */
        it('terminate State Channel after indexer unregistration #1', async () => {
            // preperation, open 1 channel
            await stateChannel.setTerminateExpiration(5); // 5s
            const channelId = ethers.utils.randomBytes(32);
            const balanceBefore = await token.balanceOf(consumer.address);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('0.1'), time.duration.days(5).toNumber());
            let balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('1'));
            const query1 = await buildQueryState(channelId, indexer, consumer, etherParse('0.4'), false);

            await indexerRegistry.connect(indexer).unregisterIndexer();
            await startNewEra(waffle.provider, eraManager)
            // unregister take effect, indexer's stake becomes 0
            // terminate should work, reward goes to pool, but indexer's labor is marked 0
            await stateChannel.connect(indexer).terminate(query1);
            await delay(6);
            await stateChannel.claim(channelId);
            balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('0.4'));

            // start new era so we can try collect the channel reward
            const era = await startNewEra(waffle.provider, eraManager);
            let unclaimed = await rewardsPool.getUnclaimDeployments(era.toNumber()-1, indexer.address);
            expect(unclaimed.length).to.be.gt(0);
            const tx = await rewardsHelper.connect(indexer).indexerCatchup(indexer.address);
            const evt = await eventFrom(tx, token, 'Transfer(address,address,uint256)');
            unclaimed = await rewardsPool.getUnclaimDeployments(era.toNumber()-1, indexer.address);
            // pool is deleted
            expect(unclaimed).to.be.empty;
            // rewards burned
            expect(evt.to).to.eq('0x0000000000000000000000000000000000000000');
            expect(evt.value).to.eq(etherParse('0.4'));

        });

        /**
         * when more than one indexer in the pool and that indexer unregistered,
         * channel can still be terminated, consumer can claim the channel token
         * rewards in the pool should all belong to the other indexer
         */
        it('terminate State Channel after indexer unregistration #2', async () => {
            // preperation, open 2 channels
            await stateChannel.setTerminateExpiration(5); // 5s
            const channelId = ethers.utils.randomBytes(32);
            const channelId2 = ethers.utils.randomBytes(32);
            const balanceBefore = await token.balanceOf(consumer.address);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('0.1'), time.duration.days(5).toNumber());
            await openChannel(channelId2, indexer2, consumer, etherParse('1'), etherParse('0.1'), time.duration.days(5).toNumber());
            let balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('2'));
            const query1 = await buildQueryState(channelId, indexer, consumer, etherParse('0.4'), false);
            const query2 = await buildQueryState(channelId2, indexer2, consumer, etherParse('0.3'), false);

            await indexerRegistry.connect(indexer).unregisterIndexer();
            await startNewEra(waffle.provider, eraManager)
            // unregister take effect, indexer's stake becomes 0
            // terminate should work, reward goes to pool, but indexer's labor is marked 0
            await stateChannel.connect(indexer).terminate(query1);
            await stateChannel.connect(indexer2).terminate(query2);
            await delay(6);
            await stateChannel.claim(channelId);
            await stateChannel.claim(channelId2);
            balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('0.7'));
            // start new era so we can try collect the channel reward
            const era = await startNewEra(waffle.provider, eraManager);
            await rewardsHelper.connect(indexer).indexerCatchup(indexer.address);
            const tx = await rewardsHelper.connect(indexer2).indexerCatchup(indexer2.address);
            const evts = await eventsFrom(tx, token, 'Transfer(address,address,uint256)');
            const burn = evts.find(evt=>evt.to==='0x0000000000000000000000000000000000000000');
            const indexerReward = await rewardsDistributor.userRewards(indexer.address, indexer.address);
            expect(indexerReward).to.eq(0);
            const indexerReward2 = await rewardsDistributor.userRewards(indexer2.address, indexer2.address);
            // due to math in the rewardDistributor, we will lose some token as deviation
            const deviation = 1e10;
            expect(etherParse('0.7').sub(indexerReward2).sub(burn.value)).to.lt(deviation);
            const reward1 = await rewardsPool.getReward(deploymentId,era.toNumber()-1, indexer.address);
            const reward2 = await rewardsPool.getReward(deploymentId,era.toNumber()-1, indexer2.address);
            expect(reward1[0]).to.eq(0);
            expect(reward1[1]).to.eq(0);
            expect(reward2[0]).to.eq(0);
            expect(reward2[1]).to.eq(0);
        });

        /**
         * like #2 but change the order indexer claims
         */
        it('terminate State Channel after indexer unregistration #3', async () => {
            // preperation, open 2 channels
            await stateChannel.setTerminateExpiration(5); // 5s
            const channelId = ethers.utils.randomBytes(32);
            const channelId2 = ethers.utils.randomBytes(32);
            const balanceBefore = await token.balanceOf(consumer.address);
            await openChannel(channelId, indexer, consumer, etherParse('1'), etherParse('0.1'), time.duration.days(5).toNumber());
            await openChannel(channelId2, indexer2, consumer, etherParse('1'), etherParse('0.1'), time.duration.days(5).toNumber());
            let balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('2'));
            const query1 = await buildQueryState(channelId, indexer, consumer, etherParse('0.4'), false);
            const query2 = await buildQueryState(channelId2, indexer2, consumer, etherParse('0.3'), false);

            await indexerRegistry.connect(indexer).unregisterIndexer();
            await startNewEra(waffle.provider, eraManager)
            // unregister take effect, indexer's stake becomes 0
            // terminate should work, reward goes to pool, but indexer's labor is marked 0
            await stateChannel.connect(indexer).terminate(query1);
            await stateChannel.connect(indexer2).terminate(query2);
            await delay(6);
            await stateChannel.claim(channelId);
            await stateChannel.claim(channelId2);
            balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('0.7'));
            // start new era so we can try collect the channel reward
            const era = await startNewEra(waffle.provider, eraManager);
            const tx = await rewardsHelper.connect(indexer2).indexerCatchup(indexer2.address);
            await expect(rewardsHelper.connect(indexer).indexerCatchup(indexer.address)).to.revertedWith('RP005');
            const evts = await eventsFrom(tx, token, 'Transfer(address,address,uint256)');
            const burn = evts.find(evt=>evt.to==='0x0000000000000000000000000000000000000000');
            const indexerReward = await rewardsDistributor.userRewards(indexer.address, indexer.address);
            expect(indexerReward).to.eq(0);
            const indexerReward2 = await rewardsDistributor.userRewards(indexer2.address, indexer2.address);
            // due to math in the rewardDistributor, we will lose some token as deviation
            const deviation = 1e10;
            expect(etherParse('0.7').sub(indexerReward2).sub(burn.value)).to.lt(deviation);
            const reward1 = await rewardsPool.getReward(deploymentId,era.toNumber()-1, indexer.address);
            const reward2 = await rewardsPool.getReward(deploymentId,era.toNumber()-1, indexer2.address);
            expect(reward1[0]).to.eq(0);
            expect(reward1[1]).to.eq(0);
            expect(reward2[0]).to.eq(0);
            expect(reward2[1]).to.eq(0);
        });
    });
});