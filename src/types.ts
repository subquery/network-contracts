import type CONTRACTS from './contracts';

export type SubqueryNetwork = 'mainnet' | 'kepler' | 'testnet' | 'moonbase' | 'local';

export type Network = {
    chainId: string,
    chainName: string,
    rpcUrls: string[],
    blockExplorerUrls: string[],
    iconUrls: string[],
    nativeCurrency: {
        name: string,
        symbol: string,
        decimals: number
    }
}

export type DeploymentConfig = {
    network: Network;
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
