// @ts-nocheck

import { ContractDeployment, SubqueryNetwork } from './types';

import keplerDeployment from './publish/kepler.json';
import mainnetDeployment from './publish/mainnet.json';
import testnetDeployment from './publish/testnet.json';
import baseGoerliDeployment from './publish/base-goerli.json';

export const DEPLOYMENT_DETAILS: Record<SubqueryNetwork, ContractDeployment> = {
  mainnet: mainnetDeployment,
  kepler: keplerDeployment,
  testnet: testnetDeployment,
  local: testnetDeployment,
  'testnet-base':baseGoerliDeployment,
};