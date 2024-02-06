// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { deployContracts } from './setup';
import {
    EraManager,
    ERC20,
    IndexerRegistry,
    ProjectRegistry,
    ProjectType,
    RewardsBooster,
    Staking,
    StakingAllocation,
    StateChannel,
    StakingManager,
    RewardsDistributor,
    RewardsStaking,
} from '../src';
import { deploymentIds, deploymentMetadatas, projectMetadatas } from './constants';
import {
    blockTravel,
    boosterDeployment,
    createProject,
    etherParse,
    eventFrom,
    openChannel,
    registerRunner,
    time,
    wrapTxs,
    startNewEra,
    timeTravel,
    revertrMsg,
} from './helper';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, constants } from 'ethers';

const PER_MILL = BigNumber.from(1e6);

describe('RewardsBooster Contract', () => {
    const deploymentId0 = deploymentIds[0];
    const deploymentId1 = deploymentIds[1];
    const deploymentId2 = deploymentIds[2];
    const deploymentId3 = deploymentIds[3];
    const defaultChannelId = ethers.utils.randomBytes(32);

    const mockProvider = waffle.provider;
    let root: SignerWithAddress,
        runner0: SignerWithAddress,
        runner1: SignerWithAddress,
        runner2: SignerWithAddress,
        consumer0: SignerWithAddress,
        consumer1: SignerWithAddress;

    let token: ERC20;
    let staking: Staking;
    let stakingManager: StakingManager;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsBooster: RewardsBooster;
    let rewardsStaking: RewardsStaking;
    let rewardsDistributor: RewardsDistributor;
    let stakingAllocation: StakingAllocation;
    let projectRegistry: ProjectRegistry;
    let stateChannel: StateChannel;

    const getAllocationReward = (deploymentReward: BigNumber, queryRewardRatePerMill: BigNumber): BigNumber => {
        return deploymentReward.mul(PER_MILL.sub(queryRewardRatePerMill)).div(PER_MILL);
    };

    const getQueryReward = (deploymentReward: BigNumber, queryRewardRatePerMill: BigNumber): BigNumber => {
        return deploymentReward.mul(queryRewardRatePerMill).div(PER_MILL);
    };

    // const getStats = async () => {
    //     const [
    //         accRewardsPerBoosterLastBlockUpdated,
    //         accRewardsPerBooster,
    //         newRewardsPerBooster,
    //         accQueryRewardsPerBoosterDep3,
    //         totalBoosterPoints,
    //         deployment0,
    //         deployment1,
    //         deployment2,
    //         deployment3,
    //     ] = await Promise.all([
    //         rewardsBooster.accRewardsPerBoosterLastBlockUpdated(),
    //         rewardsBooster.getAccRewardsPerBooster(),
    //         rewardsBooster.getNewRewardsPerBooster(),
    //         rewardsBooster.getAccQueryRewardsPerBooster(deploymentId3),
    //         rewardsBooster.totalBoosterPoint(),
    //         rewardsBooster.deploymentPools(deploymentId0),
    //         rewardsBooster.deploymentPools(deploymentId1),
    //         rewardsBooster.deploymentPools(deploymentId2),
    //         rewardsBooster.deploymentPools(deploymentId3),
    //     ]);
    //     return {
    //         accRewardsPerBooster: accRewardsPerBooster.toString(),
    //         accRewardsPerBoosterLastBlockUpdated: accRewardsPerBoosterLastBlockUpdated.toString(),
    //         newRewardsPerBooster: newRewardsPerBooster.toString(),
    //         totalBoosterPoints: totalBoosterPoints.toString(),
    //         deployment0,
    //         deployment1,
    //         deployment2,
    //         deployment3,
    //         accQueryRewardsPerBoosterDep3,
    //     };
    // };

    const deployer = () => deployContracts(root, root, root);
    before(async () => {
        [root, runner0, runner1, runner2, consumer0, consumer1] = await ethers.getSigners();
    });

    const applyStaking = async (runner, delegator) => {
        await startNewEra(mockProvider, eraManager);
        await rewardsDistributor.collectAndDistributeRewards(runner.address);
        if (runner.address != delegator.address) {
            await rewardsDistributor.collectAndDistributeRewards(delegator.address);
        }
        await rewardsStaking.applyStakeChange(runner.address, delegator.address);
    };

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        stakingManager = deployment.stakingManager;
        token = deployment.token;
        eraManager = deployment.eraManager;
        rewardsBooster = deployment.rewardsBooster;
        rewardsStaking = deployment.rewardsStaking;
        rewardsDistributor = deployment.rewardsDistributor;
        stakingAllocation = deployment.stakingAllocation;
        projectRegistry = deployment.projectRegistry;
        stateChannel = deployment.stateChannel;
        await token.approve(rewardsBooster.address, constants.MaxInt256);

        // config rewards booster
        await rewardsBooster.setBoosterQueryRewardRate(ProjectType.SUBQUERY, 5e5); // 50%
        await rewardsBooster.setBoosterQueryRewardRate(ProjectType.RPC, 9e5); // 90%
        await rewardsBooster.setReporter(root.address, true);

        // createProject
        await createProject(
            projectRegistry,
            root,
            projectMetadatas[0],
            deploymentMetadatas[0],
            deploymentIds[0],
            ProjectType.SUBQUERY
        );
        await createProject(
            projectRegistry,
            root,
            projectMetadatas[1],
            deploymentMetadatas[1],
            deploymentIds[1],
            ProjectType.SUBQUERY
        );
        await createProject(
            projectRegistry,
            root,
            projectMetadatas[2],
            deploymentMetadatas[2],
            deploymentIds[2],
            ProjectType.SUBQUERY
        );
        await createProject(
            projectRegistry,
            root,
            projectMetadatas[3],
            deploymentMetadatas[3],
            deploymentIds[3],
            ProjectType.RPC
        );

        // Init indexer and delegator account.
        await token.connect(root).transfer(runner0.address, etherParse('100000'));
        await token.connect(root).transfer(runner1.address, etherParse('100000'));
        await token.connect(root).transfer(runner2.address, etherParse('100000'));
        await token.connect(root).transfer(consumer0.address, etherParse('100000'));
        await token.connect(root).transfer(consumer1.address, etherParse('100000'));
        await token.connect(consumer0).increaseAllowance(staking.address, etherParse('100000'));
        await token.connect(consumer1).increaseAllowance(staking.address, etherParse('100000'));

        // Setup era period be 1 days.
        await eraManager.connect(root).updateEraPeriod(time.duration.days(1).toString());

        // Moved to era 2.
        await registerRunner(token, indexerRegistry, staking, root, runner0, etherParse('10000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner1, etherParse('10000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner2, etherParse('10000'), 1e5);

        await token.connect(runner0).increaseAllowance(staking.address, etherParse('100000'));
    });

    describe('owner operation', () => {
        it('can set booster query reward rate', async () => {
            await rewardsBooster.setBoosterQueryRewardRate(ProjectType.SUBQUERY, 5e5);
            await rewardsBooster.setBoosterQueryRewardRate(ProjectType.RPC, 9e5);
            expect(await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY)).to.eq(5e5);
            expect(await rewardsBooster.boosterQueryRewardRate(ProjectType.RPC)).to.eq(9e5);
        });
        it('can set reporter', async () => {
            await rewardsBooster.setReporter(root.address, true);
            expect(await rewardsBooster.reporters(root.address)).to.eq(true);
            await rewardsBooster.setReporter(root.address, false);
            expect(await rewardsBooster.reporters(root.address)).to.eq(false);
        });
        it('can set issuance per block', async () => {
            await rewardsBooster.setIssuancePerBlock(etherParse('1000'));
            expect(await rewardsBooster.issuancePerBlock()).to.eq(etherParse('1000'));
        });
        it('set booster query reward rate with invalid param should fail', async () => {
            await expect(rewardsBooster.setBoosterQueryRewardRate(ProjectType.SUBQUERY, 1e6)).to.be.revertedWith(
                'RB002'
            );
        });
        it('none owner can not call owner operation', async () => {
            await expect(
                rewardsBooster.connect(runner0).setBoosterQueryRewardRate(ProjectType.SUBQUERY, 5e5)
            ).to.be.revertedWith(revertrMsg.notOwner);
            await expect(rewardsBooster.connect(runner0).setIssuancePerBlock(etherParse('1000'))).to.be.revertedWith(
                revertrMsg.notOwner
            );
            await expect(rewardsBooster.connect(runner0).setReporter(runner0.address, true)).to.be.revertedWith(
                revertrMsg.notOwner
            );
        });
    });

    describe('boost deployments', () => {
        it('can add and remove booster to a deployment', async () => {
            const boosterAmount = etherParse('1000');
            const balanceBefore = await token.balanceOf(root.address);
            await token.increaseAllowance(rewardsBooster.address, boosterAmount);
            await rewardsBooster.boostDeployment(deploymentId0, boosterAmount);
            expect(await rewardsBooster.getRunnerDeploymentBooster(deploymentId0, root.address)).to.eq(boosterAmount);
            const balanceAfter = await token.balanceOf(root.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(boosterAmount);
            await rewardsBooster.removeBoosterDeployment(deploymentId0, boosterAmount);
            expect(await token.balanceOf(root.address)).to.eq(balanceBefore);
        });

        it('can query deployment rewards', async () => {
            const perBlockReward = await rewardsBooster.issuancePerBlock();
            const boosterAmount = etherParse('10000');
            await token.increaseAllowance(rewardsBooster.address, boosterAmount);
            await rewardsBooster.boostDeployment(deploymentId0, boosterAmount);
            let reward = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            expect(reward).to.eq(0);
            await blockTravel(mockProvider, 1000);
            reward = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            expect(reward).to.eq(perBlockReward.mul(1000));
        });
        it('can not get booster reward if boosted token less than minimum', async () => {
            const boosterAmount = etherParse('9999');
            await boosterDeployment(token, rewardsBooster, root, deploymentId0, boosterAmount);
            let reward = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            expect(reward).to.eq(0);
            await blockTravel(mockProvider, 1000);
            reward = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            expect(reward).to.eq(0);
        });

        it('can query deployment rewards, complex scene', async () => {
            const perBlockReward = await rewardsBooster.issuancePerBlock();
            const boosterAmount = etherParse('10000');
            await boosterDeployment(token, rewardsBooster, runner0, deploymentId0, boosterAmount);
            const blockNumber = await mockProvider.getBlockNumber();
            let reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            let reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId1);
            let reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            // let state1 = await getStats();
            await boosterDeployment(token, rewardsBooster, runner1, deploymentId0, boosterAmount);
            await boosterDeployment(token, rewardsBooster, runner1, deploymentId1, boosterAmount.mul(2));
            // let state2 = await getStats();
            await boosterDeployment(token, rewardsBooster, root, deploymentId2, boosterAmount);
            await blockTravel(mockProvider, 1000 - ((await mockProvider.getBlockNumber()) - blockNumber));

            reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId1);
            reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            expect(reward0.add(reward1).add(reward2)).to.eq(perBlockReward.mul(1000));
        });

        describe('free query from deployment booster', () => {
            it('can query entitled free query quota', async () => {
                const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.RPC);
                // booster a deployment
                await boosterDeployment(token, rewardsBooster, consumer0, deploymentId3, etherParse('10000'));
                // wait some blocks
                await blockTravel(mockProvider, 1000);
                // query free query quota
                const queryReward = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
                expect(queryReward).to.eq(getQueryReward(reward0, queryRewardRatePerMill));
                // spend query rewards
                await token.connect(consumer0).increaseAllowance(stateChannel.address, etherParse('5'));

                await openChannel(
                    stateChannel,
                    defaultChannelId,
                    deploymentId3,
                    runner0,
                    consumer0,
                    etherParse('1'),
                    etherParse('1'),
                    60
                );
                const abi = ethers.utils.defaultAbiCoder;
                const msg = abi.encode(
                    ['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
                    [defaultChannelId, runner0.address, consumer0.address, etherParse('1'), queryReward, '0x']
                );
                const payload = ethers.utils.keccak256(msg);
                const sign = await consumer0.signMessage(ethers.utils.arrayify(payload));
                const tx = await stateChannel.fund(defaultChannelId, etherParse('1'), queryReward, '0x', sign);
                const { value: spent } = await eventFrom(tx, token, 'Transfer(address,address,uint256)');
                expect(spent).to.eq(queryReward);

                const queryReward1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
                // has 1 block's reward, not zero
                expect(queryReward1).to.eq(getQueryReward(reward1.sub(reward0), queryRewardRatePerMill));
            });

            it('can add/remove booster - 1 booster account', async () => {
                // setup
                await wrapTxs(mockProvider, async () => {
                    await boosterDeployment(token, rewardsBooster, consumer0, deploymentId3, etherParse('10000'));
                });
                await blockTravel(mockProvider, 1000);
                const queryReward1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                // const queryState1 = await rewardsBooster.getBoosterQueryRewards(deploymentId3, consumer0.address);
                // add booster
                await wrapTxs(mockProvider, async () => {
                    await boosterDeployment(token, rewardsBooster, consumer0, deploymentId3, etherParse('10000'));
                });
                await blockTravel(mockProvider, 999);
                // const queryState2 = await rewardsBooster.getBoosterQueryRewards(deploymentId3, consumer0.address);
                const queryReward2 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                expect(queryReward2).to.eq(queryReward1.mul(2));
            });

            it('can add booster - 2 booster accounts', async () => {
                // setup
                const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.RPC);
                await wrapTxs(mockProvider, async () => {
                    await boosterDeployment(token, rewardsBooster, consumer0, deploymentId3, etherParse('10000'));
                    await boosterDeployment(token, rewardsBooster, consumer1, deploymentId3, etherParse('10000'));
                });
                // accumulate rewards
                await blockTravel(mockProvider, 999);
                // check rewards split
                const queryReward1C0 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                const queryReward1C1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer1.address);
                const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
                expect(queryReward1C0.add(queryReward1C1)).to.eq(getQueryReward(reward0, queryRewardRatePerMill));
                expect(queryReward1C0).to.eq(queryReward1C1);
                // increase consumer0's booster
                await wrapTxs(mockProvider, async () => {
                    await boosterDeployment(token, rewardsBooster, consumer0, deploymentId3, etherParse('20000'));
                });
                // const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
                // const stat1 = await getStats();
                // const block2 = await mockProvider.getBlockNumber();
                // const queryReward3C0 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                // const queryReward3C1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer1.address);
                await blockTravel(mockProvider, 1000);
                // verify rewards
                // first 1000 blocks, C0 and C1 have 2 portions rewards each
                // second 1000 blocks, C0 has 3 portions, C1 has 1 portion
                // overall rewards C0 : C1 = 5 : 3
                const reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
                const queryReward2C0 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                const queryReward2C1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer1.address);
                expect(queryReward2C0.add(queryReward2C1)).to.eq(getQueryReward(reward2, queryRewardRatePerMill));
                expect(queryReward2C0.mul(3)).to.eq(queryReward2C1.mul(5));
            });

            it('can remove booster', async () => {
                // setup
                const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.RPC);
                await wrapTxs(mockProvider, async () => {
                    await boosterDeployment(token, rewardsBooster, consumer0, deploymentId3, etherParse('10000'));
                    await boosterDeployment(token, rewardsBooster, consumer1, deploymentId3, etherParse('10000'));
                });
                // accumulate rewards
                await blockTravel(mockProvider, 999);
                // check rewards split
                const queryReward1C0 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                const queryReward1C1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer1.address);
                const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
                expect(queryReward1C0.add(queryReward1C1)).to.eq(getQueryReward(reward0, queryRewardRatePerMill));
                expect(queryReward1C0).to.eq(queryReward1C1);
                // increase consumer0's booster
                // await blockTravel(mockProvider, 1);
                await rewardsBooster.connect(consumer0).removeBoosterDeployment(deploymentId3, etherParse('10000'));
                const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
                const queryReward2C0 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                const queryReward2C1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer1.address);
                await blockTravel(mockProvider, 1000);
                // verify rewards
                const reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
                const queryReward3C0 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                const queryReward3C1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer1.address);
                expect(queryReward3C0.add(queryReward3C1)).to.eq(getQueryReward(reward2, queryRewardRatePerMill));
                expect(queryReward2C1.sub(queryReward2C0)).to.eq(0);
                expect(queryReward3C1.sub(queryReward2C1)).to.eq(
                    getQueryReward(reward2.sub(reward1), queryRewardRatePerMill)
                );
            });

            it.skip('can spend free query in state channel', () => {});
        });
    });

    describe('allocation for deployments', () => {
        beforeEach(async () => {
            await boosterDeployment(token, rewardsBooster, root, deploymentId0, etherParse('10000'));
            await boosterDeployment(token, rewardsBooster, root, deploymentId1, etherParse('10000'));
        });
        it('can add allocation', async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await stakingAllocation.connect(runner0).addAllocation(deploymentId0, runner0.address, etherParse('1000'));
            // const {allocationId} = await eventFrom(tx, rewardsBooster, 'StakeAllocated(uint256,bytes32,address,uint256)');
            // expect(allocationId).to.exist;
            const allocation = await stakingAllocation.allocatedTokens(runner0.address, deploymentId0);
            expect(allocation).to.eq(etherParse('1000'));
            const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            // add more allocation
            await blockTravel(mockProvider, 999);
            const tx = await stakingAllocation
                .connect(runner0)
                .addAllocation(deploymentId0, runner0.address, etherParse('1000'));
            // 1000 blocks' reward
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            const { value: collectedRewards } = await eventFrom(tx, token, 'Transfer(address,address,uint256)');
            expect(collectedRewards).to.eq(getAllocationReward(reward1.sub(reward0), queryRewardRatePerMill));
            const [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId2, runner0.address);
            expect(allocReward).to.eq(0);
        });
        it('can query allocation reward', async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await blockTravel(mockProvider, 1000);
            let reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            await stakingAllocation.connect(runner0).addAllocation(deploymentId0, runner0.address, etherParse('1000'));

            // const {allocationId} = await eventFrom(tx, rewardsBooster, 'StakeAllocated(uint256,bytes32,address,uint256)');
            reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            let [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(reward0).to.gt(0);
            expect(allocReward).to.eq(0);
            await blockTravel(mockProvider, 500);
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(allocReward).to.eq(getAllocationReward(reward1.sub(reward0), queryRewardRatePerMill));
            await stakingAllocation.connect(runner1).addAllocation(deploymentId0, runner1.address, etherParse('1000'));
            // const accRewardsPerAllocatedToken = await rewardsBooster.getAccRewardsPerAllocatedToken(deploymentId0);
            await blockTravel(mockProvider, 500);
            // const reward = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            // const allo2 = await stakingAllocation.allocatedTokens(runner1.address, deploymentId0);
            [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            // const allocReward2 = await rewardsBooster.getAllocationRewards(deploymentId0, runner1.address);
        });

        it('set missed labor will affact allocation reward', async () => {
            // setup, use deploymentId0, runner0
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await stakingAllocation.connect(runner0).addAllocation(deploymentId0, runner0.address, etherParse('1000'));
            const perBlockAllocationReward = (await rewardsBooster.issuancePerBlock()).div(2).mul(queryRewardRatePerMill).div(1e6);
            // accumulate rewards
            await blockTravel(mockProvider, 500);
            let block = await mockProvider.getBlock('latest');
            let runnerDeploymentReward = await rewardsBooster.getRunnerDeploymentRewards(deploymentId0, runner0.address);
            const rewardPeriod = block.timestamp - runnerDeploymentReward.lastClaimedAt.toNumber();
            const missedLabor = await rewardsBooster.getMissedLabor(deploymentId0, runner0.address);
            const [allocationReward, allocationRewardBurnt] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(missedLabor).to.eq(0);
            expect(allocationReward).to.gt(0);
            // set missed labor time = whole rewardPeriod
            await rewardsBooster.setMissedLabor([deploymentId0], [runner0.address], [true], [runnerDeploymentReward.lastReportMissedLaborTime], [rewardPeriod], block.timestamp);
            const missedLabor1 = await rewardsBooster.getMissedLabor(deploymentId0, runner0.address);
            const [allocationReward2, allocationRewardBurnt2] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(allocationReward2).to.eq(0);
            expect(missedLabor1).to.gt(rewardPeriod);
            // burnt reward = allocationReward + reward for last block
            expect(allocationRewardBurnt2).to.eq(allocationReward.add(perBlockAllocationReward));

            // back to online
            runnerDeploymentReward = await rewardsBooster.getRunnerDeploymentRewards(deploymentId0, runner0.address);
            block = await mockProvider.getBlock('latest');
            await rewardsBooster.setMissedLabor([deploymentId0], [runner0.address], [false], [runnerDeploymentReward.lastReportMissedLaborTime], [0], block.timestamp);
            // accumulate rewards
            await blockTravel(mockProvider, 500);
            // claim reward
            const missedLabor2 = await rewardsBooster.getMissedLabor(deploymentId0, runner0.address);
            const [allocationReward3, allocationRewardBurnt3] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            const tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            const {amount: rewardCollected} = await eventFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            const {amount: rewardBurnt} = await eventFrom(tx, rewardsBooster, 'AllocationRewardsBurnt(bytes32,address,uint256)');
            const missedLabor3 = await rewardsBooster.getMissedLabor(deploymentId0, runner0.address);
            expect(rewardCollected.add(rewardBurnt).sub(allocationReward3.add(allocationRewardBurnt3))).to.eq(perBlockAllocationReward);
            expect(rewardCollected).to.gt(allocationReward3);
            expect(rewardCollected.sub(allocationReward3)).to.lt(perBlockAllocationReward.mul(2));
            expect(missedLabor3).to.eq(0);
        });

        // FIXME: more missed labor tests
        // misslabor, disabled=true, continue increase

        // misslabor, disabled=false, not increase

        // disabled=true, without change amount
        // disabled=false, without change amount
        // lastReportMissedLaborTime not match

        it('(debug) can claim allocation reward, single indexer', async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await blockTravel(mockProvider, 1000);
            await stakingAllocation.connect(runner0).addAllocation(deploymentId0, runner0.address, etherParse('1000'));
            const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            let [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(reward0).to.gt(0);
            expect(allocReward).to.eq(0);
            await blockTravel(mockProvider, 500);
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            // const state1 = await getStats();
            expect(allocReward).to.eq(getAllocationReward(reward1.sub(reward0), queryRewardRatePerMill));
            // console.log(`allocReward: ${allocReward.toString()}`);
            await rewardsBooster.onAllocationUpdate(deploymentId0);
            // const state2 = await getStats();
            // await blockTravel(mockProvider, 1);
            [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            // console.log(`allocReward: ${allocReward.toString()}`);
        });

        it('can claim allocation reward, single indexer', async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await blockTravel(mockProvider, 1000);
            await stakingAllocation.connect(runner0).addAllocation(deploymentId0, runner0.address, etherParse('1000'));
            const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            let [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(reward0).to.gt(0);
            expect(allocReward).to.eq(0);
            // accumulate rewards
            await blockTravel(mockProvider, 500);
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(allocReward).to.eq(getAllocationReward(reward1.sub(reward0), queryRewardRatePerMill));
            // collect rewards
            await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(allocReward).to.eq(0);
            const reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            // accumulate rewards
            await blockTravel(mockProvider, 500);
            const reward3 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(allocReward).to.eq(getAllocationReward(reward3.sub(reward2), queryRewardRatePerMill));
            
            // collect second times with runner controller account
            await indexerRegistry.connect(runner0).setControllerAccount(runner1.address);
            await rewardsBooster.connect(runner1).collectAllocationReward(deploymentId0, runner0.address);
            [allocReward] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(allocReward).to.eq(0);
        });

        it('allocate before boosted', async () => {
            // const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await stakingAllocation.connect(runner0).addAllocation(deploymentId2, runner0.address, etherParse('1000'));
            await stakingAllocation.connect(runner1).addAllocation(deploymentId2, runner1.address, etherParse('1000'));
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            expect(reward1).to.eq(0);
            await boosterDeployment(token, rewardsBooster, root, deploymentId2, etherParse('10000'));
            await blockTravel(mockProvider, 1000);
            // const stats = await getStats();
            // const reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            const [allocReward1I0] = await rewardsBooster.getAllocationRewards(deploymentId2, runner0.address);
            const [allocReward1I1] = await rewardsBooster.getAllocationRewards(deploymentId2, runner1.address);
            expect(allocReward1I0).to.eq(allocReward1I1);
        });

        it('claim allocation reward, multiple indexer', async () => {
            // const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await wrapTxs(mockProvider, async () => {
                await stakingAllocation
                    .connect(runner0)
                    .addAllocation(deploymentId0, runner0.address, etherParse('1000'));
                await stakingAllocation
                    .connect(runner1)
                    .addAllocation(deploymentId0, runner1.address, etherParse('1000'));
            });
            // accumulate rewards
            const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            await blockTravel(mockProvider, 499);
            // const [allocReward1I0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            // const [allocReward1I1] = await rewardsBooster.getAllocationRewards(deploymentId0, runner1.address);
            // allocate more
            const tx = await stakingAllocation
                .connect(runner0)
                .addAllocation(deploymentId0, runner0.address, etherParse('3000'));
            const { value: reward1I0 } = await eventFrom(tx, token, 'Transfer(address,address,uint256)');
            await blockTravel(mockProvider, 500);
            const [allocReward2I0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            const [allocReward2I1] = await rewardsBooster.getAllocationRewards(deploymentId0, runner1.address);
            const indexer0TotalReward = reward1I0.add(allocReward2I0);
            const indexer1TotalReward = allocReward2I1;
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            expect(reward1.sub(reward0).div(2)).to.eq(indexer0TotalReward.add(indexer1TotalReward));
            // allow some rounding errors
            expect(indexer0TotalReward.mul(7).sub(indexer1TotalReward.mul(13)).abs()).to.lt(20000);
        });
    });

    describe('complex scenario - booster + allocation - 1 deployment', () => {
        it('add booster and add allocation', async () => {
            // 1 ----------------       2 ------------------- 1002 --- 1200 ------------- 1400  --------   2000
            // set up allocation(I0,I1) |                     |        |
            //                          |add booster(C0, C1)  |        |                   |
            //                                (accumulate rewards)     |                   |
            //                                                         | I0 add allocation |
            //                                                                             | C0 add booster
            // set up allocation
            // const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.RPC);
            await wrapTxs(mockProvider, async () => {
                await stakingAllocation
                    .connect(runner0)
                    .addAllocation(deploymentId3, runner0.address, etherParse('1000'));
                await stakingAllocation
                    .connect(runner1)
                    .addAllocation(deploymentId3, runner1.address, etherParse('1000'));
            });
            // add booster
            await wrapTxs(mockProvider, async () => {
                await boosterDeployment(token, rewardsBooster, consumer0, deploymentId3, etherParse('10000'));
                await boosterDeployment(token, rewardsBooster, consumer1, deploymentId3, etherParse('10000'));
            });
            // accumulate rewards
            await blockTravel(mockProvider, 1000);
            // const dReward = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);

            // const [allocRewardI0] = await rewardsBooster.getAllocationRewards(deploymentId3, runner0.address);
            // const [allocRewardI1] = await rewardsBooster.getAllocationRewards(deploymentId3, runner1.address);
            // const queryRewardC0 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
            // const queryRewardC1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer1.address);

            // 1000 * issurance per block of rewards
            await blockTravel(mockProvider, 199);
            // indexer0 add more allocation
            const tx = await stakingAllocation
                .connect(runner0)
                .addAllocation(deploymentId3, runner0.address, etherParse('2000'));
            const { value: collectedRewardsI0 } = await eventFrom(tx, token, 'Transfer(address,address,uint256)');
            await blockTravel(mockProvider, 199);
            await wrapTxs(mockProvider, async () => {
                await boosterDeployment(token, rewardsBooster, consumer0, deploymentId3, etherParse('20000'));
            });
            await blockTravel(mockProvider, 600);
            // verify results
            // for allocation
            // first 1200: indexer0 : indexer1 = 6:6
            // next 800: indexer0 : indexer1 = 6:2
            // indexer0 : indexer 1 = 12:8
            const [allocReward2I0] = await rewardsBooster.getAllocationRewards(deploymentId3, runner0.address);
            const [allocReward2I1] = await rewardsBooster.getAllocationRewards(deploymentId3, runner1.address);
            expect(collectedRewardsI0.add(allocReward2I0).mul(8)).to.eq(allocReward2I1.mul(12));
            // for query rewards
            // first 1400: consumer0:consumer1 = 7:7
            // next 600: consumer0 : consumer 1 4.5:1.5
            // consumer0 : consumer 1 = 11.5 : 8.5 = 23 : 17
            const queryReward2C0 = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
            const queryReward2C1 = await rewardsBooster.getQueryRewards(deploymentId3, consumer1.address);
            expect(queryReward2C0.mul(17)).to.eq(queryReward2C1.mul(23));
        });
    });

    describe('overflow in allocation and booster', () => {
        it('overflow clear by RewardsBooster', async () => {
            await stakingAllocation
                .connect(runner0)
                .addAllocation(deploymentIds[0], runner0.address, etherParse('10000'));
            const status0 = await stakingAllocation.runnerAllocation(runner0.address);
            expect(status0.overflowAt).to.eq(0);
            expect(status0.overflowTime).to.eq(0);

            await stakingManager.connect(runner0).unstake(runner0.address, etherParse('5000'));
            await applyStaking(runner0, runner0);
            const status1 = await stakingAllocation.runnerAllocation(runner0.address);
            expect(status1.overflowAt).not.to.eq(0);
            expect(status1.overflowTime).to.eq(0);
            await timeTravel(mockProvider, 10);
            const overtime1 = await stakingAllocation.overAllocationTime(runner0.address);

            // collect when overflow
            await rewardsBooster.connect(runner0).collectAllocationReward(deploymentIds[0], runner0.address);
            const overtime2 = await stakingAllocation.overAllocationTime(runner0.address);
            expect(overtime2).to.gt(overtime1);
            const rewards2 = await rewardsBooster.getRunnerDeploymentRewards(deploymentIds[0], runner0.address);
            expect(rewards2.overflowTimeSnapshot).to.eq(overtime2);
            const rewards22 = await rewardsBooster.getRunnerDeploymentRewards(deploymentIds[1], runner0.address);
            expect(rewards22.overflowTimeSnapshot).to.eq(0);

            await timeTravel(mockProvider, 10);
            await stakingManager.connect(runner0).stake(runner0.address, etherParse('5000'));
            await applyStaking(runner0, runner0);
            const overtime3 = await stakingAllocation.overAllocationTime(runner0.address);
            expect(overtime3).to.gt(overtime2);
            const status3 = await stakingAllocation.runnerAllocation(runner0.address);
            expect(status3.overflowAt).to.eq(0);
            expect(status3.overflowTime).to.eq(overtime3);

            // collect when not overflow
            await timeTravel(mockProvider, 10);
            await rewardsBooster.connect(runner0).collectAllocationReward(deploymentIds[0], runner0.address);
            const rewards3 = await rewardsBooster.getRunnerDeploymentRewards(deploymentIds[0], runner0.address);
            expect(rewards3.overflowTimeSnapshot).to.eq(overtime3);
            const rewards33 = await rewardsBooster.getRunnerDeploymentRewards(deploymentIds[1], runner0.address);
            expect(rewards33.overflowTimeSnapshot).to.eq(0);

            await stakingManager.connect(runner0).unstake(runner0.address, etherParse('5000'));
            await applyStaking(runner0, runner0);
            await timeTravel(mockProvider, 10);
            await stakingManager.connect(runner0).stake(runner0.address, etherParse('5000'));
            await applyStaking(runner0, runner0);
            const overtime4 = await stakingAllocation.overAllocationTime(runner0.address);
            const status4 = await stakingAllocation.runnerAllocation(runner0.address);
            expect(status4.overflowAt).to.eq(0);
            expect(status4.overflowTime).to.gt(overtime3);
            expect(status4.overflowTime).to.eq(overtime4);

            // collect when overflow again
            await rewardsBooster.connect(runner0).collectAllocationReward(deploymentIds[0], runner0.address);
            const rewards4 = await rewardsBooster.getRunnerDeploymentRewards(deploymentIds[0], runner0.address);
            expect(rewards4.overflowTimeSnapshot).to.eq(overtime4);

            await rewardsBooster.connect(runner0).collectAllocationReward(deploymentIds[1], runner0.address);
            const rewards44 = await rewardsBooster.getRunnerDeploymentRewards(deploymentIds[1], runner0.address);
            expect(rewards44.overflowTimeSnapshot).to.eq(overtime4);
        });
    });
});
