// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { deployRootContracts } from './setup';
import {
    InflationController,
    MockInflationDestination2__factory,
    MockInflationDestination__factory,
    OpDestination,
    SQToken,
} from '../src';
// import { PER_MILL } from './constants';
import { eventFrom, revertrMsg, time, timeTravel } from './helper';

// TODO: as inflation controller will no longer dependent on `EraManager`, will need to refactor these test cases
describe('Inflation Controller Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2;
    let inflationDestination1;

    let inflationController: InflationController;
    let inflationDestination2: OpDestination;
    let token: SQToken;

    // const YEAR_SECONDS = (3600 * 24 * 36525) / 100;

    // async function startNewEra() {
    //     for (let i=0;i<24*7;i++) {
    //         await timeTravel(time.duration.hours(1).toNumber());
    //     }
    // }

    const triggerAndCheckInflation = async (duration: number) => {
        // const totalSupply = await token.totalSupply();
        // const inflationRate = await inflationController.inflationRate();
        // const eraPeriod = await eraManager.eraPeriod();
        // const lastInflationTimestamp = await inflationController.lastInflationTimestamp();
        // const oldBalance = await token.balanceOf(inflationDestination1);
        await timeTravel(duration);
        const tx = await inflationController.mintInflatedTokens();
        await tx.wait();
        const block = await mockProvider.getBlock('latest');
        block.timestamp;
        const currentInflationTimestamp = await inflationController.lastInflationTimestamp();
        expect(currentInflationTimestamp).to.be.eq(block.timestamp);
        // const newBalance = await token.balanceOf(inflationDestination1);
        // const newSupply = newBalance.sub(oldBalance);
        // const expectValue = totalSupply
        //     .mul(inflationRate)
        //     .div(PER_MILL * YEAR_SECONDS)
        //     .mul(block.timestamp-lastInflationTimestamp.toNumber());
    };

    const deployer = () => deployRootContracts(wallet_0, wallet_1);
    before(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        inflationDestination1 = wallet_1.address;
        const deployment = await waffle.loadFixture(deployer);
        inflationController = deployment.inflationController;
        inflationDestination2 = deployment.opDestination;
        token = deployment.rootToken;
    });

    describe('Inflation Config', () => {
        it('check initial settings', async () => {
            expect(await inflationController.inflationRate()).to.equal(1000);
            expect(await inflationController.inflationDestination()).to.equal(wallet_1.address);
        });

        it('set inflation destination should work', async () => {
            await inflationController.setInflationDestination(wallet_2.address);
            expect(await inflationController.inflationDestination()).to.equal(wallet_2.address);
        });

        it('set inflation destination without owner should fail', async () => {
            await expect(
                inflationController.connect(wallet_1).setInflationDestination(wallet_2.address)
            ).to.be.revertedWith(revertrMsg.notOwner);
        });

        it('set inflation rate should work', async () => {
            await inflationController.setInflationRate(100);
            expect(await inflationController.inflationRate()).to.equal(100);

            // inflationRateBP can be zero
            await inflationController.setInflationRate(0);
            expect(await inflationController.inflationRate()).to.equal(0);
        });

        it('set inflation rate with invalid params should fail', async () => {
            await expect(inflationController.setInflationRate(1000001)).to.be.revertedWith('IC001');
        });
    });

    describe('Start Inflation', () => {
        it('first mintInflatedTokens() starts inflation', async () => {
            // start inflation
            let tx = await inflationController.mintInflatedTokens();
            let evt = await eventFrom(tx, inflationController, 'InflationStart()');
            expect(evt).to.exist;
            tx = await inflationController.mintInflatedTokens();
            evt = await eventFrom(tx, inflationController, 'InflationStart()');
            expect(evt).not.to.exist;
        });
    });

    describe('Mint Inflation Tokens', () => {
        beforeEach(async () => {
            // start inflation
            const tx = await inflationController.mintInflatedTokens();
            await tx.wait();
        });

        it('mint inflation tokens should work', async () => {
            await triggerAndCheckInflation(time.duration.days(7).toNumber());
        });

        // it('mintInflatedTokens only be called by eraManager', async () => {
        //     await expect(inflationController.mintInflatedTokens()).to.be.revertedWith(
        //         'G012'
        //     );
        // });

        // //eraPeriod: 10 days
        // //inflationRateBP: 10 -- 0.0001 -- 0.01%
        // //totalSupply: 10 billion
        // it('test the precision of Mint for scenario1', async () => {
        //     //inflationRateBP: 10 -- 0.0001 -- 0.01%
        //     //setup era period be 10 days
        //     await eraManager.updateEraPeriod(time.duration.days(10).toString());
        //     //go through 30 eras -- 300 day
        //     for (let i = 0; i < 30; i++) {
        //         await triggerAndCheckInflation();
        //     }
        // });

        //eraPeriod: 7 days
        //inflationRateBP: 10,000 -- 0.01 -- 1%
        //totalSupply: 10 billion
        it('test the precision of Mint for scenario2', async () => {
            //setup inflationRateBP: 10,000 -- 0.01 -- 1%
            await inflationController.setInflationRate(1e4);
            const totalSupply = await token.totalSupply();
            const oldBalance = await token.balanceOf(inflationDestination1);
            //go through 52 eras -- 364 day
            for (let i = 0; i < 52; i++) {
                await triggerAndCheckInflation(time.duration.days(7).toNumber());
            }
            const expectedInflation = totalSupply.mul(1).div(100).mul(364).div(365);
            const errorRate = 0.005;
            const newBalance = await token.balanceOf(inflationDestination1);
            console.log(
                `expected: ${ethers.utils.formatEther(expectedInflation)}, real: ${ethers.utils.formatEther(newBalance.sub(oldBalance))}, differ: ${ethers.utils.formatEther(newBalance.sub(oldBalance).sub(expectedInflation))}`
            );
            console.log(
                `error rate: ${newBalance.sub(oldBalance).sub(expectedInflation).abs().mul(100).div(expectedInflation)}`
            );
            // due to compound interest, the real inflation will be higher.
            expect(newBalance.sub(oldBalance)).to.gt(expectedInflation);
            expect(newBalance.sub(oldBalance).sub(expectedInflation).mul(1000).div(expectedInflation)).to.be.lt(
                errorRate * 1000
            );
        });

        it("mint inflation to smart contract doesn't not implements IInflationDestination should work", async () => {
            const dest = await new MockInflationDestination2__factory(wallet_0).deploy();
            let tx = await inflationController.setInflationDestination(dest.address);
            await timeTravel(time.duration.days(7).toNumber());
            tx = await inflationController.mintInflatedTokens();
            await tx.wait();
            const balance = await token.balanceOf(dest.address);
            expect(balance).to.gt(0);
        });

        it('mint inflation to smart contract implements IInflationDestination should work', async () => {
            const dest = await new MockInflationDestination__factory(wallet_0).deploy();
            let tx = await inflationController.setInflationDestination(dest.address);
            await timeTravel(time.duration.days(7).toNumber());
            tx = await inflationController.mintInflatedTokens();
            const evt = await eventFrom(tx, dest, 'HookCalled()');
            expect(evt).to.exist;
            const balance = await token.balanceOf(dest.address);
            expect(balance).to.gt(0);
        });
    });

    describe('Mint SQT Tokens by admin', () => {
        it('mint SQT tokens should work', async () => {
            const oldSupply = await token.totalSupply();
            const oldBalance = await token.balanceOf(inflationDestination1);
            await inflationController.mintSQT(inflationDestination1, 1000);
            expect(await token.totalSupply()).to.equal(oldSupply.add(1000));
            expect(await token.balanceOf(inflationDestination1)).to.equal(oldBalance.add(1000));
        });

        it('mintSQT only be called by owner', async () => {
            await expect(inflationController.connect(wallet_2).mintSQT(inflationDestination1, 1000)).to.be.revertedWith(
                revertrMsg.notOwner
            );
        });
    });

    describe('InflationDestination', () => {
        it('change recipient should only work for admin', async () => {
            expect(await inflationDestination2.xcRecipient()).not.to.eq(wallet_1.address);
            const tx = await inflationDestination2.setXcRecipient(wallet_1.address);
            await tx.wait();
            expect(await inflationDestination2.xcRecipient()).to.eq(wallet_1.address);
            await expect(inflationDestination2.connect(wallet_1).setXcRecipient(wallet_2.address)).to.be.revertedWith(
                revertrMsg.notOwner
            );
            expect(await inflationDestination2.xcRecipient()).to.eq(wallet_1.address);
        });
        it('withdraw should only work for admin', async () => {
            const amount = ethers.utils.parseEther('1');
            let tx = await token.transfer(inflationDestination2.address, amount);
            await tx.wait();
            const balanceBefore = await token.balanceOf(inflationDestination2.address);
            const ownerBalanceBefore = await token.balanceOf(wallet_0.address);
            expect(balanceBefore).to.eq(amount);
            await expect(inflationDestination2.connect(wallet_2).withdraw(token.address)).to.be.revertedWith(
                revertrMsg.notOwner
            );
            tx = await inflationDestination2.withdraw(token.address);
            await tx.wait();
            const balanceAfter = await token.balanceOf(inflationDestination2.address);
            const ownerBalanceAfter = await token.balanceOf(wallet_0.address);
            expect(balanceAfter).to.eq(0);
            expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.eq(balanceBefore);
        });
    });
});
