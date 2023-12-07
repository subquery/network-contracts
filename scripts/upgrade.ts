import fs, { writeFileSync } from 'fs';
import { upgradeContracts } from './deployContracts';
import setup from './setup';
import yargs from "yargs/yargs";
import {hideBin} from "yargs/helpers";

const main = async () => {
    const { name, wallet, childProvider, rootProvider, target, confirms, checkOnly, implementationOnly } = await setup();
    const filePath = `${__dirname}/../publish/${name}.json`;
    let deployment = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
    const matcher = yargs(hideBin(process.argv)).command("$0 [matcher]", "", (opt)=> opt.positional('matcher', {
        type: 'string',
    })).argv.matcher;
    await upgradeContracts({
        wallet: wallet.connect(target === 'root' ? rootProvider : childProvider),
        deployment,
        confirms,
        checkOnly,
        implementationOnly,
        target,
        matcher,
    });

    // writeFileSync(filePath, JSON.stringify(deployment, null, 4));
    console.log('Exported the deployment result to ', filePath);
};

main();
