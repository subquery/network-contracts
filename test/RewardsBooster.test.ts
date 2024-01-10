// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
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
    SQContracts,
    Staking
} from '../src';
import { deploymentIds, deploymentMetadatas, METADATA_HASH, projectMetadatas } from './constants';
import { blockTravel, etherParse, eventFrom, time } from './helper';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

const PER_MILL = BigNumber.from(1e6);

describe('RewardsBooster Contract', () => {
    const deploymentId0 = deploymentIds[0];
    const deploymentId1 = deploymentIds[1];
    const deploymentId2 = deploymentIds[2];
    const deploymentId3 = deploymentIds[3];

    const mockProvider = waffle.provider;
    let root: SignerWithAddress, indexer0: SignerWithAddress, indexer1: SignerWithAddress, indexer2: SignerWithAddress,
        consumer0: SignerWithAddress, consumer1: SignerWithAddress;

    let token: ERC20;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsBooster: RewardsBooster;
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
    }

    const createProject = (wallet, projectMetadata, deploymentMetadata, deploymentId, projectType: ProjectType) => {
        return projectRegistry.connect(wallet).createProject(
            projectMetadata,
            deploymentMetadata,
            deploymentId,
            projectType,
        );
    };

    const getAllocationReward = (deploymentReward: BigNumber, queryRewardRatePerMill: BigNumber): BigNumber => {
        return deploymentReward.mul(PER_MILL.sub(queryRewardRatePerMill)).div(PER_MILL);
    }

    const getQueryReward = (deploymentReward: BigNumber, queryRewardRatePerMill: BigNumber): BigNumber => {
        return deploymentReward.mul(queryRewardRatePerMill).div(PER_MILL);
    }

    const getStats = async () => {
        const [
            accRewardsPerBoosterLastBlockUpdated,
            accRewardsPerBooster,
            newRewardsPerBooster,
            totalBoosterPoints,
            deployment0,
            deployment1,
            deployment2,
        ] = await Promise.all([
            rewardsBooster.accRewardsPerBoosterLastBlockUpdated(),
            rewardsBooster.getAccRewardsPerBooster(),
            rewardsBooster.getNewRewardsPerBooster(),
            rewardsBooster.totalBoosterPoint(),
            rewardsBooster.deploymentPools(deploymentId0),
            rewardsBooster.deploymentPools(deploymentId1),
            rewardsBooster.deploymentPools(deploymentId2),
        ]);
        return {
            accRewardsPerBooster: accRewardsPerBooster.toString(),
            accRewardsPerBoosterLastBlockUpdated: accRewardsPerBoosterLastBlockUpdated.toString(),
            newRewardsPerBooster: newRewardsPerBooster.toString(),
            totalBoosterPoints: totalBoosterPoints.toString(),
            deployment0,
            deployment1,
            deployment2,
        };
    }


    const deployer = () => deployContracts(root, root);
    before(async () => {
        [root, indexer0, indexer1, indexer2, consumer0, consumer1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        eraManager = deployment.eraManager;
        rewardsBooster = deployment.rewardsBooster;
        projectRegistry = deployment.projectRegistry;
        await deployment.settings.setContractAddress(SQContracts.Treasury, root.address);

        // config rewards booster
        await rewardsBooster.setBoosterQueryRewardRate(ProjectType.SUBQUERY, 5e5); // 50%
        await rewardsBooster.setBoosterQueryRewardRate(ProjectType.RPC, 9e5); // 90%
        await rewardsBooster.setReporter(root.address, true);

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
    });

    describe("boost deployments", () => {
        it('can add and remove booster to a deployment', async () => {
            const boosterAmount = etherParse('1000');
            const balanceBefore = await token.balanceOf(root.address);
            await token.increaseAllowance(rewardsBooster.address, boosterAmount);
            await rewardsBooster.boostDeployment(deploymentId0, boosterAmount);
            expect(await rewardsBooster.getIndexerDeploymentBooster(deploymentId0, root.address))
                .to.eq(boosterAmount);
            let balanceAfter = await token.balanceOf(root.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(boosterAmount);
            await rewardsBooster.removeBoosterDeployment(deploymentId0, boosterAmount);
            expect(await token.balanceOf(root.address)).to.eq(balanceBefore);
        })

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
        })
        it('can not get booster reward if boosted token less than minimum', async () => {
            const perBlockReward = await rewardsBooster.issuancePerBlock();
            const boosterAmount = etherParse('9999');
            await boosterDeployment(root, deploymentId0, boosterAmount);
            let reward = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            expect(reward).to.eq(0);
            await blockTravel(mockProvider, 1000);
            reward = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            expect(reward).to.eq(0);
        })

        it('can query deployment rewards, complex scene', async () => {
            const perBlockReward = await rewardsBooster.issuancePerBlock();
            const boosterAmount = etherParse('10000');
            await boosterDeployment(indexer0, deploymentId0, boosterAmount);
            let blockNumber = await mockProvider.getBlockNumber();
            let reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            let reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId1);
            let reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            // let state1 = await getStats();
            await boosterDeployment(indexer1, deploymentId0, boosterAmount);
            await boosterDeployment(indexer1, deploymentId1, boosterAmount.mul(2));
            // let state2 = await getStats();
            await boosterDeployment(root, deploymentId2, boosterAmount);
            await blockTravel(mockProvider, 1000 - ((await mockProvider.getBlockNumber()) - blockNumber));

            reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId1);
            reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            expect(reward0.add(reward1).add(reward2)).to.eq(perBlockReward.mul(1000));
        })

        describe.only("free query from deployment booster", () => {
            it('can query entitled free query quota', async () => {
                const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.RPC);
                // booster a deployment
                await boosterDeployment(consumer0, deploymentId3, etherParse('10000'));
                // wait some blocks
                await blockTravel(mockProvider, 1000);
                // query free query quota
                const queryReward = await rewardsBooster.getQueryRewards(deploymentId3, consumer0.address);
                const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId3);
                expect(queryReward).to.eq(getQueryReward(reward0, queryRewardRatePerMill));
                // remove booster
                // free query quota become 0
            })

            it.skip('can spend free query in state channel', () => {

            })
        })
    });

    describe("allocation for deployments", () => {
        beforeEach(async () => {
            await boosterDeployment(root, deploymentId0, etherParse('10000'));
            await boosterDeployment(root, deploymentId1, etherParse('10000'));
        })
        it("can add allocation", async () => {
            const tx = await rewardsBooster.connect(indexer0)
                .allocate(deploymentId0, indexer0.address, etherParse('1000'));
            const {allocationId} = await eventFrom(tx, rewardsBooster, 'StakeAllocated(uint256,bytes32,address,uint256)');
            expect(allocationId).to.exist;
            const allocation = await rewardsBooster.allocations(allocationId);
            expect(allocation.amount).to.eq(etherParse('1000'));
        })
        it("can query allocation reward", async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await blockTravel(mockProvider, 1000);
            let reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            const tx = await rewardsBooster.connect(indexer0)
                .allocate(deploymentId0, indexer0.address, etherParse('1000'));

            const {allocationId} = await eventFrom(tx, rewardsBooster, 'StakeAllocated(uint256,bytes32,address,uint256)');
            reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            let [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            expect(reward0).to.gt(0);
            expect(allocReward).to.eq(0);
            await blockTravel(mockProvider, 500);
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            expect(allocReward).to.eq(reward1.sub(reward0).mul(PER_MILL.sub(queryRewardRatePerMill)).div(PER_MILL));
            await rewardsBooster.connect(indexer1)
                .allocate(deploymentId0, indexer1.address, etherParse('1000'));
            const accRewardsPerAllocatedToken = await rewardsBooster.getAccRewardsPerAllocatedToken(deploymentId0);
            await blockTravel(mockProvider, 500);
            const reward = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            const allo2 = await rewardsBooster.allocations(allocationId.add(1));
            [allocReward] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            const allocReward2 = await rewardsBooster.getRewards(deploymentId0, indexer1.address);
            console.log()
        })

        it("set missed labor will affact allocation reward", async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            const tx = await rewardsBooster.connect(indexer0)
                .allocate(deploymentId0, indexer0.address, etherParse('1000'));
            const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            const blockNum = await mockProvider.getBlockNumber();
            await blockTravel(mockProvider, 500);
            await rewardsBooster.setMissedLabor([deploymentId0], [indexer0.address], [100]);
            const blockNum2 = await mockProvider.getBlockNumber();
            await blockTravel(mockProvider, 1000 - (blockNum2 - blockNum));
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            const [allocReward, burntReward] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            expect(allocReward.add(burntReward)).to.eq(reward1.sub(reward0)
                .mul(PER_MILL.sub(queryRewardRatePerMill)).div(PER_MILL)
            );
            expect(allocReward.div(burntReward)).to.eq(9);
        })

        it("debug can claim allocation reward, single indexer", async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await blockTravel(mockProvider, 1000);
            await rewardsBooster.connect(indexer0)
                .allocate(deploymentId0, indexer0.address, etherParse('1000'));
            let reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            let [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            expect(reward0).to.gt(0);
            expect(allocReward).to.eq(0);
            await blockTravel(mockProvider, 500);
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            const state1 = await getStats();
            expect(allocReward).to.eq(getAllocationReward(reward1.sub(reward0), queryRewardRatePerMill));
            console.log(`allocReward: ${allocReward.toString()}`)
            await rewardsBooster.onAllocationUpdate(deploymentId0);
            const state2 = await getStats();
            // await blockTravel(mockProvider, 1);
            [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            console.log(`allocReward: ${allocReward.toString()}`)
        })

        it("can claim allocation reward, single indexer", async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await blockTravel(mockProvider, 1000);
            await rewardsBooster.connect(indexer0)
                .allocate(deploymentId0, indexer0.address, etherParse('1000'));
            let reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            let [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            expect(reward0).to.gt(0);
            expect(allocReward).to.eq(0);
            // accumulate rewards
            await blockTravel(mockProvider, 500);
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            expect(allocReward).to.eq(getAllocationReward(reward1.sub(reward0), queryRewardRatePerMill));
            // collect rewards
            await rewardsBooster.connect(indexer0).collectAllocationReward(deploymentId0, indexer0.address);
            [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            expect(allocReward).to.eq(0);
            const reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            // accumulate rewards
            await blockTravel(mockProvider, 500);
            const reward3 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            expect(allocReward).to.eq(getAllocationReward(reward3.sub(reward2), queryRewardRatePerMill));
            // collect second times
            await rewardsBooster.connect(indexer0).collectAllocationReward(deploymentId0, indexer0.address);
            [allocReward,] = await rewardsBooster.getRewards(deploymentId0, indexer0.address);
            expect(allocReward).to.eq(0);
        })

        it('allocate before boosted', async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await rewardsBooster.connect(indexer0)
                .allocate(deploymentId2, indexer0.address, etherParse('1000'));
            await rewardsBooster.connect(indexer1)
                .allocate(deploymentId2, indexer1.address, etherParse('1000'));
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            expect(reward1).to.eq(0);
            await boosterDeployment(root, deploymentId2, etherParse('10000'));
            await blockTravel(mockProvider, 1000);
            const stats = await getStats();
            const reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            const [allocReward1I0,] = await rewardsBooster.getRewards(deploymentId2, indexer0.address);
            const [allocReward1I1,] = await rewardsBooster.getRewards(deploymentId2, indexer1.address);
            expect(allocReward1I0).to.eq(allocReward1I1);
        });

        it("claim allocation reward, multiple indexer", async () => {
            const queryRewardRatePerMill = await rewardsBooster.boosterQueryRewardRate(ProjectType.SUBQUERY);
            await rewardsBooster.connect(indexer0)
                .allocate(deploymentId2, indexer0.address, etherParse('1000'));
            await rewardsBooster.connect(indexer1)
                .allocate(deploymentId2, indexer1.address, etherParse('1000'));
            await boosterDeployment(root, deploymentId2, etherParse('10000'));
            const reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            // accumulate rewards
            await blockTravel(mockProvider, 499);
            const [allocReward1I0,] = await rewardsBooster.getRewards(deploymentId2, indexer0.address);
            const [allocReward1I1,] = await rewardsBooster.getRewards(deploymentId2, indexer1.address);
            // allocate more
            let tx = await rewardsBooster.connect(indexer0)
                .allocate(deploymentId2, indexer0.address, etherParse('3000'));
            const {value: reward1I0} = await eventFrom(tx, token, 'Transfer(address,address,uint256)');
            await blockTravel(mockProvider, 500);
            const [allocReward2I0,] = await rewardsBooster.getRewards(deploymentId2, indexer0.address);
            const [allocReward2I1,] = await rewardsBooster.getRewards(deploymentId2, indexer1.address);
            const indexer0TotalReward = reward1I0.add(allocReward2I0);
            const indexer1TotalReward = allocReward2I1;
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            expect(reward1.sub(reward0).div(2)).to.eq(indexer0TotalReward.add(indexer1TotalReward));
            // allow some rounding errors
            expect(indexer0TotalReward.mul(7).sub(indexer1TotalReward.mul(13)).abs()).to.lt(20000);

        })

    })
});
