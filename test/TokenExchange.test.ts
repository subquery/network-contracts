// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERC20, SQToken__factory, Settings, SQContracts } from '../src';
import { ZERO_ADDRESS } from './constants';
import { etherParse, revertrMsg } from './helper';
import { deployContracts } from './setup';
import { TokenExchange } from 'build';

describe('TokenExchange Contract', () => {
    let wallet_0, wallet_1;
    let tokenExchange: TokenExchange;
    let settings: Settings;
    let ksqtAddress: string;
    let kSQToken: ERC20;
    let SQToken: ERC20;
    let sqtAddress: string;

    beforeEach(async () => {
        [wallet_0, wallet_1] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_0);
        tokenExchange = deployment.tokenExchange;
        kSQToken = deployment.token;
        settings = deployment.settings;
        ksqtAddress = await settings.getContractAddress(SQContracts.SQToken);

        //deploy SQToken
        SQToken = await new SQToken__factory(wallet_0).deploy(ZERO_ADDRESS, etherParse('10000000000000'));
        await SQToken.deployTransaction.wait();
        sqtAddress = SQToken.address;

        await kSQToken.transfer(wallet_1.address, etherParse('1000'));
        await SQToken.increaseAllowance(tokenExchange.address, etherParse('3000'));
        await kSQToken.connect(wallet_1).increaseAllowance(tokenExchange.address, etherParse('1000'));
    });

    describe('order operations', () => {
        it('send order should work', async () => {
            expect(await tokenExchange.nextOrderId()).to.be.eq(1);
            await expect(tokenExchange.sendOrder(
                sqtAddress,
                ksqtAddress,
                etherParse('1'),
                etherParse('2'),
                etherParse('3000')
            )).to.be.emit(tokenExchange, 'ExchangeOrderSent')
              .withArgs(1, wallet_0.address, sqtAddress, ksqtAddress, etherParse('1'), etherParse('2'), etherParse('3000'));

            const order = await tokenExchange.orders(1);
            expect(order.sender).to.be.eq(wallet_0.address);
            expect(order.amountGet).to.be.eq(etherParse('2'));
            expect(order.amountGive).to.be.eq(etherParse('1'));
            expect(order.tokenGiveBalance).to.be.eq(etherParse('3000'));
            expect(await SQToken.balanceOf(tokenExchange.address)).to.be.eq(etherParse('3000'));
            expect(await tokenExchange.nextOrderId()).to.be.eq(2);
        });

        it('send order with invalid parameters should fail', async () => {
            await expect(
                tokenExchange.sendOrder(
                    sqtAddress,
                    ksqtAddress,
                    etherParse('1'),
                    etherParse('2'),
                    0,
                )
            ).to.be.revertedWith('TE001');

            await expect(
              tokenExchange.connect(wallet_1).sendOrder(
                  sqtAddress,
                  ksqtAddress,
                  etherParse('1'),
                  etherParse('2'),
                  etherParse('3000'),
              )
          ).to.be.revertedWith(revertrMsg.notOwner);
        });
        it('owner cancel the order should work', async () => {
            await tokenExchange.sendOrder(
                sqtAddress,
                ksqtAddress,
                etherParse('1'),
                etherParse('2'),
                etherParse('3000')
            );

            await expect(tokenExchange.connect(wallet_1).cancelOrder(1)).to.be.revertedWith(revertrMsg.notOwner);
            await expect(tokenExchange.cancelOrder(1))
              .to.be.emit(tokenExchange, 'OrderSettled')
              .withArgs(1, sqtAddress, ksqtAddress, etherParse('3000'));
            
            expect(await SQToken.balanceOf(tokenExchange.address)).to.be.eq(etherParse('0'));
            expect((await tokenExchange.orders(1)).sender).to.be.eq(ZERO_ADDRESS);
            await expect(tokenExchange.cancelOrder(1)).to.be.revertedWith("TE002");
        });
    });

    describe('token exchange', () => {
        beforeEach(async () => {
            await tokenExchange.sendOrder(
                sqtAddress,
                ksqtAddress,
                etherParse('1'),
                etherParse('2'),
                etherParse('3000'),
            );
        });
        it('trade on exist order should work', async () => {
          const totalKSQT = await kSQToken.totalSupply();
          expect(await tokenExchange.connect(wallet_1).trade(1, etherParse('1000')))
            .to.be.emit(tokenExchange, 'Trade')
            .withArgs(1, sqtAddress, ksqtAddress, etherParse('500'), etherParse('1000'));

          expect((await tokenExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('2500'));
          expect(await SQToken.balanceOf(tokenExchange.address)).to.be.eq(etherParse('2500'));
          expect(await SQToken.balanceOf(wallet_1.address)).to.be.eq(etherParse('500'));
          expect(await kSQToken.balanceOf(tokenExchange.address)).to.be.eq(etherParse('0'));
          expect(await kSQToken.balanceOf(wallet_1.address)).to.be.eq(etherParse('0'));
          expect(await kSQToken.totalSupply()).to.be.eq(totalKSQT.sub(etherParse('1000')));
        });
        it('trade on invalid order should fail', async () => {
          await expect(tokenExchange.connect(wallet_1).trade(10, etherParse('2'))).to.be.revertedWith(
              'TE002'
          );
        });
        it('trade over order balance should fail', async () => {
            await kSQToken.transfer(wallet_1.address, etherParse('8000'));
            await kSQToken.connect(wallet_1).approve(tokenExchange.address, etherParse('8000'));
            await expect(tokenExchange.connect(wallet_1).trade(1, etherParse('8000'))).to.be.revertedWith(
                'TE003'
            );
        });
    });
});
