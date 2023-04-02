import fs, {writeFileSync} from 'fs';
import setup from './setup';
import {upgradeContracts} from './deployContracts';

const main = async () => {
    const {name, wallet, confirms} = await setup(process.argv[2]);
    const filePath = `${__dirname}/../publish/${name}.json`;
    let deployment = JSON.parse(fs.readFileSync(filePath, {encoding: 'utf8'}));

    deployment = await upgradeContracts(wallet, deployment, confirms);

    writeFileSync(filePath, JSON.stringify(deployment, null, 4));
    console.log('Exported the deployment result to ', filePath);
};

main();
