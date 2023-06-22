// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {deployContracts} from './setup';
import {ConsumerRegistry, ConsumerHost, Settings} from '../src';
import {ZERO_ADDRESS} from './constants';
import {etherParse, futureTimestamp, timeTravel, lastestTime} from './helper';

describe('ConsumerRegistry Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2, wallet_3;
    let consumerRegistry: ConsumerRegistry;
    let consumerHost: ConsumerHost;

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2, wallet_3] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_1);
        consumerRegistry = deployment.consumerRegistry;
        consumerHost = deployment.consumerHost;
    });

    describe('controller check', () => {
        it('add & remove common controller', async () => {
            await consumerRegistry.addController(wallet_0.address, wallet_1.address);
            expect(await consumerRegistry.isController(wallet_0.address, wallet_1.address)).to.equal(true);

            await consumerRegistry.removeController(wallet_0.address, wallet_1.address);
            expect(await consumerRegistry.isController(wallet_0.address, wallet_1.address)).to.equal(false);
        });
        it('add & remove consumer controller', async () => {
            await consumerHost.addSigner(wallet_1.address);

            await consumerRegistry.connect(wallet_1).addController(consumerHost.address, wallet_2.address);
            expect(await consumerRegistry.isController(consumerHost.address, wallet_2.address)).to.equal(true);

            await consumerRegistry.connect(wallet_1).removeController(consumerHost.address, wallet_2.address);
            expect(await consumerRegistry.isController(consumerHost.address, wallet_2.address)).to.equal(false);
        });
    });
});
