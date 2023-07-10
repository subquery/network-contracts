// @ts-nocheck

import { ContractDeployment, SubqueryNetwork } from './types';
// The path is compatible with `build` folder
import mainnetDeployment from '../publish/mainnet.json';
import keplerDeployment from './publish/kepler.json';
import testnetDeployment from './publish/testnet.json';

export const DEPLOYMENT_DETAILS: Record<SubqueryNetwork, ContractDeployment> = {
  mainnet: mainnetDeployment,
  kepler: keplerDeployment,
  testnet: testnetDeployment,
  local: testnetDeployment,
};