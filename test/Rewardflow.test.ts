// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {BigNumber, providers, utils} from 'ethers';
import {deployContracts} from './setup';
import {METADATA_HASH, DEPLOYMENT_ID, VERSION} from './constants';
import {
    IndexerRegistry,
    PlanManager,
    QueryRegistry,
    ServiceAgreementRegistry,
    RewardsDistributer,
    RewardsStaking,
    RewardsHelper,
    EraManager,
    SQToken,
    Staking,
    StakingManager,
    Settings,
    InflationController,
} from '../src';
import {startNewEra, time, acceptPlan, etherParse, timeTravel, eventFrom, futureTimestamp} from './helper';

describe('Rewardflow tests', () => {
    const mockProvider = waffle.provider;
    let root, indexer, consumer, delegator1, delegator2, delegator3;

    let token: SQToken;
    let staking: Staking;
    let stakingManager: StakingManager;
    let queryRegistry: QueryRegistry;
    let indexerRegistry: IndexerRegistry;
    let planManager: PlanManager;
    let eraManager: EraManager;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let rewardsDistributor: RewardsDistributer;
    let rewardsStaking: RewardsStaking;
    let rewardsHelper: RewardsHelper;
    let settings: Settings;
    let inflationController: InflationController;

    let rewards: BigNumber;

    const registerIndexer = async (rootWallet, wallet, amount, rate) => {
        await token.connect(rootWallet).transfer(wallet.address, amount);
        await token.connect(wallet).increaseAllowance(staking.address, amount);
        await indexerRegistry.connect(wallet).registerIndexer(amount, METADATA_HASH, rate, {gasLimit: '2000000'});
    };

    describe('Rewardflow test', async () => {
        beforeEach(async () => {
            [root, indexer, consumer, delegator1, delegator2, delegator3] = await ethers.getSigners();
            //contract deployed start at era 1
            const deployment = await deployContracts(root, delegator2);
            indexerRegistry = deployment.indexerRegistry;
            queryRegistry = deployment.queryRegistry;
            planManager = deployment.planManager;
            serviceAgreementRegistry = deployment.serviceAgreementRegistry;
            staking = deployment.staking;
            stakingManager = deployment.stakingManager;
            token = deployment.token;
            rewardsDistributor = deployment.rewardsDistributer;
            rewardsStaking = deployment.rewardsStaking;
            rewardsHelper = deployment.rewardsHelper;
            eraManager = deployment.eraManager;
            settings = deployment.settings;
            inflationController = deployment.inflationController;

            // transfer SQT to accounts
            await token.connect(root).transfer(delegator1.address, etherParse('1000'));
            await token.connect(root).transfer(delegator2.address, etherParse('1000'));
            await token.connect(root).transfer(consumer.address, etherParse('10000'));
            await token.connect(consumer).increaseAllowance(planManager.address, etherParse('10000'));
            await token.connect(delegator1).increaseAllowance(staking.address, etherParse('1000'));
            await token.connect(delegator2).increaseAllowance(staking.address, etherParse('1000'));
            await token.connect(root).increaseAllowance(rewardsDistributor.address, etherParse('10000'));

        })
    })



})
