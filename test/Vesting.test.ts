// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { Wallet } from "@ethersproject/wallet";
import { expect } from 'chai';
import { BigNumber } from "ethers";
import { ethers, waffle } from 'hardhat';
import { SQToken, Vesting } from '../src';
import { eventFrom } from "./helper";
import { deployContracts } from './setup';

describe('Vesting Contract', () => {
    const mockProvider = waffle.provider;
    const [wallet, wallet1, wallet2, wallet3, wallet4] = mockProvider.getWallets();

    let token: SQToken;
    let vestingContract: Vesting;
    let lockPeriod: number;
    let vestingPeriod: number;
    let initialUnlockPercent = 10;

    async function claimVesting(wallet: Wallet): Promise<{user: string, amount: BigNumber}> {
        const tx = await vestingContract.connect(wallet).claim();
        const evt = await eventFrom(tx, vestingContract, 'VestingClaimed(address,uint256)');
        return evt as any;
    }

    const timeTravel = async (seconds: number) => {
        await mockProvider.send('evm_increaseTime', [seconds]);
        await mockProvider.send('evm_mine', []);
    };

    const parseEther = (value: number) => ethers.utils.parseEther(value.toString());

    const ownableRevert = 'Ownable: caller is not the owner';

    async function createPlan(lockPeriod: number, vestingPeriod: number): Promise<number> {
        const tx = await vestingContract.addVestingPlan(lockPeriod, vestingPeriod, initialUnlockPercent);
        const receipt = await tx.wait();
        const event = receipt.events?.[0];
        return event?.args?.[0]?.toNumber();
    }

    const startVesting = async () => {
        const latestBlock = await mockProvider.getBlock('latest');
        const vestingStart = latestBlock.timestamp + 1000;
        await vestingContract.startVesting(vestingStart);
    };

    const checkVestingPlan = async (planId: number, unlockPercent: number) => {
        const plan = await vestingContract.plans(planId);
        expect(plan.lockPeriod).to.equal(lockPeriod);
        expect(plan.vestingPeriod).to.equal(vestingPeriod);
        expect(plan.initialUnlockPercent).to.equal(unlockPercent);
    };

    const checkAllocation = async (planId: number, user: string, allocation: number) => {
        expect(await vestingContract.userPlanId(user)).to.equal(planId);
        expect(await vestingContract.allocations(user)).to.equal(parseEther(allocation));
    };

    beforeEach(async () => {
        const deployment = await deployContracts(wallet, wallet1);
        token = deployment.token;
        vestingContract = deployment.vesting;
        lockPeriod = 86400 * 30; // 2 month
        vestingPeriod = 86400 * 365; // 1 year

        await token.approve(vestingContract.address, parseEther(4000));
    });

    describe('Vesting Plan', () => {
        it('add vesting plan should work', async () => {
            // 0 initial unlock
            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 0))
                .to.be.emit(vestingContract, 'VestingPlanAdded')
                .withArgs(0, lockPeriod, vestingPeriod, 0);
            // 100% initial unlock
            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 100))
                .to.be.emit(vestingContract, 'VestingPlanAdded')
                .withArgs(1, lockPeriod, vestingPeriod, 100);
            // 30% initial unlock
            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 30))
                .to.be.emit(vestingContract, 'VestingPlanAdded')
                .withArgs(2, lockPeriod, vestingPeriod, 30);

            await checkVestingPlan(0, 0);
            await checkVestingPlan(1, 100);
            await checkVestingPlan(2, 30);
        });

        it('initial unlock percent over 100 should fail', async () => {
            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 101)).to.be.revertedWith(
                'V001'
            );
        });
    });

    describe('Allocate Vestring', () => {
        beforeEach(async () => {
            await vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 10);
        });

        it('allocate vesting should work', async () => {
            await vestingContract.allocateVesting(wallet1.address, 0, parseEther(1000));
            await checkAllocation(0, wallet1.address, 1000);
            expect(await vestingContract.totalAllocation()).to.equal(parseEther(1000));
        });

        it('batch allocate vesting should work', async () => {
            await vestingContract.batchAllocateVesting(
                0,
                [wallet1.address, wallet2.address],
                [parseEther(1000), parseEther(3000)]
            );

            await checkAllocation(0, wallet1.address, 1000);
            await checkAllocation(0, wallet2.address, 3000);
            expect(await vestingContract.totalAllocation()).to.equal(parseEther(4000));
        });

        it('allocate with invaid config should fail', async () => {
            // not onwer
            await expect(
                vestingContract.connect(wallet2).allocateVesting(wallet1.address, 0, parseEther(1000))
            ).to.be.revertedWith(ownableRevert);
            // empty address
            const emptyAddress = '0x0000000000000000000000000000000000000000';
            await expect(vestingContract.allocateVesting(emptyAddress, 0, parseEther(1000))).to.be.revertedWith(
                'V002'
            );
            // duplicate account
            await vestingContract.allocateVesting(wallet1.address, 0, parseEther(1000));
            await expect(vestingContract.allocateVesting(wallet1.address, 0, parseEther(1000))).to.be.revertedWith(
                'V003'
            );
            // zero amount
            await expect(vestingContract.allocateVesting(wallet2.address, 0, parseEther(0))).to.be.revertedWith(
                'V004'
            );
            // invalid plan id
            await expect(vestingContract.allocateVesting(wallet2.address, 2, parseEther(1000))).to.be.revertedWith(
                'PM012'
            );
        });

        it('batch allocate vesting with incorrect config should fail', async () => {
            // empty addresses
            await expect(vestingContract.batchAllocateVesting(1, [], [parseEther(1000)])).to.be.revertedWith(
                'V005'
            );
            // addresses are not match with allocations
            await expect(
                vestingContract.batchAllocateVesting(1, [wallet3.address, wallet4.address], [parseEther(1000)])
            ).to.be.revertedWith('V006');
        });
    });

    describe('Token Manangement By Admin', () => {
        it('deposit and widthdraw all by admin should work', async () => {
            await vestingContract.depositByAdmin(1000);
            expect(await token.balanceOf(vestingContract.address)).to.eq(1000);

            await vestingContract.withdrawAllByAdmin();
            expect(await token.balanceOf(vestingContract.address)).to.eq(parseEther(0));
        });

        it('deposit and widthdraw without owner should fail', async () => {
            await expect(vestingContract.connect(wallet2).depositByAdmin(1000)).to.be.revertedWith(ownableRevert);

            await expect(vestingContract.connect(wallet2).withdrawAllByAdmin()).to.be.revertedWith(ownableRevert);
        });

        it('deposit with zero amount should fail', async () => {
            await expect(vestingContract.depositByAdmin(0)).to.be.revertedWith('V007');
        });
    });

    describe('Start Vesting', () => {
        beforeEach(async () => {
            const planId = await createPlan(lockPeriod, vestingPeriod);
            await vestingContract.batchAllocateVesting(
                planId,
                [wallet1.address, wallet2.address],
                [parseEther(1000), parseEther(3000)]
            );
        });

        it('set incorrect vesting date should fail', async () => {
            const latestBlock = await mockProvider.getBlock('latest');
            await expect(vestingContract.startVesting(latestBlock.timestamp)).to.be.revertedWith(
                'V009'
            );
        });

        it('start vesting without enough balance should fail', async () => {
            expect(await token.balanceOf(vestingContract.address)).to.equal(parseEther(0));
            const latestBlock = await mockProvider.getBlock('latest');
            await expect(vestingContract.startVesting(latestBlock.timestamp + 1000)).to.be.revertedWith(
                'V010'
            );
        });

        it('start vesting should work', async () => {
            const latestBlock = await mockProvider.getBlock('latest');
            await vestingContract.depositByAdmin(parseEther(4000));

            const startDate = latestBlock.timestamp + 1000;
            await vestingContract.startVesting(startDate);
            expect(await vestingContract.vestingStartDate()).to.equal(startDate);
            expect(await vestingContract.owner()).to.equal(vestingContract.address);

            await expect(vestingContract.withdrawAllByAdmin()).to.be.revertedWith(ownableRevert);
            await expect(vestingContract.depositByAdmin(1000)).to.be.revertedWith(ownableRevert);
            await expect(vestingContract.addVestingPlan(0, 0, 10)).to.be.revertedWith(ownableRevert);
            await expect(vestingContract.allocateVesting(wallet1.address, 0, 0)).to.be.revertedWith(ownableRevert);
            await expect(vestingContract.batchAllocateVesting(1, [wallet1.address], [0])).to.be.revertedWith(
                ownableRevert
            );
        });
    });

    describe('Vesting Claim', () => {
        const wallet1Allocation = parseEther(1000);
        const wallet2Allocation = parseEther(3000);
        beforeEach(async () => {
            await vestingContract.depositByAdmin(parseEther(4000));
            const planId = await createPlan(lockPeriod, vestingPeriod);
            await vestingContract.batchAllocateVesting(
                planId,
                [wallet1.address, wallet2.address],
                [wallet1Allocation, wallet2Allocation]
            );
        });

        it('no claimable amount for invalid condition', async () => {
            // vesting not start
            expect(await vestingContract.claimableAmount(wallet1.address)).to.equal(0);
            expect(await vestingContract.claimableAmount(wallet2.address)).to.equal(0);
            // no allocation for the users
            await startVesting();
            expect(await vestingContract.claimableAmount(wallet3.address)).to.equal(0);
            expect(await vestingContract.claimableAmount(wallet4.address)).to.equal(0);
            await timeTravel(500);
            // not reach start date
            expect(await vestingContract.claimableAmount(wallet1.address)).to.equal(0);
            expect(await vestingContract.claimableAmount(wallet2.address)).to.equal(0);
        });

        it('claim before lock period', async () => {// start vesting
            await startVesting();
            let claimable = await vestingContract.claimableAmount(wallet1.address);
            expect(claimable).to.eq(0);
            const evt = await claimVesting(wallet1);
            expect(evt.amount).to.eq(0);
        })

        it('claim during vesting period', async () => {// start vesting
            await startVesting();
            await timeTravel(lockPeriod + 1001);

            let claimable = await vestingContract.claimableAmount(wallet1.address);
            const initialUnlock = wallet1Allocation.mul(initialUnlockPercent).div(100);
            const errorTolerance = '100000000000000'; // 1e-5
            expect(claimable).to.gt(initialUnlock);
            expect(claimable.sub(initialUnlock)).to.lt(errorTolerance);
            let evt = await claimVesting(wallet1);
            expect(evt.amount).to.gte(claimable);
            expect(evt.amount.sub(claimable)).to.lt(errorTolerance);
            claimable = await vestingContract.claimableAmount(wallet1.address);
            expect(claimable).to.eq(0);
            await timeTravel(vestingPeriod/10);
            claimable = await vestingContract.claimableAmount(wallet1.address);
            const vestingAmount = wallet1Allocation.sub(initialUnlock);
            expect(claimable).to.gte(vestingAmount.div(10));
            expect(claimable.sub(vestingAmount.div(10))).to.lt(errorTolerance);
            evt = await claimVesting(wallet1);
            expect(evt.amount).to.gte(claimable);
            expect(evt.amount.sub(claimable)).to.lt(errorTolerance);
        })

        it('claim all together in once', async () => {// start vesting
            await startVesting();
            await timeTravel(lockPeriod + vestingPeriod + 1001);

            let claimable = await vestingContract.claimableAmount(wallet1.address);
            expect(claimable).to.eq(wallet1Allocation);
            const evt = await claimVesting(wallet1);
            expect(evt.amount).to.eq(claimable);
            claimable = await vestingContract.claimableAmount(wallet1.address);
            expect(claimable).to.eq(0);
        })

        it('claim should work', async () => {
            // start vesting
            await startVesting();
            await timeTravel(lockPeriod + 1001);
            // check initial release
            let claimable1 = await vestingContract.claimableAmount(wallet1.address);
            expect(claimable1).to.gt(parseEther(100));
            expect(claimable1).to.lt(parseEther(100.001));
            const claimable2 = await vestingContract.claimableAmount(wallet2.address);
            expect(claimable2).to.gt(parseEther(300));
            expect(claimable2).to.lt(parseEther(300.001));

            // wallet1 claim
            await vestingContract.connect(wallet1).claim();
            const balance1 = await token.balanceOf(wallet1.address);
            expect(balance1).to.gt(claimable1);
            expect(balance1).to.lt(claimable1.add(parseEther(0.001)));
            // claim after half vesting period
            await timeTravel(vestingPeriod / 2);
            claimable1 = await vestingContract.claimableAmount(wallet1.address);
            expect(claimable1).to.gte(parseEther(450));
            // wallet1 claim
            await vestingContract.connect(wallet1).claim();
            expect(await token.balanceOf(wallet1.address)).to.gt(balance1.add(claimable1));
            expect(await token.balanceOf(wallet1.address)).to.lt(balance1.add(claimable1).add(parseEther(0.001)));
            // claim after vesting period
            await timeTravel(vestingPeriod / 2);
            await vestingContract.connect(wallet1).claim();
            expect(await token.balanceOf(wallet1.address)).to.eq(parseEther(1000));
        });

        it('claim on non-vesting account should fail', async () => {
            await expect(vestingContract.connect(wallet3).claim()).to.be.revertedWith(
                'V011'
            );
        });
    });
});
