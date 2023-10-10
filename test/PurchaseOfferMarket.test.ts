// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import {
    IndexerRegistry,
    PlanManager,
    PurchaseOfferMarket,
    ProjectRegistry,
    RewardsDistributer,
    SQToken,
    ServiceAgreementRegistry,
    Staking,
} from '../src';
import { DEPLOYMENT_ID, METADATA_HASH, VERSION, poi } from './constants';
import {createPurchaseOffer, etherParse, eventFrom, futureTimestamp, registerIndexer, time, timeTravel} from './helper';
import { deployContracts } from './setup';
import {BigNumber} from "ethers";

describe('Purchase Offer Market Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2;
    let purchaseOfferMarket: PurchaseOfferMarket;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let indexerRegistry: IndexerRegistry;
    let projectRegistry: ProjectRegistry;
    let staking: Staking;
    let token: SQToken;
    let rewardsDistributor: RewardsDistributer;
    let planManager: PlanManager;

    let futureDate;
    const contractPeriod = 1000;
    const deposit = etherParse('2');
    const limit = 1;
    const minimumAcceptHeight = 100;
    const planTemplateId = 0;
    let offerId: BigNumber;

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
        futureDate = await futureTimestamp(mockProvider);
        const deployment = await deployContracts(wallet_0, wallet_1);
        purchaseOfferMarket = deployment.purchaseOfferMarket;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;
        indexerRegistry = deployment.indexerRegistry;
        projectRegistry = deployment.projectRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributer;
        planManager = deployment.planManager;
        await planManager.createPlanTemplate(contractPeriod, 1000, 100, token.address, METADATA_HASH);
        offerId = await createPurchaseOffer(purchaseOfferMarket, token, DEPLOYMENT_ID, futureDate);
    });

    describe('Purchase Offer Market', () => {
        describe('Create Purchase Offer', () => {
            it('create offer should work', async () => {
                const offer = await purchaseOfferMarket.offers(offerId);
                expect(offer.consumer).to.equal(wallet_0.address);
                expect(offer.expireDate).to.equal(futureDate);
                expect(offer.deploymentId).to.equal(DEPLOYMENT_ID);
                expect(offer.deposit).to.equal(deposit);
                expect(offer.limit).to.equal(limit);
                expect(offer.numAcceptedContracts).to.equal(0);
                expect(offer.minimumAcceptHeight).to.equal(minimumAcceptHeight);
                expect(offer.planTemplateId).to.equal(planTemplateId);
                expect((await planManager.getPlanTemplate(offer.planTemplateId)).period).to.equal(contractPeriod);
                expect(offer.active).to.equal(true);
                expect(await purchaseOfferMarket.numOffers()).to.be.equal(1);
                expect(await token.balanceOf(purchaseOfferMarket.address)).to.equal(deposit.mul(limit));
            });

            it('create offer with invalid params should fail ', async () => {
                // invalid expiration
                await expect(
                    purchaseOfferMarket.createPurchaseOffer(
                        DEPLOYMENT_ID,
                        planTemplateId,
                        deposit,
                        limit,
                        minimumAcceptHeight,
                        0
                    )
                ).to.be.revertedWith('PO002');
                // zero deposit
                await expect(
                    purchaseOfferMarket.createPurchaseOffer(
                        DEPLOYMENT_ID,
                        planTemplateId,
                        0,
                        limit,
                        minimumAcceptHeight,
                        futureDate
                    )
                ).to.be.revertedWith('PO003');
                // zero limit
                await expect(
                    purchaseOfferMarket.createPurchaseOffer(
                        DEPLOYMENT_ID,
                        planTemplateId,
                        deposit,
                        0,
                        minimumAcceptHeight,
                        futureDate
                    )
                ).to.be.revertedWith('PO004');
            });

            it('create offer with inactive planTemplate should fail', async () => {
                await planManager.updatePlanTemplateStatus(0, false);
                await expect(createPurchaseOffer(purchaseOfferMarket, token, DEPLOYMENT_ID, futureDate)).to.revertedWith("PO005");
            });
        });

        describe('Cancel Purchase Offer', () => {
            it('cancel exipred offer should work', async () => {
                await timeTravel(mockProvider, time.duration.days(20).toNumber());
                const consumerBalance = await token.balanceOf(wallet_0.address);
                const offerMarketBalance = await token.balanceOf(purchaseOfferMarket.address);

                expect(await purchaseOfferMarket.cancelPurchaseOffer(offerId))
                    .to.be.emit(purchaseOfferMarket, 'PurchaseOfferCancelled')
                    .withArgs(wallet_0.address, offerId);
                const offer = await purchaseOfferMarket.offers(offerId);
                expect(offer.active).to.equal(false);

                // check balance changed
                const amount = deposit.mul(limit);
                expect(await token.balanceOf(purchaseOfferMarket.address)).to.equal(offerMarketBalance.sub(amount));
                expect(await token.balanceOf(wallet_0.address)).to.equal(consumerBalance.add(amount));
            });

            it('cancel unexipred offer should work', async () => {
                const consumerBalance = await token.balanceOf(wallet_0.address);
                const offerMarketBalance = await token.balanceOf(purchaseOfferMarket.address);
                const totalSupply = await token.totalSupply();

                expect(await purchaseOfferMarket.cancelPurchaseOffer(offerId))
                    .to.be.emit(purchaseOfferMarket, 'PurchaseOfferCancelled')
                    .withArgs(wallet_0.address, offerId);
                const offer = await purchaseOfferMarket.offers(offerId);
                expect(offer.active).to.equal(false);

                // check balance changed
                const amount = deposit.mul(limit);
                const penalty = amount.div(10);
                const rest = amount.sub(penalty);
                expect(await token.balanceOf(purchaseOfferMarket.address)).to.equal(offerMarketBalance.sub(amount));
                expect(await token.balanceOf(wallet_0.address)).to.equal(consumerBalance.add(rest));
                expect(await token.totalSupply()).to.equal(totalSupply.sub(penalty));
            });

            it('setPenaltyRate should work', async () => {
                await expect(purchaseOfferMarket.connect(wallet_1).setPenaltyRate(200)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
                await expect(purchaseOfferMarket.connect(wallet_0).setPenaltyRate(1000001)).to.be.revertedWith(
                    'PO001'
                );
                await purchaseOfferMarket.connect(wallet_0).setPenaltyRate(200);
                expect(await purchaseOfferMarket.penaltyRate()).to.equal(200);
            });

            it('setPenaltyDestination should work', async () => {
                await expect(
                    purchaseOfferMarket.connect(wallet_1).setPenaltyDestination(wallet_0.address)
                ).to.be.revertedWith('Ownable: caller is not the owner');
                await purchaseOfferMarket.connect(wallet_0).setPenaltyDestination(wallet_0.address);
                expect(await purchaseOfferMarket.penaltyDestination()).to.equal(wallet_0.address);
            });

            it('cancel offer with invalid caller should fail', async () => {
                await expect(purchaseOfferMarket.connect(wallet_1).cancelPurchaseOffer(offerId)).to.be.revertedWith(
                    'PO006'
                );
            });
        });

        describe('Accept Purchase Offer', () => {
            beforeEach(async () => {
                // register indexers
                await registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_0, '2000');
                await indexerRegistry.connect(wallet_0).setControllerAccount(wallet_1.address);
                await registerIndexer(token, indexerRegistry, staking, wallet_0, wallet_1, '2000');
                await indexerRegistry.connect(wallet_1).setControllerAccount(wallet_0.address);
                // create query project
                await projectRegistry.createProject(METADATA_HASH, VERSION, DEPLOYMENT_ID, 0);
                // wallet_0 start project
                await projectRegistry.updateServiceStatusToReady(DEPLOYMENT_ID);
            });

            it('accept offer should work', async () => {
                const offerMarketBalance = await token.balanceOf(purchaseOfferMarket.address);
                let offer = await purchaseOfferMarket.offers(offerId);
                expect(offer).to.exist;
                const rewardsDistrBalance = await token.balanceOf(rewardsDistributor.address);

                // accept offer
                await purchaseOfferMarket.acceptPurchaseOffer(offerId, poi);

                // check updates for the offer
                offer = await purchaseOfferMarket.offers(offerId);
                expect(await purchaseOfferMarket.offerPoi(offerId, wallet_0.address)).to.equal(poi);
                expect(await purchaseOfferMarket.acceptedOffer(offerId, wallet_0.address)).to.equal(true);
                expect(offer.numAcceptedContracts).to.equal(1);
                expect(await token.balanceOf(purchaseOfferMarket.address)).to.equal(offerMarketBalance.sub(deposit));
                expect(await token.balanceOf(rewardsDistributor.address)).to.equal(rewardsDistrBalance.add(deposit));
            });

            it('accept offer with invalid params and caller should fail', async () => {
                // invalid caller
                await expect(purchaseOfferMarket.connect(wallet_2).acceptPurchaseOffer(offerId, poi)).to.be.revertedWith(
                    'G002'
                );
                // create second offer
                const offerId2 = await createPurchaseOffer(purchaseOfferMarket, token, DEPLOYMENT_ID, futureDate);

                // invalid offerId
                await expect(purchaseOfferMarket.acceptPurchaseOffer(10, poi)).to.be.revertedWith('PO007');
                // offer already accepted
                await purchaseOfferMarket.acceptPurchaseOffer(offerId, poi);
                await expect(purchaseOfferMarket.acceptPurchaseOffer(offerId, poi)).to.be.revertedWith(
                    'PO009'
                );
                // offer cancelled
                await purchaseOfferMarket.cancelPurchaseOffer(offerId2);
                await expect(purchaseOfferMarket.acceptPurchaseOffer(offerId2, poi)).to.be.revertedWith('PO007');
                // contracts reacheed limit
                await expect(purchaseOfferMarket.connect(wallet_1).acceptPurchaseOffer(offerId, poi)).to.be.revertedWith(
                    'PO010'
                );
            });

            it('accept offer with inactive planTemplate should fail', async () => {
                const offerId2 = await createPurchaseOffer(purchaseOfferMarket, token, DEPLOYMENT_ID, futureDate);
                expect(offerId2).to.exist;
                await planManager.updatePlanTemplateStatus(0, false);
                await expect(createPurchaseOffer(purchaseOfferMarket, token, DEPLOYMENT_ID, futureDate)).to.revertedWith("PO005");

                await expect(purchaseOfferMarket.acceptPurchaseOffer(offerId2, poi)).to.revertedWith("PO005");
            });
        });
    });
});
