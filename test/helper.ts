// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { constants, time } from '@openzeppelin/test-helpers';
import { MockProvider } from 'ethereum-waffle';
import { BaseContract, BigNumber, Contract, ContractTransaction, Wallet as EthWallet, utils } from 'ethers';
import { ethers } from "hardhat";
import { EraManager, IndexerRegistry, PlanManager, PurchaseOfferMarket, SQToken } from '../src';
import { METADATA_HASH } from './constants';

export { constants, time };

export type Provider = MockProvider | StaticJsonRpcProvider;

export type Wallet = EthWallet | SignerWithAddress;

export function createProvider(url: string, chain: number): StaticJsonRpcProvider {
    return new ethers.providers.StaticJsonRpcProvider(url, chain);
}

export async function timeTravel(provider: MockProvider, seconds: number) {
    await provider.send('evm_increaseTime', [seconds]);
    await provider.send('evm_mine', []);
}

export async function blockTravel(provider: MockProvider, blocks: number) {
    for (let i = 0; i < blocks; i++) {
        await provider.send('evm_mine', []);
    }
}

export async function lastestBlock(provider: MockProvider | StaticJsonRpcProvider) {
    const blockBefore = await provider.send('eth_getBlockByNumber', ['latest', false]);
    return blockBefore;
}

export async function lastestTime(provider: MockProvider | StaticJsonRpcProvider) {
    const block = await lastestBlock(provider);
    return BigNumber.from(block.timestamp).toNumber();
}

export function getCurrentTime() {
    return new Date().getTime();
}

//use the lastest block timestamp and add 5 days
export async function futureTimestamp(provider: MockProvider, sec: number = 60 * 60 * 24 * 5) {
    return (await lastestTime(provider)) + sec;
}

// contract call helpers
export async function registerIndexer(
    token: Contract,
    indexerRegistry: IndexerRegistry,
    staking: Contract,
    rootWallet: Wallet,
    wallet: Wallet,
    amount: string
) {
    await token.connect(rootWallet).transfer(wallet.address, etherParse(amount));
    await token.connect(wallet).increaseAllowance(staking.address, etherParse(amount));
    const tx = await indexerRegistry
        .connect(wallet)
        .registerIndexer(etherParse(amount), METADATA_HASH, 0, { gasLimit: '2000000' });
    return tx;
}

export async function createPurchaseOffer(
    purchaseOfferMarket: PurchaseOfferMarket,
    token: Contract,
    deploymentId: string,
    expireDate,
    planTemplateId = 0,
    limit = 1,
    deposit='2000000000000000000', // 2e18
    minimumAcceptHeight=100,
): Promise<BigNumber> {
    await token.increaseAllowance(purchaseOfferMarket.address, deposit);
    const tx = await purchaseOfferMarket.createPurchaseOffer(
        deploymentId,
        planTemplateId,
        deposit,
        limit,
        minimumAcceptHeight,
        expireDate
    );
    const evt = await eventFrom(tx, purchaseOfferMarket, 'PurchaseOfferCreated(address,uint256,bytes32,uint256,uint256,uint16,uint256,uint256)');
    return evt.offerId;
}

export async function startNewEra(mockProvider: MockProvider, eraManager: EraManager): Promise<BigNumber> {
    const eraPeroid = await eraManager.eraPeriod();
    await timeTravel(mockProvider, eraPeroid.toNumber() + 10);
    await eraManager.startNewEra();
    return eraManager.eraNumber();
}

export async function delay(sec: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, sec * 1000));
}

export function cidToBytes32(cid: string): string {
    return '0x' + Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex');
}

//generate CSAgreement with indexer, consumer, agreement period and agreement value
//instead of checkAcceptPlan in PlanManager
export async function acceptPlan(
    indexer,
    consumer,
    period: number,
    value: BigNumber,
    DEPLOYMENT_ID,
    sqtToken: SQToken,
    planManager: PlanManager
) {
    await planManager.createPlanTemplate(
        time.duration.days(period).toString(),
        1000,
        100,
        sqtToken.address,
        METADATA_HASH
    );
    await planManager.connect(indexer).createPlan(value, 0, DEPLOYMENT_ID);
    await planManager.connect(consumer).acceptPlan((await planManager.nextPlanId()).toNumber() - 1, DEPLOYMENT_ID);
}

export function etherParse(etherNum: string) {
    return ethers.utils.parseEther(etherNum)
}

type Event = utils.Result;
export async function eventFrom(tx: ContractTransaction, contract: BaseContract, event: string): Promise<Event> {
    const receipt = await tx.wait();
    const evt = receipt.events.find((log) => log.topics[0] === utils.id(event));

    const eventName = event.split('(')[0];
    return contract.interface.decodeEventLog(contract.interface.getEvent(eventName), evt.data, evt.topics);
}

export async function deploySUSD(siger: SignerWithAddress) {
    const MockSUSD = await ethers.getContractFactory("SUSD", siger);
    const USDC = await MockSUSD.deploy(ethers.utils.parseUnits("1000000000", 6));

    return USDC;
}