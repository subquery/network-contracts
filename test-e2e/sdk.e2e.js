const { ContractSDK } = require("../build/build");
const { ethers } = require("ethers");

const TEST_INDEXER = '0x00000045E65842029beF40B5840B4CCED90F6777';

describe('network sdk', () => {
    let sdk;
    before(async () => {
        sdk = await ContractSDK.create(new ethers.providers.StaticJsonRpcProvider('https://acala-mandala-adapter.api.onfinality.io/public'));
    });

    it('can get indexer detail', async () => {
        const eraPeriod = await sdk.eraManager.eraPeriod();
        console.log(`eraPeriod: ${eraPeriod.toString()}`)
    })
});
