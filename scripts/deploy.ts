import setup from './setup';
import {deployContracts, saveDeployment} from './deployContracts';

const main = async () => {
    const {name, config, wallet, confirms, history} = await setup(process.argv);
    const result = await deployContracts(wallet, config.contracts, { network: name, confirms, history });
    if (!result) {
        console.log('Failed to deploy contracts');
        return;
    }

    const [deployment] = result;
    saveDeployment(name, deployment);
};

main();
