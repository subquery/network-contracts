import { ContractReceipt, ContractTransaction, Overrides, Wallet, ethers } from 'ethers';
import Pino from 'pino';

import setup from './setup';

import Token from '../artifacts/contracts/SQToken.sol/SQToken.json';
import { ContractSDK, SubqueryNetwork } from '../build';
import { METADATA_HASH } from '../test/constants';
import { cidToBytes32, etherParse, lastestTime } from '../test/helper';
import startupKeplerConfig from './config/startup.kepler.json';
import startupMainnetConfig from './config/startup.mainnet.json';
import startupTestnetConfig from './config/startup.testnet.json';

import { Provider, StaticJsonRpcProvider } from '@ethersproject/providers';
import { parseEther } from 'ethers/lib/utils';
import { getLogger } from './logger';

let startupConfig: any = startupTestnetConfig;
let logger: Pino.Logger;
let confirms = 0;
let provider: Provider;

async function getOverrides(): Promise<Overrides> {
    const price = await provider.getGasPrice();
    const gasPrice = price.add(20000000000); // add extra 15 gwei
    return { gasPrice };
}

async function sendTx(transaction: (overrides: Overrides) => Promise<ContractTransaction>): Promise<ContractReceipt> {
    const overrides = await getOverrides();
    const tx = await transaction(overrides);
    logger?.info(`🤞 Sending transaction: ${tx.hash}`);
    const receipt = await tx.wait(confirms);
    logger?.info('🚀 Transaction successful!');
    return receipt;
}

async function getAirdropTimeConfig(provider) {
    const startTime = (await lastestTime(provider)) + 600;
    const endTime = startTime + 864000;

    return { startTime, endTime };
}

export async function createProjects(sdk: ContractSDK, _provider?: StaticJsonRpcProvider) {
    if (_provider) provider = _provider;
    logger = getLogger('Projects');
    for (const creator of startupConfig.QRCreator) {
        const result = await sdk.projectRegistry.creatorWhitelist(creator);
        if (!result) {
            logger.info(`Add project creator: ${creator}`);
            await sendTx((overrides) => sdk.projectRegistry.addCreator(creator, overrides));
        } else {
            logger.info(`${creator} has already exist`);
        }
    }

    logger.info('Create Query Projects');
    const queryId = await sdk.projectRegistry.nextProjectId();
    const projects = startupConfig.projects;
    for (var i = queryId.toNumber(); i < projects.length; i++) {
        const { name, metadataCid, versionCid, deploymentId } = projects[i];
        logger.info(`Create query project: ${name}`);
        await sendTx((overrides) =>
            sdk.projectRegistry.createProject(
                cidToBytes32(metadataCid),
                cidToBytes32(versionCid),
                cidToBytes32(deploymentId),
                0,
                overrides
            )
        );
    }

    logger.info('Remove owner from creator whitelist');
    const owner = await sdk.projectRegistry.owner();
    await sendTx((overrides) => sdk.projectRegistry.removeCreator(owner, overrides));

    logger.info('Add mutli-sig wallet as creator');
    await sendTx((overrides) => sdk.projectRegistry.addCreator(startupConfig.multiSign, overrides));

    console.log('\n');
}

export async function createPlanTemplates(sdk: ContractSDK, _provider?: StaticJsonRpcProvider) {
    if (_provider) provider = _provider;
    logger = getLogger('Plan Templates');
    const templateId = await sdk.planManager.nextTemplateId();
    const templates = startupConfig.planTemplates;
    for (var i = templateId.toNumber(); i < templates.length; i++) {
        const { period, dailyReqCap, rateLimit, token } = templates[i];
        logger.info(`Create No. ${i} plan template: ${period} | ${dailyReqCap} | ${rateLimit}`);
        await sendTx((overrides) =>
            sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, token, METADATA_HASH, overrides)
        );
    }

    console.log('\n');
}

export async function airdrop(sdk: ContractSDK, _provider?: StaticJsonRpcProvider) {
    if (_provider) provider = _provider;
    logger = getLogger('Airdrop');
    for (const controller of startupConfig.AirdropController) {
        const result = await sdk.airdropper.controllers(controller);
        if (!result) {
            logger.info(`Add airdrop controller: ${controller}`);
            await sendTx((overrides) => sdk.airdropper.addController(controller, overrides));
        } else {
            logger.info(`${controller} has already exist`);
        }
    }

    if (startupConfig.airdrops.length > 0) {
        logger.info('Create Airdrop round');
        const { startTime, endTime } = await getAirdropTimeConfig(provider);
        const receipt = await sendTx((overrides) =>
            sdk.airdropper.createRound(sdk.sqToken.address, startTime, endTime, overrides)
        );
        const roundId = receipt.events[0].args.roundId;
        logger.info(`Round ${roundId} created: ${startTime} | ${endTime}`);

        const airdropAccounts = startupConfig.airdrops;
        const rounds = new Array(airdropAccounts.length).fill(roundId);
        const amounts = startupConfig.amounts.map((a) => parseEther(a.toString()));

        logger.info('Batch send Airdrop');
        const totalAmount = eval(startupConfig.amounts.join('+'));
        await sendTx((overrides) =>
            sdk.sqToken.increaseAllowance(sdk.airdropper.address, parseEther(totalAmount.toString()), overrides)
        );
        await sendTx((overrides) => sdk.airdropper.batchAirdrop(airdropAccounts, rounds, amounts, overrides));
    }

    const owner = await sdk.airdropper.owner();
    logger.info(`Remove owner from airdrop controller: ${owner}`);
    await sendTx((overrides) => sdk.airdropper.removeController(owner, overrides));

    logger.info('Add mutli-sig wallet as airdrop controller');
    await sendTx((overrides) => sdk.airdropper.addController(startupConfig.multiSign, overrides));

    console.log('\n');
}

async function setupPermissionExchange(sdk: ContractSDK, wallet: Wallet, _provider?: StaticJsonRpcProvider) {
    if (_provider) provider = _provider;
    logger = getLogger('Permission Exchange');
    logger.info('Setup exchange order');
    const { usdcAddress, amountGive, amountGet, expireDate, tokenGiveBalance } = startupConfig.exchange;
    const usdcContract = new ethers.Contract(usdcAddress, Token.abi, provider);
    await usdcContract.connect(wallet).increaseAllowance(sdk.permissionedExchange.address, tokenGiveBalance);

    await sendTx((overrides) =>
        sdk.permissionedExchange.createPairOrders(
            usdcAddress,
            sdk.sqToken.address,
            amountGive,
            amountGet,
            expireDate,
            tokenGiveBalance,
            overrides
        )
    );

    console.log('\n');
}

export async function ownerTransfer(sdk: ContractSDK) {
    logger = getLogger('Owner Transfer');
    const contracts = [
        sdk.airdropper,
        sdk.consumerHost,
        sdk.disputeManager,
        sdk.eraManager,
        sdk.indexerRegistry,
        sdk.inflationController,
        sdk.permissionedExchange,
        sdk.planManager,
        sdk.proxyAdmin,
        sdk.purchaseOfferMarket,
        sdk.projectRegistry,
        sdk.rewardsDistributor,
        sdk.rewardsHelper,
        sdk.rewardsPool,
        sdk.rewardsStaking,
        sdk.serviceAgreementRegistry,
        sdk.settings,
        sdk.sqToken,
        sdk.staking,
        sdk.stakingManager,
        sdk.stateChannel,
        sdk.vesting,
        sdk.consumerRegistry,
        sdk.priceOracle,
        sdk.vSQToken,
    ];

    for (const contract of contracts) {
        const owner = await contract.owner();
        if (owner != startupConfig.multiSign) {
            logger.info(`Transfer Ownership: ${contract.address}`);
            await sendTx((overrides) => contract.transferOwnership(startupConfig.multiSign, overrides));
        } else {
            console.info(`${contract.address} ownership has already transfered`);
        }
    }

    console.log('\n');
}

async function transferTokenToIndexers(sdk: ContractSDK) {
    logger = getLogger('Token');
    const { indexers } = startupConfig;
    const amount = etherParse('1000000');
    for (const indexer of indexers) {
        await sdk.sqToken.transfer(indexer, amount);
        logger.info(`Transfer 1_000_000 sqt to ${indexer}`);
    }
}

export async function balanceTransfer(sdk: ContractSDK, wallet: Wallet) {
    logger = getLogger('Token');
    const balance = await sdk.sqToken.balanceOf(wallet.address);
    if (balance.gt(0)) {
        logger.info(`Transfer ${balance.toString()} from ${wallet.address} to ${startupConfig.multiSign}`);
        await sendTx((overrides) => sdk.sqToken.transfer(startupConfig.multiSign, balance, overrides));
    } else {
        logger.info(`Balance already transfered`);
    }
}

async function setupVesting(sdk: ContractSDK) {
    logger = getLogger('Vesting');
    logger.info('Creating vesting plans');

    const vestingPlans = startupConfig.vestingPlans;
    for (const plan of vestingPlans) {
        const { initPercentage, vestingPeriod, lockPeriod } = plan;
        logger.info(`Create vesting plan: ${initPercentage} | ${vestingPeriod} | ${lockPeriod}`);
        await sendTx((overrides) => sdk.vesting.addVestingPlan(lockPeriod, vestingPeriod, initPercentage, overrides));
    }
    logger.info('Vesting plans created');

    const accounts = startupConfig.airdrops;
    const amounts = startupConfig.amounts.map((a: number) => parseEther(a.toString()));

    logger.info('Allocate vesting plans');
    let planId = 0;
    const maxPlanId = vestingPlans.length - 1;
    for (const [index, account] of accounts.entries()) {
        const allocation = await sdk.vesting.allocations(account);
        if (!allocation.eq(0)) continue;

        const amount = amounts[index];
        planId = planId > maxPlanId ? 0 : planId;
        logger.info(`Allocate ${amount.toString()} to ${account} with Plan: ${planId}`);
        await sendTx((overrides) => sdk.vesting.allocateVesting(account, planId, amount, overrides));
        planId++;
    }
    logger.info('Vesting plans allocated');

    logger.info('Deposit vesting token');
    const totalAmount = parseEther(eval(startupConfig.amounts.join('+')).toString());
    await sendTx((overrides) => sdk.sqToken.increaseAllowance(sdk.vesting.address, totalAmount, overrides));
    await sendTx((overrides) => sdk.vesting.depositByAdmin(totalAmount, overrides));
    logger.info(`Total ${totalAmount.toString()} deposited`);
    logger.info('Vesting token deposited');

    const startTime = Math.round(new Date().getTime() / 1000) + 21600;
    await sendTx((overrides) => sdk.vesting.startVesting(startTime, overrides));
    logger.info('Vesting started');
}

const main = async () => {
    const { wallet } = await setup(process.argv);
    const networkType = process.argv[2];
    provider = wallet.provider;

    let network: SubqueryNetwork;
    switch (networkType) {
        case '--mainnet':
            network = 'mainnet';
            break;
        case '--kepler':
            network = 'kepler';
            break;
        case '--testnet':
            network = 'testnet';
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`);
    }

    const sdk = ContractSDK.create(wallet, { network });

    switch (networkType) {
        case '--mainnet':
            startupConfig = startupMainnetConfig;
            confirms = 20;
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            await balanceTransfer(sdk, wallet);
            await ownerTransfer(sdk);
            break;
        case '--kepler':
            confirms = 20;
            startupConfig = startupKeplerConfig;
            // await airdrop(sdk);
            // await createProjects(sdk);
            // await createPlanTemplates(sdk);
            // await balanceTransfer(sdk, wallet);
            await ownerTransfer(sdk);
            break;
        case '--testnet':
            confirms = 1;
            startupConfig = startupTestnetConfig;
            // await createProjects(sdk);
            // await createPlanTemplates(sdk);
            // await airdrop(sdk);
            // await transferTokenToIndexers(sdk);
            // await setupPermissionExchange(sdk, wallet);
            // await balanceTransfer(sdk, wallet);
            // await ownerTransfer(sdk);
            await setupVesting(sdk);
            break;
        default:
            throw new Error(`Please provide correct network ${networkType}`);
    }

    logger = getLogger('Contract Setup');
    logger.info('🎉Contract setup completed!🎉');
};

main();
