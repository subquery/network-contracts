import fs, { writeFileSync } from 'fs';
import { upgradeContracts } from './deployContracts';
import setup from './setup';

const main = async () => {
    const { name, wallet, confirms, checkOnly, implementationOnly } = await setup(process.argv);
    const filePath = `${__dirname}/../publish/${name}.json`;
    let deployment = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));

    const lastArg = process.argv[process.argv.length-1];
    if (!lastArg.startsWith('--')) {
        const matcher = lastArg;
        deployment = Object.entries(deployment).reduce((acc, [k, d]) => {
            if (k.startsWith(matcher) || k==='ProxyAdmin') {
                acc[k] = d;
            }
            return acc;
        }, {});

    }
    deployment = await upgradeContracts({
        wallet,
        deployment,
        confirms,
        checkOnly,
        implementationOnly,
    });

    writeFileSync(filePath, JSON.stringify(deployment, null, 4));
    console.log('Exported the deployment result to ', filePath);
};

main();
