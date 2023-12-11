import moduleAlias from 'module-alias';
moduleAlias.addAlias('./artifacts', '../artifacts');
moduleAlias.addAlias('./publish', '../publish');

import { DeploymentConfig, networks, SubqueryNetwork } from '../src';
import {setupCommon} from './setup';
import {deployRootContracts, saveDeployment} from './deployContracts';
import contractsConfig from './config/contracts.config';

const main = async () => {
    try {
        const name = 'testnet';
        const { wallet, rootProvider, childProvider, overrides } = await setupCommon(networks.testnet);
        const result = await deployRootContracts(wallet.connect(rootProvider), contractsConfig.testnet as any, { network: name, confirms: 3, history: true });
        if (!result) {
            console.log('Failed to deploy contracts!');
            return;
        }
    
        const [deployment] = result;
        saveDeployment(name, deployment);
    } catch (error) {
        console.log(`Failed to deploy contracts: ${error}`);
    }
};

main();
