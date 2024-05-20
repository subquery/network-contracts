// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants, time } from '@openzeppelin/test-helpers';
import { MockProvider } from 'ethereum-waffle';
import {
    BaseContract,
    BigNumber,
    Contract,
    ContractTransaction,
    Wallet as EthWallet,
    utils,
    BigNumberish,
} from 'ethers';
import { ethers, waffle } from 'hardhat';
import {
    EraManager,
    IndexerRegistry,
    PlanManager,
    PurchaseOfferMarket,
    ERC20,
    ProjectType,
    ProjectRegistry,
    RewardsBooster,
    StateChannel,
    SQToken,
    RewardsDistributor,
} from '../src';
import { METADATA_HASH } from './constants';
import { expect } from 'chai';
import assert from 'assert';

export { constants, time };

export type Provider = MockProvider | StaticJsonRpcProvider;

export type Wallet = EthWallet | SignerWithAddress;

export function createProvider(url: string, chain: number): StaticJsonRpcProvider {
    return new ethers.providers.StaticJsonRpcProvider(url, chain);
}

/// helper functions for chain manipulation
export async function timeTravel(seconds: number) {
    const provider = waffle.provider;
    await provider.send('evm_increaseTime', [seconds]);
    await provider.send('evm_mine', []);
}

export async function timeTravelTo(date: number, blocktime = 2) {
    const provider = waffle.provider;
    // await provider.send('evm_setNextBlockTimestamp', [date]);
    // await provider.send('evm_mine', []);
    const now = await lastestBlockTime();
    let seconds = date - now;
    assert(seconds > 0, `invalid date: can not travel to past`);
    const blocks = seconds / blocktime;
    for (let i = 0; i < Math.ceil(blocks); i++) {
        const timePass = seconds < blocktime ? seconds : blocktime;
        await provider.send('evm_increaseTime', [timePass]);
        await provider.send('evm_mine', []);
        seconds -= timePass;
    }
}

export async function blockTravel(blocks: number, interval = 6) {
    const provider = waffle.provider;
    for (let i = 0; i < blocks; i++) {
        await provider.send('evm_increaseTime', [interval]);
        await provider.send('evm_mine', []);
    }
}

async function stopAutoMine(provider: MockProvider) {
    await provider.send('evm_setAutomine', [false]);
}

async function resumeAutoMine(provider: MockProvider, increaseTime = 0) {
    if (increaseTime) {
        await provider.send('evm_increaseTime', [increaseTime]);
    }
    await provider.send('evm_setAutomine', [true]);
    await provider.send('evm_mine', []);
}

export async function wrapTxs(callFn: () => Promise<void>) {
    const provider = waffle.provider;
    await stopAutoMine(provider);
    await callFn().finally(() => resumeAutoMine(provider));
}

export async function lastestBlockTime(): Promise<number> {
    const provider = waffle.provider;
    const blockTime = (await provider.getBlock('latest')).timestamp;
    return blockTime;
}

export function getCurrentTime() {
    return new Date().getTime();
}

//use the lastest block timestamp and add 5 days
const days_5 = 3600 * 24 * 5;
export async function futureTimestamp(time: number = days_5) {
    return (await lastestBlockTime()) + time;
}

export async function delay(sec: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, sec * 1000));
}

export function cidToBytes32(cid: string): string {
    return '0x' + Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex');
}

export function etherParse(etherNum: string | number) {
    const ether = typeof etherNum === 'string' ? etherNum : etherNum.toString();
    return utils.parseEther(ether);
}

export type Event = utils.Result;
export async function eventFrom(
    tx: ContractTransaction,
    contract: BaseContract,
    event: string
): Promise<Event | undefined> {
    const receipt = await tx.wait();
    const evt = receipt.events.find((log) => log.topics[0] === utils.id(event));
    if (!evt) return;
    const eventName = event.split('(')[0];
    return contract.interface.decodeEventLog(contract.interface.getEvent(eventName), evt.data, evt.topics);
}

export async function eventsFrom(tx: ContractTransaction, contract: BaseContract, event: string): Promise<Event[]> {
    const receipt = await tx.wait();
    const evts = receipt.events.filter((log) => log.topics[0] === utils.id(event));
    const eventName = event.split('(')[0];
    return evts.map((evt) =>
        contract.interface.decodeEventLog(contract.interface.getEvent(eventName), evt.data, evt.topics)
    );
}

/// helper functions for contract interaction
// contract call helpers
export async function registerRunner(
    token: Contract,
    indexerRegistry: IndexerRegistry,
    staking: Contract,
    rootWallet: Wallet,
    wallet: Wallet,
    amount: BigNumberish,
    rate: BigNumberish = 0
) {
    await token.connect(rootWallet).transfer(wallet.address, amount);
    await token.connect(wallet).increaseAllowance(staking.address, amount);
    const tx = await indexerRegistry
        .connect(wallet)
        .registerIndexer(amount, METADATA_HASH, rate, { gasLimit: '2000000' });
    return tx;
}

export async function createPurchaseOffer(
    purchaseOfferMarket: PurchaseOfferMarket,
    token: Contract,
    deploymentId: string,
    expireDate: number,
    planTemplateId = 0,
    limit = 1,
    deposit = etherParse(2),
    minimumAcceptHeight = 100,
    minimumStakingAmount = etherParse('1000')
): Promise<BigNumber> {
    await token.increaseAllowance(purchaseOfferMarket.address, deposit);
    const tx = await purchaseOfferMarket.createPurchaseOffer(
        deploymentId,
        planTemplateId,
        deposit,
        limit,
        minimumAcceptHeight,
        minimumStakingAmount,
        expireDate
    );
    const evt = await eventFrom(
        tx,
        purchaseOfferMarket,
        'PurchaseOfferCreated(address,uint256,bytes32,uint256,uint256,uint16,uint256,uint256,uint256)'
    );
    return evt.offerId;
}

export function createProject(
    projectRegistry: ProjectRegistry,
    wallet: SignerWithAddress,
    projectMetadata: string,
    deploymentMetadata: string,
    deploymentId: string,
    projectType: ProjectType
) {
    return projectRegistry
        .connect(wallet)
        .createProject(projectMetadata, deploymentMetadata, deploymentId, projectType);
}

export async function boosterDeployment(
    token: ERC20,
    rewardsBooster: RewardsBooster,
    signer: SignerWithAddress,
    deployment: string,
    amount: BigNumber
) {
    await token.connect(signer).increaseAllowance(rewardsBooster.address, amount);
    await rewardsBooster.connect(signer).boostDeployment(deployment, amount);
}

export async function openChannel(
    stateChannel: StateChannel,
    channelId: Uint8Array,
    deploymentId: string,
    indexer: Wallet,
    consumer: Wallet,
    amount: BigNumber,
    price: BigNumber,
    expiration: number
) {
    const abi = ethers.utils.defaultAbiCoder;
    const msg = abi.encode(
        ['uint256', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32', 'bytes'],
        [channelId, indexer.address, consumer.address, amount, price, expiration, deploymentId, '0x']
    );
    const payloadHash = ethers.utils.keccak256(msg);

    const indexerSign = await indexer.signMessage(ethers.utils.arrayify(payloadHash));
    const consumerSign = await consumer.signMessage(ethers.utils.arrayify(payloadHash));

    const recoveredIndexer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), indexerSign);
    expect(indexer.address).to.equal(recoveredIndexer);

    const recoveredConsumer = ethers.utils.verifyMessage(ethers.utils.arrayify(payloadHash), consumerSign);
    expect(consumer.address).to.equal(recoveredConsumer);

    await stateChannel
        .connect(consumer)
        .open(
            channelId,
            indexer.address,
            consumer.address,
            amount,
            price,
            expiration,
            deploymentId,
            '0x',
            indexerSign,
            consumerSign
        );
}

export async function startNewEra(eraManager: EraManager): Promise<BigNumber> {
    const eraPeroid = await eraManager.eraPeriod();
    await timeTravel(eraPeroid.toNumber() + 10);
    await eraManager.startNewEra();
    return eraManager.eraNumber();
}

//generate CSAgreement with indexer, consumer, agreement period and agreement value
//instead of checkAcceptPlan in PlanManager
export async function acceptPlan(
    indexer: string,
    consumer: string,
    period: number,
    value: BigNumber,
    DEPLOYMENT_ID: string,
    sqtToken: ERC20,
    planManager: PlanManager
) {
    await planManager.createPlanTemplate(
        time.duration.days(period).toString(),
        1000,
        100,
        sqtToken.address,
        METADATA_HASH
    );
    const planTplId = (await planManager.nextTemplateId()).toNumber() - 1;
    await planManager.connect(indexer).createPlan(value, planTplId, DEPLOYMENT_ID);
    await planManager.connect(consumer).acceptPlan((await planManager.nextPlanId()).toNumber() - 1, DEPLOYMENT_ID);
}

export async function deploySUSD(siger: SignerWithAddress) {
    const MockSUSD = await ethers.getContractFactory('SUSD', siger);
    const USDC = await MockSUSD.deploy(ethers.utils.parseUnits('1000000000', 6));

    return USDC;
}

export const revertMsg = {
    notOwner: 'Ownable: caller is not the owner',
    insufficientBalance: 'ERC20: transfer amount exceeds balance',
    insufficientAllowance: 'ERC20: insufficient allowance',
};

export async function addInstantRewards(
    sqtoken: ERC20,
    rewardsDistributor: RewardsDistributor,
    signer: SignerWithAddress,
    runner: string,
    era: BigNumberish,
    amount: BigNumberish
) {
    await wrapTxs(async () => {
        await sqtoken.connect(signer).approve(rewardsDistributor.address, amount);
        await rewardsDistributor.connect(signer).addInstantRewards(runner, signer.address, amount, era);
    });
}
