// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {ContractDeployment, SubqueryNetwork} from './types';

import mainnetDeployment from './publish/mainnet.json';
import testnetDeployment from './publish/testnet.json';

export const DEPLOYMENT_DETAILS: Partial<Record<SubqueryNetwork, ContractDeployment>> = {
    mainnet: mainnetDeployment,
    testnet: testnetDeployment,
};