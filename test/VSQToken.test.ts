// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';

import {IndexerRegistry, EraManager, SQToken, Staking, VSQToken} from '../src';
import {deployContracts} from './setup';
import {registerIndexer, startNewEra, etherParse} from './helper';

describe('VSQToken Contract', () => {
    const mockProvider = waffle.provider;
    let root, indexer, indexer2, delegator;
    let token: SQToken;
    let staking: Staking;
    let eraManager: EraManager;
    let indexerRegistry: IndexerRegistry;
    let vtoken: VSQToken;

    beforeEach(async () => {
        [root, indexer, indexer2, delegator] = await ethers.getSigners();
        const deployment = await deployContracts(root, root);
        token = deployment.token;
        staking = deployment.staking;
        eraManager = deployment.eraManager;
        indexerRegistry = deployment.indexerRegistry;
        vtoken = deployment.vtoken;

        //register indexer1: Indexer1 balance: 10 sqt, Indexer1 staked amount: 10 sqt
        await registerIndexer(token, indexerRegistry, staking, root, indexer, '20');
        //register indexer2: Indexer2 balance: 10 sqt, Indexer2 staked amount: 10 sqt
        await registerIndexer(token, indexerRegistry, staking, root, indexer2, '20');
        //setup delegator: delegator balance: 15 sqt
        await token.connect(root).transfer(delegator.address, etherParse('15'));
        await token.connect(delegator).increaseAllowance(staking.address, etherParse('15'));
    });

    it('get balance of VSQT Token should work', async () => {
        await staking.connect(delegator).delegate(indexer.address, etherParse('5'));
        await staking.connect(delegator).delegate(indexer2.address, etherParse('5'));
        expect(await token.balanceOf(indexer.address)).to.equal(etherParse('10'));
        expect(await vtoken.balanceOf(indexer.address)).to.equal(etherParse('20'));
        expect(await token.balanceOf(indexer2.address)).to.equal(etherParse('10'));
        expect(await vtoken.balanceOf(indexer2.address)).to.equal(etherParse('20'));
        expect(await token.balanceOf(delegator.address)).to.equal(etherParse('5'));
        expect(await vtoken.balanceOf(delegator.address)).to.equal(etherParse('15'));

        await staking.connect(delegator).undelegate(indexer.address, etherParse('2'));
        await startNewEra(mockProvider, eraManager);
        expect(await vtoken.balanceOf(delegator.address)).to.equal(etherParse('15'));
        await staking.connect(delegator).widthdraw();
        expect(await token.balanceOf(delegator.address)).to.equal(etherParse('6.998'));
        expect(await vtoken.balanceOf(delegator.address)).to.equal(etherParse('14.998'));
    });
});
