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
    RewardsDistributor,
    SQToken,
    SUSD,
    SUSD__factory,
    ServiceAgreementRegistry,
    Settings,
    Staking, ERC20, SQContracts,
} from '../src';
import { DEPLOYMENT_ID, METADATA_HASH, VERSION, ZERO_ADDRESS } from './constants';
import { constants, etherParse, futureTimestamp, registerRunner, startNewEra, time, timeTravel } from './helper';
import { deployContracts } from './setup';

// PermissionedExchange only available on Kepler Network
describe.skip('PermissionedExchange Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2, runner, consumer;
    let permissionedExchange: PermissionedExchange;
    let settings: Settings;
    let sqtAddress;
    let usdAddress;
    let usdToken: SUSD;
    let sqToken: ERC20;
    let staking: Staking;
    let projectRegistry: ProjectRegistry;
    let indexerRegistry: IndexerRegistry;
    let planManager: PlanManager;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributor;
    let serviceAgreementRegistry: ServiceAgreementRegistry;

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2, runner, consumer] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_0);
        permissionedExchange = deployment.permissionedExchange;
        sqToken = deployment.token;
        settings = deployment.settings;
        sqtAddress = await settings.getContractAddress(SQContracts.SQToken);
        staking = deployment.staking;
        projectRegistry = deployment.projectRegistry;
        indexerRegistry = deployment.indexerRegistry;
        planManager = deployment.planManager;
        eraManager = deployment.eraManager;
        rewardsDistributor = deployment.rewardsDistributor;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;

        //deploy usd
        usdToken = await new SUSD__factory(wallet_0).deploy(etherParse("10000000000"));
        await usdToken.deployTransaction.wait();
        usdAddress = usdToken.address;

        //setup
        await permissionedExchange.setTradeLimitation(etherParse('10000'));
        await permissionedExchange.connect(wallet_0).setTradeLimitationPerAccount(1e8); // <> $100 usd(decimal 6)

        await usdToken.transfer(wallet_1.address, BigNumber.from(1e8));
        await usdToken.transfer(wallet_2.address, BigNumber.from(1e8));
        await sqToken.transfer(wallet_1.address, etherParse('1000'));
        await sqToken.transfer(wallet_2.address, etherParse('1000'));

        await usdToken.connect(wallet_0).increaseAllowance(permissionedExchange.address, etherParse('1000'));
        await usdToken.connect(wallet_1).increaseAllowance(permissionedExchange.address, BigNumber.from(1e8));
        await usdToken.connect(wallet_2).increaseAllowance(permissionedExchange.address, BigNumber.from(1e8));
        await sqToken.connect(wallet_0).increaseAllowance(permissionedExchange.address, etherParse('50000'));
        await sqToken.connect(wallet_1).increaseAllowance(permissionedExchange.address, etherParse('1000'));
        await sqToken.connect(wallet_2).increaseAllowance(permissionedExchange.address, etherParse('1000'));
    });

    describe('config contract', () => {
        it('order id should start from 1', async () => {
            expect(await permissionedExchange.nextOrderId()).to.equal(1);
        });

        it('add Controller should work', async () => {
            expect(await permissionedExchange.exchangeController(wallet_1.address)).to.equal(false);
            await permissionedExchange.setController(wallet_1.address, true);
            expect(await permissionedExchange.exchangeController(wallet_1.address)).to.equal(true);
            await permissionedExchange.setController(wallet_1.address, false);
            expect(await permissionedExchange.exchangeController(wallet_1.address)).to.equal(false);
        });

        it('set trade limitation should work', async () => {
            expect(await permissionedExchange.tradeLimitation()).to.equal(etherParse('10000'));
            await permissionedExchange.setTradeLimitation(etherParse('1000'));
            expect(await permissionedExchange.tradeLimitation()).to.equal(etherParse('1000'));
        });

        it('add Quota should work', async () => {
            await permissionedExchange.setController(wallet_1.address, true);
            expect(await permissionedExchange.tradeQuota(sqtAddress, wallet_2.address)).to.equal(0);
            await expect(permissionedExchange.connect(wallet_1).addQuota(sqtAddress, wallet_2.address, etherParse('5')))
                .to.be.emit(permissionedExchange, 'QuotaAdded')
                .withArgs(sqtAddress, wallet_2.address, etherParse('5'));
            expect(await permissionedExchange.tradeQuota(sqtAddress, wallet_2.address)).to.be.eq(etherParse('5'));
        });

        it('add Quota without permission should fail', async () => {
            await expect(
                permissionedExchange.connect(wallet_2).addQuota(sqtAddress, wallet_2.address, etherParse('5'))
            ).to.be.revertedWith('PE001');
        });
    });

    describe('quota update', () => {
        beforeEach(async () => {
            await sqToken.transfer(runner.address, etherParse('2000'));
            await registerRunner(sqToken, indexerRegistry, staking, runner, runner, etherParse('2000'));
            await sqToken.transfer(consumer.address, etherParse('10'));
            await sqToken.connect(consumer).increaseAllowance(planManager.address, etherParse('10'));
            // create query project
            await projectRegistry.createProject(METADATA_HASH, VERSION, DEPLOYMENT_ID,0);
            // wallet_0 start project
            await projectRegistry.connect(runner).startService(DEPLOYMENT_ID);
            // create plan template
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, sqToken.address, METADATA_HASH);
            // default plan -> planId: 1
            await planManager.connect(runner).createPlan(etherParse('10'), 0, constants.ZERO_BYTES32);
            await sqToken.connect(consumer).increaseAllowance(serviceAgreementRegistry.address, etherParse('50'));
            await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);
        });

        it('claimed reward should add to quota', async () => {
            const balance_before = await sqToken.balanceOf(runner.address);
            await startNewEra(mockProvider, eraManager);
            await expect(rewardsDistributor.collectAndDistributeRewards(runner.address));
            let balance = await sqToken.balanceOf(runner.address);
            let quota = await permissionedExchange.tradeQuota(sqToken.address, runner.address);
            expect(balance.sub(balance_before)).to.eq(quota);
            await rewardsDistributor.connect(runner).claim(runner.address);
            balance = await sqToken.balanceOf(runner.address);
            quota = await permissionedExchange.tradeQuota(sqToken.address, runner.address);
            expect(balance.sub(balance_before)).to.eq(quota);
        });
    });

    describe('order operations', () => {
        it('only send order should work', async () => {
            expect(await permissionedExchange.nextOrderId()).to.be.eq(1);
            const expiredTime = await futureTimestamp(mockProvider, 60 * 60 * 24);
            await expect(permissionedExchange.sendOrder(
                usdAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                expiredTime,
                0,
                etherParse('10')
            ))
                .to.be.emit(permissionedExchange, 'ExchangeOrderSent')
                .withArgs(1, wallet_0.address, usdAddress, sqtAddress, etherParse('1'), etherParse('5'), expiredTime);
            expect(await permissionedExchange.nextOrderId()).to.be.eq(2);
            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(wallet_0.address);
            expect(await (await permissionedExchange.orders(1)).amountGet).to.be.eq(etherParse('5'));
            expect(await (await permissionedExchange.orders(1)).amountGive).to.be.eq(etherParse('1'));
            expect(await (await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('10'));
            expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('10'));
        });

        it('add liquidity to order should work', async () => {
            expect(await permissionedExchange.nextOrderId()).to.be.eq(1);
            const expiredTime = await futureTimestamp(mockProvider, 60 * 60 * 24);
            await expect(permissionedExchange.sendOrder(
                usdAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                expiredTime,
                0,
                etherParse('10')
            ))
                .to.be.emit(permissionedExchange, 'ExchangeOrderSent')
                .withArgs(1, wallet_0.address, usdAddress, sqtAddress, etherParse('1'), etherParse('5'), expiredTime);

            await expect(permissionedExchange.addLiquidity(1, etherParse('1')))
                .to.be.emit(permissionedExchange, 'ExchangeOrderChanged')
                .withArgs(1, etherParse('11'));

            expect((await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('11'));
        });

        it('send order with invalid parameters should fail', async () => {
            await expect(
                permissionedExchange.sendOrder(
                    usdAddress,
                    sqtAddress,
                    etherParse('1'),
                    etherParse('5'),
                    0,
                    0,
                    etherParse('10')
                )
            ).to.be.revertedWith('PE002');
            await expect(
                permissionedExchange.sendOrder(
                    usdAddress,
                    sqtAddress,
                    0,
                    etherParse('5'),
                    await futureTimestamp(mockProvider, 60 * 60 * 24),
                    0,
                    etherParse('10')
                )
            ).to.be.revertedWith('PE003');
            await expect(
                permissionedExchange.sendOrder(
                    usdAddress,
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
            await permissionedExchange.sendOrder(
                usdAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                etherParse('10')
            );
            await expect(permissionedExchange.connect(wallet_1).cancelOrder(1)).to.be.revertedWith(
                'PE011'
            );
            await permissionedExchange.cancelOrder(1);
            expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(ZERO_ADDRESS);
            await expect(permissionedExchange.connect(wallet_1).cancelOrder(1)).to.be.revertedWith('PE009');
        });
        it('anyone settle the expired order should work', async () => {
            await permissionedExchange.sendOrder(
                usdAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                etherParse('10')
            );
            await expect(permissionedExchange.connect(wallet_2).settleExpiredOrder(1)).to.be.revertedWith(
                'PE010'
            );
            await timeTravel(mockProvider, 2 * 60 * 60 * 24);
            await permissionedExchange.connect(wallet_2).settleExpiredOrder(1);
            expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(ZERO_ADDRESS);
            await expect(permissionedExchange.connect(wallet_2).settleExpiredOrder(0)).to.be.revertedWith(
                'PE009'
            );
        });
    });

    describe('trade test', () => {
        const order1Balance = BigNumber.from('10000000'); // 1000 usd
        const order2Balance = etherParse('50000'); // 50000 sqt
        const order3Balance = BigNumber.from('1000000'); // 1 usd
        beforeEach(async () => {
            await permissionedExchange.setController(wallet_1.address, true);
            await permissionedExchange.connect(wallet_1).addQuota(sqtAddress, wallet_2.address, etherParse('100'));
            //order 1: 1 usd -> 50 sqt, 1e6 usd -> 5e19 sqt
            await permissionedExchange.sendOrder(
                usdAddress,
                sqtAddress,
                BigNumber.from('1000000'),
                etherParse('50'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                order1Balance // 1000 usd
            );
            //order 2: 50 sqt -> 1 usd, 5e19 sqt -> 1e6 usd
            await permissionedExchange.sendOrder(
                sqtAddress,
                usdAddress,
                etherParse('50'),
                BigNumber.from('1000000'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                order2Balance
            );
            //order 3: 1 usd -> 50 sqt, 1e6 usd -> 5e19 sqt
            await permissionedExchange.sendOrder(
                usdAddress,
                sqtAddress,
                BigNumber.from('1000000'),
                etherParse('50'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                order3Balance // 1000 usd
            );
        });
        it('trade on exist order should work', async () => {
            // sell 100 sqt, get usd: 2
            const usdBefore = await usdToken.balanceOf(wallet_2.address);
            const exUsdBefore = await usdToken.balanceOf(permissionedExchange.address);
            const exSqtBefore = await sqToken.balanceOf(permissionedExchange.address);
            const sqtBefore = await sqToken.balanceOf(wallet_2.address);
            const sellerSqtBefore = await sqToken.balanceOf(wallet_0.address);
            await permissionedExchange.connect(wallet_2).trade(1, etherParse('100'));
            expect(await sqToken.balanceOf(wallet_2.address)).to.be.eq(sqtBefore.sub(etherParse('100')));
            expect(await usdToken.balanceOf(wallet_2.address)).to.be.eq(usdBefore.add(BigNumber.from(2e6)));
            expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(exUsdBefore.sub(BigNumber.from(2e6)));
            expect(await sqToken.balanceOf(permissionedExchange.address)).to.be.eq(exSqtBefore);
            expect(await sqToken.balanceOf(wallet_0.address)).to.be.eq(sellerSqtBefore.add(etherParse('100')));
            expect((await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(order1Balance.sub(BigNumber.from(2e6)));
        });
        it('trade over quota should fail', async () => {
            let quota = await permissionedExchange.tradeQuota(sqToken.address, wallet_2.address);
            await permissionedExchange.connect(wallet_2).trade(1, quota);
            quota = await permissionedExchange.tradeQuota(sqToken.address, wallet_2.address);
            expect(quota).to.eq(BigNumber.from(0));
            await expect(permissionedExchange.connect(wallet_2).trade(1, 1)).to.be.revertedWith(
                'PE005'
            );
        });
        it('trade over order balance should fail', async () => {
            await permissionedExchange.connect(wallet_2).trade(3, etherParse('50')); // 1usd => 50 sqt
            const orderBalance = (await permissionedExchange.orders(3)).tokenGiveBalance;
            expect(orderBalance).to.eq(0);
            // trade minimum 1wei usd
            await expect(permissionedExchange.connect(wallet_2).trade(3, BigNumber.from(5e13))).to.be.revertedWith(
                'PE008'
            );
        });
        it('trade stable coin over per account limit should fail', async () => {
            const perAccountLimit = await permissionedExchange.tradeLimitationPerAccount();
            const accumulatedTrade = await permissionedExchange.accumulatedTrades(wallet_2.address);
            const tradable = perAccountLimit.sub(accumulatedTrade);
            await expect(permissionedExchange.connect(wallet_2).trade(2, tradable.add(1))).to.be.revertedWith(
                'PE013'
            );
            await expect(permissionedExchange.connect(wallet_2).trade(2, tradable)).not.to.reverted;
            await expect(permissionedExchange.connect(wallet_2).trade(2, 1)).to.be.revertedWith(
                'PE013'
            );
        });
        it('trade stable coin over limit in a single transaction should fail', async () => {
            await permissionedExchange.setTradeLimitation(etherParse('1'));
            await expect(permissionedExchange.connect(wallet_2).trade(2, etherParse('1').add(1))).to.be.revertedWith(
                'PE012'
            );
        });
        it('trade on invalid order should fail', async () => {
            await expect(permissionedExchange.connect(wallet_2).trade(10, etherParse('2'))).to.be.revertedWith(
                'PE006'
            );
            await timeTravel(mockProvider, 2 * 60 * 60 * 24);
            await expect(permissionedExchange.connect(wallet_2).trade(1, etherParse('2'))).to.be.revertedWith(
                'PE006'
            );
        });
    });

    describe('pair orders test', () => {
        it('create pair order should work', async () => {
            await permissionedExchange.createPairOrders(
                usdAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                etherParse('10')
            );
            expect(await permissionedExchange.nextOrderId()).to.be.eq(3);
            expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('10'));

            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(wallet_0.address);
            expect(await (await permissionedExchange.orders(1)).amountGet).to.be.eq(etherParse('5'));
            expect(await (await permissionedExchange.orders(1)).amountGive).to.be.eq(etherParse('1'));
            expect(await (await permissionedExchange.orders(1)).tokenGet).to.be.eq(sqtAddress);
            expect(await (await permissionedExchange.orders(1)).tokenGive).to.be.eq(usdAddress);
            expect(await (await permissionedExchange.orders(1)).pairOrderId).to.be.eq(2);
            expect(await (await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('10'));

            expect(await (await permissionedExchange.orders(2)).sender).to.be.eq(wallet_0.address);
            expect(await (await permissionedExchange.orders(2)).amountGive).to.be.eq(etherParse('5'));
            expect(await (await permissionedExchange.orders(2)).amountGet).to.be.eq(etherParse('1'));
            expect(await (await permissionedExchange.orders(2)).tokenGive).to.be.eq(sqtAddress);
            expect(await (await permissionedExchange.orders(2)).tokenGet).to.be.eq(usdAddress);
            expect(await (await permissionedExchange.orders(2)).pairOrderId).to.be.eq(1);
            expect(await (await permissionedExchange.orders(2)).tokenGiveBalance).to.be.eq(0);
        });

        it('trade on pair order should work', async () => {
            await permissionedExchange.setController(wallet_1.address, true);
            await permissionedExchange.connect(wallet_1).addQuota(sqtAddress, wallet_2.address, etherParse('5000'));
            // order1: 1 usd -> 50 sqt
            // order2: 1e6 usd -> 5e19 sqt
            await permissionedExchange.createPairOrders(
                usdAddress,
                sqtAddress,
                BigNumber.from(1e6),
                etherParse('50'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                BigNumber.from(1e8) // 100usd
            );
            const usdBefore = await usdToken.balanceOf(wallet_2.address);
            let exUsdBefore = await usdToken.balanceOf(permissionedExchange.address);
            let exSqtBefore = await sqToken.balanceOf(permissionedExchange.address);
            const sellerSqtBefore = await sqToken.balanceOf(wallet_0.address);
            let order1BalanceBefore = (await permissionedExchange.orders(1)).tokenGiveBalance;
            let order2BalanceBefore = (await permissionedExchange.orders(2)).tokenGiveBalance;
            const sqtBefore = await sqToken.balanceOf(wallet_2.address);
            // buy 50 sqt
            expect(exSqtBefore).to.eq(0);
            expect(order2BalanceBefore).to.eq(0);
            await expect(permissionedExchange.connect(wallet_2).trade(2, 1)).to.be.revertedWith(
                'PE008'
            );
            // sell 50 sqt, get 1 usd
            await permissionedExchange.connect(wallet_2).trade(1, etherParse('50'));
            expect(await usdToken.balanceOf(wallet_2.address)).to.be.eq(usdBefore.add(1e6));
            expect(await sqToken.balanceOf(wallet_2.address)).to.be.eq(sqtBefore.sub(etherParse('50')));
            expect(await sqToken.balanceOf(permissionedExchange.address)).to.be.eq(exSqtBefore.add(etherParse('50')));
            expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(exUsdBefore.sub(1e6));
            expect(await sqToken.balanceOf(wallet_0.address)).to.be.eq(sellerSqtBefore);

            expect((await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(order1BalanceBefore.sub(1e6));
            expect((await permissionedExchange.orders(2)).tokenGiveBalance).to.be.eq(order2BalanceBefore.add(etherParse('50')));

            // buy 50 sqt, give 1 usd
            const usdBeforeW1 = await usdToken.balanceOf(wallet_1.address);
            const sqtBeforeW1 = await sqToken.balanceOf(wallet_1.address);
            exUsdBefore = await usdToken.balanceOf(permissionedExchange.address);
            exSqtBefore = await sqToken.balanceOf(permissionedExchange.address);
            order1BalanceBefore = (await permissionedExchange.orders(1)).tokenGiveBalance;
            order2BalanceBefore = (await permissionedExchange.orders(2)).tokenGiveBalance;
            await permissionedExchange.connect(wallet_1).trade(2, 1e6);
            expect(await usdToken.balanceOf(wallet_1.address)).to.be.eq(usdBeforeW1.sub(1e6));
            expect(await sqToken.balanceOf(wallet_1.address)).to.be.eq(sqtBeforeW1.add(etherParse('50')));
            expect(await sqToken.balanceOf(permissionedExchange.address)).to.be.eq(exSqtBefore.sub(etherParse('50')));
            expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(exUsdBefore.add(1e6));

            expect((await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(order1BalanceBefore.add(1e6));
            expect((await permissionedExchange.orders(2)).tokenGiveBalance).to.be.eq(order2BalanceBefore.sub(etherParse('50')));

        });

        it('cancel pair order should work', async () => {
            await permissionedExchange.createPairOrders(
                usdAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                etherParse('10')
            );

            expect(await (await permissionedExchange.orders(1)).pairOrderId).to.be.eq(2);
            expect(await (await permissionedExchange.orders(2)).pairOrderId).to.be.eq(1);

            await permissionedExchange.cancelOrder(1);
            expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(ZERO_ADDRESS);

            expect(await (await permissionedExchange.orders(2)).sender).to.be.eq(wallet_0.address);
            expect(await (await permissionedExchange.orders(2)).pairOrderId).to.be.eq(0);
        });
    });
});
