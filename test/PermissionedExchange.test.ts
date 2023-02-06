// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {
    PermissionedExchange,
    Settings,
    SQToken,
    SQToken__factory,
    Staking,
    QueryRegistry,
    IndexerRegistry,
    PlanManager,
    EraManager,
    RewardsDistributer,
    ServiceAgreementRegistry,
} from '../src';
import {ZERO_ADDRESS} from './constants';
import {etherParse, futureTimestamp, timeTravel, registerIndexer, constants, time, startNewEra} from './helper';
import {METADATA_HASH, DEPLOYMENT_ID, deploymentIds, metadatas, VERSION} from './constants';

describe('PermissionedExchange Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2, indexer, consumer;
    let permissionedExchange: PermissionedExchange;
    let settings: Settings;
    let sqtAddress;
    let asqtAddress;
    let asqToken: SQToken;
    let sqToken: SQToken;
    let staking: Staking;
    let queryRegistry: QueryRegistry;
    let indexerRegistry: IndexerRegistry;
    let planManager: PlanManager;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributer;
    let serviceAgreementRegistry: ServiceAgreementRegistry;

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2, indexer, consumer] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_0);
        permissionedExchange = deployment.permissionedExchange;
        sqToken = deployment.token;
        settings = deployment.settings;
        sqtAddress = await settings.getSQToken();
        staking = deployment.staking;
        queryRegistry = deployment.queryRegistry;
        indexerRegistry = deployment.indexerRegistry;
        planManager = deployment.planManager;
        eraManager = deployment.eraManager;
        rewardsDistributor = deployment.rewardsDistributer;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;

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

    describe('quota update', () => {
        beforeEach(async () => {
            await sqToken.transfer(indexer.address, etherParse('2000'));
            await registerIndexer(sqToken, indexerRegistry, staking, indexer, indexer, '2000');
            await sqToken.transfer(consumer.address, etherParse('10'));
            await sqToken.connect(consumer).increaseAllowance(planManager.address, etherParse('10'));
            // create query project
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, DEPLOYMENT_ID);
            // wallet_0 start project
            await queryRegistry.connect(indexer).startIndexing(DEPLOYMENT_ID);
            await queryRegistry.connect(indexer).updateIndexingStatusToReady(DEPLOYMENT_ID);
            // create plan template
            await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, METADATA_HASH);
            // default plan -> planId: 1
            await planManager.connect(indexer).createPlan(etherParse('10'), 0, DEPLOYMENT_ID);
            await sqToken.connect(consumer).increaseAllowance(serviceAgreementRegistry.address, etherParse('50'));
            await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);
        });

        it('claimed reward should add to quota', async () => {
            const balance_before = await sqToken.balanceOf(indexer.address);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            let balance = await sqToken.balanceOf(indexer.address);
            let quota = await permissionedExchange.tradeQuota(sqToken.address, indexer.address);
            expect(balance.sub(balance_before)).to.eq(quota);
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            balance = await sqToken.balanceOf(indexer.address);
            quota = await permissionedExchange.tradeQuota(sqToken.address, indexer.address);
            expect(balance.sub(balance_before)).to.eq(quota);
        });
    });

    describe('order operations', () => {
        it('only send order should work', async () => {
            expect(await permissionedExchange.nextOrderId()).to.be.eq(1);
            await permissionedExchange.sendOrder(
                asqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                etherParse('10')
            );
            expect(await permissionedExchange.nextOrderId()).to.be.eq(2);
            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(wallet_0.address);
            expect(await (await permissionedExchange.orders(1)).amountGet).to.be.eq(etherParse('5'));
            expect(await (await permissionedExchange.orders(1)).amountGive).to.be.eq(etherParse('1'));
            expect(await (await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('10'));
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('10'));
        });
        it('send order with invalid parameters should fail', async () => {
            await expect(
                permissionedExchange.sendOrder(
                    asqtAddress,
                    sqtAddress,
                    etherParse('1'),
                    etherParse('5'),
                    0,
                    0,
                    etherParse('10')
                )
            ).to.be.revertedWith('invalid expireDate');
            await expect(
                permissionedExchange.sendOrder(
                    asqtAddress,
                    sqtAddress,
                    0,
                    etherParse('5'),
                    await futureTimestamp(mockProvider, 60 * 60 * 24),
                    0,
                    etherParse('10')
                )
            ).to.be.revertedWith('invalid amount');
            await expect(
                permissionedExchange.sendOrder(
                    asqtAddress,
                    sqtAddress,
                    etherParse('1'),
                    0,
                    await futureTimestamp(mockProvider, 60 * 60 * 24),
                    0,
                    etherParse('10')
                )
            ).to.be.revertedWith('invalid amount');
        });
        it('order sender cancel the order should work', async () => {
            await permissionedExchange.sendOrder(
                asqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                etherParse('10')
            );
            await expect(permissionedExchange.connect(wallet_1).cancelOrder(1)).to.be.revertedWith(
                'only order sender allowed'
            );
            await permissionedExchange.cancelOrder(1);
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(ZERO_ADDRESS);
            await expect(permissionedExchange.connect(wallet_1).cancelOrder(1)).to.be.revertedWith('order not exist');
        });
        it('anyone settle the expired order should work', async () => {
            await permissionedExchange.sendOrder(
                asqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                etherParse('10')
            );
            await expect(permissionedExchange.connect(wallet_2).settleExpiredOrder(1)).to.be.revertedWith(
                'order not expired'
            );
            await timeTravel(mockProvider, 2 * 60 * 60 * 24);
            await permissionedExchange.connect(wallet_2).settleExpiredOrder(1);
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(ZERO_ADDRESS);
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
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                etherParse('5')
            );
            //order 2: 10 sqt -> 5 asqt
            await permissionedExchange.sendOrder(
                sqtAddress,
                asqtAddress,
                etherParse('10'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                0,
                etherParse('10')
            );
        });
        it('trade on exist order should work', async () => {
            await permissionedExchange.connect(wallet_2).trade(1, etherParse('2'));
            expect(await asqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('1001'));
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('4'));
            expect(await sqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('998'));
            expect(await (await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('4'));
            await expect(permissionedExchange.connect(wallet_2).trade(1, etherParse('2'))).to.be.revertedWith(
                'tradeQuota reached'
            );
            await expect(permissionedExchange.connect(wallet_2).trade(2, etherParse('100'))).to.be.revertedWith(
                'trade amount exceed order balance'
            );
            await permissionedExchange.connect(wallet_2).trade(2, etherParse('5'));
            expect(await asqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('996'));
            expect(await sqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('1008'));
            expect(await sqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(2)).tokenGiveBalance).to.be.eq(etherParse('0'));
        });
        it('trade on invalid order should fail', async () => {
            await expect(permissionedExchange.connect(wallet_2).trade(10, etherParse('2'))).to.be.revertedWith(
                'order invalid'
            );
            await timeTravel(mockProvider, 2 * 60 * 60 * 24);
            await expect(permissionedExchange.connect(wallet_2).trade(1, etherParse('2'))).to.be.revertedWith(
                'order invalid'
            );
        });
    });

    describe('pair orders test', () => {
        it('create pair order should work', async () => {
            await permissionedExchange.createPairOrders(
                asqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                etherParse('10')
            );
            expect(await permissionedExchange.nextOrderId()).to.be.eq(3);
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('10'));

            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(wallet_0.address);
            expect(await (await permissionedExchange.orders(1)).amountGet).to.be.eq(etherParse('5'));
            expect(await (await permissionedExchange.orders(1)).amountGive).to.be.eq(etherParse('1'));
            expect(await (await permissionedExchange.orders(1)).tokenGet).to.be.eq(sqtAddress);
            expect(await (await permissionedExchange.orders(1)).tokenGive).to.be.eq(asqtAddress);
            expect(await (await permissionedExchange.orders(1)).pairOrderId).to.be.eq(2);
            expect(await (await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('10'));

            expect(await (await permissionedExchange.orders(2)).sender).to.be.eq(wallet_0.address);
            expect(await (await permissionedExchange.orders(2)).amountGive).to.be.eq(etherParse('5'));
            expect(await (await permissionedExchange.orders(2)).amountGet).to.be.eq(etherParse('1'));
            expect(await (await permissionedExchange.orders(2)).tokenGive).to.be.eq(sqtAddress);
            expect(await (await permissionedExchange.orders(2)).tokenGet).to.be.eq(asqtAddress);
            expect(await (await permissionedExchange.orders(2)).pairOrderId).to.be.eq(1);
            expect(await (await permissionedExchange.orders(2)).tokenGiveBalance).to.be.eq(0);
        });

        it('trade on pair order should work', async () => {
            await permissionedExchange.setController(wallet_1.address, true);
            await permissionedExchange.connect(wallet_1).addQuota(sqtAddress, wallet_2.address, etherParse('100'));
            await permissionedExchange.createPairOrders(
                asqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                etherParse('10')
            );

            await permissionedExchange.connect(wallet_2).trade(1, etherParse('5'));
            expect(await asqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('1001'));
            expect(await sqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('995'));
            expect(await sqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('5'));
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('9'));
            expect(await (await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('9'));
            expect(await (await permissionedExchange.orders(2)).tokenGiveBalance).to.be.eq(etherParse('5'));

            await permissionedExchange.connect(wallet_2).trade(2, etherParse('1'));
            expect(await asqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('1000'));
            expect(await sqToken.balanceOf(wallet_2.address)).to.be.eq(etherParse('1000'));
            expect(await sqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('10'));
            expect(await (await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('10'));
            expect(await (await permissionedExchange.orders(2)).tokenGiveBalance).to.be.eq(etherParse('0'));
        });

        it('cancel pair order should work', async () => {
            await permissionedExchange.createPairOrders(
                asqtAddress,
                sqtAddress,
                etherParse('1'),
                etherParse('5'),
                await futureTimestamp(mockProvider, 60 * 60 * 24),
                etherParse('10')
            );

            expect(await (await permissionedExchange.orders(1)).pairOrderId).to.be.eq(2);
            expect(await (await permissionedExchange.orders(2)).pairOrderId).to.be.eq(1);

            await permissionedExchange.cancelOrder(1);
            expect(await asqToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
            expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(ZERO_ADDRESS);

            expect(await (await permissionedExchange.orders(2)).sender).to.be.eq(wallet_0.address);
            expect(await (await permissionedExchange.orders(2)).pairOrderId).to.be.eq(0);
        });
    });
});
