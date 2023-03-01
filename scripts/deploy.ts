import { StaticJsonRpcProvider } from '@ethersproject/providers';
import {writeFileSync} from 'fs';

import setup from './setup';
import {deployContracts} from './deployContracts';

const main = async () => {
    const {name, config, wallet, provider, overrides} = await setup(process.argv[2]);
    const [deployment] = await deployContracts(wallet, config.contracts, overrides);

    const filePath = `${__dirname}/../publish/${name}.json`;
    writeFileSync(filePath, JSON.stringify(deployment, null, 4));
    console.log('Exported the deployment result to ', filePath);
};

main();
