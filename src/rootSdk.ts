// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import type {Provider as AbstractProvider} from '@ethersproject/abstract-provider';
import {Signer} from 'ethers';
import {DEPLOYMENT_DETAILS} from './deployments';
import { BatchTransfer, ERC20, SQToken, Vesting } from './typechain';
import {CONTRACT_FACTORY, ContractDeploymentInner, ContractName, FactoryContstructor, SdkOptions} from './types';
import assert from "assert";

// HOTFIX: Contract names are not consistent between deployments and privous var names
const contractNameConversion: Record<string, string> = {
    sQToken: 'sqToken',
    vTSQToken: 'vtSQToken',
};

const ROOT_CONTRACTS = ['SQToken', 'Vesting', 'VTSQToken'];


export class RootContractSDK {
    private _contractDeployments: ContractDeploymentInner;

    readonly sqToken!: SQToken;
    readonly vtSQToken!: ERC20;
    readonly vesting!: Vesting;
    readonly batchTransfer!: BatchTransfer;

    constructor(private readonly signerOrProvider: AbstractProvider | Signer, public readonly options: SdkOptions) {
        assert(this.options.deploymentDetails || DEPLOYMENT_DETAILS[options.network], ' missing contract deployment info');
        this._contractDeployments = this.options.deploymentDetails ?? DEPLOYMENT_DETAILS[options.network]!.root;
        this._init();
    }

    static create(signerOrProvider: AbstractProvider | Signer, options: SdkOptions) {
        return new RootContractSDK(signerOrProvider, options);
    }

    private async _init() {
        const contracts = Object.entries(this._contractDeployments).filter( ([name]) =>
            ROOT_CONTRACTS.includes(name)
        ).map(([name, contract]) => ({
            address: contract.address,
            factory: CONTRACT_FACTORY[name as ContractName] as FactoryContstructor,
            name: name as ContractName,
        }));

        for (const {name, factory, address} of contracts) {
            if (!factory) continue;
            const contractInstance = factory.connect(address, this.signerOrProvider);
            if (contractInstance) {
                const key = name.charAt(0).toLowerCase() + name.slice(1);
                const contractName = contractNameConversion[key] ?? key;
                Object.defineProperty(this, contractName, {
                    get: () => contractInstance,
                });
            } else {
                throw new Error(`${name} contract not found`);
            }
        }
    }
}
