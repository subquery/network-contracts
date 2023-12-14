import { metadatas } from './constants';
// Copyright (C) 2020-2023 SubProject Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { constants } from 'ethers';

import { IndexerRegistry, PlanManager, ProjectRegistry, PurchaseOfferMarket, ERC20, Settings, Staking } from '../src';
import { METADATA_HASH, POI, deploymentIds, deploymentMetadatas, projectMetadatas } from './constants';
import {
    Wallet,
    createPurchaseOffer,
    etherParse,
    futureTimestamp,
    registerIndexer
} from './helper';
import { deployContracts } from './setup';

enum ServiceStatus {
    TERMINATED,
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

    let token: ERC20;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let projectRegistry: ProjectRegistry;
    let purchaseOfferMarket: PurchaseOfferMarket;
    let planManager: PlanManager;
    let setting: Settings;

    const deploymentId = deploymentIds[0];
    const deploymentId2 = deploymentIds[1];
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

    const deployer = ()=>deployContracts(wallet_0, wallet_1);
    before(async ()=>{
        [wallet_0, wallet_1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
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

            expect(await projectRegistry.creatorRestricted(ProjectType.SUBQUERY)).to.equal(true);
            expect(await projectRegistry.creatorRestricted(ProjectType.RPC)).to.equal(true);
            expect(await projectRegistry.creatorWhitelist(wallet_0.address)).to.equal(true);
            expect(await projectRegistry.creatorWhitelist(wallet_1.address)).to.equal(false);
            expect(await projectRegistry.settings()).to.equal(setting.address);
            expect(await projectRegistry.nextProjectId()).to.equal(1);
        });
    });

    describe('Managing Creator', () => {
        it('change creator restricted mode should work', async () => {
            expect(await projectRegistry.creatorRestricted(ProjectType.SUBQUERY)).to.equal(true);
            await projectRegistry.setCreatorRestricted(ProjectType.SUBQUERY, false);
            expect(await projectRegistry.creatorRestricted(ProjectType.SUBQUERY)).to.equal(false);
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

    describe('Create Project', () => {
        it('create project should work', async () => {
            // create project
            const projectId = 1;
            await expect(createProject())
                .to.be.emit(projectRegistry, 'ProjectCreated')
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
            await projectRegistry.setCreatorRestricted(ProjectType.SUBQUERY, false);
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
        beforeEach(async () => await createProject());

        it('update project metadata should work', async () => {
            const newProjectMetadata = projectMetadatas[1];
            await expect(projectRegistry.updateProjectMetadata(1, newProjectMetadata))
                .to.be.emit(projectRegistry, 'ProjectMetadataUpdated')
                .withArgs(wallet_0.address, 1, newProjectMetadata);

            // check state changes
            const tokenUri = await projectRegistry.tokenURI(1);
            expect(tokenUri).to.equal(`ipfs://${newProjectMetadata}`);
        });

        it('add new deployment to project should work', async () => {
            const projectId = 1;
            let [metadata, deploymentId] = [deploymentMetadatas[1], deploymentIds[1]];
            await expect(projectRegistry.addOrUpdateDeployment(1, deploymentId, metadata, true))
                .to.be.emit(projectRegistry, 'ProjectDeploymentUpdated')
                .withArgs(wallet_0.address, projectId, deploymentId, metadata);

            // check state changes
            let projectInfo = await projectRegistry.projectInfos(projectId);
            let deploymentInfo = await projectRegistry.deploymentInfos(deploymentId);
            expect(projectInfo.latestDeploymentId).to.equal(deploymentId);
            expect(projectInfo.projectType).to.equal(ProjectType.SUBQUERY);
            expect(deploymentInfo.projectId).to.equal(projectId);
            expect(deploymentInfo.metadata).to.equal(metadata);

            // add the second deployment without setting it as latest
            [metadata, deploymentId] = [deploymentMetadatas[2], deploymentIds[2]];
            await expect(projectRegistry.addOrUpdateDeployment(1, deploymentId, metadata, false))
                .to.be.emit(projectRegistry, 'ProjectDeploymentUpdated')
                .withArgs(wallet_0.address, projectId, deploymentId, metadata);

            // check state changes
            projectInfo = await projectRegistry.projectInfos(projectId);
            deploymentInfo = await projectRegistry.deploymentInfos(deploymentId);
            expect(projectInfo.latestDeploymentId).to.equal(deploymentIds[1]);
            expect(projectInfo.projectType).to.equal(ProjectType.SUBQUERY);
            expect(deploymentInfo.projectId).to.equal(projectId);
            expect(deploymentInfo.metadata).to.equal(metadata);
        });

        it('update deployment\'s metadata should work', async () => {
            const projectId = 1;
            const metadata = deploymentMetadatas[1];
            await expect(projectRegistry.addOrUpdateDeployment(1, deploymentId, metadata, false))
                .to.be.emit(projectRegistry, 'ProjectDeploymentUpdated')
                .withArgs(wallet_0.address, projectId, deploymentId, metadata);

            // check state changes
            const projectInfo = await projectRegistry.projectInfos(projectId);
            const deploymentInfo = await projectRegistry.deploymentInfos(deploymentId);
            expect(projectInfo.latestDeploymentId).to.equal(deploymentId);
            expect(projectInfo.projectType).to.equal(ProjectType.SUBQUERY);
            expect(deploymentInfo.projectId).to.equal(projectId);
            expect(deploymentInfo.metadata).to.equal(metadata);
        });

        it('update selected deployment as latest should work', async () => {
            const projectId = 1;
            await projectRegistry.addOrUpdateDeployment(projectId, deploymentId2, deploymentMetadata, false);
            let projectInfo = await projectRegistry.projectInfos(projectId);
            expect(projectInfo.latestDeploymentId).to.equal(deploymentId);

            await expect(projectRegistry.setProjectLatestDeployment(projectId, deploymentId2))
                .to.be.emit(projectRegistry, 'ProjectLatestDeploymentUpdated')
                .withArgs(wallet_0.address, projectId, deploymentId2);

            // check state changes
            projectInfo = await projectRegistry.projectInfos(projectId);
            expect(projectInfo.latestDeploymentId).to.equal(deploymentId2);
        });

        it('can add new deployment to project with new account after owner transferred', async () => {
            const projectId = 1;
            await projectRegistry.transferFrom(wallet_0.address, wallet_1.address, projectId);
            expect(await projectRegistry.ownerOf(projectId)).to.equal(wallet_1.address);
            expect(await projectRegistry.balanceOf(wallet_1.address)).to.equal(1);
            expect(await projectRegistry.balanceOf(wallet_0.address)).to.equal(0);

            const newProjectMetadata = projectMetadatas[1];
            expect(await projectRegistry.ownerOf(projectId)).to.equal(wallet_1.address);
            await projectRegistry.connect(wallet_1).updateProjectMetadata(projectId, newProjectMetadata);
            const [metadata, deploymentId] = [deploymentMetadatas[1], deploymentIds[1]];
            await projectRegistry.connect(wallet_1).addOrUpdateDeployment(projectId, deploymentId, metadata, true)

            // check state changes
            const tokenUri = await projectRegistry.tokenURI(projectId);
            expect(tokenUri).to.equal(`ipfs://${newProjectMetadata}`);
            const projectInfo = await projectRegistry.projectInfos(projectId);
            const deploymentInfo = await projectRegistry.deploymentInfos(deploymentId);
            expect(projectInfo.latestDeploymentId).to.equal(deploymentId);
            expect(projectInfo.projectType).to.equal(ProjectType.SUBQUERY);
            expect(deploymentInfo.projectId).to.equal(projectId);
            expect(deploymentInfo.metadata).to.equal(metadata);
        });

        it('update project metadata with invalid params should fail', async () => {
            // invalid owner
            await expect(
                projectRegistry.connect(wallet_1).updateProjectMetadata(1, projectMetadata)
            ).to.be.revertedWith('PR004');
        });

        it('update deployment with invalid params should fail', async () => {
            // invalid owner
            await expect(
                projectRegistry.connect(wallet_1).addOrUpdateDeployment(1, deploymentId, deploymentMetadata, true)
            ).to.be.revertedWith('PR004');
            // empty metadata or deploymentId
            await expect(
                projectRegistry.addOrUpdateDeployment(1, deploymentId, constants.HashZero, true)
            ).to.be.revertedWith('PR009');    
            await expect(
                projectRegistry.addOrUpdateDeployment(1, constants.HashZero, metadatas[0], true)
            ).to.be.revertedWith('PR009');

            // create another project
            await projectRegistry.createProject(
                projectMetadatas[1],
                deploymentMetadatas[1],
                deploymentIds[1],
                ProjectType.SUBQUERY
            );

            await expect(
                projectRegistry.addOrUpdateDeployment(1, deploymentIds[1], deploymentMetadatas[1], true)
            ).to.be.revertedWith('PR007');
            await expect(
                projectRegistry.addOrUpdateDeployment(1, deploymentId, deploymentMetadata, true)
            ).to.be.revertedWith('PR008');
        });

        it('set project latest deployment with invalid params should fail', async () => {
            // invalid owner 
            await expect(
                projectRegistry.connect(wallet_1).setProjectLatestDeployment(1, deploymentId)
            ).to.be.revertedWith('PR004');
            // inconsistent project id and deployment id
            await expect(
                projectRegistry.setProjectLatestDeployment(1, deploymentIds[1])
            ).to.be.revertedWith('PR007');
            // deployment id already set as latest
            await expect(
                projectRegistry.setProjectLatestDeployment(1, deploymentId)
            ).to.be.revertedWith('PR010');
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
                .withArgs(wallet_0.address, deploymentId, ServiceStatus.READY);

            // check state changes
            expect(await projectRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address)).to.equal(ServiceStatus.READY);
            expect(await projectRegistry.numberOfDeployments(wallet_0.address)).to.equal(1);
        });

        it('stop service should work', async () => {
            // can stop `INDEXING` project
            await projectRegistry.startService(deploymentId);
            await expect(projectRegistry.stopService(deploymentId))
                .to.be.emit(projectRegistry, 'ServiceStatusChanged')
                .withArgs(wallet_0.address, deploymentId, ServiceStatus.TERMINATED);

            // check state changes
            expect(await projectRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address)).to.equal(ServiceStatus.TERMINATED);
            expect(await projectRegistry.numberOfDeployments(wallet_0.address)).to.equal(0);

            // can restart service project
            await projectRegistry.startService(deploymentId);
            expect(await projectRegistry.deploymentStatusByIndexer(deploymentId, wallet_0.address)).to.equal(ServiceStatus.READY);
            expect(await projectRegistry.numberOfDeployments(wallet_0.address)).to.equal(1);
        });

        it('start service with invalid condition should fail', async () => {
            // caller is not indexer
            await expect(projectRegistry.connect(wallet_1).startService(deploymentId)).to.be.revertedWith('G002');
            // current status is not `NOTINDEXING`
            await projectRegistry.startService(deploymentId);
            await expect(projectRegistry.startService(deploymentId)).to.be.revertedWith('PR002');
        });

        it('stop indexing with invalid condition should fail', async () => {
            // caller is not an indexer
            await expect(projectRegistry.connect(wallet_1).stopService(deploymentId)).to.be.revertedWith('G002');
            // current status is `TERMINATED`
            await expect(projectRegistry.stopService(deploymentId)).to.be.revertedWith('PR005');
            // have ongoing service agreement
            await projectRegistry.startService(deploymentId);
            await token.increaseAllowance(purchaseOfferMarket.address, etherParse('5'));
            await planManager.createPlanTemplate(1000, 1000, 100, token.address, METADATA_HASH);
            await createPurchaseOffer(purchaseOfferMarket, token, deploymentId, await futureTimestamp(mockProvider));
            await purchaseOfferMarket.acceptPurchaseOffer(0, POI);
            await expect(projectRegistry.stopService(deploymentId)).to.be.revertedWith('PR006');
        });
    });
});
