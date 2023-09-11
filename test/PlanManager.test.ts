// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers, waffle } from 'hardhat';
import {
    EraManager,
    IndexerRegistry,
    PlanManager,
    PriceOracle,
    QueryRegistry,
    RewardsDistributer,
    RewardsHelper,
    SQToken,
    ServiceAgreementRegistry,
    Staking,
} from '../src';
import { DEPLOYMENT_ID, METADATA_HASH, VERSION, deploymentIds, metadatas } from './constants';
import { Wallet, constants, etherParse, eventFrom, registerIndexer, startNewEra, time } from './helper';
import { deployContracts } from './setup';

describe('PlanManger Contract', () => {
    const mockProvider = waffle.provider;
    const planPrice = etherParse('2');

    let indexer: Wallet, consumer: Wallet;

    let token: SQToken;
    let staking: Staking;
    let queryRegistry: QueryRegistry;
    let indexerRegistry: IndexerRegistry;
    let planManager: PlanManager;
    let eraManager: EraManager;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let rewardsDistributor: RewardsDistributer;
    let rewardsHelper: RewardsHelper;
    let priceOracle: PriceOracle;
    let usdc = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

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
        priceOracle = deployment.priceOracle;
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
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, token.address, METADATA_HASH);
        });

        it('create plan template should work', async () => {
            await expect(planManager.createPlanTemplate(100, 100, 10, token.address, METADATA_HASH))
                .to.be.emit(planManager, 'PlanTemplateCreated')
                .withArgs(1);
            expect(await planManager.nextTemplateId()).to.equal(2);
            const planTemplate = await planManager.getPlanTemplate(1);

            expect(planTemplate.period).to.equal(100);
            expect(planTemplate.dailyReqCap).to.equal(100);
            expect(planTemplate.rateLimit).to.equal(10);
            expect(planTemplate.metadata).to.equal(METADATA_HASH);
            expect(planTemplate.active).to.equal(true);
            expect(planTemplate.priceToken).to.equal(token.address);
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
                planManager.connect(consumer).createPlanTemplate(1000, 1000, 100, token.address, METADATA_HASH)
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
            await expect(planManager.createPlanTemplate(0, 1000, 100, token.address, METADATA_HASH)).to.be.revertedWith(
                'PM001'
            );
            // invalid daily request cap
            await expect(planManager.createPlanTemplate(1000, 0, 100, token.address, METADATA_HASH)).to.be.revertedWith(
                'PM002'
            );
            // invalid rate limit
            await expect(planManager.createPlanTemplate(1000, 1000, 0, token.address, METADATA_HASH)).to.be.revertedWith(
                'PM003'
            );
        });
    });

    describe('Plan Management', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, indexer, indexer, '2000');
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, token.address, METADATA_HASH); // template_id = 0
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 100, 10, token.address, METADATA_HASH); // template_id = 1
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
            expect(await planManager.getLimits(indexer.address, DEPLOYMENT_ID)).to.equal(1);
        });

        it('remove plan should work', async () => {
            // creaet plan
            await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
            // remove plan
            await expect(planManager.removePlan(1)).to.be.emit(planManager, 'PlanRemoved').withArgs(1);
            // check plan
            const plan = await planManager.getPlan(1);
            expect(plan.active).to.equal(false);
            expect(await planManager.getLimits(indexer.address, DEPLOYMENT_ID)).to.equal(0);
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
            // can not create plan during maintenance mode
            await eraManager.enableMaintenance();
            await expect(planManager.createPlan(planPrice, 1, DEPLOYMENT_ID)).to.be.revertedWith(
                'G019'
            );
        });

        it('remove plan with invalid params should fail', async () => {
            // invalid sender
            await expect(planManager.removePlan(0)).to.be.revertedWith('PM008');
            // can not remove plan during maintenance mode
            await eraManager.enableMaintenance();
            await expect(planManager.removePlan(1)).to.be.revertedWith(
                'G019'
            );
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
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, token.address, METADATA_HASH);
            // default plan -> planId: 1
            await planManager.createPlan(planPrice, 0, constants.ZERO_BYTES32); // plan id = 1;
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

            const agreement = await serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
            expect(agreement.lockedAmount).to.be.eq(planPrice);
        };

        it('accept plan with default plan should work', async () => {
            await token.connect(consumer).approve(serviceAgreementRegistry.address, planPrice);
            await planManager.acceptPlan(1, DEPLOYMENT_ID);
            await checkAcceptPlan(1, deploymentIds[1]);
        });

        it('accept plan with specific deployment plan should work', async () => {
            // specific plan -> planId: 2
            await planManager.createPlan(planPrice, 0, DEPLOYMENT_ID);
            await token.connect(consumer).approve(serviceAgreementRegistry.address, planPrice);
            await checkAcceptPlan(2, DEPLOYMENT_ID);
        });

        it('accept plan with invalid params should fail', async () => {
            // inactive plan
            await expect(planManager.acceptPlan(2, DEPLOYMENT_ID)).to.be.revertedWith(
                'PM009'
            );
            // require same deployment_id with specific plan
            await expect(planManager.acceptPlan(1, deploymentIds[1])).to.be.revertedWith(
                'PM010'
            );
            // require to use specific plan
            await planManager.createPlan(planPrice, 0, DEPLOYMENT_ID);
            await expect(planManager.acceptPlan(1, constants.DEPLOYMENT_ID)).to.be.revertedWith(
                'PM012'
            );
            // require no empty deployment_id for default plan
            await expect(planManager.acceptPlan(2, constants.ZERO_BYTES32)).to.be.revertedWith(
                'PM011'
            );
            // can not accept plan during maintenance mode
            await eraManager.enableMaintenance();
            await expect(planManager.acceptPlan(1, DEPLOYMENT_ID)).to.be.revertedWith(
                'G019'
            );
        });

        // TODO: move the following 2 tests to rewardsDistributor.test.ts
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
    });

    describe('Stable priced Plan', () => {
        beforeEach(async () => {
            await registerIndexer(token, indexerRegistry, staking, indexer, indexer, '2000');
            await token.transfer(consumer.address, etherParse('100'));
            await token.connect(consumer).increaseAllowance(planManager.address, etherParse('100'));
            // create query project
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, DEPLOYMENT_ID);
            // wallet_0 start project
            await queryRegistry.startIndexing(DEPLOYMENT_ID);
            await queryRegistry.updateIndexingStatusToReady(DEPLOYMENT_ID);

            //set oracle
            //1 USDC(ether) = 13 SQT(ether), <> 1 USDC = 13e12
            await priceOracle.setAssetPrice(usdc, token.address, 1, 13e12);
            // create plan template
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, token.address, METADATA_HASH);
            // default plan -> planId: 1
            //price: 2.73 usdc
            await planManager.createPlan(BigNumber.from("2730000"), 0, constants.ZERO_BYTES32); // plan id = 1;
        });

        it('create a plan with allowed stable price should work', async () => {
            await planManager.createPlan(BigNumber.from("2730000"), 0, constants.ZERO_BYTES32);
            // FIXME:
            // expect(await planManager.pricedToken(2)).to.eq(usdc);
        });

        it('accept the plan with allowed stable price should work', async () => {
            const balance = await token.balanceOf(consumer.address);
            const rewardsDistrBalance = await token.balanceOf(rewardsDistributor.address);
            // FIXME:
            // let price = await planManager.getPrice(1);
            // expect(price).to.equal(etherParse("35.49"));
            // await token.connect(consumer).increaseAllowance(serviceAgreementRegistry.address, price);
            // await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);

            // // check balances
            // expect(await token.balanceOf(rewardsDistributor.address)).to.equal(rewardsDistrBalance.add(price));
            // expect(await token.balanceOf(consumer.address)).to.equal(balance.sub(price));
        });
    });
});
