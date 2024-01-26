import moduleAlias from 'module-alias';
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

import {JsonRpcProvider} from '@ethersproject/providers';
import { ContractSDK, SubqueryNetwork, networks } from '../src';
import assert from 'assert';
import {Wallet} from '@ethersproject/wallet';
import {utils} from 'ethers';
import {create} from 'ipfs-http-client';
import yaml from 'js-yaml';
import {Context, loaders} from '../test/fixtureLoader';
import fs from 'fs';
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

export const {argv} = yargs(hideBin(process.argv))
    .options({
        'network': {
            demandOption: true,
            describe: 'network',
            type: 'string',
            choices: ['testnet', 'mainnet'],
        },
    });

async function init(): Promise<Context> {
    const endpoint = process.env['ENDPOINT'] ?? networks[argv.network].child.rpcUrls[0];

    const provider = new JsonRpcProvider(endpoint);
    const sdk = await ContractSDK.create(provider, {network: argv.network as SubqueryNetwork});
    const rootAccountPK = process.env['PK'];
    assert(rootAccountPK, `can't find $PK in env`);
    return {
        sdk,
        provider,
        accounts: {},
        rootAccount: new Wallet(rootAccountPK, provider),
        ipfs: create({url: 'https://unauthipfs.subquery.network/ipfs/api/v0'}),
    };
}

async function main() {
    const context = await init();
    const fixtureFile = process.argv[process.argv.length - 1];
    const fixture = yaml.load(fs.readFileSync(fixtureFile, {encoding: 'utf-8'}));
    if (fixture instanceof Array) {
        for (const item of fixture) {
            const loader = loaders[item.kind];
            if (loader) {
                try {
                    await loader(item, context);
                } catch (e) {
                    console.error(`loader ${item.kind} failed`, e);
                }
            } else {
                console.error(`loader not found for ${item.kind}`);
            }
        }
    }
}

main();
