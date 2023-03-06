// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {Airdropper, Settings, SQToken} from '../src';
import {ZERO_ADDRESS} from './constants';
import {etherParse, futureTimestamp, timeTravel, lastestTime} from './helper';

describe('Airdropper Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2, wallet_3;
    let airdropper: Airdropper;
    let settings: Settings;
    let token: SQToken;
    let sqtAddress;

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2, wallet_3] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_1);
        airdropper = deployment.airdropper;
        settings = deployment.settings;
        token = deployment.token;
        sqtAddress = await settings.getSQToken();
    });

    describe('init states check', () => {
        it('init nextRoundId should be 0', async () => {
            expect(await airdropper.nextRoundId()).to.equal(0);
        });
        it('init settleDestination should be 0x00', async () => {
            expect(await airdropper.settleDestination()).to.equal(ZERO_ADDRESS);
        });
        it('owner account set to be controller', async () => {
            expect(await airdropper.controllers(wallet_0.address)).to.equal(true);
        });
    });

    describe('config contract', () => {
        it('set settleDestination should work', async () => {
            await airdropper.setSettleDestination(wallet_3.address);
            expect(await airdropper.settleDestination()).to.equal(wallet_3.address);
        });
        it('add controller account should work', async () => {
            expect(await airdropper.controllers(wallet_1.address)).to.equal(false);
            await airdropper.addController(wallet_1.address);
            expect(await airdropper.controllers(wallet_1.address)).to.equal(true);
        });
        it('remove controller account should work', async () => {
            await airdropper.addController(wallet_1.address);
            expect(await airdropper.controllers(wallet_1.address)).to.equal(true);
            await airdropper.removeController(wallet_1.address);
            expect(await airdropper.controllers(wallet_1.address)).to.equal(false);
        });
    });

    describe('round test', () => {
        it('create round should work', async () => {
            const startTime = (await lastestTime(mockProvider)) + 3600;
            const endTime = await futureTimestamp(mockProvider, 60 * 60 * 24 * 3);

            await expect(airdropper.createRound(
                sqtAddress,
                startTime,
                endTime
            )).to.be.emit(airdropper, 'RoundCreated')
            .withArgs(0, sqtAddress, startTime, endTime);
            
            const round = await airdropper.roundRecord(0);
            expect(round.tokenAddress).to.equal(sqtAddress);
            expect(round.roundStartTime).to.equal(startTime);
            expect(round.roundDeadline).to.equal(endTime);
            expect(round.unclaimedAmount).to.equal(etherParse('0'));
            expect(await airdropper.nextRoundId()).to.equal(1);
        });
        it('create round with invaild parameter should fail', async () => {
            await expect(
                airdropper.createRound(
                    ZERO_ADDRESS,
                    (await lastestTime(mockProvider)) + 60 * 60,
                    await futureTimestamp(mockProvider, 60 * 60 * 24 * 3)
                )
            ).to.be.revertedWith('G009');
            await expect(
                airdropper.createRound(sqtAddress, 100, await futureTimestamp(mockProvider, 60 * 60 * 24 * 3))
            ).to.be.revertedWith('A001');
            await expect(
                airdropper.createRound(
                    sqtAddress,
                    (await lastestTime(mockProvider)) + 60 * 60 * 2,
                    (await lastestTime(mockProvider)) + 60 * 60
                )
            ).to.be.revertedWith('A001');
        });
        it('create round with invaild caller should fail', async () => {
            const startTime = (await lastestTime(mockProvider)) + 3600;
            const endTime = await futureTimestamp(mockProvider, 60 * 60 * 24 * 3);
            await expect(
                airdropper.connect(wallet_1).createRound(sqtAddress, startTime, endTime)
            ).to.be.revertedWith('A010');
        });
    });

    describe('airdrop test', () => {
        beforeEach(async () => {
            //roundId 0: expire
            await airdropper.createRound(
                sqtAddress,
                await futureTimestamp(mockProvider, 60 * 60 * 2),
                await futureTimestamp(mockProvider, 60 * 60 * 24 * 2)
            );
            //roundId 1: ongoing
            await airdropper.createRound(
                sqtAddress,
                await futureTimestamp(mockProvider, 60 * 60 * 3),
                await futureTimestamp(mockProvider, 60 * 60 * 24 * 5)
            );

            await token.increaseAllowance(airdropper.address, etherParse('100'));
        });
        it('batch airdrop should work', async () => {
            await expect(airdropper.batchAirdrop(
                    [wallet_1.address, wallet_2.address], 
                    [1, 1], 
                    [etherParse('10'), etherParse('20')])
                )
            .to.be.emit(airdropper, 'AddAirdrop')
            .withArgs(wallet_1.address, 1, etherParse('10'));

            expect(await airdropper.airdropRecord(wallet_1.address, 1)).to.be.eq(etherParse('10'));
            expect(await airdropper.airdropRecord(wallet_2.address, 1)).to.be.eq(etherParse('20'));
            expect(await (await airdropper.roundRecord(1)).unclaimedAmount).to.be.eq(etherParse('30'));
            expect(await token.balanceOf(airdropper.address)).to.be.eq(etherParse('30'));
        });
        it('batch airdrop with invaild caller should fail', async () => {
            await expect(airdropper.connect(wallet_1)
                .batchAirdrop(
                    [wallet_1.address, wallet_2.address], 
                    [1, 1], 
                    [etherParse('10'), etherParse('20')])
                )
            .to.be.revertedWith('A010');
        });
        it('duplicate airdrop should fail', async () => {
            await airdropper.batchAirdrop([wallet_1.address], [1], [etherParse('10')]);
            await expect(airdropper.batchAirdrop([wallet_1.address], [1], [etherParse('20')])).to.be.revertedWith(
                'A003'
            );
        });
        it('airdrop invaild round should fail', async () => {
            await timeTravel(mockProvider, 60 * 60 * 2);
            await expect(airdropper.batchAirdrop([wallet_1.address], [0], [etherParse('10')])).to.be.revertedWith(
                'A002'
            );
        });
        it('airdrop 0 amount should fail', async () => {
            await expect(airdropper.batchAirdrop([wallet_1.address], [1], [etherParse('0')])).to.be.revertedWith(
                'A004'
            );
        });
        it('settle airdrop round should work', async () => {
            await airdropper.setSettleDestination(wallet_3.address);
            await airdropper.batchAirdrop([wallet_1.address], [0], [etherParse('10')]);

            await expect(airdropper.settleEndedRound(0)).to.be.revertedWith('A008');

            await timeTravel(mockProvider, 60 * 60 * 24 * 3);
            await expect(airdropper.settleEndedRound(0))
            .to.be.emit(airdropper, 'RoundSettled')
            .withArgs(0, wallet_3.address, etherParse('10'));
            await expect(airdropper.settleEndedRound(0)).to.be.revertedWith('A009');

            expect(await token.balanceOf(airdropper.address)).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(wallet_3.address)).to.be.eq(etherParse('10'));
        });
    });

    describe('claim airdrop test', () => {
        beforeEach(async () => {
            await token.increaseAllowance(airdropper.address, etherParse('100'));
            await airdropper.createRound(
                sqtAddress,
                await futureTimestamp(mockProvider, 60 * 60 * 2),
                await futureTimestamp(mockProvider, 60 * 60 * 24 * 2)
            );
            await airdropper.createRound(
                sqtAddress,
                await futureTimestamp(mockProvider, 60 * 60 * 2),
                await futureTimestamp(mockProvider, 60 * 60 * 24 * 2)
            );
            await airdropper.batchAirdrop(
                [wallet_1.address, wallet_1.address],
                [0, 1],
                [etherParse('10'), etherParse('20')]
            );
        });
        it('claim airdrop should work', async () => {
            await timeTravel(mockProvider, 60 * 60 * 3);
             
            await expect(airdropper.connect(wallet_1).claimAirdrop(0))
            .to.be.emit(airdropper, 'AirdropClaimed')
            .withArgs(wallet_1.address, 0, etherParse('10'));

            expect(await airdropper.airdropRecord(wallet_1.address, 0)).to.be.eq(etherParse('0'));
            expect(await (await airdropper.roundRecord(0)).unclaimedAmount).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(airdropper.address)).to.be.eq(etherParse('20'));
            expect(await token.balanceOf(wallet_1.address)).to.be.eq(etherParse('10'));
        });
        it('batch claim airdrop should work', async () => {
            await timeTravel(mockProvider, 60 * 60 * 3);

            await expect(airdropper.connect(wallet_1).batchClaimAirdrop([0, 1]))
            .to.be.emit(airdropper, 'AirdropClaimed')
            .withArgs(wallet_1.address, 0, etherParse('10'));
            
            expect(await airdropper.airdropRecord(wallet_1.address, 0)).to.be.eq(etherParse('0'));
            expect(await (await airdropper.roundRecord(0)).unclaimedAmount).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(airdropper.address)).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(wallet_1.address)).to.be.eq(etherParse('30'));
        });
        it('claim 0 airdrop should fail', async () => {
            await timeTravel(mockProvider, 60 * 60 * 3);
            await airdropper.connect(wallet_1).claimAirdrop(0);
            await expect(airdropper.connect(wallet_1).claimAirdrop(0)).to.be.revertedWith('A006');
        });
        it('claim invaild round should fail', async () => {
            await expect(airdropper.connect(wallet_1).claimAirdrop(0)).to.be.revertedWith('A005');
            await timeTravel(mockProvider, 60 * 60 * 24 * 3);
            await expect(airdropper.connect(wallet_1).claimAirdrop(0)).to.be.revertedWith('A005');
        });
    });
});
