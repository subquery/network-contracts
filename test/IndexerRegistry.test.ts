// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import {
    IndexerRegistry,
    ProjectRegistry,
    RewardsStaking,
    ERC20,
    Staking,
    StakingManager,
    EraManager,
    RewardsHelper,
} from '../src';
import { DEPLOYMENT_ID, METADATA_1_HASH, METADATA_HASH, VERSION } from './constants';
import { etherParse, registerRunner, revertMsg, startNewEra } from './helper';
import { deployContracts } from './setup';

const { constants } = require('@openzeppelin/test-helpers');

describe('IndexerRegistry Contract', () => {
    let wallet_0, wallet_1, wallet_2;

    let token: ERC20;
    let staking: Staking;
    let stakingManager: StakingManager;
    let rewardsHelper: RewardsHelper;
    let eraManager: EraManager;
    let projectRegistry: ProjectRegistry;
    let indexerRegistry: IndexerRegistry;
    let rewardsStaking: RewardsStaking;
    const amount = '2000';

    const checkControllerIsEmpty = async () => {
        expect(await indexerRegistry.getController(wallet_0.address)).to.equal(constants.ZERO_ADDRESS);
    };

    const deployer = () => deployContracts(wallet_0, wallet_1);
    before(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        token = deployment.token;
        staking = deployment.staking;
        stakingManager = deployment.stakingManager;
        projectRegistry = deployment.projectRegistry;
        indexerRegistry = deployment.indexerRegistry;
        rewardsStaking = deployment.rewardsStaking;
        eraManager = deployment.eraManager;
        rewardsHelper = deployment.rewardsHelper;
        await registerRunner(token, indexerRegistry, staking, wallet_0, wallet_0, etherParse('2000'));
    });

    describe('Minimum Staking Management', () => {
        it('update minimum staking should work', async () => {
            expect(await indexerRegistry.minimumStakingAmount()).to.equal(etherParse('1000'));
            await indexerRegistry.setminimumStakingAmount(etherParse('2000'));
            expect(await indexerRegistry.minimumStakingAmount()).to.equal(etherParse('2000'));
        });

        it('only owner can update minimum staking', async () => {
            await expect(indexerRegistry.connect(wallet_1).setminimumStakingAmount(etherParse('2000'))).to.be.revertedWith(revertMsg.notOwner);
        });
    });

    describe('Commission Rate Management', () => {
        it('update minimum commission rate should work', async () => {
            expect(await indexerRegistry.minimumCommissionRate()).to.equal(0);
            await expect(indexerRegistry.setMinimumCommissionRate(10)).to.be.emit(indexerRegistry, 'MinimumCommissionRateUpdated').withArgs(10);
            expect(await indexerRegistry.minimumCommissionRate()).to.equal(10);
        });

        it('Set minimum commission rate with invalid params should fail', async () => {
            // invalid rate
            await expect(indexerRegistry.setMinimumCommissionRate(1e7)).to.be.revertedWith('IR006');
            // only owner
            await expect(indexerRegistry.connect(wallet_1).setMinimumCommissionRate(10)).to.be.revertedWith(revertMsg.notOwner);
        });

        it('set runner commission rate should work', async () => {
            await expect(indexerRegistry.setCommissionRate(10))
                .to.be.emit(indexerRegistry, 'SetCommissionRate')
                .withArgs(wallet_0.address, 10);
            expect((await indexerRegistry.commissionRates(wallet_0.address)).valueAfter).to.equal(10);
        });

        it('set commission rate with invalid params should fail', async () => {
            await indexerRegistry.setMinimumCommissionRate(1e3);
            // register runner
            await expect(registerRunner(token, indexerRegistry, staking, wallet_0, wallet_1, etherParse(amount))).to.be.revertedWith('IR006');
            // update cr
            await expect(indexerRegistry.setCommissionRate(1e7)).to.be.revertedWith('IR006');
            await expect(indexerRegistry.setCommissionRate(1e2)).to.be.revertedWith('IR006');
        });

        it('get commission rate should work', async () => {
            await indexerRegistry.setCommissionRate(10);
            await indexerRegistry.setMinimumCommissionRate(20);
            expect(await indexerRegistry.getCommissionRate(wallet_0.address)).to.equal(20);
        });
    });

    describe('Indexer Registry', () => {
        it('register indexer should work', async () => {
            await expect(registerRunner(token, indexerRegistry, staking, wallet_0, wallet_1, etherParse(amount)))
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
    });

    describe('Indexer Unregistry', () => {
        it('indexer deregister should work', async () => {
            // deregister from network
            await expect(indexerRegistry.unregisterIndexer({ gasLimit: '1000000' }))
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
            await startNewEra(eraManager);
            await rewardsHelper.batchCollectAndDistributeRewards(wallet_0.address, 10);
            await rewardsHelper.batchApplyStakeChange(wallet_0.address, [wallet_1.address]);
            // deregister from network
            await expect(indexerRegistry.unregisterIndexer({ gasLimit: '1000000' }))
                .to.be.emit(indexerRegistry, 'UnregisterIndexer')
                .withArgs(wallet_0.address);

            expect(await indexerRegistry.isIndexer(wallet_0.address)).to.equal(false);
            expect(await indexerRegistry.metadata(wallet_0.address)).to.equal(constants.ZERO_BYTES32);
        });

        it('deregister with invalid status should fail', async () => {
            // unregisted account
            await expect(indexerRegistry.connect(wallet_1).unregisterIndexer()).to.be.revertedWith('G002');

            // with running projects
            await projectRegistry.createProject(METADATA_HASH, VERSION, DEPLOYMENT_ID, 0);
            await projectRegistry.startService(DEPLOYMENT_ID);
            await expect(indexerRegistry.unregisterIndexer()).to.be.revertedWith('IR004');
        });
    });
});
