// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { IndexerRegistry, ProjectRegistry, RewardsStaking, ERC20, Staking, StakingManager } from '../src';
import { DEPLOYMENT_ID, METADATA_1_HASH, METADATA_HASH, VERSION } from './constants';
import { etherParse, registerRunner } from './helper';
import { deployContracts } from './setup';

const { constants } = require('@openzeppelin/test-helpers');

describe('IndexerRegistry Contract', () => {
    let wallet_0, wallet_1, wallet_2;

    let token: ERC20;
    let staking: Staking;
    let stakingManager: StakingManager;
    let projectRegistry: ProjectRegistry;
    let indexerRegistry: IndexerRegistry;
    let rewardsStaking: RewardsStaking;
    const amount = '2000';

    const checkControllerIsEmpty = async () => {
        expect(await indexerRegistry.getController(wallet_0.address)).to.equal(constants.ZERO_ADDRESS);
    };

    const deployer = ()=>deployContracts(wallet_0, wallet_1);
    before(async ()=>{
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
        await registerRunner(token, indexerRegistry, staking, wallet_0, wallet_0, etherParse(amount));
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
            await expect(indexerRegistry.unregisterIndexer({ gasLimit: '1000000' }))
                .to.be.emit(indexerRegistry, 'UnregisterIndexer')
                .withArgs(wallet_0.address);

            // check updates
            await checkControllerIsEmpty();
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
