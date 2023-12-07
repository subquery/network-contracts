// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { BigNumber } from "ethers";
import { ethers, waffle } from 'hardhat';
import {
    EraManager,
    IndexerRegistry,
    PermissionedExchange,
    PlanManager,
    ProjectRegistry,
    RewardsDistributer,
    SQToken,
    SUSD,
    SQToken__factory,
    ServiceAgreementRegistry,
    Settings,
    Staking,
} from '../src';
import { DEPLOYMENT_ID, METADATA_HASH, VERSION, ZERO_ADDRESS } from './constants';
import { constants, etherParse, futureTimestamp, registerIndexer, startNewEra, time, timeTravel } from './helper';
import { deployContracts } from './setup';
import { TokenExchange } from 'build';

describe('PermissionedExchange Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2, indexer, consumer;
    let tokenExchange: TokenExchange;
    let settings: Settings;
    let ksqtAddress: string;
    let kSQToken: SQToken;
    let SQToken: SQToken;
    let sqtAddress: string;

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2, indexer, consumer] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_0);
        tokenExchange = deployment.tokenExchange;
        kSQToken = deployment.token;
        settings = deployment.settings;
        ksqtAddress = await settings.getSQToken();

        //deploy SQToken
        SQToken = await new SQToken__factory(wallet_0).deploy(deployment.inflationController.address, etherParse('10000000000000'));
        await SQToken.deployTransaction.wait();
        sqtAddress = SQToken.address;

        await SQToken.transfer(wallet_1.address, BigNumber.from(1e8));
        await SQToken.transfer(wallet_2.address, BigNumber.from(1e8));
        await kSQToken.transfer(wallet_1.address, etherParse('1000'));
        await kSQToken.transfer(wallet_2.address, etherParse('1000'));

        await SQToken.connect(wallet_0).increaseAllowance(tokenExchange.address, etherParse('1000'));
        await SQToken.connect(wallet_1).increaseAllowance(tokenExchange.address, BigNumber.from(1e8));
        await SQToken.connect(wallet_2).increaseAllowance(tokenExchange.address, BigNumber.from(1e8));
        await kSQToken.connect(wallet_0).increaseAllowance(tokenExchange.address, etherParse('50000'));
        await kSQToken.connect(wallet_1).increaseAllowance(tokenExchange.address, etherParse('1000'));
        await kSQToken.connect(wallet_2).increaseAllowance(tokenExchange.address, etherParse('1000'));
    });

    describe('order operations', () => {
        it('send order should work', async () => {
            expect(await tokenExchange.nextOrderId()).to.be.eq(1);
            const expiredTime = await futureTimestamp(mockProvider, 60 * 60 * 24);
            await expect(tokenExchange.sendOrder(
                sqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                expiredTime,
                0,
                etherParse('10')
            ))
                .to.be.emit(tokenExchange, 'ExchangeOrderSent')
                .withArgs(1, wallet_0.address, sqtAddress, sqtAddress, etherParse('1'), etherParse('5'), expiredTime);
            expect(await tokenExchange.nextOrderId()).to.be.eq(2);
            expect(await (await tokenExchange.orders(1)).sender).to.be.eq(wallet_0.address);
            expect(await (await tokenExchange.orders(1)).amountGet).to.be.eq(etherParse('5'));
            expect(await (await tokenExchange.orders(1)).amountGive).to.be.eq(etherParse('1'));
            expect(await (await tokenExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('10'));
            expect(await SQToken.balanceOf(tokenExchange.address)).to.be.eq(etherParse('10'));
        });

        it('send order with invalid parameters should fail', async () => {
            await expect(
                tokenExchange.sendOrder(
                    sqtAddress,
                    sqtAddress,
                    etherParse('1'),
                    etherParse('5'),
                    0,
                    0,
                    etherParse('10')
                )
            ).to.be.revertedWith('PE002');
            await expect(
                tokenExchange.sendOrder(
                    sqtAddress,
                    sqtAddress,
                    0,
                    etherParse('5'),
                    await futureTimestamp(mockProvider, 60 * 60 * 24),
                    0,
                    etherParse('10')
                )
            ).to.be.revertedWith('PE003');
            await expect(
                tokenExchange.sendOrder(
                    sqtAddress,
                    sqtAddress,
                    etherParse('1'),
                    0,
                    await futureTimestamp(mockProvider, 60 * 60 * 24),
                    0,
                    etherParse('10')
                )
            ).to.be.revertedWith('PE003');
        });
        it('order sender cancel the order should work', async () => {
            await tokenExchange.sendOrder(
                sqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                etherParse('10')
            );
            await expect(tokenExchange.connect(wallet_1).cancelOrder(1)).to.be.revertedWith(
                'PE011'
            );
            await tokenExchange.cancelOrder(1);
            expect(await SQToken.balanceOf(tokenExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await tokenExchange.orders(1)).sender).to.be.eq(ZERO_ADDRESS);
            await expect(tokenExchange.connect(wallet_1).cancelOrder(1)).to.be.revertedWith('PE009');
        });
    });

    describe('trade test', () => {
        const order1Balance = BigNumber.from('10000000'); // 1000 usd
        const order2Balance = etherParse('50000'); // 50000 sqt
        const order3Balance = BigNumber.from('1000000'); // 1 usd
        beforeEach(async () => {
            await tokenExchange.setController(wallet_1.address, true);
            await tokenExchange.connect(wallet_1).addQuota(sqtAddress, wallet_2.address, etherParse('100'));
            //order 1: 1 usd -> 50 sqt, 1e6 usd -> 5e19 sqt
            await tokenExchange.sendOrder(
                sqtAddress,
                sqtAddress,
                BigNumber.from('1000000'),
                etherParse('50'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                order1Balance // 1000 usd
            );
            //order 2: 50 sqt -> 1 usd, 5e19 sqt -> 1e6 usd
            await tokenExchange.sendOrder(
                sqtAddress,
                sqtAddress,
                etherParse('50'),
                BigNumber.from('1000000'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                order2Balance
            );
            //order 3: 1 usd -> 50 sqt, 1e6 usd -> 5e19 sqt
            await tokenExchange.sendOrder(
                sqtAddress,
                sqtAddress,
                BigNumber.from('1000000'),
                etherParse('50'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                order3Balance // 1000 usd
            );
        });
        it('trade on exist order should work', async () => {
        });
        it('trade over order balance should fail', async () => {
            await tokenExchange.connect(wallet_2).trade(3, etherParse('50')); // 1usd => 50 sqt
            const orderBalance = (await tokenExchange.orders(3)).tokenGiveBalance;
            expect(orderBalance).to.eq(0);
            // trade minimum 1wei usd
            await expect(tokenExchange.connect(wallet_2).trade(3, BigNumber.from(5e13))).to.be.revertedWith(
                'PE008'
            );
        });
        it('trade on invalid order should fail', async () => {
            await expect(tokenExchange.connect(wallet_2).trade(10, etherParse('2'))).to.be.revertedWith(
                'PE006'
            );
            await timeTravel(mockProvider, 2 * 60 * 60 * 24);
            await expect(tokenExchange.connect(wallet_2).trade(1, etherParse('2'))).to.be.revertedWith(
                'PE006'
            );
        });
    });
});
