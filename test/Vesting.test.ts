// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { Wallet } from '@ethersproject/wallet';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { SQToken, Vesting } from '../src';
import { etherParse, eventFrom, lastestBlockTime, revertMsg, timeTravel, timeTravelTo } from './helper';
import { deployRootContracts } from './setup';
import { VTSQToken } from 'build';
import { EXPECTATION, PLANS } from './Vesting.test-data';
import * as console from 'console';

type ClaimVestingEvent = { user: string; amount: BigNumber };

describe('Vesting Contract', () => {
    const mockProvider = waffle.provider;
    const [wallet, wallet1, wallet2, wallet3, wallet4, b0, b1, b2, b3, b4, b5] = mockProvider.getWallets();

    let sqToken: SQToken;
    let vtSQToken: VTSQToken;
    let vestingContract: Vesting;
    const lockPeriod = 86400 * 30; // 2 month
    const vestingPeriod = 86400 * 365; // 1 year
    const initialUnlockPercent = 10;

    async function claimVesting(planId, wallet: Wallet): Promise<ClaimVestingEvent> {
        const tx = await vestingContract.connect(wallet).claim(planId);
        const evt = await eventFrom(tx, vestingContract, 'VestingClaimed(address,uint256,uint256)');
        return evt as unknown as ClaimVestingEvent;
    }

    const parseEther = (value: number) => ethers.utils.parseEther(value.toString());

    const ownableRevert = revertMsg.notOwner;

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
        return vestingStart;
    };

    const checkVestingPlan = async (planId: number, unlockPercent: number) => {
        const plan = await vestingContract.plans(planId);
        expect(plan.lockPeriod).to.equal(lockPeriod);
        expect(plan.vestingPeriod).to.equal(vestingPeriod);
        expect(plan.initialUnlockPercent).to.equal(unlockPercent);
    };

    const checkAllocation = async (planId: number, user: string, allocation: number, vtsqtBalance = allocation) => {
        expect(await vestingContract.allocations(planId, user)).to.equal(parseEther(allocation));
        expect(await vtSQToken.balanceOf(user)).to.equal(parseEther(vtsqtBalance));
    };

    const deployer = () => deployRootContracts(wallet, wallet1);

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        sqToken = deployment.rootToken;
        vestingContract = deployment.vesting;
        vtSQToken = deployment.vtSQToken;
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
            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 101)).to.be.revertedWith('V001');
        });

        it('non admin should fail', async () => {
            await expect(vestingContract.connect(wallet1).addVestingPlan(lockPeriod, vestingPeriod, 0)).to.revertedWith(
                revertMsg.notOwner
            );
            await vestingContract.renounceOwnership();

            await expect(vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 0)).to.revertedWith(
                revertMsg.notOwner
            );
        });
    });

    describe('Allocate Vesting', () => {
        beforeEach(async () => {
            await vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 10);
            await vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 0);
        });

        it('allocate vesting should work', async () => {
            await vestingContract.batchAllocateVesting([0], [wallet1.address], [parseEther(1000)]);
            await checkAllocation(0, wallet1.address, 1000);
            expect(await vestingContract.totalAllocation()).to.equal(parseEther(1000));
        });

        it('allocate same account multiple plan should work', async () => {
            await vestingContract.batchAllocateVesting([0], [wallet1.address], [parseEther(1000)]);
            await checkAllocation(0, wallet1.address, 1000);
            await vestingContract.batchAllocateVesting([1], [wallet1.address], [parseEther(3000)]);
            await checkAllocation(1, wallet1.address, 3000, 4000);
            expect(await vestingContract.totalAllocation()).to.equal(parseEther(4000));
        });

        it('batch allocate vesting should work', async () => {
            const ids = [];
            const wallets = [];
            const amounts = [];
            for (let i = 0; i < 2; i++) {
                ids.push(0);
                wallets.push(wallet1.address);
                amounts.push(parseEther(1000));
            }
            const res = await vestingContract.batchAllocateVesting(
                [0, 0], //ids,
                [wallet1.address, wallet2.address], // wallets,
                [parseEther(1000), parseEther(3000)] // amounts
            );
            const { gasUsed } = await res.wait();
            console.log('==== gasused:', gasUsed);

            await checkAllocation(0, wallet1.address, 1000);
            await checkAllocation(0, wallet2.address, 3000);
            expect(await vestingContract.totalAllocation()).to.equal(parseEther(4000));
        });

        it('allocate with invaid config should fail', async () => {
            // not onwer
            await expect(
                vestingContract.connect(wallet2).batchAllocateVesting([0], [wallet1.address], [parseEther(1000)])
            ).to.be.revertedWith(ownableRevert);
            // empty address
            const emptyAddress = '0x0000000000000000000000000000000000000000';
            await expect(
                vestingContract.batchAllocateVesting([0], [emptyAddress], [parseEther(1000)])
            ).to.be.revertedWith('V002');
            // duplicate account
            await vestingContract.batchAllocateVesting([0], [wallet1.address], [parseEther(1000)]);
            await expect(
                vestingContract.batchAllocateVesting([0], [wallet1.address], [parseEther(1000)])
            ).to.be.revertedWith('V003');
            // zero amount
            await expect(
                vestingContract.batchAllocateVesting([0], [wallet2.address], [parseEther(0)])
            ).to.be.revertedWith('V004');
            // invalid plan id
            await expect(
                vestingContract.batchAllocateVesting([2], [wallet2.address], [parseEther(1000)])
            ).to.be.revertedWith('V013');
        });

        it('batch allocate vesting with incorrect config should fail', async () => {
            // empty addresses
            await expect(vestingContract.batchAllocateVesting([1], [], [parseEther(1000)])).to.be.revertedWith('V005');
            // addresses are not match with allocations
            await expect(
                vestingContract.batchAllocateVesting([1], [wallet3.address, wallet4.address], [parseEther(1000)])
            ).to.be.revertedWith('V006');
        });
    });

    describe('Vesting Token vtSQT', () => {
        beforeEach(async () => {
            await vestingContract.addVestingPlan(lockPeriod, vestingPeriod, 10);
        });

        it('vtSQT can not burn without approval unless it is from minter', async () => {
            const balance0 = await vtSQToken.balanceOf(wallet1.address);
            expect(balance0).to.eq(0);
            await vestingContract.batchAllocateVesting([0], [wallet1.address], [parseEther(1000)]);
            const balance1 = await vtSQToken.balanceOf(wallet1.address);
            expect(balance1).to.eq(parseEther(1000));
            expect(vtSQToken.connect(wallet2).burnFrom(wallet1.address, balance1)).to.reverted;
            await vtSQToken.setMinter(wallet2.address);
            expect(vtSQToken.connect(wallet2).burnFrom(wallet1.address, balance1)).not.to.reverted;
            const balance2 = await vtSQToken.balanceOf(wallet1.address);
            expect(balance2).to.eq(0);
        });
    });

    describe('Token Manangement By Admin', () => {
        it('withdraw all by admin should work', async () => {
            await vestingContract.withdrawAllByAdmin();
            expect(await sqToken.balanceOf(vestingContract.address)).to.eq(parseEther(0));
            expect(await vtSQToken.totalSupply()).to.eq(0);
        });

        it('withdraw without owner should fail', async () => {
            await expect(vestingContract.connect(wallet2).withdrawAllByAdmin()).to.be.revertedWith(ownableRevert);
        });
    });

    describe('Start Vesting', () => {
        beforeEach(async () => {
            const planId = await createPlan(lockPeriod, vestingPeriod);
            await vestingContract.batchAllocateVesting(
                [planId, planId],
                [wallet1.address, wallet2.address],
                [parseEther(1000), parseEther(3000)]
            );
        });

        it('mint vtSQToken should work', async () => {
            expect(await vtSQToken.totalSupply()).to.equal(parseEther(4000));
            expect(await vtSQToken.balanceOf(wallet1.address)).to.equal(parseEther(1000));
            expect(await vtSQToken.balanceOf(wallet2.address)).to.equal(parseEther(3000));
        });

        it('set incorrect vesting date should fail', async () => {
            const latestBlock = await mockProvider.getBlock('latest');
            await expect(vestingContract.startVesting(latestBlock.timestamp)).to.be.revertedWith('V009');
        });

        it('start vesting without enough balance should fail', async () => {
            expect(await sqToken.balanceOf(vestingContract.address)).to.equal(parseEther(0));
            const latestBlock = await mockProvider.getBlock('latest');
            await expect(vestingContract.startVesting(latestBlock.timestamp + 1000)).to.be.revertedWith('V010');
        });

        it('start vesting should work', async () => {
            const latestBlock = await mockProvider.getBlock('latest');
            // await vestingContract.depositByAdmin(parseEther(4000));
            await sqToken.transfer(vestingContract.address, utils.parseEther('4000'));

            const startDate = latestBlock.timestamp + 1000;
            await vestingContract.startVesting(startDate);
            expect(await vestingContract.vestingStartDate()).to.equal(startDate);
            expect(await vestingContract.owner()).to.equal(vestingContract.address);

            await expect(vestingContract.withdrawAllByAdmin()).to.be.revertedWith(ownableRevert);
            await expect(vestingContract.addVestingPlan(0, 0, 10)).to.be.revertedWith(ownableRevert);
            // await expect(vestingContract.allocateVesting(wallet1.address, 0, 0)).to.be.revertedWith(ownableRevert);
            await expect(vestingContract.batchAllocateVesting([1], [wallet1.address], [0])).to.be.revertedWith(
                ownableRevert
            );
        });
    });

    describe('Vesting Claim', () => {
        const wallet1Allocation = parseEther(1000);
        const wallet2Allocation = parseEther(3000);
        const wallet3Allocation0 = parseEther(2000);
        const wallet3Allocation1 = parseEther(1500);

        let planId;
        let planId2;

        beforeEach(async () => {
            await sqToken.transfer(vestingContract.address, utils.parseEther('7500'));
            planId = await createPlan(lockPeriod, vestingPeriod);
            planId2 = await createPlan(lockPeriod, vestingPeriod);
            await vestingContract.batchAllocateVesting(
                [planId, planId, planId, planId2],
                [wallet1.address, wallet2.address, wallet3.address, wallet3.address],
                [wallet1Allocation, wallet2Allocation, wallet3Allocation0, wallet3Allocation1]
            );
        });

        it('no claimable amount for invalid condition', async () => {
            // vesting not start
            expect(await vestingContract.claimableAmount(planId, wallet1.address)).to.equal(0);
            expect(await vestingContract.claimableAmount(planId, wallet2.address)).to.equal(0);
            // no allocation for the users
            await startVesting();
            expect(await vestingContract.claimableAmount(planId, wallet4.address)).to.equal(0);
            await timeTravel(500);
            // not reach start date
            expect(await vestingContract.claimableAmount(planId, wallet1.address)).to.equal(0);
            expect(await vestingContract.claimableAmount(planId, wallet2.address)).to.equal(0);
            expect(await vestingContract.claimableAmount(planId, wallet3.address)).to.equal(0);
            expect(await vestingContract.claimableAmount(planId2, wallet3.address)).to.equal(0);
        });

        it('claim during vesting period', async () => {
            // start vesting
            const startDate = await startVesting();
            await timeTravelTo(startDate + lockPeriod + 1, 3600);

            let claimable = await vestingContract.claimableAmount(planId, wallet1.address);
            const initialUnlock = wallet1Allocation.mul(initialUnlockPercent).div(100);
            const errorTolerance = '100000000000000'; // 1e-5
            expect(claimable).to.gt(initialUnlock);
            expect(claimable.sub(initialUnlock)).to.lt(errorTolerance);
            let evt = await claimVesting(planId, wallet1);
            expect(evt.amount).to.gte(claimable);
            expect(evt.amount.sub(claimable)).to.lt(errorTolerance);
            claimable = await vestingContract.claimableAmount(planId, wallet1.address);
            expect(claimable).to.eq(0);
            await timeTravel(vestingPeriod / 10);
            claimable = await vestingContract.claimableAmount(planId, wallet1.address);
            const vestingAmount = wallet1Allocation.sub(initialUnlock);
            expect(claimable).to.gte(vestingAmount.div(10));
            expect(claimable.sub(vestingAmount.div(10))).to.lt(errorTolerance);
            evt = await claimVesting(planId, wallet1);
            expect(evt.amount).to.gte(claimable);
            expect(evt.amount.sub(claimable)).to.lt(errorTolerance);
            for (let i = 0; i < 9; i++) {
                await timeTravel(vestingPeriod / 10);
                await claimVesting(planId, wallet1);
                await claimVesting(planId, wallet2);
                await claimVesting(planId, wallet3);
                await claimVesting(planId2, wallet3);
            }
            claimable = await vestingContract.claimableAmount(planId, wallet1.address);
            expect(claimable).to.eq(0);
            expect(await sqToken.balanceOf(wallet1.address)).to.eq(wallet1Allocation);
            expect(await sqToken.balanceOf(wallet2.address)).to.eq(wallet2Allocation);
            expect(await sqToken.balanceOf(wallet3.address)).to.eq(wallet3Allocation0.add(wallet3Allocation1));
            expect(await sqToken.balanceOf(vestingContract.address)).to.eq(0);
        });

        it('claim all together in once', async () => {
            // start vesting
            await startVesting();
            await timeTravel(lockPeriod + vestingPeriod + 1001);

            let claimable = await vestingContract.claimableAmount(planId, wallet1.address);
            expect(claimable).to.eq(wallet1Allocation);
            const evt = await claimVesting(planId, wallet1);
            expect(evt.amount).to.eq(claimable);
            claimable = await vestingContract.claimableAmount(planId, wallet1.address);
            expect(claimable).to.eq(0);
        });

        it('claim for should work', async () => {
            // start vesting
            await startVesting();
            await timeTravel(lockPeriod + vestingPeriod + 1001);
            const balance1 = await sqToken.balanceOf(wallet1.address);
            expect(balance1).to.eq(0);
            let claimable = await vestingContract.claimableAmount(planId, wallet1.address);
            expect(claimable).to.eq(wallet1Allocation);
            await vestingContract.connect(wallet2).claimFor(planId, wallet1.address);
            const balance2 = await sqToken.balanceOf(wallet1.address);
            expect(balance2).to.eq(wallet1Allocation);
            claimable = await vestingContract.claimableAmount(planId, wallet1.address);
            expect(claimable).to.eq(0);
        });

        it('claim should work', async () => {
            // start vesting
            await startVesting();
            await timeTravel(lockPeriod + 1001);
            // check initial release
            let claimable1 = await vestingContract.claimableAmount(planId, wallet1.address);
            expect(claimable1).to.gt(parseEther(100));
            expect(claimable1).to.lt(parseEther(100.001));
            const claimable2 = await vestingContract.claimableAmount(planId, wallet2.address);
            expect(claimable2).to.gt(parseEther(300));
            expect(claimable2).to.lt(parseEther(300.001));

            // wallet1 claim
            await vestingContract.connect(wallet1).claim(planId);
            const balance1 = await sqToken.balanceOf(wallet1.address);
            expect(balance1).to.gt(claimable1);
            expect(balance1).to.lt(claimable1.add(parseEther(0.001)));
            // claim after half vesting period
            await timeTravel(vestingPeriod / 2);
            claimable1 = await vestingContract.claimableAmount(planId, wallet1.address);
            expect(claimable1).to.gte(parseEther(450));
            // wallet1 claim
            await vestingContract.connect(wallet1).claim(planId);
            expect(await sqToken.balanceOf(wallet1.address)).to.gt(balance1.add(claimable1));
            expect(await sqToken.balanceOf(wallet1.address)).to.lt(balance1.add(claimable1).add(parseEther(0.001)));
            // claim after vesting period
            await timeTravel(vestingPeriod / 2);
            await vestingContract.connect(wallet1).claim(planId);
            expect(await sqToken.balanceOf(wallet1.address)).to.eq(parseEther(1000));
        });

        it('should burn equal amount of vtSQToken for claimed SQT', async () => {
            // start vesting
            await startVesting();
            await timeTravel(lockPeriod + 1001);
            // wallet1 claim
            expect(await sqToken.balanceOf(wallet1.address)).to.eq(0);
            expect(await vtSQToken.balanceOf(wallet1.address)).to.eq(parseEther(1000));
            await vestingContract.connect(wallet1).claim(planId);
            const sqtBalance = await sqToken.balanceOf(wallet1.address);
            expect(await vtSQToken.balanceOf(wallet1.address)).to.eq(parseEther(1000).sub(sqtBalance));
        });

        it('should only claim max amount of VTSQToken', async () => {
            // start vesting
            await startVesting();
            await timeTravel(lockPeriod + 1001);
            // wallet1
            expect(await sqToken.balanceOf(wallet1.address)).to.eq(0);
            const unlockAmount = await vestingContract.unlockedAmount(planId, wallet1.address);
            // transfer VTSQToken to wallet2
            await vtSQToken.connect(wallet1).transfer(wallet2.address, etherParse('999'));
            // unlockAmount > 1 SQT, vtSQToken balance = 1 vtSQT
            expect(unlockAmount.gt(etherParse('1'))).to.be.true;
            const claimableAmount = etherParse('1');
            expect(await vestingContract.claimableAmount(planId, wallet1.address)).to.eq(claimableAmount);

            // check SQT and VTSQT balance
            await vestingContract.connect(wallet1).claim(planId);
            expect(await sqToken.balanceOf(wallet1.address)).to.eq(claimableAmount);
            expect(await vtSQToken.balanceOf(wallet1.address)).to.eq(0);
        });

        it('claim with invalid condition should fail', async () => {
            // claim on non-vesting account should fail
            await expect(vestingContract.connect(wallet4).claim(planId)).to.be.revertedWith('V011');
            await expect(vestingContract.connect(wallet1).claim(planId2)).to.be.revertedWith('V011');
            // claim with zero claimable amount should fail
            // # case 1 (not start vesting)
            await expect(vestingContract.connect(wallet1).claim(planId)).to.be.revertedWith('V012');
            // # case 2 (not enough vtSQT)
            await startVesting();
            await timeTravel(lockPeriod + 1001);
            await vtSQToken.connect(wallet1).transfer(wallet2.address, etherParse('1000'));
            await expect(vestingContract.connect(wallet1).claim(planId)).to.be.revertedWith('V012');
        });
    });

    describe('Real Vesting Scenario Test', () => {
        const startDate = new Date('2024-02-23T08:00:00Z').getTime() / 1000;
        const secPerMonth = 2628000; // 3600*24*365/12
        beforeEach(async () => {
            // set up vesting
            // create plans
            for (const plan of PLANS) {
                const tx = await vestingContract.addVestingPlan(
                    plan.lockPeriod,
                    plan.vestingPeriod,
                    plan.initialUnlockPercent
                );
                const { planId, lockPeriod, vestingPeriod, initialUnlockPercent } = await eventFrom(
                    tx,
                    vestingContract,
                    'VestingPlanAdded(uint256,uint256,uint256,uint256)'
                );
                expect(planId).to.eq(plan.planId);
                expect(lockPeriod).to.eq(plan.lockPeriod);
                expect(planId).to.eq(plan.planId);
                expect(planId).to.eq(plan.planId);
            }
        });

        // each plan has one wallet
        // need to fix test, the start date has passed, so it will fail
        it.skip('should unlock token according to the plan', async () => {
            const wallets = [b0, b1, b2, b3, b4, b5];
            for (const [planId, { total }] of EXPECTATION.entries()) {
                await vestingContract.batchAllocateVesting([planId], [wallets[planId].address], [parseEther(total)]);
            }
            // start vesting (set the date, transfer token)
            const total = EXPECTATION.reduce((acc, { total }) => acc.add(total), BigNumber.from(0));
            await sqToken.transfer(vestingContract.address, utils.parseEther(total.toString()));
            // await mockProvider.send('evm_setNextBlockTimestamp', [startDate-1000]);
            // await mockProvider.send('evm_mine', []);
            await vestingContract.startVesting(startDate);
            for (const [planId, wallet] of wallets.entries()) {
                const allocation = await vestingContract.allocations(planId, wallet.address);
                await vtSQToken.connect(wallet).approve(vestingContract.address, allocation);
            }

            await timeTravelTo(startDate, 3600);
            let currentDate = startDate;
            for (let month = 1; month <= 60; month++) {
                currentDate = currentDate + secPerMonth;
                await timeTravelTo(currentDate, 3600);
                const time = await lastestBlockTime();
                for (let planId = 0; planId < 6; planId++) {
                    const wallet = wallets[planId];
                    const monthlyExpect = EXPECTATION[planId].monthly[month];
                    if (monthlyExpect !== undefined) {
                        const target = utils.parseEther(monthlyExpect.toString());
                        const claimable = await vestingContract.claimableAmount(planId, wallet.address);
                        if (monthlyExpect === 0 && EXPECTATION[planId].monthly[month + 1] === 0) {
                            expect(claimable).to.eq(0);
                        }
                        if (claimable.gt(0) && monthlyExpect > 0) {
                            await vestingContract.connect(wallet).claim(planId);
                            const balance = await sqToken.balanceOf(wallet.address);
                            // difference should < 0.01%
                            expect(balance.sub(target).abs().mul(10000).div(target)).to.eq(0);
                        }
                        if (EXPECTATION[planId].monthly[month + 1] === undefined) {
                            const balance = await sqToken.balanceOf(wallet.address);
                            expect(balance).to.eq(utils.parseEther(EXPECTATION[planId].total.toString()));
                            console.log(`planId: ${planId}, matches`);
                        }
                    }
                }
            }

            const balance = await sqToken.balanceOf(vestingContract.address);
            expect(balance).to.eq(0);
        });
    });
});
