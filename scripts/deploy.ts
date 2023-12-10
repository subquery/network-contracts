import setup from './setup';
import {deployContracts, deployRootContracts, saveDeployment} from './deployContracts';

const main = async () => {
    try {
        const {name, config, rootProvider, childProvider, target, wallet, confirms, history} = await setup();
        let result;
        if (target === 'root') {
            result = await deployRootContracts(wallet.connect(rootProvider), config.contracts, { network: name, confirms, history });
            if (!result) {
                console.log('Failed to deploy contracts!');
                return;
            }
        } else if (target === 'child') {
            result = await deployContracts(wallet.connect(childProvider), config.contracts, { network: name, confirms, history });
            if (!result) {
                console.log('Failed to deploy contracts!');
                return;
            }
        }
    
        const [deployment] = result;
        saveDeployment(name, deployment);
    } catch (error) {
        console.log(`Failed to deploy contracts: ${error}`);
    }
};

main();
