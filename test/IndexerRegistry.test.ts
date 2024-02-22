// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {
    IndexerRegistry,
    QueryRegistry,
    RewardsStaking,
    SQToken,
    Staking,
    StakingManager,
    EraManager,
    RewardsHelper,
} from '../src';
import {DEPLOYMENT_ID, METADATA_1_HASH, METADATA_HASH, VERSION} from './constants';
import {etherParse, registerIndexer, startNewEra} from './helper';
import {deployContracts} from './setup';

const {constants} = require('@openzeppelin/test-helpers');

describe('IndexerRegistry Contract', () => {
    let wallet_0, wallet_1, wallet_2;

    let token: SQToken;
    let staking: Staking;
    let stakingManager: StakingManager;
    let rewardsHelper: RewardsHelper;
    let eraManager: EraManager;
    let queryRegistry: QueryRegistry;
    let indexerRegistry: IndexerRegistry;
    let rewardsStaking: RewardsStaking;
    const amount = '2000';

    const checkControllerIsEmpty = async () => {
        expect(await indexerRegistry.getController(wallet_0.address)).to.equal(constants.ZERO_ADDRESS);
    };

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_1);
        token = deployment.token;
        staking = deployment.staking;
        stakingManager = deployment.stakingManager;
        queryRegistry = deployment.queryRegistry;
        indexerRegistry = deployment.indexerRegistry;
        rewardsStaking = deployment.rewardsStaking;
        eraManager = deployment.eraManager;
        rewardsHelper = deployment.rewardsHelper;
        await registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_0, amount);
    });

    describe('Indexer Registry', () => {
        it('register indexer should work', async () => {
            await expect(registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_1, amount))
                .to.be.emit(indexerRegistry, 'RegisterIndexer')
                .withArgs(wallet_1.address, etherParse(amount), METADATA_HASH)
                .to.be.emit(indexerRegistry, 'SetCommissionRate')
                .withArgs(wallet_1.address, 0);

            // check state changes
            expect(await indexerRegistry.isIndexer(wallet_1.address)).to.equal(true);
            expect(await indexerRegistry.metadata(wallet_1.address)).to.equal(METADATA_HASH);
            expect(await stakingManager.getAfterDelegationAmount(wallet_1.address, wallet_1.address)).to.equal(
                etherParse(amount)
            );
            expect(await indexerRegistry.getCommissionRate(wallet_1.address)).to.equal(0);
            expect(await rewardsStaking.getDelegationAmount(wallet_1.address, wallet_1.address)).to.equal(
                etherParse(amount)
            );
            expect(await rewardsStaking.getCommissionRate(wallet_1.address)).to.equal(0);
        });

        it('registered indexer reregister should fail', async () => {
            await expect(indexerRegistry.registerIndexer(etherParse(amount), METADATA_HASH, 0)).to.be.revertedWith(
                'IR001'
            );
        });

        it('update metadata should work', async () => {
            await expect(indexerRegistry.updateMetadata(METADATA_1_HASH))
                .to.be.emit(indexerRegistry, 'UpdateMetadata')
                .withArgs(wallet_0.address, METADATA_1_HASH);

            expect(await indexerRegistry.metadata(wallet_0.address)).to.equal(METADATA_1_HASH);
        });

        it('update metadata with invalid caller should fail', async () => {
            // caller is not an indexer
            await expect(indexerRegistry.connect(wallet_1).updateMetadata(METADATA_1_HASH)).to.be.revertedWith('G002');
        });

        it('indexer setCommissionRate should work', async () => {
            await expect(indexerRegistry.setCommissionRate(10))
                .to.be.emit(indexerRegistry, 'SetCommissionRate')
                .withArgs(wallet_0.address, 10);
            expect((await indexerRegistry.commissionRates(wallet_0.address)).valueAfter).to.equal(10);
        });
    });

    describe('Controller Account Management', () => {
        it('set controller account should work', async () => {
            // set controller
            await expect(indexerRegistry.setControllerAccount(wallet_1.address))
                .to.be.emit(indexerRegistry, 'SetControllerAccount')
                .withArgs(wallet_0.address, wallet_1.address);

            // check state changes
            expect(await indexerRegistry.getController(wallet_0.address)).to.equal(wallet_1.address);
        });

        it('update controller account should work', async () => {
            // set wallet1 as controller
            await indexerRegistry.setControllerAccount(wallet_1.address);
            // update wallet_2 as controller
            await indexerRegistry.setControllerAccount(wallet_2.address);
            // check state changes
            expect(await indexerRegistry.getController(wallet_0.address)).to.equal(wallet_2.address);
        });

        it('set controller account with invalid caller should fail', async () => {
            // caller is not an indexer
            await expect(indexerRegistry.connect(wallet_1).setControllerAccount(wallet_0.address)).to.be.revertedWith(
                'G002'
            );
        });

        it('remove controller account from indexer should work', async () => {
            await indexerRegistry.setControllerAccount(wallet_1.address);
            await expect(indexerRegistry.removeControllerAccount())
                .to.be.emit(indexerRegistry, 'RemoveControllerAccount')
                .withArgs(wallet_0.address, wallet_1.address);

            // check state changes
            await checkControllerIsEmpty();
        });

        it('remove controller account with invalid caller should fail', async () => {
            // caller is not an indexer
            await expect(indexerRegistry.connect(wallet_1).removeControllerAccount()).to.be.revertedWith('G002');
        });
    });

    describe('Indexer Unregistry', () => {
        it('indexer deregister should work', async () => {
            // deregister from network
            await expect(indexerRegistry.unregisterIndexer({gasLimit: '1000000'}))
                .to.be.emit(indexerRegistry, 'UnregisterIndexer')
                .withArgs(wallet_0.address);

            // check updates
            await checkControllerIsEmpty();
            expect(await indexerRegistry.isIndexer(wallet_0.address)).to.equal(false);
            expect(await indexerRegistry.metadata(wallet_0.address)).to.equal(constants.ZERO_BYTES32);
        });

        it('indexer unregister while have delegation should work', async () => {
            await token.connect(wallet_0).transfer(wallet_1.address, etherParse('1000'));
            await token.connect(wallet_1).increaseAllowance(staking.address, etherParse('1000'));
            await stakingManager.connect(wallet_1).delegate(wallet_0.address, etherParse('1000'));
            await startNewEra(waffle.provider, eraManager);
            await rewardsHelper.batchCollectAndDistributeRewards(wallet_0.address, 10);
            await rewardsHelper.batchApplyStakeChange(wallet_0.address, [wallet_1.address]);
            // deregister from network
            await expect(indexerRegistry.unregisterIndexer({gasLimit: '1000000'}))
                .to.be.emit(indexerRegistry, 'UnregisterIndexer')
                .withArgs(wallet_0.address);

            expect(await indexerRegistry.isIndexer(wallet_0.address)).to.equal(false);
            expect(await indexerRegistry.metadata(wallet_0.address)).to.equal(constants.ZERO_BYTES32);
        });

        it('deregister with invalid status should fail', async () => {
            // unregisted account
            await expect(indexerRegistry.connect(wallet_1).unregisterIndexer()).to.be.revertedWith('G002');

            // with running projects
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, DEPLOYMENT_ID);
            await queryRegistry.startIndexing(DEPLOYMENT_ID);
            await expect(indexerRegistry.unregisterIndexer()).to.be.revertedWith('IR004');
        });
    });
});
