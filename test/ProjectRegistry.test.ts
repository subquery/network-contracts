// Copyright (C) 2020-2023 SubProject Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { IndexerRegistry, PlanManager, ProjectRegistry, PurchaseOfferMarket, SQToken, Settings, Staking } from '../src';
import { METADATA_HASH, POI, deploymentIds, deploymentMetadatas, projectMetadatas } from './constants';
import {
    Wallet,
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
    let wallet_0: Wallet;
    let wallet_1: Wallet;

    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let projectRegistry: ProjectRegistry;
    let purchaseOfferMarket: PurchaseOfferMarket;
    let planManager: PlanManager;
    let setting: Settings;

    const deploymentId = deploymentIds[0];
    const projectMetadata = projectMetadatas[0];
    const deploymentMetadata = deploymentMetadatas[0];

    // create query project
    const createProject = (wallet = wallet_0) => {
        return projectRegistry.connect(wallet).createProject(
            projectMetadata,
            deploymentMetadata,
            deploymentId,
            ProjectType.SUBQUERY
        );
    };

    const checkTokenUri = async (tokenId: number, uri: string) => {
        expect(await projectRegistry.tokenURI(tokenId)).to.equal(`ipfs://${uri}`);
    }

    beforeEach(async () => {
        [wallet_0, wallet_1] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_1);
        token = deployment.token;
        staking = deployment.staking;
        indexerRegistry = deployment.indexerRegistry;
        projectRegistry = deployment.projectRegistry;
        purchaseOfferMarket = deployment.purchaseOfferMarket;
        planManager = deployment.planManager;
        setting = deployment.settings;
    });

    describe('Initialisation', () => {
        it('initialisation should work', async () =>  {
            expect(await projectRegistry.name()).to.equal('SubQueryProject');
            expect(await projectRegistry.symbol()).to.equal('SP');
            expect(await projectRegistry.totalSupply()).to.equal(0);

            expect(await projectRegistry.creatorRestricted()).to.equal(true);
            expect(await projectRegistry.creatorWhitelist(wallet_0.address)).to.equal(true);
            expect(await projectRegistry.creatorWhitelist(wallet_1.address)).to.equal(false);
            expect(await projectRegistry.settings()).to.equal(setting.address);
            expect(await projectRegistry.nextProjectId()).to.equal(1);
        });
    });

    describe('Managing Creator', () => {
        it('change creator restricted mode should work', async () => {
            expect(await projectRegistry.creatorRestricted()).to.equal(true);
            await projectRegistry.setCreatorRestricted(false);
            expect(await projectRegistry.creatorRestricted()).to.equal(false);
        });

        it('add creator should work', async () => {
            expect(await projectRegistry.creatorWhitelist(wallet_1.address)).to.equal(false);
            await projectRegistry.addCreator(wallet_1.address);
            expect(await projectRegistry.creatorWhitelist(wallet_1.address)).to.equal(true);
        });

        it('remove creator should work', async () => {
            expect(await projectRegistry.creatorWhitelist(wallet_0.address)).to.equal(true);
            await projectRegistry.removeCreator(wallet_0.address);
            expect(await projectRegistry.creatorWhitelist(wallet_0.address)).to.equal(false);
        });
    });

    describe.only('Create Project', () => {
        it('create project should work', async () => {
            // create project
            const projectId = 1;
            await expect(createProject())
                .to.be.emit(projectRegistry, 'CreateProject')
                .withArgs(wallet_0.address, projectId, projectMetadata, ProjectType.SUBQUERY, deploymentId, deploymentMetadata);

            // check state updates
            const projectInfos = await projectRegistry.projectInfos(projectId);
            expect(projectInfos.latestDeploymentId).to.equal(deploymentId);
            expect(projectInfos.projectType).to.equal(ProjectType.SUBQUERY);

            const deploymentInfos = await projectRegistry.deploymentInfos(deploymentId);
            expect(deploymentInfos.projectId).to.equal(projectId);
            expect(deploymentInfos.metadata).to.equal(deploymentMetadata);
            expect(await projectRegistry.nextProjectId()).to.equal(2);

            // check nft features
            expect(await projectRegistry.ownerOf(projectId)).to.equal(wallet_0.address);
            expect(await projectRegistry.balanceOf(wallet_0.address)).to.equal(1);
            expect(await projectRegistry.tokenOfOwnerByIndex(wallet_0.address, 0)).to.equal(projectId);
            expect(await projectRegistry.tokenByIndex(0)).to.equal(projectId);
            expect(await projectRegistry.totalSupply()).to.equal(1);
            expect(await projectRegistry.tokenURI(projectId)).to.equal(`ipfs://${projectMetadata}`);
            await checkTokenUri(projectId, projectMetadata);
        });

        it('authorised account can create project in creatorRestricted mode', async () => {
            await projectRegistry.addCreator(wallet_1.address);
            await createProject(wallet_1);
            expect(await projectRegistry.ownerOf(1)).to.equal(wallet_1.address);
        });

        it('any account can create a project when creatorRestricted mode disabled', async () => {
            await projectRegistry.setCreatorRestricted(false);
            await createProject(wallet_1);
            expect(await projectRegistry.ownerOf(1)).to.equal(wallet_1.address);
        });

        it('fail to create project with invalid params', async () => {
            // wallet not in the whitelist can not create project
            await expect(createProject(wallet_1)).to.be.revertedWith('PR001');

            await createProject();
            // create another project with same deploymentId should fail
            await expect(createProject()).to.be.revertedWith('PR003');
        });
    });

    describe('Update Project', () => {
        it('update project metadata should work', async () => {
            await expect(projectRegistry.updateProjectMetadata(1, projectMetadata))
                .to.be.emit(projectRegistry, 'UpdateProjectMetadata')
                .withArgs(wallet_0.address, 1, projectMetadata);

            // check state changes
            const tokenUri = await projectRegistry.tokenURI(1);
            expect(tokenUri).to.equal(`ifps://${projectMetadata}`);
        });

        it('update project deploymenet should work', async () => {
            const [version, deploymentId] = [deploymentMetadatas[1], deploymentIds[1]];
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
                projectRegistry.connect(wallet_1).updateProjectMetadata(1, projectMetadata)
            ).to.be.revertedWith('PR004');
            // no permission to update deployment
            await expect(
                projectRegistry.connect(wallet_1).updateDeployment(1, deploymentIds[1], deploymentMetadatas[1])
            ).to.be.revertedWith('PR004');
        });

        it('should fail to update deployment to one already used', async () => {
            await expect(projectRegistry.updateDeployment(0, deploymentId, deploymentMetadatas[0])).to.be.revertedWith('PR006');
        });
    });

    describe('Managing Project Service', () => {
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
