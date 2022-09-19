import assert from 'assert';
import dotenv from 'dotenv';
import {DeploymentConfig} from '../../src';

dotenv.config();
const platform = process.env.PLATFORM;
const endpoint = process.env.ENDPOINT;
const wsUrl = process.env.WS_URL;

const networkConfig = {
    acala: {
        name: 'local',
        endpoint: {
            eth: endpoint,
            substrate: wsUrl,
        },
        platform,
    },
    moonbeam: {
        name: 'local',
        endpoint,
        platform,
        providerConfig: {
            chainId: 1281,
            name: 'sqn-local',
        },
    },
    hardhat: {
        name: 'local',
        endpoint,
        platform,
        providerConfig: {
            chainId: 31337,
            name: 'hardhat-local',
        },
    },
};

export default function localConfig(): DeploymentConfig {
    assert(platform, 'Not found PLATFORM in env');
    assert(endpoint, 'Not found ENDPOINT in env');
    return {
        network: networkConfig[platform],
        contracts: {
            InflationController: [100, '0x4ae8fcdddc859e2984ce0b8f4ef490d61a7a9b7f'], // inflationRateBP, inflationDestination
            Staking: [1000], // LockPeriodl
            EraManager: [60 * 60 * 24],
            ServiceAgreementRegistry: [1e6], //threshold
            PurchaseOfferMarket: [1e5, '0x0000000000000000000000000000000000000000'],
            IndexerRegistry: [1000e18],
        },
    };
}
