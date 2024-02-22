import { BigNumber, ContractReceipt, ContractTransaction, Overrides, Wallet, utils } from 'ethers';
import Pino from 'pino';

import { argv, setupCommon } from './setup';

import { ContractSDK, SubqueryNetwork } from '../build';
import { METADATA_HASH } from '../test/constants';
import startupMainnetConfig from './config/startup.mainnet.json';
import startupTestnetConfig from './config/startup.testnet.json';
import mainnetConfig from './config/mainnet.config';

import { Provider, StaticJsonRpcProvider } from '@ethersproject/providers';
import { MockProvider } from 'ethereum-waffle';
import { parseEther } from 'ethers/lib/utils';
import { getLogger } from './logger';
import { networks } from '../src/networks';
import { RootContractSDK } from 'src';

let startupConfig: typeof startupTestnetConfig = startupTestnetConfig;
let logger: Pino.Logger;
let confirms = 0;
let provider: Provider;

async function getOverrides(): Promise<Overrides> {
    const price = await provider.getGasPrice();
    return { gasPrice: price };
}

// eslint-disable-next-line no-unused-vars
async function sendTx(transaction: (overrides: Overrides) => Promise<ContractTransaction>): Promise<ContractReceipt> {
    const overrides = await getOverrides();
    const tx = await transaction(overrides);
    logger?.info(`🤞 Sending transaction: ${tx.hash}`);
    const receipt = await tx.wait(confirms);
    logger?.info('🚀 Transaction successful!');
    return receipt;
}

async function lastestBlock(provider: MockProvider | StaticJsonRpcProvider) {
    const blockBefore = await provider.send('eth_getBlockByNumber', ['latest', false]);
    return blockBefore;
}

async function lastestTime(provider: MockProvider | StaticJsonRpcProvider) {
    const block = await lastestBlock(provider);
    return BigNumber.from(block.timestamp).toNumber();
}

function cidToBytes32(cid: string): string {
    return '0x' + Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex');
}

async function getAirdropTimeConfig(provider) {
    const startTime = (await lastestTime(provider)) + 600;
    const endTime = startTime + 864000;

    return { startTime, endTime };
}

// async function setupInflation(sdk: PolygonSDK) {
//     logger = getLogger('Token');
//     logger.info('Set minter');
//     await sdk.sqToken.setMinter(sdk.inflationController.address);
//     logger.info('Set inflationDestination');
//     await sendTx((overrides) => sdk.inflationController.setInflationDestination(sdk.InflationDestination.address, overrides));
//     logger.info('Set xcRecipient');
//     await sendTx((overrides) => sdk.InflationDestination.setXcRecipient(sdk.childToken.address, overrides));
// }

// async function tokenDeposit(sdk: PolygonSDK) {
//     logger = getLogger('Token');
//     const amount = startupConfig.tokenDeposit;
//     logger.info(`Deposit ${amount} token to Polygon`);
//     let tx = await sdk.approveDeposit(amount);
//     await tx.getReceipt();
//     tx = await sdk.depositFor(amount);
// }

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
    const projects = startupConfig.projects;
    for (let i = 0; i < projects.length; i++) {
        const { name, projectMetadata, deploymentMetadata, deploymentId, projectType } = projects[i];
        logger.info(`Create query project: ${name}`);
        await sendTx((overrides) =>
            sdk.projectRegistry.createProject(
                projectMetadata,
                cidToBytes32(deploymentMetadata),
                cidToBytes32(deploymentId),
                projectType,
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
    const defaultToken = sdk.sqToken.address;
    for (let i = templateId.toNumber(); i < templates.length; i++) {
        const { period, dailyReqCap, rateLimit, token } = templates[i];
        const templateToken = token ?? defaultToken;
        logger.info(`Create No. ${i} plan template: ${period} | ${dailyReqCap} | ${rateLimit}`);
        await sendTx((overrides) =>
            sdk.planManager.createPlanTemplate(period, dailyReqCap, rateLimit, templateToken, METADATA_HASH, overrides)
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

// async function setupTokenExchange(sdk: ContractSDK) {
//     logger = getLogger('Token Exchange');
//     logger.info('Setup exchange order');
//     const { tokenGive, tokenGet, amountGive, amountGet, tokenGiveBalance } = startupConfig.exchange;
//     await sendTx((overrides) => sdk.sqToken.increaseAllowance(sdk.tokenExchange.address, tokenGiveBalance, overrides));
//     await sendTx((overrides) =>
//         sdk.tokenExchange.sendOrder(tokenGive, tokenGet, amountGive, amountGet, tokenGiveBalance, overrides)
//     );

//     console.log('\n');
// }

async function rootContractOwnerTransfer(sdk: RootContractSDK) {
    logger = getLogger('Owner Transfer');
    const contracts = [
        sdk.sqToken,
        sdk.vtSQToken,
        sdk.vesting,
        sdk.inflationDestination,
    ];

    const foundation = mainnetConfig.multiSig.root.foundation;
    logger.info(`Transfer Ownership to ${foundation}`);
    for (const contract of contracts) {
        // @ts-expect-error owner type missing
        const owner = await contract.owner();
        if (owner != startupConfig.multiSign) {
            logger.info(`Transfer Ownership: ${contract.address}`);
            // @ts-expect-error transferOwnership type missing
            await sendTx((overrides) => contract.transferOwnership(foundation, overrides));
        } else {
            console.info(`${contract.address} ownership has already transfered`);
        }
    }

    // TODO: please manually transfer the ownership of `proxyAdmin` | `settings` | `infaltionController` to `mainnetConfig.multiSig.root.foundationAllocation;`
}
    

export async function childContractOwnerTransfer(sdk: ContractSDK) {
    logger = getLogger('Owner Transfer');
    // TODO: please manually transfer the ownership of `proxyAdmin`
    const contracts = [
        sdk.consumerHost,
        sdk.disputeManager,
        sdk.eraManager,
        sdk.indexerRegistry,
        sdk.planManager,
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
        sdk.consumerRegistry,
        sdk.priceOracle,
        sdk.vSQToken,
    ];

    const childCouncil = mainnetConfig.multiSig.child.council;
    logger.info(`Transfer Ownership to ${childCouncil}`);
    for (const contract of contracts) {
        // @ts-expect-error owner type missing
        const owner = await contract.owner();
        if (owner != startupConfig.multiSign) {
            logger.info(`Transfer Ownership: ${contract.address}`);

            // @ts-expect-error transferOwnership type missing
            await sendTx((overrides) => contract.transferOwnership(childCouncil, overrides));
        } else {
            console.info(`${contract.address} ownership has already transfered`);
        }
    }

    console.log('\n');
}

async function transferTokenToIndexers(sdk: ContractSDK) {
    logger = getLogger('Token');
    const { indexers } = startupConfig;
    const amount = utils.parseEther('1000000');
    for (const indexer of indexers) {
        const tx = await sdk.sqToken.transfer(indexer, amount);
        await tx.wait();
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

//async function setupVesting(sdk: ContractSDK) {
// logger = getLogger('Vesting');
// logger.info('Creating vesting plans');
//
// const vestingPlans = startupConfig.vestingPlans;
// for (const plan of vestingPlans) {
//     const { initPercentage, vestingPeriod, lockPeriod } = plan;
//     logger.info(`Create vesting plan: ${initPercentage} | ${vestingPeriod} | ${lockPeriod}`);
//     await sendTx((overrides) => sdk.vesting.addVestingPlan(lockPeriod, vestingPeriod, initPercentage, overrides));
// }
// logger.info('Vesting plans created');
//
// const accounts = startupConfig.airdrops;
// const amounts = startupConfig.amounts.map((a: number) => parseEther(a.toString()));
//
// logger.info('Allocate vesting plans');
// let planId = 0;
// const maxPlanId = vestingPlans.length - 1;
// for (const [index, account] of accounts.entries()) {
//     const allocation = await sdk.vesting.allocations(account);
//     if (!allocation.eq(0)) continue;
//
//     const amount = amounts[index];
//     planId = planId > maxPlanId ? 0 : planId;
//     logger.info(`Allocate ${amount.toString()} to ${account} with Plan: ${planId}`);
//     await sendTx((overrides) => sdk.vesting.allocateVesting(account, planId, amount, overrides));
//     planId++;
// }
// logger.info('Vesting plans allocated');
//
// logger.info('Deposit vesting token');
// const totalAmount = parseEther(eval(startupConfig.amounts.join('+')).toString());
// await sendTx((overrides) => sdk.sqToken.increaseAllowance(sdk.vesting.address, totalAmount, overrides));
// await sendTx((overrides) => sdk.vesting.depositByAdmin(totalAmount, overrides));
// logger.info(`Total ${totalAmount.toString()} deposited`);
// logger.info('Vesting token deposited');
//
// const startTime = Math.round(new Date().getTime() / 1000) + 21600;
// await sendTx((overrides) => sdk.vesting.startVesting(startTime, overrides));
// logger.info('Vesting started');
//}

const main = async () => {
    const network = (argv.network ?? 'testnet') as SubqueryNetwork;
    const { wallet, rootProvider, childProvider } = await setupCommon(networks[network]);

    // const polygonSdk = await PolygonSDK.create(wallet, {root: rootProvider, child: childProvider}, {network: 'testnet'});
    const sdk = ContractSDK.create(wallet.connect(childProvider), { network });
    const rootSDK = RootContractSDK.create(wallet.connect(rootProvider), { network });

    const isRoot = argv.target === 'root';
    provider = isRoot ? rootProvider : childProvider;

    switch (network) {
        case 'mainnet':
            // @ts-expect-error mainnet config have different types with testnet
            startupConfig = startupMainnetConfig;
            confirms = 20;
            // await createProjects(sdk);
            // await createPlanTemplates(sdk);
            // await balanceTransfer(sdk, wallet);
            if (isRoot) {
                await rootContractOwnerTransfer(rootSDK);
            } else {
                await childContractOwnerTransfer(sdk);
            }

            break;
        case 'testnet':
            confirms = 5;
            startupConfig = startupTestnetConfig;
            // root contracts
            // await setupInflation(polygonSdk);
            // await tokenDeposit(polygonSdk);

            // child contracts
            await createProjects(sdk);
            await createPlanTemplates(sdk);
            // await setupTokenExchange(sdk);
            await transferTokenToIndexers(sdk);

            // await setupVesting(sdk);
            // await setupTokenExchange(sdk);
            break;
        default:
            throw new Error(`Please provide correct network ${network}`);
    }

    logger = getLogger('Contract Setup');
    logger.info('🎉Contract setup completed!🎉');
};

main();
