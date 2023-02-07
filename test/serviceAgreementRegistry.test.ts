// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {deploymentIds, DEPLOYMENT_ID, METADATA_HASH, VERSION, mmrRoot} from './constants';
import {createPurchaseOffer, futureTimestamp, time, timeTravel, etherParse, eventFrom} from './helper';
import {
    SQToken,
    Staking,
    IndexerRegistry,
    QueryRegistry,
    PlanManager,
    PurchaseOfferMarket,
    ServiceAgreementRegistry,
    EraManager,
    RewardsDistributer,
    RewardsStaking,
    RewardsHelper,
} from '../src';
import {utils} from 'ethers';
const {constants} = require('@openzeppelin/test-helpers');

describe('Service Agreement Registry Contract', () => {
    const mockProvider = waffle.provider;
    let wallet, wallet1, wallet2;
    let token: SQToken;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let queryRegistry: QueryRegistry;
    let planManager: PlanManager;
    let purchaseOfferMarket: PurchaseOfferMarket;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributer;
    let rewardsStaking: RewardsStaking;
    let rewardsHelper: RewardsHelper;

    const checkStateChange = async (agreementInfo, stateInfo, _isClear) => {
        const newValue = await serviceAgreementRegistry.sumDailyReward(agreementInfo.indexer);
        if (_isClear) {
            //remove
            expect(newValue).to.equal(
                stateInfo.sumDailyReward.sub(
                    BigNumber.from(agreementInfo.value).div(agreementInfo.period / 60 / 60 / 24)
                )
            );
            expect(
                await serviceAgreementRegistry.closedServiceAgreementIds(wallet.address, agreementInfo.index)
            ).to.not.equal(agreementInfo.agreementId);
        } else {
            expect(newValue).to.equal(
                stateInfo.sumDailyReward.add(
                    BigNumber.from(agreementInfo.value).div(agreementInfo.period / 60 / 60 / 24)
                )
            );
            expect(
                await serviceAgreementRegistry.closedServiceAgreementIds(wallet.address, agreementInfo.index)
            ).to.equal(agreementInfo.agreementId);
        }
    };

    const allowanceMultiplerBP = 1e6;

    beforeEach(async () => {
        [wallet, wallet1, wallet2] = await ethers.getSigners();
        const deployment = await deployContracts(wallet, wallet1);
        token = deployment.token;
        staking = deployment.staking;
        indexerRegistry = deployment.indexerRegistry;
        queryRegistry = deployment.queryRegistry;
        planManager = deployment.planManager;
        purchaseOfferMarket = deployment.purchaseOfferMarket;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;
        eraManager = deployment.eraManager;
        rewardsDistributor = deployment.rewardsDistributer;
        rewardsStaking = deployment.rewardsStaking;
        rewardsHelper = deployment.rewardsHelper;

        await queryRegistry.setCreatorRestricted(false);

        // period 1000 s
        // planTemplateId: 0
        await planManager.createPlanTemplate(1000, 1000, 100, METADATA_HASH);

        await serviceAgreementRegistry.setThreshold(allowanceMultiplerBP);
        await token.transfer(wallet.address, etherParse('1000'));
    });

    describe('Establisher Management', () => {
        it('add and remove establisher should work', async () => {
            // check default config
            expect(await serviceAgreementRegistry.establisherWhitelist(purchaseOfferMarket.address)).be.equal(true);
            // add new establisher
            const establisher = planManager.address;
            await serviceAgreementRegistry.addEstablisher(establisher);
            expect(await serviceAgreementRegistry.establisherWhitelist(establisher)).to.be.equal(true);
            // remove establisher
            await serviceAgreementRegistry.removeEstablisher(establisher);
            expect(await serviceAgreementRegistry.establisherWhitelist(establisher)).to.be.equal(false);
        });

        it('add establisher without owner should fail', async () => {
            await expect(
                serviceAgreementRegistry.connect(wallet1).addEstablisher(planManager.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });

    describe('Set Allowance Multipler', () => {
        it('set allowance multipler should fail without owner', async () => {
            await expect(
                serviceAgreementRegistry.connect(wallet1).setThreshold(allowanceMultiplerBP)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
        it('should set allowance multipler with owner', async () => {
            // SetAllowanceMultipler
            await serviceAgreementRegistry.setThreshold(allowanceMultiplerBP);
            expect(await serviceAgreementRegistry.threshold()).to.be.equal(allowanceMultiplerBP);
        });
    });

    describe('Establish Service Agressment', () => {
        beforeEach(async () => {
            // register indexer
            await token.increaseAllowance(staking.address, etherParse('1000'));
            await token.increaseAllowance(purchaseOfferMarket.address, etherParse('1000'));
            await indexerRegistry.registerIndexer(etherParse('1000'), METADATA_HASH, 0);
            await indexerRegistry.setControllerAccount(wallet2.address);

            // create 3 query projects
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, deploymentIds[0]);
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, deploymentIds[1]);
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, deploymentIds[2]);

            await queryRegistry.startIndexing(deploymentIds[0]);
            await queryRegistry.updateIndexingStatusToReady(deploymentIds[0]);
            await queryRegistry.startIndexing(deploymentIds[1]);

            // create a purchase offer
            await createPurchaseOffer(
                purchaseOfferMarket,
                token,
                deploymentIds[0],
                await futureTimestamp(mockProvider)
            );
            await createPurchaseOffer(
                purchaseOfferMarket,
                token,
                deploymentIds[1],
                await futureTimestamp(mockProvider)
            );
            await createPurchaseOffer(
                purchaseOfferMarket,
                token,
                deploymentIds[2],
                await futureTimestamp(mockProvider)
            );
        });

        it('should estabish service agressment successfully', async () => {
            await purchaseOfferMarket.acceptPurchaseOffer(0, mmrRoot);
            const serviceAgreement = await serviceAgreementRegistry.closedServiceAgreementIds(wallet.address, 0);
            expect(serviceAgreement).to.be.not.equal(0);
            expect(
                await serviceAgreementRegistry.hasOngoingClosedServiceAgreement(wallet.address, deploymentIds[0])
            ).to.be.equal(true);
        });

        it('estabish service agressment with wrong param should revert', async () => {
            await purchaseOfferMarket.acceptPurchaseOffer(0, mmrRoot);
            await token.increaseAllowance(purchaseOfferMarket.address, etherParse('4000'));
            await purchaseOfferMarket.createPurchaseOffer(
                deploymentIds[0],
                0,
                etherParse('1000'),
                2,
                100,
                (await futureTimestamp(mockProvider)) + 86400
            );

            await expect(purchaseOfferMarket.connect(wallet).acceptPurchaseOffer(3, mmrRoot)).to.be.revertedWith(
                'SA006'
            );

            await purchaseOfferMarket.createPurchaseOffer(
                deploymentIds[2],
                0,
                etherParse('1'),
                2,
                100,
                (await futureTimestamp(mockProvider)) + 86400
            );
            await expect(purchaseOfferMarket.connect(wallet).acceptPurchaseOffer(4, mmrRoot)).to.be.revertedWith(
                'SA005'
            );

            await expect(
                serviceAgreementRegistry.connect(wallet1).establishServiceAgreement(serviceAgreementRegistry.address)
            ).to.be.revertedWith('SA004');

            await serviceAgreementRegistry.addEstablisher(wallet1.address);

            await expect(
                serviceAgreementRegistry.connect(wallet1).establishServiceAgreement(serviceAgreementRegistry.address)
            ).to.be.revertedWith('SA001');
        });
    });

    describe('Clear Ended Agreements', () => {
        beforeEach(async () => {
            // register indexer
            await token.increaseAllowance(staking.address, etherParse('1000'));
            await token.increaseAllowance(purchaseOfferMarket.address, etherParse('1000'));
            await indexerRegistry.registerIndexer(etherParse('1000'), METADATA_HASH, 0);
            await indexerRegistry.setControllerAccount(wallet2.address);

            // create query project and purchase offer
            await queryRegistry.createQueryProject(METADATA_HASH, VERSION, DEPLOYMENT_ID);
            await queryRegistry.startIndexing(DEPLOYMENT_ID);
            await queryRegistry.updateIndexingStatusToReady(DEPLOYMENT_ID);
        });

        it('should clear service agressment successfully', async () => {
            await createPurchaseOffer(purchaseOfferMarket, token, DEPLOYMENT_ID, await futureTimestamp(mockProvider));
            expect(
                await serviceAgreementRegistry.hasOngoingClosedServiceAgreement(wallet.address, DEPLOYMENT_ID)
            ).to.be.equal(false);

            await purchaseOfferMarket.acceptPurchaseOffer(0, mmrRoot);
            const serviceAgreement = await serviceAgreementRegistry.closedServiceAgreementIds(wallet.address, 0);
            expect(serviceAgreement).to.be.not.equal(0);
            expect(
                await serviceAgreementRegistry.hasOngoingClosedServiceAgreement(wallet.address, DEPLOYMENT_ID)
            ).to.be.equal(true);

            await timeTravel(mockProvider, 2000);
            await serviceAgreementRegistry.clearEndedAgreement(wallet.address, 0);
            expect(
                await serviceAgreementRegistry.hasOngoingClosedServiceAgreement(wallet.address, DEPLOYMENT_ID)
            ).to.be.equal(false);
        });

        it('clear all expired agreements for an indexer', async () => {
            const agreements = {};
            for (let i = 0; i < 6; i++) {
                const stateInfo = {
                    sumDailyReward: await serviceAgreementRegistry.sumDailyReward(wallet.address),
                };
                //random period 1 <= x <= 10 days
                const period = (Math.floor(Math.random() * 10) + 1) * 60 * 60 * 24;
                await planManager.createPlanTemplate(period, 1000, 100, METADATA_HASH);
                await purchaseOfferMarket.createPurchaseOffer(
                    DEPLOYMENT_ID,
                    i + 1,
                    etherParse('2'),
                    2,
                    100,
                    await futureTimestamp(mockProvider)
                );

                await purchaseOfferMarket.acceptPurchaseOffer(i, mmrRoot);
                const agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet.address, i);
                const agreementInfo = {
                    value: etherParse('2'),
                    period: period,
                    indexer: wallet.address,
                    agreementId: agreementId,
                    index: i,
                };
                Object.assign(agreements, {[agreementId.toNumber()]: agreementInfo});
                await checkStateChange(agreementInfo, stateInfo, false);
            }

            expect(await serviceAgreementRegistry.indexerCsaLength(wallet.address)).to.equal(6);
            //time pass 9 days
            await timeTravel(mockProvider, 60 * 60 * 24 * 9);

            // get all the expired agreements
            const expiredAgreements = {};
            for (let i = 0; i < 6; i++) {
                const agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet.address, i);
                const agreementExpired = await serviceAgreementRegistry.closedServiceAgreementExpired(agreementId);
                if (agreementExpired) {
                    Object.assign(expiredAgreements, {[agreementId.toNumber()]: agreementId});
                }
            }

            const expiredAgreementCount = Object.keys(expiredAgreements).length;

            // clear all expired agreements
            const removeExpiredAgreements = async () => {
                if (Object.keys(expiredAgreements).length === 0) return;

                const agreementCount = await serviceAgreementRegistry.indexerCsaLength(wallet.address);
                for (let i = 0; i < agreementCount.toNumber(); i++) {
                    const agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet.address, i);
                    if (expiredAgreements[agreementId.toNumber()]) {
                        const sumDailyReward = await serviceAgreementRegistry.sumDailyReward(wallet.address);
                        const stateInfo = {
                            sumDailyReward: await serviceAgreementRegistry.sumDailyReward(wallet.address),
                        };
                        await serviceAgreementRegistry.clearEndedAgreement(wallet.address, i);
                        const agreementInfo = {
                            value: agreements[agreementId.toNumber()].value,
                            period: agreements[agreementId.toNumber()].period,
                            indexer: wallet.address,
                            agreementId: agreementId.toNumber(),
                            index: i,
                        };
                        await checkStateChange(agreementInfo, stateInfo, true);
                        delete expiredAgreements[agreementId.toNumber()];
                        break;
                    }
                }

                await removeExpiredAgreements();
            };

            await removeExpiredAgreements();

            expect(await serviceAgreementRegistry.indexerCsaLength(wallet.address)).to.equal(6 - expiredAgreementCount);
        });

        it('clearAllEndedAgreements for an indexer should work', async () => {
            const agreements = {};
            for (let i = 0; i < 6; i++) {
                //random period 1 <= x <= 10 days
                const period = (Math.floor(Math.random() * 10) + 1) * 60 * 60 * 24;
                await createPurchaseOffer(
                    purchaseOfferMarket,
                    token,
                    DEPLOYMENT_ID,
                    await futureTimestamp(mockProvider)
                );
                await purchaseOfferMarket.acceptPurchaseOffer(i, mmrRoot);
            }

            expect(await serviceAgreementRegistry.indexerCsaLength(wallet.address)).to.equal(6);
            //time pass 5 days
            await timeTravel(mockProvider, 60 * 60 * 24 * 5);

            // get all the expired agreements
            const expiredAgreementIds = [];
            for (let i = 0; i < 6; i++) {
                const agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet.address, i);
                const agreementExpired = await serviceAgreementRegistry.closedServiceAgreementExpired(agreementId);
                if (agreementExpired) {
                    expiredAgreementIds.push(i);
                }
            }

            await serviceAgreementRegistry.clearAllEndedAgreements(wallet.address);

            expect(await serviceAgreementRegistry.indexerCsaLength(wallet.address)).to.equal(
                6 - expiredAgreementIds.length
            );
        });
    });

    describe('renewAgreement', () => {
        beforeEach(async () => {
            // register indexer
            await token.connect(wallet).transfer(wallet1.address, etherParse('1000'));
            await token.connect(wallet).transfer(wallet2.address, 10000000);
            await token.connect(wallet1).increaseAllowance(staking.address, etherParse('1000'));
            await token.connect(wallet2).increaseAllowance(purchaseOfferMarket.address, 10000000);
            await token.connect(wallet2).increaseAllowance(planManager.address, 10000000);
            await token.connect(wallet2).increaseAllowance(serviceAgreementRegistry.address, 10000000);
            await indexerRegistry
                .connect(wallet1)
                .registerIndexer(etherParse('1000'), METADATA_HASH, 100, {gasLimit: '2000000'});

            // create query project
            await queryRegistry.connect(wallet1).createQueryProject(METADATA_HASH, VERSION, deploymentIds[0]);
            await queryRegistry.connect(wallet1).startIndexing(deploymentIds[0]);
            await queryRegistry.connect(wallet1).updateIndexingStatusToReady(deploymentIds[0]);

            // period 10 days
            // planTemplateId: 1
            await planManager.createPlanTemplate(time.duration.days(10).toString(), 1000, 100, METADATA_HASH);

            // create purchase offer
            // value 100*2
            // period 10 days
            // use planTemplateId: 1
            await purchaseOfferMarket
                .connect(wallet2)
                .createPurchaseOffer(deploymentIds[0], 1, 100, 2, 100, await futureTimestamp(mockProvider));
            // create plan
            // value 100
            // period 10 days
            // use planTemplateId: 1
            // use planId: 1
            await planManager.connect(wallet1).createPlan(100, 1, deploymentIds[0]);
        });

        it('renew agreement generated from purchaseOfferMarket should fail', async () => {
            await purchaseOfferMarket.connect(wallet1).acceptPurchaseOffer(0, mmrRoot);
            const agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet1.address, 0);
            await timeTravel(mockProvider, time.duration.days(3).toNumber());
            await expect(serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId)).to.be.revertedWith(
                'PM009'
            );
        });

        it('renew agreement generated from planManager should work', async () => {
            await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const addTable = await rewardsHelper.getRewardsAddTable(wallet1.address, 2, 10);
            const removeTable = await rewardsHelper.getRewardsRemoveTable(wallet1.address, 2, 12);

            let agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet1.address, 0);
            expect(
                await serviceAgreementRegistry.indexerDeploymentCsaLength(wallet1.address, deploymentIds[0])
            ).to.be.eq(1);
            let agreement = await serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
            const oldEndDate = (await agreement.startDate).toNumber() + (await agreement.period).toNumber();
            await timeTravel(mockProvider, time.duration.days(3).toNumber());
            await serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId);
            agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet1.address, 1);
            agreement = await serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
            const period = await agreement.period;
            expect(await agreement.lockedAmount).to.be.eq(100);
            expect(await agreement.startDate).to.be.eq(oldEndDate);
            expect((await agreement.startDate).toNumber() + (await agreement.period).toNumber()).to.be.eq(
                Number(oldEndDate) + Number(period)
            );
            expect(
                await serviceAgreementRegistry.indexerDeploymentCsaLength(wallet1.address, deploymentIds[0])
            ).to.be.eq(2);

            const agreementStartEra = await eraManager.timestampToEraNumber(oldEndDate);
            expect(await rewardsHelper.getRewardsAddTable(wallet1.address, 2, 10)).to.eql(addTable);
            expect(await rewardsHelper.getRewardsRemoveTable(wallet1.address, 2, 12)).to.eql(removeTable);
            expect(await rewardsHelper.getRewardsAddTable(wallet1.address, agreementStartEra, 10)).to.eql(addTable);
        });

        it('Indexers should be able to trun off renew', async () => {
            await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet1.address, 0);
            await timeTravel(mockProvider, time.duration.days(1).toNumber());
            expect((await planManager.getPlan(1)).active).to.be.eq(true);
            await planManager.connect(wallet1).removePlan(1);
            expect((await planManager.getPlan(1)).active).to.be.eq(false);
            await timeTravel(mockProvider, time.duration.days(1).toNumber());
            await expect(serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId)).to.be.revertedWith(
                'PM009'
            );
        });

        it('customer cannot renew expired agreement', async () => {
            await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet1.address, 0);
            await timeTravel(mockProvider, time.duration.days(20).toNumber());
            await expect(serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId)).to.be.revertedWith(
                'SA009'
            );
        });

        it('only customer can renew agreement', async () => {
            await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet1.address, 0);
            await timeTravel(mockProvider, time.duration.days(1).toNumber());
            await expect(serviceAgreementRegistry.connect(wallet1).renewAgreement(agreementId)).to.be.revertedWith(
                'SA007'
            );
        });

        it('cannot renew upcoming agreement', async () => {
            await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const agreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet1.address, 0);
            await timeTravel(mockProvider, time.duration.days(1).toNumber());
            await serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId);
            const upcomingAgreementId = await serviceAgreementRegistry.closedServiceAgreementIds(wallet1.address, 1);
            await timeTravel(mockProvider, time.duration.days(1).toNumber());
            await expect(
                serviceAgreementRegistry.connect(wallet2).renewAgreement(upcomingAgreementId)
            ).to.be.revertedWith('SA008');
        });
    });

    describe('Consumer config users', () => {
        it('Consumer should be able to add/remove users', async () => {
            const consumer = wallet2;
            const user_1 = '0xD0D81970D25259E5Ca17D42c3f5094B5fd8e7713';
            const user_2 = '0x86c18caEBC3f5A8bad42A35A19ec2e3fA25C295F';
            expect(await serviceAgreementRegistry.consumerAuthAllows(consumer.address, user_1)).to.eql(false);
            await serviceAgreementRegistry.connect(consumer).removeUser(consumer.address, user_1);
            expect(await serviceAgreementRegistry.consumerAuthAllows(consumer.address, user_1)).to.eql(false);
            await serviceAgreementRegistry.connect(consumer).addUser(consumer.address, user_1);
            expect(await serviceAgreementRegistry.consumerAuthAllows(consumer.address, user_1)).to.eql(true);
            expect(await serviceAgreementRegistry.consumerAuthAllows(consumer.address, user_2)).to.eql(false);
            let tx = await serviceAgreementRegistry.connect(consumer).addUser(consumer.address, user_2);
            let event = await eventFrom(tx, serviceAgreementRegistry, 'UserAdded(address,address)');
            expect(event.user).to.eql(user_2);
            tx = await serviceAgreementRegistry.connect(consumer).removeUser(consumer.address, user_1);
            event = await eventFrom(tx, serviceAgreementRegistry, 'UserRemoved(address,address)');
            expect(event.user).to.eql(user_1);
            expect(await serviceAgreementRegistry.consumerAuthAllows(consumer.address, user_1)).to.eql(false);
            expect(await serviceAgreementRegistry.consumerAuthAllows(consumer.address, user_2)).to.eql(true);
        });
        it('Only consumer can add/remove users', async () => {
            const consumer = wallet2;
            const user_1 = '0xD0D81970D25259E5Ca17D42c3f5094B5fd8e7713';
            await expect(serviceAgreementRegistry.addUser(consumer.address, user_1)).to.be.revertedWith(
                'SA002'
            );
            await expect(serviceAgreementRegistry.removeUser(consumer.address, user_1)).to.be.revertedWith(
                'SA003'
            );
        });
    });
});
