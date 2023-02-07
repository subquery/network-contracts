// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {BigNumber} from 'ethers';
import {deployContracts} from './setup';
import {METADATA_HASH, DEPLOYMENT_ID, deploymentIds, metadatas, VERSION} from './constants';
import {
    IndexerRegistry,
    PlanManager,
    QueryRegistry,
    ServiceAgreementRegistry,
    RewardsDistributer,
    RewardsHelper,
    EraManager,
    SQToken,
    Staking,
} from '../src';
import {constants, registerIndexer, startNewEra, time, etherParse, eventFrom} from './helper';
import {utils} from 'ethers';

describe('PlanManger Contract', () => {
    const mockProvider = waffle.provider;
    let indexer, consumer;

    let token: SQToken;
    let staking: Staking;
    let queryRegistry: QueryRegistry;
    let indexerRegistry: IndexerRegistry;
    let planManager: PlanManager;
    let eraManager: EraManager;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let rewardsDistributor: RewardsDistributer;
    let rewardsHelper: RewardsHelper;

    beforeEach(async () => {
        [indexer, consumer] = await ethers.getSigners();
        const deployment = await deployContracts(indexer, consumer);
        indexerRegistry = deployment.indexerRegistry;
        queryRegistry = deployment.queryRegistry;
        planManager = deployment.planManager;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributer;
        rewardsHelper = deployment.rewardsHelper;
        eraManager = deployment.eraManager;
    });

    describe('Plan Manager Config', () => {
        it('set indexer plan limit should work', async () => {
            expect(await planManager.limit()).to.equal(5);
            await planManager.setIndexerPlanLimit(10);
            expect(await planManager.limit()).to.equal(10);
        });

        it('set indexer plan limit without owner should fail', async () => {
            await expect(planManager.connect(consumer).setIndexerPlanLimit(10)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });
    });

    describe('Plan Templates Management', () => {
        beforeEach(async () => {
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, METADATA_HASH);
        });

        it('create plan template should work', async () => {
            await expect(planManager.createPlanTemplate(100, 100, 10, METADATA_HASH))
                .to.be.emit(planManager, 'PlanTemplateCreated')
                .withArgs(1);
            expect(await planManager.nextTemplateId()).to.equal(2);
            const planTemplate = await planManager.getPlanTemplate(1);
            expect(planTemplate.period).to.equal(100);
            expect(planTemplate.dailyReqCap).to.equal(100);
            expect(planTemplate.rateLimit).to.equal(10);
            expect(planTemplate.metadata).to.equal(METADATA_HASH);
            expect(planTemplate.active).to.equal(true);
        });

        it('update plan template status should work', async () => {
            await expect(planManager.updatePlanTemplateStatus(0, false))
                .to.be.emit(planManager, 'PlanTemplateStatusChanged')
                .withArgs(0, false);
            let planTemplate = await planManager.getPlanTemplate(0);
            expect(planTemplate.active).to.equal(false);

            await planManager.updatePlanTemplateStatus(0, true);
            planTemplate = await planManager.getPlanTemplate(0);
            expect(planTemplate.active).to.equal(true);
        });

        it('update plan template metadata should work', async () => {
            await expect(planManager.updatePlanTemplateMetadata(0, metadatas[1]))
                .to.be.emit(planManager, 'PlanTemplateMetadataChanged')
                .withArgs(0, metadatas[1]);
            let planTemplate = await planManager.getPlanTemplate(0);
            expect(planTemplate.metadata).to.equal(metadatas[1]);
        });

        it('plan management with invalid params should fail', async () => {
            // not owner
            await expect(
                planManager.connect(consumer).createPlanTemplate(1000, 1000, 100, METADATA_HASH)
            ).to.be.revertedWith('Ownable: caller is not the owner');
            // not owner
            await expect(planManager.connect(consumer).updatePlanTemplateStatus(0, false)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
            await expect(planManager.connect(consumer).updatePlanTemplateMetadata(0, metadatas[1])).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
            // invalid `planTemplateId`
            await expect(planManager.updatePlanTemplateStatus(1, false)).to.be.revertedWith(
                'PM004'
            );
            // invalid `planTemplateId`
            await expect(planManager.updatePlanTemplateMetadata(1, metadatas[1])).to.be.revertedWith(
                'PM004'
            );
            // invalid period
            await expect(planManager.createPlanTemplate(0, 1000, 100, METADATA_HASH)).to.be.revertedWith(
                'PM001'
            );
            // invalid daily request cap
            await expect(planManager.createPlanTemplate(1000, 0, 100, METADATA_HASH)).to.be.revertedWith(
                'PM002'
            );
            // invalid rate limit
            await expect(planManager.createPlanTemplate(1000, 1000, 0, METADATA_HASH)).to.be.revertedWith(
                'PM003'
            );
        });
    });

    describe('Plan Management', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, indexer, indexer, '2000');
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, METADATA_HASH); // template_id = 0
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 100, 10, METADATA_HASH); // template_id = 1
        });

        it('create plan should work', async () => {
            await expect(planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID))
                .to.be.emit(planManager, 'PlanCreated')
                .withArgs(1, indexer.address, DEPLOYMENT_ID, 0, etherParse('2'));

            // check plan
            expect(await planManager.nextPlanId()).to.equal(2);
            const plan = await planManager.getPlan(1);
            expect(plan.price).to.equal(etherParse('2'));
            expect(plan.active).to.equal(true);
            expect(plan.templateId).to.equal(0);
            expect(plan.deploymentId).to.equal(DEPLOYMENT_ID);
        });

        it('remove plan should work', async () => {
            // creaet plan
            await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
            // remove plan
            await expect(planManager.removePlan(1)).to.be.emit(planManager, 'PlanRemoved').withArgs(1);

            // check plan
            const plan = await planManager.getPlan(1);
            expect(plan.active).to.equal(false);
        });

        it('create plan with invalid params should fail', async () => {
            // price == 0
            await expect(planManager.createPlan(0, 0, DEPLOYMENT_ID)).to.be.revertedWith('PM005');
            // inactive plan template
            await planManager.updatePlanTemplateStatus(0, false);
            await expect(planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID)).to.be.revertedWith(
                'PM006'
            );

            // check overflow limit
            const limit = await planManager.limit();
            for (let i = 0; i < limit.toNumber(); i++) {
                await planManager.createPlan(100, 1, DEPLOYMENT_ID);
            }
            await expect(planManager.createPlan(100, 1, DEPLOYMENT_ID)).to.be.revertedWith(
                'PM007'
            );
        });

        it('remove plan with invalid params should fail', async () => {
            await expect(planManager.removePlan(0)).to.be.revertedWith('PM008');
        });
    });

    describe('Accept Plan', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, indexer, indexer, '2000');
            await token.transfer(consumer.address, etherParse('10'));
            await token.connect(consumer).increaseAllowance(planManager.address, etherParse('10'));
            // create query project
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, DEPLOYMENT_ID);
            // wallet_0 start project
            await queryRegistry.startIndexing(DEPLOYMENT_ID);
            await queryRegistry.updateIndexingStatusToReady(DEPLOYMENT_ID);
            // create plan template
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, METADATA_HASH);
            // default plan -> planId: 1
            await planManager.createPlan(etherParse('2'), 0, constants.ZERO_BYTES32); // plan id = 1;
        });

        const checkAcceptPlan = async (planId: number, deploymentId: string) => {
            const balance = await token.balanceOf(consumer.address);
            const plan = await planManager.getPlan(planId);
            const rewardsDistrBalance = await token.balanceOf(rewardsDistributor.address);
            await token.connect(consumer).increaseAllowance(serviceAgreementRegistry.address, plan.price);
            const tx = await planManager.connect(consumer).acceptPlan(planId, deploymentId);
            const agreementId = (
                await eventFrom(tx, serviceAgreementRegistry, 'ClosedAgreementCreated(address,address,bytes32,uint256)')
            ).serviceAgreementId;

            // check balances
            expect(await token.balanceOf(rewardsDistributor.address)).to.equal(rewardsDistrBalance.add(plan.price));
            expect(await token.balanceOf(consumer.address)).to.equal(balance.sub(plan.price));
            return agreementId;
        };

        it('accept plan with default plan should work', async () => {
            const agreementId = await checkAcceptPlan(1, DEPLOYMENT_ID);
            const agreement = await serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
            expect(agreement.lockedAmount).to.be.eq(etherParse('2'));
        });

        it('claim and distribute rewards by an indexer should work', async () => {
            await checkAcceptPlan(1, DEPLOYMENT_ID);

            expect((await rewardsDistributor.getRewardInfo(indexer.address)).accSQTPerStake).eq(0);
            const era = await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.connect(indexer).collectAndDistributeRewards(indexer.address);

            const rewardsAddTable = await rewardsHelper.getRewardsAddTable(indexer.address, era.sub(1), 5);
            const rewardsRemoveTable = await rewardsHelper.getRewardsRemoveTable(indexer.address, era.sub(1), 5);
            const [eraReward, totalReward] = rewardsAddTable.reduce(
                (acc, val, idx) => {
                    let [eraReward, total] = acc;
                    eraReward = eraReward.add(val.sub(rewardsRemoveTable[idx]));
                    return [eraReward, total.add(eraReward)];
                },
                [(await rewardsDistributor.getRewardInfo(indexer.address)).eraReward, BigNumber.from(0)]
            );

            expect(eraReward).to.be.eq(0);
            expect(totalReward).to.be.eq(etherParse('2'));
            expect((await rewardsDistributor.getRewardInfo(indexer.address)).accSQTPerStake).gt(0);
            expect(await rewardsDistributor.userRewards(indexer.address, indexer.address)).gt(0);
        });

        it('reward claim should work', async () => {
            await checkAcceptPlan(1, DEPLOYMENT_ID);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.connect(indexer).collectAndDistributeRewards(indexer.address);
            const balance = await token.balanceOf(indexer.address);
            const reward = await rewardsDistributor.userRewards(indexer.address, indexer.address);
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            expect(await token.balanceOf(indexer.address)).to.eq(balance.add(reward));
        });

        it('accept plan with specific deployment plan should work', async () => {
            const newDeployment = deploymentIds[1];

            // query not acitve should not work
            await token.connect(consumer).approve(serviceAgreementRegistry.address, etherParse('2'));
            await expect(planManager.connect(consumer).acceptPlan(1, newDeployment)).to.be.revertedWith(
                'SA005'
            );

            // update query status
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, newDeployment);
            await queryRegistry.startIndexing(newDeployment);
            await queryRegistry.updateIndexingStatusToReady(newDeployment);

            await checkAcceptPlan(1, newDeployment);
        });
    });
});
