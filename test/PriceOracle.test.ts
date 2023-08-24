// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { PriceOracle } from '../src';
import { blockTravel, etherParse } from './helper';
import { deployContracts } from './setup';

describe('PriceOracle Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1, wallet_2;
    let priceOracle: PriceOracle;
    const assetFrom = '0x0000000000000000000000000000000000000000';
    const assetTo = '0x0000000000000000000000000000000000000001';
    const price = 100; // 1 assetA to 100 assetB

    beforeEach(async () => {
        [wallet_0, wallet_1, wallet_2] = await ethers.getSigners();
        const deployment = await deployContracts(wallet_0, wallet_1);
        priceOracle = deployment.priceOracle;
        await priceOracle.setAssetPrice(assetFrom, assetTo, 1, price);
    });

    describe('update paramsters', () => {
        it('change price change limit', async () => {
            await priceOracle.setLimit(10, 100);
            expect(await priceOracle.sizeLimit()).to.equal(10);
            expect(await priceOracle.blockLimit()).to.equal(100);
        });
        it('change controller', async () => {
            await priceOracle.setController(wallet_1.address);
            expect(await priceOracle.controller()).to.equal(wallet_1.address);
        });
    });
    describe('convert price', () => {
        it('can convert as price specified', async () => {
            const fromPrice = 1e12;
            const price = 100;
            const enlargement = await priceOracle.enlargementFactor();
            expect(await priceOracle.getAssetPrice(assetFrom,assetTo)).to.eq(enlargement.mul(price));
            const toPrice = await priceOracle.convertPrice(assetFrom, assetTo, fromPrice);
            await expect(toPrice.toNumber()).to.eq(fromPrice*price)
        })
        it('return directly for same asset', async () => {
            const fromPrice = 1e12;
            const toPrice = await priceOracle.convertPrice(assetFrom, assetFrom, fromPrice);
            await expect(toPrice).to.eq(fromPrice)
        })
    })

    describe('set price', () => {
        it('controller set price should work', async () => {
            await priceOracle.setLimit(10, 100);
            await priceOracle.setController(wallet_1.address);

            await blockTravel(mockProvider, 100);

            const price1 = (price / 100) * 91; // -9%
            await priceOracle.connect(wallet_1).setAssetPrice(assetFrom, assetTo, 1, price1);
            await priceOracle.setAssetPrice(assetFrom, assetTo,1, price);

            // time limit
            await expect(priceOracle.connect(wallet_1).setAssetPrice(assetFrom, assetTo, 1, price1)).to.be.revertedWith(
                'OR002'
            );

            await blockTravel(mockProvider, 100);

            const price2 = (price / 100) * 109; // +9%
            await priceOracle.connect(wallet_1).setAssetPrice(assetFrom, assetTo, 1, price2);
            await priceOracle.setAssetPrice(assetFrom, assetTo, 1, price);

            await blockTravel(mockProvider, 100);

            const price3 = (price / 100) * 110; // +10%
            await expect(priceOracle.connect(wallet_1).setAssetPrice(assetFrom, assetTo, 1, price3)).to.be.revertedWith(
                'OR003'
            );
        });
        it('owner set price should work', async () => {
            const price1 = (price / 100) * 110; // +10%
            await expect(priceOracle.connect(wallet_2).setAssetPrice(assetFrom, assetTo, 1, price1)).to.be.revertedWith(
                'OR004'
            );

            await expect(priceOracle.setAssetPrice(assetFrom, assetTo, 1, price1));
        });
    });
});
