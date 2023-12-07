import assert from 'assert';
import { BigNumber, ContractReceipt, ContractTransaction, Wallet, ethers, utils } from 'ethers';
import web3 from 'web3';
import Token from '../../artifacts/contracts/SQToken.sol/SQToken.json';
import deployment from '../../publish/testnet_old.json';
import setup from '../../scripts/setup';
import { ContractSDK } from '../../src';
import { VERSION, poi } from '../constants';

let INDEXER_ADDR;
let CONSUMER_ADDR;
const METADATA_HASH = 'QmdKLNpQ6vXZNXguEaTp9uWQyjj2dR8HpL7JHVZhW1CsaJ';
const DEPLOYMENT_ID = cidToBytes32('QmSjjRjfjXXEfSUTheNwvWcBaH54pWoToTHPDsJRby955X');
let Provider;

const usdcAddress = '0xE097d6B3100777DC31B34dC2c58fB524C2e76921';

let root_wallet, indexer_wallet, consumer_wallet;
let sdk: ContractSDK;

async function sendTx(transaction: () => Promise<ContractTransaction>): Promise<ContractReceipt> {
    const tx = await transaction();
    const receipt = await tx.wait();

    return receipt;
}
function etherParse(etherNum) {
    return BigNumber.from(web3.utils.toWei(etherNum, 'ether'));
}

function cidToBytes32(cid) {
    return '0x' + Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex');
}

async function futureTimestamp(sec = 60 * 60 * 2) {
    return (await Provider.getBlock()).timestamp + sec;
}

async function indexerCollectRewards() {
    console.log('=> Indexer collect rewards');
    await sendTx(() => sdk.rewardsHelper.indexerCatchup(INDEXER_ADDR));
}

async function rootSetup() {
    console.log('\n====Setup network=====\n');
    //set eraPeriod: 1h
    console.log('eraPeriod check');
    let eraPeriod = await sdk.eraManager.eraPeriod();
    console.log('eraPeriod is: ' + eraPeriod.toNumber());
    if (eraPeriod.toNumber() != 3600) {
        console.log('set eraPeriod to 3600 ...');
        await sendTx(() => sdk.eraManager.updateEraPeriod(3600));
        eraPeriod = await sdk.eraManager.eraPeriod();
        console.log('eraPeriod is: ' + eraPeriod.toNumber());
    }

    //set lockPeriod
    console.log('lockPeriod check');
    let lockPeriod = await sdk.staking.lockPeriod();
    console.log('lockPeriod is: ' + lockPeriod.toNumber());
    if (lockPeriod.toNumber() != 3600) {
        console.log('set lockPeriod to 3600 ...');
        await sendTx(() => sdk.staking.setLockPeriod(3600));
        lockPeriod = await sdk.staking.lockPeriod();
        console.log('lockPeriod is: ' + lockPeriod.toNumber());
    }
}

async function queryProjectSetup() {
    console.log('\n====Setup query project =====\n');
    const next = await sdk.projectRegistry.nextProjectId();
    if (next.toNumber() == 0) {
        console.log('start create query project 0 ...');
        await sendTx(() => sdk.projectRegistry.createProject(METADATA_HASH, VERSION, DEPLOYMENT_ID,0));
    }

    const info = await sdk.projectRegistry.projectInfos(0);
    const deploymentInfo = await sdk.projectRegistry.deploymentInfos(info.latestDeploymentId)
    const projectNft = await sdk.projectRegistry.tokenURI(0)
    if (info.latestDeploymentId != DEPLOYMENT_ID) {
        console.log('start update query project 0 ...');
        await sendTx(() => sdk.projectRegistry.updateDeployment(0, DEPLOYMENT_ID, VERSION));
        await sendTx(() => sdk.projectRegistry.updateProjectMetadata(0, METADATA_HASH));
    }

    console.log('QueryProject 0: ');
    console.log('latestDeploymentId: ' + info.latestDeploymentId);

    console.log('latestVersion: ' + deploymentInfo.metadata);
    console.log('metadata: ' + projectNft);
}

async function planTemplateSetup() {
    console.log('\n====Create plan templates=====\n');
    const next = await sdk.planManager.nextPlanId();
    if (next.toNumber() == 0) {
        console.log('start create planTemplate 0 ...');
        // @ts-ignore
        await sendTx(() => sdk.planManager.createPlanTemplate(10800, 10000, 10000, sdk.token.address, METADATA_HASH));
    }
    const info = await sdk.planManager.getPlanTemplate(0);
    if (info.metadata != METADATA_HASH) {
        console.log('start update PlanTemplate metadata ...');
        await sendTx(() => sdk.planManager.updatePlanTemplateMetadata(0, METADATA_HASH));
    }

    console.log('PlanTemplate 0: ');
    console.log('period: ' + info.period);
    console.log('rateLimit: ' + info.rateLimit);
    console.log('metadata: ' + info.metadata);
    console.log('active: ' + info.active);
}

async function indexerSetup() {
    console.log('\n====Setup indexer=====\n');
    //Indexer registration
    console.log('check indexer status');
    const isIndexer = await sdk.indexerRegistry.isIndexer(INDEXER_ADDR);
    if (isIndexer) {
        console.log(INDEXER_ADDR + 'is an Indexer');
    } else {
        console.log(INDEXER_ADDR + ' is not an Indexer');
        console.log('start registerIndexer');

        await sendTx(() => sdk.sqToken.connect(root_wallet).transfer(indexer_wallet.address, etherParse('1000')));
        await sendTx(() => sdk.sqToken.connect(indexer_wallet).increaseAllowance(sdk.staking.address, etherParse('1000')));
        await sendTx(() => sdk.indexerRegistry.connect(indexer_wallet).registerIndexer(etherParse('1000'), METADATA_HASH, 0));
        console.log('Indexer registered with: ');
    }

    console.log('commissionRates: ' + (await sdk.indexerRegistry.getCommissionRate(INDEXER_ADDR)));
    console.log('TotalStakingAmount: ' + (await sdk.stakingManager.getTotalStakingAmount(INDEXER_ADDR)));

    //Indexing start and update indxing status to ready
    let indexingStatus = await sdk.projectRegistry.deploymentStatusByIndexer(DEPLOYMENT_ID, INDEXER_ADDR);
    if (indexingStatus != 1) {
        console.log('start indexing ...');
        await sendTx(() => sdk.projectRegistry.connect(indexer_wallet).startService(DEPLOYMENT_ID));
    }
    indexingStatus = await sdk.projectRegistry.deploymentStatusByIndexer(DEPLOYMENT_ID, INDEXER_ADDR);
    console.log(`Indexing status: ${indexingStatus}`);
}

async function clearEndedAgreements(indexer) {
    console.log('\n====Clear end agreements=====\n');
    //start clear ended agreements
    const receipt = await sendTx(() => sdk.serviceAgreementExtra.clearAllEndedAgreements(indexer));
    const events = receipt.events;
    events.forEach((event) => {
        if (event.args) {
            console.log(event.args);
        }
    });
}

async function planManagerTest() {
    console.log('\n====Plan mananger=====\n');
    //indexer create the plan
    console.log('indexer create a plan ...');
    await sendTx(() => sdk.planManager.connect(indexer_wallet).createPlan(etherParse('10'), 0, DEPLOYMENT_ID));
    const planId = (await sdk.planManager.nextPlanId()).sub(1);
    let plan = await sdk.planManager.getPlan(planId);
    console.log(`plan created with index ${planId.toString()}: `);
    console.log('price: ' + plan.price);
    console.log('planTemplateId: ' + plan.templateId);
    console.log('deploymentId: ' + plan.deploymentId);
    console.log('active: ' + plan.active);

    //consumer acept the plan
    console.log('consumer accept a plan ...');
    await sendTx(() => sdk.sqToken.connect(root_wallet).transfer(consumer_wallet.address, etherParse('10000')));
    await sendTx(() => sdk.sqToken.connect(consumer_wallet).increaseAllowance(sdk.planManager.address, etherParse('10')));
    await sendTx(() => sdk.planManager.connect(consumer_wallet).acceptPlan(planId, DEPLOYMENT_ID));
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
    await sendTx(() => sdk.sqToken.connect(consumer_wallet).increaseAllowance(sdk.serviceAgreementRegistry.address, etherParse('10')));
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
    await sendTx(() => sdk.planManager.connect(indexer_wallet).removePlan(planId));
    plan = await sdk.planManager.getPlan(planId);
    if (!plan.active) {
        console.log(`plan ${planId} has been successfully removed`);
    } else {
        console.log(`plan ${planId} remove failed`);
    }
}

async function purchaseOfferTest() {
    console.log('\n====Purchase offer=====\n');
    // consumer create the purchaseOffer
    const offerId = await sdk.purchaseOfferMarket.numOffers();
    console.log('consumer create a purchaseOffer ...');
    await sendTx(() => sdk.sqToken.connect(root_wallet).transfer(consumer_wallet.address, etherParse('20')));
    await sendTx(() => sdk.sqToken.connect(consumer_wallet).increaseAllowance(sdk.purchaseOfferMarket.address, etherParse('20')));
    await sendTx(async () => sdk.purchaseOfferMarket.connect(consumer_wallet).createPurchaseOffer(DEPLOYMENT_ID, 0, etherParse('10'), 2, 0, etherParse('1000'), await futureTimestamp()));
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
    await sendTx(() => sdk.purchaseOfferMarket.connect(indexer_wallet).acceptPurchaseOffer(offerId, poi));
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
    await sendTx(() => sdk.purchaseOfferMarket.connect(consumer_wallet).cancelPurchaseOffer(offerId));
    offer = await sdk.purchaseOfferMarket.offers(offerId);
    if (offer.active) {
        console.log(`purchaseOffer ${offerId} cancel failed`);
    } else {
        console.log(`purchaseOffer ${offerId} has been successfully cancellled`);
    }
}

async function updateEra() {
    console.log('\n====Update Era=====\n');
    while (true) {
        let startTime = (await sdk.eraManager.eraStartTime()).toNumber();
        let period = (await sdk.eraManager.eraPeriod()).toNumber();
        let now = await futureTimestamp(0);
        if (startTime + period < now) {
            await sendTx(() => sdk.eraManager.safeUpdateAndGetEra());
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
    console.log('\n====Staking Transaction=====\n');
    await indexerCollectRewards();

    await sendTx(() => sdk.sqToken.connect(root_wallet).transfer(consumer_wallet.address, etherParse('10')));
    await sendTx(() => sdk.sqToken.connect(consumer_wallet).increaseAllowance(sdk.stakingManager.address, etherParse('10')));

    let delegation = await sdk.staking.delegation(CONSUMER_ADDR, INDEXER_ADDR);
    console.log(`current delegation: ${delegation}`);

    console.log(`=> delegator start delegate to indexer`);
    await sendTx(() => sdk.stakingManager.connect(consumer_wallet).delegate(INDEXER_ADDR, etherParse('10')));
    delegation = await sdk.staking.delegation(CONSUMER_ADDR, INDEXER_ADDR);
    console.log(`updated delegation: ${delegation}`);

    console.log(`=> delegator start undelegate to indexer`);
    await sendTx(() => sdk.stakingManager.connect(consumer_wallet).undelegate(INDEXER_ADDR, etherParse('5')));
    delegation = await sdk.staking.delegation(CONSUMER_ADDR, INDEXER_ADDR);
    console.log(`updated delegation after undelegate: ${delegation}`);
}

async function distributeAndClaimRewards() {
    console.log('\n====Distribute and claim rewards=====\n');
    while (true) {
        try {
            const currentEra = await sdk.eraManager.eraNumber();
            console.log(`currentEra: ${currentEra}`);

            let rewardInfo = await sdk.rewardsDistributor.getRewardInfo(INDEXER_ADDR);
            console.log(`RewardInfo of indexer ${INDEXER_ADDR}: `);
            console.log(`lastClaimEra: ${rewardInfo.lastClaimEra}`);
            console.log(`eraReward: ${rewardInfo.eraReward}`);
            console.log(`accSQTPerStake: ${rewardInfo.accSQTPerStake}`);

            if (currentEra.eq(rewardInfo.lastClaimEra.add(1))) break;

            console.log(`=> Collect and distribute rewards`);
            await sendTx(() => sdk.rewardsDistributor.collectAndDistributeRewards(INDEXER_ADDR));
            rewardInfo = await sdk.rewardsDistributor.getRewardInfo(INDEXER_ADDR);
            console.log(`RewardInfo of indexer ${INDEXER_ADDR}: `);
            console.log(`lastClaimEra: ${rewardInfo.lastClaimEra}`);
            console.log(`eraReward: ${rewardInfo.eraReward}`);
            console.log(`accSQTPerStake: ${rewardInfo.accSQTPerStake}`);

            console.log(`=> Indexer claims rewards`);
            let indexer_rewards = await sdk.rewardsDistributor.userRewards(INDEXER_ADDR, INDEXER_ADDR);
            await sendTx(() => sdk.rewardsDistributor.connect(indexer_wallet).claim(INDEXER_ADDR));
            console.log(`indexer claimed : ${indexer_rewards}`);

            console.log(`=> Delegator claims rewards`);
            let delegator_rewards = await sdk.rewardsDistributor.userRewards(INDEXER_ADDR, CONSUMER_ADDR);
            await sendTx(() => sdk.rewardsDistributor.connect(consumer_wallet).claim(INDEXER_ADDR));
            console.log(`delegator claimed : ${delegator_rewards}`);
        } catch (err) {
            console.log(err);
            break;
        }
    }
}

async function airdropTest() {
    console.log('\n====Airdrop=====\n');

    const airdrops = [
        '0xEEd36C3DFEefB2D45372d72337CC48Bc97D119d4',
        '0x592C6A31df20DD24a7d33f5fe526730358337189',
        '0x9184cFF04fD32123db66329Ab50Bf176ece2e211',
        '0xFf60C1Efa7f0F10594229D8A68c312d7020E3478',
        '0xBDB9D4dC13c5E3E59B7fd69230c7F44f7170Ce02',
        '0x0421700EE1890d461353A54eAA481488f440A68f',
    ];

    const startTime = await futureTimestamp(60 * 60 * 3);
    const endTime = await futureTimestamp(60 * 60 * 144);
    const roundId = await sdk.airdropper.nextRoundId();
    console.log(`=> CreateRound ${roundId}`);
    await sendTx(() => sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime));

    let round = await sdk.airdropper.roundRecord(roundId);
    console.log(`created Round ${roundId} with: `);
    console.log(`tokenAddress: ${round.tokenAddress}`);
    console.log(`roundStartTime: ${round.roundStartTime}`);
    console.log(`roundDeadline: ${round.roundDeadline}`);
    console.log(`unclaimedAmount: ${round.unclaimedAmount}`);

    const rounds = airdrops.map(() => roundId);
    const amounts = airdrops.map(() => etherParse('0.5'));

    await sendTx(() => sdk.sqToken.increaseAllowance(sdk.airdropper.address, etherParse('100')));

    console.log(`=> Start bathAirdrop for round ${roundId} ...`);
    await sendTx(() => sdk.airdropper.batchAirdrop(airdrops, rounds, amounts));
    round = await sdk.airdropper.roundRecord(roundId);
    console.log(`Round ${roundId} with: `);
    console.log(`unclaimedAmount: ${round.unclaimedAmount.toString()}`);
}

async function permissionedExchangedtest() {
    console.log('\n====Setup exchange=====\n');
    let orderId = await sdk.permissionedExchange.nextOrderId();
    console.log(`start create exchange order ${orderId}`);
    await sendTx(() => sdk.sqToken.increaseAllowance(sdk.permissionedExchange.address, etherParse('100')));
    const usdcContract = new ethers.Contract(usdcAddress, Token.abi, Provider);

    await usdcContract.connect(root_wallet).increaseAllowance(sdk.permissionedExchange.address, 1000000);
    await sendTx(async () =>
        sdk.permissionedExchange.createPairOrders(
            usdcAddress,
            sdk.sqToken.address,
            1000000,
            etherParse('5'),
            await futureTimestamp(60 * 60 * 24),
            1000000
        )
    );
    let order = await sdk.permissionedExchange.orders(orderId);
    console.log(`order ${orderId} created with: `);
    console.log(`tokenGive: ${order.tokenGive}`);
    console.log(`tokenGet: ${order.tokenGet}`);
    console.log(`amountGive: ${order.amountGive}`);
    console.log(`amountGet: ${order.amountGet}`);
    console.log(`sender: ${order.sender}`);
    console.log(`expireDate: ${order.expireDate}`);
    console.log(`pairOrderId: ${order.pairOrderId}`);
    console.log(`tokenGiveBalance: ${order.tokenGiveBalance}`);


    console.log(`check controller ...`);
    let isController = await sdk.permissionedExchange.exchangeController(root_wallet.address);
    if (isController) {
        console.log(`root is the exchange controller`);
    } else {
        console.log(`start set controller for root wallet ... `);
        await sendTx(() => sdk.permissionedExchange.setController(root_wallet.address, true));
        isController = await sdk.permissionedExchange.exchangeController(root_wallet.address);
        if (isController) {
            console.log(`set successed `);
        } else {
            console.log(`set failed `);
        }
    }

    let quota = await sdk.permissionedExchange.tradeQuota(sdk.sqToken.address, root_wallet.address);
    console.log(`sqt trade quota for root is ${quota}`);
    console.log(`start addQuota to root wallet ...`);
    await sendTx(() => sdk.permissionedExchange.addQuota(sdk.sqToken.address, root_wallet.address, etherParse('2.5')));
    quota = await sdk.permissionedExchange.tradeQuota(sdk.sqToken.address, root_wallet.address);
    console.log(`sqt trade quota for root is ${quota}`);

    console.log(`start trade on offer ${orderId} ...`);
    await sendTx(() => sdk.permissionedExchange.trade(orderId, etherParse('2.5')));
    order = await sdk.permissionedExchange.orders(orderId);
    console.log(`amountGiveLeft for offer ${orderId} : ${order.tokenGiveBalance}`);
}

async function main() {
    const INDEXER_PK = process.env.INDEXER_PK;
    const CONSUMER_PK = process.env.CONSUMER_PK;
    assert(INDEXER_PK, 'Not found SEED in env');
    assert(CONSUMER_PK, 'Not found SEED in env');

    const { wallet, provider } = await setup(process.argv);
    Provider = provider;
    sdk = await ContractSDK.create(wallet, { deploymentDetails: deployment } as any);
    root_wallet = wallet;
    indexer_wallet = new Wallet(INDEXER_PK, provider);
    consumer_wallet = new Wallet(CONSUMER_PK, provider);
    INDEXER_ADDR = indexer_wallet.address;
    CONSUMER_ADDR = consumer_wallet.address;

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
    await permissionedExchangedtest();
}

main();