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
import {constants, registerIndexer, startNewEra, time, etherParse} from './helper';
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
            expect(await planManager.indexerPlanLimit()).to.equal(5);
            await planManager.setIndexerPlanLimit(10);
            expect(await planManager.indexerPlanLimit()).to.equal(10);
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
            expect(await planManager.planTemplateIds()).to.equal(2);
            const planTemplate = await planManager.planTemplates(1);
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
            let planTemplate = await planManager.planTemplates(0);
            expect(planTemplate.active).to.equal(false);

            await planManager.updatePlanTemplateStatus(0, true);
            planTemplate = await planManager.planTemplates(0);
            expect(planTemplate.active).to.equal(true);
        });

        it('update plan template metadata should work', async () => {
            await expect(planManager.updatePlanTemplateMetadata(0, metadatas[1]))
                .to.be.emit(planManager, 'PlanTemplateMetadataChanged')
                .withArgs(0, metadatas[1]);
            let planTemplate = await planManager.planTemplates(0);
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
                'Plan template not existing'
            );
            // invalid `planTemplateId`
            await expect(planManager.updatePlanTemplateMetadata(1, metadatas[1])).to.be.revertedWith(
                'Plan template not existing'
            );
            // invalid period
            await expect(planManager.createPlanTemplate(0, 1000, 100, METADATA_HASH)).to.be.revertedWith(
                'Period need to be positive'
            );
            // invalid daily request cap
            await expect(planManager.createPlanTemplate(1000, 0, 100, METADATA_HASH)).to.be.revertedWith(
                'DailyReqCap need to be positive'
            );
            // invalid rate limit
            await expect(planManager.createPlanTemplate(1000, 1000, 0, METADATA_HASH)).to.be.revertedWith(
                'RateLimit need to be positive'
            );
        });
    });

    describe('Plan Management', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, indexer, indexer, '2000');
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, METADATA_HASH);
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 100, 10, METADATA_HASH);
        });

        it('create plan should work', async () => {
            await expect(planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID))
                .to.be.emit(planManager, 'PlanCreated')
                .withArgs(indexer.address, DEPLOYMENT_ID, 0, 1, etherParse('2'));

            // check plan
            expect(await planManager.nextPlanId(indexer.address)).to.equal(1);
            const plan = await planManager.plans(indexer.address, 1);
            expect(plan.price).to.equal(etherParse('2'));
            expect(plan.active).to.equal(true);
            expect(plan.planTemplateId).to.equal(0);
            expect(plan.deploymentId).to.equal(DEPLOYMENT_ID);
            // check planIds
            expect(await planManager.planIds(indexer.address, DEPLOYMENT_ID, 0)).to.equal(1);

            // create second plan object
            await planManager.createPlan(100, 1, DEPLOYMENT_ID);
            expect(await planManager.planIds(indexer.address, DEPLOYMENT_ID, 1)).to.equal(2);
        });

        it('remove plan should work', async () => {
            // creaet plan
            await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
            // remove plan
            await expect(planManager.removePlan(1))
                .to.be.emit(planManager, 'PlanRemoved')
                .withArgs(indexer.address, 1, DEPLOYMENT_ID);

            // check plan
            expect(await planManager.nextPlanId(indexer.address)).to.equal(1);
            const plan = await planManager.plans(indexer.address, 1);
            expect(plan.active).to.equal(false);
        });

        it('Plan Id shoud auto increment', async () => {
            // creaet plan
            await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
            await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
            await planManager.removePlan(2);
            await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
            expect(await planManager.nextPlanId(indexer.address)).to.equal(3);
        });

        it('create plan with invalid params should fail', async () => {
            // price == 0
            await expect(planManager.createPlan(0, 0, DEPLOYMENT_ID)).to.be.revertedWith('Price need to be positive');
            // inactive plan template
            await planManager.updatePlanTemplateStatus(0, false);
            await expect(planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID)).to.be.revertedWith(
                'Inactive plan template'
            );
            // reach plan limitation
            for (let i = 0; i < 5; i++) {
                await planManager.createPlan(etherParse('1'), 1, DEPLOYMENT_ID);
            }
            await expect(planManager.createPlan(100, 1, DEPLOYMENT_ID)).to.be.revertedWith(
                'Indexer plan limitation reached'
            );
        });

        it('remove plan with invalid params should fail', async () => {
            await expect(planManager.removePlan(0)).to.be.revertedWith('Inactive plan can not be removed');
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
            // default plan -> planId: 0
            await planManager.createPlan(etherParse('2'), 0, constants.ZERO_BYTES32);
        });

        const checkAcceptPlan = async (planId: number) => {
            const balance = await token.balanceOf(consumer.address);
            const plan = await planManager.plans(indexer.address, planId);
            const rewardsDistrBalance = await token.balanceOf(rewardsDistributor.address);
            await token.connect(consumer).increaseAllowance(serviceAgreementRegistry.address, plan.price);
            const tx = await planManager.connect(consumer).acceptPlan(indexer.address, DEPLOYMENT_ID, planId);
            const receipt = await tx.wait();
            const evt = receipt.events.find(
                (log) => log.topics[0] === utils.id('ClosedAgreementCreated(address,address,bytes32,uint256)')
            );
            const agreementId = serviceAgreementRegistry.interface.decodeEventLog(
                serviceAgreementRegistry.interface.getEvent('ClosedAgreementCreated'),
                evt.data
            ).serviceAgreementId;

            // check balances
            expect(await token.balanceOf(rewardsDistributor.address)).to.equal(rewardsDistrBalance.add(plan.price));
            expect(await token.balanceOf(consumer.address)).to.equal(balance.sub(plan.price));
            return agreementId;
        };

        it('accept plan with default plan should work', async () => {
            const agreementId = await checkAcceptPlan(1);
            const agreement = await serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
            expect(agreement.lockedAmount).to.be.eq(etherParse('2'));
        });

        it('claim and distribute rewards by an indexer should work', async () => {
            await checkAcceptPlan(1);

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
            await checkAcceptPlan(1);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.connect(indexer).collectAndDistributeRewards(indexer.address);
            const balance = await token.balanceOf(indexer.address);
            const reward = await rewardsDistributor.userRewards(indexer.address, indexer.address);
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            expect(await token.balanceOf(indexer.address)).to.eq(balance.add(reward));
        });

        it('accept plan with specific deployment plan should work', async () => {
            // plan for specific deploymentId -> planId: 2
            await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
            await checkAcceptPlan(2);
        });

        it('accept plan with invalid params should fail', async () => {
            // indexing service unavailable
            await planManager.connect(consumer).createPlan(etherParse('2'), 0, DEPLOYMENT_ID);

            // approve token to serviceAgreementRegistry
            await token.connect(consumer).approve(serviceAgreementRegistry.address, etherParse('2'));

            await expect(
                planManager.connect(consumer).acceptPlan(consumer.address, DEPLOYMENT_ID, 1)
            ).to.be.revertedWith('Indexing service is not available');
            // inactive plan
            await expect(
                planManager.connect(consumer).acceptPlan(indexer.address, DEPLOYMENT_ID, 2)
            ).to.be.revertedWith('Inactive plan');
            // empty deploymentId
            await expect(
                planManager.connect(consumer).acceptPlan(indexer.address, constants.ZERO_BYTES32, 1)
            ).to.be.revertedWith('DeploymentId can not be empty');
            // plan not match
            await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
            await expect(
                planManager.connect(consumer).acceptPlan(indexer.address, deploymentIds[1], 2)
            ).to.be.revertedWith('Plan not match with the deployment');
            //  default plan can not override
            await expect(
                planManager.connect(consumer).acceptPlan(indexer.address, DEPLOYMENT_ID, 1)
            ).to.be.revertedWith('Plan not match with the deployment');
        });
    });
});
