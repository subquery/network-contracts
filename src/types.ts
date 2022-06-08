import type CONTRACTS from './contracts';

export type SubqueryNetwork = 'mainnet' | 'testnet' | 'local';

export type MoonbeamDeploymentConfig = {
    readonly network: {
        name: SubqueryNetwork;
        endpoint?: string;
        platform: 'moonbeam';
        providerConfig: {
            chainId: number;
            name: 'moonbase-alpha' | 'moonbeam-river';
        };
    };
    readonly contracts: {[contract: string]: any[]};
};
export type AcalaDeploymentConfig = {
    readonly network: {
        name: SubqueryNetwork;
        endpoint?: {eth: string; substrate: string};
        platform: 'acala';
    };
    readonly contracts: {[contract: string]: any[]};
};

export type DeploymentConfig = AcalaDeploymentConfig | MoonbeamDeploymentConfig;

export type ContractDeploymentDetail = {
    address: string;
    bytecodeHash: string;
    txHash: string;
    lastUpdate: string;
};
export type ContractDeployment = Record<keyof typeof CONTRACTS, ContractDeploymentDetail>;

export type SdkOptions = {
    network?: SubqueryNetwork;
    deploymentDetails?: ContractDeployment;
};
