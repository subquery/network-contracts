// // Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// // SPDX-License-Identifier: GPL-3.0-or-later
//
// import { expect } from 'chai';
// import { Wallet } from 'ethers';
// import { ethers, waffle } from 'hardhat';
//
// import { IndexerRegistry, PlanManager, PurchaseOfferMarket, ProjectRegistry, SQToken, Staking } from '../src';
// import { METADATA_HASH, deploymentIds, metadatas, mmrRoot, versions } from './constants';
// import {
//     constants,
//     createPurchaseOffer,
//     delay,
//     etherParse,
//     futureTimestamp,
//     lastestTime,
//     registerIndexer,
//     timeTravel,
// } from './helper';
// import { deployContracts } from './setup';
//
// enum IndexingServiceStatus {
//     NOTINDEXING,
//     INDEXING,
//     READY,
// }
//
// describe('Query Registry Contract', () => {
//     const mockProvider = waffle.provider;
//     let wallet_0, wallet_1, fake_controller;
//     let default_indexer;
//     const deploymentId = deploymentIds[0];
//     let token: SQToken;
//     let staking: Staking;
//     let indexerRegistry: IndexerRegistry;
//     let projectRegistry: ProjectRegistry;
//     let purchaseOfferMarket: PurchaseOfferMarket;
//     let planManager: PlanManager;
//
//     // create query project
//     const createProject = async () => {
//         await projectRegistry.createProject(metadatas[0], versions[0], deploymentIds[0]);
//     };
//
//     const reportStatus = async (
//         timestamp: number,
//         height: number = 10,
//         wallet: Wallet = wallet_1,
//         indexer: string = default_indexer
//     ) => {
//         const tx = await projectRegistry
//             .connect(wallet)
//             .reportIndexingStatus(indexer, deploymentId, height, mmrRoot, timestamp);
//         return tx;
//     };
//
//     const checkQueryInfoIsEmpty = async (id: number) => {
//         let queryInfos = await projectRegistry.queryInfos(id);
//         expect(queryInfos.queryId).to.equal(0);
//         expect(queryInfos.metadata).to.equal(constants.ZERO_BYTES32);
//         expect(queryInfos.latestVersion).to.equal(constants.ZERO_BYTES32);
//         expect(queryInfos.latestDeploymentId).to.equal(constants.ZERO_BYTES32);
//         expect(queryInfos.owner).to.equal(constants.ZERO_ADDRESS);
//     };
//
//     const checkDeploymentStatus = async (
//         deploymentId: string,
//         serviceStatus: IndexingServiceStatus,
//         timestamp: number
//     ) => {
//         const status = await projectRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address);
//         expect(status.deploymentId).to.equal(deploymentId);
//         expect(Number(status.timestamp)).to.equal(timestamp);
//         expect(status.status).to.equal(serviceStatus);
//     };
//
//     const isOffline = async () => {
//         const status = await projectRegistry.isOffline(deploymentIds[0], wallet_0.address);
//         return status;
//     };
//
//     beforeEach(async () => {
//         [wallet_0, wallet_1, fake_controller] = await ethers.getSigners();
//         const deployment = await deployContracts(wallet_0, wallet_1);
//         default_indexer = wallet_0.address;
//         token = deployment.token;
//         staking = deployment.staking;
//         indexerRegistry = deployment.indexerRegistry;
//         projectRegistry = deployment.projectRegistry;
//         purchaseOfferMarket = deployment.purchaseOfferMarket;
//         planManager = deployment.planManager;
//
//         await createProject();
//     });
//
//     describe('Create Query Project', () => {
//         it('create query project should work', async () => {
//             // create project
//             const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
//             await expect(projectRegistry.createProject(metadata, version, deploymentId))
//                 .to.be.emit(projectRegistry, 'CreateQuery')
//                 .withArgs(1, wallet_0.address, metadata, deploymentId, version);
//
//             // check state updates
//             const queryInfos = await projectRegistry.queryInfos(1);
//             expect(queryInfos.metadata).to.equal(metadata);
//             expect(queryInfos.latestVersion).to.equal(version);
//             expect(queryInfos.latestDeploymentId).to.equal(deploymentId);
//             expect(queryInfos.owner).to.equal(wallet_0.address);
//             expect(await projectRegistry.nextQueryId()).to.equal(2);
//         });
//
//         it('cannot create a project with an existing deploymentId', async () => {
//             const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[0]];
//             await expect(projectRegistry.createProject(metadata, version, deploymentId)).to.be.revertedWith('QR006');
//         });
//
//         it('authorised account can create project in creatorRestricted mode', async () => {
//             const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
//             expect(await projectRegistry.creatorWhitelist(wallet_1.address)).to.be.equal(false);
//             await projectRegistry.addCreator(wallet_1.address);
//             expect(await projectRegistry.creatorWhitelist(wallet_1.address)).to.be.equal(true);
//             await expect(projectRegistry.connect(wallet_1).createProject(metadata, version, deploymentId))
//                 .to.be.emit(projectRegistry, 'CreateQuery')
//                 .withArgs(1, wallet_1.address, metadata, deploymentId, version);
//         });
//
//         it('cannot create a project with not authorised account in creatorRestrict mode', async () => {
//             const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
//             await expect(
//                 projectRegistry.connect(wallet_1).createProject(metadata, version, deploymentId)
//             ).to.be.revertedWith('QR001');
//         });
//
//         it('any account can create a project not in creatorRestrict mode', async () => {
//             const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
//             expect(await projectRegistry.creatorRestricted()).to.be.equal(true);
//             await projectRegistry.setCreatorRestricted(false);
//             expect(await projectRegistry.creatorRestricted()).to.be.equal(false);
//             await expect(projectRegistry.connect(wallet_1).createProject(metadata, version, deploymentId))
//                 .to.be.emit(projectRegistry, 'CreateQuery')
//                 .withArgs(1, wallet_1.address, metadata, deploymentId, version);
//         });
//     });
//
//     describe('Update Query Project', () => {
//         it('update project metadata should work', async () => {
//             await expect(projectRegistry.updateQueryProjectMetadata(0, metadatas[1]))
//                 .to.be.emit(projectRegistry, 'UpdateQueryMetadata')
//                 .withArgs(wallet_0.address, 0, metadatas[1]);
//
//             // check state changes
//             const queryInfos = await projectRegistry.queryInfos(0);
//             expect(queryInfos.metadata).to.equal(metadatas[1]);
//         });
//
//         it('update project deploymenet should work', async () => {
//             const [version, deploymentId] = [versions[1], deploymentIds[1]];
//             await expect(projectRegistry.updateDeployment(0, deploymentId, version))
//                 .to.be.emit(projectRegistry, 'UpdateQueryDeployment')
//                 .withArgs(wallet_0.address, 0, deploymentId, version);
//
//             // check state changes
//             const queryInfos = await projectRegistry.queryInfos(0);
//             expect(queryInfos.latestVersion).to.equal(version);
//             expect(queryInfos.latestDeploymentId).to.equal(deploymentId);
//         });
//
//         it('update project with invalid owner should fail', async () => {
//             await projectRegistry.addCreator(wallet_1.address);
//             // no permission to update metadata
//             await expect(
//                 projectRegistry.connect(wallet_1).updateQueryProjectMetadata(0, metadatas[1])
//             ).to.be.revertedWith('QR007');
//             // no permission to update deployment
//             await expect(
//                 projectRegistry.connect(wallet_1).updateDeployment(0, deploymentIds[1], versions[1])
//             ).to.be.revertedWith('QR008');
//         });
//
//         it('should fail to update deployment to one already used', async () => {
//             await expect(projectRegistry.updateDeployment(0, deploymentId, versions[0])).to.be.revertedWith('QR006');
//         });
//     });
//
//     describe('Indexing Query Project', () => {
//         beforeEach(async () => {
//             await registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_0, '2000');
//             await indexerRegistry.setControllerAccount(wallet_1.address);
//         });
//
//         it('start indexing should work', async () => {
//             await expect(projectRegistry.startIndexing(deploymentId))
//                 .to.be.emit(projectRegistry, 'StartIndexing')
//                 .withArgs(wallet_0.address, deploymentId);
//
//             // check state changes
//             await checkDeploymentStatus(deploymentId, IndexingServiceStatus.INDEXING, 0);
//             expect(await projectRegistry.numberOfIndexingDeployments(wallet_0.address)).to.equal(1);
//         });
//
//         it('start indexing should fail for unregistered deployment id', async () => {
//             const deploymentId = deploymentIds[1];
//             await expect(projectRegistry.startIndexing(deploymentId)).to.be.revertedWith('QR006');
//         });
//
//         it('update indexing status to ready should work', async () => {
//             await projectRegistry.startIndexing(deploymentId);
//             await expect(projectRegistry.startService(deploymentId))
//                 .to.be.emit(projectRegistry, 'UpdateIndexingStatusToReady')
//                 .withArgs(wallet_0.address, deploymentId);
//
//             // check state changes
//             const timestamp = await lastestTime(mockProvider);
//             await checkDeploymentStatus(deploymentId, IndexingServiceStatus.READY, timestamp);
//         });
//
//         it('report indexing status should work', async () => {
//             const timestamp_0 = await lastestTime(mockProvider);
//             // start indexing
//             await projectRegistry.startIndexing(deploymentId);
//             // report status
//             await expect(reportStatus(timestamp_0))
//                 .to.be.emit(projectRegistry, 'UpdateDeploymentStatus')
//                 .withArgs(wallet_0.address, deploymentId, 10, mmrRoot, timestamp_0);
//             await checkDeploymentStatus(deploymentId, IndexingServiceStatus.INDEXING, timestamp_0);
//
//             // change status to ready
//             await timeTravel(mockProvider, 6);
//             await projectRegistry.startService(deploymentId);
//             await timeTravel(mockProvider, 6);
//             // report status
//             const timestamp_1 = await lastestTime(mockProvider);
//             await reportStatus(timestamp_1);
//             await checkDeploymentStatus(deploymentId, IndexingServiceStatus.READY, timestamp_1);
//         });
//
//         it('stop indexing should work', async () => {
//             // can stop `INDEXING` project
//             await projectRegistry.startIndexing(deploymentId);
//             await expect(projectRegistry.stopService(deploymentId))
//                 .to.be.emit(projectRegistry, 'StopIndexing')
//                 .withArgs(wallet_0.address, deploymentId);
//
//             // check state changes
//             await checkDeploymentStatus(deploymentId, IndexingServiceStatus.NOTINDEXING, 0);
//             expect(await projectRegistry.numberOfIndexingDeployments(wallet_0.address)).to.equal(0);
//
//             // can restart indexing project
//             await projectRegistry.startIndexing(deploymentId);
//             await checkDeploymentStatus(deploymentId, IndexingServiceStatus.INDEXING, 0);
//             expect(await projectRegistry.numberOfIndexingDeployments(wallet_0.address)).to.equal(1);
//
//             // can stop `READY` project
//             await projectRegistry.startService(deploymentId);
//             await projectRegistry.stopService(deploymentId);
//         });
//
//         it('check offline status of indexing service ', async () => {
//             // set new offline threshold
//             await projectRegistry.setOfflineCalcThreshold(60);
//             expect(await isOffline()).to.equal(false);
//             // start indexing
//             await projectRegistry.startIndexing(deploymentId);
//             expect(await isOffline()).to.equal(true);
//             // report status
//             const timestamp = await lastestTime(mockProvider);
//             await reportStatus(timestamp);
//             expect(await isOffline()).to.equal(false);
//             // time travel
//             await timeTravel(mockProvider, 120);
//             expect(await isOffline()).to.equal(true);
//             // report status
//             await projectRegistry.startService(deploymentId);
//             expect(await isOffline()).to.equal(false);
//             // stop project
//             await projectRegistry.stopService(deploymentId);
//             expect(await isOffline()).to.equal(false);
//         });
//
//         it('start indexing with invalid condition should fail', async () => {
//             // caller is not indexer
//             await expect(projectRegistry.connect(wallet_1).startIndexing(deploymentId)).to.be.revertedWith('G002');
//             // current status is not `NOTINDEXING`
//             await projectRegistry.startIndexing(deploymentId);
//             await expect(projectRegistry.startIndexing(deploymentId)).to.be.revertedWith('QR009');
//             // update status to ready
//             await projectRegistry.startService(deploymentId);
//             await expect(projectRegistry.startIndexing(deploymentId)).to.be.revertedWith('QR009');
//         });
//
//         it('update indexing to ready with invalid status should fail', async () => {
//             // caller is not indexer
//             await expect(projectRegistry.connect(wallet_1).startService(deploymentId)).to.be.revertedWith(
//                 'G002'
//             );
//             // current status is `NONSTARTED`
//             await expect(projectRegistry.startService(deploymentId)).to.be.revertedWith('QR002');
//             // current status `NOTINDEXING`
//             await projectRegistry.startIndexing(deploymentId);
//             await projectRegistry.stopService(deploymentId);
//             await expect(projectRegistry.startService(deploymentId)).to.be.revertedWith('QR002');
//         });
//
//         it('report status with invalid params should fail', async () => {
//             let timestamp = await lastestTime(mockProvider);
//             let status = await projectRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address);
//             // caller is not a controller
//             await expect(reportStatus(timestamp, undefined, fake_controller)).to.be.revertedWith('IR007');
//             // current status is `NONSTARTED`
//             await expect(reportStatus(timestamp)).to.be.revertedWith('QR002');
//             await projectRegistry.startIndexing(deploymentId);
//             timestamp = await lastestTime(mockProvider);
//             await delay(2);
//             await reportStatus(timestamp + 1, 10, wallet_1);
//             status = await projectRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address);
//             timestamp = await lastestTime(mockProvider);
//             await expect(reportStatus(timestamp, status.blockHeight.toNumber() - 1, wallet_1)).to.be.revertedWith(
//                 'QR005'
//             );
//             // invalid timestamp
//             await reportStatus(timestamp);
//             await expect(reportStatus(timestamp)).to.be.revertedWith('QR003');
//             await expect(reportStatus(timestamp + 1000)).to.be.revertedWith('QR004');
//         });
//
//         it('stop indexing with invalid condition should fail', async () => {
//             // caller is not an indexer
//             await expect(projectRegistry.connect(wallet_1).stopService(deploymentId)).to.be.revertedWith('G002');
//             // current status is `NOTINDEXING`
//             await expect(projectRegistry.stopService(deploymentId)).to.be.revertedWith('QR010');
//             // current status is `NOTINDEXING`
//             await projectRegistry.startIndexing(deploymentId);
//             await projectRegistry.stopService(deploymentId);
//             await expect(projectRegistry.stopService(deploymentId)).to.be.revertedWith('QR010');
//             // have ongoing service agreement
//             await projectRegistry.startIndexing(deploymentId);
//             await projectRegistry.startService(deploymentId);
//             await token.increaseAllowance(purchaseOfferMarket.address, etherParse('5'));
//             await planManager.createPlanTemplate(1000, 1000, 100, token.address, METADATA_HASH);
//             await createPurchaseOffer(purchaseOfferMarket, token, deploymentId, await futureTimestamp(mockProvider));
//             await purchaseOfferMarket.acceptPurchaseOffer(0, mmrRoot);
//             await expect(projectRegistry.stopService(deploymentId)).to.be.revertedWith('QR011');
//         });
//     });
// });
