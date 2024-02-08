// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { ethers, waffle } from 'hardhat';
import {
    EraManager,
    IndexerRegistry,
    PlanManager,
    PriceOracle,
    ProjectRegistry,
    RewardsDistributor,
    RewardsHelper,
    ERC20,
    ServiceAgreementRegistry,
    Staking,
} from '../src';
import { DEPLOYMENT_ID, METADATA_HASH, VERSION, deploymentIds, metadatas } from './constants';
import { Wallet, constants, deploySUSD, etherParse, eventFrom, registerRunner, revertrMsg, startNewEra, time } from './helper';
import { deployContracts } from './setup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('PlanManger Contract', () => {
    const mockProvider = waffle.provider;
    const planPrice = etherParse('6');

    let runner: Wallet, consumer: Wallet;

    let token: ERC20;
    let staking: Staking;
    let projectRegistry: ProjectRegistry;
    let indexerRegistry: IndexerRegistry;
    let planManager: PlanManager;
    let eraManager: EraManager;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let rewardsDistributor: RewardsDistributor;
    let rewardsHelper: RewardsHelper;
    let priceOracle: PriceOracle;
    let SUSD: Contract;

    const deployer = async () => {
        SUSD = await deploySUSD(consumer as SignerWithAddress);
        return deployContracts(runner, consumer);
    };
    before(async () => {
        [runner, consumer] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        indexerRegistry = deployment.indexerRegistry;
        projectRegistry = deployment.projectRegistry;
        planManager = deployment.planManager;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributor;
        rewardsHelper = deployment.rewardsHelper;
        eraManager = deployment.eraManager;
        priceOracle = deployment.priceOracle;
    });

    const indexerAndProjectReady = async () => {
        await registerRunner(token, indexerRegistry, staking, runner, runner, etherParse('2000'));
        await token.transfer(consumer.address, etherParse('100'));
        await token.connect(consumer).increaseAllowance(planManager.address, etherParse('100'));
        // create query project
        await projectRegistry.createProject(METADATA_HASH, VERSION, DEPLOYMENT_ID, 0);
        // wallet_0 start project
        await projectRegistry.startService(DEPLOYMENT_ID);
    };

    describe('Plan Manager Config', () => {
        it('set indexer plan limit should work', async () => {
            expect(await planManager.limit()).to.equal(5);
            await planManager.setPlanLimit(10);
            expect(await planManager.limit()).to.equal(10);
        });

        it('set indexer plan limit without owner should fail', async () => {
            await expect(planManager.connect(consumer).setPlanLimit(10)).to.be.revertedWith(
                revertrMsg.notOwner
            );
        });
    });

    describe('Plan Templates Management', () => {
        beforeEach(async () => {
            await planManager.createPlanTemplate(
                time.duration.days(3).toString(),
                1000,
                100,
                token.address,
                METADATA_HASH
            );
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
            const planTemplate = await planManager.getPlanTemplate(0);
            expect(planTemplate.metadata).to.equal(metadatas[1]);
        });

        it('plan management with invalid params should fail', async () => {
            // not owner
            await expect(
                planManager.connect(consumer).createPlanTemplate(1000, 1000, 100, token.address, METADATA_HASH)
            ).to.be.revertedWith(revertrMsg.notOwner);
            // not owner
            await expect(planManager.connect(consumer).updatePlanTemplateStatus(0, false)).to.be.revertedWith(
                revertrMsg.notOwner
            );
            await expect(planManager.connect(consumer).updatePlanTemplateMetadata(0, metadatas[1])).to.be.revertedWith(
                revertrMsg.notOwner
            );
            // invalid `planTemplateId`
            await expect(planManager.updatePlanTemplateStatus(1, false)).to.be.revertedWith('PM004');
            // invalid `planTemplateId`
            await expect(planManager.updatePlanTemplateMetadata(1, metadatas[1])).to.be.revertedWith('PM004');
            // invalid period
            await expect(planManager.createPlanTemplate(0, 1000, 100, token.address, METADATA_HASH)).to.be.revertedWith(
                'PM001'
            );
            // invalid daily request cap
            await expect(planManager.createPlanTemplate(1000, 0, 100, token.address, METADATA_HASH)).to.be.revertedWith(
                'PM002'
            );
            // invalid rate limit
            await expect(
                planManager.createPlanTemplate(1000, 1000, 0, token.address, METADATA_HASH)
            ).to.be.revertedWith('PM003');
        });
    });

    describe('Plan Management', () => {
        beforeEach(async () => {
            await registerRunner(token, indexerRegistry, staking, runner, runner, etherParse('2000'));
            await planManager.createPlanTemplate(
                time.duration.days(3).toString(),
                1000,
                100,
                token.address,
                METADATA_HASH
            ); // template_id = 0
            await planManager.createPlanTemplate(
                time.duration.days(3).toString(),
                100,
                10,
                token.address,
                METADATA_HASH
            ); // template_id = 1
        });

        it('create plan should work', async () => {
            await expect(planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID))
                .to.be.emit(planManager, 'PlanCreated')
                .withArgs(1, runner.address, DEPLOYMENT_ID, 0, etherParse('2'));

            // check plan
            expect(await planManager.nextPlanId()).to.equal(2);
            const plan = await planManager.getPlan(1);
            expect(plan.price).to.equal(etherParse('2'));
            expect(plan.active).to.equal(true);
            expect(plan.templateId).to.equal(0);
            expect(plan.deploymentId).to.equal(DEPLOYMENT_ID);
            expect(await planManager.getLimits(runner.address, DEPLOYMENT_ID)).to.equal(1);
        });

        it('remove plan should work', async () => {
            // creaet plan
            await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
            // remove plan
            await expect(planManager.removePlan(1)).to.be.emit(planManager, 'PlanRemoved').withArgs(1);
            // check plan
            const plan = await planManager.getPlan(1);
            expect(plan.active).to.equal(false);
            expect(await planManager.getLimits(runner.address, DEPLOYMENT_ID)).to.equal(0);
        });

        it('create plan with invalid params should fail', async () => {
            // price == 0
            await expect(planManager.createPlan(0, 0, DEPLOYMENT_ID)).to.be.revertedWith('PM005');
            // inactive plan template
            await planManager.updatePlanTemplateStatus(0, false);
            await expect(planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID)).to.be.revertedWith('PM006');
            // check overflow limit
            const limit = await planManager.limit();
            for (let i = 0; i < limit.toNumber(); i++) {
                await planManager.createPlan(100, 1, DEPLOYMENT_ID);
            }
            await expect(planManager.createPlan(100, 1, DEPLOYMENT_ID)).to.be.revertedWith('PM007');
            // can not create plan during maintenance mode
            await eraManager.enableMaintenance();
            await expect(planManager.createPlan(planPrice, 1, DEPLOYMENT_ID)).to.be.revertedWith('G019');
        });

        it('create plan with inactive planTemplate should fail', async () => {
            // inactive planTemplate
            await planManager.updatePlanTemplateStatus(0, false);
            await expect(planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID)).to.be.revertedWith('PM006');
        });

        it('remove plan with invalid params should fail', async () => {
            // invalid sender
            await expect(planManager.removePlan(0)).to.be.revertedWith('PM008');
            // can not remove plan during maintenance mode
            await eraManager.enableMaintenance();
            await expect(planManager.removePlan(1)).to.be.revertedWith('G019');
        });
    });

    describe('Accept Plan', () => {
        beforeEach(async () => {
            await indexerAndProjectReady();
            // create plan template
            await planManager.createPlanTemplate(
                time.duration.days(3).toString(),
                1000,
                100,
                token.address,
                METADATA_HASH
            );
            // default plan -> planId: 1
            await planManager.createPlan(planPrice, 0, constants.ZERO_BYTES32); // plan id = 1;
        });

        const checkAcceptPlan = async (planId: number, deploymentId: string) => {
            const balance = await token.balanceOf(consumer.address);
            const plan = await planManager.getPlan(planId);
            const rewardsDistrBalance = await token.balanceOf(rewardsDistributor.address);
            await token.connect(consumer).increaseAllowance(planManager.address, plan.price);
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
            await checkAcceptPlan(1, DEPLOYMENT_ID);
        });

        it('accept plan with specific deployment plan should work', async () => {
            // specific plan -> planId: 2
            await planManager.createPlan(planPrice, 0, DEPLOYMENT_ID);
            await checkAcceptPlan(2, DEPLOYMENT_ID);
        });

        it('accept plan with invalid params should fail', async () => {
            // inactive plan
            await expect(planManager.acceptPlan(2, DEPLOYMENT_ID)).to.be.revertedWith('PM009');
            // require no empty deployment_id for default plan
            await expect(planManager.acceptPlan(1, constants.ZERO_BYTES32)).to.be.revertedWith('PM011');
            // require same deployment_id with specific plan
            await planManager.createPlan(planPrice, 0, DEPLOYMENT_ID);
            await expect(planManager.acceptPlan(2, deploymentIds[1])).to.be.revertedWith('PM010');
            // require to use specific plan when indexer have both default plan and specific plan for the same deployment
            await expect(planManager.acceptPlan(1, DEPLOYMENT_ID)).to.be.revertedWith('PM012');
            // can not accept plan during maintenance mode
            await eraManager.enableMaintenance();
            await expect(planManager.acceptPlan(1, DEPLOYMENT_ID)).to.be.revertedWith('G019');
        });

        it('accept plan with inactive planTemplate should fail', async () => {
            // inactive planTemplate
            await planManager.updatePlanTemplateStatus(0, false);
            await expect(planManager.acceptPlan(1, DEPLOYMENT_ID)).to.be.revertedWith('PM006');
        });

        // it('threshold work for accept plan', async () => {
        //     // Preconditions
        //     const planDays = 3;
        //     const indexerStake = 2000;
        //     const planPrice = 6;
        //     let threshold = BigNumber.from(indexerStake / (planPrice / planDays))
        //         .mul(1e6).add(1)
        //     // ---
        //
        //     await saExtra.setThreshold(threshold);
        //     const plan = await planManager.getPlan(1);
        //     expect(Number(utils.formatEther(plan.price))).to.eq(6);
        //     await token.connect(consumer).increaseAllowance(planManager.address, plan.price);
        //     await expect(planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID)).to.be.revertedWith('SA006');
        //     const newStake = plan.price.div(planDays).div(1e6).toString();
        //     await token.connect(runner).increaseAllowance(staking.address, newStake);
        //     await stakingManager.connect(runner).stake(runner.address, newStake);
        //
        //     await expect(planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID)).to.revertedWith('SA006');
        //     const era = await startNewEra(eraManager);
        //     await expect(planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID)).not.to.reverted;
        // });
        //
        // it('threshold work for accept plan #2', async () => {
        //     // Preconditions
        //     const planDays = 3;
        //     const indexerStake = 2000;
        //     const planPrice = 6;
        //     let threshold = BigNumber.from(indexerStake / (planPrice / planDays))
        //         .mul(1e6).add(1)
        //     // ---
        //
        //     await saExtra.setThreshold(threshold)
        //     const plan = await planManager.getPlan(1);
        //     expect(Number(utils.formatEther(plan.price))).to.eq(6);
        //     await token.connect(consumer).increaseAllowance(planManager.address, plan.price);
        //     await expect(planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID)).to.be.revertedWith('SA006');
        //
        //     await saExtra.setThreshold(threshold.sub(1));
        //     await expect(planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID)).not.to.reverted;
        // });
        //
        // it('renew agreement skip threshold', async () => {
        //     // Preconditions
        //     const planDays = 3;
        //     const indexerStake = 2000;
        //     const planPrice = 6;
        //     let threshold = BigNumber.from(indexerStake / (planPrice / planDays))
        //         .mul(1e6)
        //     await saExtra.setThreshold(threshold);
        //     // ---
        //     const plan = await planManager.getPlan(1);
        //     expect(Number(utils.formatEther(plan.price))).to.eq(6);
        //     await token.connect(consumer).increaseAllowance(planManager.address, plan.price.mul(2));
        //     const tx = await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID)
        //     const agreementId = (
        //         await eventFrom(tx, serviceAgreementRegistry, 'ClosedAgreementCreated(address,address,bytes32,uint256)')
        //     ).serviceAgreementId;
        //     await expect(planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID)).to.be.revertedWith('SA006');
        //
        //     await token.connect(consumer).increaseAllowance(serviceAgreementRegistry.address, plan.price);
        //     await serviceAgreementRegistry.connect(consumer).renewAgreement(agreementId);
        //     const sum = await saExtra.sumDailyReward(runner.address);
        //     expect(Number(utils.formatEther(sum))).to.eq(planPrice / planDays * 2);
        // });

        // TODO: move the following 2 tests to rewardsDistributor.test.ts
        it.skip('claim and distribute rewards by an indexer should work', async () => {
            await checkAcceptPlan(1, DEPLOYMENT_ID);

            expect((await rewardsDistributor.getRewardInfo(runner.address)).accSQTPerStake).eq(0);
            const era = await startNewEra(eraManager);
            await rewardsDistributor.connect(runner).collectAndDistributeRewards(runner.address);

            const rewardsAddTable = await rewardsHelper.getRewardsAddTable(runner.address, era.sub(1), 5);
            const rewardsRemoveTable = await rewardsHelper.getRewardsRemoveTable(runner.address, era.sub(1), 5);
            const [eraReward, totalReward] = rewardsAddTable.reduce(
                (acc, val, idx) => {
                    let eraReward = acc[0];
                    const total = acc[1];
                    eraReward = eraReward.add(val.sub(rewardsRemoveTable[idx]));
                    return [eraReward, total.add(eraReward)];
                },
                [(await rewardsDistributor.getRewardInfo(runner.address)).eraReward, BigNumber.from(0)]
            );

            expect(eraReward).to.be.eq(0);
            expect(totalReward).to.be.eq(etherParse('2'));
            expect((await rewardsDistributor.getRewardInfo(runner.address)).accSQTPerStake).gt(0);
            expect(await rewardsDistributor.userRewards(runner.address, runner.address)).gt(0);
        });

        it('reward claim should work', async () => {
            await checkAcceptPlan(1, DEPLOYMENT_ID);
            await startNewEra(eraManager);
            await rewardsDistributor.connect(runner).collectAndDistributeRewards(runner.address);
            const balance = await token.balanceOf(runner.address);
            const reward = await rewardsDistributor.userRewards(runner.address, runner.address);
            await rewardsDistributor.connect(runner).claim(runner.address);
            expect(await token.balanceOf(runner.address)).to.eq(balance.add(reward));
        });
    });

    describe('Stable priced Plan', () => {
        beforeEach(async () => {
            await indexerAndProjectReady();
            //set oracle
            //1 USDC(ether) = 13 SQT(ether), <> 1 USDC = 13e12
            await priceOracle.setAssetPrice(SUSD.address, token.address, 1, 13e12);
            // create plan template
            await planManager.createPlanTemplate(
                time.duration.days(3).toString(),
                1000,
                100,
                SUSD.address,
                METADATA_HASH
            );
            // default plan -> planId: 1
            //price: 2.73 usdc
            await planManager.createPlan(BigNumber.from('2730000'), 0, constants.ZERO_BYTES32); // plan id = 1;
        });

        it('accept the plan with allowed stable price should work', async () => {
            // check balances before accept plan
            const balance = await token.balanceOf(consumer.address);
            const rewardsDistrBalance = await token.balanceOf(rewardsDistributor.address);
            // accept plan
            const plan = await planManager.getPlan(1);
            const planSqtPrice = BigNumber.from(13e12).mul(plan.price);
            await token.connect(consumer).increaseAllowance(serviceAgreementRegistry.address, planSqtPrice);
            const tx = await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);
            const agreementId = (
                await eventFrom(tx, serviceAgreementRegistry, 'ClosedAgreementCreated(address,address,bytes32,uint256)')
            ).serviceAgreementId;

            // check balances after accept plan
            expect(await token.balanceOf(rewardsDistributor.address)).to.equal(rewardsDistrBalance.add(planSqtPrice));
            expect(await token.balanceOf(consumer.address)).to.equal(balance.sub(planSqtPrice));
            const agreement = await serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
            expect(agreement.lockedAmount).to.be.eq(planSqtPrice);
        });
    });
});
