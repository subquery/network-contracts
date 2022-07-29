// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {PermissionedExchange, Settings, SQToken, SQToken__factory} from '../src';
import {ZERO_ADDRESS} from './constants';
import {etherParse, futureTimestamp, timeTravel, lastestTime} from './helper';

describe('PermissionedExchange Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2;
    let permissionedExchange: PermissionedExchange;
    let settings: Settings;
    let sqtAddress;
    let asqtAddress;
    let asqToken: SQToken;
    let sqToken: SQToken;

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_0);
        permissionedExchange = deployment.permissionedExchange;
        sqToken = deployment.token;
        settings = deployment.settings;
        sqtAddress = await settings.getSQToken();

        //deploy asqt
        asqToken = await new SQToken__factory(wallet_0).deploy(deployment.inflationController.address);
        await asqToken.deployTransaction.wait();
        asqtAddress = asqToken.address;

        //setup
        await asqToken.transfer(wallet_1.address, etherParse('1000'));
        await asqToken.transfer(wallet_2.address, etherParse('1000'));
        await sqToken.transfer(wallet_1.address, etherParse('1000'));
        await sqToken.transfer(wallet_2.address, etherParse('1000'));

        await asqToken.connect(wallet_0).increaseAllowance(permissionedExchange.address, etherParse('1000'));
        await asqToken.connect(wallet_1).increaseAllowance(permissionedExchange.address, etherParse('1000'));
        await asqToken.connect(wallet_2).increaseAllowance(permissionedExchange.address, etherParse('1000'));
        await sqToken.connect(wallet_0).increaseAllowance(permissionedExchange.address, etherParse('1000'));
        await sqToken.connect(wallet_1).increaseAllowance(permissionedExchange.address, etherParse('1000'));
        await sqToken.connect(wallet_2).increaseAllowance(permissionedExchange.address, etherParse('1000'));
    });

    describe('config contract', () => {
        it('add Controller should work', async () => {
            expect(await permissionedExchange.exchangeController(wallet_1.address)).to.equal(false);
            await permissionedExchange.setController(wallet_1.address, true);
            expect(await permissionedExchange.exchangeController(wallet_1.address)).to.equal(true);
            await permissionedExchange.setController(wallet_1.address, false);
            expect(await permissionedExchange.exchangeController(wallet_1.address)).to.equal(false);
        });

        it('add Quota should work', async () => {
            await permissionedExchange.setController(wallet_1.address, true);
            expect(await permissionedExchange.tradeQuota(sqtAddress, wallet_2.address)).to.equal(0);
            await permissionedExchange.connect(wallet_1).addQuota(sqtAddress, wallet_2.address, etherParse('5'));
            expect(await permissionedExchange.tradeQuota(sqtAddress, wallet_2.address)).to.be.eq(etherParse('5'));
        });

        it('add Quota without permission should fail', async () => {
            await expect(
                permissionedExchange.connect(wallet_2).addQuota(sqtAddress, wallet_2.address, etherParse('5'))
            ).to.be.revertedWith('Not controller');
        });
    });

    describe('order operations', () => {
        it('only send order should work', async () => {
            expect(await permissionedExchange.nextOrderId()).to.be.eq(0);
            await permissionedExchange.sendOrder(
                asqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24)
            );
            expect(await permissionedExchange.nextOrderId()).to.be.eq(1);
            expect(await (await permissionedExchange.orders(0)).sender).to.be.eq(wallet_0.address);
            expect(await (await permissionedExchange.orders(0)).amountGet).to.be.eq(etherParse('5'));
            expect(await (await permissionedExchange.orders(0)).amountGive).to.be.eq(etherParse('1'));
            expect(await (await permissionedExchange.orders(0)).amountGiveLeft).to.be.eq(etherParse('1'));
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('1'));
        });
        it('send order with invalid parameters should fail', async () => {
            await expect(
                permissionedExchange.sendOrder(asqtAddress, sqtAddress, etherParse('1'), etherParse('5'), 0)
            ).to.be.revertedWith('invalid expireDate');
            await expect(
                permissionedExchange.sendOrder(
                    asqtAddress,
                    sqtAddress,
                    0,
                    etherParse('5'),
                    await futureTimestamp(mockProvider, 60 * 60 * 24)
                )
            ).to.be.revertedWith('invalid amount');
            await expect(
                permissionedExchange.sendOrder(
                    asqtAddress,
                    sqtAddress,
                    etherParse('1'),
                    0,
                    await futureTimestamp(mockProvider, 60 * 60 * 24)
                )
            ).to.be.revertedWith('invalid amount');
        });
        it('order sender cancel the order should work', async () => {
            await permissionedExchange.sendOrder(
                asqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24)
            );
            await expect(permissionedExchange.connect(wallet_1).cancelOrder(0)).to.be.revertedWith(
                'only order sender allowed'
            );
            await permissionedExchange.cancelOrder(0);
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(0)).sender).to.be.eq(ZERO_ADDRESS);
            await expect(permissionedExchange.connect(wallet_1).cancelOrder(0)).to.be.revertedWith('order not exist');
        });
        it('anyone settle the expired order should work', async () => {
            await permissionedExchange.sendOrder(
                asqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24)
            );
            await expect(permissionedExchange.connect(wallet_2).settleExpiredOrder(0)).to.be.revertedWith(
                'order not expired'
            );
            await timeTravel(mockProvider, 2 * 60 * 60 * 24);
            await permissionedExchange.connect(wallet_2).settleExpiredOrder(0);
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(0)).sender).to.be.eq(ZERO_ADDRESS);
            await expect(permissionedExchange.connect(wallet_2).settleExpiredOrder(0)).to.be.revertedWith(
                'order not exist'
            );
        });
    });

    describe('trade test', () => {
        beforeEach(async () => {
            await permissionedExchange.setController(wallet_1.address, true);
            await permissionedExchange.connect(wallet_1).addQuota(sqtAddress, wallet_2.address, etherParse('2'));
            //order 1: 5 asqt -> 10 sqt
            await permissionedExchange.sendOrder(
                asqtAddress,
                sqtAddress,
                etherParse('5'),
                etherParse('10'),
                await futureTimestamp(mockProvider, 60 * 60 * 24)
            );
            //order 2: 10 sqt -> 5 asqt
            await permissionedExchange.sendOrder(
                sqtAddress,
                asqtAddress,
                etherParse('10'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24)
            );
        });
        it('trade on exist order should work', async () => {
            await permissionedExchange.connect(wallet_2).trade(0, etherParse('2'));
            expect(await asqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('1001'));
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('4'));
            expect(await sqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('998'));
            expect(await (await permissionedExchange.orders(0)).amountGiveLeft).to.be.eq(etherParse('4'));
            await expect(permissionedExchange.connect(wallet_2).trade(0, etherParse('2'))).to.be.revertedWith(
                'tradeQuota reached'
            );
            await expect(permissionedExchange.connect(wallet_2).trade(1, etherParse('100'))).to.be.revertedWith(
                'trade amount exceed order balance'
            );
            await permissionedExchange.connect(wallet_2).trade(1, etherParse('5'));
            expect(await asqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('996'));
            expect(await sqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('1008'));
            expect(await sqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(1)).amountGiveLeft).to.be.eq(etherParse('0'));
        });
        it('trade on invalid order should fail', async () => {
            await expect(permissionedExchange.connect(wallet_2).trade(10, etherParse('2'))).to.be.revertedWith(
                'order invalid'
            );
            await timeTravel(mockProvider, 2 * 60 * 60 * 24);
            await expect(permissionedExchange.connect(wallet_2).trade(0, etherParse('2'))).to.be.revertedWith(
                'order invalid'
            );
        });
    });
});
