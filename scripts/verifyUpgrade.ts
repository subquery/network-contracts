import Web3 from "web3";

import { argv } from "./setup";
import MainnetImpl from '../publish/mainnet.json';
import contracts from '../src/contracts';
import { getLogger } from './logger';

const main = async () => {
    const target = argv.target ?? 'child';
    const contractsImpl = MainnetImpl[target];
    const web3 = new Web3('https://base.llamarpc.com');
    const logger = getLogger('verifyUpgrade');

    for (const name in contractsImpl) {
        const contract = contractsImpl[name];
        const address = contract.innerAddress;
        if (!address) continue;

        const contractInfo = contracts[name];
        if (!contractInfo) {
            logger.error(`Contract not found: ${name}`);
            continue;
        }

        const localBytecode = contractInfo.deployedBytecode;
        const remoteBytecode = await web3.eth.getCode(address);
        if (remoteBytecode !== localBytecode) {
            logger.info(`🚨 Bytecode mismatch for contract: ${name}`);
        } else {
            logger.info(`🚀 Contract verification succeed: ${name}`);
        }
    }
}

main();