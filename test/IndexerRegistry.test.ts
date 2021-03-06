// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers} from 'hardhat';
import {deployContracts} from './setup';
import {METADATA_HASH, METADATA_1_HASH, VERSION, DEPLOYMENT_ID} from './constants';
import {IndexerRegistry, SQToken, QueryRegistry, Staking, RewardsDistributer} from '../src';
import {etherParse, registerIndexer} from './helper'

const {constants} = require('@openzeppelin/test-helpers');

describe('IndexerRegistry Contract', () => {
    let wallet_0, wallet_1, wallet_2;

    let token: SQToken;
    let staking: Staking;
    let queryRegistry: QueryRegistry;
    let indexerRegistry: IndexerRegistry;
    let rewardsDistributer: RewardsDistributer;


    const checkControllerIsEmpty = async () => {
        expect(await indexerRegistry.indexerToController(wallet_0.address)).to.equal(constants.ZERO_ADDRESS);
        expect(await indexerRegistry.controllerToIndexer(wallet_2.address)).to.equal(constants.ZERO_ADDRESS);
    };

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_1);
        token = deployment.token;
        staking = deployment.staking;
        queryRegistry = deployment.queryRegistry;
        indexerRegistry = deployment.indexerRegistry;
        rewardsDistributer = deployment.rewardsDistributer;
        await registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_0, "10");
    });

    describe('Indexer Registry', () => {
        it('register indexer should work', async () => {
            await expect(registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_1, "10"))
                .to.be.emit(indexerRegistry, 'RegisterIndexer')
                .withArgs(wallet_1.address, etherParse("5"), METADATA_HASH);

            // check state changes
            expect(await indexerRegistry.isIndexer(wallet_1.address)).to.equal(true);
            expect(await indexerRegistry.metadataByIndexer(wallet_1.address)).to.equal(METADATA_HASH);
            expect(await staking.getDelegationAmount(wallet_1.address, wallet_1.address)).to.equal(etherParse("5"));
            expect(await staking.getCommissionRate(wallet_1.address)).to.equal(0);
            expect(await rewardsDistributer.getDelegationAmount(wallet_1.address, wallet_1.address)).to.equal(
                etherParse("5")
            );
            expect(await rewardsDistributer.commissionRates(wallet_1.address)).to.equal(0);
        });

        it('registered indexer reregister should fail', async () => {
            await expect(indexerRegistry.registerIndexer(etherParse("5"), METADATA_HASH, 0)).to.be.revertedWith(
                'Already registered'
            );
        });

        it('update metadata should work', async () => {
            await expect(indexerRegistry.updateMetadata(METADATA_1_HASH))
                .to.be.emit(indexerRegistry, 'UpdateMetadata')
                .withArgs(wallet_0.address, METADATA_1_HASH);

            expect(await indexerRegistry.metadataByIndexer(wallet_0.address)).to.equal(METADATA_1_HASH);
        });

        it('update metadata with invalid caller should fail', async () => {
            // caller is not an indexer
            await expect(indexerRegistry.connect(wallet_1).updateMetadata(METADATA_1_HASH)).to.be.revertedWith(
                'Not an indexer'
            );
        });
    });

    describe('Controller Account Management', () => {
        it('set controller account should work', async () => {
            // set controller
            await expect(indexerRegistry.setControllerAccount(wallet_1.address))
                .to.be.emit(indexerRegistry, 'SetControllerAccount')
                .withArgs(wallet_0.address, wallet_1.address);

            // check state changes
            expect(await indexerRegistry.indexerToController(wallet_0.address)).to.equal(wallet_1.address);
            expect(await indexerRegistry.controllerToIndexer(wallet_1.address)).to.equal(wallet_0.address);
            expect(await indexerRegistry.isController(wallet_1.address)).to.equal(true);
            expect(await indexerRegistry.controllerToIndexer(wallet_2.address)).to.equal(constants.ZERO_ADDRESS);
        });

        it('update controller account should work', async () => {
            // set wallet1 as controller
            await indexerRegistry.setControllerAccount(wallet_1.address);
            // update wallet_2 as controller
            await indexerRegistry.setControllerAccount(wallet_2.address);
            // check state changes
            expect(await indexerRegistry.indexerToController(wallet_0.address)).to.equal(wallet_2.address);
            expect(await indexerRegistry.controllerToIndexer(wallet_2.address)).to.equal(wallet_0.address);
        });

        it('set controller account with invalid caller should fail', async () => {
            // caller is not an indexer
            await expect(indexerRegistry.connect(wallet_1).setControllerAccount(wallet_0.address)).to.be.revertedWith(
                'Only indexer can set controller account'
            );
        });

        it('set controller with used account should fail', async () => {
            // wallet_0 add wallet_2 as controller
            await indexerRegistry.setControllerAccount(wallet_2.address);
            await registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_1, "10");
            // wallet_1 try to add wallet_2 as controller should fail
            await expect(indexerRegistry.connect(wallet_1).setControllerAccount(wallet_2.address)).to.be.revertedWith(
                'Controller account is used by an indexer already'
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
            await expect(indexerRegistry.connect(wallet_1).removeControllerAccount()).to.be.revertedWith(
                'Only indexer can remove controller account'
            );
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
            expect(await indexerRegistry.metadataByIndexer(wallet_0.address)).to.equal(constants.ZERO_BYTES32);
        });

        it('deregister with invalid status should fail', async () => {
            // unregisted account
            await expect(indexerRegistry.connect(wallet_1).unregisterIndexer()).to.be.revertedWith('Not registered');

            // with running projects
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, DEPLOYMENT_ID);
            await queryRegistry.startIndexing(DEPLOYMENT_ID);
            await expect(indexerRegistry.unregisterIndexer()).to.be.revertedWith(
                'Can not unregister from the network due to running indexing projects'
            );
        });
    });
});
