// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { EraManager } from '../src';
import { lastestBlockTime, timeTravel } from './helper';
import { deployContracts } from './setup';
const { time } = require('@openzeppelin/test-helpers');

describe('Era Manager Contract', () => {
    let wallet_0, wallet_1;
    let eraManager: EraManager;

    const deployer = () => deployContracts(wallet_0, wallet_1);
    before(async () => {
        [wallet_0, wallet_1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        eraManager = deployment.eraManager;
    });

    describe('Start new era', () => {
        it('check default config', async () => {
            // check default era values
            expect(await eraManager.eraPeriod()).to.equal(time.duration.days(1).toNumber());
            expect(await eraManager.eraNumber()).to.equal(1);
            expect(await eraManager.eraStartTime()).to.equal(0);
        });

        it('start new era should work', async () => {
            // start new era
            expect(await eraManager.startNewEra())
                .to.be.emit(eraManager, 'NewEraStart')
                .withArgs(2, wallet_0.address);

            // check updates
            expect(await eraManager.eraNumber()).to.equal(2);
            expect(Number(await eraManager.eraStartTime())).to.greaterThanOrEqual(0);
        });

        it('start new era with active era should failed', async () => {
            // start new era
            await eraManager.startNewEra();
            // try to start new era again
            await expect(eraManager.startNewEra()).to.be.revertedWith('E002');
        });
    });

    describe('Update era', () => {
        it('update era period should work', async () => {
            // update era period
            expect(await eraManager.updateEraPeriod(10))
                .to.be.emit(eraManager, 'EraPeriodUpdate')
                .withArgs(1, 10);
            // check updates
            expect(await eraManager.eraPeriod()).to.equal(10);
        });

        it('safe update era should work', async () => {
            // safe update era
            await eraManager.safeUpdateAndGetEra();
            expect(await eraManager.eraNumber()).to.equal(2);
            await eraManager.safeUpdateAndGetEra();
            expect(await eraManager.eraNumber()).to.equal(2);

            // Safe update era after era preriod changed should work
            await eraManager.updateEraPeriod(time.duration.days(1).toNumber());
            await timeTravel(time.duration.days(2).toNumber());
            await eraManager.safeUpdateAndGetEra();
            expect(await eraManager.eraNumber()).to.equal(3);
        });
    });

    describe('timestampToEraNumber', () => {
        beforeEach(async () => {
            //setup era period be 3 days
            await eraManager.connect(wallet_0).updateEraPeriod(time.duration.days(3).toString());
        });
        it('timestampToEraNumber should work', async () => {
            await timeTravel(time.duration.days(3).toNumber());
            await eraManager.safeUpdateAndGetEra();
            expect(await eraManager.eraNumber()).to.equal(2);
            let timestamp = await lastestBlockTime();
            expect(await eraManager.timestampToEraNumber(timestamp)).to.equal(2);
            timestamp += time.duration.days(13).toNumber();
            expect(await eraManager.timestampToEraNumber(timestamp)).to.equal(6);
            await timeTravel(time.duration.days(3).toNumber());
            await eraManager.safeUpdateAndGetEra();
            await timeTravel(time.duration.days(3).toNumber());
            await eraManager.safeUpdateAndGetEra();
            await timeTravel(time.duration.days(3).toNumber());
            await eraManager.safeUpdateAndGetEra();
            await timeTravel(time.duration.days(4).toNumber());
            await eraManager.safeUpdateAndGetEra();
            expect(await eraManager.eraNumber()).to.equal(6);
            await eraManager.safeUpdateAndGetEra();
            expect(await eraManager.eraNumber()).to.equal(6);
        });
        it('passed timestamp 2 EraNumber should fail', async () => {
            await timeTravel(time.duration.days(3).toNumber());
            await eraManager.safeUpdateAndGetEra();
            let timestamp = (await eraManager.eraStartTime()).toNumber();
            expect(await eraManager.timestampToEraNumber(timestamp)).to.equal(2);
            timestamp -= 100;
            await expect(eraManager.timestampToEraNumber(timestamp)).to.be.revertedWith('E003');
        });
    });
});
