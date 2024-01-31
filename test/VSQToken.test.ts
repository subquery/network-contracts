// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { EraManager, IndexerRegistry, ERC20, Staking, StakingManager, VSQToken } from '../src';
import { etherParse, registerRunner, startNewEra } from './helper';
import { deployContracts } from './setup';

describe('VSQToken Contract', () => {
    const mockProvider = waffle.provider;
    let root, runner, runner2, delegator;
    let token: ERC20;
    let staking: Staking;
    let stakingManager: StakingManager;
    let eraManager: EraManager;
    let indexerRegistry: IndexerRegistry;
    let vtoken: VSQToken;

    const amount = '2000';

    const deployer = () => deployContracts(root, root);
    before(async () => {
        [root, runner, runner2, delegator] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        token = deployment.token;
        staking = deployment.staking;
        stakingManager = deployment.stakingManager;
        eraManager = deployment.eraManager;
        indexerRegistry = deployment.indexerRegistry;
        vtoken = deployment.vtoken;

        //register indexer1: Indexer1 balance: 10 sqt, Indexer1 staked amount: 10 sqt
        await registerRunner(token, indexerRegistry, staking, root, runner, etherParse(amount));
        //register indexer2: Indexer2 balance: 10 sqt, Indexer2 staked amount: 10 sqt
        await registerRunner(token, indexerRegistry, staking, root, runner2, etherParse(amount));
        //setup delegator: delegator balance: 15 sqt
        await token.connect(root).transfer(delegator.address, etherParse('15'));
        await token.connect(delegator).increaseAllowance(staking.address, etherParse('15'));
    });

    it('get balance of VSQT Token should work', async () => {
        await stakingManager.connect(delegator).delegate(runner.address, etherParse('5'));
        await stakingManager.connect(delegator).delegate(runner2.address, etherParse('5'));
        expect(await token.balanceOf(runner.address)).to.equal(0);
        expect(await vtoken.balanceOf(runner.address)).to.equal(etherParse(amount));
        expect(await token.balanceOf(runner2.address)).to.equal(0);
        expect(await vtoken.balanceOf(runner2.address)).to.equal(etherParse(amount));
        expect(await token.balanceOf(delegator.address)).to.equal(etherParse('5'));
        expect(await vtoken.balanceOf(delegator.address)).to.equal(etherParse('15'));

        await stakingManager.connect(delegator).undelegate(runner.address, etherParse('2'));
        await startNewEra(mockProvider, eraManager);
        expect(await vtoken.balanceOf(delegator.address)).to.equal(etherParse('15'));
        await stakingManager.connect(delegator).widthdraw();
        expect(await token.balanceOf(delegator.address)).to.equal(etherParse('6.998'));
        expect(await vtoken.balanceOf(delegator.address)).to.equal(etherParse('14.998'));
    });
});
