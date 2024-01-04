// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { eventFrom, eventsFrom } from './helper';
import { deployContracts } from "./setup";
import { SQTGift } from '../src';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe('SQT Gift Nft', () => {
    const mockProvider = waffle.provider;
    let wallet_0: SignerWithAddress, wallet_1: SignerWithAddress, wallet_2: SignerWithAddress;
    let nft: SQTGift;

    const deployer = async () => {
        const deployment = await deployContracts(wallet_0, wallet_1);
        return deployment.sqtGift;
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
        it('batch add allowList', async () => {
            await nft.createSeries(100, "token0");
            await nft.createSeries(100, "token1");
            const tx = await nft.batchAddToAllowlist(
                [0,0,1,0],
                [wallet_1.address,wallet_2.address,wallet_1.address,wallet_1.address],
                [1,2,1,5]);
            const events = await eventsFrom(tx, nft, 'AllowListAdded(address,uint256,uint8)');
            expect(events.length).to.eq(4);
            expect(await nft.allowlist(wallet_1.address,0)).to.eq(6);
            expect(await nft.allowlist(wallet_1.address,1)).to.eq(1);
            expect(await nft.allowlist(wallet_2.address,0)).to.eq(2);
            expect(await nft.allowlist(wallet_2.address,1)).to.eq(0);
        })
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
        it('can batch mint token', async () => {
            await nft.addToAllowlist(0, wallet_2.address, 10);
            await nft.connect(wallet_2).batchMint(0);
            expect(await nft.balanceOf(wallet_2.address)).to.eq(10);
        })
    });
});
