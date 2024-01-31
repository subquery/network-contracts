// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { EraManager, IndexerRegistry, RewardsDistributor, RewardsHelper, RewardsPool, ERC20, Staking } from '../src';
import { deploymentIds } from './constants';
import { etherParse, registerRunner, startNewEra, time, timeTravel } from './helper';
import { deployContracts } from './setup';

describe('RewardsPool Contract', () => {
    const deploymentId0 = deploymentIds[0];
    const deploymentId1 = deploymentIds[1];
    const deploymentId2 = deploymentIds[2];

    const mockProvider = waffle.provider;
    let root, runner0, runner1, runner2, delegator0, delegator1;

    let token: ERC20;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributor;
    let rewardsHelper: RewardsHelper;
    let rewardsPool: RewardsPool;

    const deployer = () => deployContracts(root, runner0);
    before(async () => {
        [root, runner0, runner1, runner2, delegator0, delegator1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributor;
        rewardsHelper = deployment.rewardsHelper;
        rewardsPool = deployment.rewardsPool;
        eraManager = deployment.eraManager;

        // Init indexer and delegator account.
        await token.connect(root).transfer(runner0.address, etherParse('10'));
        await token.connect(root).transfer(runner1.address, etherParse('10'));
        await token.connect(root).transfer(runner2.address, etherParse('10'));
        await token.connect(root).transfer(delegator0.address, etherParse('10'));
        await token.connect(root).transfer(delegator1.address, etherParse('10'));
        await token.connect(delegator0).increaseAllowance(staking.address, etherParse('10'));
        await token.connect(delegator1).increaseAllowance(staking.address, etherParse('10'));
        await token.connect(root).increaseAllowance(rewardsDistributor.address, etherParse('10'));
        await token.connect(root).increaseAllowance(rewardsPool.address, etherParse('100'));

        // Setup era period be 1 days.
        await eraManager.connect(root).updateEraPeriod(time.duration.days(1).toString());

        // Moved to era 2.
        await registerRunner(token, indexerRegistry, staking, root, root, etherParse('1000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner0, etherParse('1000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner1, etherParse('1000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner2, etherParse('1000'), 1e5);
    });

    describe('RewardsPool workflow', async () => {
        it('Directly rewards also will work correctly', async () => {
            const era = await eraManager.eraNumber();
            const indexerAmount0 = etherParse('1');
            const indexerAmount1 = etherParse('2');
            const indexerAmount2 = etherParse('3');
            await rewardsPool.connect(root).labor(deploymentId0, runner0.address, indexerAmount0);
            await rewardsPool.connect(root).labor(deploymentId0, runner1.address, indexerAmount1);
            await rewardsPool.connect(root).labor(deploymentId0, runner2.address, indexerAmount2);
            await rewardsPool.connect(root).labor(deploymentId1, runner0.address, indexerAmount0);
            await rewardsPool.connect(root).labor(deploymentId2, runner1.address, indexerAmount1);

            // Check the status.
            const rewards1 = await rewardsPool.getReward(deploymentId0, era, runner0.address);
            expect(rewards1[0]).to.be.eq(etherParse('1')); // labor
            expect(rewards1[1]).to.be.eq(etherParse('6')); // reward

            await timeTravel(mockProvider, time.duration.days(1).toNumber());

            // Start collect.
            await rewardsPool.collect(deploymentId0, runner0.address);
            // Check the status.
            const rewards2 = await rewardsPool.getReward(deploymentId0, era, runner0.address);
            expect(rewards2[0]).to.be.eq(0); // claimed
            expect(rewards2[1]).to.be.eq(etherParse('6')); // reward
            await expect(rewardsPool.collect(deploymentId0, runner0.address)).to.be.revertedWith('RP005');

            await rewardsPool.collect(deploymentId0, runner1.address);
            await rewardsPool.collect(deploymentId0, runner2.address);
            const rewards3 = await rewardsPool.getReward(deploymentId0, era, runner0.address);
            expect(rewards3[0]).to.be.eq(0); // claimed
            expect(rewards3[1]).to.be.eq(0); // deleted

            await rewardsPool.collect(deploymentId1, runner0.address);
            await rewardsPool.collect(deploymentId2, runner1.address);
            // Check the status.
            const rewards4 = await rewardsPool.getReward(deploymentId1, era, runner0.address);
            const rewards5 = await rewardsPool.getReward(deploymentId2, era, runner1.address);
            expect(rewards4[0]).to.be.eq(0); // claimed
            expect(rewards4[1]).to.be.eq(0); // deleted
            expect(rewards5[0]).to.be.eq(0); // claimed
            expect(rewards5[1]).to.be.eq(0); // deleted
        });

        it('Batch collect from RewardsDistributor', async () => {
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(runner0.address);
            const era = await eraManager.eraNumber();

            const indexerAmount0 = etherParse('1');
            const indexerAmount1 = etherParse('2');
            await rewardsPool.connect(root).labor(deploymentId0, runner0.address, indexerAmount0);
            await rewardsPool.connect(root).labor(deploymentId1, runner0.address, indexerAmount0);
            await rewardsPool.connect(root).labor(deploymentId0, runner1.address, indexerAmount1);

            // Check the status.
            const rewards1 = await rewardsPool.getReward(deploymentId0, era, runner0.address);
            expect(rewards1[0]).to.be.eq(etherParse('1')); // labor
            expect(rewards1[1]).to.be.eq(etherParse('3')); // reward

            await timeTravel(mockProvider, time.duration.days(1).toNumber());

            // Auto collect
            await rewardsDistributor.collectAndDistributeRewards(runner0.address);

            const rewards2 = await rewardsPool.getReward(deploymentId0, era, runner0.address);
            expect(rewards2[0]).to.be.eq(etherParse('0')); // already collected
            const isClaimed1 = await rewardsPool.isClaimed(era, runner0.address);
            expect(isClaimed1).to.be.eq(true);
            const isClaimed2 = await rewardsPool.isClaimed(era, runner1.address);
            expect(isClaimed2).to.be.eq(false);

            await rewardsPool.batchCollect(runner1.address);

            // Check the status.
            const rewards3 = await rewardsPool.getReward(deploymentId1, era, runner0.address);
            const rewards4 = await rewardsPool.getReward(deploymentId0, era, runner1.address);
            expect(rewards3[0]).to.be.eq(0); // claimed
            expect(rewards3[1]).to.be.eq(0); // deleted
            expect(rewards4[0]).to.be.eq(0); // claimed
            expect(rewards4[1]).to.be.eq(0); // deleted
        });

        it('Batch collect from RewardsHelper', async () => {
            const indexerAmount0 = etherParse('1');
            await rewardsPool.connect(root).labor(deploymentId0, runner0.address, indexerAmount0);
            await rewardsPool.connect(root).labor(deploymentId1, runner0.address, indexerAmount0);
            await timeTravel(mockProvider, time.duration.days(1).toNumber());
            await rewardsHelper.batchCollectWithPool(runner0.address, [deploymentId0, deploymentId1]);
        });
    });
});
