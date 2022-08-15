// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {Vesting, SQToken} from '../src';

describe('Vesting Contract', () => {
    const mockProvider = waffle.provider;
    const [wallet, wallet1, wallet2, wallet3, wallet4] = mockProvider.getWallets();

    let token: SQToken;
    let vestingContract: Vesting;
    let lockPeriod: number;
    let vestingPeriod: number;

    const timeTravel = async (seconds: number) => {
        await mockProvider.send('evm_increaseTime', [seconds]);
        await mockProvider.send('evm_mine', []);
    };

    const units = (value: number) => ethers.utils.parseUnits(value.toString());

    const ownableRevert = 'Ownable: caller is not the owner';

    async function createPlan(lockPeriod: number, vestingPeriod: number): Promise<number> {
        const tx = await vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 10);
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
        expect(await vestingContract.allocations(user)).to.equal(units(allocation));
    };

    beforeEach(async () => {
        const deployment = await deployContracts(wallet, wallet1);
        token = deployment.token;
        vestingContract = deployment.vesting;
        lockPeriod = 86400 * 30; // 2 month
        vestingPeriod = 86400 * 365; // 1 year

        await token.approve(vestingContract.address, units(4000));
    });

    describe('Vesting Plan', () => {
        it('add vesting plan should work', async () => {
            // 0 initial unlock
            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 0))
                .to.be.emit(vestingContract, 'AddVestingPlan')
                .withArgs(0, lockPeriod, vestingPeriod, 0);
            // 100% initial unlock
            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 100))
                .to.be.emit(vestingContract, 'AddVestingPlan')
                .withArgs(1, lockPeriod, vestingPeriod, 100);
            // 30% initial unlock
            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 30))
                .to.be.emit(vestingContract, 'AddVestingPlan')
                .withArgs(2, lockPeriod, vestingPeriod, 30);

            await checkVestingPlan(0, 0);
            await checkVestingPlan(1, 100);
            await checkVestingPlan(2, 30);
        });

        it('initial unlock percent over 100 should fail', async () => {
            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 101)).to.be.revertedWith(
                'initial unlock percent should be equal or less than 100'
            );
        });
    });

    describe('Allocate Vestring', () => {
        beforeEach(async () => {
            await vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 10);
        });

        it('allocate vesting should work', async () => {
            await vestingContract.allocateVesting(wallet1.address, 0, units(1000));
            await checkAllocation(0, wallet1.address, 1000);
            expect(await vestingContract.totalAllocation()).to.equal(units(1000));
        });

        it('batch allocate vesting should work', async () => {
            await vestingContract.batchAllocateVesting(
                0,
                [wallet1.address, wallet2.address],
                [units(1000), units(3000)]
            );

            await checkAllocation(0, wallet1.address, 1000);
            await checkAllocation(0, wallet2.address, 3000);
            expect(await vestingContract.totalAllocation()).to.equal(units(4000));
        });

        it('allocate with invaid config should fail', async () => {
            // not onwer
            await expect(
                vestingContract.connect(wallet2).allocateVesting(wallet1.address, 0, units(1000))
            ).to.be.revertedWith(ownableRevert);
            // empty address
            const emptyAddress = '0x0000000000000000000000000000000000000000';
            await expect(vestingContract.allocateVesting(emptyAddress, 0, units(1000))).to.be.revertedWith(
                'empty address is not allowed'
            );
            // duplicate account
            await vestingContract.allocateVesting(wallet1.address, 0, units(1000));
            await expect(vestingContract.allocateVesting(wallet1.address, 0, units(1000))).to.be.revertedWith(
                'vesting is already set on the account'
            );
            // zero amount
            await expect(vestingContract.allocateVesting(wallet2.address, 0, units(0))).to.be.revertedWith(
                'zero amount vesting is not allowed'
            );
            // invalid plan id
            await expect(vestingContract.allocateVesting(wallet2.address, 2, units(1000))).to.be.revertedWith(
                'invalid plan id'
            );
        });

        it('batch allocate vesting with incorrect config should fail', async () => {
            // empty addresses
            await expect(vestingContract.batchAllocateVesting(1, [], [units(1000)])).to.be.revertedWith(
                'number of addresses should be at least one'
            );
            // addresses are not match with allocations
            await expect(
                vestingContract.batchAllocateVesting(1, [wallet3.address, wallet4.address], [units(1000)])
            ).to.be.revertedWith('number of addresses should be same as number of allocations');
        });
    });

    describe('Token Manangement By Admin', () => {
        it('deposit and widthdraw all by admin should work', async () => {
            await vestingContract.depositByAdmin(1000);
            expect(await token.balanceOf(vestingContract.address)).to.eq(1000);

            await vestingContract.withdrawAllByAdmin();
            expect(await token.balanceOf(vestingContract.address)).to.eq(units(0));
        });

        it('deposit and widthdraw without owner should fail', async () => {
            await expect(vestingContract.connect(wallet2).depositByAdmin(1000)).to.be.revertedWith(ownableRevert);

            await expect(vestingContract.connect(wallet2).withdrawAllByAdmin()).to.be.revertedWith(ownableRevert);
        });

        it('deposit with zero amount should fail', async () => {
            await expect(vestingContract.depositByAdmin(0)).to.be.revertedWith('should deposit positive amount');
        });
    });

    describe('Start Vesting', () => {
        beforeEach(async () => {
            const planId = await createPlan(lockPeriod, vestingPeriod);
            await vestingContract.batchAllocateVesting(
                planId,
                [wallet1.address, wallet2.address],
                [units(1000), units(3000)]
            );
        });

        it('set incorrect vesting date should fail', async () => {
            const latestBlock = await mockProvider.getBlock('latest');
            await expect(vestingContract.startVesting(latestBlock.timestamp)).to.be.revertedWith(
                'vesting start date must in the future'
            );
        });

        it('start vesting without enough balance should fail', async () => {
            expect(await token.balanceOf(vestingContract.address)).to.equal(units(0));
            const latestBlock = await mockProvider.getBlock('latest');
            await expect(vestingContract.startVesting(latestBlock.timestamp + 1000)).to.be.revertedWith(
                'balance not enough for allocation'
            );
        });

        it('start vesting should work', async () => {
            const latestBlock = await mockProvider.getBlock('latest');
            await vestingContract.depositByAdmin(units(4000));
            await vestingContract.startVesting(latestBlock.timestamp + 1000);

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
        beforeEach(async () => {
            await vestingContract.depositByAdmin(units(4000));
            const planId = await createPlan(lockPeriod, vestingPeriod);
            await vestingContract.batchAllocateVesting(
                planId,
                [wallet1.address, wallet2.address],
                [units(1000), units(3000)]
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

        // FIXME: need to fix this test case @Jason
        it.skip('claim should work', async () => {
            // start vesting
            await startVesting();
            await timeTravel(lockPeriod + 1001);
            // check initial release
            let claimable1 = await vestingContract.claimableAmount(wallet1.address);
            expect(claimable1).to.gt(units(100));
            expect(claimable1).to.lt(units(100.001));
            const claimable2 = await vestingContract.claimableAmount(wallet2.address);
            expect(claimable2).to.gt(units(300));
            expect(claimable2).to.lt(units(300.001));

            // wallet1 claim
            await vestingContract.connect(wallet1).claim();
            const balance1 = await token.balanceOf(wallet1.address);
            expect(claimable1).to.eq(balance1);
            // claim after half vesting period
            await timeTravel(vestingPeriod / 2);
            claimable1 = await vestingContract.claimableAmount(wallet1.address);
            expect(claimable1).to.gte(units(450));
            // wallet1 claim
            await vestingContract.connect(wallet1).claim();
            expect(await token.balanceOf(wallet1.address)).to.eq(balance1.add(claimable1));
            // claim after vesting period
            await timeTravel(vestingPeriod / 2);
            await vestingContract.connect(wallet1).claim();
            expect(await token.balanceOf(wallet1.address)).to.eq(units(1000));
        });

        it('claim on non-vesting account should fail', async () => {
            await expect(vestingContract.connect(wallet3).claim()).to.be.revertedWith(
                'vesting is not set on the account'
            );
        });
    });
});
