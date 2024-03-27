// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { BigNumber, BigNumberish, BytesLike, constants, Wallet } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { deployContracts } from './setup';
import {
    EraManager,
    IndexerRegistry,
    RewardsDistributor,
    RewardsHelper,
    RewardsPool,
    ERC20,
    Staking,
    StateChannel,
    RewardsBooster,
    ProjectType,
    ProjectRegistry,
} from '../src';
import { deploymentIds, deploymentMetadatas, projectMetadatas } from './constants';
import {
    blockTravel,
    createProject,
    delay,
    etherParse,
    boosterDeployment,
    eventsFrom,
    registerRunner,
    startNewEra,
    time,
    openChannel,
    revertMsg,
} from './helper';

describe('StateChannel Contract', () => {
    const deploymentId = deploymentIds[0];
    const defaultChannelId = ethers.utils.randomBytes(32);
    let queryRewards0;

    let wallet_0, runner, consumer, runner2, runner3, treasury;

    let token: ERC20;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributor;
    let rewardsHelper: RewardsHelper;
    let rewardsPool: RewardsPool;
    let rewardsBooster: RewardsBooster;
    let stateChannel: StateChannel;
    let projectRegistry: ProjectRegistry;

    const buildQueryState = async (
        channelId: Uint8Array,
        runner: Wallet,
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
        const payloadHash = ethers.utils.keccak256(msg);

        const indexerSign = await runner.signMessage(ethers.utils.arrayify(payloadHash));
        const consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

        const recoveredIndexer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), indexerSign);
        expect(runner.address).to.equal(recoveredIndexer);

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

    const deployer = () => deployContracts(wallet_0, runner, treasury);
    before(async () => {
        [wallet_0, runner, consumer, runner2, runner3, treasury] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributor;
        rewardsHelper = deployment.rewardsHelper;
        rewardsPool = deployment.rewardsPool;
        rewardsBooster = deployment.rewardsBooster;
        eraManager = deployment.eraManager;
        stateChannel = deployment.stateChannel;
        projectRegistry = deployment.projectRegistry;

        // createProject
        await createProject(
            projectRegistry,
            wallet_0,
            projectMetadatas[0],
            deploymentMetadatas[0],
            deploymentIds[0],
            ProjectType.SUBQUERY
        );
        await rewardsBooster.setIssuancePerBlock(etherParse('0.5'));
        await rewardsBooster.setBoosterQueryRewardRate(ProjectType.SUBQUERY, 5e5); // 50%
        await token.connect(treasury).approve(rewardsBooster.address, constants.MaxInt256);
    });

    describe('State Channel Config', () => {
        it('set State Channel terminateExpiration should work', async () => {
            expect(await stateChannel.terminateExpiration()).to.equal(86400);
            await stateChannel.setTerminateExpiration(60);
            expect(await stateChannel.terminateExpiration()).to.equal(60);
        });

        it('set State Channel terminateExpiration without owner should fail', async () => {
            await expect(stateChannel.connect(consumer).setTerminateExpiration(10)).to.be.revertedWith(
                revertMsg.notOwner
            );
        });
    });

    describe('State Channel Open', () => {
        beforeEach(async () => {
            await registerRunner(token, indexerRegistry, staking, wallet_0, runner, etherParse('2000'));
            await token.connect(wallet_0).transfer(consumer.address, etherParse('5'));
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('5'));
        });

        it('open a State Channel should work', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('1'),
                60
            );

            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1); // 0 is Finalized, 1 is Open, 2 is Terminate
            expect(channel.indexer).to.equal(runner.address);
            expect(channel.consumer).to.equal(consumer.address);
            expect(channel.total).to.equal(etherParse('1'));
            const onchainPrice = await stateChannel.channelPrice(channelId);
            expect(onchainPrice).to.eq(etherParse('1'));
        });

        it('repeat same channel Id State Channel should not work', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('0.5'),
                etherParse('0.1'),
                6
            );
            await expect(
                openChannel(
                    stateChannel,
                    channelId,
                    deploymentId,
                    runner,
                    consumer,
                    etherParse('0.5'),
                    etherParse('0.5'),
                    60
                )
            ).to.be.revertedWith('SC001');
        });

        it('can repeat same channel Id after channel is finalized', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                60
            );

            const balance = await token.balanceOf(stateChannel.address);
            expect(balance).to.equal(etherParse('1'));

            const query = await buildQueryState(channelId, runner, consumer, etherParse('1'), true);
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(channelId)).status).to.equal(0);
            expect(await token.balanceOf(stateChannel.address)).to.equal(0);

            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('0.1'),
                etherParse('0.1'),
                6
            );
            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1);
            expect(channel.total).to.equal(etherParse('0.1'));
            expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('0.1'));
        });
    });

    describe('State Channel Checkpoint', () => {
        beforeEach(async () => {
            await registerRunner(token, indexerRegistry, staking, wallet_0, runner, etherParse('2000'));
            await token.connect(wallet_0).transfer(consumer.address, etherParse('5'));
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('5'));
        });

        it('checkpoint State Channel three steps', async () => {
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('5'));

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                60
            );
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('4'));

            const query1 = await buildQueryState(channelId, runner, consumer, etherParse('0.1'), false);
            await stateChannel.checkpoint(query1);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.1'));
            expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('0.9'));

            // check rewards
            const currentEra = (await eraManager.eraNumber()).toNumber();
            const infos = await rewardsPool.getReward(deploymentId, currentEra, runner.address);
            expect(infos[0]).to.be.eq(etherParse('0.1')); // labor
            expect(infos[1]).to.be.eq(etherParse('0.1')); // reward

            const query2 = await buildQueryState(channelId, runner, consumer, etherParse('0.2'), false);
            await stateChannel.checkpoint(query2);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.2'));
            expect(await token.balanceOf(stateChannel.address)).to.equal(etherParse('0.8'));

            const query3 = await buildQueryState(channelId, runner, consumer, etherParse('0.4'), true);
            await stateChannel.checkpoint(query3);
            expect(await token.balanceOf(stateChannel.address)).to.equal(0);
            expect((await stateChannel.channel(channelId)).status).to.equal(0);
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('4.6'));
        });
    });

    describe('State Channel Rewards Fund', () => {
        const consumerInit = etherParse('10005');
        beforeEach(async () => {
            await registerRunner(token, indexerRegistry, staking, wallet_0, runner, etherParse('2000'));
            await token.connect(wallet_0).transfer(treasury.address, etherParse('100000'));
            await token.connect(wallet_0).transfer(consumer.address, consumerInit);
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('5'));
            await token.connect(wallet_0).transfer(rewardsBooster.address, etherParse('5'));

            await openChannel(
                stateChannel,
                defaultChannelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('1'),
                time.duration.days(1).toString()
            );
            expect((await stateChannel.channel(defaultChannelId)).realTotal).to.equal(etherParse('1'));
            expect((await stateChannel.channel(defaultChannelId)).total).to.equal(etherParse('1'));
            expect(await token.balanceOf(consumer.address)).to.equal(consumerInit.sub(etherParse('1')));

            await boosterDeployment(token, rewardsBooster, consumer, deploymentId, etherParse('10000'));

            await blockTravel(1000);
            queryRewards0 = await rewardsBooster.getQueryRewards(deploymentId, consumer.address);
            const abi = ethers.utils.defaultAbiCoder;
            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
                [defaultChannelId, runner.address, consumer.address, etherParse('1'), queryRewards0, '0x']
            );
            const payload = ethers.utils.keccak256(msg);
            const sign = await consumer.signMessage(ethers.utils.arrayify(payload));
            await stateChannel.fund(defaultChannelId, etherParse('1'), queryRewards0, '0x', sign);

            const consumerRewards = await rewardsBooster.getBoosterQueryRewards(deploymentId, consumer.address);
            expect(consumerRewards.spentQueryRewards).to.equal(queryRewards0);
        });

        it('can spend from query rewards', async () => {
            expect((await stateChannel.channel(defaultChannelId)).realTotal).to.equal(etherParse('1'));
            expect((await stateChannel.channel(defaultChannelId)).total).to.equal(queryRewards0.add(etherParse('1')));
        });

        it('spent more than rewards', async () => {
            // one block rewards
            const oneBlockRewards = await rewardsBooster.getQueryRewards(deploymentId, consumer.address);
            const query = await buildQueryState(
                defaultChannelId,
                runner,
                consumer,
                queryRewards0.add(oneBlockRewards.mul(2)).add(etherParse('0.5')),
                true
            );
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(defaultChannelId)).status).to.equal(0);
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('4.5'));
            const consumerRewards2 = await rewardsBooster.getBoosterQueryRewards(deploymentId, consumer.address);
            expect(consumerRewards2.spentQueryRewards).to.equal(queryRewards0.add(oneBlockRewards.mul(2)));
        });

        it('spent less than rewards', async () => {
            const query = await buildQueryState(
                defaultChannelId,
                runner,
                consumer,
                queryRewards0.sub(etherParse('0.5')),
                true
            );
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(defaultChannelId)).status).to.equal(0);
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('5'));
            const consumerRewards = await rewardsBooster.getBoosterQueryRewards(deploymentId, consumer.address);
            expect(consumerRewards.spentQueryRewards).to.equal(queryRewards0.sub(etherParse('0.5')));
        });

        it('fund more than rewards', async () => {
            const queryRewards2 = await rewardsBooster.getQueryRewards(deploymentId, consumer.address);
            const consumerRewards0 = await rewardsBooster.getBoosterQueryRewards(deploymentId, consumer.address);
            const spentQueryRewards0 = consumerRewards0.spentQueryRewards;

            // This is related to the reward for each block time. If the test fails, it needs to be modified.
            // use 1 block travel to get the reward
            await blockTravel(1);
            const queryRewards3 = await rewardsBooster.getQueryRewards(deploymentId, consumer.address);
            const nextFund = queryRewards3.sub(queryRewards2).mul(2).add(etherParse(1)).add(queryRewards2);

            const abi = ethers.utils.defaultAbiCoder;
            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
                [defaultChannelId, runner.address, consumer.address, queryRewards0.add(etherParse(1)), nextFund, '0x']
            );
            const payload = ethers.utils.keccak256(msg);
            const sign = await consumer.signMessage(ethers.utils.arrayify(payload));
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('4'));
            await stateChannel.fund(defaultChannelId, queryRewards0.add(etherParse(1)), nextFund, '0x', sign);

            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('3'));
            const consumerRewards1 = await rewardsBooster.getBoosterQueryRewards(deploymentId, consumer.address);
            expect(consumerRewards1.spentQueryRewards.sub(spentQueryRewards0)).to.equal(nextFund.sub(etherParse(1)));

            const query = await buildQueryState(defaultChannelId, runner, consumer, etherParse('1'), true);
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(defaultChannelId)).status).to.equal(0);
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('5'));
            const consumerRewards2 = await rewardsBooster.getBoosterQueryRewards(deploymentId, consumer.address);
            expect(consumerRewards2.spentQueryRewards).to.equal(etherParse('1'));
        });
    });

    describe('State Channel Terminate', () => {
        beforeEach(async () => {
            await registerRunner(token, indexerRegistry, staking, wallet_0, runner, etherParse('2000'));
            await registerRunner(token, indexerRegistry, staking, wallet_0, runner2, etherParse('2000'));
            await registerRunner(token, indexerRegistry, staking, wallet_0, runner3, etherParse('2000'));
            await token.connect(wallet_0).transfer(consumer.address, etherParse('5'));
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('5'));
            await eraManager.updateEraPeriod(time.duration.days(1).toString());
        });

        it('terminate without spent success', async () => {
            await stateChannel.setTerminateExpiration(5); // 5s

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                60
            );

            const query1 = await buildEmptyState(channelId);
            await stateChannel.connect(runner).terminate(query1);
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
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                60
            );

            const query1 = await buildQueryState(channelId, runner, consumer, etherParse('0.1'), false);
            await stateChannel.connect(runner).terminate(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.spent).to.equal(etherParse('0.1'));
            expect(state1.status).to.equal(2); // Terminate

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('SC008');

            await delay(6);
            await stateChannel.claim(channelId);

            const balance2 = await token.balanceOf(consumer.address);
            expect(balance2).to.equal(etherParse('4.9'));

            await startNewEra(eraManager);
            await rewardsHelper.connect(runner).indexerCatchup(runner.address);
            const indexerReward = await rewardsDistributor.userRewards(runner.address, runner.address);

            expect(indexerReward).to.eq(etherParse('0.1'));
        });

        it('terminate State Channel failure with respond', async () => {
            await stateChannel.setTerminateExpiration(5); // 5s

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                60
            );

            const query1 = await buildQueryState(channelId, runner, consumer, etherParse('0.1'), false);
            await stateChannel.connect(consumer).terminate(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.spent).to.equal(etherParse('0.1'));
            expect(state1.status).to.equal(2); // Terminate
            expect(await stateChannel.channelPrice(channelId)).to.eq(etherParse('0.1'));

            const query2 = await buildQueryState(channelId, runner, consumer, etherParse('0.2'), false);
            await stateChannel.connect(runner).respond(query2);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.spent).to.equal(0);
            expect(state2.status).to.equal(0); // Finalized
            expect(await stateChannel.channelPrice(channelId)).to.eq(0);

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('SC008');
        });

        it('terminate State Channel with continue fund', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                5
            ); // 5s expiration

            await delay(6); // channel is expiredAt

            const abi = ethers.utils.defaultAbiCoder;
            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
                [channelId, runner.address, consumer.address, etherParse('1'), etherParse('0.1'), '0x']
            );
            const payload = ethers.utils.keccak256(msg);
            const sign = await consumer.signMessage(ethers.utils.arrayify(payload));
            const recover = ethers.utils.verifyMessage(ethers.utils.arrayify(payload), sign);
            expect(consumer.address).to.equal(recover);

            // fund again when expired.
            await stateChannel.fund(channelId, etherParse('1'), etherParse('0.1'), '0x', sign);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.total).to.equal(etherParse('1.1'));

            // extend the expiration
            const state = await stateChannel.channel(channelId);
            const preExpirationAt = state.expiredAt;
            const nextExpiration = 5;
            const msg2 = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256'],
                [channelId, runner.address, consumer.address, preExpirationAt, nextExpiration]
            );
            const payload2 = ethers.utils.keccak256(msg2);
            const indexerSign = await runner.signMessage(ethers.utils.arrayify(payload2));
            const consumerSign = await consumer.signMessage(ethers.utils.arrayify(payload2));

            await stateChannel.extend(channelId, preExpirationAt, nextExpiration, indexerSign, consumerSign);
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
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            let balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('1'));
            const query1 = await buildQueryState(channelId, runner, consumer, etherParse('0.4'), false);

            await indexerRegistry.connect(runner).unregisterIndexer();
            await startNewEra(eraManager);
            // unregister take effect, indexer's stake becomes 0
            // terminate should work, reward goes to pool, but indexer's labor is marked 0
            await stateChannel.connect(runner).terminate(query1);
            await delay(6);
            await stateChannel.claim(channelId);
            balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('0.4'));

            // start new era so we can try collect the channel reward
            const era = await startNewEra(eraManager);
            const unclaimed = await rewardsPool.getUnclaimDeployments(era.toNumber() - 1, runner.address);
            expect(unclaimed).to.be.empty;
            const reward = await rewardsPool.getReward(deploymentId, era.toNumber() - 1, runner.address);
            expect(reward[0]).to.be.eq(0);
            expect(reward[1]).to.be.eq(etherParse('0.4'));

            await rewardsHelper.connect(runner).indexerCatchup(runner.address);
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
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            await openChannel(
                stateChannel,
                channelId2,
                deploymentId,
                runner2,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            let balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('2'));
            const query1 = await buildQueryState(channelId, runner, consumer, etherParse('0.4'), false);
            const query2 = await buildQueryState(channelId2, runner2, consumer, etherParse('0.3'), false);

            await indexerRegistry.connect(runner).unregisterIndexer();
            await startNewEra(eraManager);
            // unregister take effect, indexer's stake becomes 0
            // terminate should work, reward goes to pool, but indexer's labor is marked 0
            await stateChannel.connect(runner).terminate(query1);
            await stateChannel.connect(runner2).terminate(query2);
            await delay(6);
            await stateChannel.claim(channelId);
            await stateChannel.claim(channelId2);
            balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('0.7'));
            // start new era so we can try collect the channel reward
            const era = await startNewEra(eraManager);
            await rewardsHelper.connect(runner).indexerCatchup(runner.address);
            const tx = await rewardsHelper.connect(runner2).indexerCatchup(runner2.address);
            const evts = await eventsFrom(tx, token, 'Transfer(address,address,uint256)');
            const burn = evts.find((evt) => evt.to === '0x0000000000000000000000000000000000000000');
            expect(burn).to.be.undefined;
            const indexerReward = await rewardsDistributor.userRewards(runner.address, runner.address);
            expect(indexerReward).to.eq(0);
            const indexerReward2 = await rewardsDistributor.userRewards(runner2.address, runner2.address);
            expect(indexerReward2).to.be.eq(etherParse('0.7'));
            const reward2 = await rewardsPool.getReward(deploymentId, era.toNumber() - 1, runner2.address);
            expect(reward2[0]).to.eq(0);
            expect(reward2[1]).to.eq(0);
        });

        /**
         * 3 indexers work in the pool, two indexers share the reward, and burn the remanant
         */
        it('terminate State Channel after indexer unregistration #3', async () => {
            // preperation, open 2 channels
            await stateChannel.setTerminateExpiration(5); // 5s
            const channelId = ethers.utils.randomBytes(32);
            const channelId2 = ethers.utils.randomBytes(32);
            const channelId3 = ethers.utils.randomBytes(32);
            const balanceBefore = await token.balanceOf(consumer.address);
            await openChannel(
                stateChannel,
                channelId,
                deploymentId,
                runner,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            await openChannel(
                stateChannel,
                channelId2,
                deploymentId,
                runner2,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            await openChannel(
                stateChannel,
                channelId3,
                deploymentId,
                runner3,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            let balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('3'));
            const query1 = await buildQueryState(channelId, runner, consumer, etherParse('0.4'), false);
            const query2 = await buildQueryState(channelId2, runner2, consumer, etherParse('0.3'), false);
            const query3 = await buildQueryState(channelId3, runner3, consumer, etherParse('0.3'), false);

            await indexerRegistry.connect(runner).unregisterIndexer();
            await startNewEra(eraManager);
            // unregister take effect, indexer's stake becomes 0
            // terminate should work, reward goes to pool, but indexer's labor is marked 0
            await stateChannel.connect(runner).terminate(query1);
            await stateChannel.connect(runner2).terminate(query2);
            await stateChannel.connect(runner3).terminate(query3);
            await delay(6);
            await stateChannel.claim(channelId);
            await stateChannel.claim(channelId2);
            await stateChannel.claim(channelId3);
            balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('1'));
            // start new era so we can try collect the channel reward
            const era = await startNewEra(eraManager);
            await rewardsHelper.connect(runner2).indexerCatchup(runner2.address);
            const tx2 = await rewardsHelper.connect(runner3).indexerCatchup(runner3.address);
            await rewardsHelper.connect(runner).indexerCatchup(runner.address);

            const evts = await eventsFrom(tx2, token, 'Transfer(address,address,uint256)');
            const fee = evts.find((evt) => evt.to === treasury.address);
            const indexerReward = await rewardsDistributor.userRewards(runner.address, runner.address);
            expect(indexerReward).to.eq(0);
            const indexerReward2 = await rewardsDistributor.userRewards(runner2.address, runner2.address);
            const indexerReward3 = await rewardsDistributor.userRewards(runner3.address, runner3.address);
            // due to math in the rewardDistributor, we will lose some token as deviation
            const deviation = 1e10;
            expect(etherParse('1').sub(indexerReward2).sub(indexerReward3).sub(fee.value)).to.lt(deviation);
            const reward2 = await rewardsPool.getReward(deploymentId, era.toNumber() - 1, runner2.address);
            expect(reward2[0]).to.eq(0);
            expect(reward2[1]).to.eq(0);
            const reward3 = await rewardsPool.getReward(deploymentId, era.toNumber() - 1, runner3.address);
            expect(reward3[0]).to.eq(0);
            expect(reward3[1]).to.eq(0);
        });
    });
});
