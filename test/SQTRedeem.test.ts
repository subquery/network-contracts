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
      it('should be able to update the redeemable status', async () => {

      });
      it('should be able to set redeemable ammount', async () => {

      });
      it('should be able to deposit and withdraw token', async () => {

      });
      it('only owner can call configuration function', async () => {

      });
    });

    describe('NFT Redeem', () => {
      beforeEach(async () => {
        // create series 0
        // mint nft token
      });
      it('should be able to redeem with valid NFT token', async () => {

      });
      it('should not be able to redeem with invalid NFT token', async () => {
        // 1. can not redeem if contract status is not redeemable
        // 2. can not redeem if nft address is incorrect
        // 3. can not redeem if nft token owner is not the sender
        // 4. can not redeem if redeemable amount is 0
        // 5. can not redeem if sqt token is not enough
      });
    });
  });