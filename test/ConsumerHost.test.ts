// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers} from 'hardhat';
import {deployContracts} from './setup';
import {METADATA_HASH, DEPLOYMENT_ID, deploymentIds, metadatas, VERSION} from './constants';
import {ConsumerHost, IndexerRegistry, RewardsPool, RewardsDistributer, EraManager, SQToken, Staking, StateChannel} from '../src';
import {constants, registerIndexer, startNewEra, time, delay, etherParse} from './helper';
import {utils, Wallet, BigNumberish, BytesLike, BigNumber} from 'ethers';

describe('ConsumerHost Contract', () => {
    const deploymentId = deploymentIds[0];
    let wallet_0, indexer, consumer, consumer2, hoster;

    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributer;
    let rewardsPool: RewardsPool;
    let stateChannel: StateChannel;
    let consumerHost: ConsumerHost;

    const openChannel = async (
        channelId: Uint8Array,
        indexer: Wallet,
        hoster: Wallet,
        consumer: Wallet,
        amount: BigNumber,
        expiration: number
    ) => {
        const abi = ethers.utils.defaultAbiCoder;

        const consumerMsg = abi.encode(['uint256', 'uint256'], [channelId, amount]);
        const consumerPayloadHash = ethers.utils.keccak256(consumerMsg);
        const consumerSign = await consumer.signMessage(ethers.utils.arrayify(consumerPayloadHash));

        const msg = abi.encode(
            ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes32', 'bytes'],
            [channelId, indexer.address, consumerHost.address, amount, expiration, deploymentId, consumerSign]
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
            expiration,
            deploymentId,
            consumerSign,
            indexerSign,
            hosterSign
        );
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
        rewardsDistributor = deployment.rewardsDistributer;
        rewardsPool = deployment.rewardsPool;
        eraManager = deployment.eraManager;
        stateChannel = deployment.stateChannel;
        consumerHost = deployment.consumerHost;
    });

    describe('Consumer Host Config', () => {
        it('set consumer host signer should work', async () => {
            expect(await consumerHost.getSigner()).to.equal(wallet_0.address);
            await consumerHost.connect(wallet_0).setSigner(hoster.address);
            expect(await consumerHost.getSigner()).to.equal(hoster.address);
        });
    });

    describe('Consumer Host State Channel should work', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, indexer, '10');
            await consumerHost.connect(wallet_0).setSigner(hoster.address);
            await token.connect(wallet_0).transfer(consumer.address, etherParse('10'));
            await token.connect(wallet_0).transfer(consumer2.address, etherParse('10'));

            // deposit
            await token.connect(consumer).increaseAllowance(consumerHost.address, etherParse('10'));
            await token.connect(consumer2).increaseAllowance(consumerHost.address, etherParse('10'));
            await consumerHost.connect(consumer).deposit(etherParse('10'));
            await consumerHost.connect(consumer2).deposit(etherParse('10'));
        });

        it('open a State Channel should work', async () => {
            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('20'));

            const channelId = ethers.utils.randomBytes(32);
            await openChannel(channelId, indexer, hoster, consumer, etherParse('1'), 60);
            expect(await consumerHost.balances(consumer.address)).to.equal(etherParse('9'));
            expect(await consumerHost.channels(channelId)).to.equal(consumer.address);

            const channelId2 = ethers.utils.randomBytes(32);
            await openChannel(channelId2, indexer, hoster, consumer2, etherParse('2'), 60);
            expect(await consumerHost.balances(consumer2.address)).to.equal(etherParse('8'));
            expect(await consumerHost.channels(channelId2)).to.equal(consumer2.address);

            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('17'));

            const channel = await stateChannel.channel(channelId);
            expect(channel.status).to.equal(1); // 0 is Finalized, 1 is Open, 2 is Challenge
            expect(channel.indexer).to.equal(indexer.address);
            expect(channel.consumer).to.equal(consumerHost.address);
            expect(channel.total).to.equal(etherParse('1'));

            const query1 = await buildQueryState(channelId, indexer, hoster, etherParse('0.1'), false);
            await stateChannel.checkpoint(query1);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.1'));

            // claim rewards
            await stateChannel.setChallengeExpiration(5); // 5s
            const query2 = await buildQueryState(channelId, indexer, hoster, etherParse('0.2'), false);
            await stateChannel.challenge(query2);
            expect((await stateChannel.channel(channelId)).spent).to.equal(etherParse('0.2'));

            await delay(6);
            await stateChannel.claim(channelId);
            expect(await token.balanceOf(consumerHost.address)).to.equal(etherParse('17.8')); // 17 + 0.8

            // withdraw
            expect(await consumerHost.balances(consumer.address)).to.equal(etherParse('9.8'));
            await consumerHost.connect(consumer).withdraw(etherParse('9.5'));
            expect(await consumerHost.balances(consumer.address)).to.equal(etherParse('0.3'));
        });
    });
});
