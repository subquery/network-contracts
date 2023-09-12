import fs, { writeFileSync } from 'fs';
import { upgradeContracts } from './deployContracts';
import setup from './setup';

const main = async () => {
    const { name, wallet, confirms, checkOnly } = await setup(process.argv);
    const filePath = `${__dirname}/../publish/${name}.json`;
    let deployment = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));

    deployment = await upgradeContracts({
        wallet,
        deployment,
        confirms,
        checkOnly,
    });

    writeFileSync(filePath, JSON.stringify(deployment, null, 4));
    console.log('Exported the deployment result to ', filePath);
};

main();
