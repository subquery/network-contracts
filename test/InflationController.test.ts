// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {time, startNewEra} from './helper';
import {InflationController, EraManager, SQToken} from '../src';
import {PER_MILL} from './constants';

describe('Inflation Controller Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2;
    let inflationDestination;

    let inflationController: InflationController;
    let eraManager: EraManager;
    let token: SQToken;

    let YEAR_SECONDS = (3600 * 24 * 36525) / 100;

    const checkInflation = async () => {
        const totalSupply = await token.totalSupply();
        const inflationRate = await inflationController.inflationRate();
        const eraPeriod = await eraManager.eraPeriod();

        const oldBalance = await token.balanceOf(inflationDestination);
        await startNewEra(mockProvider, eraManager);
        const newBalance = await token.balanceOf(inflationDestination);
        const newSupply = newBalance.sub(oldBalance);
        const expectValue = totalSupply
            .mul(inflationRate)
            .div(PER_MILL * YEAR_SECONDS)
            .mul(eraPeriod);

        const distance = expectValue.sub(newSupply).abs();

        // distance need to less the threshold, `0xDE0B6B3A7640000` -> `1e18`
        expect(distance.div(ethers.BigNumber.from('0xDE0B6B3A7640000'))).to.be.lt(
            ethers.BigNumber.from(inflationRate.toNumber() / 10)
        );
    };

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
        inflationDestination = wallet_1.address;

        const deployment = await deployContracts(wallet_0, wallet_1);
        inflationController = deployment.inflationController;
        eraManager = deployment.eraManager;
        token = deployment.token;
        await startNewEra(mockProvider, eraManager);
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

        it('set infaltion destination without owner should fail', async () => {
            await expect(
                inflationController.connect(wallet_1).setInflationDestination(wallet_2.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('set inflation rate should work', async () => {
            await inflationController.setInflationRate(100);
            expect(await inflationController.inflationRate()).to.equal(100);

            // inflationRateBP can be zero
            await inflationController.setInflationRate(0);
            expect(await inflationController.inflationRate()).to.equal(0);
        });

        it('set inflation rate with invalid params should fail', async () => {
            await expect(inflationController.setInflationRate(1000001)).to.be.revertedWith(
                'IC001'
            );
        });
    });

    describe('Mint Inflation Tokens', () => {
        it('mint inflation tokens should work', async () => {
            await eraManager.updateEraPeriod(time.duration.days(10).toString());
            await checkInflation();
        });

        it('mintInflatedTokens only be called by eraManager', async () => {
            await expect(inflationController.mintInflatedTokens()).to.be.revertedWith(
                'Can only be called by eraManager'
            );
        });

        //eraPeriod: 10 days
        //inflationRateBP: 10 -- 0.0001 -- 0.01%
        //totalSupply: 10 billion
        it('test the precision of Mint for scenario1', async () => {
            //inflationRateBP: 10 -- 0.0001 -- 0.01%
            //setup era period be 10 days
            await eraManager.updateEraPeriod(time.duration.days(10).toString());
            //go through 30 eras -- 300 day
            for (let i = 0; i < 30; i++) {
                await checkInflation();
            }
        });

        //eraPeriod: 7 days
        //inflationRateBP: 1000 -- 0.01 -- 1%
        //totalSupply: 10 billion
        it('test the precision of Mint for scenario2', async () => {
            //setup inflationRateBP: 1000 -- 0.01 -- 1%
            await inflationController.setInflationRate(1000);
            //setup era period be 7 days
            await eraManager.updateEraPeriod(time.duration.days(7).toString());
            //go through 52 eras -- 364 day
            for (let i = 0; i < 52; i++) {
                await checkInflation();
            }
        });
    });

    describe('Mint SQT Tokens', () => {
        it('mint SQT tokens should work', async () => {
            const oldSupply = await token.totalSupply();
            const oldBalance = await token.balanceOf(inflationDestination);
            await inflationController.mintSQT(inflationDestination, 1000);
            expect(await token.totalSupply()).to.equal(oldSupply.add(1000));
            expect(await token.balanceOf(inflationDestination)).to.equal(oldBalance.add(1000));
        });

        it('mintSQT only be called by owner', async () => {
            await expect(inflationController.connect(wallet_2).mintSQT(inflationDestination, 1000)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });
    });
});
