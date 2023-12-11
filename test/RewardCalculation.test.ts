// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers, waffle } from 'hardhat';
import {
    EraManager,
    IndexerRegistry,
    InflationController,
    PlanManager,
    ProjectRegistry,
    RewardsDistributer,
    RewardsHelper,
    RewardsStaking,
    ERC20,
    ServiceAgreementRegistry,
    Settings,
    Staking,
    StakingManager,
} from '../src';
import { DEPLOYMENT_ID, METADATA_HASH, VERSION } from './constants';
import { etherParse, futureTimestamp, startNewEra, time } from './helper';
import { deployContracts } from './setup';

const BN = (value: string | number): BigNumber => BigNumber.from(value);

// FIXME: fix test accuracy running on github action
describe.skip('RewardsDistributer Contract', () => {
  const mockProvider = waffle.provider;
  let root, indexer, consumer, delegator1, delegator2;

  let token: ERC20;
  let staking: Staking;
  let stakingManager: StakingManager;
  let projectRegistry: ProjectRegistry;
  let indexerRegistry: IndexerRegistry;
  let planManager: PlanManager;
  let eraManager: EraManager;
  let rewardsDistributor: RewardsDistributer;
  let rewardsHelper: RewardsHelper;

  let rewards: BigNumber;

  //rewrite registerIndexer to registe indexer with stakeAmount and commissionRate
  const registerIndexer = async (rootWallet, wallet, amount, rate) => {
    await token.connect(rootWallet).transfer(wallet.address, amount);
    await token.connect(wallet).increaseAllowance(staking.address, amount);
    await indexerRegistry.connect(wallet).registerIndexer(amount, METADATA_HASH, rate, { gasLimit: '2000000' });
  };

  const collectRewards = async () => {
    const currentEra = await eraManager.eraNumber();
    await rewardsDistributor.collectAndDistributeEraRewards(currentEra, indexer.address);
  }

  const checkRewardInfo = async (_accSQTPerStake: BigNumber, _eraReward: BigNumber, _rewardDebt: BigNumber, delegator?: string) => {
    const { accSQTPerStake, eraReward } = await rewardsDistributor.getRewardInfo(indexer.address);
    const rewardDebt = await rewardsDistributor.getRewardDebt(indexer.address, delegator ?? indexer.address);

    expect(eraReward).to.be.equal(_eraReward);
    expect(accSQTPerStake).to.be.equal(_accSQTPerStake);
    expect(rewardDebt).to.be.equal(_rewardDebt);

    return { accSQTPerStake, eraReward, rewardDebt };
  }

  describe('Agreement cross 2 era', async () => {
    beforeEach(async () => {
      [root, indexer, consumer, delegator1, delegator2] = await ethers.getSigners();
      //contract deployed start at era 1
      const deployment = await deployContracts(root, delegator2);
      indexerRegistry = deployment.indexerRegistry;
      projectRegistry = deployment.projectRegistry;
      planManager = deployment.planManager;
      staking = deployment.staking;
      stakingManager = deployment.stakingManager;
      rewardsDistributor = deployment.rewardsDistributer;
      rewardsHelper = deployment.rewardsHelper;
      eraManager = deployment.eraManager;

      // transfer SQT to accounts
      await token.connect(root).transfer(delegator1.address, etherParse('1000'));
      await token.connect(root).transfer(delegator2.address, etherParse('1000'));
      await token.connect(root).transfer(consumer.address, etherParse('10000'));
      await token.connect(consumer).increaseAllowance(planManager.address, etherParse('10000'));
      await token.connect(delegator1).increaseAllowance(staking.address, etherParse('1000'));
      await token.connect(delegator2).increaseAllowance(staking.address, etherParse('1000'));
      await token.connect(root).increaseAllowance(rewardsDistributor.address, etherParse('10000'));

      //setup era period be 7 days
      await eraManager.connect(root).updateEraPeriod(time.duration.days(7).toString());
      await startNewEra(mockProvider, eraManager);

      await registerIndexer(root, indexer, etherParse('1000'), 0);
      await projectRegistry.createProject(METADATA_HASH, VERSION, DEPLOYMENT_ID,0);
      // start indexing project
      await projectRegistry.connect(indexer).startService(DEPLOYMENT_ID);
      // create plan
      await planManager.createPlanTemplate(time.duration.days(7).toString(), 1000, 100, token.address, METADATA_HASH);
      await planManager.connect(indexer).createPlan(etherParse('10000'), 0, DEPLOYMENT_ID);
      // purchase plan
      await startNewEra(mockProvider, eraManager);
      await futureTimestamp(mockProvider, time.duration.days(2));
      await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);
    });

    it('should be able to distribute reward correctly without delegators', async () => {
      // total rewards for the agreement = 10000
      // total staking = 1000
      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      await checkRewardInfo(BN('0'), BN('0'), BN('0'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // accSQTPerStake = 10*10e-12, eraReward = 10000, rewardDebt = 0
      await checkRewardInfo(BN('9999983465608'), BN('9999983465608465608465'), BN('0'));

      let indexerRewards = await rewardsDistributor.userRewards(indexer.address, indexer.address);
      expect(indexerRewards).to.be.equal(BN('9999983465608000000000'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // FIXME: expect accSQTPerStake to be 10*10e-12, but it is 29*10e-12
      // expect eraReward = 10000, but is 20000
      // await checkRewardInfo(BN('29999933862433'), BN('19999950396825396825395'), BN('0'));

      // check after @neo fix
      await checkRewardInfo(BN('9999999999999'), BN('16534391534391535'), BN('0'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      await checkRewardInfo(BN('9999999999999'), BN('0'), BN('0'));

      // batch claim rewards
      indexerRewards = await rewardsDistributor.userRewards(indexer.address, indexer.address);
      expect(indexerRewards).to.be.equal(etherParse('9999.999999999'));

      await rewardsHelper.connect(indexer).batchClaim(indexer.address, [indexer.address]);
      const indexerBalance = await token.balanceOf(indexer.address);
      expect(indexerBalance).to.be.equal(etherParse('9999.999999999'));
      await checkRewardInfo(BN('9999999999999'), BN('0'), etherParse('9999.999999999'));

      // new agreement\
      await token.connect(root).transfer(consumer.address, etherParse('10000'));
      await token.connect(consumer).increaseAllowance(planManager.address, etherParse('10000'));
      await futureTimestamp(mockProvider, time.duration.days(2));
      await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      await checkRewardInfo(BN('9999999999999'), BN('0'), etherParse('9999.999999999'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      await checkRewardInfo(BN('19999917328041'), BN('9999917328042328042328'), etherParse('9999.999999999'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      await checkRewardInfo(BN('19999999999998'), BN('82671957671957672'), etherParse('9999.999999999'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      await checkRewardInfo(BN('19999999999998'), BN('0'), etherParse('9999.999999999'));

      indexerRewards = await rewardsDistributor.userRewards(indexer.address, indexer.address);
      expect(indexerRewards).to.be.equal(etherParse('9999.999999999'));
    });
  });

  describe.skip('Agreement cross more than 2 eras', async () => {
    beforeEach(async () => {
      [root, indexer, consumer, delegator1, delegator2] = await ethers.getSigners();
      //contract deployed start at era 1
      const deployment = await deployContracts(root, delegator2);
      indexerRegistry = deployment.indexerRegistry;
      projectRegistry = deployment.projectRegistry;
      planManager = deployment.planManager;
      staking = deployment.staking;
      stakingManager = deployment.stakingManager;
      rewardsDistributor = deployment.rewardsDistributer;

      rewardsHelper = deployment.rewardsHelper;
      eraManager = deployment.eraManager;

      // transfer SQT to accounts
      await token.connect(root).transfer(delegator1.address, etherParse('1000'));
      await token.connect(root).transfer(delegator2.address, etherParse('1000'));
      await token.connect(root).transfer(consumer.address, etherParse('10000'));
      await token.connect(consumer).increaseAllowance(planManager.address, etherParse('10000'));
      await token.connect(delegator1).increaseAllowance(staking.address, etherParse('1000'));
      await token.connect(delegator2).increaseAllowance(staking.address, etherParse('1000'));
      await token.connect(root).increaseAllowance(rewardsDistributor.address, etherParse('10000'));

      //setup era period be 7 days
      await eraManager.connect(root).updateEraPeriod(time.duration.days(7).toString());

      await registerIndexer(root, indexer, etherParse('1000'), 0);
      await projectRegistry.createProject(METADATA_HASH, VERSION, DEPLOYMENT_ID,0);
      // start indexing project
      await projectRegistry.connect(indexer).startService(DEPLOYMENT_ID);
      // create plan
      await planManager.createPlanTemplate(time.duration.days(35).toString(), 1000, 100, token.address, METADATA_HASH);
      await planManager.connect(indexer).createPlan(etherParse('10000'), 0, DEPLOYMENT_ID);
      // purchase plan
      await startNewEra(mockProvider, eraManager);
      await futureTimestamp(mockProvider, time.duration.days(4));
      await planManager.connect(consumer).acceptPlan(1, DEPLOYMENT_ID);
    });

    // FIXME: fix this test
    it.skip('should be able to distribute reward correctly without delegators', async () => {
      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // accSQTPerStake = 2*10e-12, eraReward = 2000, rewardDebt = 0
      await checkRewardInfo(BN('0'), BN('1999980158730158730158'), BN('0'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // accSQTPerStake = 4*10e-12, eraReward = 2000, rewardDebt = 0
      await checkRewardInfo(BN('3999980158730'), BN('2000000000000000000000'), BN('0'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // accSQTPerStake = 6*10e-12, eraReward = 2000, rewardDebt = 0
      await checkRewardInfo(BN('5999980158730'), BN('2000000000000000000000'), BN('0'));

      // batch claim rewards
      const indexerRewards = await rewardsDistributor.userRewards(indexer.address, indexer.address);
      await rewardsHelper.connect(indexer).batchClaim(indexer.address, [indexer.address]);
      const indexerBalance = await token.balanceOf(indexer.address);
      // claim rewards: `6000`
      expect(indexerRewards).to.be.equal(BN('5999980158730000000000'));
      expect(indexerBalance).to.be.equal(BN('580981000295794551145535'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // accSQTPerStake = 8*10e-12, eraReward = 2000, rewardDebt = 6000
      await checkRewardInfo(BN('7999980158730'), BN('2000000000000000000000'), BN('5999980158730000000000'));

      // indexer staking more
      await token.connect(root).transfer(indexer.address, etherParse('1000'));
      await token.connect(indexer).increaseAllowance(staking.address, etherParse('1000'));
      await stakingManager.connect(indexer).stake(indexer.address, etherParse('1000'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // accSQTPerStake = 10*10e-12, eraReward = 2000, rewardDebt = 6000
      const { accSQTPerStake, eraReward, rewardDebt } = await checkRewardInfo(BN('9999980158730'), BN('2000000000000000000000'), BN('5999980158730000000000'));
      console.log('accSQTPerStake:', accSQTPerStake.toString());
      console.log('eraReward:', eraReward.toString());
      console.log('rewardDebt:', rewardDebt.toString());
    });

    // FIXME:  fix this test
    it.skip('should be able to distribute reward correctly with delegators', async () => {
      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // accSQTPerStake = 2*10e-12, eraReward = 2000, rewardDebt = 0
      await checkRewardInfo(BN('1999980158730'), BN('1999980158730158730158'), BN('0'));

      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // accSQTPerStake = 4*10e-12, eraReward = 2000, rewardDebt = 0
      await checkRewardInfo(BN('3999980158730'), BN('2000000000000000000000'), BN('0'));

      let indexerBalance = await token.balanceOf(indexer.address);
      expect(indexerBalance).to.be.equal(BN('0'));

      // batch claim rewards
      let indexerRewards = await rewardsDistributor.userRewards(indexer.address, indexer.address);
      await rewardsHelper.connect(indexer).batchClaim(indexer.address, [indexer.address]);

      indexerBalance = await token.balanceOf(indexer.address);
      expect(indexerBalance).to.be.equal(BN('3999980158730000000000'));

      // add delegator 
      await token.connect(delegator1).increaseAllowance(staking.address, etherParse('1000'));
      await stakingManager.connect(delegator1).delegate(indexer.address, etherParse('1000'));

      await startNewEra(mockProvider, eraManager);
      await rewardsHelper.indexerCatchup(indexer.address);
      await collectRewards();
      // accSQTPerStake = 2*10e-12, eraReward = 2000, rewardDebt = 4000
      await checkRewardInfo(BN('5999980158730'), BN('2000000000000000000000'), BN('3999980158730000000000'), indexer.address);
      await checkRewardInfo(BN('5999980158730'), BN('2000000000000000000000'), BN('5999980158730000000000'), delegator1.address);

      indexerRewards = await rewardsDistributor.userRewards(indexer.address, indexer.address);
      let delegatorRewards = await rewardsDistributor.userRewards(indexer.address, delegator1.address);

      expect(indexerRewards).to.be.equal(BN('2000000000000000000000'));
      expect(delegatorRewards).to.be.equal(BN('0'));


      await startNewEra(mockProvider, eraManager);
      await collectRewards();
      // accSQTPerStake = 7*10e-12, eraReward = 2000, rewardDebt = 0
      await checkRewardInfo(BN('6999980158730'), BN('2000000000000000000000'), BN('3999980158730000000000'), indexer.address);
      await checkRewardInfo(BN('6999980158730'), BN('2000000000000000000000'), BN('5999980158730000000000'), delegator1.address);

      indexerRewards = await rewardsDistributor.userRewards(indexer.address, indexer.address);
      delegatorRewards = await rewardsDistributor.userRewards(indexer.address, delegator1.address);

      expect(indexerRewards).to.be.equal(BN('3000000000000000000000'));
      expect(delegatorRewards).to.be.equal(BN('1000000000000000000000'));

      // claim
      await rewardsDistributor.connect(indexer).claimFrom(indexer.address, indexer.address);
      await rewardsDistributor.connect(delegator1).claimFrom(indexer.address, delegator1.address);

      indexerBalance = await token.balanceOf(indexer.address);
      expect(indexerBalance).to.be.equal(BN('6999980158730000000000'));

      const delegatorBalance = await token.balanceOf(delegator1.address);
      expect(delegatorBalance).to.be.equal(BN('1000000000000000000000'));
    });
  });
});
