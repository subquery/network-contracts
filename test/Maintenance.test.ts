// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import {
    ConsumerHost,
    EraManager,
    IndexerRegistry,
    PermissionedExchange,
    PlanManager,
    ProjectRegistry,
    PurchaseOfferMarket,
    RewardsDistributor,
    ERC20,
    ServiceAgreementRegistry,
    Settings,
    Staking,
    StakingManager
} from '../src';
import { DEPLOYMENT_ID, METADATA_HASH, poi } from './constants';
import { etherParse, futureTimestamp, startNewEra, time } from './helper';
import { deployContracts } from './setup';


describe('Maintenance Mode Test', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2;
    let settings: Settings;
    let token: ERC20;
    let staking: Staking;
    let projectRegistry: ProjectRegistry;
    let indexerRegistry: IndexerRegistry;
    let planManager: PlanManager;
    let eraManager: EraManager;
    let rewardsDistributor: RewardsDistributor;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let consumerHost: ConsumerHost;
    let purchaseOfferMarket: PurchaseOfferMarket;
    let stakingManager: StakingManager;

    const deployer = ()=>deployContracts(wallet_0, wallet_1);
    before(async ()=>{
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        token = deployment.token;
        settings = deployment.settings;
        staking = deployment.staking;
        projectRegistry = deployment.projectRegistry;
        indexerRegistry = deployment.indexerRegistry;
        planManager = deployment.planManager;
        eraManager = deployment.eraManager;
        rewardsDistributor = deployment.rewardsDistributor;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;
        consumerHost = deployment.consumerHost;
        purchaseOfferMarket = deployment.purchaseOfferMarket;
        stakingManager = deployment.stakingManager;

        await token.transfer(wallet_1.address, etherParse("10000"));
        await token.transfer(wallet_2.address, etherParse("10000"));
        await token.connect(wallet_1).increaseAllowance(staking.address, etherParse('10000'));
        await token.connect(wallet_2).increaseAllowance(staking.address, etherParse('10000'));
        await token.increaseAllowance(staking.address, etherParse('10000'));
        await token.increaseAllowance(purchaseOfferMarket.address, etherParse('10000'));
        await indexerRegistry.registerIndexer(etherParse('1000'), METADATA_HASH, 0);
        await indexerRegistry.connect(wallet_2).registerIndexer(etherParse('1000'), METADATA_HASH, 0);

        await planManager.createPlanTemplate(time.duration.days(3).toString(), 1000, 100, token.address, METADATA_HASH);
        await planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID);
        await purchaseOfferMarket.createPurchaseOffer(
            DEPLOYMENT_ID,
            0,
            etherParse('1'),
            1,
            100,
            etherParse('1000'),
            await futureTimestamp(mockProvider)
        );

        await stakingManager.connect(wallet_1).delegate(wallet_0.address, etherParse('10'));
        await stakingManager.connect(wallet_1).undelegate(wallet_0.address, etherParse('1'));
        await startNewEra(mockProvider, eraManager);

        await eraManager.connect(wallet_0).enableMaintenance();
    });

    describe('Maintenance Mode Setup', () => {
        it('owner enable/disable maintenance should work', async () => {
            expect(await eraManager.maintenance()).to.equal(true);
            await eraManager.disableMaintenance();
            expect(await eraManager.maintenance()).to.equal(false);
            await eraManager.enableMaintenance();
            expect(await eraManager.maintenance()).to.equal(true);
        });
    });

    describe('EraManager check', () => {
        it('startNewEra should ban in maintenance mode', async () => {
            await expect(eraManager.startNewEra()).to.be.revertedWith('G019');
        });
        it('safeUpdateAndGetEra should ban in maintenance mode', async () => {
            await expect(eraManager.safeUpdateAndGetEra()).to.be.revertedWith('G019');
        });
    });

    describe('IndexerRegistry check', () => {
        it('registerIndexer should ban in maintenance mode', async () => {
            await expect(indexerRegistry.connect(wallet_1).registerIndexer(etherParse('1000'), METADATA_HASH, 0)).to.be.revertedWith('G019');
        });
        it('unregisterIndexer should ban in maintenance mode', async () => {
            await expect(indexerRegistry.unregisterIndexer()).to.be.revertedWith('G019');
        });
    });

    describe('ConsumerHost check', () => {
        it('approve should ban in maintenance mode', async () => {
            await expect(consumerHost.approve()).to.be.revertedWith('G019');
        });
        it('disapprove should ban in maintenance mode', async () => {
            await expect(consumerHost.disapprove()).to.be.revertedWith('G019');
        });
        it('deposit should ban in maintenance mode', async () => {
            await expect(consumerHost.deposit(etherParse('10'), true)).to.be.revertedWith('G019');
        });
        it('withdraw should ban in maintenance mode', async () => {
            await expect(consumerHost.withdraw(etherParse('9.5'))).to.be.revertedWith('G019');
        });
    });

    describe('PlanManager check', () => {
        it('createPlan should ban in maintenance mode', async () => {
            await expect(planManager.createPlan(etherParse('2'), 0, DEPLOYMENT_ID)).to.be.revertedWith('G019');
        });
        it('removePlan should ban in maintenance mode', async () => {
            await expect(planManager.removePlan(0)).to.be.revertedWith('G019');
        });
        it('acceptPlan should ban in maintenance mode', async () => {
            await expect(planManager.acceptPlan(0, DEPLOYMENT_ID)).to.be.revertedWith('G019');
        });
    });

    describe('PurchaseOfferMarket check', () => {
        it('createPurchaseOffer should ban in maintenance mode', async () => {
            await expect(purchaseOfferMarket.createPurchaseOffer(
                DEPLOYMENT_ID,
                0,
                etherParse('1'),
                1,
                100,
                etherParse('1000'),
                await futureTimestamp(mockProvider)
            )).to.be.revertedWith('G019');
        });

        it('cancelPurchaseOffer should ban in maintenance mode', async () => {
            await expect(purchaseOfferMarket.cancelPurchaseOffer(0)).to.be.revertedWith('G019');
        });

        it('acceptPurchaseOffer should ban in maintenance mode', async () => {
            await expect(purchaseOfferMarket.acceptPurchaseOffer(0, poi)).to.be.revertedWith('G019');
        });
    });

    describe('RewardsDistributor check', () => {
        it('collectAndDistributeRewards should ban in maintenance mode', async () => {
            await expect(rewardsDistributor.collectAndDistributeRewards(wallet_0.address)).to.be.revertedWith('G019');
        });
        it('claim should ban in maintenance mode', async () => {
            await expect(rewardsDistributor.claim(wallet_0.address)).to.be.revertedWith('G019');
        });
    });

    describe('StakingManager check', () => {
        it('stake should ban in maintenance mode', async () => {
            await expect(stakingManager.stake(wallet_0.address, etherParse('1'))).to.be.revertedWith('G019');
        });
        it('unstake should ban in maintenance mode', async () => {
            await expect(stakingManager.unstake(wallet_0.address, etherParse('1'))).to.be.revertedWith('G019');
        });
        it('delegate should ban in maintenance mode', async () => {
            await expect(stakingManager.connect(wallet_1).delegate(wallet_0.address, etherParse('1'))).to.be.revertedWith('G019');
        });
        it('undelegate should ban in maintenance mode', async () => {
            await expect(stakingManager.connect(wallet_1).undelegate(wallet_0.address, etherParse('1'))).to.be.revertedWith('G019');
        });
        it('redelegate should ban in maintenance mode', async () => {
            await expect(stakingManager.connect(wallet_1).redelegate(wallet_0.address, wallet_2.address, etherParse('1'))).to.be.revertedWith('G019');
        });
        it('widthdraw should ban in maintenance mode', async () => {
            await expect(stakingManager.connect(wallet_1).widthdraw()).to.be.revertedWith('G019');
        });
        it('cancelUnbonding should ban in maintenance mode', async () => {
            await expect(stakingManager.connect(wallet_1).cancelUnbonding(0)).to.be.revertedWith('G019');
        });
    });

});