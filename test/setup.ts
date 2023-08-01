// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {Wallet} from '@ethersproject/wallet';
import moduleAlias from 'module-alias';
import {ZERO_ADDRESS} from './constants';
import {etherParse} from './helper'

moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

import {deployContracts as deploy} from '../scripts/deployContracts';

export const deployContracts = async (wallet: Wallet, wallet1: Wallet) => {
    const [_, contracts] = await deploy(
        wallet,
        {
            InflationController: [1000, wallet1.address],
            SQToken: [etherParse("10000000000")],
            Staking: [1000, 1e3],
            Airdropper: [ZERO_ADDRESS],
            EraManager: [60 * 60 * 24],
            ServiceAgreementRegistry: [0],
            PurchaseOfferMarket: [1e5, ZERO_ADDRESS],
            IndexerRegistry: [etherParse("1000")],
            ConsumerHost: [1],
            DisputeManager: [etherParse("1000")],
            Settings: [],
            VSQToken: [],
            StakingManager: [],
            QueryRegistry: [],
            PlanManager: [],
            RewardsDistributer: [],
            RewardsPool: [],
            RewardsStaking: [],
            RewardsHelper: [],
            ProxyAdmin: [],
            StateChannel: [],
            PermissionedExchange: [],
            Vesting: [],
            PriceOracle: [],
        }
    );

    return contracts;
};
