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
    });

    describe('config contract', () => {
        it('set settleDestination should work', async () => {
            await airdropper.setSettleDestination(wallet_3.address);
            expect(await airdropper.settleDestination()).to.equal(wallet_3.address);
        });
    });

    describe('round test', () => {
        it('create round should work', async () => {
            await airdropper.createRound(
                sqtAddress,
                (await lastestTime(mockProvider)) + 60 * 60,
                await futureTimestamp(mockProvider, 60 * 60 * 24 * 3)
            );
            expect((await airdropper.roundRecord(0)).tokenAddress).to.equal(sqtAddress);
            expect(await airdropper.nextRoundId()).to.equal(1);
        });
        it('create round with invaild parameter should fail', async () => {
            await expect(
                airdropper.createRound(
                    ZERO_ADDRESS,
                    (await lastestTime(mockProvider)) + 60 * 60,
                    await futureTimestamp(mockProvider, 60 * 60 * 24 * 3)
                )
            ).to.be.revertedWith('invaild token address');
            await expect(
                airdropper.createRound(sqtAddress, 100, await futureTimestamp(mockProvider, 60 * 60 * 24 * 3))
            ).to.be.revertedWith('invaild round time set');
            await expect(
                airdropper.createRound(
                    sqtAddress,
                    (await lastestTime(mockProvider)) + 60 * 60 * 2,
                    (await lastestTime(mockProvider)) + 60 * 60
                )
            ).to.be.revertedWith('invaild round time set');
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
            await airdropper
                .connect(wallet_0)
                .batchAirdrop([wallet_1.address, wallet_2.address], [1, 1], [etherParse('10'), etherParse('20')]);
            expect(await airdropper.airdropRecord(wallet_1.address, 1)).to.be.eq(etherParse('10'));
            expect(await airdropper.airdropRecord(wallet_2.address, 1)).to.be.eq(etherParse('20'));
            expect(await (await airdropper.roundRecord(1)).unclaimedAmount).to.be.eq(etherParse('30'));
            expect(await token.balanceOf(airdropper.address)).to.be.eq(etherParse('30'));
        });
        it('duplicate airdrop should fail', async () => {
            await airdropper.batchAirdrop([wallet_1.address], [1], [etherParse('10')]);
            await expect(airdropper.batchAirdrop([wallet_1.address], [1], [etherParse('20')])).to.be.revertedWith(
                'duplicate airdrop'
            );
        });
        it('airdrop invaild round should fail', async () => {
            await timeTravel(mockProvider, 60 * 60 * 2);
            await expect(airdropper.batchAirdrop([wallet_1.address], [0], [etherParse('10')])).to.be.revertedWith(
                'invaild round to airdrop'
            );
        });
        it('airdrop 0 amount should fail', async () => {
            await expect(airdropper.batchAirdrop([wallet_1.address], [1], [etherParse('0')])).to.be.revertedWith(
                'invaild airdrop amount'
            );
        });
        it('settle invaild round should work', async () => {
            await airdropper.setSettleDestination(wallet_3.address);
            await airdropper.batchAirdrop([wallet_1.address], [0], [etherParse('10')]);
            await expect(airdropper.settleEndedRound(0)).to.be.revertedWith('invaild round to settle');
            await timeTravel(mockProvider, 60 * 60 * 24 * 3);
            await airdropper.settleEndedRound(0);
            expect(await token.balanceOf(airdropper.address)).to.be.eq(etherParse('0'));
            await expect(airdropper.settleEndedRound(0)).to.be.revertedWith('none token left');
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
            await airdropper.connect(wallet_1).claimAirdrop(0);
            expect(await airdropper.airdropRecord(wallet_1.address, 0)).to.be.eq(etherParse('0'));
            expect(await (await airdropper.roundRecord(0)).unclaimedAmount).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(airdropper.address)).to.be.eq(etherParse('20'));
            expect(await token.balanceOf(wallet_1.address)).to.be.eq(etherParse('10'));
        });
        it('batch claim airdrop should work', async () => {
            await timeTravel(mockProvider, 60 * 60 * 3);
            await airdropper.connect(wallet_1).batchClaimAirdrop([0, 1]);
            expect(await airdropper.airdropRecord(wallet_1.address, 0)).to.be.eq(etherParse('0'));
            expect(await (await airdropper.roundRecord(0)).unclaimedAmount).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(airdropper.address)).to.be.eq(etherParse('0'));
            expect(await token.balanceOf(wallet_1.address)).to.be.eq(etherParse('30'));
        });
        it('claim 0 airdrop should fail', async () => {
            await timeTravel(mockProvider, 60 * 60 * 3);
            await airdropper.connect(wallet_1).claimAirdrop(0);
            await expect(airdropper.connect(wallet_1).claimAirdrop(0)).to.be.revertedWith('nothing claim');
        });
        it('claim invaild round should fail', async () => {
            await expect(airdropper.connect(wallet_1).claimAirdrop(0)).to.be.revertedWith('invaild round to claim');
            await timeTravel(mockProvider, 60 * 60 * 24 * 3);
            await expect(airdropper.connect(wallet_1).claimAirdrop(0)).to.be.revertedWith('invaild round to claim');
        });
    });
});
