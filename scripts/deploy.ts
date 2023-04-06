import { StaticJsonRpcProvider } from '@ethersproject/providers';
import {writeFileSync} from 'fs';

import setup from './setup';
import {deployContracts, saveDeployment} from './deployContracts';

const main = async () => {
    const {name, config, wallet, confirms, hisotry} = await setup(process.argv);
    const [deployment] = await deployContracts(wallet, config.contracts, { network: name, confirms, history });

    saveDeployment(name, deployment);
};

main();
