const {ContractSDK} = require('@subql/contract-sdk');
const {testnetDeployment} = require('@subql/contract-sdk/publish/testnet.json');
const {ethers, Wallet, utils, providers, BigNumber} = require('ethers');
const {toBuffer} = require('ethereumjs-util');
const {EvmRpcProvider, calcEthereumTransactionParams} = require('@acala-network/eth-providers');
const web3 = require('web3');

//const WS_ENDPOINT = 'wss://acala-mandala.api.onfinality.io/public-ws';
const WS_ENDPOINT = 'wss://mandala-tc7-rpcnode.aca-dev.network/ws';
const ENDPOINT = 'https://acala-mandala.api.onfinality.io/public';
const INDEXER_PK = '0x328b0b2e15184a9c716bc927136d0b9229a0e666dbe70b9bb650de2625e0f63c';
const INDEXER_ADDR = '0x293a6d85DD0d7d290A719Fdeef43FaD10240bA77';
const SEED = '';
const METADATA_HASH = '0xab3921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55';

async function getOverrides(provider) {
    const options = {gasLimit: '2100000', storageLimit: '64000'};
    const gas = await provider._getEthGas(options);
    return gas;
}

function etherParse(etherNum) {
    return BigNumber.from(web3.utils.toWei(etherNum, 'ether'));
}

async function rootSetup(sdk) {
    //set eraPeriod: 1h
    console.log('eraPeriod check');
    let eraPeriod = await sdk.eraManager.eraPeriod();
    console.log('eraPeriod is: ' + eraPeriod.toNumber());
    if (eraPeriod.toNumber() != 3600) {
        console.log('set eraPeriod to 3600 ...');
        await sdk.eraManager.updateEraPeriod(3600);
        eraPeriod = await sdk.eraManager.eraPeriod();
        console.log('eraPeriod is: ' + eraPeriod.toNumber());
    }

    //set lockPeriod
    console.log('lockPeriod check');
    let lockPeriod = await sdk.staking.lockPeriod();
    console.log('lockPeriod is: ' + lockPeriod.toNumber());
    if (lockPeriod.toNumber() != 3600) {
        console.log('set lockPeriod to 3600 ...');
        await sdk.staking.setLockPeriod(3600);
        lockPeriod = await sdk.staking.lockPeriod();
        console.log('lockPeriod is: ' + lockPeriod.toNumber());
    }
}

async function indexerSetup(sdk, indexer_wallet) {
    console.log('check indexer status');
    const isIndexer = await sdk.indexerRegistry.isIndexer(INDEXER_ADDR);
    if (isIndexer) {
        console.log(INDEXER_ADDR + 'is an Indexer');
        console.log('METADATA_HASH: ' + (await sdk.indexerRegistry.metadataByIndexer(INDEXER_ADDR)));
        console.log('commissionRates: ' + (await sdk.staking.commissionRates(INDEXER_ADDR)));
        console.log('TotalStakingAmount: ' + (await sdk.staking.getTotalStakingAmount(INDEXER_ADDR)));
    } else {
        console.log(INDEXER_ADDR + 'is not an Indexer');
        console.log('start registerIndexer');
        await sdk.sqToken.connect(indexer_wallet).increaseAllowance(sdk.staking.address, etherParse('1000'));
        await sdk.indexerRegistry.connect(indexer_wallet).registerIndexer(etherParse('1000'), METADATA_HASH, 0);
        console.log('Indexer registered with: ');
        console.log('METADATA_HASH: ' + (await sdk.indexerRegistry.metadataByIndexer(INDEXER_ADDR)));
        console.log('commissionRates: ' + (await sdk.staking.commissionRates(INDEXER_ADDR)));
        console.log('TotalStakingAmount: ' + (await sdk.staking.getTotalStakingAmount(INDEXER_ADDR)));
    }

    const isIndexing = (await sdk.queryRegistry.deploymentStatusByIndexer(0, INDEXER_ADDR)).status;
    if (isIndexing != 'INDEXING') {
        console.log('strat indexing ...');
        await sdk.queryRegistry.connect(indexer_wallet).startIndexing(0);
    } else {
        console.log('Indexer is Indexing');
    }
}

async function main() {
    const provider = await EvmRpcProvider.from(WS_ENDPOINT);
    const hdNode = utils.HDNode.fromMnemonic(SEED).derivePath("m/44'/60'/0'/0/0");
    const root_wallet = new Wallet(hdNode, provider);
    const indexer_wallet = new Wallet(INDEXER_PK, provider);
    const sdk = await ContractSDK.create(root_wallet, {
        deploymentDetails: testnetDeployment,
        network: 'testnet',
    });

    const overrides = await getOverrides(provider);

    await rootSetup(sdk);

    await indexerSetup(sdk, indexer_wallet);
}

main();
