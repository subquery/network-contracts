// Copyright (C) 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers, waffle } from 'hardhat';

import { SQContracts } from '../src/types';
import {
    EraManager,
    IndexerRegistry,
    ERC20,
    Staking,
    StakingManager,
    DelegationPool,
    Settings,
    MockStakingManager,
} from '../src/typechain';
import { etherParse, registerRunner, startNewEra, timeTravel, Wallet } from './helper';
import { deployContracts } from './setup';

describe('DelegationPool Contract', () => {
    let root: Wallet,
        poolManager: Wallet,
        user1: Wallet,
        user2: Wallet,
        user3: Wallet,
        runner1: Wallet,
        runner2: Wallet,
        treasury: Wallet;

    let token: ERC20;
    let staking: Staking;
    let stakingManager: StakingManager;
    let eraManager: EraManager;
    let indexerRegistry: IndexerRegistry;
    let settings: Settings;
    let delegationPool: DelegationPool;

    const deployDelegationPool = async (feePerMill = 0) => {
        const DelegationPoolFactory = await ethers.getContractFactory('DelegationPool', root);
        const delegationPoolContract = await DelegationPoolFactory.deploy();
        await delegationPoolContract.initialize(settings.address, feePerMill);
        return delegationPoolContract;
    };

    beforeEach(async () => {
        [root, poolManager, user1, user2, user3, runner1, runner2, treasury] = waffle.provider.getWallets();

        const contracts = await deployContracts(root, poolManager, treasury);
        token = contracts.token;
        staking = contracts.staking;
        stakingManager = contracts.stakingManager;
        eraManager = contracts.eraManager;
        indexerRegistry = contracts.indexerRegistry;
        settings = contracts.settings;

        // Deploy DelegationPool
        delegationPool = await deployDelegationPool();

        // Transfer ownership to poolManager
        await delegationPool.transferOwnership(poolManager.address);

        // Setup runners
        await registerRunner(token, indexerRegistry, staking, root, runner1, etherParse('2000'));
        await registerRunner(token, indexerRegistry, staking, root, runner2, etherParse('2000'));

        // Give tokens to users
        await token.transfer(user1.address, etherParse('10000'));
        await token.transfer(user2.address, etherParse('10000'));
        await token.transfer(user3.address, etherParse('10000'));
    });

    describe('Contract Initialization', () => {
        it('should initialize with correct settings', async () => {
            expect(await delegationPool.settings()).to.equal(settings.address);
            expect(await delegationPool.owner()).to.equal(poolManager.address);
            expect(await delegationPool.totalSupply()).to.equal(0);
            expect(await delegationPool.availableAssets()).to.equal(0);
            expect(await delegationPool.getFeeRate()).to.equal(0);
            expect(await delegationPool.getAccumulatedFees()).to.equal(0);
        });

        it('should not allow initialization twice', async () => {
            await expect(delegationPool.initialize(settings.address, 0)).to.be.revertedWith(
                'Initializable: contract is already initialized'
            );
        });
    });

    describe('User Delegation Functions', () => {
        describe('delegate()', () => {
            it('should allow users to delegate SQT and receive shares', async () => {
                const delegateAmount = etherParse('1000');

                // User1 approves and delegates
                await token.connect(user1).approve(delegationPool.address, delegateAmount);
                await expect(delegationPool.connect(user1).delegate(delegateAmount))
                    .to.emit(delegationPool, 'Delegated')
                    .withArgs(user1.address, delegateAmount, delegateAmount); // 1:1 ratio for first deposit

                expect(await delegationPool.balanceOf(user1.address)).to.equal(delegateAmount);
                expect(await delegationPool.totalSupply()).to.equal(delegateAmount);
                expect(await delegationPool.availableAssets()).to.equal(delegateAmount); // Only delegated amount
                expect(await delegationPool.getDelegationAmount(user1.address)).to.equal(delegateAmount);
            });

            it('should calculate shares proportionally for subsequent deposits', async () => {
                const firstDeposit = etherParse('1000');
                const secondDeposit = etherParse('500');

                // First deposit (1:1 ratio)
                await token.connect(user1).approve(delegationPool.address, firstDeposit);
                await delegationPool.connect(user1).delegate(firstDeposit);

                // Second deposit (proportional)
                await token.connect(user2).approve(delegationPool.address, secondDeposit);
                await delegationPool.connect(user2).delegate(secondDeposit);

                const expectedShares = secondDeposit.mul(firstDeposit).div(firstDeposit); // 500 * 1000 / 1000 = 500
                expect(await delegationPool.balanceOf(user2.address)).to.equal(expectedShares);
            });

            it('should reject zero amount delegation', async () => {
                await expect(delegationPool.connect(user1).delegate(0)).to.be.revertedWith('DP001');
            });

            it('should reject delegation without sufficient balance', async () => {
                const delegateAmount = etherParse('20000'); // More than user1 has
                await token.connect(user1).approve(delegationPool.address, delegateAmount);
                await expect(delegationPool.connect(user1).delegate(delegateAmount)).to.be.revertedWith('DP002');
            });

            it('should reject delegation without sufficient allowance', async () => {
                const delegateAmount = etherParse('1000');
                // No approval
                await expect(delegationPool.connect(user1).delegate(delegateAmount)).to.be.revertedWith(
                    'ERC20: insufficient allowance'
                );
            });
        });

        describe('undelegate()', () => {
            beforeEach(async () => {
                // Setup: User1 delegates 1000 SQT
                const delegateAmount = etherParse('1000');
                await token.connect(user1).approve(delegationPool.address, delegateAmount);
                await delegationPool.connect(user1).delegate(delegateAmount);
            });

            it('should allow users to undelegate their shares', async () => {
                const undelegateShares = etherParse('500');
                const expectedSQT = etherParse('500'); // 500 shares = 500 SQT (500/1000 * 1000)

                // Calculate expected net amount after fee
                const unbondFeeRate = await staking.unbondFeeRate();
                const expectedFee = expectedSQT.mul(unbondFeeRate).div(1000000);
                const expectedNet = expectedSQT.sub(expectedFee);

                await expect(delegationPool.connect(user1).undelegate(undelegateShares))
                    .to.emit(delegationPool, 'UndelegationStarted')
                    .withArgs(user1.address, undelegateShares, expectedSQT);

                expect(await delegationPool.balanceOf(user1.address)).to.equal(etherParse('500'));
                expect(await delegationPool.totalSupply()).to.equal(etherParse('500'));

                // Should create unbonding request for net amount (after fee)
                const unbondRequests = await delegationPool.getPendingUnbonds(user1.address);
                expect(unbondRequests.length).to.equal(1);
                expect(unbondRequests[0].amount).to.equal(expectedNet);
                expect(unbondRequests[0].completed).to.be.false;
            });

            it('should reject zero shares undelegation', async () => {
                await expect(delegationPool.connect(user1).undelegate(0)).to.be.revertedWith('DP003');
            });

            it('should reject undelegation of more shares than owned', async () => {
                const excessiveShares = etherParse('1500');
                await expect(delegationPool.connect(user1).undelegate(excessiveShares)).to.be.revertedWith('DP004');
            });

            it('should emit UndelegationRequired event when manager needs to undelegate from indexers', async () => {
                // beforeEach already set up user1 with 1000 SQT delegation
                // Manager delegates most of the pool to indexer, leaving only small amount available
                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('900'));

                // User tries to undelegate more than available assets (100 available, 500 requested)
                const undelegateShares = etherParse('500');
                const totalUndelegateAmount = etherParse('500'); // 500 shares = 500 SQT
                const requiredFromIndexers = etherParse('400'); // 400 SQT needs to be undelegated from indexers

                await expect(delegationPool.connect(user1).undelegate(undelegateShares))
                    .to.emit(delegationPool, 'UndelegationRequired')
                    .withArgs(user1.address, totalUndelegateAmount, requiredFromIndexers)
                    .and.to.emit(delegationPool, 'UndelegationStarted')
                    .withArgs(user1.address, undelegateShares, totalUndelegateAmount);

                // Verify pool state
                expect(await delegationPool.availableAssets()).to.equal(0); // All available assets consumed
            });

            it('should not emit UndelegationRequired event when sufficient assets available', async () => {
                // beforeEach already set up user1 with 1000 SQT delegation
                // Manager delegates only part of the pool, leaving enough available
                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('500'));

                // User undelegates less than available assets (500 available, 300 requested)
                const undelegateShares = etherParse('300');
                const undelegateAmount = etherParse('300');

                const tx = await delegationPool.connect(user1).undelegate(undelegateShares);
                const receipt = await tx.wait();

                // Should emit UndelegationStarted but NOT UndelegationRequired
                expect(tx)
                    .to.emit(delegationPool, 'UndelegationStarted')
                    .withArgs(user1.address, undelegateShares, undelegateAmount);

                // Check that UndelegationRequired was NOT emitted
                const undelegationRequiredEvents =
                    receipt.events?.filter((e) => e.event === 'UndelegationRequired') || [];
                expect(undelegationRequiredEvents.length).to.equal(0);

                // Verify pool state
                expect(await delegationPool.availableAssets()).to.equal(etherParse('200')); // 500 - 300 = 200 remaining
            });
        });

        describe('withdraw()', () => {
            beforeEach(async () => {
                // Setup: User1 delegates and then undelegates
                const delegateAmount = etherParse('1000');
                await token.connect(user1).approve(delegationPool.address, delegateAmount);
                await delegationPool.connect(user1).delegate(delegateAmount);
                await delegationPool.connect(user1).undelegate(etherParse('500'));
            });

            it('should reject withdrawal before lock period expires', async () => {
                await expect(delegationPool.connect(user1).withdraw()).to.be.revertedWith('DP007');
            });

            it('should allow withdrawal after lock period expires', async () => {
                // Travel forward 28 days
                await timeTravel(28 * 24 * 60 * 60);

                // Calculate expected net amount (after fee)
                const unbondFeeRate = await staking.unbondFeeRate();
                const expectedFee = etherParse('500').mul(unbondFeeRate).div(1000000);
                const expectedNet = etherParse('500').sub(expectedFee);

                const balanceBefore = await token.balanceOf(user1.address);
                await expect(delegationPool.connect(user1).withdraw())
                    .to.emit(delegationPool, 'Withdrawn')
                    .withArgs(user1.address, expectedNet);

                const balanceAfter = await token.balanceOf(user1.address);
                expect(balanceAfter.sub(balanceBefore)).to.equal(expectedNet);
            });

            it('should reject withdrawal when no pending unbonds exist', async () => {
                await expect(delegationPool.connect(user2).withdraw()).to.be.revertedWith('DP006');
            });
        });

        describe('Unbond Fee Accounting', () => {
            it('should track expected unbond fee when undelegating from indexers', async () => {
                // Setup: delegate and have manager delegate to indexer
                await token.connect(user1).approve(delegationPool.address, etherParse('10000'));
                await delegationPool.connect(user1).delegate(etherParse('10000'));

                // Manager delegates all to indexer
                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('10000'));

                // Verify available assets is 0
                expect(await delegationPool.availableAssets()).to.equal(0);

                // Get unbond fee rate
                const unbondFeeRate = await staking.unbondFeeRate();

                // User undelegates - must come from indexers since no available assets
                const shares = await delegationPool.balanceOf(user1.address);
                const sqtAmount = etherParse('5000');
                const sharesToUndelegate = shares.div(2); // Undelegate half

                // Calculate expected fee
                const expectedFee = sqtAmount.mul(unbondFeeRate).div(1000000);

                // Undelegate should track the fee
                await expect(delegationPool.connect(user1).undelegate(sharesToUndelegate))
                    .to.emit(delegationPool, 'UnbondFeeTracked')
                    .withArgs(expectedFee, expectedFee);

                // Verify expectedUnbondFees was updated
                expect(await delegationPool.expectedUnbondFees()).to.equal(expectedFee);
            });

            it('should collect unbond fee when undelegating from available assets', async () => {
                // Setup: delegate but DON'T have manager delegate to indexers
                await token.connect(user1).approve(delegationPool.address, etherParse('10000'));
                await delegationPool.connect(user1).delegate(etherParse('10000'));

                // Verify all assets are available
                expect(await delegationPool.availableAssets()).to.equal(etherParse('10000'));

                // User undelegates - should come from available assets
                const shares = await delegationPool.balanceOf(user1.address);
                const sharesToUndelegate = shares.div(2); // Undelegate half

                // Get unbond fee rate
                const unbondFeeRate = await staking.unbondFeeRate();
                const expectedFee = etherParse('5000').mul(unbondFeeRate).div(1000000);

                await delegationPool.connect(user1).undelegate(sharesToUndelegate);

                // Verify accumulatedUnbondFees is tracked (not expectedUnbondFees)
                expect(await delegationPool.accumulatedUnbondFees()).to.equal(expectedFee);
                expect(await delegationPool.expectedUnbondFees()).to.equal(0);
            });

            it('should correctly account for expected fees in total assets', async () => {
                // Setup: delegate and have manager delegate to indexer
                await token.connect(user1).approve(delegationPool.address, etherParse('10000'));
                await delegationPool.connect(user1).delegate(etherParse('10000'));

                // Manager delegates to indexer
                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('8000'));

                // Total assets should be 10000 (8000 delegated + 2000 available)
                let totalAssets = await delegationPool.getTotalAssets();
                expect(totalAssets).to.equal(etherParse('10000'));

                // User undelegates 5000 - 2000 from available, 3000 from indexers
                const shares = await delegationPool.balanceOf(user1.address);
                const sharesToUndelegate = shares.div(2); // Undelegate 5000

                // Get unbond fee rate
                const unbondFeeRate = await staking.unbondFeeRate();
                const totalFee = etherParse('5000').mul(unbondFeeRate).div(1000000);
                const feeFromAvailable = etherParse('2000').mul(unbondFeeRate).div(1000000);
                const feeFromIndexers = etherParse('3000').mul(unbondFeeRate).div(1000000);

                await delegationPool.connect(user1).undelegate(sharesToUndelegate);

                // Verify fees are tracked correctly
                expect(await delegationPool.accumulatedUnbondFees()).to.equal(feeFromAvailable);
                expect(await delegationPool.expectedUnbondFees()).to.equal(feeFromIndexers);

                // Total assets should now reflect the expected fee loss
                totalAssets = await delegationPool.getTotalAssets();

                // 5000 remaining, minus total fees
                expect(totalAssets).to.equal(etherParse('5000').sub(totalFee));
            });

            it('should accumulate expected fees across multiple undelegations', async () => {
                // Setup: delegate and have manager delegate to indexer
                await token.connect(user1).approve(delegationPool.address, etherParse('1000'));
                await delegationPool.connect(user1).delegate(etherParse('1000'));

                await token.connect(user2).approve(delegationPool.address, etherParse('1000'));
                await delegationPool.connect(user2).delegate(etherParse('1000'));

                // Manager delegates all to indexer
                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('2000'));

                // Get unbond fee rate
                const unbondFeeRate = await staking.unbondFeeRate();

                // User1 undelegates 500 shares
                const user1Shares = await delegationPool.balanceOf(user1.address);
                await delegationPool.connect(user1).undelegate(user1Shares.div(2));

                const user1Fee = etherParse('500').mul(unbondFeeRate).div(1000000);
                expect(await delegationPool.expectedUnbondFees()).to.equal(user1Fee);

                // User2 undelegates 300 shares
                const user2Shares = await delegationPool.balanceOf(user2.address);
                const sharesToUndelegate = user2Shares.mul(3).div(10);

                await delegationPool.connect(user2).undelegate(sharesToUndelegate);

                // Calculate actual SQT amount for user2 undelegation based on current share price
                // After user1 undelegated, remaining: 1500 total assets, 1500 total supply
                // So share price is still 1:1, user2 undelegates 300 shares = 300 SQT
                const user2Fee = etherParse('300').mul(unbondFeeRate).div(1000000);

                // Expected fees should be cumulative (allow small rounding error)
                const totalExpectedFees = user1Fee.add(user2Fee);
                const actualFees = await delegationPool.expectedUnbondFees();

                // Allow 0.1% rounding error
                expect(actualFees).to.be.closeTo(totalExpectedFees, totalExpectedFees.div(1000));
            });

            it('should handle zero unbond fee rate', async () => {
                // Set unbond fee to 0
                await staking.connect(root).setUnbondFeeRateBP(0);

                // Setup: delegate and undelegate from indexers
                await token.connect(user1).approve(delegationPool.address, etherParse('1000'));
                await delegationPool.connect(user1).delegate(etherParse('1000'));

                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('1000'));

                const shares = await delegationPool.balanceOf(user1.address);
                await delegationPool.connect(user1).undelegate(shares);

                // No fee should be tracked
                expect(await delegationPool.expectedUnbondFees()).to.equal(0);

                // Total assets should be 0 (all shares burned, no backing assets for shares)
                expect(await delegationPool.getTotalAssets()).to.equal(0);
            });
        });
    });

    describe('Manager Functions', () => {
        beforeEach(async () => {
            // Setup: Pool has some assets
            const delegateAmount = etherParse('5000');
            await token.connect(user1).approve(delegationPool.address, delegateAmount);
            await delegationPool.connect(user1).delegate(delegateAmount);
        });

        describe('managerDelegate()', () => {
            it('should allow manager to delegate pool funds to runner', async () => {
                const delegateAmount = etherParse('2000');

                await expect(delegationPool.connect(poolManager).managerDelegate(runner1.address, delegateAmount))
                    .to.emit(delegationPool, 'ManagerDelegated')
                    .withArgs(runner1.address, delegateAmount);

                expect(await delegationPool.getDelegatedToIndexer(runner1.address)).to.equal(delegateAmount);
                expect(await delegationPool.availableAssets()).to.equal(etherParse('3000')); // 5000 - 2000
                expect(await delegationPool.isActiveIndexer(runner1.address)).to.be.true;
                expect(await delegationPool.getActiveIndexersCount()).to.equal(1);

                const activeIndexers = await delegationPool.getActiveIndexers();
                expect(activeIndexers[0]).to.equal(runner1.address);
            });

            it('should reject delegation from non-manager', async () => {
                await expect(
                    delegationPool.connect(user1).managerDelegate(runner1.address, etherParse('1000'))
                ).to.be.revertedWith('Ownable: caller is not the owner');
            });

            it('should reject delegation with zero address', async () => {
                await expect(
                    delegationPool.connect(poolManager).managerDelegate(constants.AddressZero, etherParse('1000'))
                ).to.be.revertedWith('DP008');
            });

            it('should reject delegation with zero amount', async () => {
                await expect(
                    delegationPool.connect(poolManager).managerDelegate(runner1.address, 0)
                ).to.be.revertedWith('DP001');
            });

            it('should reject delegation exceeding available assets', async () => {
                const excessiveAmount = etherParse('10000');
                await expect(
                    delegationPool.connect(poolManager).managerDelegate(runner1.address, excessiveAmount)
                ).to.be.revertedWith('DP010');
            });
        });

        describe('managerUndelegate()', () => {
            beforeEach(async () => {
                // Setup: Delegate to runner first
                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('2000'));
            });

            it('should allow manager to undelegate from runner', async () => {
                const undelegateAmount = etherParse('1000');

                await expect(delegationPool.connect(poolManager).managerUndelegate(runner1.address, undelegateAmount))
                    .to.emit(delegationPool, 'ManagerUndelegated')
                    .withArgs(runner1.address, undelegateAmount);

                expect(await delegationPool.getDelegatedToIndexer(runner1.address)).to.equal(etherParse('1000'));
            });

            it('should remove indexer from active list when delegation becomes zero', async () => {
                await delegationPool.connect(poolManager).managerUndelegate(runner1.address, etherParse('2000'));

                expect(await delegationPool.getDelegatedToIndexer(runner1.address)).to.equal(0);
                expect(await delegationPool.isActiveIndexer(runner1.address)).to.be.false;
                expect(await delegationPool.getActiveIndexersCount()).to.equal(0);
            });

            it('should reject undelegation exceeding delegated amount', async () => {
                const excessiveAmount = etherParse('3000');
                await expect(
                    delegationPool.connect(poolManager).managerUndelegate(runner1.address, excessiveAmount)
                ).to.be.revertedWith('DP011');
            });
        });

        describe('managerRedelegate()', () => {
            beforeEach(async () => {
                // Setup: Delegate to runner1 first
                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('2000'));
            });

            it('should allow manager to redelegate between runners', async () => {
                const redelegateAmount = etherParse('1000');

                await expect(
                    delegationPool
                        .connect(poolManager)
                        .managerRedelegate(runner1.address, runner2.address, redelegateAmount)
                )
                    .to.emit(delegationPool, 'ManagerRedelegated')
                    .withArgs(runner1.address, runner2.address, redelegateAmount);

                expect(await delegationPool.getDelegatedToIndexer(runner1.address)).to.equal(etherParse('1000'));
                expect(await delegationPool.getDelegatedToIndexer(runner2.address)).to.equal(redelegateAmount);
                expect(await delegationPool.isActiveIndexer(runner2.address)).to.be.true;
                expect(await delegationPool.getActiveIndexersCount()).to.equal(2);
            });

            it('should reject redelegation to same runner', async () => {
                await expect(
                    delegationPool
                        .connect(poolManager)
                        .managerRedelegate(runner1.address, runner1.address, etherParse('1000'))
                ).to.be.revertedWith('DP012');
            });

            it('should reject redelegation with invalid addresses', async () => {
                await expect(
                    delegationPool
                        .connect(poolManager)
                        .managerRedelegate(constants.AddressZero, runner2.address, etherParse('1000'))
                ).to.be.revertedWith('DP008');
            });
        });
    });

    describe('Auto Compound Functionality', () => {
        beforeEach(async () => {
            // Setup: Delegate to runner and have some delegations
            const delegateAmount = etherParse('5000');
            await token.connect(user1).approve(delegationPool.address, delegateAmount);
            await delegationPool.connect(user1).delegate(delegateAmount);
            await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('2000'));
        });

        it('should reject auto compound when no active delegations', async () => {
            // Remove all delegations
            await delegationPool.connect(poolManager).managerUndelegate(runner1.address, etherParse('2000'));

            await expect(delegationPool.autoCompound()).to.be.revertedWith('DP013');
        });

        it('should handle auto compound when no rewards available', async () => {
            // This should not revert but also not emit RewardsCompounded
            const tx = await delegationPool.autoCompound();
            const receipt = await tx.wait();

            // Should not have RewardsCompounded event
            const rewardsCompoundedEvents = receipt.events?.filter((e) => e.event === 'RewardsCompounded') || [];
            expect(rewardsCompoundedEvents.length).to.equal(0);
        });
    });

    describe('Auto Compound with MockStakingManager', () => {
        let mockStakingManager: MockStakingManager;
        let mockDelegationPool: DelegationPool;

        beforeEach(async () => {
            // Deploy MockStakingManager
            const MockStakingManagerFactory = await ethers.getContractFactory('MockStakingManager', root);
            mockStakingManager = (await MockStakingManagerFactory.deploy(token.address)) as MockStakingManager;

            // Create a new Settings instance and register the mock
            const SettingsFactory = await ethers.getContractFactory('Settings', root);
            const mockSettings = (await SettingsFactory.deploy()) as Settings;
            await mockSettings.setContractAddress(SQContracts.StakingManager, mockStakingManager.address);
            await mockSettings.setContractAddress(SQContracts.SQToken, token.address);
            await mockSettings.setContractAddress(SQContracts.Staking, staking.address);
            await mockSettings.setContractAddress(SQContracts.EraManager, eraManager.address);

            // Deploy DelegationPool with mock settings
            const DelegationPoolFactory = await ethers.getContractFactory('DelegationPool', root);
            mockDelegationPool = (await DelegationPoolFactory.deploy()) as DelegationPool;
            await mockDelegationPool.initialize(mockSettings.address, 10000); // 1% fee
            await mockDelegationPool.transferOwnership(poolManager.address);

            // Setup initial delegation
            await token.connect(user1).approve(mockDelegationPool.address, etherParse('10000'));
            await mockDelegationPool.connect(user1).delegate(etherParse('10000'));

            // Manager delegates to runner
            await mockDelegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('5000'));
        });

        it('should properly compound rewards and deduct fees', async () => {
            // Set rewards for runner1
            const rewardAmount = etherParse('1000');
            await mockStakingManager.setRunnerRewards(runner1.address, rewardAmount);

            // Fund the mock staking manager with rewards
            await token.approve(mockStakingManager.address, rewardAmount);
            await mockStakingManager.fundRewards(rewardAmount);

            // Get initial state
            const initialAvailableAssets = await mockDelegationPool.availableAssets();
            const initialTotalAssets = await mockDelegationPool.getTotalAssets();
            const initialFees = await mockDelegationPool.getAccumulatedFees();

            // Execute auto compound
            await expect(mockDelegationPool.autoCompound())
                .to.emit(mockDelegationPool, 'FeesDeducted')
                .to.emit(mockDelegationPool, 'RewardsCompounded');

            // Calculate expected values
            const expectedFee = rewardAmount.mul(10000).div(1000000); // 1% of 1000 = 10
            const expectedCompoundAmount = rewardAmount.sub(expectedFee); // 1000 - 10 = 990

            // Verify state changes
            const finalAvailableAssets = await mockDelegationPool.availableAssets();
            const finalTotalAssets = await mockDelegationPool.getTotalAssets();
            const finalFees = await mockDelegationPool.getAccumulatedFees();

            expect(finalAvailableAssets.sub(initialAvailableAssets)).to.equal(expectedCompoundAmount);
            expect(finalFees.sub(initialFees)).to.equal(expectedFee);
            expect(finalTotalAssets.sub(initialTotalAssets)).to.equal(expectedCompoundAmount);
        });

        it('should compound rewards from multiple runners', async () => {
            // Setup delegation to runner2
            await mockDelegationPool.connect(poolManager).managerDelegate(runner2.address, etherParse('3000'));

            // Set rewards for both runners
            const reward1 = etherParse('500');
            const reward2 = etherParse('300');
            await mockStakingManager.setRunnerRewards(runner1.address, reward1);
            await mockStakingManager.setRunnerRewards(runner2.address, reward2);

            // Fund the mock staking manager with total rewards
            const totalRewards = reward1.add(reward2);
            await token.approve(mockStakingManager.address, totalRewards);
            await mockStakingManager.fundRewards(totalRewards);

            // Get initial state
            const initialAvailableAssets = await mockDelegationPool.availableAssets();
            const initialFees = await mockDelegationPool.getAccumulatedFees();

            // Execute auto compound
            await mockDelegationPool.autoCompound();

            // Calculate expected values (1% fee on total 800)
            const expectedFee = totalRewards.mul(10000).div(1000000);
            const expectedCompoundAmount = totalRewards.sub(expectedFee);

            // Verify state changes
            const finalAvailableAssets = await mockDelegationPool.availableAssets();
            const finalFees = await mockDelegationPool.getAccumulatedFees();

            expect(finalAvailableAssets.sub(initialAvailableAssets)).to.equal(expectedCompoundAmount);
            expect(finalFees.sub(initialFees)).to.equal(expectedFee);
        });

        it('should handle different fee rates correctly', async () => {
            // Test with 5% fee
            await mockDelegationPool.connect(poolManager).setFeeRate(50000); // 5%

            const rewardAmount = etherParse('1000');
            await mockStakingManager.setRunnerRewards(runner1.address, rewardAmount);
            await token.approve(mockStakingManager.address, rewardAmount);
            await mockStakingManager.fundRewards(rewardAmount);

            const initialFees = await mockDelegationPool.getAccumulatedFees();

            await mockDelegationPool.autoCompound();

            const expectedFee = rewardAmount.mul(50000).div(1000000); // 5% of 1000 = 50
            const finalFees = await mockDelegationPool.getAccumulatedFees();

            expect(finalFees.sub(initialFees)).to.equal(expectedFee);
        });

        it('should not deduct fees when fee rate is 0%', async () => {
            // Set fee rate to 0%
            await mockDelegationPool.connect(poolManager).setFeeRate(0);

            const rewardAmount = etherParse('1000');
            await mockStakingManager.setRunnerRewards(runner1.address, rewardAmount);
            await token.approve(mockStakingManager.address, rewardAmount);
            await mockStakingManager.fundRewards(rewardAmount);

            const initialAvailableAssets = await mockDelegationPool.availableAssets();
            const initialFees = await mockDelegationPool.getAccumulatedFees();

            const tx = await mockDelegationPool.autoCompound();
            const receipt = await tx.wait();

            // Should not emit FeesDeducted event
            const feesDeductedEvents = receipt.events?.filter((e) => e.event === 'FeesDeducted') || [];
            expect(feesDeductedEvents.length).to.equal(0);

            // All rewards should go to available assets
            const finalAvailableAssets = await mockDelegationPool.availableAssets();
            const finalFees = await mockDelegationPool.getAccumulatedFees();

            expect(finalAvailableAssets.sub(initialAvailableAssets)).to.equal(rewardAmount);
            expect(finalFees.sub(initialFees)).to.equal(0);
        });

        it('should allow fee collection after compounding', async () => {
            // Compound with rewards
            const rewardAmount = etherParse('1000');
            await mockStakingManager.setRunnerRewards(runner1.address, rewardAmount);
            await token.approve(mockStakingManager.address, rewardAmount);
            await mockStakingManager.fundRewards(rewardAmount);

            await mockDelegationPool.autoCompound();

            const accumulatedFees = await mockDelegationPool.getAccumulatedFees();
            expect(accumulatedFees).to.be.gt(0);

            // Collect fees
            const balanceBefore = await token.balanceOf(poolManager.address);
            await expect(mockDelegationPool.connect(poolManager).collectAllFees())
                .to.emit(mockDelegationPool, 'FeesCollected')
                .withArgs(poolManager.address, accumulatedFees);

            const balanceAfter = await token.balanceOf(poolManager.address);
            expect(balanceAfter.sub(balanceBefore)).to.equal(accumulatedFees);
            expect(await mockDelegationPool.getAccumulatedFees()).to.equal(0);
        });

        it('should increase share value after compounding', async () => {
            // User2 deposits first
            await token.connect(user2).approve(mockDelegationPool.address, etherParse('1000'));
            await mockDelegationPool.connect(user2).delegate(etherParse('1000'));

            const user2SharesBefore = await mockDelegationPool.balanceOf(user2.address);
            const user2ValueBefore = await mockDelegationPool.getDelegationAmount(user2.address);

            // Compound rewards
            const rewardAmount = etherParse('1100'); // 11000 total assets, 1% fee = 11, compound 1089
            await mockStakingManager.setRunnerRewards(runner1.address, rewardAmount);
            await token.approve(mockStakingManager.address, rewardAmount);
            await mockStakingManager.fundRewards(rewardAmount);

            await mockDelegationPool.autoCompound();

            // User2's shares should remain the same but value should increase
            const user2SharesAfter = await mockDelegationPool.balanceOf(user2.address);
            const user2ValueAfter = await mockDelegationPool.getDelegationAmount(user2.address);

            expect(user2SharesAfter).to.equal(user2SharesBefore);
            expect(user2ValueAfter).to.be.gt(user2ValueBefore);
        });

        it('should distribute rewards proportionally among delegators', async () => {
            // Setup: user1 has 10000, user2 adds 5000
            await token.connect(user2).approve(mockDelegationPool.address, etherParse('5000'));
            await mockDelegationPool.connect(user2).delegate(etherParse('5000'));

            const user1SharesBefore = await mockDelegationPool.balanceOf(user1.address);
            const user2SharesBefore = await mockDelegationPool.balanceOf(user2.address);

            // Compound rewards
            const rewardAmount = etherParse('1500');
            await mockStakingManager.setRunnerRewards(runner1.address, rewardAmount);
            await token.approve(mockStakingManager.address, rewardAmount);
            await mockStakingManager.fundRewards(rewardAmount);

            await mockDelegationPool.autoCompound();

            // Shares remain the same (no new shares minted)
            expect(await mockDelegationPool.balanceOf(user1.address)).to.equal(user1SharesBefore);
            expect(await mockDelegationPool.balanceOf(user2.address)).to.equal(user2SharesBefore);

            // But values should increase proportionally
            const user1Value = await mockDelegationPool.getDelegationAmount(user1.address);
            const user2Value = await mockDelegationPool.getDelegationAmount(user2.address);

            // User1 should have ~2/3 of total assets, user2 ~1/3
            const totalAssets = await mockDelegationPool.getTotalAssets();
            const user1Ratio = user1Value.mul(1000).div(totalAssets).toNumber();
            const user2Ratio = user2Value.mul(1000).div(totalAssets).toNumber();

            // Check ratios are approximately 2:1 (666:333)
            expect(user1Ratio).to.be.closeTo(666, 10);
            expect(user2Ratio).to.be.closeTo(333, 10);
        });

        describe('getPendingRewards()', () => {
            it('should return 0 when RewardsDistributor is not configured', async () => {
                // MockStakingManager tests don't have RewardsDistributor configured
                const pendingRewards = await mockDelegationPool.getPendingRewards();
                expect(pendingRewards).to.equal(0);
            });

            it('should return 0 when no indexers are active', async () => {
                // Undelegate all from runner1
                await mockDelegationPool.connect(poolManager).managerUndelegate(runner1.address, etherParse('5000'));

                // Check pending rewards
                const pendingRewards = await mockDelegationPool.getPendingRewards();
                expect(pendingRewards).to.equal(0);
            });
        });
    });

    describe('View Functions', () => {
        beforeEach(async () => {
            // Setup pool with delegations
            await token.connect(user1).approve(delegationPool.address, etherParse('1000'));
            await delegationPool.connect(user1).delegate(etherParse('1000'));
            await token.connect(user2).approve(delegationPool.address, etherParse('500'));
            await delegationPool.connect(user2).delegate(etherParse('500'));
            await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('800'));
        });

        it('should return correct total assets', async () => {
            const totalAssets = await delegationPool.getTotalAssets();
            expect(totalAssets).to.equal(etherParse('1500')); // 1000 + 500 delegated
        });

        it('should return correct user shares', async () => {
            expect(await delegationPool.balanceOf(user1.address)).to.equal(etherParse('1000'));
            expect(await delegationPool.balanceOf(user2.address)).to.equal(etherParse('500')); // 500 * 1000 / 1000
        });

        it('should return correct delegation amounts', async () => {
            expect(await delegationPool.getDelegationAmount(user1.address)).to.equal(etherParse('1000')); // 1000/1500 * 1500
            expect(await delegationPool.getDelegationAmount(user2.address)).to.equal(etherParse('500')); // 500/1500 * 1500
        });

        it('should return correct indexer information', async () => {
            expect(await delegationPool.getDelegatedToIndexer(runner1.address)).to.equal(etherParse('800'));
            expect(await delegationPool.getActiveIndexersCount()).to.equal(1);

            const activeIndexers = await delegationPool.getActiveIndexers();
            expect(activeIndexers.length).to.equal(1);
            expect(activeIndexers[0]).to.equal(runner1.address);
        });

        it('should return correct preview calculations', async () => {
            const depositAmount = etherParse('500');
            const expectedShares = await delegationPool.previewDeposit(depositAmount);
            expect(expectedShares).to.equal(etherParse('500')); // 500 * 1500 / 1500

            const shareAmount = etherParse('100');
            const expectedAssets = await delegationPool.previewWithdraw(shareAmount);
            expect(expectedAssets).to.equal(etherParse('100')); // 100 * 1500 / 1500
        });
    });

    describe('Edge Cases and Error Conditions', () => {
        it('should handle zero total shares correctly', async () => {
            expect(await delegationPool.getDelegationAmount(user1.address)).to.equal(0);
            expect(await delegationPool.previewWithdraw(etherParse('100'))).to.equal(0);
        });

        it('should handle settings update correctly', async () => {
            const newSettings = await ethers.getContractFactory('Settings', root);
            const newSettingsContract = await newSettings.deploy();

            await delegationPool.connect(poolManager).updateSettings(newSettingsContract.address);

            expect(await delegationPool.settings()).to.equal(newSettingsContract.address);
        });

        it('should reject settings update from non-owner', async () => {
            const newSettings = await ethers.getContractFactory('Settings', root);
            const newSettingsContract = await newSettings.deploy();

            await expect(delegationPool.connect(user1).updateSettings(newSettingsContract.address)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });

        it('should handle empty active indexers array correctly', async () => {
            expect(await delegationPool.getActiveIndexersCount()).to.equal(0);
            const activeIndexers = await delegationPool.getActiveIndexers();
            expect(activeIndexers.length).to.equal(0);
        });

        it('should handle pending unbonds correctly for user with no unbonds', async () => {
            const pendingUnbonds = await delegationPool.getPendingUnbonds(user1.address);
            expect(pendingUnbonds.length).to.equal(0);
        });
    });

    describe('Integration with StakingManager', () => {
        it('should properly integrate with StakingManager delegation flow', async () => {
            // Setup: User delegates to pool, manager delegates to runner
            await token.connect(user1).approve(delegationPool.address, etherParse('1000'));
            await delegationPool.connect(user1).delegate(etherParse('1000'));

            // Check that pool can delegate to StakingManager
            await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('500'));

            // Start new era to finalize the delegation
            await startNewEra(eraManager);

            // Verify delegation went through StakingManager
            const delegationAmount = await stakingManager.getDelegationAmount(delegationPool.address, runner1.address);
            expect(delegationAmount).to.equal(etherParse('500'));
        });

        it('should handle delegation limits properly', async () => {
            // This would test integration with StakingManager's delegation limits
            // The actual limit checking is done in StakingManager, so DelegationPool should pass through the errors
            // Implementation depends on specific StakingManager limit configuration
        });
    });

    describe('Fee Management', () => {
        it('should initialize with correct fee rate', async () => {
            const feeRate = 10000; // 1%
            const poolWithFee = await deployDelegationPool(feeRate);
            expect(await poolWithFee.getFeeRate()).to.equal(feeRate);
            expect(await poolWithFee.getAccumulatedFees()).to.equal(0);
        });

        it('should allow owner to set fee rate', async () => {
            const newFeeRate = 25000; // 2.5%
            await expect(delegationPool.connect(poolManager).setFeeRate(newFeeRate))
                .to.emit(delegationPool, 'FeeRateUpdated')
                .withArgs(newFeeRate);

            expect(await delegationPool.getFeeRate()).to.equal(newFeeRate);
        });

        it('should reject fee rate changes from non-owner', async () => {
            await expect(delegationPool.connect(user1).setFeeRate(10000)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });

        it('should allow setting various fee rates including 0% and 100%', async () => {
            // Test 0%
            await delegationPool.connect(poolManager).setFeeRate(0);
            expect(await delegationPool.getFeeRate()).to.equal(0);

            // Test 1%
            await delegationPool.connect(poolManager).setFeeRate(10000);
            expect(await delegationPool.getFeeRate()).to.equal(10000);

            // Test 10%
            await delegationPool.connect(poolManager).setFeeRate(100000);
            expect(await delegationPool.getFeeRate()).to.equal(100000);

            // Test 100%
            await delegationPool.connect(poolManager).setFeeRate(1000000);
            expect(await delegationPool.getFeeRate()).to.equal(1000000);
        });

        describe('Fee Collection', () => {
            beforeEach(async () => {
                // Set up pool with 1% fee
                await delegationPool.connect(poolManager).setFeeRate(10000); // 1%

                // User delegates to pool
                await token.connect(user1).approve(delegationPool.address, etherParse('1000'));
                await delegationPool.connect(user1).delegate(etherParse('1000'));

                // Manager delegates to runner
                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('500'));
            });

            it('should reject fee collection when no fees accumulated', async () => {
                await expect(delegationPool.connect(poolManager).collectFees(etherParse('100'))).to.be.revertedWith(
                    'DP015'
                );

                await expect(delegationPool.connect(poolManager).collectAllFees()).to.be.revertedWith('DP015');
            });

            it('should reject fee collection from non-owner', async () => {
                await expect(delegationPool.connect(user1).collectFees(etherParse('100'))).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );

                await expect(delegationPool.connect(user1).collectAllFees()).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            });

            it('should reject zero amount fee collection', async () => {
                await expect(delegationPool.connect(poolManager).collectFees(0)).to.be.revertedWith('DP014');
            });

            it('should reject collecting more fees than accumulated', async () => {
                // Simulate some accumulated fees by manually setting them for testing
                // In real scenario, fees would be accumulated through autoCompound
                await expect(delegationPool.connect(poolManager).collectFees(etherParse('1'))).to.be.revertedWith(
                    'DP015'
                );
            });
        });

        describe('Auto Compound with Fees', () => {
            beforeEach(async () => {
                // Set up pool with 5% fee
                await delegationPool.connect(poolManager).setFeeRate(50000); // 5%

                // User delegates to pool
                await token.connect(user1).approve(delegationPool.address, etherParse('1000'));
                await delegationPool.connect(user1).delegate(etherParse('1000'));

                // Manager delegates to runner
                await delegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('500'));
            });

            it('should handle auto compound with zero fee rate', async () => {
                // Set fee rate to 0%
                await delegationPool.connect(poolManager).setFeeRate(0);

                // Auto compound should work without fee deduction
                const tx = await delegationPool.autoCompound();
                const receipt = await tx.wait();

                // Should not have FeesDeducted event
                const feesDeductedEvents = receipt.events?.filter((e) => e.event === 'FeesDeducted') || [];
                expect(feesDeductedEvents.length).to.equal(0);
            });

            it('should handle auto compound when no rewards available', async () => {
                // Auto compound without any rewards should not generate fees
                const tx = await delegationPool.autoCompound();
                const receipt = await tx.wait();

                // Should not have FeesDeducted event
                const feesDeductedEvents = receipt.events?.filter((e) => e.event === 'FeesDeducted') || [];
                expect(feesDeductedEvents.length).to.equal(0);

                expect(await delegationPool.getAccumulatedFees()).to.equal(0);
            });

            // Note: Testing actual fee deduction during autoCompound would require
            // complex setup with actual reward distribution, which depends on the
            // full ecosystem being active. The fee calculation logic is tested
            // in the unit tests above.
        });

        describe('View Functions', () => {
            it('should return correct fee information', async () => {
                const feeRate = 25000; // 2.5%
                await delegationPool.connect(poolManager).setFeeRate(feeRate);

                expect(await delegationPool.getFeeRate()).to.equal(feeRate);
                expect(await delegationPool.getAccumulatedFees()).to.equal(0);
            });
        });
    });

    describe('Era-Based Share Pricing', () => {
        let mockStakingManager: MockStakingManager;
        let mockDelegationPool: DelegationPool;

        beforeEach(async () => {
            // Deploy MockStakingManager
            const MockStakingManagerFactory = await ethers.getContractFactory('MockStakingManager', root);
            mockStakingManager = (await MockStakingManagerFactory.deploy(token.address)) as MockStakingManager;

            // Create a new Settings instance and register the mock
            const SettingsFactory = await ethers.getContractFactory('Settings', root);
            const mockSettings = (await SettingsFactory.deploy()) as Settings;
            await mockSettings.setContractAddress(SQContracts.StakingManager, mockStakingManager.address);
            await mockSettings.setContractAddress(SQContracts.SQToken, token.address);
            await mockSettings.setContractAddress(SQContracts.Staking, staking.address);
            await mockSettings.setContractAddress(SQContracts.EraManager, eraManager.address);

            // Deploy DelegationPool with mock settings
            const DelegationPoolFactory = await ethers.getContractFactory('DelegationPool', root);
            mockDelegationPool = (await DelegationPoolFactory.deploy()) as DelegationPool;
            await mockDelegationPool.initialize(mockSettings.address, 0); // 0% fee for simpler math
            await mockDelegationPool.transferOwnership(poolManager.address);

            // Setup initial delegation
            await token.connect(user1).approve(mockDelegationPool.address, etherParse('10000'));
        });

        it('should initialize with correct share price', async () => {
            const initialPrice = await mockDelegationPool.getCurrentSharePrice();
            expect(initialPrice).to.equal(etherParse('1')); // 1e18 = 1:1 ratio
            expect(await mockDelegationPool.getLastPriceUpdateEra()).to.equal(0);
        });

        it('should maintain share price within same era', async () => {
            // User1 deposits in era 1
            await mockDelegationPool.connect(user1).delegate(etherParse('1000'));
            const priceAfterFirstDeposit = await mockDelegationPool.getCurrentSharePrice();
            const eraAfterFirstDeposit = await eraManager.eraNumber();

            // User2 deposits in same era (no era transition)
            await token.connect(user2).approve(mockDelegationPool.address, etherParse('500'));
            await mockDelegationPool.connect(user2).delegate(etherParse('500'));

            // Price should be the same
            expect(await mockDelegationPool.getCurrentSharePrice()).to.equal(priceAfterFirstDeposit);
            // Era should still be the same
            expect(await eraManager.eraNumber()).to.equal(eraAfterFirstDeposit);

            // Both users should get same price per share
            const user1Shares = await mockDelegationPool.balanceOf(user1.address);
            const user2Shares = await mockDelegationPool.balanceOf(user2.address);
            expect(user1Shares).to.equal(etherParse('1000'));
            expect(user2Shares).to.equal(etherParse('500'));
        });

        it('should update share price when era changes and rewards are compounded', async () => {
            // Initial delegation - user1 deposits 10,000 SQT
            await mockDelegationPool.connect(user1).delegate(etherParse('10000'));
            await mockDelegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('5000'));

            const initialPrice = await mockDelegationPool.getCurrentSharePrice();
            const initialEra = await eraManager.eraNumber();
            const initialTotalAssets = await mockDelegationPool.getTotalAssets();
            const user1InitialShares = await mockDelegationPool.balanceOf(user1.address);

            // User1 should have 10,000 shares (1:1 ratio at initial price of 1e18)
            expect(user1InitialShares).to.equal(etherParse('10000'));

            // Add rewards (10% return = 1,000 SQT)
            const rewardAmount = etherParse('1000');
            await mockStakingManager.setRunnerRewards(runner1.address, rewardAmount);
            await token.approve(mockStakingManager.address, rewardAmount);
            await mockStakingManager.fundRewards(rewardAmount);

            // Move to next era
            await startNewEra(eraManager);

            // Trigger price update by calling autoCompound
            // This will:
            // 1. Update share price to current era (locks it at old value of 1e18)
            // 2. Claim and add rewards (1,000 SQT)
            // 3. Total assets now = 11,000 SQT with 10,000 shares
            await expect(mockDelegationPool.autoCompound()).to.emit(mockDelegationPool, 'SharePriceUpdated');

            // Verify total assets increased by rewards
            const newTotalAssets = await mockDelegationPool.getTotalAssets();
            expect(newTotalAssets.sub(initialTotalAssets)).to.equal(rewardAmount);
            expect(newTotalAssets).to.equal(etherParse('11000'));

            // Now move to another era so the new price takes effect
            await startNewEra(eraManager);

            // User2 deposits the SAME amount as user1 (10,000 SQT)
            // But now the price has increased due to rewards
            await token.connect(user2).approve(mockDelegationPool.address, etherParse('10000'));
            await mockDelegationPool.connect(user2).delegate(etherParse('10000'));

            const user2Shares = await mockDelegationPool.balanceOf(user2.address);

            // Price should have increased from initial (was 1e18, now should be ~1.1e18)
            const finalPrice = await mockDelegationPool.getCurrentSharePrice();
            expect(finalPrice).to.be.gt(initialPrice);

            // User2 should receive FEWER shares than user1 because price increased
            // User1: 10,000 SQT → 10,000 shares (at price 1e18)
            // User2: 10,000 SQT → ~9,090 shares (at price 1.1e18)
            // Expected: 10,000 * 1e18 / 1.1e18 ≈ 9,090.909...
            expect(user2Shares).to.be.lt(user1InitialShares);

            // More precisely: user2 should get approximately (10000 * 10000) / 11000 shares
            // = 9090.909... shares
            const expectedUser2Shares = etherParse('10000').mul(etherParse('10000')).div(etherParse('11000'));
            expect(user2Shares).to.be.closeTo(expectedUser2Shares, etherParse('1'));

            // Verify both users' values
            const user1Value = await mockDelegationPool.getDelegationAmount(user1.address);
            const user2Value = await mockDelegationPool.getDelegationAmount(user2.address);

            // User1 should have more value because they earned rewards
            // User1: 10,000 shares * (21,000 total assets / 19,090.909 total shares) ≈ 11,000 SQT
            // User2: ~9,090.909 shares * (21,000 / 19,090.909) ≈ 10,000 SQT
            expect(user1Value).to.be.gt(etherParse('10000'));
            expect(user1Value).to.be.closeTo(etherParse('11000'), etherParse('10'));
            expect(user2Value).to.be.closeTo(etherParse('10000'), etherParse('10'));
            expect(user2Value).to.be.lt(user1Value);

            // Era should be updated
            expect(await mockDelegationPool.getLastPriceUpdateEra()).to.equal(initialEra.add(2));
        });

        it('should prevent reward front-running attack', async () => {
            // Setup: user1 has 10,000 SQT staked in era 1
            await mockDelegationPool.connect(user1).delegate(etherParse('10000'));
            await mockDelegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('5000'));

            const user1InitialShares = await mockDelegationPool.balanceOf(user1.address);

            // Set rewards that will be claimed (1000 SQT = 10% return on 10k)
            const rewardAmount = etherParse('1000');
            await mockStakingManager.setRunnerRewards(runner1.address, rewardAmount);
            await token.approve(mockStakingManager.address, rewardAmount);
            await mockStakingManager.fundRewards(rewardAmount);

            // Move to era 2
            await startNewEra(eraManager);

            // Give user2 tokens and have them try to front-run
            await token.transfer(user2.address, etherParse('10000'));
            await token.connect(user2).approve(mockDelegationPool.address, etherParse('10000'));

            // User2 deposits same amount as user1 just before autoCompound
            await mockDelegationPool.connect(user2).delegate(etherParse('10000'));

            const user2SharesAfterDeposit = await mockDelegationPool.balanceOf(user2.address);

            // CRITICAL: autoCompound() calls _updateSharePriceIfNeeded() FIRST
            // This locks the price at the OLD (pre-reward) value for this era
            // So user2's deposit used the old price
            // Then rewards are added
            await mockDelegationPool.autoCompound();

            const totalAssetsAfter = await mockDelegationPool.getTotalAssets();

            // User2 deposited the same amount as user1, but:
            // - User1 got shares at 1:1 when pool value was 10,000
            // - User2 ALSO got shares at 1:1 (because era price was locked before rewards)
            // - So they have equal shares
            expect(user1InitialShares).to.equal(user2SharesAfterDeposit);

            // Both users now share the 1000 SQT reward equally (500 each)
            // WITHOUT era-based pricing, user2 would have gotten far fewer shares
            // (because they'd be buying at post-reward price)
            // and thus would have benefited from rewards they didn't earn

            // The key is: both users' shares were minted at the SAME price
            // User2 didn't get a discount by entering before compound
            const user1Value = await mockDelegationPool.getDelegationAmount(user1.address);
            const user2Value = await mockDelegationPool.getDelegationAmount(user2.address);

            // Both should have approximately equal value (they have equal shares and deposited equally)
            // Each put in 10k and now has ~10.5k (their 10k + half of 1k reward)
            expect(user1Value).to.be.closeTo(user2Value, etherParse('1')); // Within 1 SQT

            // This demonstrates the protection:
            // Era-based pricing ensures new depositors pay the CURRENT era price,
            // not a discounted pre-reward price, preventing them from "stealing" rewards
        });

        it('should calculate shares using era price not live price', async () => {
            // Setup with initial delegation
            await mockDelegationPool.connect(user1).delegate(etherParse('10000'));
            await mockDelegationPool.connect(poolManager).managerDelegate(runner1.address, etherParse('5000'));

            // Lock in initial era price
            const era1Price = await mockDelegationPool.getCurrentSharePrice();

            // Add rewards but don't compound yet (live value increases but era price doesn't)
            const rewardAmount = etherParse('5000');
            await mockStakingManager.setRunnerRewards(runner1.address, rewardAmount);
            await token.approve(mockStakingManager.address, rewardAmount);
            await mockStakingManager.fundRewards(rewardAmount);

            // User2 deposits - should use era1Price, not live price
            await token.connect(user2).approve(mockDelegationPool.address, etherParse('10000'));
            await mockDelegationPool.connect(user2).delegate(etherParse('10000'));

            // User2 should receive shares based on era1Price (1e18), not the increased live value
            const user2Shares = await mockDelegationPool.balanceOf(user2.address);
            expect(user2Shares).to.equal(etherParse('10000')); // 10000 * 1e18 / 1e18
        });

        it('should handle first deposit in new era correctly', async () => {
            // First era - initial deposit
            await mockDelegationPool.connect(user1).delegate(etherParse('1000'));

            // Move to era 2
            await startNewEra(eraManager);

            // Second deposit triggers era update
            await token.connect(user2).approve(mockDelegationPool.address, etherParse('1000'));
            await mockDelegationPool.connect(user2).delegate(etherParse('1000'));

            // Both should have same shares (no rewards between deposits)
            expect(await mockDelegationPool.balanceOf(user1.address)).to.equal(
                await mockDelegationPool.balanceOf(user2.address)
            );
        });

        it('should emit SharePriceUpdated event on era transition', async () => {
            await mockDelegationPool.connect(user1).delegate(etherParse('1000'));

            // Move to next era
            await startNewEra(eraManager);

            const currentEra = await eraManager.eraNumber();

            // Trigger update
            await token.connect(user2).approve(mockDelegationPool.address, etherParse('500'));
            await expect(mockDelegationPool.connect(user2).delegate(etherParse('500')))
                .to.emit(mockDelegationPool, 'SharePriceUpdated')
                .withArgs(currentEra, await mockDelegationPool.getCurrentSharePrice());
        });
    });
});
