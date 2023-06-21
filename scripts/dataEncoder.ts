import {ContractSDK} from '../src';
import setup from './setup';

const main = async () => {
    let proxy = process.argv[2];
    let newLogic = process.argv[3];
    const {wallet} = await setup(["","","--testnet"]);
    let sdk = await ContractSDK.create(wallet);
    let data = sdk.proxyAdmin.interface.encodeFunctionData("upgrade",[proxy,newLogic])
    console.log(data);
}

main();