// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {METADATA_HASH, DEPLOYMENT_ID, deploymentIds, metadatas, VERSION} from './constants';
import {IndexerRegistry, RewardsDistributer, EraManager, SQToken, Staking, StateChannel} from '../src';
import {constants, registerIndexer, startNewEra, time, delay} from './helper';
import {utils, Wallet, BigNumberish, BytesLike, BigNumber} from 'ethers';

describe('StateChannel Contract', () => {
    const mockProvider = waffle.provider;
    const deploymentId = deploymentIds[0];
    let wallet_0, indexer, consumer, consumer2, signer, consumerProxy, consumerHoster;

    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributer;
    let stateChannel: StateChannel;

    const registerIndexer = async (wallet: Wallet) => {
        await token.connect(wallet_0).transfer(wallet.address, 2000000000);
        await token.connect(wallet).increaseAllowance(staking.address, 2000000000);
        const tx = await indexerRegistry.connect(wallet).registerIndexer(1000000000, METADATA_HASH, 0);
        return tx;
    };

    const openChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        consumer: Wallet,
        amount: number,
        expiration: number
    ) => {
        const abi = ethers.utils.defaultAbiCoder;
        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes32', 'bytes'],
            [channelId, indexer.address, consumer.address, amount, expiration, deploymentId, '0x']
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
        isFinal: boolean,
        count: number,
        price: number
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
        [wallet_0, indexer, consumer, consumer2, signer] = await ethers.getSigners();
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
            await registerIndexer(indexer);
            await token.connect(wallet_0).transfer(consumer.address, 10000);
            await token.connect(consumer).increaseAllowance(stateChannel.address, 10000);
        });

        it('open a State Channel should work', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, 100, 60);

            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1); // 0 is Finalized, 1 is Open, 2 is Challenge
            expect(channel.indexer).to.equal(indexer.address);
            expect(channel.consumer).to.equal(consumer.address);
            expect(channel.balance).to.equal(100);
        });

        it('repeat same channel Id State Channel should not work', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, 10, 6);
            await expect(openChannel(channelId, indexer, consumer, 100, 60)).to.be.revertedWith(
                'ChannelId already existed'
            );
        });

        it('repeat same channel Id after channel is finalized', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, 1000, 60);

            const balance = await token.balanceOf(stateChannel.address);
            expect(balance).to.equal(1000);

            const query = await buildQueryState(channelId, indexer, consumer, true, 10, 10);
            await stateChannel.checkpoint(query);
            expect((await stateChannel.channel(channelId)).status).to.equal(0);

            const balance2 = await token.balanceOf(stateChannel.address);
            expect(balance2).to.equal(0);

            await openChannel(channelId, indexer, consumer, 10, 6);
            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1);
            expect(channel.balance).to.equal(10);
        });
    });

    describe('State Channel Checkpoint', () => {
        beforeEach(async () => {
            await registerIndexer(indexer);
            await token.connect(wallet_0).transfer(consumer.address, 10000);
            await token.connect(consumer).increaseAllowance(stateChannel.address, 10000);
        });

        it('checkpoint State Channel three steps', async () => {
            const balance = await token.balanceOf(consumer.address);
            expect(balance).to.equal(10000); // 10000

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, 1000, 60);

            const balance1 = await token.balanceOf(consumer.address);
            expect(balance1).to.equal(9000); // 10000 - 1000

            const query1 = await buildQueryState(channelId, indexer, consumer, false, 10, 10); // 10 * 10
            await stateChannel.checkpoint(query1);
            expect((await stateChannel.channel(channelId)).balance).to.equal(900); // 1000 - 100

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
                    eraReward += val.toNumber() - rewardsRemoveTable[idx].toNumber();
                    return [eraReward, total + eraReward];
                },
                [0, 0]
            );
            expect(eraReward).to.be.eq(0);
            expect(totalReward).to.be.eq(100);

            const query2 = await buildQueryState(channelId, indexer, consumer, false, 20, 4); // (20 - 10) * 4
            await stateChannel.checkpoint(query2);
            expect((await stateChannel.channel(channelId)).balance).to.equal(860); // 900 - 40

            const query3 = await buildQueryState(channelId, indexer, consumer, true, 40, 8); // (40 - 20) * 8
            await stateChannel.checkpoint(query3);
            expect((await stateChannel.channel(channelId)).balance).to.equal(0); // remain 860 - 160

            const balance2 = await token.balanceOf(consumer.address);
            expect(balance2).to.equal(9700); // 9000 + 700
        });
    });

    describe('State Channel Challenge', () => {
        beforeEach(async () => {
            await registerIndexer(indexer);
            await token.connect(wallet_0).transfer(consumer.address, 10000);
            await token.connect(consumer).increaseAllowance(stateChannel.address, 10000);
        });

        it('challenge State Channel success', async () => {
            await stateChannel.setChallengeExpiration(5); // 5s

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, 1000, 60);

            const query1 = await buildQueryState(channelId, indexer, consumer, false, 10, 10);
            await stateChannel.challenge(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.balance).to.equal(900); // 1000 - 100
            expect(state1.status).to.equal(2); // Challenge

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('Channel not expired');

            await delay(6);
            await stateChannel.claim(channelId);

            const balance2 = await token.balanceOf(consumer.address);
            expect(balance2).to.equal(9900);
        });

        it('challenge State Channel failure with respond', async () => {
            await stateChannel.setChallengeExpiration(5); // 5s

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, 1000, 60);

            const query1 = await buildQueryState(channelId, indexer, consumer, false, 10, 10);
            await stateChannel.challenge(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.balance).to.equal(900); // 1000 - 100
            expect(state1.status).to.equal(2); // Challenge

            const query2 = await buildQueryState(channelId, indexer, consumer, false, 20, 10);
            await stateChannel.respond(query2);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.balance).to.equal(800); // 900 - 100
            expect(state2.status).to.equal(1); // Open

            await expect(stateChannel.claim(channelId)).to.be.revertedWith('Channel not expired');
        });

        it('challenge State Channel with continue fund', async () => {
            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, consumer, 1000, 5); // 5s expiration

            await delay(6); // channel is expirationAt

            const abi = ethers.utils.defaultAbiCoder;
            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256'],
                [channelId, indexer.address, consumer.address, 100]
            );
            let payload = ethers.utils.keccak256(msg);
            let sign = await consumer.signMessage(ethers.utils.arrayify(payload));
            const recover = ethers.utils.verifyMessage(ethers.utils.arrayify(payload), sign);
            expect(consumer.address).to.equal(recover);

            await expect(stateChannel.fund(channelId, 100, sign)).to.be.revertedWith('Channel lost efficacy');

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
            await stateChannel.fund(channelId, 100, sign);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.balance).to.equal(1100);

            await expect(
                stateChannel.extend(channelId, preExpirationAt, nextExpiration, indexerSign, consumerSign)
            ).to.be.revertedWith('Request is expired');
        });
    });

    describe('State Channel IConsumer', () => {
        beforeEach(async () => {
            await registerIndexer(indexer);
            await token.connect(wallet_0).transfer(consumer.address, 10000);
            await token.connect(wallet_0).transfer(consumer2.address, 10000);
            const ConsumerProxy = await ethers.getContractFactory('ConsumerProxy');
            consumerProxy = await ConsumerProxy.deploy();
            await consumerProxy.deployed();
            await consumerProxy.initialize(token.address, stateChannel.address, consumer.address);
            await consumerProxy.setSigner(signer.address);
            const ConsumerHoster = await ethers.getContractFactory('ConsumerHoster');
            consumerHoster = await ConsumerHoster.deploy();
            await consumerHoster.deployed();
            await consumerHoster.initialize(token.address, stateChannel.address);
            await consumerHoster.setSigner(signer.address);
        });

        it('Consumer proxy workflow', async () => {
            await token.connect(consumer).transfer(consumerProxy.address, 10000);
            const channelId = ethers.utils.randomBytes(32);
            const amount = 100;
            const expiration = 60;
            const abi = ethers.utils.defaultAbiCoder;

            // open
            const msg1 = abi.encode(['uint256', 'uint256'], [channelId, amount]);
            let payloadHash1 = ethers.utils.keccak256(msg1);
            let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash1));

            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes32', 'bytes'],
                [channelId, indexer.address, consumerProxy.address, amount, expiration, deploymentId, consumerSign]
            );
            let payloadHash = ethers.utils.keccak256(msg);
            let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
            let signerSign = await signer.signMessage(ethers.utils.arrayify(payloadHash));

            await stateChannel.open(
                channelId,
                indexer.address,
                consumerProxy.address,
                amount,
                expiration,
                deploymentId,
                consumerSign,
                indexerSign,
                signerSign
            );

            const query1 = await buildQueryState(channelId, indexer, signer, false, 2, 10);
            const query2 = await buildQueryState(channelId, indexer, signer, false, 4, 10);
            const query3 = await buildQueryState(channelId, indexer, signer, false, 5, 10);
            const query4 = await buildQueryState(channelId, indexer, signer, true, 8, 10);

            // checkpoint
            await stateChannel.checkpoint(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.balance).to.equal(80);

            // challenge
            await stateChannel.challenge(query2);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.balance).to.equal(60);
            expect(state2.status).to.equal(2); // Challenge

            // respond
            await stateChannel.respond(query3);
            const state3 = await stateChannel.channel(channelId);
            expect(state3.balance).to.equal(50);
            expect(state3.status).to.equal(1); // Active

            // finalized
            await stateChannel.checkpoint(query4);
            const state4 = await stateChannel.channel(channelId);
            expect(state4.balance).to.equal(0);

            expect(await token.balanceOf(consumerProxy.address)).to.equal(9920); // 10000-100+20
        });

        it('Consumer hoster workflow', async () => {
            // deposit
            await token.connect(consumer).increaseAllowance(consumerHoster.address, 10000);
            await consumerHoster.connect(consumer).deposit(10000);
            await token.connect(consumer2).increaseAllowance(consumerHoster.address, 10000);
            await consumerHoster.connect(consumer2).deposit(10000);
            expect(await token.balanceOf(consumerHoster.address)).to.equal(20000);

            const channelId = ethers.utils.randomBytes(32);
            const channelId2 = ethers.utils.randomBytes(32);
            const amount = 100;
            const expiration = 60;
            const abi = ethers.utils.defaultAbiCoder;

            // open
            const msg1 = abi.encode(['uint256', 'uint256'], [channelId, amount]);
            let payloadHash1 = ethers.utils.keccak256(msg1);
            let consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash1));
            const callback = abi.encode(['address', 'bytes'], [consumer.address, consumerSign]);

            const msg = abi.encode(
                ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes32', 'bytes'],
                [channelId, indexer.address, consumerHoster.address, amount, expiration, deploymentId, callback]
            );
            let payloadHash = ethers.utils.keccak256(msg);
            let indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
            let signerSign = await signer.signMessage(ethers.utils.arrayify(payloadHash));

            await stateChannel.open(
                channelId,
                indexer.address,
                consumerHoster.address,
                amount,
                expiration,
                deploymentId,
                callback,
                indexerSign,
                signerSign
            );
            expect(await consumerHoster.channels(channelId)).to.equal(consumer.address);

            const query1 = await buildQueryState(channelId, indexer, signer, false, 2, 10);
            const query2 = await buildQueryState(channelId, indexer, signer, false, 4, 10);
            const query3 = await buildQueryState(channelId, indexer, signer, false, 5, 10);
            const query4 = await buildQueryState(channelId, indexer, signer, true, 8, 10);

            // checkpoint
            await stateChannel.checkpoint(query1);
            const state1 = await stateChannel.channel(channelId);
            expect(state1.balance).to.equal(80);

            // challenge
            await stateChannel.challenge(query2);
            const state2 = await stateChannel.channel(channelId);
            expect(state2.balance).to.equal(60);
            expect(state2.status).to.equal(2); // Challenge

            // respond
            await stateChannel.respond(query3);
            const state3 = await stateChannel.channel(channelId);
            expect(state3.balance).to.equal(50);
            expect(state3.status).to.equal(1); // Active

            // finalized
            await stateChannel.checkpoint(query4);
            const state4 = await stateChannel.channel(channelId);
            expect(state4.balance).to.equal(0);

            expect(await token.balanceOf(consumerHoster.address)).to.equal(19920); // 20000-100+20
            expect(await consumerHoster.balances(consumer2.address)).to.equal(10000);
            expect(await consumerHoster.balances(consumer.address)).to.equal(9920); // 10000-100+20
        });
    });
});
