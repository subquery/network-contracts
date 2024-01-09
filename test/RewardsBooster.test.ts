// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { EraManager, ERC20, IndexerRegistry, RewardsBooster, Staking } from '../src';
import { deploymentIds, METADATA_HASH } from './constants';
import { blockTravel, etherParse, eventFrom, time } from './helper';
import { deployContracts } from './setup';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as console from "console";

describe('RewardsBooster Contract', () => {
    const deploymentId0 = deploymentIds[0];
    const deploymentId1 = deploymentIds[1];
    const deploymentId2 = deploymentIds[2];

    const mockProvider = waffle.provider;
    let root: SignerWithAddress, indexer0: SignerWithAddress, indexer1: SignerWithAddress, indexer2: SignerWithAddress,
        delegator0: SignerWithAddress, delegator1: SignerWithAddress;

    let token: ERC20;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsBooster: RewardsBooster;

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

    const getStats = async () => {
        const [
            accRewardsPerBoosterLastBlockUpdated,
            accRewardsPerBooster,
            newRewardsPerBooster,
            totalBoosterPoints,
            deployment0,
            deployment1,
        ] = await Promise.all([
            rewardsBooster.accRewardsPerBoosterLastBlockUpdated(),
            rewardsBooster.getAccRewardsPerBooster(),
            rewardsBooster.getNewRewardsPerBooster(),
            rewardsBooster.totalBoosterPoints(),
            rewardsBooster.deploymentPools(deploymentId0),
            rewardsBooster.deploymentPools(deploymentId1),
        ]);
        return {
            accRewardsPerBooster: accRewardsPerBooster.toString(),
            accRewardsPerBoosterLastBlockUpdated: accRewardsPerBoosterLastBlockUpdated.toString(),
            newRewardsPerBooster: newRewardsPerBooster.toString(),
            totalBoosterPoints: totalBoosterPoints.toString(),
            deployment1,
            deployment0,
        };
    }


    const deployer = () => deployContracts(root, root);
    before(async () => {
        [root, indexer0, indexer1, indexer2, delegator0, delegator1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        indexerRegistry = deployment.indexerRegistry;
        staking = deployment.staking;
        token = deployment.token;
        eraManager = deployment.eraManager;
        rewardsBooster = deployment.rewardsBooster;

        // Init indexer and delegator account.
        await token.connect(root).transfer(indexer0.address, etherParse('100000'));
        await token.connect(root).transfer(indexer1.address, etherParse('100000'));
        await token.connect(root).transfer(indexer2.address, etherParse('100000'));
        await token.connect(root).transfer(delegator0.address, etherParse('100000'));
        await token.connect(root).transfer(delegator1.address, etherParse('100000'));
        await token.connect(delegator0).increaseAllowance(staking.address, etherParse('100000'));
        await token.connect(delegator1).increaseAllowance(staking.address, etherParse('100000'));

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
            await blockTravel(mockProvider, 1000 - ((await mockProvider.getBlockNumber())-blockNumber) );

            reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId1);
            reward2 = await rewardsBooster.getAccRewardsForDeployment(deploymentId2);
            expect(reward0.add(reward1).add(reward2)).to.eq(perBlockReward.mul(1000));
        })

        describe("free query from deployment booster", () => {
            it('can query entitled free query quota', () => {
                // booster a deployment
                // wait some blocks
                // query free query quota
                // remove booster
                // free query quota become 0
            })

            it('can spend free query in state channel', () => {

            })
        })
    });

    describe("allocation for deployments", () => {
        beforeEach(async ()=>{
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
        it.only("can claim allocation reward", async () => {
            await blockTravel(mockProvider, 1000 );
            let reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            const tx = await rewardsBooster.connect(indexer0)
                .allocate(deploymentId0, indexer0.address, etherParse('1000'));

            const {allocationId} = await eventFrom(tx, rewardsBooster, 'StakeAllocated(uint256,bytes32,address,uint256)');
            reward0 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            let allocReward = await rewardsBooster.getRewards(allocationId);
            expect(reward0).to.gt(0);
            expect(allocReward).to.eq(0);
            await blockTravel(mockProvider, 500);
            const reward1 = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            allocReward = await rewardsBooster.getRewards(allocationId);
            expect(allocReward).to.eq(reward1.sub(reward0));
            await rewardsBooster.connect(indexer1)
                .allocate(deploymentId0, indexer1.address, etherParse('1000'));
            const accRewardsPerAllocatedToken = await rewardsBooster.getAccRewardsPerAllocatedToken(deploymentId0);
            await blockTravel(mockProvider, 500);
            const reward = await rewardsBooster.getAccRewardsForDeployment(deploymentId0);
            const allo2 = await rewardsBooster.allocations(allocationId.add(1));
            allocReward = await rewardsBooster.getRewards(allocationId);
            const allocReward2 = await rewardsBooster.getRewards(allocationId.add(1));
            console.log()
        })

        it("set missed labor will affact allocation reward", async () => {

        })
    })
});
