// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {AccountSigningKey, Provider, Signer} from '@acala-network/bodhi';
import {Wallet} from '@ethersproject/wallet';
import {WsProvider} from '@polkadot/api';
import {createTestPairs} from '@polkadot/keyring/testingPairs';
import moduleAlias from 'module-alias';
import {ZERO_ADDRESS} from './constants';

moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

import {deployContracts as deploy} from '../scripts/deployContracts';

const WS_URL = process.env.WS_URL || 'ws://127.0.0.1:9944';

const setup = async () => {
    const provider = new Provider({
        provider: new WsProvider(WS_URL),
    });

    await provider.api.isReady;

    const testPairs = createTestPairs();
    const signingKey = new AccountSigningKey(provider.api.registry);
    const testSigners = Object.keys(testPairs).reduce<{
        [key: string]: Signer;
    }>((acc, key) => {
        const pair = testPairs[key];
        signingKey.addKeyringPair(pair);
        acc[key] = new Signer(provider, pair.address, signingKey);
        return acc;
    }, {});

    return {
        testSigners,
        provider,
    };
};

export const deployContracts = async (wallet: Wallet, wallet1: Wallet) => {
    const [_, contracts] = await deploy(
        wallet,
        {
            InflationController: [1000, wallet1.address],
            Staking: [1000],
            EraManager: [60 * 60 * 24],
            PurchaseOfferMarket: [1e5, ZERO_ADDRESS],
            ServiceAgreementRegistry: [0], //threshold
            IndexerRegistry: [1000e18],
        },
        {},
        true
    );

    return contracts;
};

export default setup;
