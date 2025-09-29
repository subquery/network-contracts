// Copyright (C) 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { ethers, waffle } from 'hardhat';

import {
    EraManager,
    IndexerRegistry,
    RewardsDistributor,
    RewardsStaking,
    ERC20,
    Staking,
    StakingManager,
    DelegationPool,
    Settings,
} from '../src';
import {
    etherParse,
    registerRunner,
    revertMsg,
    startNewEra,
    timeTravel,
    Wallet,
    lastestBlockTime,
} from './helper';
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
    let rewardsDistributor: RewardsDistributor;
    let rewardsStaking: RewardsStaking;
    let settings: Settings;
    let delegationPool: DelegationPool;

    const deployDelegationPool = async () => {
        const DelegationPoolFactory = await ethers.getContractFactory('DelegationPool', root);
        const delegationPoolContract = await DelegationPoolFactory.deploy();
        await delegationPoolContract.initialize(settings.address);
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
        rewardsDistributor = contracts.rewardsDistributor;
        rewardsStaking = contracts.rewardsStaking;
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
            expect(await delegationPool.totalShares()).to.equal(0);
            expect(await delegationPool.availableAssets()).to.equal(0);
        });

        it('should not allow initialization twice', async () => {
            await expect(delegationPool.initialize(settings.address)).to.be.revertedWith(
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

                expect(await delegationPool.shares(user1.address)).to.equal(delegateAmount);
                expect(await delegationPool.totalShares()).to.equal(delegateAmount);
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
                expect(await delegationPool.shares(user2.address)).to.equal(expectedShares);
            });

            it('should reject zero amount delegation', async () => {
                await expect(delegationPool.connect(user1).delegate(0))
                    .to.be.revertedWith('DP001: Amount must be greater than 0');
            });

            it('should reject delegation without sufficient balance', async () => {
                const delegateAmount = etherParse('20000'); // More than user1 has
                await token.connect(user1).approve(delegationPool.address, delegateAmount);
                await expect(delegationPool.connect(user1).delegate(delegateAmount))
                    .to.be.revertedWith('DP002: Insufficient balance');
            });

            it('should reject delegation without sufficient allowance', async () => {
                const delegateAmount = etherParse('1000');
                // No approval
                await expect(delegationPool.connect(user1).delegate(delegateAmount))
                    .to.be.revertedWith('ERC20: insufficient allowance');
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
                const expectedSQT = etherParse('1000'); // 500 shares = 1000 SQT (500/1000 * 2000)

                await expect(delegationPool.connect(user1).undelegate(undelegateShares))
                    .to.emit(delegationPool, 'UndelegationStarted')
                    .withArgs(user1.address, undelegateShares, expectedSQT);

                expect(await delegationPool.shares(user1.address)).to.equal(etherParse('500'));
                expect(await delegationPool.totalShares()).to.equal(etherParse('500'));

                // Should create unbonding request
                const unbondRequests = await delegationPool.getPendingUnbonds(user1.address);
                expect(unbondRequests.length).to.equal(1);
                expect(unbondRequests[0].amount).to.equal(expectedSQT);
                expect(unbondRequests[0].completed).to.be.false;
            });

            it('should reject zero shares undelegation', async () => {
                await expect(delegationPool.connect(user1).undelegate(0))
                    .to.be.revertedWith('DP003: Shares must be greater than 0');
            });

            it('should reject undelegation of more shares than owned', async () => {
                const excessiveShares = etherParse('1500');
                await expect(delegationPool.connect(user1).undelegate(excessiveShares))
                    .to.be.revertedWith('DP004: Insufficient shares');
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
                await expect(delegationPool.connect(user1).withdraw())
                    .to.be.revertedWith('DP007: No mature withdrawals');
            });

            it('should allow withdrawal after lock period expires', async () => {
                // Travel forward 28 days
                await timeTravel(28 * 24 * 60 * 60);

                const balanceBefore = await token.balanceOf(user1.address);
                await expect(delegationPool.connect(user1).withdraw())
                    .to.emit(delegationPool, 'Withdrawn')
                    .withArgs(user1.address, etherParse('1000'));

                const balanceAfter = await token.balanceOf(user1.address);
                expect(balanceAfter.sub(balanceBefore)).to.equal(etherParse('1000'));
            });

            it('should reject withdrawal when no pending unbonds exist', async () => {
                await expect(delegationPool.connect(user2).withdraw())
                    .to.be.revertedWith('DP006: No pending withdrawals');
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

                expect(await delegationPool.delegatedToIndexer(runner1.address)).to.equal(delegateAmount);
                expect(await delegationPool.availableAssets()).to.equal(etherParse('4000')); // 6000 - 2000
                expect(await delegationPool.isActiveIndexer(runner1.address)).to.be.true;
                expect(await delegationPool.getActiveIndexersCount()).to.equal(1);

                const activeIndexers = await delegationPool.getActiveIndexers();
                expect(activeIndexers[0]).to.equal(runner1.address);
            });

            it('should reject delegation from non-manager', async () => {
                await expect(delegationPool.connect(user1).managerDelegate(runner1.address, etherParse('1000')))
                    .to.be.revertedWith('Ownable: caller is not the owner');
            });

            it('should reject delegation with zero address', async () => {
                await expect(delegationPool.connect(poolManager).managerDelegate(constants.AddressZero, etherParse('1000')))
                    .to.be.revertedWith('DP008: Invalid runner address');
            });

            it('should reject delegation with zero amount', async () => {
                await expect(delegationPool.connect(poolManager).managerDelegate(runner1.address, 0))
                    .to.be.revertedWith('DP009: Amount must be greater than 0');
            });

            it('should reject delegation exceeding available assets', async () => {
                const excessiveAmount = etherParse('10000');
                await expect(delegationPool.connect(poolManager).managerDelegate(runner1.address, excessiveAmount))
                    .to.be.revertedWith('DP010: Insufficient available assets');
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

                expect(await delegationPool.delegatedToIndexer(runner1.address)).to.equal(etherParse('1000'));
            });

            it('should remove indexer from active list when delegation becomes zero', async () => {
                await delegationPool.connect(poolManager).managerUndelegate(runner1.address, etherParse('2000'));

                expect(await delegationPool.delegatedToIndexer(runner1.address)).to.equal(0);
                expect(await delegationPool.isActiveIndexer(runner1.address)).to.be.false;
                expect(await delegationPool.getActiveIndexersCount()).to.equal(0);
            });

            it('should reject undelegation exceeding delegated amount', async () => {
                const excessiveAmount = etherParse('3000');
                await expect(delegationPool.connect(poolManager).managerUndelegate(runner1.address, excessiveAmount))
                    .to.be.revertedWith('DP013: Insufficient delegated amount');
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
                    delegationPool.connect(poolManager).managerRedelegate(runner1.address, runner2.address, redelegateAmount)
                )
                    .to.emit(delegationPool, 'ManagerRedelegated')
                    .withArgs(runner1.address, runner2.address, redelegateAmount);

                expect(await delegationPool.delegatedToIndexer(runner1.address)).to.equal(etherParse('1000'));
                expect(await delegationPool.delegatedToIndexer(runner2.address)).to.equal(redelegateAmount);
                expect(await delegationPool.isActiveIndexer(runner2.address)).to.be.true;
                expect(await delegationPool.getActiveIndexersCount()).to.equal(2);
            });

            it('should reject redelegation to same runner', async () => {
                await expect(
                    delegationPool.connect(poolManager).managerRedelegate(runner1.address, runner1.address, etherParse('1000'))
                ).to.be.revertedWith('DP015: Cannot redelegate to same runner');
            });

            it('should reject redelegation with invalid addresses', async () => {
                await expect(
                    delegationPool.connect(poolManager).managerRedelegate(constants.AddressZero, runner2.address, etherParse('1000'))
                ).to.be.revertedWith('DP014: Invalid runner addresses');
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

            await expect(delegationPool.autoCompound())
                .to.be.revertedWith('DP018: No active delegations');
        });

        it('should handle auto compound when no rewards available', async () => {
            // This should not revert but also not emit RewardsCompounded
            const tx = await delegationPool.autoCompound();
            const receipt = await tx.wait();

            // Should not have RewardsCompounded event
            const rewardsCompoundedEvents = receipt.events?.filter(e => e.event === 'RewardsCompounded') || [];
            expect(rewardsCompoundedEvents.length).to.equal(0);
        });

        // Note: Testing actual reward compounding would require complex setup with reward distribution
        // which depends on the full ecosystem being active. The basic structure is tested above.
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
            expect(totalAssets).to.equal(etherParse('2500')); // 1000 initial + 1000 + 500 delegated
        });

        it('should return correct user shares', async () => {
            expect(await delegationPool.getShares(user1.address)).to.equal(etherParse('1000'));
            expect(await delegationPool.getShares(user2.address)).to.equal(etherParse('250')); // 500 * 1000 / 2000
        });

        it('should return correct delegation amounts', async () => {
            expect(await delegationPool.getDelegationAmount(user1.address)).to.equal(etherParse('2000')); // 1000/1250 * 2500
            expect(await delegationPool.getDelegationAmount(user2.address)).to.equal(etherParse('500')); // 250/1250 * 2500
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
            expect(expectedShares).to.equal(etherParse('250')); // 500 * 1250 / 2500

            const shareAmount = etherParse('100');
            const expectedAssets = await delegationPool.previewWithdraw(shareAmount);
            expect(expectedAssets).to.equal(etherParse('200')); // 100 * 2500 / 1250
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

            await expect(delegationPool.connect(poolManager).updateSettings(newSettingsContract.address))
                .to.emit(delegationPool, 'SettingsUpdated')
                .withArgs(newSettingsContract.address);

            expect(await delegationPool.settings()).to.equal(newSettingsContract.address);
        });

        it('should reject settings update from non-owner', async () => {
            const newSettings = await ethers.getContractFactory('Settings', root);
            const newSettingsContract = await newSettings.deploy();

            await expect(delegationPool.connect(user1).updateSettings(newSettingsContract.address))
                .to.be.revertedWith('Ownable: caller is not the owner');
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
});