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
    RewardsBoosterOld__factory,
    RewardsBoosterOld,
    ProxyAdmin,
    Settings,
    SQContracts,
    RewardsHelper,
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
    revertMsg,
    lastestBlockTime,
    startService,
    eventsFrom,
} from './helper';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, constants } from 'ethers';
import { ConsumerRegistry } from 'build';

const PER_MILL = BigNumber.from(1e6);

describe('RewardsBooster Contract', () => {
    const deploymentId0 = deploymentIds[0];
    const deploymentId1 = deploymentIds[1];
    // RPC
    const deploymentId2 = deploymentIds[2];
    const deploymentId3 = deploymentIds[3];
    const deploymentId4 = deploymentIds[4];
    const defaultChannelId = ethers.utils.randomBytes(32);

    const mockProvider = waffle.provider;
    let root: SignerWithAddress,
        runner0: SignerWithAddress,
        runner1: SignerWithAddress,
        runner2: SignerWithAddress,
        runner3: SignerWithAddress,
        consumer0: SignerWithAddress,
        consumer1: SignerWithAddress,
        consumer2: SignerWithAddress,
        delegator0: SignerWithAddress,
        controller: SignerWithAddress;

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
    let consumerRegistry: ConsumerRegistry;
    let rewardsBoosterOld: RewardsBoosterOld;
    let rewardsHelper: RewardsHelper;
    let proxyAdmin: ProxyAdmin;
    let rewardsBoosterImpl: string;
    let settings: Settings;

    const getAllocationReward = (deploymentReward: BigNumber, queryRewardRatePerMill: BigNumber): BigNumber => {
        return deploymentReward.mul(PER_MILL.sub(queryRewardRatePerMill)).div(PER_MILL);
    };

    const getQueryReward = (deploymentReward: BigNumber, queryRewardRatePerMill: BigNumber): BigNumber => {
        return deploymentReward.mul(queryRewardRatePerMill).div(PER_MILL);
    };

    const deployer = () => deployContracts(root, root, root);
    before(async () => {
        [root, runner0, runner1, runner2, runner3, consumer0, consumer1, consumer2, delegator0, controller] =
            await ethers.getSigners();
    });

    const applyStaking = async (runner, delegator) => {
        await startNewEra(eraManager);
        await rewardsDistributor.collectAndDistributeRewards(runner.address);
        if (runner.address != delegator.address) {
            await rewardsDistributor.collectAndDistributeRewards(delegator.address);
        }
        await rewardsStaking.applyStakeChange(runner.address, delegator.address);
    };

    const upgrade = async () => {
        await wrapTxs(async () => {
            await proxyAdmin.upgrade(rewardsBooster.address, rewardsBoosterImpl);
            await rewardsBooster.setIssuancePerBlock(etherParse('0'));
            await rewardsBooster.setIssuancePerBlockByType(ProjectType.SUBQUERY, etherParse('10'));
            await rewardsBooster.setIssuancePerBlockByType(ProjectType.RPC, etherParse('5'));
        });
    };

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);

        rewardsBoosterImpl = await deployment.proxyAdmin.getProxyImplementation(deployment.rewardsBooster.address);

        const rewardsBoosterOldContract = await new RewardsBoosterOld__factory(root).deploy();
        // roll back to old version
        await deployment.proxyAdmin.upgrade(deployment.rewardsBooster.address, rewardsBoosterOldContract.address);

        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        stakingManager = deployment.stakingManager;
        token = deployment.token;
        eraManager = deployment.eraManager;
        rewardsBooster = deployment.rewardsBooster;
        rewardsBoosterOld = rewardsBoosterOldContract.connect(deployment.rewardsBooster.address);
        rewardsStaking = deployment.rewardsStaking;
        rewardsDistributor = deployment.rewardsDistributor;
        rewardsHelper = deployment.rewardsHelper;
        stakingAllocation = deployment.stakingAllocation;
        projectRegistry = deployment.projectRegistry;
        stateChannel = deployment.stateChannel;
        consumerRegistry = deployment.consumerRegistry;
        proxyAdmin = deployment.proxyAdmin;
        settings = deployment.settings;
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
            deploymentId0,
            ProjectType.SUBQUERY
        );
        await createProject(
            projectRegistry,
            root,
            projectMetadatas[1],
            deploymentMetadatas[1],
            deploymentId1,
            ProjectType.SUBQUERY
        );
        await createProject(
            projectRegistry,
            root,
            projectMetadatas[2],
            deploymentMetadatas[2],
            deploymentId2,
            ProjectType.RPC
        );
        await createProject(
            projectRegistry,
            root,
            projectMetadatas[3],
            deploymentMetadatas[3],
            deploymentId3,
            ProjectType.RPC
        );

        // Init indexer and delegator account.
        await token.connect(root).transfer(runner0.address, etherParse('100000'));
        await token.connect(root).transfer(runner1.address, etherParse('100000'));
        await token.connect(root).transfer(runner2.address, etherParse('100000'));
        await token.connect(root).transfer(runner3.address, etherParse('100000'));
        await token.connect(root).transfer(consumer0.address, etherParse('100000'));
        await token.connect(root).transfer(consumer1.address, etherParse('100000'));
        await token.connect(root).transfer(consumer2.address, etherParse('100000'));
        await token.connect(root).transfer(controller.address, etherParse('100000'));
        await token.connect(consumer0).increaseAllowance(staking.address, etherParse('100000'));
        await token.connect(consumer1).increaseAllowance(staking.address, etherParse('100000'));
        await token.connect(consumer2).increaseAllowance(staking.address, etherParse('100000'));

        // Setup era period be 1 days.
        await eraManager.connect(root).updateEraPeriod(time.duration.days(1).toString());

        // Moved to era 2.
        await registerRunner(token, indexerRegistry, staking, root, runner0, etherParse('10000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner1, etherParse('10000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner2, etherParse('10000'), 1e5);
        await registerRunner(token, indexerRegistry, staking, root, runner3, etherParse('10000'), 1e5);

        await startService(projectRegistry, deploymentId0, runner0);
        await stakingAllocation.connect(runner0).addAllocation(deploymentId0, runner0.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId1, runner0);
        await stakingAllocation.connect(runner0).addAllocation(deploymentId1, runner0.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId2, runner0);
        await stakingAllocation.connect(runner0).addAllocation(deploymentId2, runner0.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId3, runner0);
        await stakingAllocation.connect(runner0).addAllocation(deploymentId3, runner0.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId0, runner1);
        await stakingAllocation.connect(runner1).addAllocation(deploymentId0, runner1.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId1, runner1);
        await stakingAllocation.connect(runner1).addAllocation(deploymentId1, runner1.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId2, runner1);
        await stakingAllocation.connect(runner1).addAllocation(deploymentId2, runner1.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId3, runner1);
        await stakingAllocation.connect(runner1).addAllocation(deploymentId3, runner1.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId0, runner2);
        await stakingAllocation.connect(runner2).addAllocation(deploymentId0, runner2.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId1, runner2);
        await stakingAllocation.connect(runner2).addAllocation(deploymentId1, runner2.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId2, runner2);
        await stakingAllocation.connect(runner2).addAllocation(deploymentId2, runner2.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId3, runner2);
        await stakingAllocation.connect(runner2).addAllocation(deploymentId3, runner2.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId0, runner3);
        await stakingAllocation.connect(runner3).addAllocation(deploymentId0, runner3.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId1, runner3);
        await stakingAllocation.connect(runner3).addAllocation(deploymentId1, runner3.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId2, runner3);
        await stakingAllocation.connect(runner3).addAllocation(deploymentId2, runner3.address, etherParse('1000'));
        await startService(projectRegistry, deploymentId3, runner3);
        await stakingAllocation.connect(runner3).addAllocation(deploymentId3, runner3.address, etherParse('1000'));

        await token.connect(runner0).increaseAllowance(staking.address, etherParse('100000'));
    });

    describe('migrate rewardsboost', () => {
        beforeEach(async () => {
            await wrapTxs(async () => {
                await boosterDeployment(token, rewardsBooster, consumer0, deploymentId0, etherParse('10000'));
                await boosterDeployment(token, rewardsBooster, consumer1, deploymentId0, etherParse('30000'));
                await boosterDeployment(token, rewardsBooster, consumer0, deploymentId1, etherParse('10000'));
                await boosterDeployment(token, rewardsBooster, consumer1, deploymentId1, etherParse('10000'));
                await boosterDeployment(token, rewardsBooster, consumer2, deploymentId1, etherParse('10000'));
                await boosterDeployment(token, rewardsBooster, consumer0, deploymentId2, etherParse('10000'));
                await boosterDeployment(token, rewardsBooster, consumer1, deploymentId2, etherParse('10000'));
                await boosterDeployment(token, rewardsBooster, consumer2, deploymentId2, etherParse('10000'));
            });

            await blockTravel(999);

            await wrapTxs(async () => {
                await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
                await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId1, runner0.address);
                await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId2, runner0.address);
                await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId3, runner0.address);
                await rewardsBooster.connect(runner1).collectAllocationReward(deploymentId0, runner1.address);
                await rewardsBooster.connect(runner1).collectAllocationReward(deploymentId1, runner1.address);
                await rewardsBooster.connect(runner1).collectAllocationReward(deploymentId2, runner1.address);
                await rewardsBooster.connect(runner1).collectAllocationReward(deploymentId3, runner1.address);
                await rewardsBooster.connect(runner2).collectAllocationReward(deploymentId0, runner2.address);
                await rewardsBooster.connect(runner2).collectAllocationReward(deploymentId1, runner2.address);
                await rewardsBooster.connect(runner2).collectAllocationReward(deploymentId2, runner2.address);
                await rewardsBooster.connect(runner2).collectAllocationReward(deploymentId3, runner2.address);
            });

            const pool0 = await rewardsBooster.deploymentPools(deploymentId0);
            const pool1 = await rewardsBooster.deploymentPools(deploymentId1);
            const pool2 = await rewardsBooster.deploymentPools(deploymentId2);
            const totalBoost = await rewardsBooster.totalBoosterPoint();
            expect(pool0.boosterPoint).to.eq(etherParse('40000'));
            expect(pool1.boosterPoint).to.eq(etherParse('30000'));
            expect(pool2.boosterPoint).to.eq(etherParse('30000'));
            expect(totalBoost).to.eq(etherParse('100000'));
        });

        it('partially migrate to byType reward via migrateDeploymentBoost()', async () => {
            // accumulate more rewards
            let [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.eq(0);
            await blockTravel(1000);
            [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.gt(0);
            const deploymentPool0Before = await rewardsBooster.deploymentPools(deploymentId0);
            const totalBoostBefore = await rewardsBooster.totalBoosterPoint();
            expect(deploymentPool0Before.boosterPoint).to.eq(etherParse('40000'));
            // migrate
            await upgrade();
            await expect(rewardsBooster.migrateDeploymentBoost(deploymentId0, consumer0.address))
                .to.emit(rewardsBooster, 'DeploymentBoostMigrated')
                .withArgs(deploymentId0, consumer0.address, etherParse('10000'));
            // check boost changes
            const deploymentPool0After = await rewardsBooster.deploymentPools(deploymentId0);
            const deploymentPoolByType0After = await rewardsBooster.deploymentPoolsByType(deploymentId0);
            const totalBoostAfter = await rewardsBooster.totalBoosterPoint();
            const totalBoostByTypeAfter = await rewardsBooster.totalBoosterPointByType(ProjectType.SUBQUERY);
            expect(await rewardsBooster.getRunnerDeploymentBooster(deploymentId0, consumer0.address)).to.eq(
                etherParse('10000')
            );
            expect(await rewardsBooster.getRunnerDeploymentBoosterOld(deploymentId0, consumer0.address)).to.eq(0);

            expect(deploymentPool0After.boosterPoint).to.eq(etherParse('30000'));
            expect(deploymentPoolByType0After.boosterPoint).to.eq(etherParse('10000'));
            expect(totalBoostBefore.sub(totalBoostAfter)).to.eq(etherParse('10000'));
            expect(totalBoostByTypeAfter).to.eq(etherParse('10000'));
            // check allocation reward
            const [alReward0After] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            let tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            let evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(2);
            await blockTravel(1000);
            tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(1);
        });

        it('partially migrate to byType reward via boostDeployment', async () => {
            // accumulate more rewards
            let [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.eq(0);
            await blockTravel(1000);
            [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.gt(0);
            const deploymentPool0Before = await rewardsBooster.deploymentPools(deploymentId0);
            const totalBoostBefore = await rewardsBooster.totalBoosterPoint();
            // migrate
            await upgrade();
            await boosterDeployment(token, rewardsBooster, consumer0, deploymentId0, etherParse(1));
            // check boost changes
            const deploymentPool0After = await rewardsBooster.deploymentPools(deploymentId0);
            const deploymentPoolByType0After = await rewardsBooster.deploymentPoolsByType(deploymentId0);
            const totalBoostAfter = await rewardsBooster.totalBoosterPoint();
            const totalBoostByTypeAfter = await rewardsBooster.totalBoosterPointByType(ProjectType.SUBQUERY);
            expect(await rewardsBooster.getRunnerDeploymentBooster(deploymentId0, consumer0.address)).to.eq(
                etherParse('10000').add(etherParse(1))
            );
            expect(await rewardsBooster.getRunnerDeploymentBoosterOld(deploymentId0, consumer0.address)).to.eq(0);

            expect(deploymentPool0After.boosterPoint).to.eq(etherParse('30000'));
            expect(deploymentPoolByType0After.boosterPoint).to.eq(etherParse('10000').add(etherParse(1)));
            expect(totalBoostBefore.sub(totalBoostAfter)).to.eq(etherParse('10000'));
            expect(totalBoostByTypeAfter).to.eq(etherParse('10000').add(etherParse(1)));
        });

        it('partially migrate to byType reward via removeBoosterDeployment', async () => {
            // accumulate more rewards
            let [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.eq(0);
            // avoid RB016 error
            await rewardsBooster.setMinimumDeploymentBooster(etherParse(1));
            await blockTravel(1000);
            [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.gt(0);
            const deploymentPool0Before = await rewardsBooster.deploymentPools(deploymentId0);
            const totalBoostBefore = await rewardsBooster.totalBoosterPoint();
            // migrate
            await upgrade();
            await rewardsBooster.connect(consumer0).removeBoosterDeployment(deploymentId0, etherParse('1'));
            // check boost changes
            const deploymentPool0After = await rewardsBooster.deploymentPools(deploymentId0);
            const deploymentPoolByType0After = await rewardsBooster.deploymentPoolsByType(deploymentId0);
            const totalBoostAfter = await rewardsBooster.totalBoosterPoint();
            const totalBoostByTypeAfter = await rewardsBooster.totalBoosterPointByType(ProjectType.SUBQUERY);
            expect(await rewardsBooster.getRunnerDeploymentBooster(deploymentId0, consumer0.address)).to.eq(
                etherParse('10000').sub(etherParse(1))
            );
            expect(await rewardsBooster.getRunnerDeploymentBoosterOld(deploymentId0, consumer0.address)).to.eq(0);

            expect(deploymentPool0After.boosterPoint).to.eq(etherParse('30000'));
            expect(deploymentPoolByType0After.boosterPoint).to.eq(etherParse('10000').sub(etherParse(1)));
            expect(totalBoostBefore.sub(totalBoostAfter)).to.eq(etherParse('10000'));
            expect(totalBoostByTypeAfter).to.eq(etherParse('10000').sub(etherParse(1)));
        });

        it('partially migrate to byType reward via swap (across project type)', async () => {
            // accumulate more rewards
            let [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.eq(0);
            await blockTravel(1000);
            [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.gt(0);
            const deploymentPool0Before = await rewardsBooster.deploymentPools(deploymentId0);
            const deploymentPool4Before = await rewardsBooster.deploymentPools(deploymentId4);
            const totalBoostBefore = await rewardsBooster.totalBoosterPoint();
            expect(deploymentPool0Before.boosterPoint).to.eq(etherParse('40000'));
            expect(deploymentPool4Before.boosterPoint).to.eq(etherParse('0'));
            // migrate
            await upgrade();
            await rewardsBooster
                .connect(consumer0)
                .swapBoosterDeployment(consumer0.address, deploymentId0, deploymentId3, etherParse('10000'));

            // check boost changes
            const deploymentPool0After = await rewardsBooster.deploymentPools(deploymentId0);
            const deploymentPoolByType0After = await rewardsBooster.deploymentPoolsByType(deploymentId0);
            const deploymentPoolByType4After = await rewardsBooster.deploymentPoolsByType(deploymentId3);
            const totalBoostAfter = await rewardsBooster.totalBoosterPoint();
            const totalBoostByTypeAfter = await rewardsBooster.totalBoosterPointByType(ProjectType.SUBQUERY);
            const totalBoostByTypeRPCAfter = await rewardsBooster.totalBoosterPointByType(ProjectType.RPC);
            expect(await rewardsBooster.getRunnerDeploymentBooster(deploymentId0, consumer0.address)).to.eq(0);
            expect(await rewardsBooster.getRunnerDeploymentBoosterOld(deploymentId0, consumer0.address)).to.eq(0);
            expect(await rewardsBooster.getRunnerDeploymentBooster(deploymentId3, consumer0.address)).to.eq(
                etherParse('10000')
            );
            expect(await rewardsBooster.getRunnerDeploymentBoosterOld(deploymentId3, consumer0.address)).to.eq(0);

            expect(deploymentPool0After.boosterPoint).to.eq(etherParse('30000'));
            expect(deploymentPoolByType0After.boosterPoint).to.eq(0);
            expect(deploymentPoolByType4After.boosterPoint).to.eq(etherParse('10000'));
            expect(totalBoostBefore.sub(totalBoostAfter)).to.eq(etherParse('10000'));
            expect(totalBoostByTypeAfter).to.eq(0);
            expect(totalBoostByTypeRPCAfter).to.eq(etherParse('10000'));
            // check allocation reward
            let tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            let evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(1); // from old rewards pool
            await blockTravel(1000);
            tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(0); // no rewards old pool
            tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId3, runner0.address);
            evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(1); // from new rewards pool
        });

        it('partially migrate to byType reward via spendQueryRewards()', async () => {
            // accumulate more rewards
            let [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.eq(0);
            // allow root to spend query reward
            await settings.setContractAddress(SQContracts.StateChannel, root.address);
            await blockTravel(1000);
            [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.gt(0);
            const deploymentPool0Before = await rewardsBooster.deploymentPools(deploymentId0);
            const totalBoostBefore = await rewardsBooster.totalBoosterPoint();
            expect(deploymentPool0Before.boosterPoint).to.eq(etherParse('40000'));
            // migrate
            await upgrade();
            await rewardsBooster.spendQueryRewards(deploymentId0, consumer0.address, etherParse('1'), '0x00');
            // check boost changes
            const deploymentPool0After = await rewardsBooster.deploymentPools(deploymentId0);
            const deploymentPoolByType0After = await rewardsBooster.deploymentPoolsByType(deploymentId0);
            const totalBoostAfter = await rewardsBooster.totalBoosterPoint();
            const totalBoostByTypeAfter = await rewardsBooster.totalBoosterPointByType(ProjectType.SUBQUERY);
            expect(await rewardsBooster.getRunnerDeploymentBooster(deploymentId0, consumer0.address)).to.eq(
                etherParse('10000')
            );
            expect(await rewardsBooster.getRunnerDeploymentBoosterOld(deploymentId0, consumer0.address)).to.eq(0);

            expect(deploymentPool0After.boosterPoint).to.eq(etherParse('30000'));
            expect(deploymentPoolByType0After.boosterPoint).to.eq(etherParse('10000'));
            expect(totalBoostBefore.sub(totalBoostAfter)).to.eq(etherParse('10000'));
            expect(totalBoostByTypeAfter).to.eq(etherParse('10000'));
            // check allocation reward
            const [alReward0After] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            let tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            let evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(2);
            await blockTravel(1000);
            tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(1);
        });

        it('partially migrate to byType reward via refundQueryRewards()', async () => {
            // accumulate more rewards
            let [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.eq(0);
            // allow root to spend query reward
            await settings.setContractAddress(SQContracts.StateChannel, root.address);
            await blockTravel(1000);
            [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.gt(0);
            const deploymentPool0Before = await rewardsBooster.deploymentPools(deploymentId0);
            const totalBoostBefore = await rewardsBooster.totalBoosterPoint();
            expect(deploymentPool0Before.boosterPoint).to.eq(etherParse('40000'));
            await rewardsBooster.spendQueryRewards(deploymentId0, consumer0.address, etherParse('1'), '0x00');
            // migrate
            await upgrade();
            await token.increaseAllowance(rewardsBooster.address, etherParse('1'));
            await rewardsBooster.refundQueryRewards(deploymentId0, consumer0.address, etherParse('1'), '0x00');
            // check boost changes
            const deploymentPool0After = await rewardsBooster.deploymentPools(deploymentId0);
            const deploymentPoolByType0After = await rewardsBooster.deploymentPoolsByType(deploymentId0);
            const totalBoostAfter = await rewardsBooster.totalBoosterPoint();
            const totalBoostByTypeAfter = await rewardsBooster.totalBoosterPointByType(ProjectType.SUBQUERY);
            expect(await rewardsBooster.getRunnerDeploymentBooster(deploymentId0, consumer0.address)).to.eq(
                etherParse('10000')
            );
            expect(await rewardsBooster.getRunnerDeploymentBoosterOld(deploymentId0, consumer0.address)).to.eq(0);

            expect(deploymentPool0After.boosterPoint).to.eq(etherParse('30000'));
            expect(deploymentPoolByType0After.boosterPoint).to.eq(etherParse('10000'));
            expect(totalBoostBefore.sub(totalBoostAfter)).to.eq(etherParse('10000'));
            expect(totalBoostByTypeAfter).to.eq(etherParse('10000'));
            // check allocation reward
            const [alReward0After] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            let tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            let evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(2);
            await blockTravel(1000);
            tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(1);
        });

        it('after migration query rewards refund to new pool', async () => {
            // accumulate more rewards
            let [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.eq(0);
            // allow root to spend query reward
            await settings.setContractAddress(SQContracts.StateChannel, root.address);
            await token.increaseAllowance(rewardsBooster.address, etherParse('2'));
            await blockTravel(1000);
            [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.gt(0);
            const deploymentPool0Before = await rewardsBooster.deploymentPools(deploymentId0);
            expect(deploymentPool0Before.boosterPoint).to.eq(etherParse('40000'));
            await rewardsBooster.spendQueryRewards(deploymentId0, consumer0.address, etherParse('1'), '0x00');
            // migrate
            await upgrade();
            await rewardsBooster.migrateDeploymentBoost(deploymentId0, consumer0.address);
            // query rewards from old pool
            const existingRewards = await rewardsBooster.getQueryRewards(deploymentId0, consumer0.address);
            await expect(
                rewardsBooster.refundQueryRewards(deploymentId0, consumer0.address, etherParse('2'), '0x00')
            ).to.revertedWith('RB007');
            await blockTravel(2000);
            // spend query rewards from old pool
            await rewardsBooster.spendQueryRewards(deploymentId0, consumer0.address, existingRewards, '0x00');
            // fail because neither old pool nor new pool has spent >= existingRewards X2
            await expect(
                rewardsBooster.refundQueryRewards(deploymentId0, consumer0.address, existingRewards.mul(2), '0x00')
            ).to.revertedWith('RB007');
            // spend query rewards from new pool
            await rewardsBooster.spendQueryRewards(deploymentId0, consumer0.address, existingRewards.mul(2), '0x00');
            // refund to new pool
            // await rewardsBooster.refundQueryRewards(deploymentId0, consumer0.address, existingRewards.mul(2), '0x00');
            await expect(
                rewardsBooster.refundQueryRewards(deploymentId0, consumer0.address, existingRewards.mul(2), '0x00')
            ).not.to.reverted;
        });

        it('fully migrate all boost to new pool, issuancePerBlock now by project type', async () => {
            // migrate
            await upgrade();
            await rewardsBooster.migrateDeploymentBoost(deploymentId0, consumer0.address);
            await rewardsBooster.migrateDeploymentBoost(deploymentId0, consumer1.address);
            await rewardsBooster.migrateDeploymentBoost(deploymentId1, consumer0.address);
            await rewardsBooster.migrateDeploymentBoost(deploymentId1, consumer1.address);
            await rewardsBooster.migrateDeploymentBoost(deploymentId1, consumer2.address);
            await rewardsBooster.migrateDeploymentBoost(deploymentId2, consumer0.address);
            await rewardsBooster.migrateDeploymentBoost(deploymentId2, consumer1.address);
            await rewardsBooster.migrateDeploymentBoost(deploymentId2, consumer2.address);
            // check
            const totalBoostAfter = await rewardsBooster.totalBoosterPoint();
            expect(totalBoostAfter).to.eq(0);
            // check reward pool setup
            await rewardsBooster.setIssuancePerBlockByType(ProjectType.RPC, 0);
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId1);
            const reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            const reward3 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
            await blockTravel(1000);
            const reward1After = await rewardsBooster.getAccRewardsForDeployment(deploymentId1);
            const reward2After = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            const reward3After = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
            expect(reward1After).to.gt(reward1);
            expect(reward2After).to.eq(reward2);
            expect(reward3After).to.eq(reward3);
        });

        it('boost query rewards can be inherit over', async () => {
            // allow root to spend query reward
            await settings.setContractAddress(SQContracts.StateChannel, root.address);
            // get consumer0 query rewards
            const queryReward0Before = await rewardsBooster.getQueryRewards(deploymentId0, consumer0.address);
            expect(queryReward0Before).to.gt(0);
            // migrate
            await upgrade();
            await rewardsBooster.migrateDeploymentBoost(deploymentId0, consumer0.address);
            // check query rewards
            const queryReward0After = await rewardsBooster.getQueryRewards(deploymentId0, consumer0.address);
            expect(queryReward0After).to.gt(queryReward0Before);
            await blockTravel(10);
            // spent query reward
            const queryReward0After2 = await rewardsBooster.getQueryRewards(deploymentId0, consumer0.address);
            expect(queryReward0After2).to.gt(queryReward0After);
            const tx = await rewardsBooster.spendQueryRewards(
                deploymentId0,
                consumer0.address,
                queryReward0After2,
                '0x00'
            );
            const evts = await eventsFrom(tx, rewardsBooster, 'QueryRewardsSpent(bytes32,address,uint256,bytes)');
            expect(evts.length).to.eq(2);
            expect(evts[0].amount.add(evts[1].amount)).to.eq(queryReward0After2);
        });

        /**
         * issurance per block: 10 SQT
         * deployment0 boost: 40k, percentage is 40%
         * allocation reward ratio is 1:1
         * runner0 has 1000 SQT allocation, percentage is 25%
         * runner0's allocation reward is 10 * 0.40 * 0.5 * 0.25 = 0.5 SQT per block
         * ------ after migration
         * new issurance per block for SubQuery: 10 SQT
         * only deployment0's boost migrated, percentage is 100%
         * runner0's allocation reward should be 10 * 1 * 0.5 * 0.25 = 1.25 SQT per block
         */
        it('allocation reward should carry over', async () => {
            // accumulate more rewards
            let [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.eq(0);
            await blockTravel(1000);
            [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            expect(alReward0).to.eq(etherParse('500'));
            console.log(`alReward0: ${alReward0.toString()}`);
            // migrate
            await upgrade();
            await rewardsBooster.migrateDeploymentBoost(deploymentId0, consumer0.address);
            const [alReward0After] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            // no block pass since upgrade
            expect(alReward0After).to.eq(0);
            console.log(`alReward0After: ${alReward0After.toString()}`);
            await blockTravel(999);
            const [alReward0After2] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            console.log(`alReward0After2: ${alReward0After2.toString()}`);
            const tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            const evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(2);
            // 1 block passed (upgrade) since we queried alReward0, so we should get 1 SQT more
            expect(evts[0].amount).to.eq(etherParse('500.5'));
            // 1000 blocks passed (999 + collectAllocationReward) since we queried alReward0,
            // so we should get 1.25 * 1000 = 1250 SQT reward
            expect(evts[1].amount).to.eq(etherParse('1250'));
        });

        // missed labor will carry over
        /**
         * block time: default to 1s in hardhat
         * issurance per block: 10 SQT
         * deployment0 boost: 40k, percentage is 40%
         * allocation reward ratio is 1:1
         * runner0 has 1000 SQT allocation, percentage is 25%
         * runner0's allocation reward is 10 * 0.40 * 0.5 * 0.25 = 0.5 SQT per block
         * ------ after migration
         * new issurance per block for SubQuery: 10 SQT
         * only deployment0's boost migrated, percentage is 100%
         * runner0's allocation reward should be 10 * 1 * 0.5 * 0.25 = 1.25 SQT per block
         */
        it('allocation reward should carry over with missed labor', async () => {
            await rewardsBooster.setReporter(root.address, true);
            await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            const lastClaimedAt = await lastestBlockTime();
            await blockTravel(999, 1);
            const lastClaimedAt2 = await lastestBlockTime();
            console.log(`time passed： ${lastClaimedAt2 - lastClaimedAt}`);
            await rewardsBooster.setMissedLabor(
                [deploymentId0],
                [runner0.address],
                [false],
                [900],
                lastClaimedAt + 1000
            );
            const [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            // without misslabor should have 500 SQT (0.5 SQT * 1000 blocks)
            // misslabor is 900 sec in 1000 sec, so final rewards become 500*(100 sec/1000 sec) = 50 SQT
            expect(alReward0).to.eq(etherParse('50'));
            console.log(`alReward0: ${alReward0.toString()}`);
            // migrate
            await upgrade();
            await rewardsBooster.migrateDeploymentBoost(deploymentId0, consumer0.address);

            let tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            let evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(2);
            // 3 block passed (upgrade, migrateDeploymentBoost, collectAllocationReward) since we queried alReward0,
            // and 1 of them counts on old rewards, so we should get 500.5 SQT * 103 (availabe secs) / 1003 (total secs) = 51.397308075772681954
            expect(evts[0].amount.div((1e15).toString())).to.eq('51397');
            console.log(`evts[0]: ${evts[0].amount.toString()}`); //51.397308075772681954
            // 1 block(collectAllocationReward) passed for new reward pool, so we should get 1.25 SQT more
            console.log(`evts[1]: ${evts[1].amount.toString()}`);
            expect(evts[1].amount).to.eq(etherParse('1.25'));
            await blockTravel(999);
            tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(1);
            // 1000 blocks passed (999 + collectAllocationReward) since we queried alReward0,
            // so we should get 1.25 * 1000 = 1250 SQT reward
            expect(evts[0].amount).to.eq(etherParse('1250'));
        });
        // mislabor disable: true
        it('allocation reward should carry over with missed labor (disable: true)', async () => {
            await rewardsBooster.setReporter(root.address, true);
            await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            const lastClaimedAt = await lastestBlockTime();
            await blockTravel(999, 1);
            const lastClaimedAt2 = await lastestBlockTime();
            console.log(`time passed： ${lastClaimedAt2 - lastClaimedAt}`);
            await rewardsBooster.setMissedLabor([deploymentId0], [runner0.address], [true], [0], lastClaimedAt + 1000);
            const [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            // disable -> true, so all following time should be counted as misslabor
            expect(alReward0).to.eq(0);
            // migrate
            await upgrade();
            await rewardsBooster.migrateDeploymentBoost(deploymentId0, consumer0.address);

            await blockTravel(999, 1);
            let tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            let evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(0);

            const lastClaimedAt3 = await lastestBlockTime();
            await rewardsBooster.setMissedLabor([deploymentId0], [runner0.address], [false], [0], lastClaimedAt3 + 1);
            await blockTravel(998, 1);
            tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            expect(evts.length).to.eq(1);
            console.log(`evts[0]: ${evts[0].amount.toString()}`);
            // 1000 blocks passed (998 + setMissedLabor + collectAllocationReward) since we last collectAllocationReward,
            // so we should get 1.25 * 1000 = 1250 SQT reward
            expect(evts[0].amount).to.eq(etherParse('1250'));
        });

        // overallocate will carry over
        // runner0 has allocated 4000 SQT, with 1000 SQT delegated, can allocate 7000 SQT more
        it.only('overallocate status will carry over', async () => {
            // delegate0 to runner0
            await token.connect(root).transfer(delegator0.address, etherParse('1000'));
            await token.connect(delegator0).increaseAllowance(staking.address, etherParse('1000'));
            await stakingManager.connect(delegator0).delegate(runner0.address, etherParse('1000'));
            await startNewEra(eraManager);
            const totalStake0 = await staking.totalStakingAmount(runner0.address);
            expect(totalStake0.valueAt).to.eq(etherParse('11000'));

            await stakingAllocation.connect(runner0).addAllocation(runner0.address, deploymentId3, etherParse('7000'));
            await stakingManager.connect(runner0).unstake(runner0.address, etherParse('1000'));
            await startNewEra(eraManager);
            await rewardsHelper.connect(runner0).indexerCatchup(runner0.address);

            // await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            // const lastClaimedAt = await lastestBlockTime();
            // await blockTravel(999, 1);
            // const lastClaimedAt2 = await lastestBlockTime();
            // console.log(`time passed： ${lastClaimedAt2 - lastClaimedAt}`);
            // await rewardsBooster.setMissedLabor([deploymentId0], [runner0.address], [true], [0], lastClaimedAt+1000);
            // let [alReward0] = await rewardsBooster.getAllocationRewards(deploymentId0, runner0.address);
            // // disable -> true, so all following time should be counted as misslabor
            // expect(alReward0).to.eq(0);
            // // migrate
            // await upgrade();
            // await rewardsBooster.migrateDeploymentBoost(deploymentId0, consumer0.address);
            //
            // await blockTravel(999, 1);
            // let tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            // let evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            // expect(evts.length).to.eq(0);
            //
            // const lastClaimedAt3 = await lastestBlockTime();
            // await rewardsBooster.setMissedLabor([deploymentId0], [runner0.address], [false], [0], lastClaimedAt3+1);
            // await blockTravel(998, 1);
            // tx = await rewardsBooster.connect(runner0).collectAllocationReward(deploymentId0, runner0.address);
            // evts = await eventsFrom(tx, rewardsBooster, 'AllocationRewardsGiven(bytes32,address,uint256)');
            // expect(evts.length).to.eq(1);
            // console.log(`evts[0]: ${evts[0].amount.toString()}`);
            // // 1000 blocks passed (998 + setMissedLabor + collectAllocationReward) since we last collectAllocationReward,
            // // so we should get 1.25 * 1000 = 1250 SQT reward
            // expect(evts[0].amount).to.eq(etherParse('1250'));
        });
    });
});
