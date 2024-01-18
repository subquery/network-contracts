// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { lastestTime, timeTravel } from './helper';
import { deployContracts } from './setup';
import { SQTGift } from 'build';
import { ERC20 } from '../src';

describe('Redeem Contract', () => {
    const mockProvider = waffle.provider;
    let wallet_0, wallet_1;
    let nft: SQTGift;
    let sqToken: ERC20;

    const deployer = () => deployContracts(wallet_0, wallet_1);
    before(async ()=>{
        [wallet_0, wallet_1] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const deployment = await waffle.loadFixture(deployer);
        nft = deployment.sqtGift;
        sqToken = deployment.token;
    });

    describe('Redeem Configuration', () => {
      it('should be able to set redeemable ammount', async () => {
        // test
      })
    })
  });