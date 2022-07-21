// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import {BigNumber} from 'ethers';
import {deployContracts} from './setup';
import {METADATA_HASH, DEPLOYMENT_ID} from './constants';
import {
    IndexerRegistry,
    RewardsDistributer,
    RewardsPool,
    StateChannel,
    EraManager,
    SQToken,
} from '../src';
import {startNewEra, time, etherParse, timeTravel} from './helper';

describe('RewardsPool Contract', () => {
    //
});
