import type CONTRACTS from './contracts';

export type SubqueryNetwork = 'mainnet' | 'kepler' | 'testnet' | 'local';

export type HardhatDeploymentConfig = {
    readonly network: {
        name: SubqueryNetwork;
        platform: 'hardhat';
        endpoint?: string;
        providerConfig: {
            chainId: number;
            name: 'Hardhat';
        };
    };
    readonly contracts: {[contract: string]: any[]};
};

export type MoonbeamDeploymentConfig = {
    readonly network: {
        name: SubqueryNetwork;
        platform: 'moonbeam';
        endpoint?: string;
        providerConfig: {
            chainId: number;
            name: 'Moonbeam';
        };
    };
    readonly contracts: {[contract: string]: any[]};
};

export type DeploymentConfig = MoonbeamDeploymentConfig | HardhatDeploymentConfig;

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
