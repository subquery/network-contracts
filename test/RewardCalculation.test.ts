// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {ethers, waffle} from 'hardhat';
import {
    EraManager,
    ERC20,
    IndexerRegistry,
    PlanManager,
    ProjectRegistry,
    RewardsDistributor,
    RewardsHelper,
    Staking,
    StakingManager,
} from '../src';
import {DEPLOYMENT_ID, METADATA_HASH, VERSION} from './constants';
import { etherParse, futureTimestamp, registerRunner, startNewEra, time } from './helper';
import {deployContracts} from './setup';

const BN = (value: string | number): BigNumber => BigNumber.from(value);

// FIXME: fix test accuracy running on github action
describe.skip('RewardsDistributor Contract', () => {
    const mockProvider = waffle.provider;
    let root, runner, consumer, delegator1, delegator2;

    let token: ERC20;
    let staking: Staking;
    let stakingManager: StakingManager;
    let projectRegistry: ProjectRegistry;
    let indexerRegistry: IndexerRegistry;
    let planManager: PlanManager;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributor;
    let rewardsHelper: RewardsHelper;

    const collectRewards = async () => {
        const currentEra = await eraManager.eraNumber();
        await rewardsDistributor.collectAndDistributeEraRewards(currentEra, runner.address);
    }

    const checkRewardInfo = async (_accSQTPerStake: BigNumber, _eraReward: BigNumber, _rewardDebt: BigNumber, delegator?: string) => {
        const {accSQTPerStake, eraReward} = await rewardsDistributor.getRewardInfo(runner.address);
        const rewardDebt = await rewardsDistributor.getRewardDebt(runner.address, delegator ?? runner.address);

        expect(eraReward).to.be.equal(_eraReward);
        expect(accSQTPerStake).to.be.equal(_accSQTPerStake);
        expect(rewardDebt).to.be.equal(_rewardDebt);

        return {accSQTPerStake, eraReward, rewardDebt};
    }

    const deployer = () => deployContracts(root, delegator2);
    before(async () => {
        [root, runner, consumer, delegator1, delegator2] = await ethers.getSigners();
    });

    describe('Agreement cross 2 era', async () => {

        beforeEach(async () => {
            const deployment = await waffle.loadFixture(deployer);
            indexerRegistry = deployment.indexerRegistry;
            projectRegistry = deployment.projectRegistry;
            planManager = deployment.planManager;
            staking = deployment.staking;
            stakingManager = deployment.stakingManager;
            rewardsDistributor = deployment.rewardsDistributor;
            rewardsHelper = deployment.rewardsHelper;
            eraManager = deployment.eraManager;

            // transfer SQT to accounts
            await token.connect(root).transfer(delegator1.address, etherParse('1000'));
            await token.connect(root).transfer(delegator2.address, etherParse('1000'));
            await token.connect(root).transfer(consumer.address, etherParse('10000'));
            await token.connect(consumer).increaseAllowance(planManager.address, etherParse('10000'));
            await token.connect(delegator1).increaseAllowance(staking.address, etherParse('1000'));
            await token.connect(delegator2).increaseAllowance(staking.address, etherParse('1000'));
            await token.connect(root).increaseAllowance(rewardsDistributor.address, etherParse('10000'));

            //setup era period be 7 days
            await eraManager.connect(root).updateEraPeriod(time.duration.days(7).toString());
            await startNewEra(mockProvider, eraManager);

            await registerRunner(token, indexerRegistry, staking, root, runner, etherParse('1000'), 0);
            await projectRegistry.createProject(METADATA_HASH, VERSION, DEPLOYMENT_ID, 0);
            // start indexing project
            await projectRegistry.connect(runner).startService(DEPLOYMENT_ID);
            // create plan
            await planManager.createPlanTemplate(time.duration.days(7).toString(), 1000, 100, token.address, METADATA_HASH);
            await planManager.connect(runner).createPlan(etherParse('10000'), 0, DEPLOYMENT_ID);
            // purchase plan
            await startNewEra(mockProvider, eraManager);
            await futureTimestamp(mockProvider, time.duration.days(2));
            await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);
        });

        it('should be able to distribute reward correctly without delegators', async () => {
            // total rewards for the agreement = 10000
            // total staking = 1000
            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            await checkRewardInfo(BN('0'), BN('0'), BN('0'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // accSQTPerStake = 10*10e-12, eraReward = 10000, rewardDebt = 0
            await checkRewardInfo(BN('9999983465608'), BN('9999983465608465608465'), BN('0'));

            let indexerRewards = await rewardsDistributor.userRewards(runner.address, runner.address);
            expect(indexerRewards).to.be.equal(BN('9999983465608000000000'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // FIXME: expect accSQTPerStake to be 10*10e-12, but it is 29*10e-12
            // expect eraReward = 10000, but is 20000
            // await checkRewardInfo(BN('29999933862433'), BN('19999950396825396825395'), BN('0'));

            // check after @neo fix
            await checkRewardInfo(BN('9999999999999'), BN('16534391534391535'), BN('0'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            await checkRewardInfo(BN('9999999999999'), BN('0'), BN('0'));

            // batch claim rewards
            indexerRewards = await rewardsDistributor.userRewards(runner.address, runner.address);
            expect(indexerRewards).to.be.equal(etherParse('9999.999999999'));

            await rewardsHelper.connect(runner).batchClaim(runner.address, [runner.address]);
            const indexerBalance = await token.balanceOf(runner.address);
            expect(indexerBalance).to.be.equal(etherParse('9999.999999999'));
            await checkRewardInfo(BN('9999999999999'), BN('0'), etherParse('9999.999999999'));

            // new agreement\
            await token.connect(root).transfer(consumer.address, etherParse('10000'));
            await token.connect(consumer).increaseAllowance(planManager.address, etherParse('10000'));
            await futureTimestamp(mockProvider, time.duration.days(2));
            await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            await checkRewardInfo(BN('9999999999999'), BN('0'), etherParse('9999.999999999'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            await checkRewardInfo(BN('19999917328041'), BN('9999917328042328042328'), etherParse('9999.999999999'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            await checkRewardInfo(BN('19999999999998'), BN('82671957671957672'), etherParse('9999.999999999'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            await checkRewardInfo(BN('19999999999998'), BN('0'), etherParse('9999.999999999'));

            indexerRewards = await rewardsDistributor.userRewards(runner.address, runner.address);
            expect(indexerRewards).to.be.equal(etherParse('9999.999999999'));
        });
    });

    describe.skip('Agreement cross more than 2 eras', async () => {
        beforeEach(async () => {
            //contract deployed start at era 1
            const deployment = await waffle.loadFixture(deployer);
            indexerRegistry = deployment.indexerRegistry;
            projectRegistry = deployment.projectRegistry;
            planManager = deployment.planManager;
            staking = deployment.staking;
            stakingManager = deployment.stakingManager;
            rewardsDistributor = deployment.rewardsDistributor;

            rewardsHelper = deployment.rewardsHelper;
            eraManager = deployment.eraManager;

            // transfer SQT to accounts
            await token.connect(root).transfer(delegator1.address, etherParse('1000'));
            await token.connect(root).transfer(delegator2.address, etherParse('1000'));
            await token.connect(root).transfer(consumer.address, etherParse('10000'));
            await token.connect(consumer).increaseAllowance(planManager.address, etherParse('10000'));
            await token.connect(delegator1).increaseAllowance(staking.address, etherParse('1000'));
            await token.connect(delegator2).increaseAllowance(staking.address, etherParse('1000'));
            await token.connect(root).increaseAllowance(rewardsDistributor.address, etherParse('10000'));

            //setup era period be 7 days
            await eraManager.connect(root).updateEraPeriod(time.duration.days(7).toString());

            await registerRunner(token, indexerRegistry, staking, root, runner, etherParse('1000'), 0);
            await projectRegistry.createProject(METADATA_HASH, VERSION, DEPLOYMENT_ID, 0);
            // start indexing project
            await projectRegistry.connect(runner).startService(DEPLOYMENT_ID);
            // create plan
            await planManager.createPlanTemplate(time.duration.days(35).toString(), 1000, 100, token.address, METADATA_HASH);
            await planManager.connect(runner).createPlan(etherParse('10000'), 0, DEPLOYMENT_ID);
            // purchase plan
            await startNewEra(mockProvider, eraManager);
            await futureTimestamp(mockProvider, time.duration.days(4));
            await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);
        });

        // FIXME: fix this test
        it.skip('should be able to distribute reward correctly without delegators', async () => {
            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // accSQTPerStake = 2*10e-12, eraReward = 2000, rewardDebt = 0
            await checkRewardInfo(BN('0'), BN('1999980158730158730158'), BN('0'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // accSQTPerStake = 4*10e-12, eraReward = 2000, rewardDebt = 0
            await checkRewardInfo(BN('3999980158730'), BN('2000000000000000000000'), BN('0'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // accSQTPerStake = 6*10e-12, eraReward = 2000, rewardDebt = 0
            await checkRewardInfo(BN('5999980158730'), BN('2000000000000000000000'), BN('0'));

            // batch claim rewards
            const indexerRewards = await rewardsDistributor.userRewards(runner.address, runner.address);
            await rewardsHelper.connect(runner).batchClaim(runner.address, [runner.address]);
            const indexerBalance = await token.balanceOf(runner.address);
            // claim rewards: `6000`
            expect(indexerRewards).to.be.equal(BN('5999980158730000000000'));
            expect(indexerBalance).to.be.equal(BN('580981000295794551145535'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // accSQTPerStake = 8*10e-12, eraReward = 2000, rewardDebt = 6000
            await checkRewardInfo(BN('7999980158730'), BN('2000000000000000000000'), BN('5999980158730000000000'));

            // indexer staking more
            await token.connect(root).transfer(runner.address, etherParse('1000'));
            await token.connect(runner).increaseAllowance(staking.address, etherParse('1000'));
            await stakingManager.connect(runner).stake(runner.address, etherParse('1000'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // accSQTPerStake = 10*10e-12, eraReward = 2000, rewardDebt = 6000
            const {
                accSQTPerStake,
                eraReward,
                rewardDebt
            } = await checkRewardInfo(BN('9999980158730'), BN('2000000000000000000000'), BN('5999980158730000000000'));
            console.log('accSQTPerStake:', accSQTPerStake.toString());
            console.log('eraReward:', eraReward.toString());
            console.log('rewardDebt:', rewardDebt.toString());
        });

        // FIXME:  fix this test
        it.skip('should be able to distribute reward correctly with delegators', async () => {
            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // accSQTPerStake = 2*10e-12, eraReward = 2000, rewardDebt = 0
            await checkRewardInfo(BN('1999980158730'), BN('1999980158730158730158'), BN('0'));

            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // accSQTPerStake = 4*10e-12, eraReward = 2000, rewardDebt = 0
            await checkRewardInfo(BN('3999980158730'), BN('2000000000000000000000'), BN('0'));

            let indexerBalance = await token.balanceOf(runner.address);
            expect(indexerBalance).to.be.equal(BN('0'));

            // batch claim rewards
            let indexerRewards = await rewardsDistributor.userRewards(runner.address, runner.address);
            await rewardsHelper.connect(runner).batchClaim(runner.address, [runner.address]);

            indexerBalance = await token.balanceOf(runner.address);
            expect(indexerBalance).to.be.equal(BN('3999980158730000000000'));

            // add delegator
            await token.connect(delegator1).increaseAllowance(staking.address, etherParse('1000'));
            await stakingManager.connect(delegator1).delegate(runner.address, etherParse('1000'));

            await startNewEra(mockProvider, eraManager);
            await rewardsHelper.indexerCatchup(runner.address);
            await collectRewards();
            // accSQTPerStake = 2*10e-12, eraReward = 2000, rewardDebt = 4000
            await checkRewardInfo(BN('5999980158730'), BN('2000000000000000000000'), BN('3999980158730000000000'), runner.address);
            await checkRewardInfo(BN('5999980158730'), BN('2000000000000000000000'), BN('5999980158730000000000'), delegator1.address);

            indexerRewards = await rewardsDistributor.userRewards(runner.address, runner.address);
            let delegatorRewards = await rewardsDistributor.userRewards(runner.address, delegator1.address);

            expect(indexerRewards).to.be.equal(BN('2000000000000000000000'));
            expect(delegatorRewards).to.be.equal(BN('0'));


            await startNewEra(mockProvider, eraManager);
            await collectRewards();
            // accSQTPerStake = 7*10e-12, eraReward = 2000, rewardDebt = 0
            await checkRewardInfo(BN('6999980158730'), BN('2000000000000000000000'), BN('3999980158730000000000'), runner.address);
            await checkRewardInfo(BN('6999980158730'), BN('2000000000000000000000'), BN('5999980158730000000000'), delegator1.address);

            indexerRewards = await rewardsDistributor.userRewards(runner.address, runner.address);
            delegatorRewards = await rewardsDistributor.userRewards(runner.address, delegator1.address);

            expect(indexerRewards).to.be.equal(BN('3000000000000000000000'));
            expect(delegatorRewards).to.be.equal(BN('1000000000000000000000'));

            // claim
            await rewardsDistributor.connect(runner).claimFrom(runner.address, runner.address);
            await rewardsDistributor.connect(delegator1).claimFrom(runner.address, delegator1.address);

            indexerBalance = await token.balanceOf(runner.address);
            expect(indexerBalance).to.be.equal(BN('6999980158730000000000'));

            const delegatorBalance = await token.balanceOf(delegator1.address);
            expect(delegatorBalance).to.be.equal(BN('1000000000000000000000'));
        });
    });
});
