// @ts-nocheck

import { ContractDeployment, SubqueryNetwork } from './types';

import mainnetDeployment from './publish/mainnet.json';
import testnetDeployment from './publish/testnet.json';

export const DEPLOYMENT_DETAILS: Record<SubqueryNetwork, ContractDeployment> = {
  mainnet: mainnetDeployment,
  testnet: testnetDeployment,
};