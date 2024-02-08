// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import {
    EraManager,
    IndexerRegistry,
    PlanManager,
    ProjectRegistry,
    RewardsDistributor,
    RewardsHelper,
    ERC20,
    Staking,
    StakingManager,
} from '../src';
import { DEPLOYMENT_ID, METADATA_HASH } from './constants';
import { etherParse, startNewEra, time } from './helper';
import { deployContracts } from './setup';

describe.skip('Rewardflow tests', () => {
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

    const registerIndexer = async (rootWallet, wallet, amount, rate) => {
        await token.connect(rootWallet).transfer(wallet.address, amount);
        await token.connect(wallet).increaseAllowance(staking.address, amount);
        await indexerRegistry.connect(wallet).registerIndexer(amount, METADATA_HASH, rate, { gasLimit: '2000000' });
        // start indexing project
        await projectRegistry.connect(wallet).startService(DEPLOYMENT_ID);
        // create plan
        await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, token.address, METADATA_HASH);
        await planManager.createPlanTemplate(
            time.duration.days(10).toString(),
            1000,
            100,
            token.address,
            METADATA_HASH
        );
        await planManager.createPlanTemplate(
            time.duration.days(15).toString(),
            1000,
            100,
            token.address,
            METADATA_HASH
        );
        await planManager.connect(runner).createPlan(etherParse('10000'), 0, DEPLOYMENT_ID);
        await planManager.connect(runner).createPlan(etherParse('10000'), 1, DEPLOYMENT_ID);
        await planManager.connect(runner).createPlan(etherParse('10000'), 2, DEPLOYMENT_ID);
    };

    const collectRewards = async (indexer) => {
        await rewardsHelper.indexerCatchup(indexer.address);
        const currentEra = await eraManager.eraNumber();
        await rewardsDistributor.collectAndDistributeEraRewards(currentEra, indexer.address);
    };

    const delegate = async (delegator, amount) => {
        await stakingManager.connect(delegator).delegate(runner.address, amount);
    };

    const undelegate = async (delegator, amount) => {
        stakingManager.connect(delegator).undelegate(runner.address, amount);
    };

    const stake = async (amount) => {
        await stakingManager.connect(runner).stake(runner.address, amount);
    };

    const unstake = async (amount) => {
        await stakingManager.connect(runner).unstake(runner.address, amount);
    };

    const deployer = () => deployContracts(root, delegator2);
    before(async () => {
        [root, runner, consumer, delegator1, delegator2] = await ethers.getSigners();
    });
    describe('Rewardflow test', async () => {
        beforeEach(async () => {
            //contract deployed start at era 1
            const deployment = await waffle.loadFixture(deployer);
            indexerRegistry = deployment.indexerRegistry;
            projectRegistry = deployment.projectRegistry;
            planManager = deployment.planManager;
            staking = deployment.staking;
            stakingManager = deployment.stakingManager;
            token = deployment.token;
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
            await startNewEra(eraManager);

            await registerIndexer(root, runner, etherParse('1000'), 0);
        });

        it('Scenes 1', async () => {
            // purchase plan split in 1 era
            await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            //claim rewards
            await rewardsDistributor.userRewards(runner.address, runner.address);

            expect(token.balanceOf(runner.address)).to.be.equal(etherParse('10000'));
            expect(token.balanceOf(rewardsDistributor.address)).to.be.equal(etherParse('0'));
        });

        it('Scenes 2', async () => {
            // purchase plan split in 2 eras
            await planManager.connect(consumer).acceptPlan(2, DEPLOYMENT_ID);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            //claim rewards
            await rewardsDistributor.userRewards(runner.address, runner.address);

            expect(token.balanceOf(runner.address)).to.be.equal(etherParse('10000'));
            expect(token.balanceOf(rewardsDistributor.address)).to.be.equal(etherParse('0'));
        });

        it('Scenes 3', async () => {
            // purchase plan split in 3 eras
            await planManager.connect(consumer).acceptPlan(3, DEPLOYMENT_ID);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            //claim rewards
            await rewardsDistributor.userRewards(runner.address, runner.address);

            expect(token.balanceOf(runner.address)).to.be.equal(etherParse('10000'));
            expect(token.balanceOf(rewardsDistributor.address)).to.be.equal(etherParse('0'));
        });

        it('Scenes 4', async () => {
            // purchase plan split in 3 eras
            await planManager.connect(consumer).acceptPlan(3, DEPLOYMENT_ID);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await delegate(delegator1, etherParse('100'));

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            //claim rewards
            await rewardsDistributor.claimFrom(runner.address, runner.address);
            await rewardsDistributor.connect(delegator1).claimFrom(runner.address, delegator1.address);

            expect((await token.balanceOf(runner.address)).add(await token.balanceOf(delegator1.address))).to.be.equal(
                etherParse('10000')
            );
            expect(token.balanceOf(rewardsDistributor.address)).to.be.equal(etherParse('0'));
        });

        it('Scenes 5', async () => {
            await delegate(delegator2, etherParse('200'));

            // purchase plan split in 3 eras
            await planManager.connect(consumer).acceptPlan(3, DEPLOYMENT_ID);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await delegate(delegator1, etherParse('100'));

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            //claim rewards
            await rewardsDistributor.claimFrom(runner.address, runner.address);
            await rewardsDistributor.connect(delegator1).claimFrom(runner.address, delegator1.address);
            await rewardsDistributor.connect(delegator2).claimFrom(runner.address, delegator2.address);

            expect(
                (await token.balanceOf(runner.address))
                    .add(await token.balanceOf(delegator1.address))
                    .add(await token.balanceOf(delegator2.address))
            ).to.be.equal(etherParse('10000'));
            expect(token.balanceOf(rewardsDistributor.address)).to.be.equal(etherParse('0'));
        });

        it('Scenes 5', async () => {
            await delegate(delegator2, etherParse('200'));

            // purchase plan split in 3 eras
            await planManager.connect(consumer).acceptPlan(3, DEPLOYMENT_ID);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await delegate(delegator1, etherParse('100'));
            await undelegate(delegator1, etherParse('100'));

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            //claim rewards
            await rewardsDistributor.claimFrom(runner.address, runner.address);
            await rewardsDistributor.connect(delegator1).claimFrom(runner.address, delegator1.address);
            await rewardsDistributor.connect(delegator2).claimFrom(runner.address, delegator2.address);

            expect(
                (await token.balanceOf(runner.address))
                    .add(await token.balanceOf(delegator1.address))
                    .add(await token.balanceOf(delegator2.address))
            ).to.be.equal(etherParse('10000'));
            expect(token.balanceOf(rewardsDistributor.address)).to.be.equal(etherParse('0'));
        });

        it('Scenes 5', async () => {
            await delegate(delegator2, etherParse('200'));

            // purchase plan split in 3 eras
            await planManager.connect(consumer).acceptPlan(3, DEPLOYMENT_ID);

            await startNewEra(eraManager);
            await collectRewards(runner);

            await stake(etherParse('500'));

            await startNewEra(eraManager);
            await collectRewards(runner);

            await unstake(etherParse('100'));

            await delegate(delegator1, etherParse('100'));
            await undelegate(delegator1, etherParse('100'));

            await startNewEra(eraManager);
            await collectRewards(runner);

            await startNewEra(eraManager);
            await collectRewards(runner);

            //claim rewards
            await rewardsDistributor.claimFrom(runner.address, runner.address);
            await rewardsDistributor.connect(delegator1).claimFrom(runner.address, delegator1.address);
            await rewardsDistributor.connect(delegator2).claimFrom(runner.address, delegator2.address);

            expect(
                (await token.balanceOf(runner.address))
                    .add(await token.balanceOf(delegator1.address))
                    .add(await token.balanceOf(delegator2.address))
            ).to.be.equal(etherParse('10000'));
            expect(token.balanceOf(rewardsDistributor.address)).to.be.equal(etherParse('0'));
        });
    });
});
