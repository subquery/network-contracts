// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { etherParse, revertrMsg } from './helper';
import { deployContracts } from './setup';
import { SQTGift, SQTRedeem } from 'build';
import { ERC20 } from '../src';

describe('Redeem Contract', () => {
    let wallet_0, wallet_1;
    let nft: SQTGift;
    let sqToken: ERC20;
    let sqtRedeem: SQTRedeem;
    let sqtGift: SQTGift;

    const amount = etherParse('1000');
    const deployer = () => deployContracts(wallet_0, wallet_1);

    before(async () => {
        [wallet_0, wallet_1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        nft = deployment.sqtGift;
        sqToken = deployment.token;
        sqtRedeem = deployment.sqtRedeem;
        sqtGift = deployment.sqtGift;
    });

    describe('Redeem Configuration', () => {
        it('should be able to update the redeemable status', async () => {
            expect(await sqtRedeem.redeemable()).to.be.false;
            await sqtRedeem.setRedeemable(true);
            expect(await sqtRedeem.redeemable()).to.be.true;
        });

        it('should be able to set redeemable ammount', async () => {
            for (let i = 0; i < 3; i++) {
                await sqtRedeem.setRedeemableAmount(nft.address, i, amount);
                expect(await sqtRedeem.redeemableAmount(nft.address, i)).to.be.equal(amount);
            }
        });

        it('should be able to deposit and withdraw token', async () => {
            await sqToken.increaseAllowance(sqtRedeem.address, amount);
            await sqtRedeem.deposit(amount);
            expect(await sqToken.balanceOf(sqtRedeem.address)).to.be.equal(amount);
            await sqtRedeem.withdraw(amount);
            expect(await sqToken.balanceOf(sqtRedeem.address)).to.be.equal(0);
        });

        it('only owner can call configuration function', async () => {
            await expect(sqtRedeem.connect(wallet_1).setRedeemable(true)).to.be.revertedWith(revertrMsg.notOwner);
            await expect(sqtRedeem.connect(wallet_1).deposit(amount)).to.be.revertedWith(revertrMsg.notOwner);
            await expect(sqtRedeem.connect(wallet_1).withdraw(amount)).to.be.revertedWith(revertrMsg.notOwner);
            await expect(sqtRedeem.connect(wallet_1).setRedeemableAmount(nft.address, 0, amount)).to.be.revertedWith(
                revertrMsg.notOwner
            );
        });
    });

    describe('NFT Redeem', () => {
        beforeEach(async () => {
            // create nft series 0 and mint token 0 to wallet_0
            await nft.createSeries(100, 'abc');
            await nft.addToAllowlist(0, wallet_0.address, 1);
            await nft.mint(0);
        });

        it('should be able to redeem with valid NFT token', async () => {
            // set up redeem contract
            await sqtRedeem.setRedeemable(true);
            await sqToken.increaseAllowance(sqtRedeem.address, amount);
            await sqtRedeem.deposit(amount);
            await sqtRedeem.setRedeemableAmount(nft.address, 0, amount);
            await sqtGift.approve(sqtRedeem.address, 1);
            await expect(sqtRedeem.redeem(nft.address, 1))
                .to.be.emit(sqtRedeem, 'SQTRedeemed')
                .withArgs(wallet_0.address, 1, 0, nft.address, amount);

            await expect(sqtRedeem.redeem(nft.address, 1)).to.revertedWith('ERC721: invalid token ID');
        });

        it('should not be able to redeem with invalid NFT token', async () => {
            // 1. can not redeem if contract status is not redeemable
            await sqtGift.approve(sqtRedeem.address, 1);
            await expect(sqtRedeem.redeem(nft.address, 1)).to.be.revertedWith('SQR002');
            // 2. can not redeem if nft token owner is not the sender
            await sqtRedeem.setRedeemable(true);
            await expect(sqtRedeem.connect(wallet_1).redeem(nft.address, 1)).to.be.revertedWith('SQR005');
            // 3. can not redeem if redeemable amount is 0
            await expect(sqtRedeem.redeem(nft.address, 1)).to.be.revertedWith('SQR004');
            // 4. can not redeem if sqt token is not enough
            await sqtRedeem.setRedeemableAmount(nft.address, 0, amount);
            await expect(sqtRedeem.redeem(nft.address, 1)).to.be.revertedWith(revertrMsg.insufficientBalance);
        });
    });
});
