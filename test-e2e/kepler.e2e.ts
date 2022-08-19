const {ContractSDK} = require('../build/build');
const testnetDeployment = require('../publish/testnet.json');
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
const AIRDROPPER_PK = '0x212166a763ae39ba37e49bb18da2802f06cee5c78d5fdec498a7843d40d566e6';
const SEED = 'weasel train face endless hello melody unable angry notable half lunch rack';
const METADATA_HASH = '0xab3921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55';
const DEPLOYMENT_ID = 'Qmf5vn3LZhSkj7q47z2VVxZ7pxf2hRGLVXgqo2TvNWAXvp';
const VERSION = '0xaec921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55';
const mmrRoot = '0xab3921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55';

let root_wallet, indexer_wallet, consumer_wallet, airdropper_wallet;
let sdk;
let overrides;
let provider;

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

async function futureTimestamp(sec = 60 * 60 * 2) {
    return (await provider.getBlock()).timestamp + sec;
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
        await sdk.queryRegistry.createQueryProject(METADATA_HASH, VERSION, cidToBytes32(DEPLOYMENT_ID));
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

async function indexerSetup() {
    //Indexer registration
    console.log('check indexer status');
    const isIndexer = await sdk.indexerRegistry.isIndexer(INDEXER_ADDR);
    if (isIndexer) {
        console.log(INDEXER_ADDR + 'is an Indexer');
    } else {
        console.log(INDEXER_ADDR + ' is not an Indexer');
        console.log('start registerIndexer');

        await sdk.sqToken.connect(root_wallet).transfer(indexer_wallet.address, etherParse('1000'));
        await sdk.sqToken.connect(indexer_wallet).increaseAllowance(sdk.staking.address, etherParse('1000'));
        await sdk.indexerRegistry
            .connect(indexer_wallet)
            .registerIndexer(etherParse('1000'), METADATA_HASH, 0, overrides);
        console.log('Indexer registered with: ');
    }
    console.log('METADATA_HASH: ' + (await sdk.indexerRegistry.metadataByIndexer(INDEXER_ADDR)));
    console.log('commissionRates: ' + (await sdk.staking.getCommissionRate(INDEXER_ADDR)));
    console.log('TotalStakingAmount: ' + (await sdk.staking.getTotalStakingAmount(INDEXER_ADDR)));

    //Indexing start and update indxing status to ready
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

async function clearEndedAgreements(indexer) {
    //start clear ended agreements
    const tx = await sdk.serviceAgreementRegistry.clearAllEndedAgreements(indexer);
    const events = (await tx.wait()).events;
    console.log(`clear ${events.length} agreements `);
    events.forEach((event) => {
        console.log(event.args);
    });
}

async function planManagerTest() {
    //indexer create the plan
    console.log('indexer create a plan ...');
    await sdk.planManager.connect(indexer_wallet).createPlan(etherParse('10'), 0, cidToBytes32(DEPLOYMENT_ID));
    const planCount = await sdk.planManager.planCount(INDEXER_ADDR);
    let plan = await sdk.planManager.plans(INDEXER_ADDR, planCount);
    console.log(`plan created with index ${planCount}: `);
    console.log('price: ' + plan.price);
    console.log('planTemplateId: ' + plan.planTemplateId);
    console.log('deploymentId: ' + plan.deploymentId);
    console.log('active: ' + plan.active);

    //consumer acept the plan
    console.log('consumer accept a plan ...');
    let tx = await sdk.sqToken.connect(consumer_wallet).increaseAllowance(sdk.planManager.address, etherParse('10'));
    await tx.wait();
    await sdk.planManager
        .connect(consumer_wallet)
        .acceptPlan(INDEXER_ADDR, cidToBytes32(DEPLOYMENT_ID), planCount, overrides);
    const agreementId = (await sdk.serviceAgreementRegistry.nextServiceAgreementId()).toNumber() - 1;
    const agreement = await sdk.serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
    console.log(`created agreemnt: ${agreementId}`);
    console.log('consumer: ' + agreement.consumer);
    console.log('indexer: ' + agreement.indexer);
    console.log('deploymentId: ' + agreement.deploymentId);
    console.log('lockedAmount: ' + agreement.lockedAmount);
    console.log('startDate: ' + agreement.startDate);
    console.log('period: ' + agreement.period);
    console.log('planId: ' + agreement.planId);
    console.log('planTemplateId: ' + agreement.planTemplateId);

    //consumer renew the agreement
    console.log('consumer start renew the agreement ...');
    tx = await sdk.sqToken
        .connect(consumer_wallet)
        .increaseAllowance(sdk.serviceAgreementRegistry.address, etherParse('10'));
    await tx.wait();

    //indexer remove the plan
    console.log('indexer start remove the plan ...');
    await sdk.planManager.connect(indexer_wallet).removePlan(planCount);
    plan = await sdk.planManager.plans(INDEXER_ADDR, planCount);
    if (!plan.active) {
        console.log(`plan ${planCount} has been successfully removed`);
    } else {
        console.log(`plan ${planCount} remove failed`);
    }
}

async function purchaseOfferTest() {
    //consumer create the purchaseOffer
    const offerId = await sdk.purchaseOfferMarket.numOffers();
    console.log('consumer create a purchaseOffer ...');
    const tx = await sdk.sqToken
        .connect(consumer_wallet)
        .increaseAllowance(sdk.purchaseOfferMarket.address, etherParse('10'));
    await tx.wait();
    await sdk.purchaseOfferMarket
        .connect(consumer_wallet)
        .createPurchaseOffer(cidToBytes32(DEPLOYMENT_ID), 0, etherParse('10'), 2, 0, await futureTimestamp());
    let offer = await sdk.purchaseOfferMarket.offers(offerId);
    console.log('created purchaseOffer: ');
    console.log('deposit: ' + offer.deposit);
    console.log('minimumAcceptHeight: ' + offer.minimumAcceptHeight);
    console.log('planTemplateId: ' + offer.planTemplateId);
    console.log('deploymentId: ' + offer.deploymentId);
    console.log('expireDate: ' + offer.expireDate);
    console.log('consumer: ' + offer.consumer);
    console.log('cancelled: ' + offer.cancelled);
    console.log('limit: ' + offer.limit);
    console.log('numAcceptedContracts: ' + offer.numAcceptedContracts);

    //indexer accept the purchaseOffer
    console.log('indexer start accept the offer ...');
    await sdk.purchaseOfferMarket.connect(indexer_wallet).acceptPurchaseOffer(offerId, mmrRoot, overrides);
    const agreementId = (await sdk.serviceAgreementRegistry.nextServiceAgreementId()).toNumber() - 1;
    const agreement = await sdk.serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
    console.log(`created agreemnt: ${agreementId}`);
    console.log('consumer: ' + agreement.consumer);
    console.log('indexer: ' + agreement.indexer);
    console.log('deploymentId: ' + agreement.deploymentId);
    console.log('lockedAmount: ' + agreement.lockedAmount);
    console.log('startDate: ' + agreement.startDate);
    console.log('period: ' + agreement.period);
    console.log('planId: ' + agreement.planId);
    console.log('planTemplateId: ' + agreement.planTemplateId);

    //consumer cancel the PurchaseOffer
    console.log('consumer start cancel the offer ...');
    await sdk.purchaseOfferMarket.connect(consumer_wallet).cancelPurchaseOffer(offerId);
    offer = await sdk.purchaseOfferMarket.offers(offerId);
    if (offer.cancelled) {
        console.log(`purchaseOffer ${offerId} has been successfully cancellled`);
    } else {
        console.log(`purchaseOffer ${offerId} cancel failed`);
    }
}

async function airdropTest() {
    console.log('start airdrop...');
    const airdrops = [
        '0xEEd36C3DFEefB2D45372d72337CC48Bc97D119d4', // Michael test account
        '0x592C6A31df20DD24a7d33f5fe526730358337189', // Ian test account
        '0x9184cFF04fD32123db66329Ab50Bf176ece2e211', // Louise test account
        '0xFf60C1Efa7f0F10594229D8A68c312d7020E3478', // Louise test account
        '0xBDB9D4dC13c5E3E59B7fd69230c7F44f7170Ce02', // Brittany test account
        '0x0421700EE1890d461353A54eAA481488f440A68f',
    ];

    const roundId = await sdk.airdropper.nextRoundId();
    console.log(`start createRound ${roundId}`);
    const startTime = await futureTimestamp(60 * 60);
    const endTime = await futureTimestamp(60 * 60 * 5);
    await sdk.airdropper.connect(airdropper_wallet).createRound(sdk.sqToken.address, startTime, endTime);
    let round = await sdk.airdropper.roundRecord(roundId);
    console.log(`created Round ${roundId} with: `);
    console.log(`tokenAddress: ${round.tokenAddress}`);
    console.log(`roundStartTime: ${round.roundStartTime}`);
    console.log(`roundDeadline: ${round.roundDeadline}`);
    console.log(`unclaimedAmount: ${round.unclaimedAmount}`);

    const rounds = airdrops.map(() => roundId);
    const amounts = airdrops.map(() => etherParse('0.01'));

    //await sdk.sqToken.connect(airdropper_wallet).increaseAllowance(sdk.airdropper.address, etherParse('10'));
    console.log(`start bathAirdrop for round ${roundId} ...`);
    await sdk.airdropper.connect(airdropper_wallet).batchAirdrop(airdrops, rounds, amounts);
    console.log('complete airdrop...');
    round = await sdk.airdropper.roundRecord(roundId);
    console.log(`Round ${roundId} with: `);
    console.log(`unclaimedAmount: ${round.unclaimedAmount}`);
}

async function main() {
    provider = await EvmRpcProvider.from(WS_ENDPOINT);
    const hdNode = utils.HDNode.fromMnemonic(SEED).derivePath("m/44'/60'/0'/0/0");
    root_wallet = new Wallet(hdNode, provider);
    indexer_wallet = new Wallet(INDEXER_PK, provider);
    consumer_wallet = new Wallet(CONSUMER_PK, provider);
    airdropper_wallet = new Wallet(AIRDROPPER_PK, provider);
    sdk = await ContractSDK.create(root_wallet, {
        deploymentDetails: testnetDeployment,
        network: 'testnet',
    });

    overrides = await getOverrides(provider);

    // await rootSetup();
    // await queryProjectSetup();
    // await planTemplateSetup();
    await indexerSetup();
    await clearEndedAgreements(INDEXER_ADDR);
    await planManagerTest();
    await purchaseOfferTest();
    await airdropTest();

    if (provider.api) {
        await provider.api.disconnect();
    }
}

main();
