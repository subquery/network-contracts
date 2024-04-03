// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { ConsumerHost, ConsumerRegistry } from '../src';
import { deployContracts } from './setup';

describe('ConsumerRegistry Contract', () => {
    let wallet_0, wallet_1, wallet_2;
    let consumerRegistry: ConsumerRegistry;
    let consumerHost: ConsumerHost;

    const deployer = () => deployContracts(wallet_0, wallet_1);
    before(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        consumerRegistry = deployment.consumerRegistry;
        consumerHost = deployment.consumerHost;
    });

    describe('whitelist management', () => {
        it('add & remove consumer whitelist', async () => {
            const account = wallet_0.address;
            await expect(consumerRegistry.addWhitelist(account)).to.be.emit(consumerRegistry, 'WhitelistUpdated').withArgs(account, true);
            expect(await consumerRegistry.whitelist(account)).to.equal(true);

            await expect(consumerRegistry.removeWhitelist(account)).to.be.emit(consumerRegistry, 'WhitelistUpdated').withArgs(account, false);
            expect(await consumerRegistry.whitelist(account)).to.equal(false);
        });
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
