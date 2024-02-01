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
    RewardsStaking,
    RewardsDistributor,
    Staking,
    StakingManager,
    StakingAllocation,
    AllocationMananger,
} from '../src';
import { deploymentIds, deploymentMetadatas, projectMetadatas } from './constants';
import { etherParse, time, startNewEra, timeTravel, registerRunner } from './helper';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants } from 'ethers';

describe('StakingAllocation Contract', () => {
    const deploymentId0 = deploymentIds[0];
    const deploymentId1 = deploymentIds[1];

    const mockProvider = waffle.provider;
    let root: SignerWithAddress,
        runner0: SignerWithAddress,
        runner1: SignerWithAddress,
        runner2: SignerWithAddress,
        consumer0: SignerWithAddress,
        consumer1: SignerWithAddress,
        treasury: SignerWithAddress;

    let token: ERC20;
    let staking: Staking;
    let stakingManager: StakingManager;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsBooster: RewardsBooster;
    let rewardsStaking: RewardsStaking;
    let rewardsDistributor: RewardsDistributor;
    let stakingAllocation: StakingAllocation;
    let allocationManager: AllocationMananger;
    let projectRegistry: ProjectRegistry;

    const boosterDeployment = async (signer: SignerWithAddress, deployment: string, amount) => {
        await token.connect(signer).increaseAllowance(rewardsBooster.address, amount);
        await rewardsBooster.connect(signer).boostDeployment(deployment, amount);
    };

    const createProject = (wallet, projectMetadata, deploymentMetadata, deploymentId, projectType: ProjectType) => {
        return projectRegistry
            .connect(wallet)
            .createProject(projectMetadata, deploymentMetadata, deploymentId, projectType);
    };

    const checkAllocation = async (runner, total, used, isOverflow, hasOverfloatTime) => {
        const status = await stakingAllocation.runnerAllocation(runner.address);
        expect(status.total).to.eq(total);
        expect(status.used).to.eq(used);
        if (isOverflow) {
            expect(status.overflowAt).not.to.eq(0);
        } else {
            expect(status.overflowAt).to.eq(0);
        }
        if (hasOverfloatTime) {
            expect(status.overflowTime).not.to.eq(0);
        } else {
            expect(status.overflowTime).to.eq(0);
        }
    };

    const applyStaking = async (runner, delegator) => {
        await startNewEra(mockProvider, eraManager);
        await rewardsDistributor.collectAndDistributeRewards(runner.address);
        if (runner.address != delegator.address) {
            await rewardsDistributor.collectAndDistributeRewards(delegator.address);
        }
        await rewardsStaking.applyStakeChange(runner.address, delegator.address);
    };

    const deployer = () => deployContracts(root, root, treasury);
    before(async () => {
        [root, runner0, runner1, runner2, consumer0, consumer1, treasury] = await ethers.getSigners();
    });

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
        allocationManager = deployment.allocationMananger;
        projectRegistry = deployment.projectRegistry;

        // config rewards booster
        await rewardsBooster.setBoosterQueryRewardRate(ProjectType.SUBQUERY, 5e5); // 50%
        await rewardsBooster.setBoosterQueryRewardRate(ProjectType.RPC, 9e5); // 90%
        await token.connect(treasury).approve(rewardsBooster.address, constants.MaxInt256);

        // createProject
        await createProject(root, projectMetadatas[0], deploymentMetadatas[0], deploymentIds[0], ProjectType.SUBQUERY);
        await createProject(root, projectMetadatas[1], deploymentMetadatas[1], deploymentIds[1], ProjectType.SUBQUERY);
        await createProject(root, projectMetadatas[2], deploymentMetadatas[2], deploymentIds[2], ProjectType.SUBQUERY);
        await createProject(root, projectMetadatas[3], deploymentMetadatas[3], deploymentIds[3], ProjectType.RPC);

        // Init runner and delegator account.
        await token.connect(root).transfer(runner0.address, etherParse('100000'));
        await token.connect(root).transfer(runner1.address, etherParse('100000'));
        await token.connect(root).transfer(runner2.address, etherParse('100000'));
        await token.connect(root).transfer(consumer0.address, etherParse('100000'));
        await token.connect(root).transfer(consumer1.address, etherParse('100000'));
        await token.connect(root).transfer(treasury.address, etherParse('100000'));
        await token.connect(consumer0).increaseAllowance(staking.address, etherParse('100000'));
        await token.connect(consumer1).increaseAllowance(staking.address, etherParse('100000'));

        // Setup era period be 1 days.
        await eraManager.connect(root).updateEraPeriod(time.duration.days(1).toString());

        // Moved to era 2.
        await registerRunner(token, indexerRegistry, staking, root, runner0, etherParse('10000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner1, etherParse('10000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner2, etherParse('10000'), 1e5);

        await token.connect(runner0).increaseAllowance(staking.address, etherParse('100000'));
        await token.connect(runner1).increaseAllowance(staking.address, etherParse('100000'));
    });

    describe('allocation for deployments', () => {
        beforeEach(async () => {
            await boosterDeployment(root, deploymentId0, etherParse('10000'));
            await boosterDeployment(root, deploymentId1, etherParse('10000'));
        });

        it('staking changed the allocation total & overflow', async () => {
            await checkAllocation(runner0, etherParse('10000'), 0, false, false);

            await stakingManager.connect(runner0).stake(runner0.address, etherParse('10000'));
            await checkAllocation(runner0, etherParse('10000'), 0, false, false);
            await applyStaking(runner0, runner0);
            await checkAllocation(runner0, etherParse('20000'), 0, false, false);

            await allocationManager
                .connect(runner0)
                .addAllocation(deploymentIds[0], runner0.address, etherParse('20000'));
            await checkAllocation(runner0, etherParse('20000'), etherParse('20000'), false, false);

            await stakingManager.connect(runner0).unstake(runner0.address, etherParse('10000'));
            await checkAllocation(runner0, etherParse('20000'), etherParse('20000'), false, false);
            await applyStaking(runner0, runner0);

            await checkAllocation(runner0, etherParse('10000'), etherParse('20000'), true, false);

            await timeTravel(mockProvider, 10);
            const overtime = await stakingAllocation.overAllocationTime(runner0.address);
            if (overtime.lt(10)) {
                expect('overtime').to.eq('shuould more than it');
            }

            await stakingManager.connect(runner1).delegate(runner0.address, etherParse('10000'));
            await applyStaking(runner0, runner1);

            await checkAllocation(runner0, etherParse('20000'), etherParse('20000'), false, true);
            const overtime1 = await stakingAllocation.overAllocationTime(runner0.address);
            if (overtime1.lt(10)) {
                expect('overtime').to.eq('shuould more than it');
            }
            await timeTravel(mockProvider, 10);
            const overtime2 = await stakingAllocation.overAllocationTime(runner0.address);
            expect(overtime1).to.eq(overtime2);

            await stakingManager.connect(runner1).undelegate(runner0.address, etherParse('1'));
            await applyStaking(runner0, runner1);

            await checkAllocation(runner0, etherParse('19999'), etherParse('20000'), true, true);
            await timeTravel(mockProvider, 10);
            const overtime3 = await stakingAllocation.overAllocationTime(runner0.address);
            if (overtime3.lt(overtime2.add(10))) {
                expect('overtime').to.eq('shuould more than it');
            }

            await stakingManager.connect(runner1).delegate(runner0.address, etherParse('101'));
            await applyStaking(runner0, runner1);
            await checkAllocation(runner0, etherParse('20100'), etherParse('20000'), false, true);
            const overtime4 = await stakingAllocation.overAllocationTime(runner0.address);

            await timeTravel(mockProvider, 10);
            const overtime5 = await stakingAllocation.overAllocationTime(runner0.address);
            expect(overtime4).to.eq(overtime5);
        });

        it('only RewardStaking can call applyStakeChange', async () => {
            await expect(
                stakingAllocation.connect(runner0).onStakeUpdate(runner0.address)
            ).to.be.revertedWith('SAL01');
        });

        it('add/del allocation', async () => {
            await checkAllocation(runner0, etherParse('10000'), 0, false, false);

            await allocationManager
                .connect(runner0)
                .addAllocation(deploymentIds[0], runner0.address, etherParse('5000'));
            await checkAllocation(runner0, etherParse('10000'), etherParse('5000'), false, false);
            const allocation1 = await stakingAllocation.allocatedTokens(runner0.address, deploymentIds[0]);
            expect(allocation1).to.eq(etherParse('5000'));

            await allocationManager
                .connect(runner0)
                .addAllocation(deploymentIds[0], runner0.address, etherParse('1000'));
            await checkAllocation(runner0, etherParse('10000'), etherParse('6000'), false, false);
            const allocation2 = await stakingAllocation.allocatedTokens(runner0.address, deploymentIds[0]);
            expect(allocation2).to.eq(etherParse('6000'));

            await allocationManager
                .connect(runner0)
                .addAllocation(deploymentIds[1], runner0.address, etherParse('1000'));
            await allocationManager
                .connect(runner0)
                .removeAllocation(deploymentIds[0], runner0.address, etherParse('2000'));
            await allocationManager
                .connect(runner1)
                .addAllocation(deploymentIds[0], runner1.address, etherParse('10000'));

            await checkAllocation(runner0, etherParse('10000'), etherParse('5000'), false, false);
            const allocation3 = await stakingAllocation.allocatedTokens(runner0.address, deploymentIds[0]);
            expect(allocation3).to.eq(etherParse('4000'));
            const allocation4 = await stakingAllocation.allocatedTokens(runner0.address, deploymentIds[1]);
            expect(allocation4).to.eq(etherParse('1000'));

            const da0 = await stakingAllocation.deploymentAllocations(deploymentIds[0]);
            const da1 = await stakingAllocation.deploymentAllocations(deploymentIds[1]);
            expect(da0).to.eq(etherParse('14000'));
            expect(da1).to.eq(etherParse('1000'));

            await expect(
                allocationManager.connect(runner0).addAllocation(deploymentIds[1], runner0.address, etherParse('5001'))
            ).to.be.revertedWith('SAL03');
            await expect(
                allocationManager
                    .connect(runner0)
                    .removeAllocation(deploymentIds[1], runner0.address, etherParse('2000'))
            ).to.be.revertedWith('SAL04');

            await stakingManager.connect(runner1).unstake(runner1.address, etherParse('1000'));
            await applyStaking(runner1, runner1);
            await checkAllocation(runner1, etherParse('9000'), etherParse('10000'), true, false);
            await timeTravel(mockProvider, 10);
            await allocationManager
                .connect(runner1)
                .removeAllocation(deploymentIds[0], runner1.address, etherParse('500'));
            await checkAllocation(runner1, etherParse('9000'), etherParse('9500'), true, false);
            await allocationManager
                .connect(runner1)
                .removeAllocation(deploymentIds[0], runner1.address, etherParse('500'));
            await checkAllocation(runner1, etherParse('9000'), etherParse('9000'), false, false);
        });

        it('only allocationManager and auth account can add/del allocation', async () => {
            // Caller is not `allocationManager`
            await expect(
                stakingAllocation.connect(runner0).addAllocation(deploymentIds[0], runner0.address, etherParse('1000'))
            ).to.be.revertedWith('SAL06');
            await expect(
                stakingAllocation.connect(runner0).removeAllocation(deploymentIds[0], runner0.address, etherParse('1000'))
            ).to.be.revertedWith('SAL06');

            // Caller is not `auth account`
            await expect(allocationManager
                .connect(runner0)
                .addAllocation(deploymentIds[0], runner1.address, etherParse('5000'))).to.be.revertedWith('SAL02');
            await expect(allocationManager
                .connect(runner0)
                .removeAllocation(deploymentIds[0], runner1.address, etherParse('5000'))).to.be.revertedWith('SAL02');
        });
    });
});
