import { Network, SubqueryNetwork } from './types';

export const CURRENT_NETWORK = 'testnet';

export const networks: { [key in SubqueryNetwork]: Network } = {
    mainnet:{
        chainId: '0x89',
        chainName: 'Polygon',
        rpcUrls: [
            'https://polygon-rpc.com/'
        ],
        iconUrls: [
          'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg'
        ],
        blockExplorerUrls: ['https://polygonscan.com/'],
        nativeCurrency: {
          name: 'Matic Token',
          symbol: 'MATIC',
          decimals: 18
        }
    },
    kepler: {
        chainId: '0x89',
        chainName: 'Polygon',
        rpcUrls: [
            'https://polygon-rpc.com'
        ],
        iconUrls: [
          'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg'
        ],
        blockExplorerUrls: ['https://polygonscan.com/'],
        nativeCurrency: {
          name: 'Matic Token',
          symbol: 'MATIC',
          decimals: 18
        }
    },
    testnet: {
        chainId: '0x13881',
        chainName: 'Mumbai',
        rpcUrls: [
            'https://rpc.ankr.com/polygon_mumbai',
        ],
        iconUrls: [
          'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg'
        ],
        blockExplorerUrls: ['https://mumbai.polygonscan.com/'],
        nativeCurrency: {
          name: 'Matic Token',
          symbol: 'MATIC',
          decimals: 18
        }
    },
    local: {
        chainId: '0x7A69',
        chainName: 'Hardhat',
        rpcUrls: [
            'http://127.0.0.1:8545'
        ],
        iconUrls: [],
        blockExplorerUrls: [''],
        nativeCurrency: {
          name: '',
          symbol: '',
          decimals: 18
        }
    }
}