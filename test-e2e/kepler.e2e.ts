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
const CONSUMER_PK = '0x1674fe269be296e21f6440f15087de29969f8015003887955e99b7cac5455353';
const CONSUMER_ADDR = '0x301ce005Ea3f7d8051462E060f53d84Ee898dFDe';
const SEED = 'weasel train face endless hello melody unable angry notable half lunch rack';
const METADATA_HASH = '0xab3921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55';
const DEPLOYMENT_ID = 'Qmf5vn3LZhSkj7q47z2VVxZ7pxf2hRGLVXgqo2TvNWAXvp';
const VERSION = '0xaec921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55';

let root_wallet, indexer_wallet, consumer_wallet;
let sdk;

async function getOverrides(provider) {
    const options = {gasLimit: '2100000', storageLimit: '64000'};
    const gas = await provider._getEthGas(options);
    return gas;
}

function etherParse(etherNum) {
    return BigNumber.from(web3.utils.toWei(etherNum, 'ether'));
}

function cidToBytes32(cid) {
    return '0x' + Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex');
}

async function rootSetup() {
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

async function queryProjectSetup() {
    const next = await sdk.queryRegistry.nextQueryId();
    if (next.toNumber() == 0) {
        console.log('start create query project 0 ...');
        await sdk.queryRegistry.createQueryProject(METADATA_HASH, VERSION, DEPLOYMENT_ID);
    }

    const info = await sdk.queryRegistry.queryInfos(0);
    if (info.latestDeploymentId != cidToBytes32(DEPLOYMENT_ID)) {
        console.log('start update query project 0 ...');
        await sdk.queryRegistry.updateDeployment(0, cidToBytes32(DEPLOYMENT_ID), VERSION);
        await sdk.queryRegistry.updateQueryProjectMetadata(0, METADATA_HASH);
    }

    console.log('QueryProject 0: ');
    console.log('latestVersion: ' + info.latestVersion);
    console.log('latestDeploymentId: ' + info.latestDeploymentId);
    console.log('metadata: ' + info.metadata);
}

async function planTemplateSetup() {
    const next = await sdk.planManager.planTemplateIds();
    if (next.toNumber() == 0) {
        console.log('start create planTemplate 0 ...');
        await sdk.planManager.createPlanTemplate(10800, 10000, 10000, METADATA_HASH);
    }
    const info = await sdk.planManager.planTemplates(0);
    if (info.metadata != METADATA_HASH) {
        console.log('start update PlanTemplate metadata ...');
        await sdk.planManager.updatePlanTemplateMetadata(0, METADATA_HASH);
    }

    console.log('PlanTemplate 0: ');
    console.log('period: ' + info.period);
    console.log('rateLimit: ' + info.rateLimit);
    console.log('metadata: ' + info.metadata);
    console.log('active: ' + info.active);
}

async function indexerSetup(overrides) {
    console.log('check indexer status');
    const isIndexer = await sdk.indexerRegistry.isIndexer(INDEXER_ADDR);
    if (isIndexer) {
        console.log(INDEXER_ADDR + 'is an Indexer');
    } else {
        console.log(INDEXER_ADDR + ' is not an Indexer');
        console.log('start registerIndexer');
        await sdk.sqToken.connect(indexer_wallet).increaseAllowance(sdk.staking.address, etherParse('1000'));
        await sdk.indexerRegistry
            .connect(indexer_wallet)
            .registerIndexer(etherParse('1000'), METADATA_HASH, 0, overrides);
        console.log('Indexer registered with: ');
    }
    console.log('METADATA_HASH: ' + (await sdk.indexerRegistry.metadataByIndexer(INDEXER_ADDR)));
    console.log('commissionRates: ' + (await sdk.staking.getCommissionRate(INDEXER_ADDR)));
    console.log('TotalStakingAmount: ' + (await sdk.staking.getTotalStakingAmount(INDEXER_ADDR)));

    let indexingStatus = (await sdk.queryRegistry.deploymentStatusByIndexer(cidToBytes32(DEPLOYMENT_ID), INDEXER_ADDR))
        .status;
    if (indexingStatus != 2) {
        if (indexingStatus == 0) {
            console.log('strat indexing ...');
            await sdk.queryRegistry.connect(indexer_wallet).startIndexing(cidToBytes32(DEPLOYMENT_ID));
        }
        await sdk.queryRegistry.connect(indexer_wallet).updateIndexingStatusToReady(cidToBytes32(DEPLOYMENT_ID));
    }
    indexingStatus = (await sdk.queryRegistry.deploymentStatusByIndexer(cidToBytes32(DEPLOYMENT_ID), INDEXER_ADDR))
        .status;
    console.log(`Indexing status: ${indexingStatus}`);
}

async function planManagerTest(overrides) {
    await sdk.planManager.connect(indexer_wallet).removePlan(1);
    console.log(await sdk.planManager.planCount(INDEXER_ADDR));
    console.log('indexer create a plan ...');
    await sdk.planManager.connect(indexer_wallet).createPlan(etherParse('10'), 0, cidToBytes32(DEPLOYMENT_ID));
    const planCount = await sdk.planManager.planCount(INDEXER_ADDR);
    const plan = await sdk.planManager.plans(INDEXER_ADDR, planCount);
    console.log(`plan created with index ${planCount}: `);
    console.log('price: ' + plan.price);
    console.log('planTemplateId: ' + plan.planTemplateId);
    console.log('deploymentId: ' + plan.deploymentId);
    console.log('active: ' + plan.active);

    console.log('consumer accept a plan ...');
    await sdk.sqToken.connect(consumer_wallet).increaseAllowance(sdk.planManager.address, etherParse('10'));
    await sdk.planManager
        .connect(consumer_wallet)
        .acceptPlan(INDEXER_ADDR, cidToBytes32(DEPLOYMENT_ID), planCount, overrides);
    const agreementId = (await sdk.serviceAgreementRegistry.nextServiceAgreementId()).toNumber() - 1;
    const agreement = await sdk.serviceAgreementRegistry.closedServiceAgreements(agreementId);
    console.log('created agreemnt: ');
    console.log('consumer: ' + agreement.consumer);
    console.log('indexer: ' + agreement.indexer);
    console.log('deploymentId: ' + agreement.deploymentId);
    console.log('lockedAmount: ' + agreement.lockedAmount);
    console.log('startDate: ' + agreement.startDate);
    console.log('period: ' + agreement.period);
    console.log('planId: ' + agreement.planId);
    console.log('planTemplateId: ' + agreement.planTemplateId);

    await sdk.planManager.connect(indexer_wallet).removePlan(planCount);
}

async function main() {
    const provider = await EvmRpcProvider.from(WS_ENDPOINT);
    const hdNode = utils.HDNode.fromMnemonic(SEED).derivePath("m/44'/60'/0'/0/0");
    root_wallet = new Wallet(hdNode, provider);
    indexer_wallet = new Wallet(INDEXER_PK, provider);
    consumer_wallet = new Wallet(CONSUMER_PK, provider);
    sdk = await ContractSDK.create(root_wallet, {
        deploymentDetails: testnetDeployment,
        network: 'testnet',
    });

    const overrides = await getOverrides(provider);

    await rootSetup();
    await queryProjectSetup();
    await planTemplateSetup();
    await indexerSetup(overrides);
    await planManagerTest(overrides);

    if (provider.api) {
        await provider.api.disconnect();
    }
}

main();
