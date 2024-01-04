// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { eventFrom } from './helper';
import { deployProxy } from "../scripts/deployContracts";
import { deployContracts } from "./setup";
import { ProxyAdmin__factory, SQTGift, SQTGift__factory } from '../src';

describe('SQT Gift Nft', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2;
    let nft: SQTGift;

    const deployer = async () => {
        const deployment = await deployContracts(wallet_0, wallet_1);
        const proxyAdmin = await new ProxyAdmin__factory(wallet_0).deploy();
        const [_nft] = await deployProxy<SQTGift>(proxyAdmin, SQTGift__factory, wallet_0, 1);
        await _nft.initialize();
        return _nft;
    };
    before(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        nft = await waffle.loadFixture(deployer);
    });

    describe('Serie Config', () => {
        it('add series', async () => {
            const tx = await nft.createSeries(100, "abc");
            const event = await eventFrom(tx, nft, 'SeriesCreated(uint256,uint256,string)');
            expect(event.seriesId).to.eq(0);
            expect(event.maxSupply).to.eq(100);
            expect(event.tokenURI).to.eq("abc");
        });
        it('add allowList', async () => {
            await nft.createSeries(100, "abc");
            const tx = await nft.addToAllowlist(0, wallet_1.address, 1);
            const event = await eventFrom(tx, nft, 'AllowListAdded(address,uint256,uint8)');
            expect(event.account).to.eq(wallet_1.address);
            expect(event.seriesId).to.eq(0);
        });
        it('add allowList for non exist series', async () => {
            await expect(nft.addToAllowlist(0, wallet_1.address, 1)).to.revertedWith('SQG001');
            await nft.createSeries(100, "abc");
            await expect(nft.addToAllowlist(0, wallet_1.address, 1)).not.reverted;
        });
    });

    describe('Mint Tokens', () => {
        beforeEach(async () => {
            await nft.createSeries(100, "series0");
            await nft.createSeries(50, "series1");
            await nft.addToAllowlist(0, wallet_1.address, 1);
            await nft.addToAllowlist(1, wallet_1.address, 1);
        })
        it('mint with allowed wallet', async () => {
            let tx = await nft.connect(wallet_1).mint(0);
            const event = await eventFrom(tx, nft, 'Transfer(address,address,uint256)')
            expect(await nft.ownerOf(event.tokenId)).to.eq(wallet_1.address);
            tx = await nft.connect(wallet_1).mint(1);
            const event2 = await eventFrom(tx, nft, 'Transfer(address,address,uint256)')
            expect(event.tokenId).not.eq(event2.tokenId);
        });
        it('mint with allowed wallet 2', async () => {
            await nft.connect(wallet_1).mint(0);
            await expect(nft.connect(wallet_1).mint(0)).to.revertedWith('SQG002');
            await nft.addToAllowlist(0, wallet_1.address, 1);
            await nft.connect(wallet_1).mint(0);
            const token2Series = await nft.getSeries(1);
            expect(token2Series).to.eq(0);
        });
        it('can not mint when exceed max supply', async () => {
            // series 2
            await nft.createSeries(1, "series1");
            await nft.addToAllowlist(2, wallet_1.address, 2);
            await nft.connect(wallet_1).mint(2);
            await expect(nft.connect(wallet_1).mint(2)).to.revertedWith('SQG005');
            await nft.setMaxSupply(2, 2);
            await expect(nft.connect(wallet_1).mint(2)).not.reverted;
        });
        it('can not mint when deactived', async () => {
            await nft.setSeriesActive(0, false);
            await expect(nft.connect(wallet_1).mint(0)).to.revertedWith('SQG004');
            await nft.setSeriesActive(0, true);
            await expect(nft.connect(wallet_1).mint(0)).not.reverted;
        });
    });
});
