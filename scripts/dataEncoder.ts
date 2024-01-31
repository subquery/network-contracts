import { ContractSDK } from '../src';
import setup from './setup';

const main = async () => {
    const proxy = process.argv[2];
    const newLogic = process.argv[3];
    const { wallet } = await setup(['', '', '--testnet']);
    const sdk = await ContractSDK.create(wallet);
    const data = sdk.proxyAdmin.interface.encodeFunctionData('upgrade', [proxy, newLogic]);
    console.log(data);
};

main();
