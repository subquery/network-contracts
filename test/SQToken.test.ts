// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {InflationController, SQToken} from '../src';
import {etherParse} from './helper';

describe('SQToken Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1;
    let inflationController: InflationController;
    let token: SQToken;

    beforeEach(async () => {
        [wallet_0, wallet_1] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_1);
        inflationController = deployment.inflationController;
        token = deployment.token;
    });

    describe('Genesis Config', () => {
        it('check genesis config', async () => {
            expect(await token.getMinter()).to.equal(inflationController.address);
            expect(await token.balanceOf(wallet_0.address)).to.equal(etherParse("10000000000"));
        });
    });

    describe('Mint Tokens', () => {
        it('mint with personal wallet should fail', async () => {
            await expect(token.mint(wallet_0.address, etherParse("1"))).to.be.revertedWith('Not minter');
        });
    });

    describe('Burn Tokens', () => {
        beforeEach(async () => {
            await token.transfer(wallet_1.address, etherParse("10"));
        });

        it('burn tokens with current account should work', async () => {
            const balance = await token.balanceOf(wallet_1.address);
            await token.connect(wallet_1).burn(etherParse("1"));
            expect(await token.balanceOf(wallet_1.address)).to.equal(balance.sub(etherParse("1")));
        });

        it('burn tokens from given account should work', async () => {
            const balance = await token.balanceOf(wallet_1.address);
            await token.connect(wallet_1).approve(wallet_0.address, etherParse("10"));
            await token.burnFrom(wallet_1.address, etherParse("1"));

            expect(await token.allowance(wallet_1.address, wallet_0.address)).to.equal(etherParse("9"));
            expect(await token.balanceOf(wallet_1.address)).to.equal(balance.sub(etherParse("1")));
        });
    });
});
