// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {METADATA_HASH, DEPLOYMENT_ID, deploymentIds, metadatas, VERSION} from './constants';
import {
    IndexerRegistry,
    PlanManager,
    QueryRegistry,
    ServiceAgreementRegistry,
    RewardsDistributer,
    EraManager,
    SQToken,
    Staking,
    Settings,
    ClosedServiceAgreement__factory,
    ClosedServiceAgreement,
    InflationController,
} from '../src';
import {startNewEra, time, generateAgreement} from './helper';
import {MockProvider} from 'ethereum-waffle';

describe('RewardsDistributer Contract', () => {
    const mockProvider = waffle.provider;
    let root, indexer, consumer, delegator, delegator2;

    let token: SQToken;
    let staking: Staking;
    let queryRegistry: QueryRegistry;
    let indexerRegistry: IndexerRegistry;
    let planManager: PlanManager;
    let eraManager: EraManager;
    let serviceAgreementRegistry: ServiceAgreementRegistry;
    let rewardsDistributor: RewardsDistributer;
    let settings: Settings;
    let inflationController: InflationController;

    let rewards;

    //rewrite registerIndexer to registe indexer with stakeAmount and commissionRate
    const registerIndexer = async (rootWallet, wallet, amount, rate) => {
        await token.connect(rootWallet).transfer(wallet.address, amount);
        await token.connect(wallet).increaseAllowance(staking.address, amount);
        await indexerRegistry.connect(wallet).registerIndexer(amount, METADATA_HASH, rate, {gasLimit: '2000000'});
    };

    const checkValues = async (_indexerBalance, _delegatorBalance, _totalStakingAmount, _eraReward) => {
        expect(await token.balanceOf(indexer.address)).to.be.equal(_indexerBalance);
        expect(await token.balanceOf(delegator.address)).to.be.equal(_delegatorBalance);
        expect(await rewardsDistributor.getTotalStakingAmount(indexer.address)).to.be.equal(_totalStakingAmount);
        expect(await rewardsDistributor.getEraReward(indexer.address)).to.be.equal(_eraReward);
    };

    beforeEach(async () => {
        [root, indexer, consumer, delegator, delegator2] = await ethers.getSigners();
        //contract deployed start at era 1
        const deployment = await deployContracts(root, indexer);
        indexerRegistry = deployment.indexerRegistry;
        queryRegistry = deployment.queryRegistry;
        planManager = deployment.planManager;
        serviceAgreementRegistry = deployment.serviceAgreementRegistry;
        staking = deployment.staking;
        token = deployment.token;
        rewardsDistributor = deployment.rewardsDistributer;
        eraManager = deployment.eraManager;
        settings = deployment.settings;
        inflationController = deployment.inflationController;

        //init delegator account
        await token.connect(root).transfer(delegator.address, 10000);
        await token.connect(root).transfer(delegator2.address, 10000);
        await token.connect(delegator).increaseAllowance(staking.address, 10000);
        await token.connect(delegator2).increaseAllowance(staking.address, 10000);
        //make root as ServiceAgreementRegistry
        await settings.setServiceAgreementRegistry(root.address);
        await token.connect(root).increaseAllowance(rewardsDistributor.address, 10000);

        //set root address as inflation destination
        inflationController.connect(root).setInflationDestination(root.address);

        //setup era period be 5 days
        await eraManager.connect(root).updateEraPeriod(time.duration.days(5).toString());
        //register an new Indexer with Initial Commission Rate: 10% and Initial Staking Amount: 1000
        //moved to era 2
        await registerIndexer(root, indexer, 1000, 1e5);
    });

    describe('initialization', async () => {
        it('rewardsDistributor contract should initialize correctly', async () => {
            expect(await eraManager.eraNumber()).to.be.eq(2);
            expect(await rewardsDistributor.getLastClaimEra(indexer.address)).to.be.eq(1);
        });

        it('commissionRates and stakingAmount of new indexer should be load to rewardsDistributor contract', async () => {
            expect(await rewardsDistributor.commissionRates(indexer.address)).to.be.eq(1e5);
            expect(await rewardsDistributor.getTotalStakingAmount(indexer.address)).to.be.eq(1000);
        });
    });

    describe('Rewards Split', async () => {
        beforeEach(async () => {
            //a 30 days agreement with 400 rewards come in at Era2
            const agreement = await generateAgreement(
                indexer.address,
                consumer.address,
                30,
                400,
                root,
                mockProvider,
                DEPLOYMENT_ID,
                settings
            );
            //await timeTravel(mockProvider, 1000);
            await rewardsDistributor.connect(root).increaseAgreementRewards(indexer.address, agreement.address);
        });
        it('split rewards into eras should work', async () => {
            const currentEar = await (await eraManager.eraNumber()).toNumber();

            expect(await token.balanceOf(rewardsDistributor.address)).to.be.eq(400);

            const rewardsAddTable = await rewardsDistributor.getRewardsAddTable(
                indexer.address,
                currentEar,
                currentEar + 8
            );
            const rewardsRemoveTable = await rewardsDistributor.getRewardsRemoveTable(
                indexer.address,
                currentEar,
                currentEar + 8
            );
            const [eraReward, totalReward] = rewardsAddTable.reduce(
                (acc, val, idx) => {
                    let [eraReward, total] = acc;
                    eraReward += val.toNumber() - rewardsRemoveTable[idx].toNumber();
                    return [eraReward, total + eraReward];
                },
                [0, 0]
            );
            expect(eraReward).to.be.eq(0);
            expect(totalReward).to.be.eq(400);
        });
    });

    describe('distribute and claim rewards', async () => {
        beforeEach(async () => {
            //a 30 days agreement with 400 rewards come in at Era2
            const agreement = await generateAgreement(
                indexer.address,
                consumer.address,
                30,
                400,
                root,
                mockProvider,
                DEPLOYMENT_ID,
                settings
            );
            //await timeTravel(mockProvider, 1000);
            await rewardsDistributor.connect(root).increaseAgreementRewards(indexer.address, agreement.address);
        });
        it('rewards should be able to collect and distribute', async () => {
            //move to Era3
            await startNewEra(mockProvider, eraManager);

            //collect and distribute rewards for era 2
            //total rewards: 66
            //commission: 66*10% = 6.6 = 6
            //total staking: 1000
            //staking rewards for indexer(1000 staking): 60/1000*1000 = 60

            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            //commission for indexer be 6
            expect(await token.balanceOf(indexer.address)).to.be.eq(6);
            //staking rewards for indexer be 60
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            expect(await token.balanceOf(indexer.address)).to.be.eq(66);

            //move to Era 4
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            expect(await token.balanceOf(indexer.address)).to.be.eq(72);
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            expect(await token.balanceOf(indexer.address)).to.be.eq(132);

            //move to Era 5
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            expect(await token.balanceOf(indexer.address)).to.be.eq(138);
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            expect(await token.balanceOf(indexer.address)).to.be.eq(198);
            rewards = await token.balanceOf(indexer.address);
        });

        it('should be able to batch collect and distribute rewards', async () => {
            expect(await eraManager.eraNumber()).to.be.eq(2);
            expect(await rewardsDistributor.getLastClaimEra(indexer.address)).to.be.eq(1);
            //move to Era5
            await startNewEra(mockProvider, eraManager);
            await startNewEra(mockProvider, eraManager);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.batchCollectAndDistributeRewards(indexer.address, 10);
            expect(await eraManager.eraNumber()).to.be.eq(5);
            expect(await rewardsDistributor.getLastClaimEra(indexer.address)).to.be.eq(4);
            expect(await token.balanceOf(indexer.address)).to.be.eq(18);
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            expect(await token.balanceOf(indexer.address)).to.be.eq(198);
        });

        it('claim 0 reward should fail', async () => {
            await expect(rewardsDistributor.connect(delegator).claim(indexer.address)).to.be.revertedWith(
                'No rewards to be claim'
            );
        });

        it('claim each era should get same rewards with claim once', async () => {
            //move to Era 3
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            //move to Era 4
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            //move to Era 5
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            expect(await token.balanceOf(indexer.address)).to.be.eq(rewards);
        });

        it('delegatior should be able to delegate and apply at next Era', async () => {
            let pendingStakers;

            //delegate
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await staking.connect(delegator).delegate(indexer.address, 1000);
            pendingStakers = await rewardsDistributor.getPendingStakers(indexer.address);
            expect(pendingStakers[0]).to.equal(delegator.address);

            // apply stake change
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            pendingStakers = await rewardsDistributor.getPendingStakers(indexer.address);
            expect(pendingStakers.length).to.equal(0);
            expect(await rewardsDistributor.getTotalStakingAmount(indexer.address)).to.be.eq(2000);

            //claim no reward for this era
            await expect(rewardsDistributor.connect(delegator).claim(indexer.address)).to.be.revertedWith(
                'No rewards to be claim'
            );
            expect(await token.balanceOf(delegator.address)).to.be.eq(9000);

            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            //claim 30 rewards for this era
            await rewardsDistributor.connect(delegator).claim(indexer.address);
            expect(await token.balanceOf(delegator.address)).to.be.eq(9030);
        });

        it('delegatior should be able to delegate to collectAndDistributeRewards of last Era', async () => {
            //move to ear3
            await startNewEra(mockProvider, eraManager);
            //for now only era2 rewards not be distributed

            //delegatior delegate 1000 SQT
            expect(await rewardsDistributor.getLastClaimEra(indexer.address)).to.be.eq(1);
            await staking.connect(delegator).delegate(indexer.address, 1000);
            expect(await rewardsDistributor.getLastClaimEra(indexer.address)).to.be.eq(2);
        });

        it('delegate at more then one Era reward not be distributed should fail', async () => {
            //move to ear3
            await startNewEra(mockProvider, eraManager);
            //move to era4
            await startNewEra(mockProvider, eraManager);
            //for now era2 and era3 rewards not be distributed
            await expect(staking.connect(delegator).delegate(indexer.address, 1000)).to.be.revertedWith(
                'unless collect rewards of last era'
            );
        });

        it('StakeChange should apply after collectAndDistributeRewards', async () => {
            //move to ear3
            await startNewEra(mockProvider, eraManager);
            //distribute era2
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            //delegatior delegate 1000 SQT
            await staking.connect(delegator).delegate(indexer.address, 1000);

            //move to era4
            await startNewEra(mockProvider, eraManager);
            //distribute era3
            await expect(rewardsDistributor.applyStakeChange(indexer.address, delegator.address)).to.be.revertedWith(
                'era reward should be collected'
            );
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            expect(await rewardsDistributor.getTotalStakingAmount(indexer.address)).to.be.eq(2000);
        });

        it('claimAndDistributeRewards before applyStakeChange should fail', async () => {
            //move to ear3
            await startNewEra(mockProvider, eraManager);
            //distribute era2
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            //delegatior delegate 1000 SQT
            await staking.connect(delegator).delegate(indexer.address, 1000);

            //move to era4
            await startNewEra(mockProvider, eraManager);
            //move to era5
            await startNewEra(mockProvider, eraManager);
            //distribute era3
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            //not apply the change happened in era3， distribute era4
            await expect(rewardsDistributor.collectAndDistributeRewards(indexer.address)).to.be.revertedWith(
                'should apply pending stake or ICR changes'
            );
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            expect(await rewardsDistributor.getTotalStakingAmount(indexer.address)).to.be.eq(2000);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            expect(await rewardsDistributor.getLastClaimEra(indexer.address)).to.be.eq(4);
        });

        it('applyStakeChange should claim accrued rewrads for delegator', async () => {
            //delegate
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await staking.connect(delegator).delegate(indexer.address, 1000);
            //apply stake Change
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            //delegate
            await startNewEra(mockProvider, eraManager);
            await staking.connect(delegator).delegate(indexer.address, 1000);
            //apply stake Change and claim accrued rewrads for delegator
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            expect(await token.balanceOf(delegator.address)).to.be.eq(8060);
        });

        it('indexer should be able to change and apply commission rate', async () => {
            await staking.connect(indexer).setCommissionRate(200);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyICRChange(indexer.address);
            expect(await rewardsDistributor.commissionRates(indexer.address)).to.be.eq(200);
        });

        it('early apply commission rate should fail', async () => {
            await staking.connect(indexer).setCommissionRate(200);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await expect(rewardsDistributor.applyICRChange(indexer.address)).to.be.revertedWith('no pending change');
        });

        it('not apply commission rate should fail', async () => {
            await staking.connect(indexer).setCommissionRate(200);
            await startNewEra(mockProvider, eraManager);
            await startNewEra(mockProvider, eraManager);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await expect(rewardsDistributor.collectAndDistributeRewards(indexer.address)).to.be.revertedWith(
                'should apply pending stake or ICR changes'
            );
            await rewardsDistributor.applyICRChange(indexer.address);
            expect(await rewardsDistributor.commissionRates(indexer.address)).to.be.eq(200);
        });

        it('stake and ICR change should be able to happen at same Era', async () => {
            await staking.connect(indexer).setCommissionRate(200);
            await staking.connect(delegator).delegate(indexer.address, 1000);
            await startNewEra(mockProvider, eraManager);
            await startNewEra(mockProvider, eraManager);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await expect(rewardsDistributor.collectAndDistributeRewards(indexer.address)).to.be.revertedWith(
                'should apply pending stake or ICR changes'
            );
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await expect(rewardsDistributor.collectAndDistributeRewards(indexer.address)).to.be.revertedWith(
                'should apply pending stake or ICR changes'
            );
            await rewardsDistributor.applyICRChange(indexer.address);
            expect(await rewardsDistributor.commissionRates(indexer.address)).to.be.eq(200);
        });
    });

    describe('Indexer reregister', () => {
        beforeEach(async () => {
            //setup era period be 15 days
            await eraManager.connect(root).updateEraPeriod(time.duration.days(15).toString());
            //add a delegator delegate to the indexer -> start new era and apply staking change
            await staking.connect(delegator).delegate(indexer.address, 1000);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            //generate agreement and agreement complete
            const agreement = await generateAgreement(
                indexer.address,
                consumer.address,
                5,
                400,
                root,
                mockProvider,
                DEPLOYMENT_ID,
                settings
            );
            await rewardsDistributor.connect(root).increaseAgreementRewards(indexer.address, agreement.address);
            //unregister indexer
            await indexerRegistry.connect(indexer).unregisterIndexer({gasLimit: '1000000'});
        });

        it('check reward distribution after indexer unregistered', async () => {
            // 1. start new era -> collectAndDistributeRewards -> check values change
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await checkValues(40, 9000, 2000, 400);
            // 2. apply indexer stake change -> check values change
            await rewardsDistributor.applyStakeChange(indexer.address, indexer.address);
            await checkValues(220, 9000, 1000, 400);
            // 3. delegator undelgate all Tokens
            await staking.connect(delegator).undelegate(indexer.address, 1000);
            // 4. start new era -> delegator apply stake change -> check values change
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            await checkValues(220, 9180, 0, 0);
            // 5. indexer and delegator widthdraw, check values change
            await staking.connect(indexer).widthdraw();
            await staking.connect(delegator).widthdraw();
            await checkValues(1219, 10179, 0, 0);
        });

        it('indexer can not reregister with existing delegators ', async () => {
            // 1. indexer try to reregister immediately should revert with `Last unregistry not settled`: era[n]
            await expect(
                indexerRegistry.connect(indexer).registerIndexer(1000, METADATA_HASH, 100, {gasLimit: '2000000'})
            ).to.be.revertedWith('Last registry not settled');
            // 2. start new era -> indexer `collectAndDistributeRewards` -> `applyStakeChange`: era[n+1]
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, indexer.address);
            // 3. check totalStakingAmount equal delegation amount
            expect(await rewardsDistributor.getTotalStakingAmount(indexer.address)).to.be.eq(
                await rewardsDistributor.getDelegationAmount(delegator.address, indexer.address)
            );
            // 4. indexer try to register still revert with `Last unregistry not settled`
            await expect(
                indexerRegistry.connect(indexer).registerIndexer(1000, METADATA_HASH, 100, {gasLimit: '2000000'})
            ).to.be.revertedWith('Last registry not settled');
            // 5. delegator undelegate all the Tokens
            await staking.connect(delegator).undelegate(indexer.address, 1000);
            // 6. indexer try to register revert with `Last unregistry not settled`
            await expect(
                indexerRegistry.connect(indexer).registerIndexer(1000, METADATA_HASH, 100, {gasLimit: '2000000'})
            ).to.be.revertedWith('Last registry not settled');
        });

        it('indexer without delegators can reregister', async () => {
            // 1. start new era -> indexer `collectAndDistributeRewards` -> `applyStakeChange`: era[n+1]
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, indexer.address);
            // 2. delegator undelegate all the Tokens
            await staking.connect(delegator).undelegate(indexer.address, 1000);
            // 3. start new era -> delegator -> `applyStakeChange`
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            // 4. check totalStakingAmount equal 0, era reward equal 0
            await checkValues(220, 9180, 0, 0);
            // 5. indexer register successfully
            await staking.connect(indexer).widthdraw();
            await token.connect(indexer).increaseAllowance(staking.address, 1000);
            await indexerRegistry.connect(indexer).registerIndexer(1000, METADATA_HASH, 100, {gasLimit: '2000000'});
        });

        it('reward distribution should work after indexer reregister immediately', async () => {
            // 1. delegator undelegate all the tokens
            await staking.connect(delegator).undelegate(indexer.address, 1000);
            // 2. start new era -> indexer `collectAndDistributeRewards` -> `applyStakeChange | delegator -> `applyStakeChange`
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            await staking.connect(indexer).widthdraw();
            await staking.connect(delegator).widthdraw();
            // 3. indexer reregister -> add previous delegator and a new delegator
            await token.connect(indexer).increaseAllowance(staking.address, 1000);
            await indexerRegistry.connect(indexer).registerIndexer(1000, METADATA_HASH, 100, {gasLimit: '2000000'});
            await checkValues(219, 10179, 1000, 400);
            await staking.connect(delegator).delegate(indexer.address, 1000);
            await staking.connect(delegator2).delegate(indexer.address, 1000);
            // 4. generate new agreement and check the reward distribution for 2 era
            const agreement = await generateAgreement(
                indexer.address,
                consumer.address,
                5,
                400,
                root,
                mockProvider,
                DEPLOYMENT_ID,
                settings
            );
            await rewardsDistributor.connect(root).increaseAgreementRewards(indexer.address, agreement.address);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator2.address);
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            await checkValues(619, 9179, 3000, 400);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await checkValues(619, 9179, 3000, 0);
        });

        it('reward distribution should work after indexer reregister few more ears later', async () => {
            // 1. delegator undelegate all the tokens
            await staking.connect(delegator).undelegate(indexer.address, 1000);
            // 2. start new era -> indexer `collectAndDistributeRewards` -> `applyStakeChange | delegator -> `applyStakeChange`
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            await staking.connect(indexer).widthdraw();
            await staking.connect(delegator).widthdraw();
            //after few more eras
            await startNewEra(mockProvider, eraManager);
            await startNewEra(mockProvider, eraManager);
            // 3. indexer reregister -> add previous delegator and a new delegator
            await token.connect(indexer).increaseAllowance(staking.address, 1000);
            await indexerRegistry.connect(indexer).registerIndexer(1000, METADATA_HASH, 100, {gasLimit: '2000000'});
            await checkValues(219, 10179, 1000, 0);
            await staking.connect(delegator).delegate(indexer.address, 1000);
            await staking.connect(delegator2).delegate(indexer.address, 1000);
            // 4. generate new agreement and check the reward distribution for 2 era
            const agreement = await generateAgreement(
                indexer.address,
                consumer.address,
                5,
                400,
                root,
                mockProvider,
                DEPLOYMENT_ID,
                settings
            );
            await rewardsDistributor.connect(root).increaseAgreementRewards(indexer.address, agreement.address);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator2.address);
            await rewardsDistributor.connect(indexer).claim(indexer.address);
            await checkValues(619, 9179, 3000, 400);
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await checkValues(619, 9179, 3000, 0);
        });

        it('undelgate and redelegate after indexer unregistered should work', async () => {
            // 1. delegator can undelegate from the indexer (some amount) at the same era of indexer unregistered
            await staking.connect(delegator).undelegate(indexer.address, 100);
            // 2. start new era
            await startNewEra(mockProvider, eraManager);
            // 3. delegator can not undelegate from the indexer
            await expect(staking.connect(delegator).undelegate(indexer.address, 100)).to.be.revertedWith(
                'apply pending changes first'
            );
            // 4. one of the delegator call `collectAndDistributeRewards` and `applyStakeChange`
            await rewardsDistributor.collectAndDistributeRewards(indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, indexer.address);
            await rewardsDistributor.applyStakeChange(indexer.address, delegator.address);
            // 5. delegators can undelegate and redelegate
            await staking.connect(delegator).undelegate(indexer.address, 100);
        });
    });
});
