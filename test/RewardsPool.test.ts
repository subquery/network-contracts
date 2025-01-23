// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { EraManager, ERC20, IndexerRegistry, RewardsDistributor, RewardsHelper, RewardsPool, Staking } from '../src';
import { deploymentIds } from './constants';
import { etherParse, eventFrom, eventsFrom, registerRunner, startNewEra, time, timeTravel } from './helper';
import { deployContracts } from './setup';
import { ethers, waffle } from 'hardhat';

describe('RewardsPool Contract', () => {
    const deploymentId0 = deploymentIds[0];
    const deploymentId1 = deploymentIds[1];
    const deploymentId2 = deploymentIds[2];

    let root,
        runner0,
        runner1,
        runner2,
        runner3,
        runner4,
        runner5,
        runner6,
        runner7,
        runner8,
        runner9,
        delegator0,
        delegator1;
    let runners;
    let token: ERC20;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributor;
    let rewardsHelper: RewardsHelper;
    let rewardsPool: RewardsPool;

    const deployer = () => deployContracts(root, runner0);
    before(async () => {
        [
            root,
            delegator0,
            delegator1,
            runner0,
            runner1,
            runner2,
            runner3,
            runner4,
            runner5,
            runner6,
            runner7,
            runner8,
            runner9,
        ] = await ethers.getSigners();
        runners = [runner0, runner1, runner2, runner3, runner4, runner5, runner6, runner7, runner8, runner9];
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
        // await token.connect(root).transfer(runner0.address, etherParse('10'));
        // await token.connect(root).transfer(runner1.address, etherParse('10'));
        // await token.connect(root).transfer(runner2.address, etherParse('10'));
        await token.connect(root).transfer(delegator0.address, etherParse('10'));
        await token.connect(root).transfer(delegator1.address, etherParse('10'));
        await token.connect(delegator0).increaseAllowance(staking.address, etherParse('10'));
        await token.connect(delegator1).increaseAllowance(staking.address, etherParse('10'));
        await token.connect(root).increaseAllowance(rewardsDistributor.address, etherParse('10'));
        await token.connect(root).increaseAllowance(rewardsPool.address, etherParse('1000000000'));

        // Setup era period be 1 days.
        await eraManager.connect(root).updateEraPeriod(time.duration.days(1).toString());

        // Moved to era 2.
        await registerRunner(token, indexerRegistry, staking, root, root, etherParse('1000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner0, etherParse('100000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner1, etherParse('1000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner2, etherParse('1000'), 1e5);
    });

    it.skip('output result', function () {
        const metrix = {
            alpha: [
                // [1, 10],
                [1, 3],
                [7, 10],
                [8, 10],
                [9, 10],
            ],
            alphaText: [
                // '1/10',
                '0.33',
                '0.7',
                '0.8',
                '0.9',
            ],
            operatorStakes: [
                // [etherParse('200000'), etherParse('200000')], // 1:1
                // [etherParse('200000'), etherParse('800000')], // 1:4
                // [etherParse('200000'), etherParse('2000000')], // 1:10
                // [etherParse('200000'), etherParse('20000000')], // 1:100
                // [etherParse('200000'), etherParse('200000000')], // 1:1000
                // 1:1:1:1:1:1:1:1:1:1
                [
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                ],
                // 1:2:3:4:5:6:7:8:9:10
                [
                    etherParse('100000'),
                    etherParse('200000'),
                    etherParse('300000'),
                    etherParse('400000'),
                    etherParse('500000'),
                    etherParse('600000'),
                    etherParse('700000'),
                    etherParse('800000'),
                    etherParse('900000'),
                    etherParse('1000000'),
                ],
                // 1:1:1:1:1:1:1:1:1:10
                [
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('2000000'),
                ],
                // 1:2:3:4:5:6:7:8:9:100
                [
                    etherParse('100000'),
                    etherParse('200000'),
                    etherParse('300000'),
                    etherParse('400000'),
                    etherParse('500000'),
                    etherParse('600000'),
                    etherParse('700000'),
                    etherParse('800000'),
                    etherParse('900000'),
                    etherParse('10000000'),
                ],
                // 1:1:1:1:1:1:1:1:1:100
                [
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('20000000'),
                ],
                // 1:2:3:4:5:6:7:8:100:1000
                [
                    etherParse('100000'),
                    etherParse('200000'),
                    etherParse('300000'),
                    etherParse('400000'),
                    etherParse('500000'),
                    etherParse('600000'),
                    etherParse('700000'),
                    etherParse('800000'),
                    etherParse('10000000'),
                    etherParse('100000000'),
                ],
            ],
            operatorStakesText: [
                '1:1:1:1:1:1:1:1:1:1',
                '1:2:3:4:5:6:7:8:9:10',
                '1:1:1:1:1:1:1:1:1:10',
                '1:2:3:4:5:6:7:8:9:100',
                '1:1:1:1:1:1:1:1:1:100',
                '1:2:3:4:5:6:7:8:100:1000',
            ],
            labors: [
                // [etherParse('2000'), etherParse('2000')], // 1:1
                // [etherParse('2000'), etherParse('6000')], // 1:3
                // [etherParse('1000'), etherParse('20000')], // 1:20
                // [etherParse('1000'), etherParse('1000000')], // 1:1000
                // 1:1:1:1:1:1:1:1:1:1
                [
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                ],
                // 1:2:3:4:5:6:7:8:9:10
                [
                    etherParse('100000'),
                    etherParse('200000'),
                    etherParse('300000'),
                    etherParse('400000'),
                    etherParse('500000'),
                    etherParse('600000'),
                    etherParse('700000'),
                    etherParse('800000'),
                    etherParse('900000'),
                    etherParse('1000000'),
                ],
                // 1:1:1:1:1:1:1:1:1:10
                [
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('2000000'),
                ],
                // 10:9:8:7:6:5:4:3:2:1
                [
                    etherParse('1000000'),
                    etherParse('900000'),
                    etherParse('800000'),
                    etherParse('700000'),
                    etherParse('600000'),
                    etherParse('500000'),
                    etherParse('400000'),
                    etherParse('300000'),
                    etherParse('200000'),
                    etherParse('100000'),
                ],
                // 10:1:1:1:1:1:1:1:1:1
                [
                    etherParse('2000000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                    etherParse('200000'),
                ],
            ],
            laborText: [
                '1:1:1:1:1:1:1:1:1:1',
                '1:2:3:4:5:6:7:8:9:10',
                '1:1:1:1:1:1:1:1:1:10',
                '10:9:8:7:6:5:4:3:2:1',
                '10:1:1:1:1:1:1:1:1:1',
            ],
        };
        // alpha,total stake ratio,labor(unadjusted reward) ratio,rewards adjustment - A,rewards adjustment - B,total rewards loss
        const results = [];

        for (const [alphaIdx, alpha] of metrix.alpha.entries()) {
            for (const [stakeIdx, runnerStakes] of metrix.operatorStakes.entries()) {
                for (const [laborIdx, labors] of metrix.labors.entries()) {
                    it(`Reward pool adjustment loss with alphaId ${alphaIdx} and operatorStakesId ${stakeIdx} and laborsId ${laborIdx}`, async () => {
                        await rewardsPool.setAlpha(alpha[0], alpha[1]);
                        for (const [runnerIdx, runnerStake] of runnerStakes.entries()) {
                            await registerRunner(
                                token,
                                indexerRegistry,
                                staking,
                                root,
                                runners[runnerIdx],
                                runnerStake,
                                1e5
                            );
                        }
                        await startNewEra(eraManager);
                        for (const [runnerIdx, runnerLabor] of labors.entries()) {
                            await rewardsDistributor.collectAndDistributeRewards(runners[runnerIdx].address);
                        }

                        const era = await eraManager.eraNumber();

                        for (const [runnerIdx, labor] of labors.entries()) {
                            await rewardsPool.connect(root).labor(deploymentId0, runners[runnerIdx].address, labor);
                        }

                        // Check the status.
                        const [, totalLabor] = await rewardsPool.getReward(deploymentId0, era, runner0.address);

                        await timeTravel(time.duration.days(1).toNumber());

                        let tx;
                        const runnerRewards = [];
                        for (const [runnerIdx, runnerLabor] of labors.entries()) {
                            tx = await rewardsPool.collect(deploymentId0, runners[runnerIdx].address);
                            const { amount } = await eventFrom(
                                tx,
                                rewardsPool,
                                'Collect(bytes32,address,uint256,uint256)'
                            );
                            runnerRewards[runnerIdx] = amount;
                        }
                        const totalReward = runnerRewards.reduce((acc, cur) => acc.add(cur), BigNumber.from(0));
                        const totalRewardDiff = totalReward.sub(totalLabor);

                        console.log(`totalLabor: ${utils.formatEther(totalLabor)}`);
                        console.log(`totalRewardDiff: ${utils.formatEther(totalRewardDiff)}`);
                        // console.log(`runner0RewardDiff: ${utils.formatEther(runner0RewardDiff)}`);
                        // console.log(`runner1RewardDiff: ${utils.formatEther(runner1RewardDiff)}`);
                        results.push([
                            metrix.alphaText[alphaIdx],
                            metrix.operatorStakesText[stakeIdx],
                            metrix.laborText[laborIdx],
                            runnerRewards[0].sub(labors[0]).mul(1000).div(labors[0]).toNumber() / 1000,
                            runnerRewards[1].sub(labors[1]).mul(1000).div(labors[1]).toNumber() / 1000,
                            runnerRewards[2].sub(labors[2]).mul(1000).div(labors[2]).toNumber() / 1000,
                            runnerRewards[3].sub(labors[3]).mul(1000).div(labors[3]).toNumber() / 1000,
                            runnerRewards[4].sub(labors[4]).mul(1000).div(labors[4]).toNumber() / 1000,
                            runnerRewards[5].sub(labors[5]).mul(1000).div(labors[5]).toNumber() / 1000,
                            runnerRewards[6].sub(labors[6]).mul(1000).div(labors[6]).toNumber() / 1000,
                            runnerRewards[7].sub(labors[7]).mul(1000).div(labors[7]).toNumber() / 1000,
                            runnerRewards[8].sub(labors[8]).mul(1000).div(labors[8]).toNumber() / 1000,
                            runnerRewards[9].sub(labors[9]).mul(1000).div(labors[9]).toNumber() / 1000,
                            totalRewardDiff.mul(1000).div(totalLabor).toNumber() / 1000,
                        ]);
                    });
                }
            }
        }

        results.forEach((result) => {
            console.log(result.join(','));
        });
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

            await timeTravel(time.duration.days(1).toNumber());

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
            await rewardsPool.setAlpha(9, 10);
            await startNewEra(eraManager);
            await rewardsDistributor.collectAndDistributeRewards(runner0.address);
            await rewardsDistributor.collectAndDistributeRewards(runner1.address);
            const era = await eraManager.eraNumber();

            const indexerAmount0 = etherParse('1');
            const indexerAmount1 = etherParse('2');
            await rewardsPool.connect(root).labor(deploymentId0, runner0.address, indexerAmount0);
            // await rewardsPool.connect(root).labor(deploymentId1, runner0.address, indexerAmount0);
            await rewardsPool.connect(root).labor(deploymentId0, runner1.address, indexerAmount1);

            // Check the status.
            const rewards1 = await rewardsPool.getReward(deploymentId0, era, runner0.address);
            // expect(rewards1[0]).to.be.eq(etherParse('1')); // labor
            // expect(rewards1[1]).to.be.eq(etherParse('3')); // reward
            const rewards1_1 = await rewardsPool.getReward(deploymentId0, era, runner1.address);

            await timeTravel(time.duration.days(1).toNumber());

            // Auto collect
            const tx = await rewardsDistributor.collectAndDistributeRewards(runner0.address);
            const evts = await eventsFrom(tx, rewardsDistributor, 'DistributeRewards(address,uint256,uint256,uint256)');
            // const tx2 = await rewardsDistributor.collectAndDistributeRewards(runner1.address);
            // const evts2 = await eventsFrom(
            //     tx2,
            //     rewardsDistributor,
            //     'DistributeRewards(address,uint256,uint256,uint256)'
            // );
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
            await timeTravel(time.duration.days(1).toNumber());
            await rewardsHelper.batchCollectWithPool(runner0.address, [deploymentId0, deploymentId1]);
        });
    });
});
