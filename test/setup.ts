// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {Wallet} from '@ethersproject/wallet';
import moduleAlias from 'module-alias';
import {ZERO_ADDRESS} from './constants';

moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

import {deployContracts as deploy} from '../scripts/deployContracts';

export const deployContracts = async (wallet: Wallet, wallet1: Wallet) => {
    const [_, contracts] = await deploy(
        wallet,
        {
            InflationController: [1000, wallet1.address],
            Staking: [1000],
            EraManager: [60 * 60 * 24],
            PurchaseOfferMarket: [1e5, ZERO_ADDRESS],
            ServiceAgreementRegistry: [0], //threshold
            IndexerRegistry: ['1000000000000000000000'],
            ConsumerHost: [1], // Fee Percentage, default is 1%
            DisputeManager: ['1000000000000000000000'], // minimumDeposit
        }
    );

    return contracts;
};
