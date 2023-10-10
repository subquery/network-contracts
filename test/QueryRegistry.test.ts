// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { Wallet } from 'ethers';
import { ethers, waffle } from 'hardhat';

import { IndexerRegistry, PlanManager, PurchaseOfferMarket, QueryRegistry, SQToken, Staking } from '../src';
import { METADATA_HASH, deploymentIds, metadatas, poi, versions } from './constants';
import {
    constants,
    createPurchaseOffer,
    delay,
    etherParse,
    futureTimestamp,
    lastestTime,
    registerIndexer,
    timeTravel,
} from './helper';
import { deployContracts } from './setup';

enum IndexingServiceStatus {
    NOTINDEXING,
    INDEXING,
    READY,
}

describe('Query Registry Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, fake_controller;
    let default_indexer;
    const deploymentId = deploymentIds[0];
    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let queryRegistry: QueryRegistry;
    let purchaseOfferMarket: PurchaseOfferMarket;
    let planManager: PlanManager;

    // create query project
    const createQueryProject = async () => {
        await queryRegistry.createQueryProject(metadatas[0], versions[0], deploymentIds[0]);
    };

    const reportStatus = async (
        timestamp: number,
        height: number = 10,
        wallet: Wallet = wallet_1,
        indexer: string = default_indexer
    ) => {
        const tx = await queryRegistry
            .connect(wallet)
            .reportIndexingStatus(indexer, deploymentId, height, poi, timestamp);
        return tx;
    };

    const checkQueryInfoIsEmpty = async (id: number) => {
        let queryInfos = await queryRegistry.queryInfos(id);
        expect(queryInfos.queryId).to.equal(0);
        expect(queryInfos.metadata).to.equal(constants.ZERO_BYTES32);
        expect(queryInfos.latestVersion).to.equal(constants.ZERO_BYTES32);
        expect(queryInfos.latestDeploymentId).to.equal(constants.ZERO_BYTES32);
        expect(queryInfos.owner).to.equal(constants.ZERO_ADDRESS);
    };

    const checkDeploymentStatus = async (
        deploymentId: string,
        serviceStatus: IndexingServiceStatus,
        timestamp: number
    ) => {
        const status = await queryRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address);
        expect(status.deploymentId).to.equal(deploymentId);
        expect(Number(status.timestamp)).to.equal(timestamp);
        expect(status.status).to.equal(serviceStatus);
    };

    const isOffline = async () => {
        const status = await queryRegistry.isOffline(deploymentIds[0], wallet_0.address);
        return status;
    };

    beforeEach(async () => {
        [wallet_0, wallet_1, fake_controller] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_1);
        default_indexer = wallet_0.address;
        token = deployment.token;
        staking = deployment.staking;
        indexerRegistry = deployment.indexerRegistry;
        queryRegistry = deployment.queryRegistry;
        purchaseOfferMarket = deployment.purchaseOfferMarket;
        planManager = deployment.planManager;

        await createQueryProject();
    });

    describe('Create Query Project', () => {
        it('create query project should work', async () => {
            // create project
            const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
            await expect(queryRegistry.createQueryProject(metadata, version, deploymentId))
                .to.be.emit(queryRegistry, 'CreateQuery')
                .withArgs(1, wallet_0.address, metadata, deploymentId, version);

            // check state updates
            const queryInfos = await queryRegistry.queryInfos(1);
            expect(queryInfos.metadata).to.equal(metadata);
            expect(queryInfos.latestVersion).to.equal(version);
            expect(queryInfos.latestDeploymentId).to.equal(deploymentId);
            expect(queryInfos.owner).to.equal(wallet_0.address);
            expect(await queryRegistry.nextQueryId()).to.equal(2);
        });

        it('cannot create a project with an existing deploymentId', async () => {
            const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[0]];
            await expect(queryRegistry.createQueryProject(metadata, version, deploymentId)).to.be.revertedWith('QR006');
        });

        it('authorised account can create project in creatorRestricted mode', async () => {
            const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
            expect(await queryRegistry.creatorWhitelist(wallet_1.address)).to.be.equal(false);
            await queryRegistry.addCreator(wallet_1.address);
            expect(await queryRegistry.creatorWhitelist(wallet_1.address)).to.be.equal(true);
            await expect(queryRegistry.connect(wallet_1).createQueryProject(metadata, version, deploymentId))
                .to.be.emit(queryRegistry, 'CreateQuery')
                .withArgs(1, wallet_1.address, metadata, deploymentId, version);
        });

        it('cannot create a project with not authorised account in creatorRestrict mode', async () => {
            const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
            await expect(
                queryRegistry.connect(wallet_1).createQueryProject(metadata, version, deploymentId)
            ).to.be.revertedWith('QR001');
        });

        it('any account can create a project not in creatorRestrict mode', async () => {
            const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
            expect(await queryRegistry.creatorRestricted()).to.be.equal(true);
            await queryRegistry.setCreatorRestricted(false);
            expect(await queryRegistry.creatorRestricted()).to.be.equal(false);
            await expect(queryRegistry.connect(wallet_1).createQueryProject(metadata, version, deploymentId))
                .to.be.emit(queryRegistry, 'CreateQuery')
                .withArgs(1, wallet_1.address, metadata, deploymentId, version);
        });
    });

    describe('Update Query Project', () => {
        it('update project metadata should work', async () => {
            await expect(queryRegistry.updateQueryProjectMetadata(0, metadatas[1]))
                .to.be.emit(queryRegistry, 'UpdateQueryMetadata')
                .withArgs(wallet_0.address, 0, metadatas[1]);

            // check state changes
            const queryInfos = await queryRegistry.queryInfos(0);
            expect(queryInfos.metadata).to.equal(metadatas[1]);
        });

        it('update project deploymenet should work', async () => {
            const [version, deploymentId] = [versions[1], deploymentIds[1]];
            await expect(queryRegistry.updateDeployment(0, deploymentId, version))
                .to.be.emit(queryRegistry, 'UpdateQueryDeployment')
                .withArgs(wallet_0.address, 0, deploymentId, version);

            // check state changes
            const queryInfos = await queryRegistry.queryInfos(0);
            expect(queryInfos.latestVersion).to.equal(version);
            expect(queryInfos.latestDeploymentId).to.equal(deploymentId);
        });

        it('update project with invalid owner should fail', async () => {
            await queryRegistry.addCreator(wallet_1.address);
            // no permission to update metadata
            await expect(
                queryRegistry.connect(wallet_1).updateQueryProjectMetadata(0, metadatas[1])
            ).to.be.revertedWith('QR007');
            // no permission to update deployment
            await expect(
                queryRegistry.connect(wallet_1).updateDeployment(0, deploymentIds[1], versions[1])
            ).to.be.revertedWith('QR008');
        });

        it('should fail to update deployment to one already used', async () => {
            await expect(queryRegistry.updateDeployment(0, deploymentId, versions[0])).to.be.revertedWith('QR006');
        });
    });

    describe('Indexing Query Project', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_0, '2000');
            await indexerRegistry.setControllerAccount(wallet_1.address);
        });

        it('start indexing should work', async () => {
            await expect(queryRegistry.startIndexing(deploymentId))
                .to.be.emit(queryRegistry, 'StartIndexing')
                .withArgs(wallet_0.address, deploymentId);

            // check state changes
            await checkDeploymentStatus(deploymentId, IndexingServiceStatus.INDEXING, 0);
            expect(await queryRegistry.numberOfIndexingDeployments(wallet_0.address)).to.equal(1);
        });

        it('start indexing should fail for unregistered deployment id', async () => {
            const deploymentId = deploymentIds[1];
            await expect(queryRegistry.startIndexing(deploymentId)).to.be.revertedWith('QR006');
        });

        it('update indexing status to ready should work', async () => {
            await queryRegistry.startIndexing(deploymentId);
            await expect(queryRegistry.updateIndexingStatusToReady(deploymentId))
                .to.be.emit(queryRegistry, 'UpdateIndexingStatusToReady')
                .withArgs(wallet_0.address, deploymentId);

            // check state changes
            const timestamp = await lastestTime(mockProvider);
            await checkDeploymentStatus(deploymentId, IndexingServiceStatus.READY, timestamp);
        });

        it('report indexing status should work', async () => {
            const timestamp_0 = await lastestTime(mockProvider);
            // start indexing
            await queryRegistry.startIndexing(deploymentId);
            // report status
            await expect(reportStatus(timestamp_0))
                .to.be.emit(queryRegistry, 'UpdateDeploymentStatus')
                .withArgs(wallet_0.address, deploymentId, 10, poi, timestamp_0);
            await checkDeploymentStatus(deploymentId, IndexingServiceStatus.INDEXING, timestamp_0);

            // change status to ready
            await timeTravel(mockProvider, 6);
            await queryRegistry.updateIndexingStatusToReady(deploymentId);
            await timeTravel(mockProvider, 6);
            // report status
            const timestamp_1 = await lastestTime(mockProvider);
            await reportStatus(timestamp_1);
            await checkDeploymentStatus(deploymentId, IndexingServiceStatus.READY, timestamp_1);
        });

        it('stop indexing should work', async () => {
            // can stop `INDEXING` project
            await queryRegistry.startIndexing(deploymentId);
            await expect(queryRegistry.stopIndexing(deploymentId))
                .to.be.emit(queryRegistry, 'StopIndexing')
                .withArgs(wallet_0.address, deploymentId);

            // check state changes
            await checkDeploymentStatus(deploymentId, IndexingServiceStatus.NOTINDEXING, 0);
            expect(await queryRegistry.numberOfIndexingDeployments(wallet_0.address)).to.equal(0);

            // can restart indexing project
            await queryRegistry.startIndexing(deploymentId);
            await checkDeploymentStatus(deploymentId, IndexingServiceStatus.INDEXING, 0);
            expect(await queryRegistry.numberOfIndexingDeployments(wallet_0.address)).to.equal(1);

            // can stop `READY` project
            await queryRegistry.updateIndexingStatusToReady(deploymentId);
            await queryRegistry.stopIndexing(deploymentId);
        });

        it('check offline status of indexing service ', async () => {
            // set new offline threshold
            await queryRegistry.setOfflineCalcThreshold(60);
            expect(await isOffline()).to.equal(false);
            // start indexing
            await queryRegistry.startIndexing(deploymentId);
            expect(await isOffline()).to.equal(true);
            // report status
            const timestamp = await lastestTime(mockProvider);
            await reportStatus(timestamp);
            expect(await isOffline()).to.equal(false);
            // time travel
            await timeTravel(mockProvider, 120);
            expect(await isOffline()).to.equal(true);
            // report status
            await queryRegistry.updateIndexingStatusToReady(deploymentId);
            expect(await isOffline()).to.equal(false);
            // stop project
            await queryRegistry.stopIndexing(deploymentId);
            expect(await isOffline()).to.equal(false);
        });

        it('start indexing with invalid condition should fail', async () => {
            // caller is not indexer
            await expect(queryRegistry.connect(wallet_1).startIndexing(deploymentId)).to.be.revertedWith('G002');
            // current status is not `NOTINDEXING`
            await queryRegistry.startIndexing(deploymentId);
            await expect(queryRegistry.startIndexing(deploymentId)).to.be.revertedWith('QR009');
            // update status to ready
            await queryRegistry.updateIndexingStatusToReady(deploymentId);
            await expect(queryRegistry.startIndexing(deploymentId)).to.be.revertedWith('QR009');
        });

        it('update indexing to ready with invalid status should fail', async () => {
            // caller is not indexer
            await expect(queryRegistry.connect(wallet_1).updateIndexingStatusToReady(deploymentId)).to.be.revertedWith(
                'G002'
            );
            // current status is `NONSTARTED`
            await expect(queryRegistry.updateIndexingStatusToReady(deploymentId)).to.be.revertedWith('QR002');
            // current status `NOTINDEXING`
            await queryRegistry.startIndexing(deploymentId);
            await queryRegistry.stopIndexing(deploymentId);
            await expect(queryRegistry.updateIndexingStatusToReady(deploymentId)).to.be.revertedWith('QR002');
        });

        it('report status with invalid params should fail', async () => {
            let timestamp = await lastestTime(mockProvider);
            let status = await queryRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address);
            // caller is not a controller
            await expect(reportStatus(timestamp, undefined, fake_controller)).to.be.revertedWith('IR007');
            // current status is `NONSTARTED`
            await expect(reportStatus(timestamp)).to.be.revertedWith('QR002');
            await queryRegistry.startIndexing(deploymentId);
            timestamp = await lastestTime(mockProvider);
            await delay(2);
            await reportStatus(timestamp + 1, 10, wallet_1);
            status = await queryRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address);
            timestamp = await lastestTime(mockProvider);
            await expect(reportStatus(timestamp, status.blockHeight.toNumber() - 1, wallet_1)).to.be.revertedWith(
                'QR005'
            );
            // invalid timestamp
            await reportStatus(timestamp);
            await expect(reportStatus(timestamp)).to.be.revertedWith('QR003');
            await expect(reportStatus(timestamp + 1000)).to.be.revertedWith('QR004');
        });

        it('stop indexing with invalid condition should fail', async () => {
            // caller is not an indexer
            await expect(queryRegistry.connect(wallet_1).stopIndexing(deploymentId)).to.be.revertedWith('G002');
            // current status is `NOTINDEXING`
            await expect(queryRegistry.stopIndexing(deploymentId)).to.be.revertedWith('QR010');
            // current status is `NOTINDEXING`
            await queryRegistry.startIndexing(deploymentId);
            await queryRegistry.stopIndexing(deploymentId);
            await expect(queryRegistry.stopIndexing(deploymentId)).to.be.revertedWith('QR010');
            // have ongoing service agreement
            await queryRegistry.startIndexing(deploymentId);
            await queryRegistry.updateIndexingStatusToReady(deploymentId);
            await token.increaseAllowance(purchaseOfferMarket.address, etherParse('5'));
            await planManager.createPlanTemplate(1000, 1000, 100, token.address, METADATA_HASH);
            await createPurchaseOffer(purchaseOfferMarket, token, deploymentId, await futureTimestamp(mockProvider));
            await purchaseOfferMarket.acceptPurchaseOffer(0, poi);
            await expect(queryRegistry.stopIndexing(deploymentId)).to.be.revertedWith('QR011');
        });
    });
});
