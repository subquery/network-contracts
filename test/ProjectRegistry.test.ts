// Copyright (C) 2020-2022 SubProject Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { IndexerRegistry, PlanManager, ProjectRegistry, PurchaseOfferMarket, SQToken, Staking } from '../src';
import { METADATA_HASH, POI, PROJECT_METADATA, deploymentIds, metadatas, versions } from './constants';
import {
  createPurchaseOffer,
  etherParse,
  futureTimestamp,
  registerIndexer
} from './helper';
import { deployContracts } from './setup';

enum IndexingServiceStatus {
    NOTINDEXING,
    READY,
}

enum ProjectType {
  SUBQUERY,
  RPC
}

describe('Project Registry Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, fake_controller;
    let default_indexer;
    const deploymentId = deploymentIds[0];
    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let projectRegistry: ProjectRegistry;
    let purchaseOfferMarket: PurchaseOfferMarket;
    let planManager: PlanManager;

    // create query project
    const createProject = async (wallet = wallet_0) => {
        await projectRegistry.connect(wallet).createProject(PROJECT_METADATA, METADATA_HASH, deploymentId, ProjectType.SUBQUERY);
    };

    beforeEach(async () => {
        [wallet_0, wallet_1, fake_controller] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_1);
        default_indexer = wallet_0.address;
        token = deployment.token;
        staking = deployment.staking;
        indexerRegistry = deployment.indexerRegistry;
        projectRegistry = deployment.projectRegistry;
        purchaseOfferMarket = deployment.purchaseOfferMarket;
        planManager = deployment.planManager;

        await createProject();
    });

    describe('Create Project Project', () => {
        it('create query project should work', async () => {
            // create project
            await expect(createProject)
                .to.be.emit(projectRegistry, 'CreateProject')
                .withArgs(wallet_0.address, PROJECT_METADATA, ProjectType.SUBQUERY, deploymentId, METADATA_HASH);

            // check state updates
            const projectInfos = await projectRegistry.projectInfos(1);
            expect(projectInfos.latestDeploymentId).to.equal(deploymentId);
            expect(projectInfos.projectType).to.equal(ProjectType.SUBQUERY);

            const deploymentInfos = await projectRegistry.deploymentInfos(deploymentId);
            expect(deploymentInfos.projectId).to.equal(1);
            expect(deploymentInfos.metadata).to.equal(METADATA_HASH);

            expect(await projectRegistry.nextProjectId()).to.equal(2);
        });

        it('cannot create a project with an existing deploymentId', async () => {
            await expect(createProject()).to.be.revertedWith('PR006');
        });

        it('authorised account can create project in creatorRestricted mode', async () => {
            const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
            expect(await projectRegistry.creatorWhitelist(wallet_1.address)).to.be.equal(false);
            await projectRegistry.addCreator(wallet_1.address);
            expect(await projectRegistry.creatorWhitelist(wallet_1.address)).to.be.equal(true);
            await expect(createProject(wallet_1))
                .to.be.emit(projectRegistry, 'CreateProject')
                .withArgs(1, wallet_1.address, metadata, deploymentId, version);
        });

        it('cannot create a project with not authorised account in creatorRestrict mode', async () => {
            const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
            await expect(createProject(wallet_1)).to.be.revertedWith('PR001');
        });

        it('any account can create a project not in creatorRestrict mode', async () => {
            const [metadata, version, deploymentId] = [metadatas[0], versions[0], deploymentIds[1]];
            expect(await projectRegistry.creatorRestricted()).to.be.equal(true);
            await projectRegistry.setCreatorRestricted(false);
            expect(await projectRegistry.creatorRestricted()).to.be.equal(false);
            await expect(createProject(wallet_1))
                .to.be.emit(projectRegistry, 'CreateProject')
                .withArgs(1, wallet_1.address, metadata, deploymentId, version);
        });
    });

    describe('Update Project Project', () => {
        it('update project metadata should work', async () => {
            await expect(projectRegistry.updateProjectMetadata(1, PROJECT_METADATA))
                .to.be.emit(projectRegistry, 'UpdateProjectMetadata')
                .withArgs(wallet_0.address, 1, PROJECT_METADATA);

            // check state changes
            const tokenUri = await projectRegistry.tokenURI(1);
            expect(tokenUri).to.equal(`ifps://${PROJECT_METADATA}`);
        });

        it('update project deploymenet should work', async () => {
            const [version, deploymentId] = [versions[1], deploymentIds[1]];
            await expect(projectRegistry.updateDeployment(1, deploymentId, version))
                .to.be.emit(projectRegistry, 'UpdateProjectDeployment')
                .withArgs(wallet_0.address, 1, deploymentId, version);

            // check state changes
            const projectInfo = await projectRegistry.projectInfos(1);
            const deploymentInfo = await projectRegistry.deploymentInfos(deploymentId);
            expect(projectInfo.latestDeploymentId).to.equal(deploymentId);
            expect(deploymentInfo.metadata).to.equal(version);
        });

        it('update project with invalid owner should fail', async () => {
            await projectRegistry.addCreator(wallet_1.address);
            // no permission to update metadata
            await expect(
                projectRegistry.connect(wallet_1).updateProjectMetadata(1, PROJECT_METADATA)
            ).to.be.revertedWith('PR004');
            // no permission to update deployment
            await expect(
                projectRegistry.connect(wallet_1).updateDeployment(1, deploymentIds[1], versions[1])
            ).to.be.revertedWith('PR004');
        });

        it('should fail to update deployment to one already used', async () => {
            await expect(projectRegistry.updateDeployment(0, deploymentId, versions[0])).to.be.revertedWith('PR006');
        });
    });

    describe('Indexing Project Project', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_0, '2000');
            await indexerRegistry.setControllerAccount(wallet_1.address);
        });

        it('start service should work', async () => {
            await expect(projectRegistry.startService(deploymentId))
                .to.be.emit(projectRegistry, 'ServiceStatusChanged')
                .withArgs(wallet_0.address, deploymentId, 1);

            // check state changes
            expect(await projectRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address)).to.equal(IndexingServiceStatus.READY);
            expect(await projectRegistry.numberOfDeployments(wallet_0.address)).to.equal(1);
        });

        it('start service should fail for unregistered deployment id', async () => {
            const deploymentId = deploymentIds[1];
            await expect(projectRegistry.startService(deploymentId)).to.be.revertedWith('PR006');
        });

        it('stop service should work', async () => {
            // can stop `INDEXING` project
            await projectRegistry.startService(deploymentId);
            await expect(projectRegistry.stopService(deploymentId))
                .to.be.emit(projectRegistry, 'ServiceStatusChanged')
                .withArgs(wallet_0.address, deploymentId, 0);

            // check state changes
            expect(await projectRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address)).to.equal(IndexingServiceStatus.NOTINDEXING);
            expect(await projectRegistry.numberOfDeployments(wallet_0.address)).to.equal(0);

            // can restart service project
            await projectRegistry.startService(deploymentId);
            expect(await projectRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address)).to.equal(IndexingServiceStatus.READY);
            expect(await projectRegistry.numberOfDeployments(wallet_0.address)).to.equal(1);

            // can stop `READY` project
            await projectRegistry.startService(deploymentId);
            await projectRegistry.stopService(deploymentId);
        });

        it('start service with invalid condition should fail', async () => {
            // caller is not indexer
            await expect(projectRegistry.connect(wallet_1).startService(deploymentId)).to.be.revertedWith('G002');
            // current status is not `NOTINDEXING`
            await projectRegistry.startService(deploymentId);
            await expect(projectRegistry.startService(deploymentId)).to.be.revertedWith('PR009');
            // update status to ready
            await projectRegistry.startService(deploymentId);
            await expect(projectRegistry.startService(deploymentId)).to.be.revertedWith('PR009');
        });

        it('update indexing to ready with invalid status should fail', async () => {
            // caller is not indexer
            await expect(projectRegistry.connect(wallet_1).startService(deploymentId)).to.be.revertedWith(
                'G002'
            );
            // current status is `NONSTARTED`
            await expect(projectRegistry.startService(deploymentId)).to.be.revertedWith('PR002');
            // current status `NOTINDEXING`
            await projectRegistry.startService(deploymentId);
            await projectRegistry.stopService(deploymentId);
            await expect(projectRegistry.startService(deploymentId)).to.be.revertedWith('PR002');
        });

        it('stop indexing with invalid condition should fail', async () => {
            // caller is not an indexer
            await expect(projectRegistry.connect(wallet_1).stopService(deploymentId)).to.be.revertedWith('G002');
            // current status is `NOTINDEXING`
            await expect(projectRegistry.stopService(deploymentId)).to.be.revertedWith('PR010');
            // current status is `NOTINDEXING`
            await projectRegistry.startService(deploymentId);
            await projectRegistry.stopService(deploymentId);
            await expect(projectRegistry.stopService(deploymentId)).to.be.revertedWith('PR010');
            // have ongoing service agreement
            await projectRegistry.startService(deploymentId);
            await projectRegistry.startService(deploymentId);
            await token.increaseAllowance(purchaseOfferMarket.address, etherParse('5'));
            await planManager.createPlanTemplate(1000, 1000, 100, token.address, METADATA_HASH);
            await createPurchaseOffer(purchaseOfferMarket, token, deploymentId, await futureTimestamp(mockProvider));
            await purchaseOfferMarket.acceptPurchaseOffer(0, POI);
            await expect(projectRegistry.stopService(deploymentId)).to.be.revertedWith('PR011');
        });
    });
});
