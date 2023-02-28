import {writeFileSync} from 'fs';

import setup from './setup';
import {deployContracts} from './deployContracts';

const main = async () => {
    const {config, wallet, provider, overrides} = await setup(process.argv[2]);
    const [deployment] = await deployContracts(wallet, config.contracts, overrides);

    const filePath = `${__dirname}/../publish/${config.network.name}.json`;
    writeFileSync(filePath, JSON.stringify(deployment, null, 4));
    console.log('Exported the deployment result to ', filePath);

    if ((provider as EvmRpcProvider).api) {
        await (provider as EvmRpcProvider).api.disconnect();
    }
};

main();
