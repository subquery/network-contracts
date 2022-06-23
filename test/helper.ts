// Copyright (C) 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {MockProvider} from 'ethereum-waffle';
import {BigNumber, Contract, Wallet, utils} from 'ethers';
import {IndexerRegistry, EraManager, ClosedServiceAgreement__factory} from '../src';
import {METADATA_HASH} from './constants';
const {constants, time} = require('@openzeppelin/test-helpers');
import web3 from 'web3';

export {constants, time};

export async function timeTravel(provider: MockProvider, seconds: number) {
    await provider.send('evm_increaseTime', [seconds]);
    await provider.send('evm_mine', []);
}

export async function lastestBlock(provider: MockProvider) {
    const blockBefore = await provider.send('eth_getBlockByNumber', ['latest', false]);
    return blockBefore;
}

export async function lastestTime(provider: MockProvider) {
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
    const tx = await indexerRegistry.connect(wallet).registerIndexer(etherParse(amount).div(2), METADATA_HASH, 0, {gasLimit: '2000000'});
    return tx;
}

export async function createPurchaseOffer(
    purchaseOfferMarket: Contract,
    token: Contract,
    deploymentId: string,
    expireDate
) {
    const deposit = etherParse("2");
    const limit = 1;
    const minimumAcceptHeight = 100;
    const planTemplateId = 0;

    await token.increaseAllowance(purchaseOfferMarket.address, etherParse("2"));
    await purchaseOfferMarket.createPurchaseOffer(
        deploymentId,
        planTemplateId,
        deposit,
        limit,
        minimumAcceptHeight,
        expireDate
    );
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
export async function generateAgreement(
    indexerAddr: string,
    consumerAddr: string,
    period: number,
    value: BigNumber,
    root,
    mockProvider: MockProvider,
    DEPLOYMENT_ID,
    settings
) {
    const csAgreement = await new ClosedServiceAgreement__factory(root).deploy(
        settings.address,
        consumerAddr,
        indexerAddr,
        DEPLOYMENT_ID,
        value,
        await lastestTime(mockProvider),
        time.duration.days(period).toString(),
        0,
        0
    );
    await csAgreement.deployTransaction.wait();
    return csAgreement;
}

export function etherParse(etherNum: string) {
    return BigNumber.from(web3.utils.toWei(etherNum, 'ether'));
}
