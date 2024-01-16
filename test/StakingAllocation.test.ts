// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {
    EraManager,
    ERC20,
    IndexerRegistry,
    ProjectRegistry,
    ProjectType,
    RewardsBooster,
    RewardsStaking,
    RewardsDistributor,
    SQContracts,
    Staking,
    StakingManager,
    StakingAllocation,
} from '../src';
import {deploymentIds, deploymentMetadatas, METADATA_HASH, projectMetadatas} from './constants';
import {blockTravel, etherParse, eventFrom, time, startNewEra, wrapTxs, timeTravel} from './helper';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {BigNumber, providers} from 'ethers';

const PER_MILL = BigNumber.from(1e6);

describe('StakingAllocation Contract', () => {
    const deploymentId0 = deploymentIds[0];
    const deploymentId1 = deploymentIds[1];
    const deploymentId2 = deploymentIds[2];
    const deploymentId3 = deploymentIds[3];

    const mockProvider = waffle.provider;
    let root: SignerWithAddress,
        indexer0: SignerWithAddress,
        indexer1: SignerWithAddress,
        indexer2: SignerWithAddress,
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

    // Rewrite registerIndexer to register indexer with stakeAmount and commission rate.
    const registerIndexer = async (rootWallet, wallet, amount, rate) => {
        await token.connect(rootWallet).transfer(wallet.address, amount);
        await token.connect(wallet).increaseAllowance(staking.address, amount);
        await indexerRegistry.connect(wallet).registerIndexer(amount, METADATA_HASH, rate, {gasLimit: '2000000'});
    };

    const boosterDeployment = async (signer: SignerWithAddress, deployment: string, amount) => {
        await token.connect(signer).increaseAllowance(rewardsBooster.address, amount);
        await rewardsBooster.connect(signer).boostDeployment(deployment, amount);
    };

    const createProject = (wallet, projectMetadata, deploymentMetadata, deploymentId, projectType: ProjectType) => {
        return projectRegistry
            .connect(wallet)
            .createProject(projectMetadata, deploymentMetadata, deploymentId, projectType);
    };

    const checkAllocation = async (indexer, total, used, isOverflow, hasOverfloatTime) => {
        const status = await stakingAllocation.indexer(indexer.address);
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

    const applyStaking = async (indexer, delegator) => {
        await startNewEra(mockProvider, eraManager);
        await rewardsDistributor.collectAndDistributeRewards(indexer.address);
        if (indexer.address != delegator.address) {
            await rewardsDistributor.collectAndDistributeRewards(delegator.address);
        }
        await rewardsStaking.applyStakeChange(indexer.address, delegator.address);
    };

    const deployer = () => deployContracts(root, root);
    before(async () => {
        [root, indexer0, indexer1, indexer2, consumer0, consumer1] = await ethers.getSigners();
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
        rewardsDistributor = deployment.rewardsDistributer;
        stakingAllocation = deployment.stakingAllocation;
        projectRegistry = deployment.projectRegistry;
        await deployment.settings.setContractAddress(SQContracts.Treasury, root.address);

        // config rewards booster
        await rewardsBooster.setBoosterQueryRewardRate(ProjectType.SUBQUERY, 5e5); // 50%
        await rewardsBooster.setBoosterQueryRewardRate(ProjectType.RPC, 9e5); // 90%

        // createProject
        await createProject(root, projectMetadatas[0], deploymentMetadatas[0], deploymentIds[0], ProjectType.SUBQUERY);
        await createProject(root, projectMetadatas[1], deploymentMetadatas[1], deploymentIds[1], ProjectType.SUBQUERY);
        await createProject(root, projectMetadatas[2], deploymentMetadatas[2], deploymentIds[2], ProjectType.SUBQUERY);
        await createProject(root, projectMetadatas[3], deploymentMetadatas[3], deploymentIds[3], ProjectType.RPC);

        // Init indexer and delegator account.
        await token.connect(root).transfer(indexer0.address, etherParse('100000'));
        await token.connect(root).transfer(indexer1.address, etherParse('100000'));
        await token.connect(root).transfer(indexer2.address, etherParse('100000'));
        await token.connect(root).transfer(consumer0.address, etherParse('100000'));
        await token.connect(root).transfer(consumer1.address, etherParse('100000'));
        await token.connect(consumer0).increaseAllowance(staking.address, etherParse('100000'));
        await token.connect(consumer1).increaseAllowance(staking.address, etherParse('100000'));

        // Setup era period be 1 days.
        await eraManager.connect(root).updateEraPeriod(time.duration.days(1).toString());

        // Moved to era 2.
        await registerIndexer(root, indexer0, etherParse('10000'), 1e5);
        await registerIndexer(root, indexer1, etherParse('10000'), 1e5);
        await registerIndexer(root, indexer2, etherParse('10000'), 1e5);

        await token.connect(indexer0).increaseAllowance(staking.address, etherParse('100000'));
        await token.connect(indexer1).increaseAllowance(staking.address, etherParse('100000'));
    });

    describe('allocation for deployments', () => {
        beforeEach(async () => {
            await boosterDeployment(root, deploymentId0, etherParse('10000'));
            await boosterDeployment(root, deploymentId1, etherParse('10000'));
        });
        it('staking changed the allocation total & overflow', async () => {
            await checkAllocation(indexer0, etherParse('10000'), 0, false, false);

            await stakingManager.connect(indexer0).stake(indexer0.address, etherParse('10000'));
            await checkAllocation(indexer0, etherParse('10000'), 0, false, false);
            await applyStaking(indexer0, indexer0);

            const status1 = await stakingAllocation.indexer(indexer0.address);
            await checkAllocation(indexer0, etherParse('20000'), 0, false, false);

            await stakingAllocation
                .connect(indexer0)
                .addAllocation(deploymentIds[0], indexer0.address, etherParse('20000'));
            await checkAllocation(indexer0, etherParse('20000'), etherParse('20000'), false, false);

            await stakingManager.connect(indexer0).unstake(indexer0.address, etherParse('10000'));
            await checkAllocation(indexer0, etherParse('20000'), etherParse('20000'), false, false);
            await applyStaking(indexer0, indexer0);

            await checkAllocation(indexer0, etherParse('10000'), etherParse('20000'), true, false);

            await timeTravel(mockProvider, 10);
            const overtime = await stakingAllocation.overflowTime(indexer0.address);
            if (overtime < 10) {
                expect('overtime').to.eq('shuould more than it');
            }

            await stakingManager.connect(indexer1).delegate(indexer0.address, etherParse('10000'));
            await applyStaking(indexer0, indexer1);

            await checkAllocation(indexer0, etherParse('20000'), etherParse('20000'), false, true);
            const overtime1 = await stakingAllocation.overflowTime(indexer0.address);
            if (overtime1 < 10) {
                expect('overtime').to.eq('shuould more than it');
            }
            await timeTravel(mockProvider, 10);
            const overtime2 = await stakingAllocation.overflowTime(indexer0.address);
            expect(overtime1).to.eq(overtime2);

            await stakingManager.connect(indexer1).undelegate(indexer0.address, etherParse('1'));
            await applyStaking(indexer0, indexer1);

            await checkAllocation(indexer0, etherParse('19999'), etherParse('20000'), true, true);
            await timeTravel(mockProvider, 10);
            const overtime3 = await stakingAllocation.overflowTime(indexer0.address);
            if (overtime3 < overtime2 + 10) {
                expect('overtime').to.eq('shuould more than it');
            }

            await stakingManager.connect(indexer1).delegate(indexer0.address, etherParse('101'));
            await applyStaking(indexer0, indexer1);
            await checkAllocation(indexer0, etherParse('20100'), etherParse('20000'), false, true);
            const overtime4 = await stakingAllocation.overflowTime(indexer0.address);

            await timeTravel(mockProvider, 10);
            const overtime5 = await stakingAllocation.overflowTime(indexer0.address);
            expect(overtime4).to.eq(overtime5);
        });
        it('add/del allocation', async () => {
            await checkAllocation(indexer0, etherParse('10000'), 0, false, false);

            await stakingAllocation
                .connect(indexer0)
                .addAllocation(deploymentIds[0], indexer0.address, etherParse('5000'));
            await checkAllocation(indexer0, etherParse('10000'), etherParse('5000'), false, false);
            const allocation1 = await stakingAllocation.allocation(indexer0.address, deploymentIds[0]);
            expect(allocation1).to.eq(etherParse('5000'));

            await stakingAllocation
                .connect(indexer0)
                .addAllocation(deploymentIds[0], indexer0.address, etherParse('1000'));
            await checkAllocation(indexer0, etherParse('10000'), etherParse('6000'), false, false);
            const allocation2 = await stakingAllocation.allocation(indexer0.address, deploymentIds[0]);
            expect(allocation2).to.eq(etherParse('6000'));

            await stakingAllocation
                .connect(indexer0)
                .addAllocation(deploymentIds[1], indexer0.address, etherParse('1000'));
            await stakingAllocation
                .connect(indexer0)
                .removeAllocation(deploymentIds[0], indexer0.address, etherParse('2000'));
            await stakingAllocation
                .connect(indexer1)
                .addAllocation(deploymentIds[0], indexer1.address, etherParse('10000'));

            await checkAllocation(indexer0, etherParse('10000'), etherParse('5000'), false, false);
            const allocation3 = await stakingAllocation.allocation(indexer0.address, deploymentIds[0]);
            expect(allocation3).to.eq(etherParse('4000'));
            const allocation4 = await stakingAllocation.allocation(indexer0.address, deploymentIds[1]);
            expect(allocation4).to.eq(etherParse('1000'));

            const da0 = await stakingAllocation.deploymentAllocations(deploymentIds[0]);
            const da1 = await stakingAllocation.deploymentAllocations(deploymentIds[1]);
            expect(da0).to.eq(etherParse('14000'));
            expect(da1).to.eq(etherParse('1000'));

            await expect(
                stakingAllocation
                    .connect(indexer0)
                    .addAllocation(deploymentIds[1], indexer0.address, etherParse('5001'))
            ).to.be.revertedWith('SA01');
            await expect(
                stakingAllocation
                    .connect(indexer0)
                    .removeAllocation(deploymentIds[1], indexer0.address, etherParse('2000'))
            ).to.be.revertedWith('SA04');

            await stakingManager.connect(indexer1).unstake(indexer1.address, etherParse('1000'));
            await applyStaking(indexer1, indexer1);
            await checkAllocation(indexer1, etherParse('9000'), etherParse('10000'), true, false);
            await timeTravel(mockProvider, 10);
            await stakingAllocation
                .connect(indexer1)
                .removeAllocation(deploymentIds[0], indexer1.address, etherParse('500'));
            await checkAllocation(indexer1, etherParse('9000'), etherParse('9500'), true, false);
            await stakingAllocation
                .connect(indexer1)
                .removeAllocation(deploymentIds[0], indexer1.address, etherParse('500'));
            await checkAllocation(indexer1, etherParse('9000'), etherParse('9000'), false, false);
        });

        it('overflow clear by RewardsBooster', async () => {
            await stakingAllocation
                .connect(indexer0)
                .addAllocation(deploymentIds[0], indexer0.address, etherParse('10000'));
            await checkAllocation(indexer0, etherParse('10000'), etherParse('10000'), false, false);

            await stakingManager.connect(indexer0).unstake(indexer0.address, etherParse('5000'));
            await applyStaking(indexer0, indexer0);
            await checkAllocation(indexer0, etherParse('5000'), etherParse('10000'), true, false);
            await timeTravel(mockProvider, 10);
            const overtime1 = await stakingAllocation.overflowTime(indexer0.address);

            await rewardsBooster.connect(indexer0).collectAllocationReward(deploymentIds[0], indexer0.address);
            const overtime2 = await stakingAllocation.overflowTime(indexer0.address);
            if (overtime2 >= overtime1) {
                expect('overtime').to.eq('shuould more than it');
            }

            await timeTravel(mockProvider, 10);
            await stakingManager.connect(indexer0).stake(indexer0.address, etherParse('5000'));
            await applyStaking(indexer0, indexer0);
            await checkAllocation(indexer0, etherParse('10000'), etherParse('10000'), false, true);
            await rewardsBooster.connect(indexer0).collectAllocationReward(deploymentIds[0], indexer0.address);
            await checkAllocation(indexer0, etherParse('10000'), etherParse('10000'), false, false);
            const overtime3 = await stakingAllocation.overflowTime(indexer0.address);
            expect(overtime3).to.eq(0);
        });
    });
});
