// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { DisputeManager, EraManager, IndexerRegistry, RewardsDistributer, RewardsHelper, RewardsStaking, SQToken, Staking, StakingManager } from '../src';
import { DEPLOYMENT_ID } from './constants';
import { etherParse, registerIndexer, startNewEra, time } from './helper';
import { deployContracts } from './setup';

describe('Dispute Manager Contract', () => {
    const mockProvider = waffle.provider;
    let root, indexer, fisherman;
    let disputeManager: DisputeManager;
    let token: SQToken;
    let staking: Staking;
    let stakingManager: StakingManager;
    let indexerRegistry: IndexerRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributer;
    let rewardsStaking: RewardsStaking;
    let rewardsHelper: RewardsHelper;

    beforeEach(async () => {
        [root, indexer, fisherman] = await ethers.getSigners();
        const deployment = await deployContracts(root, root);
        disputeManager = deployment.disputeManager;
        token = deployment.token;
        staking = deployment.staking;
        stakingManager = deployment.stakingManager;
        indexerRegistry = deployment.indexerRegistry;
        eraManager = deployment.eraManager;
        rewardsDistributor = deployment.rewardsDistributer;
        rewardsStaking = deployment.rewardsStaking;
        rewardsHelper = deployment.rewardsHelper;
        await eraManager.updateEraPeriod(time.duration.days(5).toString());
        await token.connect(fisherman).increaseAllowance(disputeManager.address, etherParse("1000"));
        await registerIndexer(token, indexerRegistry, staking, root, indexer, '2000');
    });

    it('set MinimumDeposit should work', async () => {
        expect(await disputeManager.minimumDeposit()).to.equal(etherParse('1000'));
        await disputeManager.setMinimumDeposit(etherParse('10'));
        expect(await disputeManager.minimumDeposit()).to.equal(etherParse('10'));
    });

    describe('Create Dispute', () => {
        it('createDispute should work', async () => {
            await token.connect(root).transfer(fisherman.address, etherParse("1000"));
            await expect(disputeManager.connect(fisherman).createDispute(indexer.address, DEPLOYMENT_ID, etherParse('1000'), 0))
            .to.be.emit(disputeManager, 'DisputeOpen')
            .withArgs(1, fisherman.address, indexer.address, 0);

            expect(await disputeManager.nextDisputeId()).to.equal(2);
            expect(await disputeManager.disputeIdByIndexer(indexer.address,0)).to.equal(1);

            const dispute = await disputeManager.disputes(1);
            expect(dispute.disputeId).to.equal(1);
            expect(dispute.indexer).to.equal(indexer.address);
            expect(dispute.fisherman).to.equal(fisherman.address);
            expect(dispute.depositAmount).to.equal(etherParse('1000'));
            expect(dispute.deploymentId).to.equal(DEPLOYMENT_ID);
            expect(dispute.dtype).to.equal(0);
            expect(dispute.state).to.equal(0);

            expect(await token.balanceOf(fisherman.address)).equal(0);
        });

        it('createDispute not reach MinimumDeposit should fail', async () => {
            await token.connect(root).transfer(fisherman.address, etherParse("1000"));
            await expect(
                disputeManager.connect(fisherman).createDispute(indexer.address, DEPLOYMENT_ID, etherParse('10'), 0)
            ).to.be.revertedWith('D002');
        });

        it('createDispute on an indexer over 20 times should fail', async () => {
            await token.connect(root).transfer(fisherman.address, etherParse("1000"));
            await disputeManager.setMinimumDeposit(etherParse('1'));
            let count = 0;
            while(count <= 20){
                await disputeManager.connect(fisherman).createDispute(indexer.address, DEPLOYMENT_ID, etherParse('1'), 0);
                count++;
            }
            await expect(
                disputeManager.connect(fisherman).createDispute(indexer.address, DEPLOYMENT_ID, etherParse('1'), 0)
            ).to.be.revertedWith('D001');
        });
    });

    describe('finalizeDispute', () => {
        beforeEach(async () => {
            await token.connect(root).transfer(fisherman.address, etherParse("1000"));
            await token.connect(fisherman).increaseAllowance(disputeManager.address, etherParse('1000'));
            await disputeManager.connect(fisherman).createDispute(indexer.address, DEPLOYMENT_ID, etherParse('1000'), 0);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);

        });

        it('accept dispute with indexer has 0 unbonding amount should work', async () => {
            expect(await disputeManager.finalizeDispute(1, 1, etherParse('10'), etherParse('1005')))
                .to.be.emit(disputeManager, 'DisputeManager')
                .withArgs(1, 1, etherParse('10'), etherParse('1005'));
            expect(await stakingManager.getTotalStakingAmount(indexer.address)).equal(etherParse('1990'));
            expect(await token.balanceOf(fisherman.address)).equal(etherParse('1005'));
        });

        it('accept dispute with indexer has unbonding amount > slash amount should work', async () => {
            await stakingManager.connect(indexer).unstake(indexer.address, etherParse('2'));
            await stakingManager.connect(indexer).unstake(indexer.address, etherParse('10'));
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsStaking.applyStakeChange(indexer.address, indexer.address);

            expect(await stakingManager.getTotalStakingAmount(indexer.address)).equal(etherParse('1988'));
            await disputeManager.finalizeDispute(1, 1, etherParse('11'), etherParse('1005'));
            expect(await stakingManager.getTotalStakingAmount(indexer.address)).equal(etherParse('1988'));

            expect(await token.balanceOf(fisherman.address)).equal(etherParse('1005'));

            expect((await stakingManager.getUnbondingAmounts(indexer.address))[0].amount).equal(etherParse('1'));

            let dispute = await disputeManager.disputes(1);
            expect(dispute.state).to.equal(1);
        });

        it('accept dispute with indexer has unbonding amount = slash amount should work', async () => {
            await stakingManager.connect(indexer).unstake(indexer.address, etherParse('2'));
            await stakingManager.connect(indexer).unstake(indexer.address, etherParse('10'));
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsStaking.applyStakeChange(indexer.address, indexer.address);

            expect(await stakingManager.getTotalStakingAmount(indexer.address)).equal(etherParse('1988'));
            await disputeManager.finalizeDispute(1, 1, etherParse('12'), etherParse('1005'));
            expect(await stakingManager.getTotalStakingAmount(indexer.address)).equal(etherParse('1988'));

            expect(await token.balanceOf(fisherman.address)).equal(etherParse('1005'));

            expect((await stakingManager.getUnbondingAmounts(indexer.address)).length).equal(0);

            const dispute = await disputeManager.disputes(1);
            expect(dispute.state).to.equal(1);
        });

        it('accept dispute with indexer has unbonding amount < slash amount should work', async () => {
            await stakingManager.connect(indexer).unstake(indexer.address, etherParse('2'));
            await stakingManager.connect(indexer).unstake(indexer.address, etherParse('10'));
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsStaking.applyStakeChange(indexer.address, indexer.address);

            expect(await stakingManager.getTotalStakingAmount(indexer.address)).equal(etherParse('1988'));
            await disputeManager.finalizeDispute(1, 1, etherParse('13'), etherParse('1005'));
            expect(await stakingManager.getTotalStakingAmount(indexer.address)).equal(etherParse('1987'));

            expect(await token.balanceOf(fisherman.address)).equal(etherParse('1005'));

            expect((await stakingManager.getUnbondingAmounts(indexer.address)).length).equal(0);

            const dispute = await disputeManager.disputes(1);
            expect(dispute.state).to.equal(1);
        });

        it('reject dispute should work', async () => {
            await disputeManager.finalizeDispute(1, 2, 0, etherParse('900'));
            expect(await stakingManager.getTotalStakingAmount(indexer.address)).equal(etherParse('2000'));
            expect(await token.balanceOf(fisherman.address)).equal(etherParse('900'));

            const dispute = await disputeManager.disputes(1);
            expect(dispute.state).to.equal(2);
        });

        it('cancel dispute should work', async () => {
            await disputeManager.finalizeDispute(1, 3, 0, etherParse('1000'));
            expect(await stakingManager.getTotalStakingAmount(indexer.address)).equal(etherParse('2000'));
            expect(await token.balanceOf(fisherman.address)).equal(etherParse('1000'));

            const dispute = await disputeManager.disputes(1);
            expect(dispute.state).to.equal(3);
        });

        it('finalizeDispute with invaild parameter should fail', async () => {
            await expect(
                disputeManager.finalizeDispute(1, 1, etherParse('13'), etherParse('2000'))
            ).to.be.revertedWith('D005');

            await expect(
                disputeManager.finalizeDispute(1, 1, etherParse('13'), etherParse('900'))
            ).to.be.revertedWith('D005');

            await expect(
                disputeManager.finalizeDispute(1, 2, 0, etherParse('1100'))
            ).to.be.revertedWith('D005');

            await expect(
                disputeManager.finalizeDispute(1, 3, 0, etherParse('100'))
            ).to.be.revertedWith('D005');
        });

        it('indexer cannot widthdraw if on dispute', async () => {
            await stakingManager.connect(indexer).unstake(indexer.address, etherParse('2'));
            await expect(
                stakingManager.connect(indexer).widthdraw()
            ).to.be.revertedWith('G006');
        });
    });
});
