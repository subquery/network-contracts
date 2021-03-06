// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {METADATA_HASH, DEPLOYMENT_ID, deploymentIds, metadatas, VERSION} from './constants';
import {IndexerRegistry, RewardsDistributer, EraManager, SQToken, Staking, StateChannel} from '../src';
import {constants, registerIndexer, startNewEra, time, delay, etherParse} from './helper';
import {utils, Wallet, BigNumberish, BytesLike, BigNumber} from 'ethers';

describe('StateChannel Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, indexer, consumer;

    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributer;
    let stateChannel: StateChannel;

    const openChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
        amount: BigNumber,
        expiration: number
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256'],
            [channelId, indexer.address, consumer.address, amount, expiration]
        );
        let payloadHash = ethers.utils.keccak256(msg);

        let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
        let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

        const recoveredIndexer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), indexerSign);
        expect(indexer.address).to.equal(recoveredIndexer);

        const recoveredConsumer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), consumerSign);
        expect(consumer.address).to.equal(recoveredConsumer);

        await stateChannel.open(
            channelId,
            indexer.address,
            consumer.address,
            amount,
            expiration,
            indexerSign,
            consumerSign
        );
    };

    const buildQueryState = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
        isFinal: boolean,
        count: number,
        price: BigNumber
    ): Promise<{
        channelId: BigNumberish;
        isFinal: boolean;
        count: BigNumberish;
        price: BigNumberish;
        indexerSign: BytesLike;
        consumerSign: BytesLike;
    }> => {
        const abi = ethers.utils.defaultAbiCoder;
        const msg = abi.encode(['uint256', 'uint256', 'uint256', 'bool'], [channelId, count, price, isFinal]);
        let payloadHash = ethers.utils.keccak256(msg);

        let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
        let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

        const recoveredIndexer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), indexerSign);
        expect(indexer.address).to.equal(recoveredIndexer);

        const recoveredConsumer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), consumerSign);
        expect(consumer.address).to.equal(recoveredConsumer);

        return {
            channelId: channelId,
            isFinal: isFinal,
            count: count,
            price: price,
            indexerSign: indexerSign,
            consumerSign: consumerSign,
        };
    };

    beforeEach(async () => {
        [wallet_0, indexer, consumer] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, indexer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributer;
        eraManager = deployment.eraManager;
        stateChannel = deployment.stateChannel;
    });

    describe('State Channel Config', () => {
        it('set State Channel challengeExpiration should work', async () => {
            expect(await stateChannel.challengeExpiration()).to.equal(86400);
            await stateChannel.setChallengeExpiration(60);
            expect(await stateChannel.challengeExpiration()).to.equal(60);
        });

        it('set State Channel challengeExpiration without owner should fail', async () => {
            await expect(stateChannel.connect(consumer).setChallengeExpiration(10)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });
    });

    describe('State Channel Open', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '10');
            await token.connect(wallet_0).transfer(consumer.address, etherParse("5"));
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse("5"));
        });

        it('open a State Channel should work', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse("1"), 60);

            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1); // 0 is Finalized, 1 is Open, 2 is Challenge
            expect(channel.indexer).to.equal(indexer.address);
            expect(channel.consumer).to.equal(consumer.address);
            expect(channel.balance).to.equal(etherParse("1"));
        });

        it('repeat same channel Id State Channel should not work', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse("0.5"), 6);
            await expect(openChannel(channelId, indexer, consumer, etherParse("0.5"), 60)).to.be.revertedWith(
                'ChannelId already existed'
            );
        });

        it('repeat same channel Id after channel is finalized', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse("1"), 60);

            const balance = await token.balanceOf(stateChannel.address);
            expect(balance).to.equal(etherParse("1"));

            const query = await buildQueryState(channelId, indexer, consumer, true, 10, etherParse("0.1"));
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(channelId)).status).to.equal(0);

            const balance2 = await token.balanceOf(stateChannel.address);
            expect(balance2).to.equal(0);

            await openChannel(channelId, indexer, consumer, etherParse("0.1"), 6);
            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1);
            expect(channel.balance).to.equal(etherParse("0.1"));
        });
    });

    describe('State Channel Checkpoint', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '10');
            await token.connect(wallet_0).transfer(consumer.address, etherParse("5"));
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse("5"));
        });

        it('checkpoint State Channel three steps', async () => {
            const balance = await token.balanceOf(consumer.address);
            expect(balance).to.equal(etherParse("5")); 

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse("1"), 60);

            const balance1 = await token.balanceOf(consumer.address);
            expect(balance1).to.equal(etherParse("4")); 

            const query1 = await buildQueryState(channelId, indexer, consumer, false, 10, etherParse("0.01")); 
            await stateChannel.checkpoint(query1);
            expect((await stateChannel.channel(channelId)).balance).to.equal(etherParse("0.9"));

            const currentEar = await (await eraManager.eraNumber()).toNumber();
            const rewardsAddTable = await rewardsDistributor.getRewardsAddTable(
                indexer.address,
                currentEar,
                currentEar + 2
            );
            const rewardsRemoveTable = await rewardsDistributor.getRewardsRemoveTable(
                indexer.address,
                currentEar,
                currentEar + 2
            );
            const [eraReward, totalReward] = rewardsAddTable.reduce(
                (acc, val, idx) => {
                    let [eraReward, total] = acc;
                    eraReward = eraReward.add(val.sub(rewardsRemoveTable[idx]));
                    return [eraReward, total.add(eraReward)];
                },
                [BigNumber.from(0), BigNumber.from(0)]
            );
            expect(eraReward).to.be.eq(0);
            expect(totalReward).to.be.eq(etherParse("0.1"));

            const query2 = await buildQueryState(channelId, indexer, consumer, false, 20, etherParse("0.01")); 
            await stateChannel.checkpoint(query2);
            expect((await stateChannel.channel(channelId)).balance).to.equal(etherParse("0.8")); 

            const query3 = await buildQueryState(channelId, indexer, consumer, true, 40, etherParse("0.02")); 
            await stateChannel.checkpoint(query3);
            expect((await stateChannel.channel(channelId)).balance).to.equal(0); 

            const balance2 = await token.balanceOf(consumer.address);
            expect(balance2).to.equal(etherParse("4.4")); 
        });
    });

    describe('State Channel Challenge', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '10');
            await token.connect(wallet_0).transfer(consumer.address, etherParse("5"));
            await token.connect(consumer).increaseAllowance(stateChannel.address, etherParse("5"));
        });

        it('challenge State Channel success', async () => {
            await stateChannel.setChallengeExpiration(5); // 5s

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse("1"), 60);

            const query1 = await buildQueryState(channelId, indexer, consumer, false, 10, etherParse("0.01"));
            await stateChannel.challenge(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.balance).to.equal(etherParse("0.9"));
            expect(state1.status).to.equal(2); // Challenge

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('Channel not expired');

            await delay(6);
            await stateChannel.claim(channelId);

            const balance2 = await token.balanceOf(consumer.address);
            expect(balance2).to.equal(etherParse("4.9"));
        });

        it('challenge State Channel failure with respond', async () => {
            await stateChannel.setChallengeExpiration(5); // 5s

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse("1"), 60);

            const query1 = await buildQueryState(channelId, indexer, consumer, false, 10, etherParse("0.01"));
            await stateChannel.challenge(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.balance).to.equal(etherParse("0.9")); // 1000 - 100
            expect(state1.status).to.equal(2); // Challenge

            const query2 = await buildQueryState(channelId, indexer, consumer, false, 20, etherParse("0.01"));
            await stateChannel.respond(query2);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.balance).to.equal(etherParse("0.8")); // 900 - 100
            expect(state2.status).to.equal(1); // Open

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('Channel not expired');
        });

        it('challenge State Channel with continue fund', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, etherParse("1"), 5); // 5s expiration

            await delay(6); // channel is expirationAt

            const abi = ethers.utils.defaultAbiCoder;
            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256'],
                [channelId, indexer.address, consumer.address, etherParse("0.1")]
            );
            let payload = ethers.utils.keccak256(msg);
            let sign = await consumer.signMessage(ethers.utils.arrayify(payload));
            const recover = ethers.utils.verifyMessage(ethers.utils.arrayify(payload), sign);
            expect(consumer.address).to.equal(recover);

            await expect(stateChannel.fund(channelId, etherParse("0.1"), sign)).to.be.revertedWith('Channel lost efficacy');

            // extend the expiration
            const state = await stateChannel.channel(channelId);
            const preExpirationAt = state.expirationAt;
            const nextExpiration = 5;
            const msg2 = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256'],
                [channelId, indexer.address, consumer.address, preExpirationAt, nextExpiration]
            );
            let payload2 = ethers.utils.keccak256(msg2);
            let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payload2));
            let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payload2));

            await stateChannel.extend(channelId, preExpirationAt, nextExpiration, indexerSign, consumerSign);

            // fund again when renewal expirationAt.
            await stateChannel.fund(channelId, etherParse("0.1"), sign);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.balance).to.equal(etherParse("1.1"));

            await expect(
                stateChannel.extend(channelId, preExpirationAt, nextExpiration, indexerSign, consumerSign)
            ).to.be.revertedWith('Request is expired');
        });
    });
});
