import moduleAlias from 'module-alias';
moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

import {JsonRpcProvider} from '@ethersproject/providers';
import {ContractSDK} from '../src';
import assert from 'assert';
import {Wallet} from '@ethersproject/wallet';
import {utils} from 'ethers';
import {create} from 'ipfs-http-client';
import yaml from 'js-yaml';
import {Context, loaders} from '../test/fixtureLoader';
import fs from 'fs';


async function init(): Promise<Context> {
    const ENDPOINT = process.env['ENDPOINT'] ?? 'https://rpc.ankr.com/polygon_mumbai';
    const provider = new JsonRpcProvider(ENDPOINT);
    const sdk = await ContractSDK.create(provider, {network: 'testnet'});
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
