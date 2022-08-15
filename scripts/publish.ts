import dotenv from 'dotenv';
import {ApiPromise, WsProvider} from '@polkadot/api';
import {keyring} from '@polkadot/ui-keyring';
import fs, {writeFileSync} from 'fs';
import {DeploymentConfig} from '../src/types';
import localConfig from './config/local.config';
import testnetConfig from './config/testnet.config';
import mainnetConfig from './config/mainnet.config';
import keplerConfig from './config/kepler.config';

dotenv.config();

const main = async () => {
    let config: DeploymentConfig;

    switch (process.argv[2]) {
        case '--mainnet':
            config = mainnetConfig as DeploymentConfig;
            break;
        case '--testnet':
            config = testnetConfig as DeploymentConfig;
            break;
        case '--kepler':
            config = keplerConfig as DeploymentConfig;
            break;
        default:
            config = localConfig();
    }

    const seed = process.env.SEED;

    const wsProvider = new WsProvider(process.env.WS_ENDPOINT);
    const api = await ApiPromise.create({provider: wsProvider});

    keyring.loadAll({ss58Format: 42, type: 'sr25519'});
    const {pair, json} = keyring.addUri(seed, 'password', {name: 'subquery acc'});

    const filePath = `${__dirname}/../publish/${config.network.name}.json`;
    let deployment = JSON.parse(fs.readFileSync(filePath, {encoding: 'utf8'}));

    for (var key in deployment) {
        if (deployment.hasOwnProperty(key)) {
            const value = deployment[key];
            if (value.innerAddress != '') {
                await publishContract(api, pair, 'inner-' + key, value.innerAddress);
            }
            if (value.address != '') {
                await publishContract(api, pair, key, value.address);
            }
        }
    }

    if (api) {
        await api.disconnect();
    }
};

const publishContract = async (api, pair, key, address) => {
    const is_published = (await api.query.evm.accounts(address)).toJSON().contractInfo.published;
    if (is_published) {
        console.log(`${key} is published`);
    } else {
        console.log(`start publish ${key} : ${address}`);

        return new Promise(function (resolve, reject) {
            api.tx.evm.publishContract(address).signAndSend(pair, ({events = [], status}) => {
                if (status.isFinalized) {
                    events.forEach(({event: {data, method, section}, phase}) => {
                        if (method == 'ExtrinsicSuccess') {
                            console.log(`${key} published success`);
                        } else if (method == 'ExtrinsicFailed') {
                            console.log(`${key} published fail`);
                        }
                    });
                    resolve(true);
                }
            });
        });
    }
};

main();
