// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import moduleAlias from 'module-alias';
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

import { Wallet as EthWallet, constants, utils } from 'ethers';
import { ZERO_ADDRESS } from './constants';
import { Wallet, etherParse } from './helper';

import { deployContracts as deploy, deployRootContracts as deployRoot } from '../scripts/deployContracts';
import { SQContracts } from "../src";

export const deployContracts = async (wallet: Wallet, wallet1: Wallet, treasury=wallet) => {
    const signer = wallet as EthWallet;
    const [_, contracts] = await deploy(
        signer,
        {
            InflationController: [1000, wallet1.address],
            SQToken: [constants.AddressZero, etherParse("10000000000").toString()],
            Staking: [1000, 1e3],
            Airdropper: [ZERO_ADDRESS],
            EraManager: [60 * 60 * 24],
            ServiceAgreementRegistry: [],
            ServiceAgreementExtra: [1e6],
            PurchaseOfferMarket: [1e5, ZERO_ADDRESS],
            IndexerRegistry: [etherParse("1000").toString()],
            ConsumerHost: [1],
            DisputeManager: [etherParse("1000").toString()],
            Settings: [],
            VSQToken: [],
            StakingManager: [],
            ProjectRegistry: [],
            PlanManager: [],
            RewardsDistributer: [],
            RewardsPool: [],
            RewardsStaking: [],
            RewardsHelper: [],
            ProxyAdmin: [],
            StateChannel: [],
            PermissionedExchange: [],
            TokenExchange: [],
            Vesting: [],
            ConsumerRegistry: [],
            PriceOracle: [],
            RewardsBooster: [utils.parseEther("10").toString(), utils.parseEther("10000").toString()], // _issuancePerBlock, _minimumDeploymentBooster
        }
    );
    await contracts.settings.setContractAddress(SQContracts.Treasury, treasury.address);

    return contracts;
};

export const deployRootContracts = async (wallet: Wallet, wallet1: Wallet) => {
    const signer = wallet as EthWallet;
    const [_, contracts] = await deployRoot(
        signer,
        {
            InflationController: [1000, wallet1.address],
            SQToken: [etherParse("10000000000").toString()],
            VTSQToken: [0], 
        }
    );

    return contracts;
};
