// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import { BigNumber, BigNumberish, BytesLike, constants, Wallet } from 'ethers';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {
    EraManager,
    IndexerRegistry,
    RewardsDistributer,
    RewardsHelper,
    RewardsPool,
    ERC20,
    Staking,
    StateChannel,
    RewardsBooster, ProjectType, ProjectRegistry,
} from '../src';
import { deploymentIds, deploymentMetadatas, projectMetadatas } from './constants';
import {
    blockTravel,
    delay,
    etherParse,
    eventFrom,
    eventsFrom,
    registerIndexer,
    startNewEra,
    time
} from './helper';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe('StateChannel Contract', () => {
    const deploymentId = deploymentIds[0];
    const defaultChannelId = ethers.utils.randomBytes(32);

    let wallet_0, indexer, consumer, indexer2, indexer3, treasury;

    let token: ERC20;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributer;
    let rewardsHelper: RewardsHelper;
    let rewardsPool: RewardsPool;
    let rewardsBooster: RewardsBooster;
    let stateChannel: StateChannel;
    let projectRegistry: ProjectRegistry;

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

    const boosterDeployment = async (signer: SignerWithAddress, deployment: string, amount) => {
        await token.connect(signer).increaseAllowance(rewardsBooster.address, amount);
        await rewardsBooster.connect(signer).boostDeployment(deployment, amount);
    };

    const createProject = (wallet, projectMetadata, deploymentMetadata, deploymentId, projectType: ProjectType) => {
        return projectRegistry
            .connect(wallet)
            .createProject(projectMetadata, deploymentMetadata, deploymentId, projectType);
    };

    const deployer = () => deployContracts(wallet_0, indexer, treasury);
    before(async () => {
        [wallet_0, indexer, consumer, indexer2, indexer3, treasury] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributer;
        rewardsHelper = deployment.rewardsHelper;
        rewardsPool = deployment.rewardsPool;
        rewardsBooster = deployment.rewardsBooster;
        eraManager = deployment.eraManager;
        stateChannel = deployment.stateChannel;
        projectRegistry = deployment.projectRegistry;

        // createProject
        await createProject(wallet_0, projectMetadatas[0], deploymentMetadatas[0], deploymentIds[0], ProjectType.SUBQUERY);
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
            const onchainPrice = await stateChannel.channelPrice(channelId);
            expect(onchainPrice).to.eq(etherParse('1'));
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

    describe('State Channel Rewards Fund', () => {
        const consumerInit = etherParse(20000);
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '2000');
            await token.connect(wallet_0).transfer(treasury.address, etherParse(100000));
            await token.connect(wallet_0).transfer(consumer.address, consumerInit);
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse('5'));
            await token.connect(wallet_0).transfer(rewardsBooster.address, etherParse('5'));

            await openChannel(defaultChannelId, indexer, consumer, etherParse('1'), etherParse('1'), time.duration.days(1).toString());
            expect((await stateChannel.channel(defaultChannelId)).realTotal).to.equal(etherParse('1'));
            expect((await stateChannel.channel(defaultChannelId)).total).to.equal(etherParse('1'));
            expect(await token.balanceOf(consumer.address)).to.equal(consumerInit.sub(1));

            await boosterDeployment(consumer, deploymentId, etherParse(10000));
        });

        it('can spend from query rewards', async ()=>{
            await blockTravel(waffle.provider, 1000);
            const queryRewards = await rewardsBooster.getQueryRewards(deploymentId, consumer.address);
            const abi = ethers.utils.defaultAbiCoder;
            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
                [defaultChannelId, indexer.address, consumer.address, etherParse('1'), etherParse('1'), '0x']
            );
            let payload = ethers.utils.keccak256(msg);
            let sign = await consumer.signMessage(ethers.utils.arrayify(payload));
            await stateChannel.fund(defaultChannelId, etherParse('1'), etherParse('1'), '0x', sign);

            expect((await stateChannel.channel(defaultChannelId)).realTotal).to.equal(etherParse('1'));
            expect((await stateChannel.channel(defaultChannelId)).total).to.equal(etherParse('2'));
        })

        it('spent more than rewards', async () => {
            const query = await buildQueryState(defaultChannelId, indexer, consumer, etherParse('1.5'), true);
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(defaultChannelId)).status).to.equal(0);
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('4.5'));
            expect(await token.balanceOf(rewardsBooster.address)).to.equal(etherParse('4'));
        });

        it('spent less than rewards', async () => {
            const query = await buildQueryState(defaultChannelId, indexer, consumer, etherParse('0.5'), true);
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(defaultChannelId)).status).to.equal(0);
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('5'));
            expect(await token.balanceOf(rewardsBooster.address)).to.equal(etherParse('4.5'));
        });

        it('fund more than rewards', async () => {
            const abi = ethers.utils.defaultAbiCoder;
            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
                [defaultChannelId, indexer.address, consumer.address, etherParse('2'), etherParse('5'), '0x']
            );
            let payload = ethers.utils.keccak256(msg);
            let sign = await consumer.signMessage(ethers.utils.arrayify(payload));
            await stateChannel.fund(defaultChannelId, etherParse('2'), etherParse('5'), '0x', sign); // 4 + 1
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('3'));
            expect(await token.balanceOf(rewardsBooster.address)).to.equal(0);

            const query = await buildQueryState(defaultChannelId, indexer, consumer, etherParse('1.5'), true);
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(defaultChannelId)).status).to.equal(0);
            expect(await token.balanceOf(consumer.address)).to.equal(etherParse('5'));
            expect(await token.balanceOf(rewardsBooster.address)).to.equal(etherParse('3.5')); // 7 - 1.5 - 2
        });
    });

    describe('State Channel Terminate', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '2000');
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer2, '2000');
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer3, '2000');
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

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('SC008');

            await delay(6);
            await stateChannel.claim(channelId);

            const balance2 = await token.balanceOf(consumer.address);
            expect(balance2).to.equal(etherParse('4.9'));

            await startNewEra(waffle.provider, eraManager);
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
            expect(await stateChannel.channelPrice(channelId)).to.eq(etherParse('0.1'));

            const query2 = await buildQueryState(channelId, indexer, consumer, etherParse('0.2'), false);
            await stateChannel.connect(indexer).respond(query2);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.spent).to.equal(0);
            expect(state2.status).to.equal(0); // Finalized
            expect(await stateChannel.channelPrice(channelId)).to.eq(0);

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
            await openChannel(
                channelId,
                indexer,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            let balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('1'));
            const query1 = await buildQueryState(channelId, indexer, consumer, etherParse('0.4'), false);

            await indexerRegistry.connect(indexer).unregisterIndexer();
            await startNewEra(waffle.provider, eraManager);
            // unregister take effect, indexer's stake becomes 0
            // terminate should work, reward goes to pool, but indexer's labor is marked 0
            await stateChannel.connect(indexer).terminate(query1);
            await delay(6);
            await stateChannel.claim(channelId);
            balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('0.4'));

            // start new era so we can try collect the channel reward
            const era = await startNewEra(waffle.provider, eraManager);
            const unclaimed = await rewardsPool.getUnclaimDeployments(era.toNumber() - 1, indexer.address);
            expect(unclaimed).to.be.empty;
            const reward = await rewardsPool.getReward(deploymentId, era.toNumber() - 1, indexer.address);
            expect(reward[0]).to.be.eq(0);
            expect(reward[1]).to.be.eq(etherParse('0.4'));

            await rewardsHelper.connect(indexer).indexerCatchup(indexer.address);
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
                channelId,
                indexer,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            await openChannel(
                channelId2,
                indexer2,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            let balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('2'));
            const query1 = await buildQueryState(channelId, indexer, consumer, etherParse('0.4'), false);
            const query2 = await buildQueryState(channelId2, indexer2, consumer, etherParse('0.3'), false);

            await indexerRegistry.connect(indexer).unregisterIndexer();
            await startNewEra(waffle.provider, eraManager);
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
            const burn = evts.find((evt) => evt.to === '0x0000000000000000000000000000000000000000');
            expect(burn).to.be.undefined;
            const indexerReward = await rewardsDistributor.userRewards(indexer.address, indexer.address);
            expect(indexerReward).to.eq(0);
            const indexerReward2 = await rewardsDistributor.userRewards(indexer2.address, indexer2.address);
            expect(indexerReward2).to.be.eq(etherParse('0.7'));
            const reward2 = await rewardsPool.getReward(deploymentId, era.toNumber() - 1, indexer2.address);
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
                channelId,
                indexer,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            await openChannel(
                channelId2,
                indexer2,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            await openChannel(
                channelId3,
                indexer3,
                consumer,
                etherParse('1'),
                etherParse('0.1'),
                time.duration.days(5).toNumber()
            );
            let balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('3'));
            const query1 = await buildQueryState(channelId, indexer, consumer, etherParse('0.4'), false);
            const query2 = await buildQueryState(channelId2, indexer2, consumer, etherParse('0.3'), false);
            const query3 = await buildQueryState(channelId3, indexer3, consumer, etherParse('0.3'), false);

            await indexerRegistry.connect(indexer).unregisterIndexer();
            await startNewEra(waffle.provider, eraManager);
            // unregister take effect, indexer's stake becomes 0
            // terminate should work, reward goes to pool, but indexer's labor is marked 0
            await stateChannel.connect(indexer).terminate(query1);
            await stateChannel.connect(indexer2).terminate(query2);
            await stateChannel.connect(indexer3).terminate(query3);
            await delay(6);
            await stateChannel.claim(channelId);
            await stateChannel.claim(channelId2);
            await stateChannel.claim(channelId3);
            balanceAfter = await token.balanceOf(consumer.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(etherParse('1'));
            // start new era so we can try collect the channel reward
            const era = await startNewEra(waffle.provider, eraManager);
            const tx = await rewardsHelper.connect(indexer2).indexerCatchup(indexer2.address);
            const tx2 = await rewardsHelper.connect(indexer3).indexerCatchup(indexer3.address);
            await rewardsHelper.connect(indexer).indexerCatchup(indexer.address);

            const evts = await eventsFrom(tx2, token, 'Transfer(address,address,uint256)');
            const fee = evts.find((evt) => evt.to === treasury.address);
            const indexerReward = await rewardsDistributor.userRewards(indexer.address, indexer.address);
            expect(indexerReward).to.eq(0);
            const indexerReward2 = await rewardsDistributor.userRewards(indexer2.address, indexer2.address);
            const indexerReward3 = await rewardsDistributor.userRewards(indexer3.address, indexer3.address);
            // due to math in the rewardDistributor, we will lose some token as deviation
            const deviation = 1e10;
            expect(etherParse('1').sub(indexerReward2).sub(indexerReward3).sub(fee.value)).to.lt(deviation);
            const reward2 = await rewardsPool.getReward(deploymentId, era.toNumber() - 1, indexer2.address);
            expect(reward2[0]).to.eq(0);
            expect(reward2[1]).to.eq(0);
            const reward3 = await rewardsPool.getReward(deploymentId, era.toNumber() - 1, indexer3.address);
            expect(reward3[0]).to.eq(0);
            expect(reward3[1]).to.eq(0);
        });
    });
});
