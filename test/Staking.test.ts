// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { PER_MILL } from './constants';

import {
    EraManager,
    IndexerRegistry,
    RewardsDistributor,
    RewardsStaking,
    ERC20,
    Staking,
    StakingManager,
} from '../src';
import { etherParse, lastestTime, registerRunner, startNewEra, timeTravel } from './helper';
import { deployContracts } from './setup';

describe('Staking Contract', () => {
    const mockProvider = waffle.provider;
    let runner, runner2, delegator;
    let token: ERC20;
    let staking: Staking;
    let stakingManager: StakingManager;
    let eraManager: EraManager;
    let indexerRegistry: IndexerRegistry;
    let rewardsDistributor: RewardsDistributor;
    let rewardsStaking: RewardsStaking;

    const amount = etherParse('2002');

    const checkDelegation = async (_delegator: string, indexerAddress: string, valueAfter: BigNumber, era: number) => {
        const stakingAmount = await staking.delegation(_delegator, indexerAddress);
        expect(stakingAmount.valueAfter).to.equal(valueAfter);
        expect(await eraManager.eraNumber()).to.equal(era);
    };

    const checkStakingAmount = async (indexerAddress: string, valueAfter: BigNumber, era: number) => {
        const totalStakingAmount = await stakingManager.getTotalStakingAmount(indexerAddress);
        expect(totalStakingAmount).to.equal(valueAfter);
        expect(await eraManager.eraNumber()).to.equal(era);
    };

    const availableWidthdraw = async (unbondAmount: BigNumber) => {
        const unbondFeeRateBP = await staking.unbondFeeRate();
        const burnAmount = unbondFeeRateBP.mul(unbondAmount).div(PER_MILL);
        const availableAmount = unbondAmount.sub(burnAmount);

        return { availableAmount, burnAmount };
    };

    const configWallet = async () => {
        await registerRunner(token, indexerRegistry, staking, runner, runner, etherParse('2002'));
        await registerRunner(token, indexerRegistry, staking, runner, runner2, etherParse('2002'));
        await token.connect(runner).transfer(delegator.address, amount);
        await token.connect(delegator).increaseAllowance(staking.address, amount);
    };

    const deployer = ()=>deployContracts(runner, runner2);
    before(async ()=>{
        [runner, runner2, delegator] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        token = deployment.token;
        staking = deployment.staking;
        stakingManager = deployment.stakingManager;
        eraManager = deployment.eraManager;
        indexerRegistry = deployment.indexerRegistry;
        rewardsDistributor = deployment.rewardsDistributor;
        rewardsStaking = deployment.rewardsStaking;
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
            await expect(staking.connect(runner2).setLockPeriod(100)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
            await expect(staking.connect(runner2).setIndexerLeverageLimit(100)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
            await expect(staking.connect(runner2).setUnbondFeeRateBP(100)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });
    });

    describe('Staking Tokens', () => {
        it('Indexer register with first stake should work', async () => {
            // check statking state with 2 registered indexer
            expect(await staking.indexerLength()).to.equal(2);
            expect(await staking.indexerNo(runner.address)).to.equal(0);
            expect(await staking.indexerNo(runner2.address)).to.equal(1);
            expect(await staking.indexers(0)).to.equal(runner.address);
            expect(await staking.indexers(1)).to.equal(runner2.address);
            expect(await staking.stakingIndexerNos(runner.address, runner.address)).to.equal(0);
            expect(await staking.stakingIndexers(runner.address, 0)).to.equal(runner.address);
            expect(await staking.stakingIndexerLengths(runner.address)).to.equal(1);

            // first stake from indexer should be effective immediately
            const stakingAmount = await staking.delegation(runner.address, runner.address);
            expect(stakingAmount.valueAt).to.equal(amount);
            expect(stakingAmount.valueAfter).to.equal(amount);
            await checkStakingAmount(runner.address, amount, 2);
            expect(await token.balanceOf(staking.address)).to.equal(amount.mul(2));
        });

        it('staking by indexer should work', async () => {
            const moreStakingAmount = etherParse('1');
            await token.connect(runner).increaseAllowance(staking.address, moreStakingAmount);
            await stakingManager.connect(runner).stake(runner.address, moreStakingAmount);
            // check staking changes
            expect(await stakingManager.getAfterDelegationAmount(runner.address, runner.address)).to.equal(
                amount.add(moreStakingAmount)
            );
        });

        it('unstaking by indexer should work', async () => {
            const unstakeAmount = etherParse('0.5');
            await stakingManager.connect(runner).unstake(runner.address, unstakeAmount);
            // check staking changes
            expect(await stakingManager.getAfterDelegationAmount(runner.address, runner.address)).to.equal(amount.sub(unstakeAmount));
        });

        it('staking by indexer with invalid caller should fail', async () => {
            // not indexer
            await expect(stakingManager.connect(runner2).stake(runner.address, etherParse('1'))).to.be.revertedWith(
                'G002'
            );
        });

        it('unstaking by indexer with invalid params should fail', async () => {
            // not indexer
            await expect(stakingManager.connect(runner2).unstake(runner.address, etherParse('1'))).to.be.revertedWith(
                'G002'
            );
            // amount execess minum requirement
            await expect(
                stakingManager
                    .connect(runner)
                    .unstake(
                        runner.address,
                        await stakingManager.getAfterDelegationAmount(runner.address, runner.address)
                    )
            ).to.be.revertedWith('S008');
        });

        it('unstaking over indexerLeverageLimit should fail', async () => {
            const indexerLeverageLimit = await staking.indexerLeverageLimit();
            const indexerStakingAmount = await stakingManager.getAfterDelegationAmount(
                runner.address,
                runner.address
            );
            const totalStakedAmount = await stakingManager.getTotalStakingAmount(runner.address);

            const maxDelegateAmount = indexerStakingAmount.mul(indexerLeverageLimit).sub(totalStakedAmount);
            await token.connect(delegator).increaseAllowance(staking.address, maxDelegateAmount);
            await token.connect(runner).transfer(delegator.address, maxDelegateAmount);
            await stakingManager.connect(delegator).delegate(runner.address, maxDelegateAmount);

            await expect(stakingManager.connect(runner).unstake(runner.address, etherParse('1'))).to.be.revertedWith(
                'S008'
            );
        });

        it('staking to unregisted indexer should fail', async () => {
            await expect(
                stakingManager.connect(delegator).stake(delegator.address, etherParse('1'))
            ).to.be.revertedWith('G001');
        });

        it('redelegate with invalid params should fail', async () => {
            // self delegation
            await expect(
                stakingManager.redelegate(runner.address, runner2.address, etherParse('1'))
            ).to.be.revertedWith('G004');
            // out of amount
            await stakingManager.connect(delegator).delegate(runner.address, etherParse('1'));
            await expect(
                stakingManager.connect(delegator).redelegate(runner.address, runner2.address, etherParse('2'))
            ).to.be.revertedWith('S005');
        });

        it('staking by delegator should work', async () => {
            const delegatorBalance = await token.balanceOf(delegator.address);
            const contractBalance = await token.balanceOf(staking.address);
            await stakingManager.connect(delegator).delegate(runner.address, etherParse('1'));

            await startNewEra(mockProvider, eraManager);
            expect(await staking.stakingIndexerLengths(delegator.address)).to.equal(1);
            await checkDelegation(delegator.address, runner.address, etherParse('1'), 3);
            await checkStakingAmount(runner.address, amount.add(etherParse('1')), 3);

            expect(await token.balanceOf(delegator.address)).to.equal(delegatorBalance.sub(etherParse('1')));
            expect(await token.balanceOf(staking.address)).to.equal(contractBalance.add(etherParse('1')));
        });

        it('redelegate should work', async () => {
            const [from_indexer, to_indexer] = [runner.address, runner2.address];
            await stakingManager.connect(delegator).delegate(from_indexer, etherParse('1'));
            await stakingManager.connect(delegator).redelegate(from_indexer, to_indexer, etherParse('1'));

            await startNewEra(mockProvider, eraManager);
            expect(await staking.stakingIndexerLengths(delegator.address)).to.equal(2);
            await checkDelegation(delegator.address, from_indexer, etherParse('0'), 3);
            await checkStakingAmount(from_indexer, amount, 3);
            await checkDelegation(delegator.address, to_indexer, etherParse('1'), 3);
            await checkStakingAmount(to_indexer, amount.add(etherParse('1')), 3);
        });

        it('delegate by indexer should fail', async () => {
            await expect(stakingManager.connect(runner).delegate(runner.address, etherParse('1'))).to.be.revertedWith(
                'G004'
            );
        });

        it('delegation excess max limitation should fail', async () => {
            const indexerLeverageLimit = await staking.indexerLeverageLimit();
            const indexerStakingAmount = await stakingManager.getAfterDelegationAmount(
                runner.address,
                runner.address
            );
            await token.connect(runner).transfer(delegator.address, indexerStakingAmount.mul(indexerLeverageLimit));

            await expect(
                stakingManager
                    .connect(delegator)
                    .delegate(runner.address, indexerStakingAmount.mul(indexerLeverageLimit))
            ).to.be.revertedWith('S002');
        });
    });

    describe('Request Undelegate', () => {
        beforeEach(async () => {
            await stakingManager.connect(delegator).delegate(runner.address, etherParse('2'));
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
            await stakingManager.connect(runner).unstake(runner.address, etherParse('0.5'), { gasLimit: '1000000' });
            const startTime = await lastestTime(mockProvider);

            // check changes of staking storage
            await startNewEra(mockProvider, eraManager);
            await checkDelegation(runner.address, runner.address, amount.sub(etherParse('0.5')), 3);
            await checkStakingAmount(runner.address, amount.add(etherParse('1.5')), 3);
            await checkUnbondingAmount(runner.address, 0, startTime, etherParse('0.5'));

            // check changes of unbonding storage
            expect(await staking.unbondingLength(runner.address)).to.equal(1);
            expect(await staking.withdrawnLength(runner.address)).to.equal(0);
            expect(await staking.indexerLength()).to.equal(2);
        });

        it('request unregister to unstaking all by indexer registry should work', async () => {
            await indexerRegistry.unregisterIndexer({ gasLimit: '1000000' });

            // check changes of indexer storage
            await startNewEra(mockProvider, eraManager);
            expect(await staking.indexerLength()).to.equal(1);
            expect(await staking.indexerNo(runner.address)).to.equal(0);
            expect(await staking.indexerNo(runner2.address)).to.equal(0);
            expect(await staking.indexers(0)).to.equal(runner2.address);
        });

        it('request undelegate by delegator should work', async () => {
            // request the first unbond
            await expect(stakingManager.connect(delegator).undelegate(runner.address, etherParse('1')))
                .to.be.emit(staking, 'UnbondRequested')
                .withArgs(delegator.address, runner.address, etherParse('1'), 0, 0);
            const startTime = await lastestTime(mockProvider);

            // check changes of staking storage
            await startNewEra(mockProvider, eraManager);
            await checkDelegation(delegator.address, runner.address, etherParse('1'), 3);
            await checkStakingAmount(runner.address, amount.add(etherParse('1')), 3);
            await checkUnbondingAmount(delegator.address, 0, startTime, etherParse('1'));

            // check changes of unbonding storage
            expect(await staking.unbondingLength(delegator.address)).to.equal(1);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(0);
        });

        it('multiple undelegate request by delegator should work', async () => {
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.5'));
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.5'));
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.5'));

            // check changes of staking storage
            await startNewEra(mockProvider, eraManager);
            await checkDelegation(delegator.address, runner.address, etherParse('0.5'), 3);
            await checkStakingAmount(runner.address, amount.add(etherParse('0.5')), 3);

            // check all unbondingAmounts
            const unbondingAmounts = await stakingManager.getUnbondingAmounts(delegator.address);
            expect(unbondingAmounts.length).to.equal(3);
            unbondingAmounts.forEach(async ({ amount, startTime }, index) => {
                await checkUnbondingAmount(delegator.address, index, startTime, amount);
            });

            // check changes of unbonding storage
            expect(await staking.unbondingLength(delegator.address)).to.equal(3);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(0);
        });

        it('request undelegate with invlaid params should fail', async () => {
            // indexer unstake out of balance
            await expect(stakingManager.undelegate(runner.address, amount)).to.be.revertedWith('G004');
            // amount should be positive
            await expect(
                stakingManager.connect(delegator).undelegate(runner.address, etherParse('0'))
            ).to.be.revertedWith('S005');
            // delegator undelegate out of balance
            await expect(
                stakingManager.connect(delegator).undelegate(runner.address, etherParse('4'))
            ).to.be.revertedWith('S005');
        });

        it('request unstake with invalid caller should fail', async () => {
            // invalid caller
            await expect(stakingManager.connect(runner2).unstake(runner.address, etherParse('1'))).to.be.revertedWith(
                'G002'
            );
        });
    });

    describe('Request cancel unbond', () => {
        beforeEach(async () => {
            await token.connect(delegator).increaseAllowance(staking.address, etherParse('2'));
            await token.connect(runner).increaseAllowance(staking.address, etherParse('2'));
            await stakingManager.connect(delegator).delegate(runner.address, etherParse('2'));
            await stakingManager.connect(runner).stake(runner.address, etherParse('2'));
        });

        it('cancelUnbonding should work', async () => {
            let delegateAmount = await stakingManager.getAfterDelegationAmount(delegator.address, runner.address);
            const delegatorBalance = await token.balanceOf(delegator.address);
            const contractBalance = await token.balanceOf(staking.address);
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('1'));
            expect(await stakingManager.getAfterDelegationAmount(delegator.address, runner.address)).to.equal(
                delegateAmount.sub(etherParse('1'))
            );
            expect((await staking.unbondingAmount(delegator.address, 0)).amount).to.equal(etherParse('1'));
            await stakingManager.connect(delegator).cancelUnbonding(0);
            expect((await staking.unbondingAmount(delegator.address, 0)).amount).to.equal(etherParse('0'));
            expect(await stakingManager.getAfterDelegationAmount(delegator.address, runner.address)).to.equal(
                delegateAmount
            );
            expect(await token.balanceOf(delegator.address)).to.equal(delegatorBalance);
            expect(await token.balanceOf(staking.address)).to.equal(contractBalance);
            await expect(stakingManager.connect(delegator).widthdraw()).to.be.revertedWith('S009');
        });

        it('cancelUnbonding resize should work', async () => {
            // use unbonding length to 6, max undelegate is 5
            await staking.setMaxUnbondingRequest(6);

            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));
            await expect(
                stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'))
            ).to.be.revertedWith('S006');

            await stakingManager.connect(delegator).cancelUnbonding(1); // skip 1
            expect((await staking.unbondingAmount(delegator.address, 1)).amount).to.equal(etherParse('0'));
            expect(await staking.unbondingLength(delegator.address)).to.equal(5);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(0);

            await stakingManager.connect(delegator).cancelUnbonding(0); // withdraw 0 and 1
            expect((await staking.unbondingAmount(delegator.address, 0)).amount).to.equal(etherParse('0'));
            expect(await staking.unbondingLength(delegator.address)).to.equal(5);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(2);

            await stakingManager.connect(delegator).cancelUnbonding(3); // skip last
            expect((await staking.unbondingAmount(delegator.address, 3)).amount).to.equal(etherParse('0'));
            expect((await staking.unbondingAmount(delegator.address, 4)).amount).to.equal(etherParse('0.1'));
            expect(await staking.unbondingLength(delegator.address)).to.equal(5);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(2);

            await stakingManager.connect(delegator).cancelUnbonding(4); // withdraw 4 and 3
            expect((await staking.unbondingAmount(delegator.address, 4)).amount).to.equal(etherParse('0'));
            expect(await staking.unbondingLength(delegator.address)).to.equal(3);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(2);
        });

        it('unbonding append should work', async () => {
            // use unbonding length to 5, max unstake is 5, and can append
            await staking.setMaxUnbondingRequest(5);

            await stakingManager.connect(runner).unstake(runner.address, etherParse('0.1')); // 0
            await stakingManager.connect(runner).unstake(runner.address, etherParse('0.1')); // 1
            await stakingManager.connect(runner).unstake(runner.address, etherParse('0.1')); // 2
            await stakingManager.connect(runner).unstake(runner.address, etherParse('0.1')); // 3
            await stakingManager.connect(runner).unstake(runner.address, etherParse('0.1')); // 4
            await stakingManager.connect(runner).unstake(runner.address, etherParse('0.1')); // 4
            expect((await staking.unbondingAmount(runner.address, 3)).amount).to.equal(etherParse('0.1'));
            expect((await staking.unbondingAmount(runner.address, 4)).amount).to.equal(etherParse('0.2'));

            await stakingManager.connect(runner).cancelUnbonding(1); // skip 1
            expect((await staking.unbondingAmount(runner.address, 1)).amount).to.equal(etherParse('0'));
            expect(await staking.unbondingLength(runner.address)).to.equal(5);
            expect(await staking.withdrawnLength(runner.address)).to.equal(0);

            await stakingManager.connect(runner).cancelUnbonding(0); // withdraw 0 and 1
            expect((await staking.unbondingAmount(runner.address, 0)).amount).to.equal(etherParse('0'));
            expect(await staking.unbondingLength(runner.address)).to.equal(5);
            expect(await staking.withdrawnLength(runner.address)).to.equal(2);

            await stakingManager.connect(runner).unstake(runner.address, etherParse('0.1')); // 5
            expect((await staking.unbondingAmount(runner.address, 4)).amount).to.equal(etherParse('0.2'));
            expect((await staking.unbondingAmount(runner.address, 5)).amount).to.equal(etherParse('0.1'));

            await timeTravel(mockProvider, 1000);
            await stakingManager.connect(runner).widthdraw();
            expect(await staking.unbondingLength(runner.address)).to.equal(6);
            expect(await staking.withdrawnLength(runner.address)).to.equal(6);

            await stakingManager.connect(runner).unstake(runner.address, etherParse('0.1')); // 6
            expect((await staking.unbondingAmount(runner.address, 6)).amount).to.equal(etherParse('0.1'));
            expect(await staking.unbondingLength(runner.address)).to.equal(7);
            expect(await staking.withdrawnLength(runner.address)).to.equal(6);
        });

        it('cancel unbonding of unregistered indexer should fail', async () => {
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('1'));
            await startNewEra(mockProvider, eraManager);
            await rewardsDistributor.collectAndDistributeRewards(runner.address);
            await rewardsStaking.applyStakeChange(runner.address, delegator.address);
            await rewardsStaking.applyStakeChange(runner.address, runner.address);
            await indexerRegistry.connect(runner).unregisterIndexer();
            await startNewEra(mockProvider, eraManager);
            await expect(stakingManager.connect(delegator).cancelUnbonding(0)).to.be.revertedWith('S007');
        });

        it('cancel withdrawed unbonding should fail', async () => {
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('1'));
            await timeTravel(mockProvider, 60 * 60 * 24 * 10);
            await stakingManager.connect(delegator).widthdraw();
            await expect(stakingManager.connect(delegator).cancelUnbonding(0)).to.be.revertedWith('S007');
        });

        it('cancel invalid unbonding should fail', async () => {
            await expect(stakingManager.connect(delegator).cancelUnbonding(10)).to.be.revertedWith('S007');
        });

        it('cancelUnbonding should follow delegation limitation', async () => {
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('1'));
            await staking.setIndexerLeverageLimit(1);
            await expect(stakingManager.connect(delegator).cancelUnbonding(0)).to.be.revertedWith('S002');
        });
    });

    describe('Withdraw Undelegate', () => {
        const checkUnbondingChanges = async (balance: BigNumber, unbondingLength: number, withdrawnLength: number) => {
            expect(await token.balanceOf(delegator.address)).to.equal(balance);
            expect(await staking.unbondingLength(delegator.address)).to.equal(unbondingLength);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(withdrawnLength);
        };

        beforeEach(async () => {
            await stakingManager.connect(delegator).delegate(runner.address, etherParse('5'));
        });

        it('withdraw from single indexer should work', async () => {
            // get initial balances
            const delegatorBalance = await token.balanceOf(delegator.address);
            const contractBalance = await token.balanceOf(staking.address);

            // request undelegate
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('1'));
            await timeTravel(mockProvider, 1000);
            // request another undelegate
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('1'));
            expect(await staking.unbondingLength(delegator.address)).to.equal(2);

            // withdraw an undelegate
            const unbondingAmount = await staking.unbondingAmount(delegator.address, 0);
            const { availableAmount } = await availableWidthdraw(unbondingAmount.amount);
            await stakingManager.connect(delegator).widthdraw();

            // check balances
            expect(await token.balanceOf(delegator.address)).to.equal(delegatorBalance.add(availableAmount));
            expect(await token.balanceOf(staking.address)).to.equal(contractBalance.sub(unbondingAmount.amount));

            // check changes of unbonding storage
            expect(await staking.unbondingLength(delegator.address)).to.equal(2);
            expect(await staking.withdrawnLength(delegator.address)).to.equal(1);
        });

        it('withdraw from multi indexers should work', async () => {
            // delegate to another indexer
            await stakingManager.connect(delegator).delegate(runner2.address, etherParse('1'));

            // undelegate from 2 indexers
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));
            await stakingManager.connect(delegator).undelegate(runner2.address, etherParse('0.1'));
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));
            await timeTravel(mockProvider, 1000);
            await stakingManager.connect(delegator).undelegate(runner2.address, etherParse('0.1'));
            await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));

            let delegatorBalance = await token.balanceOf(delegator.address);
            await checkUnbondingChanges(delegatorBalance, 5, 0);

            // widthdraw the fist 3 requests
            await stakingManager.connect(delegator).widthdraw();
            const { availableAmount } = await availableWidthdraw(BigNumber.from(etherParse('0.1')));
            delegatorBalance = delegatorBalance.add(availableAmount.mul(3));
            await checkUnbondingChanges(delegatorBalance, 5, 3);

            // widthdraw the other 2 requests
            await timeTravel(mockProvider, 1000);
            await stakingManager.connect(delegator).widthdraw();
            delegatorBalance = delegatorBalance.add(availableAmount.mul(2));
            await checkUnbondingChanges(delegatorBalance, 5, 5);
        });

        it('withdraw undelegate requests should work', async () => {
            // request 12 undelegate requests
            for (let i = 0; i < 12; i++) {
                await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));
            }
            let delegatorBalance = await token.balanceOf(delegator.address);
            await checkUnbondingChanges(delegatorBalance, 12, 0);

            // make the 12 undelegate requests ready to withdraw
            await timeTravel(mockProvider, 1000);
            // request extra 3 undelegate requests
            for (let i = 0; i < 3; i++) {
                await stakingManager.connect(delegator).undelegate(runner.address, etherParse('0.1'));
            }
            await checkUnbondingChanges(delegatorBalance, 15, 0);

            // first withdraw only claim the first 10 requests
            await stakingManager.connect(delegator).widthdraw();
            // check balance and unbonding storage
            const { availableAmount } = await availableWidthdraw(BigNumber.from(etherParse('0.1')));
            delegatorBalance = delegatorBalance.add(availableAmount.mul(12));
            await checkUnbondingChanges(delegatorBalance, 15, 12);

            // make the next 3 undelegate requests ready to withdraw
            await timeTravel(mockProvider, 1000);
            await stakingManager.connect(delegator).widthdraw();
            delegatorBalance = delegatorBalance.add(availableAmount.mul(3));
            await checkUnbondingChanges(delegatorBalance, 15, 15);
        });

        it('withdraw an unbond with invalid status should fail', async () => {
            // no unbonding requests for withdrawing
            await expect(stakingManager.connect(delegator).widthdraw()).to.be.revertedWith('S009');
        });
    });

    describe('Set Commission Rate', () => {
        it('set commission rate should work', async () => {
            expect(await indexerRegistry.getCommissionRate(runner.address)).to.equal('0');
            await indexerRegistry.connect(runner).setCommissionRate(100);
            expect(await indexerRegistry.getCommissionRate(runner.address)).to.equal('0');
            await startNewEra(mockProvider, eraManager);
            expect(await indexerRegistry.getCommissionRate(runner.address)).to.equal('0');
            await startNewEra(mockProvider, eraManager);
            expect(await indexerRegistry.getCommissionRate(runner.address)).to.equal('100');
        });

        it('set commission rate with invalid params should fail', async () => {
            // not an indexer
            await expect(indexerRegistry.connect(delegator).setCommissionRate(100)).to.be.revertedWith('G002');
            // rate greater than COMMISSION_RATE_MULTIPLIER
            await expect(indexerRegistry.connect(runner).setCommissionRate(1e7)).to.be.revertedWith('IR006');
        });
    });
});
