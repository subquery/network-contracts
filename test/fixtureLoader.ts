// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { Provider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import assert from 'assert';
import { constants, utils } from 'ethers';
import { IPFSHTTPClient } from 'ipfs-http-client';
import { ContractSDK, ProjectType } from '../src';

function cidToBytes32(cid: string): string {
    return '0x' + Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex');
}

export interface AccountInput {
    name: string;
    seed?: string;
    derive?: string;
    pk?: string;
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
    id: string;
    account: string;
    metadata: object;
    projectType: number;
    deployments: {
        deploymentId: string;
        deployment: string;
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

export interface SQTGiftSeriesInput {
    seriesId: number;
    maxSupply: number;
    metadata: object;
}

export interface SQTGiftSeriesAllowListInput {
    seriesId: number;
    list: { address: string; amount: number }[];
}

export interface SQTGiftSeriesClaimInput {
    seriesId: number;
    user: string;
}

export interface BoosterRewardSettingInput {
    queryRewardRatios: { projectType: ProjectType; ratio: number }[];
    issuancePerBlock: string;
}

export interface DeploymentBoosterInput {
    deploymentId: string;
    user: string;
    amount: number;
}

export interface ProjectTypeCreatorRestrictedInput {
    value: { projectType: ProjectType; restricted: boolean }[];
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
    Account: function ({ name, derive, seed, pk }: AccountInput, context: Context) {
        if (seed) {
            context.accounts[name] = createWallet(seed, derive, context.provider);
        } else if (pk) {
            context.accounts[name] = new Wallet(pk, context.provider);
        }
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
    Project: async function (
        { account, deployments, metadata, projectType, id }: ProjectInput,
        { accounts, ipfs, sdk, rootAccount }: Context
    ) {
        console.log(`Project Start for ${metadata['name']}`);
        const author = account ? accounts[account] : rootAccount;
        assert(author, `can't find account ${account}`);
        const { cid: metadataCid } = await ipfs.add(JSON.stringify(metadata), { pin: true });
        const [firstDeploy, ...restDeploy] = deployments;
        const { cid: deploymentMetadata } = await ipfs.add(JSON.stringify(firstDeploy.version), { pin: true });
        let deploymentId = firstDeploy.deploymentId;
        if (!deploymentId) {
            const { cid: deploymentCid } = await ipfs.add(firstDeploy.deployment, { pin: true });
            deploymentId = deploymentCid.toString();
        }
        // update metadata
        let projectId = id;
        if (id) {
            const tx = await sdk.projectRegistry.connect(author).updateProjectMetadata(id, metadataCid.toString());
            await tx.wait();
        } else {
            const tx = await sdk.projectRegistry
                .connect(author)
                .createProject(
                    metadataCid.toString(),
                    cidToBytes32(deploymentMetadata.toString()),
                    cidToBytes32(deploymentId),
                    projectType
                );
            const receipt = await tx.wait();
            const evt = receipt.events.find(
                (log) => log.topics[0] === utils.id('ProjectCreated(address,uint256,string,uint8,bytes32,bytes32)')
            );
            projectId = evt.args.projectId;
        }
        for (const { deploymentId: _d, deployment, version } of restDeploy) {
            let deploymentId = _d;
            if (!deploymentId) {
                const { cid: deploymentCid } = await ipfs.add(deployment, { pin: true });
                deploymentId = deploymentCid.toString();
            }
            const { cid } = await ipfs.add(JSON.stringify(version), { pin: true });
            await sdk.projectRegistry
                .connect(author)
                .addOrUpdateDeployment(projectId, cidToBytes32(deploymentId), cidToBytes32(cid.toString()), true);
        }
        console.log(`Project Complete for ${metadata['name']} queryId: ${projectId.toString()}`);
    },
    QueryAction: async function ({ account, action, deploymentId }: QueryActionInput, { sdk, accounts }: Context) {
        console.log(`QueryAction Start for ${action} ${deploymentId}`);
        const indexer = accounts[account];
        assert(indexer, `can't find indexer account ${account}`);
        let tx;
        if (action === 'index') {
            tx = await sdk.projectRegistry.connect(indexer).startService2(cidToBytes32(deploymentId), indexer.address);
        } else if (action === 'ready') {
            const status = await sdk.projectRegistry.deploymentStatusByIndexer(
                cidToBytes32(deploymentId),
                indexer.address
            );
            if (status === 1) {
                tx = await sdk.projectRegistry
                    .connect(indexer)
                    .startService2(cidToBytes32(deploymentId), indexer.address);
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
    SQTGiftSeries: async function (
        { seriesId, maxSupply, metadata }: SQTGiftSeriesInput,
        { ipfs, sdk, rootAccount }: Context
    ) {
        console.log(`SQTGiftSeries Start`);
        const series = await sdk.sqtGift.series(seriesId);
        if (!series.maxSupply?.toNumber()) {
            console.log(`SQTGiftSeries: Create Series`);
            const { cid: metadataCid } = await ipfs.add(JSON.stringify(metadata), { pin: true });
            console.log(`SQTGiftSeries Metadata: ${metadataCid}`);
            const tx = await sdk.sqtGift.connect(rootAccount).createSeries(maxSupply, metadataCid.toString());
            await tx.wait();
        } else if (series.maxSupply.toNumber() !== maxSupply) {
            console.log(`SQTGiftSeries: Update maxSupply ${series.maxSupply.toNumber()} => ${maxSupply}`);
            const tx = await sdk.sqtGift.connect(rootAccount).setMaxSupply(seriesId, maxSupply);
            await tx.wait();
        }
        console.log(`SQTGiftSeries Complete`);
    },
    SQTGiftAllowList: async function ({ seriesId, list }: SQTGiftSeriesAllowListInput, { sdk, rootAccount }: Context) {
        console.log(`SQTGiftAllowList Start`);

        const tx = await sdk.sqtGift.connect(rootAccount).batchAddToAllowlist(
            list.map(() => seriesId),
            list.map((i) => i.address),
            list.map((i) => i.amount)
        );
        console.log(`SQTGiftAllowList tx: ${tx.hash}`);
        await tx.wait();
        console.log(`SQTGiftAllowList Complete`);
    },
    SQTGiftClaim: async function ({ seriesId, user }: SQTGiftSeriesClaimInput, { sdk, accounts }: Context) {
        console.log(`SQTGiftClaim Start`);
        const wallet = accounts[user];
        if (!wallet) {
            console.log(`account ${user} not found`);
            return;
        }
        const tx = await sdk.sqtGift.connect(wallet).mint(seriesId);
        await tx.wait();
        console.log(`SQTGiftClaim Complete`);
    },
    BoosterRewardSetting: async function (
        { queryRewardRatios, issuancePerBlock }: BoosterRewardSettingInput,
        { sdk, rootAccount }: Context
    ) {
        for (const { projectType, ratio } of queryRewardRatios) {
            const currentRatio = await sdk.rewardsBooster.boosterQueryRewardRate(projectType);
            if (!currentRatio.eq(ratio)) {
                console.log(
                    `set queryRewardRatio for projectType: ${projectType} from ${currentRatio.toString()} to ${ratio}`
                );
                const tx = await sdk.rewardsBooster.connect(rootAccount).setBoosterQueryRewardRate(projectType, ratio);
                await tx.wait();
            }
        }
        const currentIssuancePerBlock = await sdk.rewardsBooster.issuancePerBlock();
        if (!currentIssuancePerBlock.eq(issuancePerBlock)) {
            console.log(`set issuancePerBlock: from ${currentIssuancePerBlock.toString()} to ${issuancePerBlock}`);
            const tx = await sdk.rewardsBooster.connect(rootAccount).setIssuancePerBlock(issuancePerBlock);
            await tx.wait();
        }
    },
    DeploymentBooster: async function (
        { user, amount, deploymentId }: DeploymentBoosterInput,
        { sdk, accounts }: Context
    ) {
        console.log(`DeploymentBooster Start`);
        const wallet = accounts[user];
        if (!wallet) {
            console.log(`account ${user} not found`);
            return;
        }
        const allowance = await sdk.sqToken.allowance(wallet.address, sdk.rewardsBooster.address);
        const diff = utils.parseEther(amount.toString()).sub(allowance);
        if (diff.gt(0)) {
            console.log(`add allowance ${utils.formatEther(diff)}`);
            const tx0 = await sdk.sqToken.connect(wallet).increaseAllowance(sdk.rewardsBooster.address, diff);
            await tx0.wait();
        }
        const currentBooster = await sdk.rewardsBooster.getRunnerDeploymentBooster(
            cidToBytes32(deploymentId),
            wallet.address
        );
        if (currentBooster.gt(utils.parseEther(amount.toString()))) {
            console.log(`remove booster ${utils.formatEther(currentBooster.sub(utils.parseEther(amount.toString())))}`);
            const tx = await sdk.rewardsBooster
                .connect(wallet)
                .removeBoosterDeployment(
                    cidToBytes32(deploymentId),
                    currentBooster.sub(utils.parseEther(amount.toString()))
                );
            await tx.wait();
        } else if (currentBooster.lt(utils.parseEther(amount.toString()))) {
            console.log(`add booster ${utils.formatEther(utils.parseEther(amount.toString()).sub(currentBooster))}`);
            const tx = await sdk.rewardsBooster
                .connect(wallet)
                .boostDeployment(cidToBytes32(deploymentId), utils.parseEther(amount.toString()).sub(currentBooster));
            await tx.wait();
        }
        console.log(`DeploymentBooster End`);
    },
    ProjectTypeCreatorRestricted: async function (
        { value }: ProjectTypeCreatorRestrictedInput,
        { sdk, rootAccount }: Context
    ) {
        console.log(`ProjectTypeCreatorRestricted Start`);
        for (const { projectType, restricted } of value) {
            const onchainVal = await sdk.projectRegistry.creatorRestricted(projectType);
            if (onchainVal !== restricted) {
                const tx = await sdk.projectRegistry.connect(rootAccount).setCreatorRestricted(projectType, restricted);
                console.log(`type: ${projectType} change to ${restricted} tx: ${tx.hash}`);
                await tx.wait();
            } else {
                console.log(`type: ${projectType} no change`);
            }
        }
        console.log(`ProjectTypeCreatorRestricted End`);
    },
};
