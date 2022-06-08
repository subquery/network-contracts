// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {Contract, Wallet} from 'ethers';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {DEPLOYMENT_ID, METADATA_HASH, VERSION, mmrRoot} from './constants';
import {futureTimestamp, timeTravel, time} from './helper';
import {
    IndexerRegistry,
    PurchaseOfferMarket,
    QueryRegistry,
    ServiceAgreementRegistry,
    SQToken,
    Staking,
    RewardsDistributer,
    PlanManager,
} from '../src';
import {utils} from 'ethers';

describe('Purchase Offer Market Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2;
    let purchaseOfferMarket: PurchaseOfferMarket;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let indexerRegistry: IndexerRegistry;
    let queryRegistry: QueryRegistry;
    let staking: Staking;
    let token: SQToken;
    let rewardsDistributor: RewardsDistributer;
    let planManager: PlanManager;

    let futureDate;
    const deposit = 100;
    const limit = 1;
    const minimumAcceptHeight = 100;
    const contractPeriod = 1000;
    const planTemplateId = 0;

    const createPurchaseOffer = async (expireDate: number) => {
        await token.increaseAllowance(purchaseOfferMarket.address, 10000);
        await purchaseOfferMarket.createPurchaseOffer(
            DEPLOYMENT_ID,
            planTemplateId,
            deposit,
            limit,
            minimumAcceptHeight,
            expireDate
        );
    };

    const registerIndexer = async (wallet: Wallet, controller: string) => {
        await token.connect(wallet_0).transfer(wallet.address, 1000000000);
        await token.connect(wallet).increaseAllowance(staking.address, 1000000000);
        await indexerRegistry.connect(wallet).registerIndexer(1000000000, METADATA_HASH, 0);
        await indexerRegistry.connect(wallet).setControllerAccount(controller);
    };

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
        futureDate = await futureTimestamp(mockProvider);
        const deployment = await deployContracts(wallet_0, wallet_1);
        purchaseOfferMarket = deployment.purchaseOfferMarket;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;
        indexerRegistry = deployment.indexerRegistry;
        queryRegistry = deployment.queryRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributer;
        planManager = deployment.planManager;
        await planManager.createPlanTemplate(contractPeriod, 1000, 100, METADATA_HASH);
        await createPurchaseOffer(futureDate);
    });

    describe('Purchase Offer Market', () => {
        describe('Create Purchase Offer', () => {
            it('create offer should work', async () => {
                const offer = await purchaseOfferMarket.offers(0);
                expect(offer.consumer).to.equal(wallet_0.address);
                expect(offer.expireDate).to.equal(futureDate);
                expect(offer.deploymentId).to.equal(DEPLOYMENT_ID);
                expect(offer.deposit).to.equal(deposit);
                expect(offer.limit).to.equal(limit);
                expect(offer.numAcceptedContracts).to.equal(0);
                expect(offer.minimumAcceptHeight).to.equal(minimumAcceptHeight);
                expect(offer.planTemplateId).to.equal(planTemplateId);
                expect((await planManager.getPlanTemplate(offer.planTemplateId)).period).to.equal(contractPeriod);
                expect(offer.cancelled).to.equal(false);
                expect(await purchaseOfferMarket.numOffers()).to.be.equal(1);
                expect(await token.balanceOf(purchaseOfferMarket.address)).to.equal(deposit * limit);
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
                ).to.be.revertedWith('invalid expiration');
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
                ).to.be.revertedWith('should deposit positive amount');
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
                ).to.be.revertedWith('should limit positive amount');
            });
        });

        describe('Cancel Purchase Offer', () => {
            it('cancel exipred offer should work', async () => {
                await timeTravel(mockProvider, time.duration.days(20).toNumber());
                const consumerBalance = await token.balanceOf(wallet_0.address);
                const offerMarketBalance = await token.balanceOf(purchaseOfferMarket.address);

                expect(await purchaseOfferMarket.cancelPurchaseOffer(0))
                    .to.be.emit(purchaseOfferMarket, 'PurchaseOfferCancelled')
                    .withArgs(wallet_0.address, 0);
                const offer = await purchaseOfferMarket.offers(0);
                expect(offer.cancelled).to.equal(true);

                // check balance changed
                const amount = deposit * limit;
                expect(await token.balanceOf(purchaseOfferMarket.address)).to.equal(offerMarketBalance.sub(amount));
                expect(await token.balanceOf(wallet_0.address)).to.equal(consumerBalance.add(amount));
            });

            it('cancel unexipred offer should work', async () => {
                const consumerBalance = await token.balanceOf(wallet_0.address);
                const offerMarketBalance = await token.balanceOf(purchaseOfferMarket.address);
                const totalSupply = await token.totalSupply();

                expect(await purchaseOfferMarket.cancelPurchaseOffer(0))
                    .to.be.emit(purchaseOfferMarket, 'PurchaseOfferCancelled')
                    .withArgs(wallet_0.address, 0);
                const offer = await purchaseOfferMarket.offers(0);
                expect(offer.cancelled).to.equal(true);

                // check balance changed
                const amount = deposit * limit;
                const penalty = amount * 0.1;
                const rest = amount - penalty;
                expect(await token.balanceOf(purchaseOfferMarket.address)).to.equal(offerMarketBalance.sub(amount));
                expect(await token.balanceOf(wallet_0.address)).to.equal(consumerBalance.add(rest));
                expect(await token.totalSupply()).to.equal(totalSupply.sub(penalty));
            });

            it('setPenaltyRate should work', async () => {
                await expect(purchaseOfferMarket.connect(wallet_1).setPenaltyRate(200)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
                await expect(purchaseOfferMarket.connect(wallet_0).setPenaltyRate(1000001)).to.be.revertedWith(
                    'Invalid penalty rate'
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
                await expect(purchaseOfferMarket.connect(wallet_1).cancelPurchaseOffer(0)).to.be.revertedWith(
                    'only offerer can cancel the offer'
                );
            });
        });

        describe('Accept Purchase Offer', () => {
            beforeEach(async () => {
                // create second offer
                await createPurchaseOffer(await futureTimestamp(mockProvider));
                // register indexers
                await registerIndexer(wallet_0, wallet_1.address);
                await registerIndexer(wallet_1, wallet_0.address);
                // create query project
                await queryRegistry.createQueryProject(METADATA_HASH, VERSION, DEPLOYMENT_ID);
                // wallet_0 start project
                await queryRegistry.startIndexing(DEPLOYMENT_ID);
                await queryRegistry.updateIndexingStatusToReady(DEPLOYMENT_ID);
            });

            it('accept offer should work', async () => {
                const offerMarketBalance = await token.balanceOf(purchaseOfferMarket.address);
                let offer = await purchaseOfferMarket.offers(0);
                const rewardsDistrBalance = await token.balanceOf(rewardsDistributor.address);

                // accept offer
                const tx = await purchaseOfferMarket.acceptPurchaseOffer(0, mmrRoot);
                const receipt = await tx.wait();
                const evt = receipt.events.find(
                    (log) => log.topics[0] === utils.id('ClosedAgreementCreated(address,address,bytes32,address)')
                );
                const CSAContractAddress = serviceAgreementRegistry.interface.decodeEventLog(
                    serviceAgreementRegistry.interface.getEvent('ClosedAgreementCreated'),
                    evt.data
                ).serviceAgreement;

                // check updates for the offer
                offer = await purchaseOfferMarket.offers(0);
                expect(await purchaseOfferMarket.offerMmrRoot(0, wallet_0.address)).to.equal(mmrRoot);
                expect(await purchaseOfferMarket.acceptedOffer(0, wallet_0.address)).to.equal(true);
                expect(offer.numAcceptedContracts).to.equal(1);
                expect(await token.balanceOf(purchaseOfferMarket.address)).to.equal(offerMarketBalance.sub(deposit));
                expect(await token.balanceOf(CSAContractAddress)).to.equal(0);
                expect(await token.balanceOf(rewardsDistributor.address)).to.equal(rewardsDistrBalance.add(deposit));
            });

            it('accept offer with invalid params and caller should fail', async () => {
                // invalid caller
                await expect(purchaseOfferMarket.connect(wallet_2).acceptPurchaseOffer(0, mmrRoot)).to.be.revertedWith(
                    'caller is not an indexer'
                );
                // invalid offerId
                await expect(purchaseOfferMarket.acceptPurchaseOffer(2, mmrRoot)).to.be.revertedWith('invalid offerId');
                // offer already accepted
                await purchaseOfferMarket.acceptPurchaseOffer(0, mmrRoot);
                await expect(purchaseOfferMarket.acceptPurchaseOffer(0, mmrRoot)).to.be.revertedWith(
                    'offer accepted already'
                );
                // offer cancelled
                await purchaseOfferMarket.cancelPurchaseOffer(1);
                await expect(purchaseOfferMarket.acceptPurchaseOffer(1, mmrRoot)).to.be.revertedWith('offer cancelled');
                // contracts reacheed limit
                await expect(purchaseOfferMarket.connect(wallet_1).acceptPurchaseOffer(0, mmrRoot)).to.be.revertedWith(
                    'number of contracts already reached limit'
                );
            });
        });
    });
});
