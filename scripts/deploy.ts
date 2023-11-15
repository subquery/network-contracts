import setup from './setup';
import {deployContracts, saveDeployment} from './deployContracts';

const main = async () => {
    try {
        const {name, config, wallet, confirms, history} = await setup();
        const result = await deployContracts(wallet, config.contracts, { network: name, confirms, history });
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
