// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ContractTransaction } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { deployContracts } from './setup';
import {
    EraManager,
    IndexerRegistry,
    PlanManager,
    ProjectRegistry,
    PurchaseOfferMarket,
    RewardsHelper,
    ERC20,
    ServiceAgreementRegistry,
    Staking,
    ProjectType,
} from '../src';
import { METADATA_HASH, VERSION, deploymentIds, poi } from './constants';
import { createPurchaseOffer, etherParse, eventFrom, futureTimestamp, revertMsg, time, timeTravel } from './helper';

describe('Service Agreement Registry Contract', () => {
    let wallet, wallet1, wallet2;
    let token: ERC20;
    let staking: Staking;
    let indexerRegistry: IndexerRegistry;
    let projectRegistry: ProjectRegistry;
    let planManager: PlanManager;
    let purchaseOfferMarket: PurchaseOfferMarket;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let eraManager: EraManager;
    let rewardsHelper: RewardsHelper;

    // deprecated
    const minimumStakingAmount = etherParse('1000');

    const deployer = () => deployContracts(wallet, wallet1);
    before(async () => {
        [wallet, wallet1, wallet2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        token = deployment.token;
        staking = deployment.staking;
        indexerRegistry = deployment.indexerRegistry;
        projectRegistry = deployment.projectRegistry;
        planManager = deployment.planManager;
        purchaseOfferMarket = deployment.purchaseOfferMarket;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;
        eraManager = deployment.eraManager;
        rewardsHelper = deployment.rewardsHelper;

        await projectRegistry.setCreatorRestricted(ProjectType.SUBQUERY, false);

        // period 1000 s
        // planTemplateId: 0
        await planManager.createPlanTemplate(1000, 1000, 100, token.address, METADATA_HASH);

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
            ).to.be.revertedWith(revertMsg.notOwner);
        });
    });

    const getAgreementIdFromTx = async (tx: ContractTransaction) => {
        const event = await eventFrom(
            tx,
            serviceAgreementRegistry,
            'ClosedAgreementCreated(address,address,bytes32,uint256)'
        );
        return event?.serviceAgreementId;
    };

    describe('Establish Service Agressment', () => {
        beforeEach(async () => {
            // register indexer
            await token.increaseAllowance(staking.address, etherParse('1000'));
            await token.increaseAllowance(purchaseOfferMarket.address, etherParse('1000'));
            await indexerRegistry.registerIndexer(etherParse('1000'), METADATA_HASH, 0);
            await indexerRegistry.setControllerAccount(wallet2.address);

            // create 3 query projects
            await projectRegistry.createProject(METADATA_HASH, VERSION, deploymentIds[0], 0);
            await projectRegistry.createProject(METADATA_HASH, VERSION, deploymentIds[1], 0);
            await projectRegistry.createProject(METADATA_HASH, VERSION, deploymentIds[2], 0);

            await projectRegistry.startService(deploymentIds[0], wallet.address);

            // create a purchase offer
            await createPurchaseOffer(purchaseOfferMarket, token, deploymentIds[0], await futureTimestamp());
            await createPurchaseOffer(purchaseOfferMarket, token, deploymentIds[1], await futureTimestamp());
            await createPurchaseOffer(purchaseOfferMarket, token, deploymentIds[2], await futureTimestamp());
        });

        it('should estabish service agressment successfully', async () => {
            const tx = await purchaseOfferMarket.acceptPurchaseOffer(0, poi);
            const serviceAgreementId = await getAgreementIdFromTx(tx);
            expect(serviceAgreementId).to.be.gt(0);
            expect(
                await serviceAgreementRegistry.hasOngoingClosedServiceAgreement(wallet.address, deploymentIds[0])
            ).to.be.equal(true);
        });

        it('transfer service agreement should work', async () => {
            await purchaseOfferMarket.acceptPurchaseOffer(0, poi);
            await serviceAgreementRegistry.transferFrom(wallet.address, wallet1.address, 1);
            expect(await serviceAgreementRegistry.ownerOf(1)).to.equal(wallet1.address);

            const agreement = await serviceAgreementRegistry.getClosedServiceAgreement(1);
            expect(agreement.consumer).to.equal(wallet1.address);
        });

        it('estabish service agressment with wrong param should revert', async () => {
            await purchaseOfferMarket.acceptPurchaseOffer(0, poi);
            await token.increaseAllowance(purchaseOfferMarket.address, etherParse('4000'));
            await purchaseOfferMarket.createPurchaseOffer(
                deploymentIds[0],
                0,
                etherParse('1000'),
                2,
                100,
                minimumStakingAmount,
                await futureTimestamp(86400)
            );

            // SA006 error has been removed
            await expect(purchaseOfferMarket.connect(wallet).acceptPurchaseOffer(3, poi)).to.not.be.revertedWith(
                'SA006'
            );

            await purchaseOfferMarket.createPurchaseOffer(
                deploymentIds[2],
                0,
                etherParse('1'),
                2,
                100,
                minimumStakingAmount,
                await futureTimestamp(86400)
            );
            await expect(purchaseOfferMarket.connect(wallet).acceptPurchaseOffer(4, poi)).to.be.revertedWith('SA005');
        });
    });

    // TODO: add `clearEnedServiceAgreement` test

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
                .registerIndexer(etherParse('1000'), METADATA_HASH, 100, { gasLimit: '2000000' });

            // create query project
            await projectRegistry.connect(wallet1).createProject(METADATA_HASH, VERSION, deploymentIds[0], 0);
            await projectRegistry.connect(wallet1).startService(deploymentIds[0], wallet1.address);

            // period 10 days
            // planTemplateId: 1
            await planManager.createPlanTemplate(
                time.duration.days(10).toString(),
                1000,
                100,
                token.address,
                METADATA_HASH
            );

            // create purchase offer
            // value 100*2
            // period 10 days
            // use planTemplateId: 1
            await purchaseOfferMarket
                .connect(wallet2)
                .createPurchaseOffer(deploymentIds[0], 1, 100, 2, 100, minimumStakingAmount, await futureTimestamp());
            // create plan
            // value 100
            // period 10 days
            // use planTemplateId: 1
            // use planId: 1
            await planManager.connect(wallet1).createPlan(100, 1, deploymentIds[0]);
        });

        it('renew agreement generated from purchaseOfferMarket should fail', async () => {
            const tx = await purchaseOfferMarket.connect(wallet1).acceptPurchaseOffer(0, poi);
            const agreementId = await getAgreementIdFromTx(tx);
            await timeTravel(time.duration.days(3).toNumber());
            await expect(serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId)).to.be.revertedWith(
                'PM009'
            );
        });

        /**
         * era: 1 day
         * planTemplate 1, period 10 days
         * consumer: wallet2
         * indexer: wallet1
         */
        it('renew agreement generated from planManager should work', async () => {
            let tx = await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const addTable = await rewardsHelper.getRewardsAddTable(wallet1.address, 2, 10);
            const removeTable = await rewardsHelper.getRewardsRemoveTable(wallet1.address, 2, 12);

            let agreementId = await getAgreementIdFromTx(tx);
            const agreement = await serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
            const oldEndDate = (await agreement.startDate).toNumber() + (await agreement.period).toNumber();
            await timeTravel(time.duration.days(3).toNumber());
            tx = await serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId);
            agreementId = await getAgreementIdFromTx(tx);
            const newAgreement = await serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
            expect(newAgreement.lockedAmount).to.be.eq(agreement.lockedAmount);
            expect(newAgreement.startDate).to.be.eq(oldEndDate);
            expect(newAgreement.period).to.be.eq(agreement.period);

            const agreementStartEra = await eraManager.timestampToEraNumber(oldEndDate);
            expect(await rewardsHelper.getRewardsAddTable(wallet1.address, 2, 10)).to.eql(addTable);
            expect(await rewardsHelper.getRewardsRemoveTable(wallet1.address, 2, 12)).to.eql(removeTable);
            expect(await rewardsHelper.getRewardsAddTable(wallet1.address, agreementStartEra, 10)).to.eql(addTable);
            const newRemoveTable = await rewardsHelper.getRewardsRemoveTable(
                wallet1.address,
                agreementStartEra.add(2),
                10
            );
            expect(newRemoveTable).to.eql(removeTable.slice(2));
        });

        it('Indexers should be able to trun off renew', async () => {
            const tx = await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const agreementId = await getAgreementIdFromTx(tx);
            await timeTravel(time.duration.days(1).toNumber());
            expect((await planManager.getPlan(1)).active).to.be.eq(true);
            await planManager.connect(wallet1).removePlan(1);
            expect((await planManager.getPlan(1)).active).to.be.eq(false);
            await timeTravel(time.duration.days(1).toNumber());
            await expect(serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId)).to.be.revertedWith(
                'PM009'
            );
        });

        it('customer cannot renew expired agreement', async () => {
            const tx = await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const agreementId = await getAgreementIdFromTx(tx);
            await timeTravel(time.duration.days(20).toNumber());
            await expect(serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId)).to.be.revertedWith(
                'SA009'
            );
        });

        it('only customer can renew agreement', async () => {
            const tx = await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const agreementId = await getAgreementIdFromTx(tx);
            await timeTravel(time.duration.days(1).toNumber());
            await expect(serviceAgreementRegistry.connect(wallet1).renewAgreement(agreementId)).to.be.revertedWith(
                'SA007'
            );
        });

        it('cannot renew upcoming agreement', async () => {
            const plan = await planManager.getPlan(1);
            await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const balanceBefore = await token.balanceOf(wallet2.address);
            let tx = await planManager.connect(wallet2).acceptPlan(1, deploymentIds[0]);
            const agreementId = (
                await eventFrom(tx, serviceAgreementRegistry, 'ClosedAgreementCreated(address,address,bytes32,uint256)')
            ).serviceAgreementId;
            const balanceAfter = await token.balanceOf(wallet2.address);
            expect(balanceBefore.sub(balanceAfter)).to.eq(plan.price);

            await timeTravel(time.duration.days(1).toNumber());
            tx = await serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId);
            const upcomingAgreementId = (
                await eventFrom(tx, serviceAgreementRegistry, 'ClosedAgreementCreated(address,address,bytes32,uint256)')
            ).serviceAgreementId;
            await timeTravel(time.duration.days(1).toNumber());
            await expect(
                serviceAgreementRegistry.connect(wallet2).renewAgreement(upcomingAgreementId)
            ).to.be.revertedWith('SA008');
        });

        it('renew agreement with inactive planTemplate should fail', async () => {
            const planId = 1;
            const plan = await planManager.getPlan(planId);
            const tx = await planManager.connect(wallet2).acceptPlan(planId, deploymentIds[0]);
            const agreementId = (
                await eventFrom(tx, serviceAgreementRegistry, 'ClosedAgreementCreated(address,address,bytes32,uint256)')
            ).serviceAgreementId;
            await timeTravel(time.duration.days(3).toNumber());
            await planManager.updatePlanTemplateStatus(plan.templateId, false);
            await expect(serviceAgreementRegistry.connect(wallet2).renewAgreement(agreementId)).to.be.revertedWith(
                'PM006'
            );
        });
    });
});
