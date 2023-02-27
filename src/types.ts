import type CONTRACTS from './contracts';

export type SubqueryNetwork = 'mainnet' | 'kepler' | 'testnet' | 'local';

export type DeploymentConfig = {
    network: {
        name: SubqueryNetwork;
        platform: string;
        endpoint?: string;
        providerConfig: {
            chainId: number;
            name: string;
        };
    };
    contracts: {[contract: string]: any[]};
};

export type ContractDeploymentDetail = {
    innerAddress?: string;
    address: string;
    bytecodeHash: string;
    lastUpdate: string;
};
export type ContractDeployment = Record<keyof typeof CONTRACTS, ContractDeploymentDetail>;

export type SdkOptions = {
    network?: SubqueryNetwork;
    deploymentDetails?: ContractDeployment;
};
