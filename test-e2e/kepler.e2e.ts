import { ContractSDK } from '@subql/contract-sdk';
import moonbaseDeployment from '@subql/contract-sdk/publish/testnet.json';
import testnetDeployment from '@subql/contract-sdk/publish/testnet.json';
import {Wallet, utils, providers, BigNumber} from 'ethers';
import web3 from 'web3';

import moonbaseConfig from '../scripts/config/moonbase.config';
import testnetConfig from '../scripts/config/testnet.config';
import {METADATA_HASH, DEPLOYMENT_ID, VERSION, mmrRoot} from '../test/constants';

const SEED = 'weasel train face endless hello melody unable angry notable half lunch rack';

const INDEXER_PK = '0x328b0b2e15184a9c716bc927136d0b9229a0e666dbe70b9bb650de2625e0f63c';
const INDEXER_ADDR = '0x293a6d85DD0d7d290A719Fdeef43FaD10240bA77';
const CONSUMER_PK = '0x1674fe269be296e21f6440f15087de29969f8015003887955e99b7cac5455353';
const CONSUMER_ADDR = '0x301ce005Ea3f7d8051462E060f53d84Ee898dFDe';

const AUSDAddr = '0xF98bF104e268d7cBB7949029Fee874e3cd1db8fa';

let deployment;
let root_wallet, indexer_wallet, consumer_wallet;
let sdk: ContractSDK;
let overrides;
let provider;
let tx;

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
        tx = await sdk.eraManager.updateEraPeriod(3600);
        await tx.wait();
        eraPeriod = await sdk.eraManager.eraPeriod();
        console.log('eraPeriod is: ' + eraPeriod.toNumber());
    }

    //set lockPeriod
    console.log('lockPeriod check');
    let lockPeriod = await sdk.staking.lockPeriod();
    console.log('lockPeriod is: ' + lockPeriod.toNumber());
    if (lockPeriod.toNumber() != 3600) {
        console.log('set lockPeriod to 3600 ...');
        tx = await sdk.staking.setLockPeriod(3600);
        await tx.wait();
        lockPeriod = await sdk.staking.lockPeriod();
        console.log('lockPeriod is: ' + lockPeriod.toNumber());
    }
}

async function queryProjectSetup() {
    const next = await sdk.queryRegistry.nextQueryId();
    if (next.toNumber() == 0) {
        console.log('start create query project 0 ...');
        tx = await sdk.queryRegistry.createQueryProject(METADATA_HASH, VERSION, DEPLOYMENT_ID);
        await tx.wait();
    }

    const info = await sdk.queryRegistry.queryInfos(0);
    if (info.latestDeploymentId != DEPLOYMENT_ID) {
        console.log('start update query project 0 ...');
        tx = await sdk.queryRegistry.updateDeployment(0, DEPLOYMENT_ID, VERSION);
        await tx.wait();
        tx = await sdk.queryRegistry.updateQueryProjectMetadata(0, METADATA_HASH);
        await tx.wait();
    }

    console.log('QueryProject 0: ');
    console.log('latestVersion: ' + info.latestVersion);
    console.log('latestDeploymentId: ' + info.latestDeploymentId);
    console.log('metadata: ' + info.metadata);
}

async function planTemplateSetup() {
    const next = await sdk.planManager.nextPlanId();
    if (next.toNumber() == 0) {
        console.log('start create planTemplate 0 ...');
        tx = await sdk.planManager.createPlanTemplate(10800, 10000, 10000, METADATA_HASH);
        await tx.wait();
    }
    const info = await sdk.planManager.getPlanTemplate(0);
    if (info.metadata != METADATA_HASH) {
        console.log('start update PlanTemplate metadata ...');
        tx = await sdk.planManager.updatePlanTemplateMetadata(0, METADATA_HASH);
        await tx.wait();
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

        tx = await sdk.sqToken.connect(root_wallet).transfer(indexer_wallet.address, etherParse('1000'));
        await tx.wait();
        tx = await sdk.sqToken.connect(indexer_wallet).increaseAllowance(sdk.staking.address, etherParse('1000'));
        await tx.wait();
        tx = await sdk.indexerRegistry.connect(indexer_wallet).registerIndexer(etherParse('1000'), METADATA_HASH, 0);
        await tx.wait();
        console.log('Indexer registered with: ');
    }
    console.log('METADATA_HASH: ' + (await sdk.indexerRegistry.metadataByIndexer(INDEXER_ADDR)));
    console.log('commissionRates: ' + (await sdk.indexerRegistry.getCommissionRate(INDEXER_ADDR)));
    console.log('TotalStakingAmount: ' + (await sdk.stakingManager.getTotalStakingAmount(INDEXER_ADDR)));

    //Indexing start and update indxing status to ready
    let indexingStatus = (await sdk.queryRegistry.deploymentStatusByIndexer(DEPLOYMENT_ID, INDEXER_ADDR)).status;
    if (indexingStatus != 2) {
        if (indexingStatus == 0) {
            console.log('strat indexing ...');
            tx = await sdk.queryRegistry.connect(indexer_wallet).startIndexing(DEPLOYMENT_ID);
            await tx.wait();
        }
        tx = await sdk.queryRegistry.connect(indexer_wallet).updateIndexingStatusToReady(DEPLOYMENT_ID);
        await tx.wait();
    }
    indexingStatus = (await sdk.queryRegistry.deploymentStatusByIndexer(DEPLOYMENT_ID, INDEXER_ADDR)).status;
    console.log(`Indexing status: ${indexingStatus}`);
}

async function clearEndedAgreements(indexer) {
    //start clear ended agreements
    tx = await sdk.serviceAgreementRegistry.clearAllEndedAgreements(indexer);
    const events = (await tx.wait()).events;
    console.log(`clear ${events.length} agreements `);
    events.forEach((event) => {
        console.log(event.args);
    });
}

async function planManagerTest() {
    //indexer create the plan
    console.log('indexer create a plan ...');
    tx = await sdk.planManager.connect(indexer_wallet).createPlan(etherParse('10'), 0, DEPLOYMENT_ID);
    await tx.wait();
    const planId = (await sdk.planManager.nextPlanId()).sub(1);
    let plan = await sdk.planManager.getPlan(planId);
    console.log(`plan created with index ${planId.toString()}: `);
    console.log('price: ' + plan.price);
    console.log('planTemplateId: ' + plan.templateId);
    console.log('deploymentId: ' + plan.deploymentId);
    console.log('active: ' + plan.active);

    //consumer acept the plan
    console.log('consumer accept a plan ...');
    tx = await sdk.sqToken.connect(root_wallet).transfer(consumer_wallet.address, etherParse('10'));
    await tx.wait();
    tx = await sdk.sqToken.connect(consumer_wallet).increaseAllowance(sdk.planManager.address, etherParse('10'));
    await tx.wait();
    tx = await sdk.planManager.connect(consumer_wallet).acceptPlan(planId, DEPLOYMENT_ID);
    await tx.wait();
    let agreementId = (await sdk.serviceAgreementRegistry.nextServiceAgreementId()).toNumber() - 1;
    let agreement = await sdk.serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
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
    agreementId = (await sdk.serviceAgreementRegistry.nextServiceAgreementId()).toNumber() - 1;
    agreement = await sdk.serviceAgreementRegistry.getClosedServiceAgreement(agreementId);
    console.log(`renewed agreemnt: ${agreementId}`);
    console.log('consumer: ' + agreement.consumer);
    console.log('indexer: ' + agreement.indexer);
    console.log('deploymentId: ' + agreement.deploymentId);
    console.log('lockedAmount: ' + agreement.lockedAmount);
    console.log('startDate: ' + agreement.startDate);
    console.log('period: ' + agreement.period);
    console.log('planId: ' + agreement.planId);
    console.log('planTemplateId: ' + agreement.planTemplateId);

    //indexer remove the plan
    console.log('indexer start remove the plan ...');
    tx = await sdk.planManager.connect(indexer_wallet).removePlan(planId);
    await tx.wait();
    plan = await sdk.planManager.getPlan(planId);
    if (!plan.active) {
        console.log(`plan ${planId} has been successfully removed`);
    } else {
        console.log(`plan ${planId} remove failed`);
    }
}

async function purchaseOfferTest() {
    //consumer create the purchaseOffer
    const offerId = await sdk.purchaseOfferMarket.numOffers();
    console.log('consumer create a purchaseOffer ...');
    tx = await sdk.sqToken.connect(root_wallet).transfer(consumer_wallet.address, etherParse('20'));
    await tx.wait();
    tx = await sdk.sqToken
        .connect(consumer_wallet)
        .increaseAllowance(sdk.purchaseOfferMarket.address, etherParse('20'));
    await tx.wait();
    tx = await sdk.purchaseOfferMarket
        .connect(consumer_wallet)
        .createPurchaseOffer(DEPLOYMENT_ID, 0, etherParse('10'), 2, 0, await futureTimestamp());
    await tx.wait();
    let offer = await sdk.purchaseOfferMarket.offers(offerId);
    console.log('created purchaseOffer: ');
    console.log('deposit: ' + offer.deposit);
    console.log('minimumAcceptHeight: ' + offer.minimumAcceptHeight);
    console.log('planTemplateId: ' + offer.planTemplateId);
    console.log('deploymentId: ' + offer.deploymentId);
    console.log('expireDate: ' + offer.expireDate);
    console.log('consumer: ' + offer.consumer);
    console.log('limit: ' + offer.limit);
    console.log('numAcceptedContracts: ' + offer.numAcceptedContracts);

    //indexer accept the purchaseOffer
    console.log('indexer start accept the offer ...');
    tx = await sdk.purchaseOfferMarket.connect(indexer_wallet).acceptPurchaseOffer(offerId, mmrRoot);
    await tx.wait();
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
    tx = await sdk.purchaseOfferMarket.connect(consumer_wallet).cancelPurchaseOffer(offerId);
    await tx.wait();
    offer = await sdk.purchaseOfferMarket.offers(offerId);
    if (offer.active) {
        console.log(`purchaseOffer ${offerId} cancel failed`);
    } else {
        console.log(`purchaseOffer ${offerId} has been successfully cancellled`);
    }
}

async function updateEra() {
    console.log('start update era ...');
    while (true) {
        let startTime = (await sdk.eraManager.eraStartTime()).toNumber();
        let period = (await sdk.eraManager.eraPeriod()).toNumber();
        let now = await futureTimestamp(0);
        if (startTime + period < now) {
            tx = await sdk.eraManager.safeUpdateAndGetEra();
            await tx.wait();
            let currentEra = await sdk.eraManager.eraNumber();
            console.log(`update to era: ${currentEra}`);
        } else {
            let currentEra = await sdk.eraManager.eraNumber();
            console.log(`update to the latest Era: ${currentEra}`);
            break;
        }
    }
}

async function stakingTest() {
    tx = await sdk.sqToken.connect(root_wallet).transfer(consumer_wallet.address, etherParse('10'));
    await tx.wait();
    tx = await sdk.sqToken.connect(consumer_wallet).increaseAllowance(sdk.staking.address, etherParse('10'));
    await tx.wait();
    let delegation = await sdk.staking.delegation(CONSUMER_ADDR, INDEXER_ADDR);
    console.log(`delegation: ${delegation}`);
    console.log(`delegator start delegate to indexer ...`);
    tx = await sdk.stakingManager.connect(consumer_wallet).delegate(INDEXER_ADDR, etherParse('10'));
    await tx.wait();
    delegation = await sdk.staking.delegation(CONSUMER_ADDR, INDEXER_ADDR);
    console.log(`delegation: ${delegation}`);
    console.log(`delegator start undelegate to indexer ...`);
    tx = await sdk.stakingManager.connect(consumer_wallet).undelegate(INDEXER_ADDR, etherParse('5'));
    await tx.wait();
    delegation = await sdk.staking.delegation(CONSUMER_ADDR, INDEXER_ADDR);
    console.log(`delegation: ${delegation}`);
}

async function distributeAndClaimRewards() {
    while (true) {
        try {
            let currentEra = await sdk.eraManager.eraNumber();
            console.log(`currentEra: ${currentEra}`);
            let rewardInfo = await sdk.rewardsDistributor.getRewardInfo(INDEXER_ADDR);
            console.log(`RewardInfo of indexer ${INDEXER_ADDR}: `);
            console.log(`lastClaimEra: ${rewardInfo.lastClaimEra}`);
            console.log(`eraReward: ${rewardInfo.eraReward}`);
            console.log(`accSQTPerStake: ${rewardInfo.accSQTPerStake}`);
            tx = await sdk.rewardsDistributor.collectAndDistributeRewards(INDEXER_ADDR);
            await tx.wait();
            rewardInfo = await sdk.rewardsDistributor.getRewardInfo(INDEXER_ADDR);
            console.log(`RewardInfo of indexer ${INDEXER_ADDR}: `);
            console.log(`lastClaimEra: ${rewardInfo.lastClaimEra}`);
            console.log(`eraReward: ${rewardInfo.eraReward}`);
            console.log(`accSQTPerStake: ${rewardInfo.accSQTPerStake}`);

            //indexer and delegator claim
            let indexer_rewards = await sdk.rewardsDistributor.userRewards(INDEXER_ADDR, INDEXER_ADDR);
            tx = await sdk.rewardsDistributor.connect(indexer_wallet).claim(INDEXER_ADDR);
            await tx.wait();
            console.log(`indexer claimed : ${indexer_rewards}`);

            let delegator_rewards = await sdk.rewardsDistributor.userRewards(INDEXER_ADDR, CONSUMER_ADDR);
            tx = await sdk.rewardsDistributor.connect(consumer_wallet).claim(INDEXER_ADDR);
            await tx.wait();
            console.log(`delegator claimed : ${indexer_rewards}`);
        } catch (err) {
            console.log(err);
            break;
        }
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
    const startTime = await futureTimestamp(60 * 60 * 3);
    const endTime = await futureTimestamp(60 * 60 * 5);
    let tx = await sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime);
    await tx.wait();
    let round = await sdk.airdropper.roundRecord(roundId);
    console.log(`created Round ${roundId} with: `);
    console.log(`tokenAddress: ${round.tokenAddress}`);
    console.log(`roundStartTime: ${round.roundStartTime}`);
    console.log(`roundDeadline: ${round.roundDeadline}`);
    console.log(`unclaimedAmount: ${round.unclaimedAmount}`);

    const rounds = airdrops.map(() => roundId);
    const amounts = airdrops.map(() => etherParse('0.5'));

    tx = await sdk.sqToken.increaseAllowance(sdk.airdropper.address, etherParse('100'));
    await tx.wait();
    console.log(`start bathAirdrop for round ${roundId} ...`);
    tx = await sdk.airdropper.batchAirdrop(airdrops, rounds, amounts);
    await tx.wait();
    console.log('complete airdrop...');
    round = await sdk.airdropper.roundRecord(roundId);
    console.log(`Round ${roundId} with: `);
    console.log(`unclaimedAmount: ${round.unclaimedAmount}`);
}

// async function permissionedExchangedtest() {
//     let orderId = await sdk.permissionedExchange.nextOrderId();
//     console.log(`strat create exchange order ${orderId}`);
//     tx = await sdk.sqToken.increaseAllowance(sdk.permissionedExchange.address, etherParse('100'));
//     await tx.wait();
//     tx = await sdk.permissionedExchange.sendOrder(
//         AUSDAddr,
//         sdk.sqToken.address,
//         etherParse('1'),
//         etherParse('5'),
//         await futureTimestamp(60 * 60 * 24)
//     );
//     await tx.wait();
//     let order = await sdk.permissionedExchange.orders(orderId);
//     console.log(`order ${orderId} created with: `);
//     console.log(`tokenGive: ${order.tokenGive}`);
//     console.log(`tokenGet: ${order.tokenGet}`);
//     console.log(`amountGive: ${order.amountGive}`);
//     console.log(`amountGet: ${order.amountGet}`);
//     console.log(`sender: ${order.sender}`);
//     console.log(`expireDate: ${order.expireDate}`);
//     console.log(`amountGiveLeft: ${order.amountGiveLeft}`);

//     console.log(`check controller ...`);
//     let isController = await sdk.permissionedExchange.exchangeController(root_wallet.address);
//     if (isController) {
//         console.log(`root is the exchange controller`);
//     } else {
//         console.log(`start set controller for root wallet ... `);
//         tx = await sdk.permissionedExchange.setController(root_wallet.address, true);
//         await tx.wait();
//         isController = await sdk.permissionedExchange.exchangeController(root_wallet.address);
//         if (isController) {
//             console.log(`set successed `);
//         } else {
//             console.log(`set failed `);
//         }
//     }

//     let quota = await sdk.permissionedExchange.tradeQuota(sdk.sqToken.address, root_wallet.address);
//     console.log(`sqt trade quota for root is ${quota}`);
//     console.log(`strat addQuota to root wallet ...`);
//     tx = await sdk.permissionedExchange.addQuota(sdk.sqToken.address, root_wallet.address, etherParse('2.5'));
//     await tx.wait();
//     quota = await sdk.permissionedExchange.tradeQuota(sdk.sqToken.address, root_wallet.address);
//     console.log(`sqt trade quota for root is ${quota}`);

//     console.log(`strat trade on offer ${orderId} ...`);
//     tx = await sdk.permissionedExchange.trade(orderId, etherParse('2.5'));
//     await tx.wait();
//     order = await sdk.permissionedExchange.orders(orderId);
//     console.log(`amountGiveLeft for offer ${orderId} : ${order.amountGiveLeft}`);
// }

async function main() {
    switch (process.argv[2]) {
        case '--moonbase':
            deployment = moonbaseDeployment;
            provider = new providers.StaticJsonRpcProvider(moonbaseConfig.network.endpoint.eth);
            break;
        case '--testnet':
            deployment = testnetDeployment;
            provider = new providers.StaticJsonRpcProvider(testnetConfig.network.endpoint, testnetConfig.network.providerConfig);
            break;
    }

    const hdNode = utils.HDNode.fromMnemonic(SEED).derivePath("m/44'/60'/0'/0/0");
    root_wallet = new Wallet(hdNode, provider);
    sdk = await ContractSDK.create(root_wallet, {
        deploymentDetails: deployment,
        network: 'testnet',
    });

    indexer_wallet = new Wallet(INDEXER_PK, provider);
    consumer_wallet = new Wallet(CONSUMER_PK, provider);

    await rootSetup();
    await queryProjectSetup();
    await planTemplateSetup();
    await indexerSetup();
    await clearEndedAgreements(INDEXER_ADDR);
    await planManagerTest();
    await purchaseOfferTest();
    await updateEra();
    await stakingTest();
    await distributeAndClaimRewards();
    await airdropTest();
    // await permissionedExchangedtest();

    if (provider.api) {
        await provider.api.disconnect();
    }
}

main();
