// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {Vesting, SQToken} from '../src';

import {futureTimestamp} from './helper';

describe('Vesting Contract', () => {
    const mockProvider = waffle.provider;
    let wallet, wallet1, wallet2, wallet3, wallet4, wallet5;
    let token: SQToken;
    let vesting: Vesting;
    let lockPeriod: number;
    let vestingPeriod: number;
    let vestingStartDate: number;

    const timeTravel = async (seconds: number) => {
        await mockProvider.send('evm_increaseTime', [seconds]);
        await mockProvider.send('evm_mine', []);
    };

    const units = (value: number) => ethers.utils.parseUnits(value.toString());

    before(async () => {
        [wallet, wallet1, wallet2, wallet3, wallet4, wallet5] = await ethers.getSigners();
        const deployment = await deployContracts(wallet, wallet);
        token = deployment.token;
        vesting = deployment.vesting;
        lockPeriod = 86400 * 30; // 2 month
        vestingPeriod = 86400 * 365; // 1 year
    });

    describe('Vesting', () => {
        it('add no initial unlock vesting plan', async () => {
            await expect(vesting.addVestingPlan(lockPeriod, vestingPeriod, 0))
                .to.be.emit(vesting, 'AddVestingPlan')
                .withArgs(0, lockPeriod, vestingPeriod, 0);
        });
        it('add full initial unlock vesting plan', async () => {
            await expect(vesting.addVestingPlan(lockPeriod, vestingPeriod, 100))
                .to.be.emit(vesting, 'AddVestingPlan')
                .withArgs(1, lockPeriod, vestingPeriod, 100);
        });
        it('add partial initial unlock vesting plan', async () => {
            await expect(vesting.addVestingPlan(lockPeriod, vestingPeriod, 20))
                .to.be.emit(vesting, 'AddVestingPlan')
                .withArgs(2, lockPeriod, vestingPeriod, 20);
        });
        it('try over unlock vesting plan', async () => {
            await expect(vesting.addVestingPlan(lockPeriod, vestingPeriod, 101)).to.be.revertedWith(
                'initial unlock percent should be equal or less than 100'
            );
        });
        it('query vesting plans', async () => {
            const plan0 = await vesting.plans(0);
            expect(plan0.lockPeriod).to.equal(lockPeriod);
            expect(plan0.vestingPeriod).to.equal(vestingPeriod);
            expect(plan0.initialUnlockPercent).to.equal(0);

            const plan1 = await vesting.plans(1);
            expect(plan1.lockPeriod).to.equal(lockPeriod);
            expect(plan1.vestingPeriod).to.equal(vestingPeriod);
            expect(plan1.initialUnlockPercent).to.equal(100);

            const plan2 = await vesting.plans(2);
            expect(plan2.lockPeriod).to.equal(lockPeriod);
            expect(plan2.vestingPeriod).to.equal(vestingPeriod);
            expect(plan2.initialUnlockPercent).to.equal(20);
        });

        it('deposit tokens by admin', async () => {
            await token.approve(vesting.address, units(10000));
            await vesting.depositByAdmin(units(10000));
            expect(await token.balanceOf(vesting.address)).to.equal(units(10000));
        });

        it('try invalid plan vesting allocation', async () => {
            await expect(vesting.allocateVesting(wallet1.address, 10, units(1000))).to.be.revertedWith(
                'invalid plan id'
            );
        });

        it('allocate vesting', async () => {
            await vesting.allocateVesting(wallet1.address, 0, units(1000));
        });
        it('check changes for vesting allocation', async () => {
            expect(await vesting.userPlanId(wallet1.address)).to.equal(0);
            expect(await vesting.allocations(wallet1.address)).to.equal(units(1000));
            expect(await vesting.totalAllocation()).to.equal(units(1000));
        });

        it('try setting another vesting on same address', async () => {
            await expect(vesting.allocateVesting(wallet1.address, 0, units(1000))).to.be.revertedWith(
                'vesting is already set on the account'
            );
        });

        it('try set vesting with non owner account', async () => {
            await expect(vesting.connect(wallet2).allocateVesting(wallet1.address, 0, units(1000))).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });

        it('try allocation on zero address', async () => {
            await expect(
                vesting.allocateVesting('0x0000000000000000000000000000000000000000', 0, units(1000))
            ).to.be.revertedWith('empty address is not allowed');
        });
        it('try allocating zero amount', async () => {
            await expect(vesting.allocateVesting(wallet2.address, 0, units(0))).to.be.revertedWith(
                'zero amount vesting is not allowed'
            );
        });

        it('try different count for batch allocate vesting', async () => {
            await expect(
                vesting.batchAllocateVesting(1, [wallet3.address, wallet4.address], [units(1000)])
            ).to.be.revertedWith('number of addresses should be same as number of vestingPeriods');
        });

        it('batch allocate vesting', async () => {
            await vesting.batchAllocateVesting(1, [wallet3.address, wallet4.address], [units(1000), units(1000)]);
            await vesting.batchAllocateVesting(2, [wallet5.address], [units(1000)]);
        });

        it('check invalid start date revert for zero', async () => {
            await expect(vesting.setVestingStartDate(0)).to.be.revertedWith('cannot set to zero vesting start date');
        });

        it('set vesting start date', async () => {
            let latestBlock = await mockProvider.getBlock('latest');
            vestingStartDate = latestBlock.timestamp + 200;
            await vesting.setVestingStartDate(vestingStartDate);
        });

        it('query vesting start date after first set', async () => {
            const startDate = await vesting.vestingStartDate();
            expect(startDate).to.equal(vestingStartDate);
        });

        it('reset vesting start date', async () => {
            let latestBlock = await mockProvider.getBlock('latest');
            vestingStartDate = latestBlock.timestamp + 300;
            await vesting.setVestingStartDate(vestingStartDate);
        });

        it('query vesting start date after reset', async () => {
            const startDate = await vesting.vestingStartDate();
            expect(startDate).to.equal(vestingStartDate);
        });

        it('reset vesting start date prior to current date', async () => {
            let latestBlock = await mockProvider.getBlock('latest');
            await expect(vesting.setVestingStartDate(latestBlock.timestamp - 10)).to.be.revertedWith(
                'cannot reset vesting start date after vesting start'
            );
        });

        it('check claimable amount before starting unlock', async () => {
            expect(await vesting.claimableAmount(wallet1.address)).to.equal(0);
        });

        it('try to reset vesting start date after vesting start', async () => {
            await timeTravel(1000 + lockPeriod);
            let latestBlock = await mockProvider.getBlock('latest');
            await expect(vesting.setVestingStartDate(latestBlock.timestamp - 100)).to.be.revertedWith(
                'cannot reset vesting start date after vesting start'
            );
        });

        it('query claimable amounts', async () => {
            expect(await vesting.claimableAmount(wallet1.address)).to.gt(0);
            expect(await vesting.claimableAmount(wallet3.address)).to.gt(0);
            expect(await vesting.claimableAmount(wallet4.address)).to.gt(0);
            expect(await vesting.claimableAmount(wallet5.address)).to.gt(0);
        });

        it('try claim on non vesting account', async () => {
            await expect(vesting.connect(wallet).claim()).to.be.revertedWith('vesting is not set on the account');
        });

        it('check balance before claim', async () => {
            const balance = await token.balanceOf(wallet1.address);
            expect(balance).to.eq(0);
        });

        it('try claim in the middle of vesting', async () => {
            await vesting.connect(wallet1).claim();
        });

        it('check balance after claim', async () => {
            const balance = await token.balanceOf(wallet1.address);
            expect(balance).to.gt(0);
        });

        it('try remaining claim after vesting finish', async () => {
            await timeTravel(vestingPeriod);
            await vesting.connect(wallet1).claim();
        });

        it('check balance after full claim', async () => {
            const balance = await token.balanceOf(wallet1.address);
            expect(balance).to.eq(units(1000));
        });

        it('try withdrawing with non-owner', async () => {
            await expect(vesting.connect(wallet1).withdrawAllByAdmin()).to.be.reverted;
        });

        it('withdraw all by admin', async () => {
            await vesting.withdrawAllByAdmin();
        });
    });

    describe('Vesting Claim', () => {
        beforeEach(async () => {
            const deployment = await deployContracts(wallet, wallet);
            token = deployment.token;
            vesting = deployment.vesting;
            lockPeriod = 86400 * 30; // 2 month
            vestingPeriod = 86400 * 365; // 1 year
        });

        async function createPlan(): Promise<number> {
            const tx = await vesting.addVestingPlan(lockPeriod, vestingPeriod, 10);
            const receipt = await tx.wait();
            const event = receipt.events?.[0];
            return event?.args?.[0]?.toNumber();
        }

        it('claim before start date', async () => {
            const planId = await createPlan();
            await vesting.setVestingStartDate(await futureTimestamp(mockProvider, 2));
            await vesting.batchAllocateVesting(planId, [wallet1.address, wallet2.address], [units(1000), units(3000)]);
            await token.approve(vesting.address, units(4000));
            await vesting.depositByAdmin(units(4000));
            const total = await vesting.totalAllocation();
            const balance = await token.balanceOf(vesting.address);
            expect(total).to.eq(balance);
            await timeTravel(lockPeriod + 10);
            let claimable1 = await vesting.claimableAmount(wallet1.address);
            expect(claimable1).to.gt(units(100));
            expect(claimable1).to.lt(units(100.001));
            const claimable2 = await vesting.claimableAmount(wallet2.address);
            expect(claimable2).to.gt(units(300));
            expect(claimable2).to.lt(units(300.002));
            await vesting.connect(wallet1).claim();
            await timeTravel(vestingPeriod / 2);
            claimable1 = await vesting.claimableAmount(wallet1.address);
            expect(claimable1).to.gte(units(450));
            await vesting.connect(wallet1).claim();
            await timeTravel(vestingPeriod / 2);
            await vesting.connect(wallet1).claim();
            const balance1_2 = await token.balanceOf(wallet1.address);
            expect(balance1_2).to.eq(units(1000));
        });
    });
});
