// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {PER_MILL} from './constants';
import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {ethers, waffle} from 'hardhat';

import {IndexerRegistry, EraManager, SQToken, Staking, RewardsDistributer} from '../src';
import {deployContracts} from './setup';
import {lastestTime, registerIndexer, startNewEra, timeTravel, etherParse} from './helper';

describe('Staking Contract', () => {
    const mockProvider = waffle.provider;
    let indexer, indexer2, delegator;
    let token: SQToken;
    let staking: Staking;
    let eraManager: EraManager;
    let indexerRegistry: IndexerRegistry;
    let rewardsDistributer: RewardsDistributer;

    const amount = etherParse('10');

    const checkDelegation = async (_delegator: string, indexerAddress: string, valueAfter: BigNumber, era: number) => {
        const stakingAmount = await staking.delegation(_delegator, indexerAddress);
        expect(stakingAmount.valueAfter).to.equal(valueAfter);
        expect(await eraManager.eraNumber()).to.equal(era);
    };

    const checkStakingAmount = async (indexerAddress: string, valueAfter: BigNumber, era: number) => {
        const totalStakingAmount = await staking.getTotalStakingAmount(indexerAddress);
        expect(totalStakingAmount).to.equal(valueAfter);
        expect(await eraManager.eraNumber()).to.equal(era);
    };

    const availableWidthdraw = async (unbondAmount: BigNumber) => {
        const unbondFeeRateBP = await staking.unbondFeeRate();
        const burnAmount = unbondFeeRateBP.mul(unbondAmount).div(PER_MILL);
        const availableAmount = unbondAmount.sub(burnAmount);

        return {availableAmount, burnAmount};
    };

    const configWallet = async () => {
        await registerIndexer(token, indexerRegistry, staking, indexer, indexer, '20');
        await registerIndexer(token, indexerRegistry, staking, indexer, indexer2, '20');
        await token.connect(indexer).transfer(delegator.address, amount);
        await token.connect(delegator).increaseAllowance(staking.address, amount);
    };

    beforeEach(async () => {
        [indexer, indexer2, delegator] = await ethers.getSigners();
        const deployment = await deployContracts(indexer, indexer2);
        token = deployment.token;
        staking = deployment.staking;
        eraManager = deployment.eraManager;
        indexerRegistry = deployment.indexerRegistry;
        rewardsDistributer = deployment.rewardsDistributer;
        await configWallet();
    });

    describe('Staking Config', () => {
        it('check staking configs', async () => {
            expect(await staking.lockPeriod()).to.equal(1000);
            expect(await staking.indexerLeverageLimit()).to.equal(10);
            expect(await staking.unbondFeeRate()).to.equal(1000);
        });

        it('update configs should work', async () => {
            await staking.setLockPeriod(100);
            expect(await staking.lockPeriod()).to.equal(100);

            await staking.setIndexerLeverageLimit(100);
            expect(await staking.indexerLeverageLimit()).to.equal(100);

            await staking.setUnbondFeeRateBP(100);
            expect(await staking.unbondFeeRate()).to.equal(100);
        });

        it('update configs without owner should fail', async () => {
            await expect(staking.connect(indexer2).setLockPeriod(100)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
            await expect(staking.connect(indexer2).setIndexerLeverageLimit(100)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
            await expect(staking.connect(indexer2).setUnbondFeeRateBP(100)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });
    });

    describe('Staking Tokens', () => {
        it('Indexer register with first stake should work', async () => {
            // check statking state with 2 registered indexer
            expect(await staking.indexerLength()).to.equal(2);
            expect(await staking.indexerNo(indexer.address)).to.equal(0);
            expect(await staking.indexerNo(indexer2.address)).to.equal(1);
            expect(await staking.indexers(0)).to.equal(indexer.address);
            expect(await staking.indexers(1)).to.equal(indexer2.address);
            expect(await staking.stakingIndexerNos(indexer.address, indexer.address)).to.equal(0);
            expect(await staking.stakingIndexers(indexer.address, 0)).to.equal(indexer.address);
            expect(await staking.stakingIndexerLengths(indexer.address)).to.equal(1);

            // first stake from indexer should be effective immediately
            const stakingAmount = await staking.delegation(indexer.address, indexer.address);
            expect(stakingAmount.valueAt).to.equal(amount);
            expect(stakingAmount.valueAfter).to.equal(amount);
            await checkStakingAmount(indexer.address, amount, 2);
            expect(await token.balanceOf(staking.address)).to.equal(amount.mul(2));
        });

        it('staking by indexer should work', async () => {
            await token.connect(indexer).increaseAllowance(staking.address, etherParse('1'));
            await staking.connect(indexer).stake(indexer.address, etherParse('1'));
            // check staking changes
            expect(await staking.getAfterDelegationAmount(indexer.address, indexer.address)).to.equal(etherParse('11'));
        });

        it('unstaking by indexer should work', async () => {
            await staking.connect(indexer).unstake(indexer.address, etherParse('1'));
            // check staking changes
            expect(await staking.getAfterDelegationAmount(indexer.address, indexer.address)).to.equal(etherParse('9'));
        });

        it('staking by indexer with invalid caller should fail', async () => {
            // not indexer
            await expect(staking.connect(indexer2).stake(indexer.address, etherParse("1"))).to.be.revertedWith('Only indexer');
        });

        it('unstaking by indexer with invalid params should fail', async () => {
            // not indexer
            await expect(staking.connect(indexer2).unstake(indexer.address, etherParse("1"))).to.be.revertedWith('Only indexer');
            // amount execess minum requirement
            await expect(staking.connect(indexer).unstake(indexer.address, await staking.getAfterDelegationAmount(indexer.address, indexer.address))).to.be.revertedWith(
                'Insufficient stake'
            );
        });

        it('staking to unregisted indexer should fail', async () => {
            await expect(staking.connect(delegator).stake(delegator.address, etherParse("1"))).to.be.revertedWith('Only IndexerRegistry');
        });

        it('redelegate with invalid params should fail', async () => {
            // self delegation
            await expect(staking.redelegate(indexer.address, indexer2.address, etherParse("1"))).to.be.revertedWith('Only delegator');
            // out of amount
            await staking.connect(delegator).delegate(indexer.address, etherParse('1'));
            await expect(
                staking.connect(delegator).redelegate(indexer.address, indexer2.address, etherParse("2"))
            ).to.be.revertedWith('Insufficient delegation');
        });

        it('staking by delegator should work', async () => {
            const delegatorBalance = await token.balanceOf(delegator.address);
            const contractBalance = await token.balanceOf(staking.address);
            await staking.connect(delegator).delegate(indexer.address, etherParse('1'));

            await startNewEra(mockProvider, eraManager);
            expect(await staking.stakingIndexerLengths(delegator.address)).to.equal(1);
            await checkDelegation(delegator.address, indexer.address, etherParse('1'), 3);
            await checkStakingAmount(indexer.address, amount.add(etherParse('1')), 3);

            expect(await token.balanceOf(delegator.address)).to.equal(delegatorBalance.sub(etherParse('1')));
            expect(await token.balanceOf(staking.address)).to.equal(contractBalance.add(etherParse('1')));
        });

        it('redelegate should work', async () => {
            const [from_indexer, to_indexer] = [indexer.address, indexer2.address];
            await staking.connect(delegator).delegate(from_indexer, etherParse('1'));
            await staking.connect(delegator).redelegate(from_indexer, to_indexer, etherParse('1'));

            await startNewEra(mockProvider, eraManager);
            expect(await staking.stakingIndexerLengths(delegator.address)).to.equal(2);
            await checkDelegation(delegator.address, from_indexer, etherParse('0'), 3);
            await checkStakingAmount(from_indexer, amount, 3);
            await checkDelegation(delegator.address, to_indexer, etherParse('1'), 3);
            await checkStakingAmount(to_indexer, amount.add(etherParse('1')), 3);
        });

        it('delegate by indexer should fail', async () => {
            await expect(staking.connect(indexer).delegate(indexer.address, etherParse("1"))).to.be.revertedWith('Only delegator');
        });

        it('delegation excess max limitation should fail', async () => {
            const indexerLeverageLimit = await staking.indexerLeverageLimit();
            const indexerStakingAmount = await staking.getAfterDelegationAmount(indexer.address, indexer.address);
            await token.connect(indexer).transfer(delegator.address, indexerStakingAmount.mul(indexerLeverageLimit));

            await expect(
                staking.connect(delegator).delegate(indexer.address, indexerStakingAmount.mul(indexerLeverageLimit))
            ).to.be.revertedWith('Delegation limitation');
        });
    });

    describe('Request Undelegate', () => {
        beforeEach(async () => {
            await staking.connect(delegator).delegate(indexer.address, etherParse('2'));
        });

        const checkUnbondingAmount = async (
            source: string,
            id: number,
            startTime: number | BigNumber,
            amount: number | BigNumber
        ) => {
            const unbondingAmount = await staking.unbondingAmount(source, id);
            expect(unbondingAmount.amount).to.equal(amount);
            expect(unbondingAmount.startTime).to.equal(startTime);
        };

        it('request unbond by indexer registry should work', async () => {
            await staking.connect(indexer).unstake(indexer.address, etherParse('1'), {gasLimit: '1000000'});
            const startTime = await lastestTime(mockProvider);

            // check changes of staking storage
            await startNewEra(mockProvider, eraManager);
            await checkDelegation(indexer.address, indexer.address, amount.sub(etherParse('1')), 3);
            await checkStakingAmount(indexer.address, amount.add(etherParse('1')), 3);
            await checkUnbondingAmount(indexer.address, 0, startTime, etherParse('1'));

            // check changes of unbonding storage
            expect(await staking.unbondingLength(indexer.address)).to.equal(1);
            expect(await staking.withdrawnLength(indexer.address)).to.equal(0);
            expect(await staking.indexerLength()).to.equal(2);
        });

        it('request unregister to unstaking all by indexer registry should work', async () => {
            await indexerRegistry.unregisterIndexer({gasLimit: '1000000'});

            // check changes of indexer storage
            await startNewEra(mockProvider, eraManager);
            expect(await staking.indexerLength()).to.equal(1);
            expect(await staking.indexerNo(indexer.address)).to.equal(0);
            expect(await staking.indexerNo(indexer2.address)).to.equal(0);
            expect(await staking.indexers(0)).to.equal(indexer2.address);
        });

        it('request undelegate by delegator should work', async () => {
            // request the first unbond
            await expect(staking.connect(delegator).undelegate(indexer.address, etherParse('1')))
                .to.be.emit(staking, 'UnbondRequested')
                .withArgs(delegator.address, indexer.address, etherParse('1'), 0);
            const startTime = await lastestTime(mockProvider);

            // check changes of staking storage
            await startNewEra(mockProvider, eraManager);
            await checkDelegation(delegator.address, indexer.address, etherParse('1'), 3);
            await checkStakingAmount(indexer.address, amount.add(etherParse('1')), 3);
            await checkUnbondingAmount(delegator.address, 0, startTime, etherParse('1'));

            // check changes of unbonding storage
            expect(await staking.unbondingLength(delegator.address)).to.equal(1);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(0);
        });

        it('multiple undelegate request by delegator should work', async () => {
            await staking.connect(delegator).undelegate(indexer.address, etherParse('0.5'));
            await staking.connect(delegator).undelegate(indexer.address, etherParse('0.5'));
            await staking.connect(delegator).undelegate(indexer.address, etherParse('0.5'));

            // check changes of staking storage
            await startNewEra(mockProvider, eraManager);
            await checkDelegation(delegator.address, indexer.address, etherParse('0.5'), 3);
            await checkStakingAmount(indexer.address, amount.add(etherParse('0.5')), 3);

            // check all unbondingAmounts
            const unbondingAmounts = await staking.getUnbondingAmounts(delegator.address);
            expect(unbondingAmounts.length).to.equal(3);
            unbondingAmounts.forEach(async ({amount, startTime}, index) => {
                await checkUnbondingAmount(delegator.address, index, startTime, amount);
            });

            // check changes of unbonding storage
            expect(await staking.unbondingLength(delegator.address)).to.equal(3);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(0);
        });

        it('request undelegate with invlaid params should fail', async () => {
            // indexer unstake out of balance
            await expect(staking.undelegate(indexer.address, amount)).to.be.revertedWith(
                'Only delegator'
            );
            // amount should be positive
            await expect(staking.connect(delegator).undelegate(indexer.address, etherParse("0"))).to.be.revertedWith(
                'Invalid amount'
            );
            // delegator undelegate out of balance
            await expect(staking.connect(delegator).undelegate(indexer.address, etherParse("4"))).to.be.revertedWith(
                'Insufficient delegation'
            );
        });

        it('request unstake with invalid caller should fail', async () => {
            // invalid caller
            await expect(staking.connect(indexer2).unstake(indexer.address, etherParse("1"))).to.be.revertedWith(
                'Only indexer'
            );
        });
    });

    describe('Request cancel unbond', () => {
        beforeEach(async () => {
            await staking.connect(delegator).delegate(indexer.address, etherParse('2'));
            await staking.connect(indexer).stake(indexer.address, etherParse('2'));
        });

        it('cancelUnbonding should work', async () => {
            let delegateAmount = await staking.getAfterDelegationAmount(delegator.address, indexer.address);
            const delegatorBalance = await token.balanceOf(delegator.address);
            const contractBalance = await token.balanceOf(staking.address);
            await staking.connect(delegator).undelegate(indexer.address, etherParse('1'));
            expect(await staking.getAfterDelegationAmount(delegator.address, indexer.address)).to.equal(
                delegateAmount.sub(etherParse('1'))
            );
            expect((await staking.unbondingAmount(delegator.address, 0)).amount).to.equal(etherParse('1'));
            await staking.connect(delegator).cancelUnbonding(0);
            expect((await staking.unbondingAmount(delegator.address, 0)).amount).to.equal(etherParse('0'));
            expect(await staking.getAfterDelegationAmount(delegator.address, indexer.address)).to.equal(delegateAmount);
            await timeTravel(mockProvider, 1000);
            await staking.connect(delegator).widthdraw();
            expect(await token.balanceOf(delegator.address)).to.equal(delegatorBalance);
            expect(await token.balanceOf(staking.address)).to.equal(contractBalance);
        });

        it('cancel unbonding of unregistered indexer should fail', async () => {
            await staking.connect(delegator).undelegate(indexer.address, etherParse('1'));
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributer.collectAndDistributeRewards(indexer.address);
            await rewardsDistributer.applyStakeChange(indexer.address, delegator.address);
            await rewardsDistributer.applyStakeChange(indexer.address, indexer.address);
            await indexerRegistry.connect(indexer).unregisterIndexer();
            await startNewEra(mockProvider, eraManager);
            await expect(staking.connect(delegator).cancelUnbonding(0)).to.be.revertedWith('Unregistered');
        });

        it('cancel withdrawed unbonding should fail', async () => {
            await staking.connect(delegator).undelegate(indexer.address, etherParse('1'));
            await timeTravel(mockProvider, 60 * 60 * 24 * 10);
            await staking.connect(delegator).widthdraw();
            await expect(staking.connect(delegator).cancelUnbonding(0)).to.be.revertedWith('Withdrawn');
        });

        it('cancel invalid unbonding should fail', async () => {
            await expect(staking.connect(delegator).cancelUnbonding(10)).to.be.revertedWith('Invalid unbond');
        });

        it('cancelUnbonding should follow delegation limitation', async () => {
            await staking.connect(delegator).undelegate(indexer.address, etherParse('1'));
            await staking.setIndexerLeverageLimit(1);
            await expect(staking.connect(delegator).cancelUnbonding(0)).to.be.revertedWith(
                'Delegation limitation'
            );
        });
    });

    describe('Withdraw Undelegate', () => {
        const checkUnbondingChanges = async (balance: BigNumber, unbondingLength: number, withdrawnLength: number) => {
            expect(await token.balanceOf(delegator.address)).to.equal(balance);
            expect(await staking.unbondingLength(delegator.address)).to.equal(unbondingLength);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(withdrawnLength);
        };

        beforeEach(async () => {
            await staking.connect(delegator).delegate(indexer.address, etherParse('5'));
        });

        it('withdraw from single indexer should work', async () => {
            // get initial balances
            const delegatorBalance = await token.balanceOf(delegator.address);
            const contractBalance = await token.balanceOf(staking.address);

            // request undelegate
            await staking.connect(delegator).undelegate(indexer.address, etherParse('1'));
            await timeTravel(mockProvider, 1000);
            // request another undelegate
            await staking.connect(delegator).undelegate(indexer.address, etherParse('1'));
            expect(await staking.unbondingLength(delegator.address)).to.equal(2);

            // withdraw an undelegate
            const unbondingAmount = await staking.unbondingAmount(delegator.address, 0);
            const {availableAmount} = await availableWidthdraw(unbondingAmount.amount);
            await staking.connect(delegator).widthdraw();

            // check balances
            expect(await token.balanceOf(delegator.address)).to.equal(delegatorBalance.add(availableAmount));
            expect(await token.balanceOf(staking.address)).to.equal(contractBalance.sub(unbondingAmount.amount));

            // check changes of unbonding storage
            expect(await staking.unbondingLength(delegator.address)).to.equal(2);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(1);
        });

        it('withdraw from multi indexers should work', async () => {
            // delegate to another indexer
            await staking.connect(delegator).delegate(indexer2.address, etherParse('1'));

            // undelegate from 2 indexers
            await staking.connect(delegator).undelegate(indexer.address, etherParse('0.1'));
            await staking.connect(delegator).undelegate(indexer2.address, etherParse('0.1'));
            await staking.connect(delegator).undelegate(indexer.address, etherParse('0.1'));
            await timeTravel(mockProvider, 1000);
            await staking.connect(delegator).undelegate(indexer2.address, etherParse('0.1'));
            await staking.connect(delegator).undelegate(indexer.address, etherParse('0.1'));

            let delegatorBalance = await token.balanceOf(delegator.address);
            await checkUnbondingChanges(delegatorBalance, 5, 0);

            // widthdraw the fist 3 requests
            await staking.connect(delegator).widthdraw();
            const {availableAmount} = await availableWidthdraw(BigNumber.from(etherParse('0.1')));
            delegatorBalance = delegatorBalance.add(availableAmount.mul(3));
            await checkUnbondingChanges(delegatorBalance, 5, 3);

            // widthdraw the other 2 requests
            await timeTravel(mockProvider, 1000);
            await staking.connect(delegator).widthdraw();
            delegatorBalance = delegatorBalance.add(availableAmount.mul(2));
            await checkUnbondingChanges(delegatorBalance, 5, 5);
        });

        it('withdraw max 10 undelegate requests should work', async () => {
            // request 12 undelegate requests
            for (let i = 0; i < 12; i++) {
                await staking.connect(delegator).undelegate(indexer.address, etherParse('0.1'));
            }
            let delegatorBalance = await token.balanceOf(delegator.address);
            await checkUnbondingChanges(delegatorBalance, 12, 0);

            // make the 12 undelegate requests ready to withdraw
            await timeTravel(mockProvider, 1000);
            // request extra 3 undelegate requests
            for (let i = 0; i < 3; i++) {
                await staking.connect(delegator).undelegate(indexer.address, etherParse('0.1'));
            }
            await checkUnbondingChanges(delegatorBalance, 15, 0);

            // first withdraw only claim the first 10 requests
            await staking.connect(delegator).widthdraw();
            // check balance and unbonding storage
            const {availableAmount} = await availableWidthdraw(BigNumber.from(etherParse('0.1')));
            delegatorBalance = delegatorBalance.add(availableAmount.mul(10));
            await checkUnbondingChanges(delegatorBalance, 15, 10);

            // second withdraw claim the other 2 requests
            await staking.connect(delegator).widthdraw();
            // check balance and unbonding storage
            delegatorBalance = delegatorBalance.add(availableAmount.mul(2));
            await checkUnbondingChanges(delegatorBalance, 15, 12);

            // make the next 3 undelegate requests ready to withdraw
            await timeTravel(mockProvider, 1000);
            await staking.connect(delegator).widthdraw();
            delegatorBalance = delegatorBalance.add(availableAmount.mul(3));
            await checkUnbondingChanges(delegatorBalance, 15, 15);
        });

        it('withdraw an unbond with invalid status should fail', async () => {
            // no unbonding requests for withdrawing
            await expect(staking.connect(delegator).widthdraw()).to.be.revertedWith('Need unbond');
        });
    });

    describe('Set Commission Rate', () => {
        it('set commission rate should work', async () => {
            expect(await staking.getCommissionRate(indexer.address)).to.equal('0');
            await staking.connect(indexer).setCommissionRate(100);
            expect(await staking.getCommissionRate(indexer.address)).to.equal('0');
            await startNewEra(mockProvider, eraManager);
            expect(await staking.getCommissionRate(indexer.address)).to.equal('0');
            await startNewEra(mockProvider, eraManager);
            expect(await staking.getCommissionRate(indexer.address)).to.equal('100');
        });

        it('set commission rate with invalid params should fail', async () => {
            // not an indexer
            await expect(staking.connect(delegator).setCommissionRate(100)).to.be.revertedWith('Not indexer');
            // rate greater than COMMISSION_RATE_MULTIPLIER
            await expect(staking.connect(indexer).setCommissionRate(1e7)).to.be.revertedWith('Invalid rate');
        });
    });
});
