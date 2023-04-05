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
            InflationController: [1000, wallet1.address], // inflationRate, inflationDestination
            SQToken: [etherParse("10000000000")], // initial supply 10 billion
            Staking: [1000, 1e3], // LockPeriod
            Airdropper: [ZERO_ADDRESS], // settle destination
            EraManager: [60 * 60 * 24], 
            ServiceAgreementRegistry: [0], //threshold
            PurchaseOfferMarket: [1e5, ZERO_ADDRESS],
            IndexerRegistry: [etherParse("1000")],
            ConsumerHost: [1], // Fee Percentage, default is 1%
            DisputeManager: [etherParse("1000")], // minimumDeposit
        }
    );

    return contracts;
};
