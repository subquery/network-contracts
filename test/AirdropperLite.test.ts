// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { AirdropperLite, ERC20 } from '../src';
import { ZERO_ADDRESS } from './constants';
import { etherParse, futureTimestamp, lastestBlockTime, revertMsg, timeTravel } from './helper';
import { deployRootContracts } from './setup';

describe('AirdropperLite Contract', () => {
    let wallet_0, wallet_1, wallet_2, wallet_3;
    let airdropperLite: AirdropperLite;
    let token: ERC20;
    let sqtAddress;

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2, wallet_3] = await ethers.getSigners();
        const deployment = await deployRootContracts(wallet_0, wallet_1);
        airdropperLite = deployment.airdropperLite;
        token = deployment.rootToken;
        sqtAddress = token.address;
    });

    describe('init states check', () => {
        it('init nextRoundId should be 0', async () => {
            expect(await airdropperLite.nextRoundId()).to.equal(0);
        });
        it('owner account set to be controller', async () => {
            expect(await airdropperLite.controllers(wallet_0.address)).to.equal(true);
        });
    });

    describe('config contract', () => {
        it('add controller account should work', async () => {
            expect(await airdropperLite.controllers(wallet_1.address)).to.equal(false);
            await airdropperLite.addController(wallet_1.address);
            expect(await airdropperLite.controllers(wallet_1.address)).to.equal(true);
        });
        it('remove controller account should work', async () => {
            await airdropperLite.addController(wallet_1.address);
            expect(await airdropperLite.controllers(wallet_1.address)).to.equal(true);
            await airdropperLite.removeController(wallet_1.address);
            expect(await airdropperLite.controllers(wallet_1.address)).to.equal(false);
        });
        it('admin withdraw', async () => {
            await token.transfer(airdropperLite.address, 100);
            await expect(airdropperLite.withdrawByAdmin(token.address, 50)).to.not.reverted;
            await expect(airdropperLite.connect(wallet_1).withdrawByAdmin(token.address, 50)).to.revertedWith(
                revertMsg.notOwner
            );
            await expect(airdropperLite.withdrawByAdmin(token.address, 51)).to.revertedWith(
                revertMsg.insufficientBalance
            );
            await expect(airdropperLite.withdrawByAdmin(token.address, 50)).to.not.reverted;
        });
    });

    describe('round test', () => {
        let startTime: number;
        let endTime: number;

        beforeEach(async () => {
            startTime = (await lastestBlockTime()) + 3600;
            endTime = await futureTimestamp(60 * 60 * 24 * 3);
        });

        it('create round should work', async () => {
            await expect(airdropperLite.createRound(sqtAddress, startTime, endTime))
                .to.be.emit(airdropperLite, 'RoundCreated')
                .withArgs(0, sqtAddress, startTime, endTime);

            const round = await airdropperLite.roundRecord(0);
            expect(round.tokenAddress).to.equal(sqtAddress);
            expect(round.roundStartTime).to.equal(startTime);
            expect(round.roundDeadline).to.equal(endTime);
            expect(await airdropperLite.nextRoundId()).to.equal(1);
        });

        it('create round with invaild parameter should fail', async () => {
            await expect(airdropperLite.createRound(ZERO_ADDRESS, startTime, endTime)).to.be.revertedWith('G009');
            await expect(airdropperLite.createRound(sqtAddress, 100, endTime)).to.be.revertedWith('A001');
            await expect(
                airdropperLite.createRound(
                    sqtAddress,
                    (await lastestBlockTime()) + 60 * 60 * 2,
                    (await lastestBlockTime()) + 60 * 60
                )
            ).to.be.revertedWith('A001');
        });
        it('create round with invaild caller should fail', async () => {
            await expect(
                airdropperLite.connect(wallet_1).createRound(sqtAddress, startTime, endTime)
            ).to.be.revertedWith('A010');
        });
        it('update round should work', async () => {
            await airdropperLite.createRound(sqtAddress, startTime, endTime);
            const [updatedStartTime, updatedEndTime] = [startTime + 1000, endTime - 1000];
            await expect(airdropperLite.updateRound(0, updatedStartTime, updatedEndTime))
                .to.be.emit(airdropperLite, 'RoundUpdated')
                .withArgs(0, updatedStartTime, updatedEndTime);

            const round = await airdropperLite.roundRecord(0);
            expect(round.roundStartTime).to.be.eq(updatedStartTime);
            expect(round.roundDeadline).to.be.eq(updatedEndTime);
        });
        it('update round with invaild caller should fail', async () => {
            await expect(airdropperLite.connect(wallet_1).updateRound(0, startTime, endTime)).to.be.revertedWith(
                'A010'
            );
        });
        it('update round with invalid param should fail', async () => {
            await airdropperLite.createRound(sqtAddress, startTime, endTime);
            const blockTime = await lastestBlockTime();
            // invalid round id;
            await expect(airdropperLite.updateRound(1, startTime, endTime)).to.be.revertedWith('A011');
            // invalid end time
            await expect(airdropperLite.updateRound(0, startTime + 1000, startTime)).to.be.revertedWith('A001');
            await timeTravel(60 * 60 * 24 * 3);
            // round expired
            await expect(airdropperLite.updateRound(0, startTime + 1000, endTime + 1000)).to.be.revertedWith('A011');
        });
    });

    describe('airdrop test', () => {
        beforeEach(async () => {
            //roundId 0: expire
            await airdropperLite.createRound(
                sqtAddress,
                await futureTimestamp(60 * 60 * 2),
                await futureTimestamp(60 * 60 * 24 * 2)
            );
            //roundId 1: ongoing
            await airdropperLite.createRound(
                sqtAddress,
                await futureTimestamp(60 * 60 * 3),
                await futureTimestamp(60 * 60 * 24 * 5)
            );

            await token.increaseAllowance(airdropperLite.address, etherParse('100'));
        });
        it('batch airdrop should work', async () => {
            await expect(
                airdropperLite.batchAirdrop(
                    [wallet_1.address, wallet_2.address],
                    [1, 1],
                    [etherParse('10'), etherParse('20')]
                )
            )
                .to.be.emit(airdropperLite, 'AddAirdrop')
                .withArgs(wallet_1.address, 1, etherParse('10'));

            expect(await airdropperLite.airdropRecord(wallet_1.address, 1)).to.be.eq(etherParse('10'));
            expect(await airdropperLite.airdropRecord(wallet_2.address, 1)).to.be.eq(etherParse('20'));
            expect(await token.balanceOf(airdropperLite.address)).to.be.eq(0);
        });
        it('batch airdrop with invaild caller should fail', async () => {
            await expect(
                airdropperLite
                    .connect(wallet_1)
                    .batchAirdrop([wallet_1.address, wallet_2.address], [1, 1], [etherParse('10'), etherParse('20')])
            ).to.be.revertedWith('A010');
        });
        it('duplicate airdrop should fail', async () => {
            await airdropperLite.batchAirdrop([wallet_1.address], [1], [etherParse('10')]);
            await expect(airdropperLite.batchAirdrop([wallet_1.address], [1], [etherParse('20')])).to.be.revertedWith(
                'A003'
            );
        });
        it('airdrop invaild round should fail', async () => {
            await timeTravel(60 * 60 * 24 * 2);
            await expect(airdropperLite.batchAirdrop([wallet_1.address], [0], [etherParse('10')])).to.be.revertedWith(
                'A002'
            );
        });
        it('airdrop 0 amount should fail', async () => {
            await expect(airdropperLite.batchAirdrop([wallet_1.address], [1], [etherParse('0')])).to.be.revertedWith(
                'A004'
            );
        });
    });

    describe('claim airdrop test', () => {
        beforeEach(async () => {
            await token.increaseAllowance(airdropperLite.address, etherParse('100'));
            await airdropperLite.createRound(
                sqtAddress,
                await futureTimestamp(60 * 60 * 2),
                await futureTimestamp(60 * 60 * 24 * 2)
            );
            await airdropperLite.createRound(
                sqtAddress,
                await futureTimestamp(60 * 60 * 2),
                await futureTimestamp(60 * 60 * 24 * 2)
            );
            await airdropperLite.batchAirdrop(
                [wallet_1.address, wallet_1.address],
                [0, 1],
                [etherParse('10'), etherParse('20')]
            );
            await token.transfer(airdropperLite.address, etherParse('30'));
        });
        it('claim airdrop should work', async () => {
            await timeTravel(60 * 60 * 3);

            await expect(airdropperLite.connect(wallet_1).claimAirdrop(0))
                .to.be.emit(token, 'Transfer')
                .withArgs(airdropperLite.address, wallet_1.address, etherParse('10'));

            expect(await airdropperLite.airdropRecord(wallet_1.address, 0)).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(airdropperLite.address)).to.be.eq(etherParse('20'));
            expect(await token.balanceOf(wallet_1.address)).to.be.eq(etherParse('10'));
        });
        it('batch claim airdrop should work', async () => {
            await timeTravel(60 * 60 * 3);

            await expect(airdropperLite.connect(wallet_1).batchClaimAirdrop([0, 1]))
                .to.be.emit(token, 'Transfer')
                .withArgs(airdropperLite.address, wallet_1.address, etherParse('10'));

            expect(await airdropperLite.airdropRecord(wallet_1.address, 0)).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(airdropperLite.address)).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(wallet_1.address)).to.be.eq(etherParse('30'));
        });
        it('claim 0 airdrop should fail', async () => {
            await timeTravel(60 * 60 * 3);
            await airdropperLite.connect(wallet_1).claimAirdrop(0);
            await expect(airdropperLite.connect(wallet_1).claimAirdrop(0)).to.be.revertedWith('A006');
        });
        it('claim invaild round should fail', async () => {
            await expect(airdropperLite.connect(wallet_1).claimAirdrop(0)).to.be.revertedWith('A005');
            await timeTravel(60 * 60 * 24 * 3);
            await expect(airdropperLite.connect(wallet_1).claimAirdrop(0)).to.be.revertedWith('A005');
        });
    });
});
