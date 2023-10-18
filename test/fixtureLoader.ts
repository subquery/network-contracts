// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { Provider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import assert from 'assert';
import { constants, utils } from 'ethers';
import { IPFSHTTPClient } from 'ipfs-http-client';
import { ContractSDK } from '../src';
import { cidToBytes32 } from './helper';

export interface AccountInput {
    name: string;
    seed: string;
    derive: string;
}

export interface FaucetInput {
    account: string;
    amounts: {
        SQT: number | string;
        Fee: number | string;
    };
}

export interface IndexerInput {
    account: string;
    stake: number;
    commissionRate: number;
}

export interface IndexerControllerInput {
    indexer: string;
    controller: number;
}

export interface ProjectInput {
    account: string;
    metadata: object;
    deployments: {
        deploymentId: string;
        version: object;
    }[];
}

export interface QueryActionInput {
    account: string;
    action: 'index' | 'ready';
    deploymentId: string;
}

export interface PlanTemplateInput {
    period: number;
    dailyReqCap: number;
    rateLimit: number;
    metadata: object;
}

export interface Context {
    sdk: ContractSDK;
    provider: Provider;
    accounts: { [name: string]: Wallet };
    rootAccount: Wallet;
    ipfs: IPFSHTTPClient;
}

export function createWallet(seed: string, derive: string, provider: Provider): Wallet {
    const hdNode = utils.HDNode.fromMnemonic(seed).derivePath(`m/44'/60'/0'/0${derive}`);
    return new Wallet(hdNode, provider);
}

export const loaders = {
    Account: function ({ name, derive, seed }: AccountInput, context: Context) {
        context.accounts[name] = createWallet(seed, derive, context.provider);
    },
    Faucet: async function ({ amounts, account }: FaucetInput, context: Context) {
        console.log(`Faucet Start for account ${account}`);
        const target = context.accounts[account];
        assert(target, `can't find target account ${account}`);
        if (amounts.SQT) {
            await context.sdk.sqToken
                .connect(context.rootAccount)
                .transfer(target.address, utils.parseUnits(amounts.SQT.toString()));
        }
        if (amounts.Fee) {
            const tx = await context.rootAccount.sendTransaction({
                to: target.address,
                value: utils.parseUnits(amounts.Fee.toString()),
            });
            await tx.wait();
        }
        console.log(`Faucet Complete for account ${account} ${target.address}`);
    },
    Indexer: async function ({ account, stake, commissionRate }: IndexerInput, { accounts, sdk }: Context) {
        console.log(`Indexer Start for account ${account}`);
        const indexer = accounts[account];
        assert(indexer, `can't find indexer account ${account}`);
        console.log(`indexer balance: ${await sdk.sqToken.balanceOf(indexer.address)}`);
        const tx = await sdk.sqToken.connect(indexer).approve(sdk.staking.address, constants.MaxUint256);
        const isIndexer = await sdk.indexerRegistry.isIndexer(indexer.address);
        console.log(`indexer allowance: ${await sdk.sqToken.allowance(indexer.address, sdk.staking.address)}`);
        if (!isIndexer) {
            await tx.wait();
            console.log(`indexer allowance: ${await sdk.sqToken.allowance(indexer.address, sdk.staking.address)}`);
            await sdk.indexerRegistry
                .connect(indexer)
                .registerIndexer(utils.parseEther(stake.toString()), constants.HashZero, commissionRate * 1000);
            console.log(`Indexer Complete for account ${account}`);
        }
    },
    Project: async function ({ account, deployments, metadata }: ProjectInput, { accounts, ipfs, sdk }: Context) {
        console.log(`Project Start for ${metadata['name']}`);
        const author = accounts[account];
        assert(author, `can't find account ${account}`);
        const { cid: metadataCid } = await ipfs.add(JSON.stringify(metadata), { pin: true });
        const [firstDeploy, ...restDeploy] = deployments;
        const { cid: deploymentMetadata } = await ipfs.add(JSON.stringify(firstDeploy.version), { pin: true });
        const tx = await sdk.projectRegistry
            .connect(author)
            .createProject(
                cidToBytes32(metadataCid.toString()),
                cidToBytes32(deploymentMetadata.toString()),
                cidToBytes32(firstDeploy.deploymentId),
                0,
            );
        const receipt = await tx.wait();
        const evt = receipt.events.find(
            (log) => log.topics[0] === utils.id('CreateQuery(uint256,address,bytes32,bytes32,bytes32)')
        );
        const { queryId } = evt.args;
        for (const { deploymentId, version } of restDeploy) {
            const { cid } = await ipfs.add(JSON.stringify(version), { pin: true });
            await sdk.projectRegistry
                .connect(author)
                .updateDeployment(queryId, cidToBytes32(deploymentId), cidToBytes32(cid.toString()));
        }
        console.log(`Project Complete for ${metadata['name']} queryId: ${queryId.toString()}`);
    },
    QueryAction: async function ({ account, action, deploymentId }: QueryActionInput, { sdk, accounts }: Context) {
        console.log(`QueryAction Start for ${action} ${deploymentId}`);
        const indexer = accounts[account];
        assert(indexer, `can't find indexer account ${account}`);
        let tx;
        if (action === 'index') {
            tx = await sdk.projectRegistry.connect(indexer).startService(cidToBytes32(deploymentId));
        } else if (action === 'ready') {
            const status = await sdk.projectRegistry.deploymentStatusByIndexer(
                cidToBytes32(deploymentId),
                indexer.address
            );
            if (status === 1) {
                tx = await sdk.projectRegistry.connect(indexer).startService(cidToBytes32(deploymentId));
            } else {
                console.log(`skip because the current status is ${status}`);
            }
        }
        await tx.wait();
        console.log(`QueryAction Complete`);
    },
    IndexerController: async function ({ indexer, controller }: IndexerControllerInput, { accounts, sdk }: Context) {
        console.log(`IndexerController Start for ${indexer}`);
        const indexerWallet = accounts[indexer];
        const controllerWallet = accounts[controller];
        const currentController = await sdk.indexerRegistry.getController(indexerWallet.address);
        if (currentController.toLowerCase() === controllerWallet.address.toLowerCase()) {
            console.log('IndexerController skip - not changed');
            return;
        }
        console.log(`set controller for ${indexerWallet.address} to ${controllerWallet.address}`);
        const tx = await sdk.indexerRegistry.connect(indexerWallet).setControllerAccount(controllerWallet.address);
        await tx.wait();
        console.log(`IndexerController Complete`);
    },
    PlanTemplate: async function (
        { period, dailyReqCap, rateLimit, metadata }: PlanTemplateInput,
        { ipfs, sdk, rootAccount }: Context
    ) {
        console.log(`PlanTemplate Start`);
        const next = await sdk.planManager.nextTemplateId();
        let templates;
        for (let i = 0; i < next.toNumber(); i++) {
            const template = await sdk.planManager.getPlanTemplate(i);
            templates.push(template);
        }
        console.log(templates);
        const match = templates.findIndex(
            (tpl) => tpl.dailyReqCap.eq(dailyReqCap) && tpl.period.eq(period) && tpl.rateLimit.eq(rateLimit)
        );
        if (match > -1) {
            console.log(`PlanTemplate skip for planId: ${match} ${JSON.stringify({ period, dailyReqCap, rateLimit })}`);
            return;
        }
        const { cid: metadataCid } = await ipfs.add(JSON.stringify(metadata), { pin: true });
        console.log(`Plan Template Metadata: ${metadataCid}`);
        const token = sdk.sqToken.address;
        const tx = await sdk.planManager
            .connect(rootAccount)
            .createPlanTemplate(period, dailyReqCap, rateLimit, token, cidToBytes32(metadataCid.toString()));
        await tx.wait();
        console.log(`PlanTemplate Complete`);
    },
};
