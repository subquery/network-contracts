import {JsonRpcProvider} from '@ethersproject/providers';
import {Wallet} from '@ethersproject/wallet';
import {utils} from 'ethers';
import assert from 'assert';
import moduleAlias from 'module-alias';
import {create} from 'ipfs-http-client';
import yaml from 'js-yaml';
import fs from 'fs';

import {ContractSDK} from '../src';
import {Context, loaders} from '../test/fixtureLoader';

moduleAlias.addAlias('./publish', '../publish');
moduleAlias.addAlias('./artifacts', '../artifacts');

async function init(): Promise<Context> {
    const ENDPOINT = process.env['ENDPOINT'];
    assert(ENDPOINT, `can't find $ENDPOINT in env`);
    const provider = new JsonRpcProvider(ENDPOINT);
    const sdk = await ContractSDK.create(provider, {network: 'testnet'});
    const rootAccountSeed = process.env['SEED'];
    assert(rootAccountSeed, `can't find $SEED in env`);

    return {
        sdk,
        provider,
        accounts: {},
        rootAccount: new Wallet(utils.HDNode.fromMnemonic(rootAccountSeed).derivePath(`m/44'/60'/0'/0/0`), provider),
        ipfs: create({url: 'https://ipfs.thechainhub.com/api/v0'}),
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
