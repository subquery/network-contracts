// // Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// // SPDX-License-Identifier: GPL-3.0-or-later

// import { expect } from 'chai';
// import { BigNumber } from "ethers";
// import { ethers, waffle } from 'hardhat';
// import {
//     EraManager,
//     IndexerRegistry,
//     PermissionedExchange,
//     PlanManager,
//     ProjectRegistry,
//     RewardsDistributer,
//     SQToken,
//     SUSD,
//     SQToken__factory,
//     ServiceAgreementRegistry,
//     Settings,
//     Staking,
// } from '../src';
// import { DEPLOYMENT_ID, METADATA_HASH, VERSION, ZERO_ADDRESS } from './constants';
// import { constants, etherParse, futureTimestamp, registerIndexer, startNewEra, time, timeTravel } from './helper';
// import { deployContracts } from './setup';

// describe('PermissionedExchange Contract', () => {
//     const mockProvider = waffle.provider;
//     let wallet_0, wallet_1, wallet_2, indexer, consumer;
//     let permissionedExchange: PermissionedExchange;
//     let settings: Settings;
//     let ksqtAddress: string;
//     let kSQToken: SQToken;
//     let SQToken: SQToken;
//     let sqtAddress: string;
//     let staking: Staking;
//     let projectRegistry: ProjectRegistry;
//     let indexerRegistry: IndexerRegistry;
//     let planManager: PlanManager;
//     let eraManager: EraManager;
//     let rewardsDistributor: RewardsDistributer;
//     let serviceAgreementRegistry: ServiceAgreementRegistry;

//     beforeEach(async () => {
//         [wallet_0, wallet_1, wallet_2, indexer, consumer] = await ethers.getSigners();
//         const deployment = await deployContracts(wallet_0, wallet_0);
//         permissionedExchange = deployment.permissionedExchange;
//         kSQToken = deployment.token;
//         settings = deployment.settings;
//         ksqtAddress = await settings.getSQToken();
//         staking = deployment.staking;
//         projectRegistry = deployment.projectRegistry;
//         indexerRegistry = deployment.indexerRegistry;
//         planManager = deployment.planManager;
//         eraManager = deployment.eraManager;
//         rewardsDistributor = deployment.rewardsDistributer;
//         serviceAgreementRegistry = deployment.serviceAgreementRegistry;

//         //deploy usd
//         SQToken = await new SQToken__factory(wallet_0).deploy(deployment.inflationController.address, etherParse('10000000000000'));
//         await SQToken.deployTransaction.wait();
//         sqtAddress = SQToken.address;

//         //setup
//         await permissionedExchange.setTradeLimitation(etherParse('10000'));
//         await permissionedExchange.connect(wallet_0).setTradeLimitationPerAccount(1e8); // <> $100 usd(decimal 6)

//         await usdToken.transfer(wallet_1.address, BigNumber.from(1e8));
//         await usdToken.transfer(wallet_2.address, BigNumber.from(1e8));
//         await sqToken.transfer(wallet_1.address, etherParse('1000'));
//         await sqToken.transfer(wallet_2.address, etherParse('1000'));

//         await usdToken.connect(wallet_0).increaseAllowance(permissionedExchange.address, etherParse('1000'));
//         await usdToken.connect(wallet_1).increaseAllowance(permissionedExchange.address, BigNumber.from(1e8));
//         await usdToken.connect(wallet_2).increaseAllowance(permissionedExchange.address, BigNumber.from(1e8));
//         await sqToken.connect(wallet_0).increaseAllowance(permissionedExchange.address, etherParse('50000'));
//         await sqToken.connect(wallet_1).increaseAllowance(permissionedExchange.address, etherParse('1000'));
//         await sqToken.connect(wallet_2).increaseAllowance(permissionedExchange.address, etherParse('1000'));
//     });

//     describe('config contract', () => {
//         it('order id should start from 1', async () => {
//             expect(await permissionedExchange.nextOrderId()).to.equal(1);
//         });

//         it('add Controller should work', async () => {
//             expect(await permissionedExchange.exchangeController(wallet_1.address)).to.equal(false);
//             await permissionedExchange.setController(wallet_1.address, true);
//             expect(await permissionedExchange.exchangeController(wallet_1.address)).to.equal(true);
//             await permissionedExchange.setController(wallet_1.address, false);
//             expect(await permissionedExchange.exchangeController(wallet_1.address)).to.equal(false);
//         });

//         it('set trade limitation should work', async () => {
//             expect(await permissionedExchange.tradeLimitation()).to.equal(etherParse('10000'));
//             await permissionedExchange.setTradeLimitation(etherParse('1000'));
//             expect(await permissionedExchange.tradeLimitation()).to.equal(etherParse('1000'));
//         });

//         it('add Quota should work', async () => {
//             await permissionedExchange.setController(wallet_1.address, true);
//             expect(await permissionedExchange.tradeQuota(sqtAddress, wallet_2.address)).to.equal(0);
//             await expect(permissionedExchange.connect(wallet_1).addQuota(sqtAddress, wallet_2.address, etherParse('5')))
//                 .to.be.emit(permissionedExchange, 'QuotaAdded')
//                 .withArgs(sqtAddress, wallet_2.address, etherParse('5'));
//             expect(await permissionedExchange.tradeQuota(sqtAddress, wallet_2.address)).to.be.eq(etherParse('5'));
//         });

//         it('add Quota without permission should fail', async () => {
//             await expect(
//                 permissionedExchange.connect(wallet_2).addQuota(sqtAddress, wallet_2.address, etherParse('5'))
//             ).to.be.revertedWith('PE001');
//         });
//     });

//     describe('order operations', () => {
//         it('only send order should work', async () => {
//             expect(await permissionedExchange.nextOrderId()).to.be.eq(1);
//             const expiredTime = await futureTimestamp(mockProvider, 60 * 60 * 24);
//             await expect(permissionedExchange.sendOrder(
//                 sqtAddress,
//                 sqtAddress,
//                 etherParse('1'),
//                 etherParse('5'),
//                 expiredTime,
//                 0,
//                 etherParse('10')
//             ))
//                 .to.be.emit(permissionedExchange, 'ExchangeOrderSent')
//                 .withArgs(1, wallet_0.address, sqtAddress, sqtAddress, etherParse('1'), etherParse('5'), expiredTime);
//             expect(await permissionedExchange.nextOrderId()).to.be.eq(2);
//             expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(wallet_0.address);
//             expect(await (await permissionedExchange.orders(1)).amountGet).to.be.eq(etherParse('5'));
//             expect(await (await permissionedExchange.orders(1)).amountGive).to.be.eq(etherParse('1'));
//             expect(await (await permissionedExchange.orders(1)).tokenGiveBalance).to.be.eq(etherParse('10'));
//             expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('10'));
//         });

//         it('send order with invalid parameters should fail', async () => {
//             await expect(
//                 permissionedExchange.sendOrder(
//                     sqtAddress,
//                     sqtAddress,
//                     etherParse('1'),
//                     etherParse('5'),
//                     0,
//                     0,
//                     etherParse('10')
//                 )
//             ).to.be.revertedWith('PE002');
//             await expect(
//                 permissionedExchange.sendOrder(
//                     sqtAddress,
//                     sqtAddress,
//                     0,
//                     etherParse('5'),
//                     await futureTimestamp(mockProvider, 60 * 60 * 24),
//                     0,
//                     etherParse('10')
//                 )
//             ).to.be.revertedWith('PE003');
//             await expect(
//                 permissionedExchange.sendOrder(
//                     sqtAddress,
//                     sqtAddress,
//                     etherParse('1'),
//                     0,
//                     await futureTimestamp(mockProvider, 60 * 60 * 24),
//                     0,
//                     etherParse('10')
//                 )
//             ).to.be.revertedWith('PE003');
//         });
//         it('order sender cancel the order should work', async () => {
//             await permissionedExchange.sendOrder(
//                 sqtAddress,
//                 sqtAddress,
//                 etherParse('1'),
//                 etherParse('5'),
//                 await futureTimestamp(mockProvider, 60 * 60 * 24),
//                 0,
//                 etherParse('10')
//             );
//             await expect(permissionedExchange.connect(wallet_1).cancelOrder(1)).to.be.revertedWith(
//                 'PE011'
//             );
//             await permissionedExchange.cancelOrder(1);
//             expect(await usdToken.balanceOf(permissionedExchange.address)).to.be.eq(etherParse('0'));
//             expect(await (await permissionedExchange.orders(1)).sender).to.be.eq(ZERO_ADDRESS);
//             await expect(permissionedExchange.connect(wallet_1).cancelOrder(1)).to.be.revertedWith('PE009');
//         });
//     });

//     describe('trade test', () => {
//         const order1Balance = BigNumber.from('10000000'); // 1000 usd
//         const order2Balance = etherParse('50000'); // 50000 sqt
//         const order3Balance = BigNumber.from('1000000'); // 1 usd
//         beforeEach(async () => {
//             await permissionedExchange.setController(wallet_1.address, true);
//             await permissionedExchange.connect(wallet_1).addQuota(sqtAddress, wallet_2.address, etherParse('100'));
//             //order 1: 1 usd -> 50 sqt, 1e6 usd -> 5e19 sqt
//             await permissionedExchange.sendOrder(
//                 sqtAddress,
//                 sqtAddress,
//                 BigNumber.from('1000000'),
//                 etherParse('50'),
//                 await futureTimestamp(mockProvider, 60 * 60 * 24),
//                 0,
//                 order1Balance // 1000 usd
//             );
//             //order 2: 50 sqt -> 1 usd, 5e19 sqt -> 1e6 usd
//             await permissionedExchange.sendOrder(
//                 sqtAddress,
//                 sqtAddress,
//                 etherParse('50'),
//                 BigNumber.from('1000000'),
//                 await futureTimestamp(mockProvider, 60 * 60 * 24),
//                 0,
//                 order2Balance
//             );
//             //order 3: 1 usd -> 50 sqt, 1e6 usd -> 5e19 sqt
//             await permissionedExchange.sendOrder(
//                 sqtAddress,
//                 sqtAddress,
//                 BigNumber.from('1000000'),
//                 etherParse('50'),
//                 await futureTimestamp(mockProvider, 60 * 60 * 24),
//                 0,
//                 order3Balance // 1000 usd
//             );
//         });
//         it('trade on exist order should work', async () => {
//         });
//         it('trade over order balance should fail', async () => {
//             await permissionedExchange.connect(wallet_2).trade(3, etherParse('50')); // 1usd => 50 sqt
//             const orderBalance = (await permissionedExchange.orders(3)).tokenGiveBalance;
//             expect(orderBalance).to.eq(0);
//             // trade minimum 1wei usd
//             await expect(permissionedExchange.connect(wallet_2).trade(3, BigNumber.from(5e13))).to.be.revertedWith(
//                 'PE008'
//             );
//         });
//         it('trade on invalid order should fail', async () => {
//             await expect(permissionedExchange.connect(wallet_2).trade(10, etherParse('2'))).to.be.revertedWith(
//                 'PE006'
//             );
//             await timeTravel(mockProvider, 2 * 60 * 60 * 24);
//             await expect(permissionedExchange.connect(wallet_2).trade(1, etherParse('2'))).to.be.revertedWith(
//                 'PE006'
//             );
//         });
//     });
// });
